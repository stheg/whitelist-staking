import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ACDMPlatform, IERC20MintableBurnable, IUniswapV2Pair } from "../../typechain-types";
import { deployERC20Token, deployACDMPlatform } from "../../scripts/test-deployment";
import { deployTokenAndProvideLiquidityForTests } from "../../scripts/provide-liquidity";
import { BigNumber } from "ethers";
import { delay } from "../../scripts/misc";

describe("buyListed in trade round", () => {
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
        await contract.grantRole(await contract.CONFIGURATOR_ROLE(), owner.address);
        // to simplify these tests, referrals will be tested separately
        await contract.setReferralPercent(false, false, 0);
        await contract.setReferralPercent(false, true, 0);
        await contract.setReferralPercent(true, false, 0);
        await contract.setReferralPercent(true, true, 0);
        contract = contract.connect(user2);

        await acdmToken.mint(contract.address, 100000);
    });

    it("buyListed reverts if not trade round", async () => {
        const tx = contract.connect(user1).buyListed(user1.address, 0, 1);
        await expect(tx).to.be.revertedWith("ItIsNotTradeRound");
    });

    it("buyListed reverts if trade round finished", async () => {
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(await contract.getRoundDuration(), 30);
        const tx = contract.connect(user1).buyListed(user1.address, 0, 1);
        await expect(tx).to.be.revertedWith("ItIsNotTradeRound");
    });

    it("buyListed reverts if no such listing", async () => {
        const amount = 100;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        await contract.connect(user1).buy(amount, { value: totalPrice });
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(BigNumber.from(30), 30);

        const tx = contract.connect(user2).buyListed(user1.address, 0, 1);
        await expect(tx).to.be.revertedWith(`NoSuchListing("${user1.address}", 0)`);
    });

    it("buyListed reverts if requested amount exceeds listed one", async () => {
        const amount = 100;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        await contract.connect(user1).buy(amount, { value: totalPrice });
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(BigNumber.from(30), 30);
        await acdmToken.connect(user1).approve(contract.address, amount);
        await contract.connect(user1).list(amount, price);

        const tx = contract.connect(user2).buyListed(user1.address, 0, amount + 1);
        await expect(tx).to.be.revertedWith("RequestedAmountExceedsListedAmount");
    });

    it("buyListed reverts if not enough ETH provided", async () => {
        const amount = 100;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        await contract.connect(user1).buy(amount, { value: totalPrice });
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(BigNumber.from(30), 30);
        await acdmToken.connect(user1).approve(contract.address, amount);
        await contract.connect(user1).list(amount, price);

        const tx = contract.connect(user2).buyListed(user1.address, 0, amount);
        await expect(tx).to.be.revertedWith("NotEnoughEtherProvided");
    });

    it("buyListed changes token balances", async () => {
        const amount = 100;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);
        
        await contract.connect(user1).buy(amount, { value: totalPrice });        
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(BigNumber.from(30), 30);
        await acdmToken.connect(user1).approve(contract.address, amount);
        await contract.connect(user1).list(amount, price);
        
        const tx = contract.connect(user2).buyListed(
            user1.address, 
            0, 
            amount, 
            {value: totalPrice}
        );
        await expect(() => tx).to.changeTokenBalances(
            acdmToken, [user2, contract], [amount, -amount]
        );
    });

    it("buyListed changes ETH balances", async () => {
        const amount = 100;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        await contract.connect(user1).buy(amount, { value: totalPrice });
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(BigNumber.from(30), 30);
        await acdmToken.connect(user1).approve(contract.address, amount);
        await contract.connect(user1).list(amount, price);

        const tx = contract.connect(user2).buyListed(
            user1.address,
            0,
            amount,
            { value: totalPrice }
        );
        await expect(() => tx).to.changeEtherBalances(
            [user1, user2], [totalPrice, -totalPrice]
        );
    });

    it("buyListed refunds ETH if sent more than needed", async () => {
        const amount = 100;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        await contract.connect(user1).buy(amount, { value: totalPrice });
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(BigNumber.from(30), 30);
        await acdmToken.connect(user1).approve(contract.address, amount);
        await contract.connect(user1).list(amount, price);

        const tx = contract.connect(user2).buyListed(
            user1.address,
            0,
            amount,
            { value: totalPrice.add(100) }
        );
        await expect(() => tx).to.changeEtherBalances(
            [user1, user2], [totalPrice, -totalPrice]
        );
    });
});
