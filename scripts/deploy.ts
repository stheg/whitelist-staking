import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { IUniswapV2Pair } from "../typechain-types";
import { getFactory, getRouter, provideLiquidityETH } from "./provide-liquidity";
import { deployERC20Token } from "./test-deployment";

async function main() {
    const [owner] = await ethers.getSigners();

    const rewardToken = await ethers.getContractAt(
        "Token", 
        "0xEe8B3CdCECF1ED80cE437e26211778d44201B994", 
        owner
    );
    const decimals18 = 18;
    const rewardTokenAmount = "10000";
    const liquidityAmount = BigNumber.from(rewardTokenAmount)
                                     .mul((10 ** decimals18).toString());
    const ethPricePerToken = "0.00001";

    const uniFactory = await getFactory(owner);
    const uniRouter = await getRouter(owner);

    let lpTokenAddr = await uniFactory.getPair(await uniRouter.WETH(), rewardToken.address);
    let voteToken;
    if (lpTokenAddr != ethers.constants.AddressZero) {
        voteToken = await ethers.getContractAt(
            "IUniswapV2Pair",
            lpTokenAddr,
            owner
        ) as IUniswapV2Pair;
        
        console.log("Default liquidity already has been provided");

    } else {

        console.log("Providing default liquidity...");

        voteToken = await provideLiquidityETH(
            owner,
            rewardToken,
            liquidityAmount,
            ethers.utils.parseEther(ethPricePerToken).mul(rewardTokenAmount),
            uniFactory,
            uniRouter
        );
    }
    
    console.log("Vote (LP) Token address: " + voteToken.address);
    console.log("Vote (LP) Token amount: " + await voteToken.balanceOf(owner.address));

    const decimals6 = 6;
    const acdmToken = await deployERC20Token("ACDM", decimals6, owner);
    console.log("ACDM Token deployed to: " + acdmToken.address + " ACDM ACDM 6");

    const factory = await ethers.getContractFactory("ACDMPlatform", owner);
    const contract = await factory.deploy(
        acdmToken.address,
        owner.address, 
        voteToken.address,
        rewardToken.address
    );
    await contract.deployed();
    console.log(
        "ACDMPlatform deployed to: " + 
        contract.address + 
        ` ${acdmToken.address} ${owner.address} ${voteToken.address} ${rewardToken.address}`
    );

    await contract.grantRole(await contract.CONFIGURATOR_ROLE(), contract.address);
    const startRoundAmount = await contract.getSaleRoundAmount();
    await acdmToken.mint(contract.address, startRoundAmount.mul((10**decimals6).toString()));

    // console.log("Reward Token addr: " + rewardToken.address);
    // console.log("Vote Token addr: " + voteToken.address);
    // console.log("ACDM Token addr: " + acdmToken.address);
    // console.log("ACDMPlatform addr: " + contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
