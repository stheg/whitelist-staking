import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ACDMPlatform, ACDMPlatform__factory, IERC20MintableBurnable, IUniswapV2Pair, Token } from "../../typechain-types";
import { deployERC20Token, deployACDMPlatform } from "../../scripts/test-deployment";
import { deployTokenAndProvideLiquidityForTests, getRouter, provideLiquidityForTests } from "../../scripts/provide-liquidity";
import { BigNumber } from "ethers";
import { daysToSeconds as days, delay as delaySecondsBN, delayNumber as delaySecondsN } from '../../scripts/misc';
import { keccak256 } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import { getMerkleTree } from "../../scripts/merkleTree";

describe("ACDM Platform: 3 rounds and voting for burning", () => {
    let accounts: SignerWithAddress[];
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2_HasRef1: SignerWithAddress;
    let user3_HasRef2: SignerWithAddress;
    let user4: SignerWithAddress;
    let user5: SignerWithAddress;
    let user6_HasNoStake: SignerWithAddress;
    let contract: ACDMPlatform;
    let stakingToken: IUniswapV2Pair;
    let rewardToken: IERC20MintableBurnable;
    let acdmToken: Token;
    let merkleTree: MerkleTree;

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        user1 = accounts[1];
        user2_HasRef1 = accounts[2];
        user3_HasRef2 = accounts[3];
        user4 = accounts[4];
        user5 = accounts[5];
        user6_HasNoStake = accounts[6];
        
        acdmToken = await deployERC20Token("ACDM", 8, owner);
        [stakingToken, rewardToken] = await deployTokenAndProvideLiquidityForTests(owner, owner);

        contract = await deployACDMPlatform(
            acdmToken.address,
            stakingToken.address, 
            rewardToken.address, 
            owner
        );
        await contract.connect(owner).grantRole(await contract.CONFIGURATOR_ROLE(), owner.address);
        await contract.grantRole(await contract.CONFIGURATOR_ROLE(), contract.address);
        merkleTree = getMerkleTree(accounts, keccak256);
        const wlRoot = merkleTree.getHexRoot();
        await contract.connect(owner).setWhitelist(wlRoot);

        await acdmToken.grantRole(await acdmToken.MINTER_ROLE(), contract.address);
        await acdmToken.mint(contract.address, 100000);
    });
    
    it("should convert and burn tokens", async () => {
        await registration();

        await stake();
        
        let amount = 100;
        let counter = 0;
        while(counter++ < 3) {
            console.log("Round: ", counter);
            console.log("Sale is in process...");
            
            const salePrice = await saleRound(amount);

            console.log("Finishing sale...");
            let round = await contract.getRoundDuration();
            await delaySecondsBN(round);
            await contract.connect(user5).finishRound();

            console.log("Trade is in process...");
            await tradeRound(amount, salePrice);

            console.log("Finishing trade...");
            round = await contract.getRoundDuration();
            await delaySecondsBN(round);
            await contract.connect(user5).finishRound();
            amount = amount / 5;
        }

        const router = await getRouter(owner);
        let platformBonus = await contract.getAccumulatedPlatformBonus();
        
        expect(platformBonus).gt(0);

        const lpToken = await ethers.getContractAt(
            "IUniswapV2Pair",
            stakingToken.address,
            owner
        ) as IUniswapV2Pair;
        
        const callData = ACDMPlatform__factory.createInterface().encodeFunctionData(
            "convertAndBurn",
            [router.address, rewardToken.address, 60*5]
        );

        await contract.connect(owner).addProposal(contract.address, callData, "convert&burn");

        const proposalId = 1;
        await contract.connect(user1).vote(proposalId, true);
        await contract.connect(user2_HasRef1).vote(proposalId, true);
        await contract.connect(user3_HasRef2).vote(proposalId, true);
        await contract.connect(user4).vote(proposalId, true);
        await contract.connect(user5).vote(proposalId, false);

        delaySecondsN(await contract.getVotingDuration(), 30);

        platformBonus = await contract.getAccumulatedPlatformBonus();
        const tx = contract.connect(owner).finish(proposalId);

        await expect(() => tx).to.changeEtherBalance(
            contract, -platformBonus
        )

        platformBonus = await contract.getAccumulatedPlatformBonus();
        expect(platformBonus).eq(0);
    });

    async function registration() {
        await contract.connect(user1)
            .register(ethers.constants.AddressZero);
        await contract.connect(user2_HasRef1)
            .register(user1.address);
        await contract.connect(user3_HasRef2)
            .register(user2_HasRef1.address);
    }

    async function stake() {
        await provideLiquidityForTests(user1, owner, rewardToken, "300");
        await provideLiquidityForTests(user2_HasRef1, owner, rewardToken, "400");
        await provideLiquidityForTests(user3_HasRef2, owner, rewardToken, "200");
        await provideLiquidityForTests(user4, owner, rewardToken, "500");
        await provideLiquidityForTests(user5, owner, rewardToken, "250");
        await provideLiquidityForTests(user6_HasNoStake, owner, rewardToken, "100");

        await stakeAll(user1);
        await stakeAll(user2_HasRef1);
        await stakeAll(user3_HasRef2);
        await stakeAll(user4);
        await stakeAll(user5);
    }

    async function stakeAll(user: SignerWithAddress) {
        const balance = await stakingToken.balanceOf(user.address);
        await stakingToken.connect(user).approve(contract.address, balance);
        let userHash = keccak256(user.address);
        let userProof = merkleTree.getHexProof(userHash);
        await contract.connect(user).stake(balance, userProof);
    }

    async function saleRound(amount: number) {
        const price = await contract.getSaleRoundPrice();
        
        await saleBuy(user1, amount, price);
        await saleBuy(user2_HasRef1, amount, price);
        await delaySecondsN(days(1));
        
        await saleBuy(user3_HasRef2, amount, price);
        await saleBuy(user4, amount, price);
        await delaySecondsN(days(1));

        await saleBuy(user5, amount, price);
        await saleBuy(user6_HasNoStake, amount, price);

        return price;
    }

    async function saleBuy(user: SignerWithAddress, amount:number, price:BigNumber) {
        await contract.connect(user).buy(amount, { value: price.mul(amount) });
    }

    async function tradeRound(amount:number, price: BigNumber) {
        const [u1amount, u1price, u1firstListingId] = await tradeList(user1, amount, plusPercents(price, 3));
        const [u2amount, u2price, u2firstListingId] = await tradeList(user2_HasRef1, amount/2, plusPercents(price, 1));
        const [u3amount, u3price, u3firstListingId] = await tradeList(user3_HasRef2, amount/2, plusPercents(price, 2));
        
        await tradeBuy(user1, user2_HasRef1, u2firstListingId, u2amount, u2price);
        await tradeBuy(user1, user3_HasRef2, u3firstListingId, u3amount, u3price);
        
        const [u1amount2, u1price2, u1secondListingId] = await tradeList(user1, amount/2, u1price);
        
        await tradeBuy(user4, user1, u1firstListingId, u1amount/2, u1price);
        await tradeBuy(user5, user1, u1secondListingId, u1amount2/2, u1price2);
    }

    function plusPercents(price:BigNumber, percents: number) {
        return price.add(price.div(100).mul(percents));
    }

    async function tradeList(user: SignerWithAddress, amount: number, price: BigNumber):Promise<[number, BigNumber, BigNumber]> {
        await acdmToken.connect(user).approve(contract.address, amount);
        await contract.connect(user).list(amount, price);

        const listingId = await contract.getListingCounter(user.address);

        return [amount, price, listingId.sub(1)];
    }

    async function tradeBuy(user: SignerWithAddress, seller: SignerWithAddress, listingId:BigNumber, amount: number, price: BigNumber) {
        await contract.connect(user).buyListed(seller.address, listingId, amount, { value: price.mul(amount) });
    }
});
