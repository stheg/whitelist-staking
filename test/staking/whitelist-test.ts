import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { IERC20MintableBurnable, IUniswapV2Pair, StakingPlatform } from "../../typechain-types";
import { deployTokenAndProvideLiquidityForTests } from "../../scripts/provide-liquidity";
import { keccak256 } from "ethers/lib/utils";
import { MerkleTree } from "merkletreejs"

describe("whitelist", () => {
    let accounts: SignerWithAddress[];
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let contract: StakingPlatform;
    let stakingToken: IUniswapV2Pair;
    let rewardToken: IERC20MintableBurnable;

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];

        [stakingToken, rewardToken] =
            await deployTokenAndProvideLiquidityForTests(user2, owner);

        const contractFactory =
            await ethers.getContractFactory("StakingPlatform", owner);
        contract = await contractFactory.deploy(stakingToken.address, rewardToken.address);
        await contract.deployed();

        contract = contract.connect(user2);
    });

    it("setWhitelist reverts if no correct role", async () => {
        const tx = contract.setWhitelist("");
        await expect(tx).to.be.reverted;
    });

    it("setWhitelist updates whitelist root", async () => {
        await contract.connect(owner).grantRole(await contract.CONFIGURATOR_ROLE(), owner.address);
        const whitelist = [
            owner.address,
            user1.address,
            user2.address,
            accounts[3].address
        ]
        const leaves = whitelist.map(a => keccak256(a));
        const merkleTree = new MerkleTree(leaves, keccak256, { sort: true });
        
        const expectedWlRoot = merkleTree.getHexRoot();
        await contract.connect(owner).setWhitelist(expectedWlRoot);

        const wlRoot = await contract.getWhitelist();

        expect(wlRoot).eq(expectedWlRoot);
    });

    it("wstake reverts if user isn't in whitelist", async () => {
        await contract.connect(owner).grantRole(await contract.CONFIGURATOR_ROLE(), owner.address);
        const whitelist = [
            user1.address,
            user2.address,
            accounts[3].address,
            accounts[4].address,
            accounts[5].address,
            accounts[6].address,
            accounts[7].address,
        ]
        const leaves = whitelist.map(a => keccak256(a));
        const merkleTree = new MerkleTree(leaves, keccak256, { sort: true });
        const wlRoot = merkleTree.getHexRoot();
        await contract.connect(owner).setWhitelist(wlRoot);

        const wrongUserHash = keccak256(owner.address);
        const wrongProof = merkleTree.getHexProof(wrongUserHash);
        // console.log(wrongProof);
        const tx = contract.connect(owner).stake(100, wrongProof);
        await expect(tx).to.be.revertedWith("Whitelist: no access");
    });

    it("wstake works as stake if user is in whitelist", async () => {
        await contract.connect(owner).grantRole(await contract.CONFIGURATOR_ROLE(), owner.address);
        const whitelist = [
            user1.address,
            user2.address,
            accounts[3].address,
            accounts[4].address,
            accounts[5].address,
            accounts[6].address,
            accounts[7].address,
        ]
        const leaves = whitelist.map(a => keccak256(a));
        const merkleTree = new MerkleTree(leaves, keccak256, { sort: true });
        const wlRoot = merkleTree.getHexRoot();
        await contract.connect(owner).setWhitelist(wlRoot);

        const userHash = keccak256(user2.address);
        const userProof = merkleTree.getHexProof(userHash);
        // console.log(userProof);

        const amount = 10;
        await stakingToken.approve(contract.address, amount);

        await contract.connect(user2).stake(amount, userProof);
        
        let [stakedAmount, , ,] = await contract.getDetails();
        expect(stakedAmount).eq(amount);
    });
});
