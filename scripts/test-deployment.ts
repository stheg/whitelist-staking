import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { ACDMPlatform, IERC20MintableBurnable, StakingPlatform, Token } from "../typechain-types";

export async function deployERC20Token(name: string, dec:number, owner: SignerWithAddress)
    : Promise<Token> {
    const contractFactory =
        await ethers.getContractFactory("Token", owner);
    const contract = await contractFactory.deploy(name, name, dec) as IERC20MintableBurnable;
    await contract.deployed();
    return <Token>contract;
}

export async function deployStakingPlatform(
    tokenToStakeAddr: string,
    rewardTokenAddr: string,
    owner: SignerWithAddress
): Promise<StakingPlatform> {
    const contractFactory =
        await ethers.getContractFactory("StakingPlatform", owner);
    const contract = await contractFactory.deploy(tokenToStakeAddr, rewardTokenAddr) as StakingPlatform;
    await contract.deployed();

    return contract;
}

export async function deployACDMPlatform(
    acdmTokenAddr: string,
    voteTokenAddr: string,
    rewardTokenAddr: string,
    owner: SignerWithAddress
): Promise<ACDMPlatform> {
    const contractFactory =
        await ethers.getContractFactory("ACDMPlatform", owner);
    const contract = await contractFactory.deploy(acdmTokenAddr, owner.address, voteTokenAddr, rewardTokenAddr);
    await contract.deployed();

    return contract;
}