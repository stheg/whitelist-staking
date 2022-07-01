import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract";
import { ethers } from "hardhat";
import { DAO, IERC20__factory } from "../../typechain-types";
import { expect } from "chai";
import { delay } from "../../scripts/misc";
import { BigNumber } from "ethers";
import { keccak256 } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';


describe("MA DAO", () => {
    let accounts: SignerWithAddress[];
    let chairperson: SignerWithAddress;
    let user1: SignerWithAddress;
    let contract: DAO;
    let voteToken: MockContract;
    let callData: string;
    let user1Proof: string[];

    const duration = BigNumber.from(7 * 24 * 60 * 60);

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        [chairperson, user1] = accounts;
        voteToken = await deployMockContract(chairperson, IERC20__factory.abi);

        const f = await ethers.getContractFactory("DAO", chairperson);
        contract = <DAO>await f.deploy(chairperson.address, voteToken.address, voteToken.address);

        callData = IERC20__factory.createInterface().encodeFunctionData(
            "transferFrom", 
            [contract.address, chairperson.address, 1000]
        );

        await contract.deployed();
        await contract.connect(chairperson).grantRole(await contract.CONFIGURATOR_ROLE(), chairperson.address);

        const whitelist = [
            accounts[1].address,
            accounts[2].address,
            accounts[3].address,
            accounts[4].address,
            accounts[5].address,
            accounts[6].address,
            accounts[7].address,
        ]
        const leaves = whitelist.map(a => keccak256(a));
        const merkleTree = new MerkleTree(leaves, keccak256, { sort: true });
        const wlRoot = merkleTree.getHexRoot();
        await contract.connect(chairperson).setWhitelist(wlRoot);
        let userHash = keccak256(user1.address);
        user1Proof = merkleTree.getHexProof(userHash);
        await contract.addProposal(
            voteToken.address,
            callData,
            "transfer 1000 vote tokens to chairperson"
        );

        await voteToken.mock.transferFrom.returns(true);
    })

    describe("unstake", () => {
        it("should be reverted if no deposit", async () => {
            const tx = contract.connect(user1).unstake();
            await expect(tx).to.be.revertedWith("DAO: nothing to unstake");
        });

        it("should be reverted if user participates in active voting", async () => {
            await contract.connect(user1).stake(1000, user1Proof);

            const pId = 1;
            await contract.connect(user1).vote(pId, false);

            const tx = contract.connect(user1).unstake();
            await expect(tx).to.be.revertedWith("DAO: tokens are frozen");
        });

        it("should be reverted if user participates in 2 active voting", async () => {
            await contract.connect(user1).stake(1000, user1Proof);

            await contract.addProposal(
                voteToken.address,
                callData,
                "second transfer 1000 vote tokens to chairperson"
            );

            await contract.connect(user1).vote(2, false);
            await contract.connect(user1).vote(1, false);

            const tx = contract.connect(user1).unstake();
            await expect(tx).to.be.revertedWith("DAO: tokens are frozen");
        });

        it("should transfer tokens back to user if not participated in votings", async () => {
            await contract.connect(user1).stake(1000, user1Proof);
            await voteToken.mock.transfer.returns(true);

            await delay(duration, 30);

            await contract.connect(user1).unstake();
            const d = await contract.connect(user1).getDetails();
            expect(d.amount).eq(0);
        });

        it("should transfer tokens back to user if no active votings", async () => {
            await contract.connect(user1).stake(1000, user1Proof);
            await voteToken.mock.transfer.returns(true);
            await contract.connect(user1).vote(1, false);
            await delay(duration, 60);
            await contract.connect(user1).finish(1);

            await contract.connect(user1).unstake();
            const d = await contract.connect(user1).getDetails();
            expect(d.amount).eq(0);
        });
    });
});