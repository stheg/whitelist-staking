import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IERC20, IERC20MintableBurnable, IUniswapV2Factory, IUniswapV2Pair, IUniswapV2Router02 } from "../typechain-types";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { deployERC20Token } from "./test-deployment";

export async function getFactory(
    signer:SignerWithAddress, 
    atAddress:string | undefined = undefined
):Promise<IUniswapV2Factory> {
    return await ethers.getContractAt(
        "IUniswapV2Factory",
        atAddress ?? "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
        signer
    ) as IUniswapV2Factory;
}

export async function getRouter(
    signer:SignerWithAddress, 
    atAddress:string | undefined = undefined
):Promise<IUniswapV2Router02> {
    return await ethers.getContractAt(
        "IUniswapV2Router02",
        atAddress ?? "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        signer
    ) as IUniswapV2Router02;
}

export async function provideLiquidity(
    provider:SignerWithAddress, 
    tokenA:IERC20,
    amountA:number,
    tokenB:IERC20,
    amountB:number,
    uniFactory: IUniswapV2Factory,
    uniRouter: IUniswapV2Router02
): Promise<IUniswapV2Pair> {
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const deadline = blockBefore.timestamp + 30;//+30 sec

    await tokenA.connect(provider).approve(uniRouter.address, amountA);
    await tokenB.connect(provider).approve(uniRouter.address, amountB);

    await uniRouter.addLiquidity(
        tokenA.address,
        tokenB.address,
        amountA,
        amountB,
        amountA,
        amountB,
        provider.address,
        deadline
    );

    let lpTokenAddr = await uniFactory.getPair(tokenA.address, tokenB.address);
    const lpToken = await ethers.getContractAt(
        "IUniswapV2Pair",
        lpTokenAddr,
        provider
    ) as IUniswapV2Pair;

    return lpToken;
}

export async function provideLiquidityETH(
    liqProvider: SignerWithAddress,
    token: IERC20,
    tokenAmount: BigNumber,
    ethAmount: BigNumber,
    uniFactory: IUniswapV2Factory,
    uniRouter: IUniswapV2Router02,
    deadlineDate:number | null = null
): Promise<IUniswapV2Pair> {
    if (deadlineDate == null) {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        deadlineDate = blockBefore.timestamp + 60;
    }

    await token.connect(liqProvider).approve(uniRouter.address, tokenAmount);

    const wETH = await uniRouter.WETH();
    let lpTokenAddr = await uniFactory.getPair(wETH, token.address);

    await uniRouter.addLiquidityETH(
        token.address,
        tokenAmount,
        tokenAmount.sub(tokenAmount.div(100)), // - 1%
        ethAmount,
        liqProvider.address,
        deadlineDate,
        {value:ethAmount}
    );

    lpTokenAddr = await uniFactory.getPair(wETH, token.address);
    const lpToken = await ethers.getContractAt(
        "IUniswapV2Pair",
        lpTokenAddr,
        liqProvider
    ) as IUniswapV2Pair;

    return lpToken;
}

export async function deployTokenAndProvideLiquidityForTests(staker: SignerWithAddress, rewardTokenOwner: SignerWithAddress, amount: string = "1000000", price: string = "0.00001"): Promise<[IUniswapV2Pair, IERC20MintableBurnable]> {
    const liquidityAmount = BigNumber.from(amount);

    const rewardToken = await deployERC20Token("SToken", 18, rewardTokenOwner);
    await rewardToken.mint(staker.address, liquidityAmount);

    const stakingToken = await provideLiquidityETH(
        staker,
        rewardToken,
        BigNumber.from(liquidityAmount),
        ethers.utils.parseEther(price).mul(liquidityAmount),
        await getFactory(staker),
        await getRouter(staker)
    );
    return [stakingToken, rewardToken];
}

export async function provideLiquidityForTests(staker: SignerWithAddress, rewardTokenOwner: SignerWithAddress, rewardToken:IERC20MintableBurnable, amount: string = "1000000", price: string = "0.00001"): Promise<[IUniswapV2Pair, IERC20MintableBurnable]> {
    const liquidityAmount = BigNumber.from(amount);

    await rewardToken.connect(rewardTokenOwner).mint(staker.address, liquidityAmount);

    const stakingToken = await provideLiquidityETH(
        staker,
        rewardToken,
        BigNumber.from(liquidityAmount),
        ethers.utils.parseEther(price).mul(liquidityAmount),
        await getFactory(staker),
        await getRouter(staker)
    );
    return [stakingToken, rewardToken];
}