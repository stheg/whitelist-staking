import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract";
import { ethers } from "hardhat";
import { DAO, IERC20__factory } from "../../typechain-types";
import { delay } from "../../scripts/misc";
import { BigNumber } from "ethers";
import { keccak256 } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';

describe("MA DAO", () => {
    let accounts: SignerWithAddress[];
    let chairperson: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let contract: DAO;
    let voteToken: MockContract;
    let callData: string;
    let user1Proof: string[];
    let user2Proof: string[];

    const proposalId = 1;
    const duration = BigNumber.from(7 * 24 * 60 * 60);

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        [chairperson, user1, user2] = accounts;
        voteToken = await deployMockContract(chairperson, IERC20__factory.abi);
        await voteToken.mock.transferFrom.returns(true);
        
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
        let user2Hash = keccak256(user2.address);
        user2Proof = merkleTree.getHexProof(user2Hash);
        await contract.addProposal(
            voteToken.address,
            callData,
            "transfer 1000 vote tokens to chairperson"
        );
    })

    describe("finish", () => {
        it("should be cancelled", async () => {
            await delay(duration, 60);

            await contract.connect(user1).finish(proposalId);

            const p = await contract.getProposal(proposalId);
            expect(p.status).eq(3);//cancelled
        });

        it("should emit event ProposalFinished when cancelled", async () => {
            await delay(duration, 60);

            const tx = contract.connect(user1).finish(proposalId);

            await expect(tx).to.emit(contract, "ProposalFinished")
                .withArgs(proposalId, 3);// 3 = cancelled
        });

        it("should be rejected", async () => {
            await contract.connect(user1).stake(1000, user1Proof);
            await contract.connect(user1).vote(proposalId, false);

            await delay(duration, 60);

            await contract.connect(user1).finish(proposalId);

            const p = await contract.getProposal(proposalId);
            expect(p.status).eq(2);
        });

        it("should emit ProposalFinished event when rejected", async () => {
            await contract.connect(user1).stake(1000, user1Proof);
            await contract.connect(user1).vote(proposalId, false);

            await delay(duration, 60);

            const tx = contract.connect(user1).finish(proposalId);

            await expect(tx).to.emit(contract, "ProposalFinished")
                .withArgs(proposalId, 2);// 2 = rejected
        });

        it("should be finished", async () => {
            await contract.connect(user1).stake(1000, user1Proof);
            await contract.connect(user1).vote(proposalId, true);

            await delay(duration, 60);

            await contract.connect(user1).finish(proposalId);

            const p = await contract.getProposal(proposalId);
            expect(p.status).eq(1);
        });

        it("should emit ProposalFinished event when finished", async () => {
            await contract.connect(user1).stake(1000, user1Proof);
            await contract.connect(user1).vote(proposalId, true);

            await delay(duration, 60);

            const tx = contract.connect(user1).finish(proposalId);

            await expect(tx).to.emit(contract, "ProposalFinished")
                .withArgs(proposalId, 1);// 1 = finished
        });

        it("should be rejected if callData reverts", async () => {
            await contract.connect(user1).stake(1000, user1Proof);
            await contract.connect(user1).vote(proposalId, true);

            await delay(duration, 60);

            await voteToken.mock.transferFrom.reverts();
            const tx = contract.connect(user1).finish(proposalId);

            await expect(tx).to.be.revertedWith("DAO: recipient call error");
        });

        it("should be rejected if called second time for the same proposal", async () => {
            await contract.connect(user1).stake(1000, user1Proof);
            await contract.connect(user1).vote(proposalId, true);

            await delay(duration, 60);

            await contract.connect(user1).finish(proposalId);
            const tx = contract.connect(user1).finish(proposalId);

            await expect(tx).to.be.revertedWith("DAO: handled already");
        });

        it("should be rejected if voting is in process", async () => {
            await contract.connect(user1).stake(1000, user1Proof);
            await contract.connect(user1).vote(proposalId, true);

            const tx = contract.connect(user1).finish(proposalId);

            await expect(tx).to.be.revertedWith("DAO: voting is in process");
        });

        it("should be reverted if voting doesn't exist", async () => {
            const tx1 = contract.connect(user1).finish(123);
            await expect(tx1).to.be.revertedWith("DAO: no such voting");

            const tx2 = contract.connect(user1).finish(0);
            await expect(tx2).to.be.revertedWith("DAO: no such voting");
        });
    });
});