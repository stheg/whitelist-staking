import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ACDMPlatform, IERC20MintableBurnable, IUniswapV2Pair } from "../../typechain-types";
import { deployERC20Token, deployACDMPlatform } from "../../scripts/test-deployment";
import { deployTokenAndProvideLiquidityForTests } from "../../scripts/provide-liquidity";
import { BigNumber } from "ethers";
import { delay } from "../../scripts/misc";

describe("admin functions", () => {
    let accounts: SignerWithAddress[];
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let contract: ACDMPlatform;
    let stakingToken: IUniswapV2Pair;
    let rewardToken: IERC20MintableBurnable;
    let acdmToken: IERC20MintableBurnable;

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];

        acdmToken = await deployERC20Token("ACDM", 8, owner);

        [stakingToken, rewardToken] = await deployTokenAndProvideLiquidityForTests(user2, owner);

        contract = await deployACDMPlatform(
            acdmToken.address,
            stakingToken.address, 
            rewardToken.address, 
            owner
        );
        contract = contract.connect(user2);
        await contract.getACDMToken();

        await acdmToken.mint(contract.address, 100000);
    });

    it("setRoundDuration reverts if no correct role", async () => {
        const tx = contract.setRoundDuration(1000);
        await expect(tx).to.be.reverted;
    });

    it("setRoundDuration works", async () => {
        await contract.connect(owner).grantRole(await contract.CONFIGURATOR_ROLE(), owner.address);
        const tx = contract.connect(owner).setRoundDuration(1000);
        await expect(tx).to.not.be.reverted;
    });

    it("withdraw reverts if not admin", async () => {
        const tx = contract.connect(owner).withdraw();
        await expect(tx).to.be.reverted;
    });

    it("withdraw reverts if no enough ETH", async () => {
        await contract.connect(owner).grantRole(await contract.DEFAULT_ADMIN_ROLE(), owner.address);
        const tx = contract.connect(owner).withdraw();
        await expect(tx).to.be.revertedWith("NothingToWithdraw");
    });

    it("withdraw transfers ETH to admin", async () => {
        const amount = 100;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        await contract.connect(user1).buy(amount, { value: totalPrice });
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(BigNumber.from(30), 30);
        await acdmToken.connect(user1).approve(contract.address, amount);
        await contract.connect(user1).list(amount, price);

        await contract.connect(user2).buyListed(
            user1.address,
            0,
            amount,
            { value: totalPrice }
        );
        
        const balance = await (await ethers.getSigner(contract.address)).getBalance();
        const reserved = await contract.getAccumulatedPlatformBonus();
        const expectedTransfer = balance.sub(reserved);
        await contract.connect(owner).grantRole(await contract.DEFAULT_ADMIN_ROLE(), owner.address);
        
        const tx = contract.connect(owner).withdraw();
        await expect(() => tx).to.changeEtherBalances(
            [contract, owner],
            [expectedTransfer.mul(-1), expectedTransfer]
        );
    });
});
