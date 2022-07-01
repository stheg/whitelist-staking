import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ACDMPlatform, IERC20MintableBurnable, IUniswapV2Pair } from "../../typechain-types";
import { deployERC20Token, deployACDMPlatform } from "../../scripts/test-deployment";
import { deployTokenAndProvideLiquidityForTests } from "../../scripts/provide-liquidity";
import { delay } from "../../scripts/misc";

describe("buy in sale round", () => {
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

    it("buy reverts if amount exceeds trading volume", async () => {
        const tx = contract.buy(100001); //default trading volume
        await expect(tx).to.be.revertedWith("RequestedAmountExceedsListedAmount");
    });

    it("buy reverts if no enough ETH for provided amount", async () => {
        const tx = contract.buy(100, {value:0});
        await expect(tx).to.be.revertedWith("NotEnoughEtherProvided");
    });

    it("buy reverts if sale round finished", async () => {
        await delay(await contract.getRoundDuration(), 30);
        const amount = 100;
        const price = await contract.getSaleRoundPrice();
        const tx = contract.buy(amount, { value: price.mul(amount) });
        await expect(tx).to.be.revertedWith("ItIsNotSaleRound");
    });

    it("buy reverts if trade round started", async () => {
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();

        const amount = 100;
        const price = await contract.getSaleRoundPrice();
        const tx = contract.buy(amount, { value: price.mul(amount) });
        await expect(tx).to.be.revertedWith("ItIsNotSaleRound");
    });

    it("buy transfers ETH", async () => {
        const amount = 100;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);
        const tx = contract.connect(user1).buy(amount, { value: totalPrice });
        
        await expect(() => tx).to.changeEtherBalances(
            [user1, contract], [-totalPrice, totalPrice]);
    });

    it("buy refunds ETH if sent mote than needed", async () => {
        const amount = 100;
        const price = await contract.getSaleRoundPrice();
        const toBeRefunded = 100;
        const totalPrice = price.mul(amount);
        const tx = contract.connect(user1).buy(amount, { value: totalPrice.add(toBeRefunded) });
        
        await expect(() => tx).to.changeEtherBalances(
            [user1, contract], 
            [-totalPrice, totalPrice]
        );
    });
});
