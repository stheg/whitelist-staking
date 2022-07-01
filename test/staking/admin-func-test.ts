import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { IERC20MintableBurnable, IUniswapV2Pair, StakingPlatform } from "../../typechain-types";
import { deployStakingPlatform } from "../../scripts/test-deployment";
import { deployTokenAndProvideLiquidityForTests } from "../../scripts/provide-liquidity";

describe("lock-unlock functions", () => {
    let accounts: SignerWithAddress[];
    let owner: SignerWithAddress;
    let rewardTokenOwner: SignerWithAddress;
    let staker: SignerWithAddress;
    let contract: StakingPlatform;
    let stakingToken: IUniswapV2Pair;
    let rewardToken: IERC20MintableBurnable;

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        rewardTokenOwner = accounts[0];
        owner = accounts[1];
        staker = accounts[2];

        [stakingToken, rewardToken] =
            await deployTokenAndProvideLiquidityForTests(staker, rewardTokenOwner);

        contract = await deployStakingPlatform(
            stakingToken.address, 
            rewardToken.address, 
            owner
        );
        contract = contract.connect(staker);
    });

    it("setRewardPercentage reverts if no correct role", async () => {
        const tx = contract.setRewardPercentage(10);
        await expect(tx).to.be.reverted;
    });

    it("setRewardDelay reverts if no correct role", async () => {
        const tx = contract.setRewardDelay(5);
        await expect(tx).to.be.reverted;
    });

    it("setUnstakeDelay reverts if no correct role", async () => {
        const tx = contract.setUnstakeDelay(0);
        await expect(tx).to.be.reverted;
    });

    it("setRewardToken reverts if no correct role", async () => {
        const tx = contract.setRewardToken(stakingToken.address);
        await expect(tx).to.be.reverted;
    });

    it("setStakingToken reverts if no correct role", async () => {
        const tx = contract.setStakingToken(rewardToken.address);
        await expect(tx).to.be.reverted;
    });

    it("setRewardToken reverts if no correct role", async () => {
        const tx = contract.setRewardToken(stakingToken.address);
        await expect(tx).to.be.reverted;
    });

    it("owner can change reward token ", async () => {
        contract = contract.connect(owner);
        await contract.grantRole(await contract.CONFIGURATOR_ROLE(), owner.address);

        await contract.setRewardToken(stakingToken.address);
        const addr = await contract.getRewardToken();
        await expect(addr).eq(stakingToken.address);
    });

    it("owner can change staking token ", async () => {
        contract = contract.connect(owner);
        await contract.grantRole(await contract.CONFIGURATOR_ROLE(), owner.address);

        await contract.setStakingToken(rewardToken.address);
        const addr = await contract.getStakingToken();
        await expect(addr).eq(rewardToken.address);
    });

    it("setRewardPercentage emits an event ", async () => {
        const newOne = 15;
        await contract.connect(owner).grantRole(await contract.CONFIGURATOR_ROLE(), owner.address);

        const tx = contract.connect(owner).setRewardPercentage(newOne);
        await expect(tx).to.emit(contract, "RewardRateChanged")
            .withArgs(newOne, owner.address);
    });

    it("setRewardDelay emits an event ", async () => {
        const newOne = 15;
        await contract.connect(owner).grantRole(await contract.CONFIGURATOR_ROLE(), owner.address);

        const tx = contract.connect(owner).setRewardDelay(newOne);
        await expect(tx).to.emit(contract, "RewardDelayChanged")
            .withArgs(newOne, owner.address);
    });

    it("setUnstakeDelay emits an event ", async () => {
        const newOne = 15;
        await contract.connect(owner).grantRole(await contract.CONFIGURATOR_ROLE(), owner.address);

        const tx = contract.connect(owner).setUnstakeDelay(newOne);
        await expect(tx).to.emit(contract, "UnstakeDelayChanged")
            .withArgs(newOne, owner.address);
    });
});
