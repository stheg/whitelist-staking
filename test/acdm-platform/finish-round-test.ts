import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ACDMPlatform, IERC20MintableBurnable, IUniswapV2Pair, Token } from "../../typechain-types";
import { deployERC20Token, deployACDMPlatform } from "../../scripts/test-deployment";
import { deployTokenAndProvideLiquidityForTests } from "../../scripts/provide-liquidity";
import { delay } from "../../scripts/misc";
import { BigNumber } from "ethers";

function calcNextSalePrice(price:BigNumber):BigNumber {
    return price.mul(103).div(100).add(ethers.utils.parseUnits("4000", "gwei"));
}

describe("finish round", () => {
    let accounts: SignerWithAddress[];
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let contract: ACDMPlatform;
    let stakingToken: IUniswapV2Pair;
    let rewardToken: IERC20MintableBurnable;
    let acdmToken: Token;

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

        await acdmToken.grantRole(await acdmToken.MINTER_ROLE(), contract.address);
        const defaultAmount = 100000 * (await acdmToken.decimals());
        await acdmToken.mint(contract.address, defaultAmount);
    });

    it("finishRound reverts if not trade round", async () => {
        const tx = contract.connect(user1).finishRound();
        await expect(tx).to.be.revertedWith("TooEarly");
    });

    it("finishRound reverts if too early", async () => {
        await delay(await contract.getRoundDuration(), 30);
        await contract.connect(user1).finishRound();
        const tx = contract.connect(user1).finishRound();
        await expect(tx).to.be.revertedWith("TooEarly");
    });

    it("finishRound burns tokens when it was sale round", async () => {
        await delay(await contract.getRoundDuration(), 30);
        const balance = await contract.getSaleRoundAmount();
        const tx = contract.connect(user1).finishRound();

        await expect(() => tx).to.changeTokenBalance(
            acdmToken, contract, -balance
        );
    });

    it("finishRound calculates new price when it was sale round", async () => {
        await delay(await contract.getRoundDuration(), 30);
        const price = await contract.getSaleRoundPrice();
        await contract.connect(user1).finishRound();
        const priceAfter = await contract.getSaleRoundPrice();

        expect(priceAfter).eq(calcNextSalePrice(price));
    });

    it("finishRound emits RoundFinished event when sale round is finished", async () => {
        await delay(await contract.getRoundDuration(), 30);
        const price = await contract.getSaleRoundPrice();
        const balance = await contract.getSaleRoundAmount();
        
        const tx = contract.connect(user1).finishRound();
        
        await expect(tx).to.emit(contract, "RoundFinished");
    });

    it("finishRound calculates new amount when it was trade round", async () => {
        const startAmount = await contract.getSaleRoundAmount();
        const amount = startAmount.div(2);
        const startPrice = await contract.getSaleRoundPrice();
        await contract.connect(user1).buy(
            amount,
            {value:amount.mul(startPrice)}
        );
        await delay(await contract.getRoundDuration(), 30);
        await contract.connect(user1).finishRound();
        await acdmToken.connect(user1).approve(contract.address, amount);
        await contract.connect(user1).list(amount, startPrice);
        await contract.connect(user2).buyListed(
            user1.address, 
            0,
            amount,
            {value:amount.mul(startPrice)}
        );
        // we did some activity to increase trading volume
        // it is used in calculation of amount for the next sale round
        const priceAfter = await contract.getSaleRoundPrice();
        const expectedRoundAmount = amount.mul(startPrice).div(priceAfter);
        await delay(await contract.getRoundDuration(), 30);

        await contract.connect(user2).finishRound();
        const actualRoundAmountAfter = await contract.getSaleRoundAmount();

        expect(actualRoundAmountAfter).eq(expectedRoundAmount);
    });

    it("finishRound mints tokens when it was trade round", async () => {
        const startAmount = await contract.getSaleRoundAmount();
        const amount = startAmount.div(2);
        const startPrice = await contract.getSaleRoundPrice();
        await contract.connect(user1).buy(
            amount,
            { value: amount.mul(startPrice) }
        );
        await delay(await contract.getRoundDuration(), 30);
        await contract.connect(user1).finishRound();
        await acdmToken.connect(user1).approve(contract.address, amount);
        await contract.connect(user1).list(amount, startPrice);
        await contract.connect(user2).buyListed(
            user1.address,
            0,
            amount,
            { value: amount.mul(startPrice) }
        );
        // we did some activity to increase trading volume
        // it is used in calculation of amount for the next sale round
        const priceAfter = await contract.getSaleRoundPrice();
        const expectedRoundAmount = amount.mul(startPrice).div(priceAfter);
        await delay(await contract.getRoundDuration(), 30);

        const tx = contract.connect(user2).finishRound();

        await expect(() => tx).to.changeTokenBalance(
            acdmToken, contract, expectedRoundAmount
        );
    });

    it("finishRound emits RoundFinished event when trade round is finished", async () => {
        const startAmount = await contract.getSaleRoundAmount();
        const amount = startAmount.div(2);
        const startPrice = await contract.getSaleRoundPrice();
        await contract.connect(user1).buy(
            amount,
            { value: amount.mul(startPrice) }
        );
        await delay(await contract.getRoundDuration(), 30);
        await contract.connect(user1).finishRound();
        await acdmToken.connect(user1).approve(contract.address, amount);
        await contract.connect(user1).list(amount, startPrice);
        await contract.connect(user2).buyListed(
            user1.address,
            0,
            amount,
            { value: amount.mul(startPrice) }
        );
        // we did some activity to increase trading volume
        // it is used in calculation of amount for the next sale round
        const priceAfter = await contract.getSaleRoundPrice();
        const expectedRoundAmount = amount.mul(startPrice).div(priceAfter);
        await delay(await contract.getRoundDuration(), 30);

        const tx = contract.connect(user2).finishRound();

        await expect(tx).to.emit(contract, "RoundFinished");
    });
});
