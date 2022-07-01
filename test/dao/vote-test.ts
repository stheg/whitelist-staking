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
    let contract: DAO;
    let voteToken: MockContract;
    let callData: string;
    let user1Proof: string[];

    const proposalId = 1;
    const duration = BigNumber.from(7 * 24 * 60 * 60);

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        [chairperson, user1] = accounts; 
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
        await contract.addProposal(
            voteToken.address,
            callData,
            "transfer 1000 vote tokens to chairperson"
        );
    })

    describe("vote", () => {
        it("should work", async () => {
            await contract.connect(user1).stake(1000, user1Proof);
            await contract.connect(user1).vote(proposalId, true);
        });

        it("should increase votes for the proposal", async () => {
            const amount = 1000;
            await contract.connect(user1).stake(amount, user1Proof);
            await contract.connect(user1).vote(proposalId, true);

            const p = await contract.getProposal(proposalId);
            expect(p.votesFor).eq(amount);
        });

        it("should increase votes against the proposal", async () => {
            const amount = 1000;
            await contract.connect(user1).stake(amount, user1Proof);
            await contract.connect(user1).vote(proposalId, false);

            const p = await contract.getProposal(proposalId);
            expect(p.votesAgainst).eq(amount);
        });

        it("should be possible to vote in 2+ votings using the same deposit", async () => {
            await contract.addProposal(
                voteToken.address,
                callData,
                "transfer 1000 vote tokens to chairperson second time"
            );
            const secondProposalId = proposalId + 1;

            const amount = 1000;
            await contract.connect(user1).stake(amount, user1Proof);
            
            await contract.connect(user1).vote(proposalId, true);
            await contract.connect(user1).vote(secondProposalId, false);

            const p1 = await contract.getProposal(proposalId);
            const p2 = await contract.getProposal(secondProposalId);
            expect(p1.votesFor).eq(p2.votesAgainst);
        });
        
        it("should be reverted if no deposit", async () => {
            const tx = contract.connect(user1).vote(proposalId, true);
            await expect(tx).to.be.revertedWith("DAO: no deposit");
        });

        it("should be reverted if voted already", async () => {
            await contract.connect(user1).stake(1000, user1Proof);
            await contract.connect(user1).vote(proposalId, true);

            const tx = contract.connect(user1).vote(proposalId, true);
            await expect(tx).to.be.revertedWith("DAO: voted already");
        });

        it("should be reverted if voting period ended", async () => {
            await contract.connect(user1).stake(1000, user1Proof);
            await delay(duration, 60);

            const tx = contract.connect(user1).vote(proposalId, true);
            await expect(tx).to.be.revertedWith("DAO: voting period ended");
        });

        it("should be reverted if voting doesn't exist", async () => {
            const tx1 = contract.connect(user1).vote(123, true);
            await expect(tx1).to.be.revertedWith("DAO: no such voting");

            const tx2 = contract.connect(user1).vote(0, true);
            await expect(tx2).to.be.revertedWith("DAO: no such voting");
        });
    });
});