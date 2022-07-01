import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ACDMPlatform, IERC20MintableBurnable, IUniswapV2Pair } from "../../typechain-types";
import { deployERC20Token, deployACDMPlatform } from "../../scripts/test-deployment";
import { deployTokenAndProvideLiquidityForTests } from "../../scripts/provide-liquidity";
import { BigNumber } from "ethers";
import { delay } from "../../scripts/misc";

describe("apply referrals program", () => {
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

        await acdmToken.mint(contract.address, 100000);
    });
    
    it("buy applies referral program to one referral", async () => {
        await contract.connect(user1)
            .register(ethers.constants.AddressZero);
        await contract.connect(user2)
            .register(user1.address);

        const amount = 1000;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        const p100 = 10000; // 100%
        const ref1Percent = await contract.getReferralPercent(false, true);
        const expectedUser1Reward = totalPrice.mul(ref1Percent).div(p100);

        const tx = contract.connect(user2).buy(amount, { value: totalPrice });

        await expect(() => tx).to.changeEtherBalances(
            [user1, user2, contract],
            [expectedUser1Reward, totalPrice.mul(-1), totalPrice.sub(expectedUser1Reward)]
        );
    });

    it("buy applies referral program to both referrals", async () => {
        await contract.connect(owner)
            .register(ethers.constants.AddressZero);
        await contract.connect(user1)
            .register(owner.address);
        await contract.connect(user2)
            .register(user1.address);

        const amount = 1000;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        const p100 = 10000; // 100%
        const ref1Percent = await contract.getReferralPercent(false, true);
        const ref2Percent = await contract.getReferralPercent(false, false);
        const expectedUser1Reward = totalPrice.mul(ref1Percent).div(p100);
        const expectedOwnerReward = totalPrice.mul(ref2Percent).div(p100);

        const tx = contract.connect(user2).buy(amount, { value: totalPrice });

        await expect(() => tx).to.changeEtherBalances(
            [
                owner, 
                user1, 
                user2, 
                contract
            ],
            [
                expectedOwnerReward, 
                expectedUser1Reward,
                totalPrice.mul(-1),
                totalPrice.sub(expectedUser1Reward).sub(expectedOwnerReward)
            ]
        );
    });

    it("buyListed applies referral program to one referral", async () => {
        const amount = 1000;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        await contract.connect(user2).buy(amount, { value: totalPrice });
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(BigNumber.from(30), 30);
        await acdmToken.connect(user2).approve(contract.address, amount);
        await contract.connect(user2).list(amount, price);

        await contract.connect(user1)
            .register(ethers.constants.AddressZero);
        await contract.connect(user2)
            .register(user1.address);

        const p100 = 10000; // 100%
        const ref1Percent = await contract.getReferralPercent(true, true);
        const ref2Percent = await contract.getReferralPercent(true, false);
        const expectedUser1Reward = totalPrice.mul(ref1Percent).div(p100);
        const expectedPlatformReward = totalPrice.mul(ref2Percent).div(p100);

        const tx = contract.connect(owner).buyListed(
            user2.address,
            0,
            amount,
            { value: totalPrice }
        );
        await expect(() => tx).to.changeEtherBalances(
            [
                owner,
                user1,
                user2,
                contract
            ],
            [
                totalPrice.mul(-1),
                expectedUser1Reward,
                totalPrice.sub(expectedUser1Reward).sub(expectedPlatformReward),
                expectedPlatformReward
            ]
        );
    });

    it("buy applies referral program to both referrals", async () => {
        const amount = 1000;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        await contract.connect(user2).buy(amount, { value: totalPrice });
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(BigNumber.from(30), 30);
        await acdmToken.connect(user2).approve(contract.address, amount);
        await contract.connect(user2).list(amount, price);

        await contract.connect(owner)
            .register(ethers.constants.AddressZero);
        await contract.connect(user1)
            .register(owner.address);
        await contract.connect(user2)
            .register(user1.address);

        const p100 = 10000; // 100%
        const ref1Percent = await contract.getReferralPercent(true, true);
        const ref2Percent = await contract.getReferralPercent(true, false);
        const expectedUser1Reward = totalPrice.mul(ref1Percent).div(p100);
        const expectedOwnerReward = totalPrice.mul(ref2Percent).div(p100);

        const tx = contract.connect(owner).buyListed(
            user2.address,
            0,
            amount,
            { value: totalPrice }
        );
        await expect(() => tx).to.changeEtherBalances(
            [
                owner,
                user1,
                user2,
                contract
            ],
            [
                totalPrice.sub(expectedOwnerReward).mul(-1),
                expectedUser1Reward,
                totalPrice.sub(expectedUser1Reward).sub(expectedOwnerReward),
                0
            ]
        );
    });
});
