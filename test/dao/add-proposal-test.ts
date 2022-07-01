import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract";
import { ethers } from "hardhat";
import { DAO, IERC20__factory } from "../../typechain-types";

describe("DAO", () => {
    let chairperson: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let contract: DAO;
    let voteToken: MockContract;
    let callData: string;
    
    beforeEach(async () => {
        [chairperson, user1, user2] = await ethers.getSigners();
        voteToken = await deployMockContract(chairperson, IERC20__factory.abi);

        const f = await ethers.getContractFactory("DAO", chairperson);
        contract = <DAO>await f.deploy(chairperson.address, voteToken.address, voteToken.address);

        callData = IERC20__factory.createInterface().encodeFunctionData(
            "transferFrom", 
            [contract.address, chairperson.address, 1000]
        );

        await contract.deployed();
    })

    describe("addProposal", () => {
        it("should work", async () => {
            const description = "transfer 1000 vote tokens to chairperson";
            
            await contract.addProposal(
                voteToken.address, 
                callData, 
                description
            );

            const p = await contract.getProposal(1);
            expect(p.recipient).eq(voteToken.address);
            expect(p.funcSignature).eq(callData);
            expect(p.description).eq(description);
        });

        it("should emit ProposalAdded event", async () => {
            const description = "transfer 1000 vote tokens to chairperson";

            const tx = contract.addProposal(
                voteToken.address,
                callData,
                description
            );

            await expect(tx).to.emit(contract, "ProposalAdded")
                .withArgs(chairperson.address, 1);
        });

        it("should be reverted", async () => {
            const tx = contract.connect(user1).addProposal(
                voteToken.address,
                callData,
                "no matter"
            );
            await expect(tx).to.be.reverted;
        });
    });
});