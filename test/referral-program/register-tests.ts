import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ACDMPlatform, IERC20MintableBurnable, IUniswapV2Pair } from "../../typechain-types";
import { deployERC20Token, deployACDMPlatform } from "../../scripts/test-deployment";
import { deployTokenAndProvideLiquidityForTests } from "../../scripts/provide-liquidity";
import { BigNumber } from "ethers";

describe("unlist in sale round", () => {
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

    it("register reverts if user registered already", async () => {
        await contract.connect(user1)
            .register(ethers.constants.AddressZero);
        const tx = contract.connect(user1)
            .register(ethers.constants.AddressZero);
        await expect(tx).to.be.revertedWith("RegisteredAlready");
    });

    it("register reverts if referral isn't registered", async () => {
        const tx = contract.connect(user1)
            .register(user2.address);
        await expect(tx).to.be.revertedWith("ReferralIsNotRegistered");
    });

    it("register sets a regDate and the referral", async () => {
        await contract.connect(user1)
            .register(ethers.constants.AddressZero);
        await contract.connect(user2)
            .register(user1.address);
        
        const accInfo = await contract.connect(user2).getAccountInfo();
        expect(accInfo.regDate).gt(BigNumber.from(0));
        expect(accInfo.referral).eq(user1.address);
    });
});
