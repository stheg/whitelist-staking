import { task } from "hardhat/config";
import { getMerkleTree } from "../scripts/merkleTree";

task("stake", "Allows to stake some amount of tokens")
    .addParam("contract", "address of the staking platform")
    .addOptionalParam("value", "amount to be approved and staked")
    .addOptionalParam("staker", "address of the account")
    .setAction(async (args, hre) => {
        let accounts = await hre.ethers.getSigners();
        let [contractOwner, ercOwner, staker] = accounts;
        if (args.staker)
            staker = await hre.ethers.getSigner(args.staker);

        const stakingPlatform = await hre.ethers.getContractAt(
            "ACDMPlatform",
            args.contract,
            staker
        );

        const erc20Addr = await stakingPlatform.getStakingToken();
        const stakingToken = await hre.ethers.getContractAt(
            "IERC20",
            erc20Addr,
            staker
        );
        
        let amount = args.value ? hre.ethers.BigNumber.from(args.value) 
            : await stakingToken.balanceOf(staker.address);
        const mTree = getMerkleTree(accounts, hre.ethers.utils.keccak256);
        let userHash = hre.ethers.utils.keccak256(staker.address);
        let userProof = mTree.getHexProof(userHash);

        await stakingToken.approve(stakingPlatform.address, amount);
        await stakingPlatform.stake(amount, userProof);
    });

task("unstake", "Allows to unstake some amount of tokens")
    .addParam("contract", "address of the staking platform")
    .addOptionalParam("staker", "address of the account")
    .setAction(async (args, hre) => {
        let [contractOwner, ercOwner, staker] = await hre.ethers.getSigners();
        if (args.staker)
            staker = await hre.ethers.getSigner(args.staker);

        const stakingPlatform = await hre.ethers.getContractAt(
            "ACDMPlatform",
            args.contract,
            staker
        );

        await stakingPlatform.unstake();
    });

task("claim", "Allows to withdraw available reward tokens")
    .addParam("contract", "address of the staking platform")
    .addOptionalParam("staker", "address of the account")
    .setAction(async (args, hre) => {
        let [contractOwner, ercOwner, staker] = await hre.ethers.getSigners();
        if (args.staker)
            staker = await hre.ethers.getSigner(args.staker);

        const stakingPlatform = await hre.ethers.getContractAt(
            "ACDMPlatform",
            args.contract,
            staker
        );

        const erc20Addr = await stakingPlatform.getRewardToken();
        const rewardToken = await hre.ethers.getContractAt(
            "IERC20MintableBurnable",
            erc20Addr,
            staker
        );

        if (hre.network.name == "hardhat") {
            // just for test
            await rewardToken.connect(ercOwner)
                .mint(stakingPlatform.address, 5000);
        }

        let r = await rewardToken.balanceOf(staker.address);
        console.log("Amount of reward tokens before claim: " + r);
        await stakingPlatform.claim();

        r = await rewardToken.balanceOf(staker.address);
        console.log("Current amount of reward tokens: " + r);
    });

task("get-details", "Returns the details")
    .addParam("contract", "address of the staking platform")
    .addOptionalParam("staker", "address of the account")
    .setAction(async (args, hre) => {
        let [contractOwner, ercOwner, staker] = await hre.ethers.getSigners();
        if (args.staker)
            staker = await hre.ethers.getSigner(args.staker);

        const stakingPlatform = await hre.ethers.getContractAt(
            "ACDMPlatform",
            args.contract,
            staker
        );

        const [a, r, ud, rd] = await stakingPlatform.connect(staker).getDetails();
        console.log("Amount: " + a);
        console.log("Reward: " + r);
        console.log("Unstake Date: " + ud);
        console.log("Reward Date: " + rd);
    }); 