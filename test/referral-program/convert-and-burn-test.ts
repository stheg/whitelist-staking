import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ACDMPlatform, IERC20MintableBurnable, IUniswapV2Pair } from "../../typechain-types";
import { deployERC20Token, deployACDMPlatform } from "../../scripts/test-deployment";
import { getRouter, deployTokenAndProvideLiquidityForTests } from "../../scripts/provide-liquidity";
import { BigNumber } from "ethers";
import { delay } from "../../scripts/misc";

describe("apply referrals program", () => {
    let accounts: SignerWithAddress[];
    let owner: SignerWithAddress;
    let user: SignerWithAddress;
    let contract: ACDMPlatform;
    let stakingToken: IUniswapV2Pair;
    let rewardToken: IERC20MintableBurnable;
    let acdmToken: IERC20MintableBurnable;

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        user = accounts[1];

        acdmToken = await deployERC20Token("ACDM", 8, owner);

        [stakingToken, rewardToken] = await deployTokenAndProvideLiquidityForTests(user, owner);

        contract = await deployACDMPlatform(
            acdmToken.address,
            stakingToken.address, 
            rewardToken.address, 
            owner
        );
        contract = contract.connect(user);

        await acdmToken.mint(contract.address, 100000);
    });
    
    it("convertAndBurn reverts if no required role", async () => {
        const amount = 1000;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        await contract.connect(user).buy(amount, { value: totalPrice });
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(BigNumber.from(30), 30);
        await acdmToken.connect(user).approve(contract.address, amount);
        await contract.connect(user).list(amount, price);

        const r = await getRouter(owner);
        const tx = contract.connect(owner).convertAndBurn(r.address, rewardToken.address, 60);

        await expect(tx).to.be.reverted;
    });

    it("convertAndBurn should change ether balance", async () => {
        const amount = 1000;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        await contract.connect(user).buy(amount, { value: totalPrice });
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(BigNumber.from(30), 30);
        await acdmToken.connect(user).approve(contract.address, amount);
        await contract.connect(user).list(amount, price);

        await contract.connect(owner).grantRole(
            await contract.CONFIGURATOR_ROLE(),
            owner.address
        );

        const platformBonus = await contract.getAccumulatedPlatformBonus();
        const r = await getRouter(owner);
        const tx = contract.connect(owner).convertAndBurn(r.address, rewardToken.address, 60);

        await expect(() => tx).to.changeEtherBalance(
            contract,
            platformBonus.mul(-1)
        );
    });

    it("convertAndBurn should reset accumulated platform bonus", async () => {
        const amount = 1000;
        const price = await contract.getSaleRoundPrice();
        const totalPrice = price.mul(amount);

        await contract.connect(user).buy(amount, { value: totalPrice });
        await delay(await contract.getRoundDuration(), 30);
        await contract.finishRound();
        await delay(BigNumber.from(30), 30);
        await acdmToken.connect(user).approve(contract.address, amount);
        await contract.connect(user).list(amount, price);

        await contract.connect(owner).grantRole(
            await contract.CONFIGURATOR_ROLE(),
            owner.address
        );

        const r = await getRouter(owner);
        await contract.connect(owner).convertAndBurn(r.address, rewardToken.address, 60);
        const platformBonusAfter = await contract.getAccumulatedPlatformBonus();

        expect(platformBonusAfter).eq(0);
    });

    it("convertAndBurn should revert if ether balance is 0", async () => {
        await contract.connect(owner).grantRole(
            await contract.CONFIGURATOR_ROLE(),
            owner.address
        );

        const r = await getRouter(owner);
        const tx = contract.connect(owner).convertAndBurn(r.address, rewardToken.address, 60);

        await expect(tx).to.be.revertedWith("No ETH to convert and burn");
    });
});
