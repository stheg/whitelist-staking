import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { delay, toDate } from "../../scripts/misc";
import { IERC20MintableBurnable, IUniswapV2Pair, StakingPlatform } from "../../typechain-types";
import { deployStakingPlatform } from "../../scripts/test-deployment";
import { deployTokenAndProvideLiquidityForTests } from "../../scripts/provide-liquidity";
import { keccak256 } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';

describe("claim", () => {
    let accounts: SignerWithAddress[];
    let owner: SignerWithAddress;
    let rewardTokenOwner: SignerWithAddress;
    let staker: SignerWithAddress;
    let contract: StakingPlatform;
    let stakingToken: IUniswapV2Pair;
    let rewardToken: IERC20MintableBurnable;
    let availableLpTokenBalance: BigNumber;
    let userProof: string[];

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        rewardTokenOwner = accounts[0];
        owner = accounts[1];
        staker = accounts[2];

        [stakingToken, rewardToken] =
            await deployTokenAndProvideLiquidityForTests(staker, rewardTokenOwner, "10000");

        availableLpTokenBalance = await stakingToken.balanceOf(staker.address);

        contract = await deployStakingPlatform(
            stakingToken.address, 
            rewardToken.address, 
            owner
        );
        await contract.connect(owner).grantRole(await contract.CONFIGURATOR_ROLE(), owner.address);
        
        const whitelist = [
            accounts[1].address,
            accounts[2].address,
            accounts[3].address,
            accounts[4].address,
            accounts[5].address,
            accounts[6].address,
            accounts[7].address,
        ]
        const leaves = whitelist.map(a => keccak256(a));
        const merkleTree = new MerkleTree(leaves, keccak256, { sort: true });
        const wlRoot = merkleTree.getHexRoot();
        await contract.connect(owner).setWhitelist(wlRoot);
        let userHash = keccak256(staker.address);
        userProof = merkleTree.getHexProof(userHash);

        contract = contract.connect(staker);

        await rewardToken.connect(rewardTokenOwner)
            .mint(contract.address, BigNumber.from("1000000000000000"));
    });

    it("should revert if reward = 0", async () => {
        const tx = contract.claim();
        await expect(tx).to.be.revertedWith("Nothing to claim yet");
    });

    it("should revert if too early", async () => {
        //environment
        const halfOfAmount = Math.floor(availableLpTokenBalance.toNumber() / 2);
        await stakingToken.approve(contract.address, 2 * halfOfAmount);
        await contract.stake(halfOfAmount, userProof);
        const rewardDelay = await contract.getRewardDelay();
        //current test config
        await delay(rewardDelay, -60);//-60 seconds
        //action
        const tx = contract.claim();
        //checks
        await expect(tx).to.be.revertedWith("Nothing to claim yet");
    });

    it("should transfer accumulated rewards for passed periods", async () => {
        //environment
        const oneThird = Math.floor(availableLpTokenBalance.toNumber() / 3);
        await stakingToken.approve(contract.address, 3 * oneThird);
        await contract.stake(oneThird, userProof);
        //current test config
        const rewardPercentage = await contract.getRewardPercentage();
        const rewardDelay = await contract.getRewardDelay();
        const periods = 2;
        await delay(rewardDelay.mul(periods), 60);//+60 seconds
        const expectedReward =
            Math.floor(oneThird * periods * rewardPercentage.toNumber() / 100);
        //action
        const balanceBefore = await rewardToken.balanceOf(staker.address);
        await contract.claim();
        //checks
        const balanceAfter = await rewardToken.balanceOf(staker.address);
        expect(balanceAfter).eq(balanceBefore.add(expectedReward));
    });

    it("should transfer sum of saved reward and calculated one", async () => {
        //environment
        const oneThird = Math.floor(availableLpTokenBalance.toNumber() / 3);
        await stakingToken.approve(contract.address, 3 * oneThird);
        await contract.stake(oneThird, userProof);
        //current test config
        const rewardPercentage = await contract.getRewardPercentage();
        const rewardDelay = await contract.getRewardDelay();
        await delay(rewardDelay, 60);//+60 seconds
        await contract.stake(oneThird, userProof);
        const [currentAmount, savedReward,,] = 
            await contract.connect(staker).getDetails();
        //action
        await delay(rewardDelay, 60);//+60 seconds
        const expectedCalculatedReward =
            Math.floor(currentAmount.mul(rewardPercentage).div(100).toNumber());
        const balanceBefore = await rewardToken.balanceOf(staker.address);
        await contract.claim();
        //checks
        const balanceAfter = await rewardToken.balanceOf(staker.address);
        expect(balanceAfter)
            .eq(balanceBefore.add(expectedCalculatedReward).add(savedReward));
    });

    it("shouldn't add reward for another period if too early", async () => {
        //environment
        const oneThird = Math.floor(availableLpTokenBalance.toNumber() / 3);
        await stakingToken.approve(contract.address, 3 * oneThird);
        await contract.stake(oneThird, userProof);
        //current test config
        const rewardPercentage = await contract.getRewardPercentage();
        const rewardDelay = await contract.getRewardDelay();
        const periods = 2;
        /// wait for ALMOST 3 reward periods
        await delay(rewardDelay.mul(periods+1), -120);//-120 seconds
        /// it should be rewards only for 2 periods, not 3
        let expectedReward = Math.floor(
            oneThird * periods * rewardPercentage.toNumber() / 100
        );
        //action
        const balanceBefore = await rewardToken.balanceOf(staker.address);
        await contract.claim();
        //checks
        const balanceAfter = await rewardToken.balanceOf(staker.address);
        expect(balanceAfter.toNumber())
            .eq(balanceBefore.add(expectedReward).toNumber());
    });

    it("should change last reward date after reward calculation", async () => {
        //environment
        const oneThird = Math.floor(availableLpTokenBalance.toNumber() / 3);
        await stakingToken.approve(contract.address, 3 * oneThird);
        await contract.stake(oneThird, userProof);
        //current test config
        let [, , , lastRewardDate1] =
            await contract.getDetails();
        const rewardDelay = await contract.getRewardDelay();
        await delay(rewardDelay, 60);
        //action
        await contract.claim();
        //checks
        let [, , , lastRewardDate2] = 
            await contract.getDetails();
        expect(toDate(lastRewardDate2)).greaterThan(toDate(lastRewardDate1));
    });
});