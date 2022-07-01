import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { deployERC20Token } from "./test-deployment";

async function main() {
    const [owner] = await ethers.getSigners();

    const decimals18 = 18;
    const rewardTokenAmount = "10000";
    const daiTokensAmount = BigNumber.from(rewardTokenAmount)
        .mul((10 ** decimals18).toString());

    const rewardToken = await deployERC20Token("SToken", decimals18, owner);
    
    console.log("Reward Token deployed to: " + rewardToken.address + " SToken SToken 18");
    
    await rewardToken.mint(owner.address, daiTokensAmount);
    console.log("Reward tokens: minted: ", daiTokensAmount)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
