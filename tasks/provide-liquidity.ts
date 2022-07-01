import { task } from "hardhat/config";
import { StakingPlatform, IUniswapV2Router02, IUniswapV2Factory, IERC20MintableBurnable, IUniswapV2Pair } from "../typechain-types";

task("provide-liquidity", "Add tokens to a pool and get LP tokens back")
    .addParam("provider", "address of account which provides tokens")
    .addParam("tokena", "first ERC20 token's address")
    .addParam("tokenb", "second ERC20 token's address")
    .addParam("amounta", "amount of the first ERC20 token")
    .addOptionalParam("amountb", "amount of the second ERC20 token")
    .addOptionalParam("factory", "address of IUniswapV2Factory")
    .addOptionalParam("router", "address of IUniswapV2Router")
    .setAction(async (args, hre): Promise<IUniswapV2Pair> => {
        let provider = await hre.ethers.getSigner(args.provider);
        const accounts = await hre.ethers.getSigners();

        const tokenA = await hre.ethers.getContractAt(
            "IERC20MintableBurnable",
            args.tokena,
            provider
        ) as IERC20MintableBurnable;
        const tokenB = await hre.ethers.getContractAt(
            "IERC20MintableBurnable",
            args.tokenb,
            provider
        ) as IERC20MintableBurnable;

        const factory = await hre.ethers.getContractAt(
            "IUniswapV2Factory",
            args.factory ?? "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
            provider
        ) as IUniswapV2Factory;
        
        let ratio = 10;
        let lpTokenAddr = await factory.getPair(tokenA.address, tokenB.address);
        let lpToken:IUniswapV2Pair;
        if (lpTokenAddr != hre.ethers.constants.AddressZero) {
            lpToken = await hre.ethers.getContractAt(
                "IUniswapV2Pair",
                lpTokenAddr,
                provider
            ) as IUniswapV2Pair
            const [a, b] = await lpToken.getReserves();
            if (!a.isZero() && !b.isZero())
                ratio = a.div(b).toNumber();
        }

        const amountA = hre.ethers.BigNumber.from(args.amounta);
        //input or amountA / ration
        const amountB = args.amountb ?
            hre.ethers.BigNumber.from(args.amountb) : 
            amountA.div(ratio);
        
        const router = await hre.ethers.getContractAt(
            "IUniswapV2Router02",
            args.router ?? "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
            provider
        ) as IUniswapV2Router02;

        const blockNumBefore = await hre.ethers.provider.getBlockNumber();
        const blockBefore = await hre.ethers.provider.getBlock(blockNumBefore);
        const deadline = blockBefore.timestamp + 120;//+120 sec

        await tokenA.connect(provider).approve(router.address, amountA);
        await tokenB.connect(provider).approve(router.address, amountB);

        if (lpTokenAddr == hre.ethers.constants.AddressZero)
            await factory.createPair(tokenA.address, tokenB.address);

        await router.addLiquidity(
            tokenA.address,
            tokenB.address,
            amountA,
            amountB,
            amountA,
            amountB,
            provider.address,
            deadline
        );
 
        lpTokenAddr = await factory.getPair(tokenA.address, tokenB.address);
        lpToken = await hre.ethers.getContractAt(
            "IUniswapV2Pair",
            lpTokenAddr,
            provider
        ) as IUniswapV2Pair;

        console.log("LP token address: " + lpToken.address);
        return lpToken;
    });

task("provide-liquidity-eth", "Add tokens to a pool and get LP tokens back")
    .addParam("provider", "address of account which provides tokens")
    .addParam("tokena", "ERC20 token's address")
    .addOptionalParam("amounta", "amount of the first ERC20 token")
    .addOptionalParam("amounteth", "amount of ETH")
    .addOptionalParam("factory", "address of IUniswapV2Factory")
    .addOptionalParam("router", "address of IUniswapV2Router")
    .setAction(async (args, hre): Promise<IUniswapV2Pair> => {
        let provider = await hre.ethers.getSigner(args.provider);
        
        const tokenA = await hre.ethers.getContractAt(
            "IERC20MintableBurnable",
            args.tokena,
            provider
        ) as IERC20MintableBurnable;

        const amountA = args.amounta ?
            hre.ethers.BigNumber.from(args.amounta) :
            await tokenA.balanceOf(provider.address);
        
        const factory = await hre.ethers.getContractAt(
            "IUniswapV2Factory",
            args.factory ?? "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
            provider
        ) as IUniswapV2Factory;

        const router = await hre.ethers.getContractAt(
            "IUniswapV2Router02",
            args.router ?? "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
            provider
        ) as IUniswapV2Router02;

        const blockNumBefore = await hre.ethers.provider.getBlockNumber();
        const blockBefore = await hre.ethers.provider.getBlock(blockNumBefore);
        const deadline = blockBefore.timestamp + 30;//+30 sec

        await tokenA.connect(provider).approve(router.address, amountA);
        
        let wETH = await router.WETH();
        let lpTokenAddr = await factory.getPair(wETH, tokenA.address);
        // if (lpTokenAddr != hre.ethers.constants.AddressZero) {
        //     const lpToken = await hre.ethers.getContractAt(
        //         "IUniswapV2Pair",
        //         lpTokenAddr,
        //         provider
        //     ) as IUniswapV2Pair;

        //     console.log("LP token address: " + lpToken.address);
        //     return lpToken;
        // }
        const ETH = hre.ethers.utils.parseEther(args.amounteth);
        await router.addLiquidityETH(
            tokenA.address,
            amountA,
            amountA,
            ETH,
            provider.address,
            deadline,
            {value:ETH}
        );

        lpTokenAddr = await factory.getPair(wETH, tokenA.address);
        const lpToken = await hre.ethers.getContractAt(
            "IUniswapV2Pair",
            lpTokenAddr,
            provider
        ) as IUniswapV2Pair;

        console.log("LP token address: " + lpToken.address);
        return lpToken;
    });
