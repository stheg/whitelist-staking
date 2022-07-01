import MerkleTree from 'merkletreejs';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

export function getMerkleTree(accounts: SignerWithAddress[], keccak256:any) {
    const whitelist = accounts.map(a => a.address);
    const leaves = whitelist.map(a => keccak256(a));
    return new MerkleTree(leaves, keccak256, { sort: true });
}