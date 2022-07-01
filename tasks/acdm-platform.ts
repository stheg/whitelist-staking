import { task } from "hardhat/config";

task("register", "Register in ACDM Platform")
    .addParam("contract", "Address of the contract")
    .addOptionalParam("user", "User address to register")
    .addOptionalParam("referral", "Referral address (should be registered already)")
    .setAction(async (args, hre) => {
        let [owner, user1, user2] = await hre.ethers.getSigners();
        let referral = hre.ethers.constants.AddressZero;
        if (args.user)
            user1 = await hre.ethers.getSigner(args.user);

        if (args.referral)
            referral = (await hre.ethers.getSigner(args.referral)).address;

        const contract =
            await hre.ethers.getContractAt("ACDMPlatform", args.contract, user1);

        await contract.register(referral);

        console.log("done");
    });

task("finish-round", "Finishes current round (sale or trade)")
    .addParam("contract", "Address of the contract")
    .addOptionalParam("user", "User address")
    .setAction(async (args, hre) => {
        let [owner, user1, user2] = await hre.ethers.getSigners();
        if (args.user)
            user1 = await hre.ethers.getSigner(args.user);

        const contract =
            await hre.ethers.getContractAt("ACDMPlatform", args.contract, user1);

        await contract.finishRound();

        console.log("done");
    });

task("buy", "Buy ACDM tokens in sale round")
    .addParam("contract", "Address of the contract")
    .addParam("amount", "Amount of tokens to buy")
    .addOptionalParam("user", "User address")
    .setAction(async (args, hre) => {
        let [owner, user1, user2] = await hre.ethers.getSigners();
        if (args.user)
            user1 = await hre.ethers.getSigner(args.user);

        const contract = 
            await hre.ethers.getContractAt("ACDMPlatform", args.contract, user1);
        
        const price = await contract.getSaleRoundPrice();
        await contract.buy(args.amount, {value:price.mul(args.amount)});

        console.log("done");
    });

task("list", "List ACDM tokens to trade with other users")
    .addParam("contract", "Address of the contract")
    .addParam("amount", "Amount of tokens to be deposited")
    .addParam("price", "Price per unit of the token")
    .addFlag("approve", "Auto-approve requested amount before deposit action")
    .addOptionalParam("user", "User address")
    .setAction(async (args, hre) => {
        let [owner, user1, user2] = await hre.ethers.getSigners();
        if (args.user)
            user1 = await hre.ethers.getSigner(args.user);

        const contract =
            await hre.ethers.getContractAt("ACDMPlatform", args.contract, user1);
        
        const acdmTokenAddr = await contract.getACDMToken();
        const acdmToken = await hre.ethers.getContractAt(
            "IERC20",
            acdmTokenAddr,
            user1
        );

        if (args.approve)
            await acdmToken.approve(contract.address, args.amount);

        await contract.list(args.amount, args.price);

        console.log("done");
    });

task("unlist", "Unlist ACDM tokens")
    .addParam("contract", "Address of the contract")
    .addParam("amount", "Amount of tokens to be deposited")
    .addOptionalParam("user", "User address")
    .setAction(async (args, hre) => {
        let [owner, user1, user2] = await hre.ethers.getSigners();
        if (args.user)
            user1 = await hre.ethers.getSigner(args.user);

        const contract =
            await hre.ethers.getContractAt("ACDMPlatform", args.contract, user1);

        await contract.unlist(args.listingId);

        console.log("done");
    });

task("buy-listed", "Buy listed by some user ACDM tokens")
    .addParam("contract", "Address of the contract")
    .addParam("listing", "Id of the listing to buy")
    .addParam("amount", "Amount of tokens to buy")
    .addOptionalParam("seller", "Seller address (who listed tokens)")
    .addOptionalParam("user", "User address")
    .setAction(async (args, hre) => {
        let [owner, user1, user2] = await hre.ethers.getSigners();
        if (args.user)
            user1 = await hre.ethers.getSigner(args.user);
        if (args.seller)
            user2 = await hre.ethers.getSigner(args.seller);

        const contract =
            await hre.ethers.getContractAt("ACDMPlatform", args.contract, user1);

        const listingDetails = await contract.getListingDetails(args.seller, args.listing);
        await contract.buyListed(args.seller, args.listing, args.amount, {value:listingDetails.price.mul(args.amount)});

        console.log("done");
    });