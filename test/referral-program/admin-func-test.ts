import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ACDMPlatform, IERC20MintableBurnable, IUniswapV2Pair } from "../../typechain-types";
import { deployERC20Token, deployACDMPlatform } from "../../scripts/test-deployment";
import { deployTokenAndProvideLiquidityForTests } from "../../scripts/provide-liquidity";

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
        await contract.connect(owner).grantRole(
            await contract.CONFIGURATOR_ROLE(), 
            owner.address
        );
    });

    it("setReferralPercent reverts if no correct role", async () => {
        const tx = contract.connect(user1).setReferralPercent(true, true, 1000);
        await expect(tx).to.be.reverted;
    });

    it("setReferralPercent sets ref1 percent for sale round", async () => {
        const expected = 105;
        await contract.connect(owner).setReferralPercent(false, true, expected);
        const actual = await contract.getReferralPercent(false, true);
        expect(actual).eq(expected);
    });

    it("setReferralPercent sets ref2 percent for sale round", async () => {
        const expected = 105;
        await contract.connect(owner).setReferralPercent(false, false, expected);
        const actual = await contract.getReferralPercent(false, false);
        expect(actual).eq(expected);
    });

    it("setReferralPercent sets ref1 percent for trade round", async () => {
        const expected = 105;
        await contract.connect(owner).setReferralPercent(true, true, expected);
        const actual = await contract.getReferralPercent(true, true);
        expect(actual).eq(expected);
    });

    it("setReferralPercent sets ref2 percent for trade round", async () => {
        const expected = 105;
        await contract.connect(owner).setReferralPercent(true, false, expected);
        const actual = await contract.getReferralPercent(true, false);
        expect(actual).eq(expected);
    });
});
