import { task } from "hardhat/config";

task("delegate", "Allows to delegate deposited votes")
    .addParam("contract", "Address of the contract")
    .addParam("to", "Address of a delegate")
    .addParam("proposal", "Index of a proposal")
    .addOptionalParam("user", "User address")
    .setAction(async (args, hre) => {
        let [chairperson, user1, user2] = await hre.ethers.getSigners();
        if (args.user)
            user1 = await hre.ethers.getSigner(args.user);
            
        const contract =
            await hre.ethers.getContractAt("ACDMPlatform", args.contract, user1);

        await contract.delegate(args.to, args.proposal);

        console.log("done");
    });

task("add-proposal", "Starts a new voting for the specified proposal")
    .addParam("contract", "Address of the contract")
    .addParam("description", "User-friendly description")
    .addParam("recipient", "Address of the recipient")
    .addParam("func", "Function to call on the recipient contract (i.e. 'transferFrom(address,address,uint256)')")
    .addVariadicPositionalParam("fargs", "Arguments for the specified func to call")
    .setAction(async (args, hre) => {
        const [chairperson, user1, user2] = await hre.ethers.getSigners();
        const contract =
            await hre.ethers.getContractAt("ACDMPlatform", args.contract, chairperson);

        const funcAbi = ["function " + args.func + " external"];
        const recipient = new hre.ethers.Contract(args.recipient, funcAbi);
        const proposal = recipient.interface.encodeFunctionData(args.func, args.fargs);

        await contract.addProposal(args.recipient, proposal, args.description);

        console.log("done");
    });

// task("add-proposal", "Starts a new voting for the specified proposal")
//     .addParam("contract", "Address of the contract")
//     .addParam("description", "User-friendly description")
//     .addParam("recipient", "Address of the recipient")
//     .addParam("func", "Function to call on the recipient contract (i.e. 'transferFrom(address,address,uint256)')")
//     .addVariadicPositionalParam("fargs", "Arguments for the specified func to call")
//     .setAction(async (args, hre) => {
//         const [chairperson, user1, user2] = await hre.ethers.getSigners();
//         const contract =
//             await hre.ethers.getContractAt("ACDMPlatform", args.contract, chairperson);

//         const funcAbi = ["function " + args.func + " external"];
//         const recipient = new hre.ethers.Contract(args.recipient, funcAbi);
//         const proposal = recipient.interface.encodeFunctionData(args.func, args.fargs);

//         await contract.addProposal(args.recipient, proposal, args.description);

//         console.log("done");
//     });

task("vote", "Adds a new vote from a voter for or against a proposal")
    .addParam("contract", "Address of the contract")
    .addParam("proposal", "Index of a proposal")
    .addParam("decision", "'agree' or 'disagree'")
    .addOptionalParam("voter", "Address of the voter")
    .setAction(async (args, hre) => {
        let [chairperson, user1, user2] = await hre.ethers.getSigners();
        if (args.voter)
            user1 = await hre.ethers.getSigner(args.voter);

        const contract =
            await hre.ethers.getContractAt("ACDMPlatform", args.contract, user1);

        const decision = args.decision === "agree";
        await contract.vote(args.proposal, decision);

        console.log("done");
    });

task("finish-voting", "Allows to finish a voting")
    .addParam("contract", "Address of the contract")
    .addParam("proposal", "Index of a proposal")
    .setAction(async (args, hre) => {
        let [chairperson, user1, user2] = await hre.ethers.getSigners();
        
        const contract =
            await hre.ethers.getContractAt("ACDMPlatform", args.contract, user1);

        await contract.finish(args.proposal);

        console.log("done");
    });