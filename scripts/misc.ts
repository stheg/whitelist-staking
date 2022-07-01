import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import MerkleTree from 'merkletreejs';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export function toDate(i: BigNumber) { return new Date(i.toNumber() * 1000); }
export function daysToSeconds(days: number) { return days * 24 * 60 * 60; }

export async function delay(delayInSeconds:BigNumber, extraSeconds:number=0) {
    await delayNumber(delayInSeconds.toNumber(), extraSeconds);
}

export async function delayNumber(delayInSeconds: number, extraSeconds: number = 0) {
    await network.provider.send(
        "evm_increaseTime",
        [delayInSeconds + extraSeconds]//+extra seconds
    );
}

export async function setTimeInBlockchain(delay:number = 500) {
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const nextTimestamp = blockBefore.timestamp + delay;
    await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp]);

    return nextTimestamp;
}