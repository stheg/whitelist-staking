import dotenv from "dotenv";
dotenv.config();

import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "tsconfig-paths/register";

import "./tasks/default";
import "./tasks/acdm-platform";
import "./tasks/dao";
import "./tasks/staking";
// import "./tasks/provide-liquidity";

export default {
  solidity: {
    version: "0.8.13",
    settings: { optimizer: { enabled: true } }
  },
  networks: {
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALC_KEY}`,
      accounts: [process.env.ACC_1, process.env.ACC_2, process.env.ACC_3]
    },
    hardhat: {
      chainId: 1337,
      forking: {
        url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALC_KEY}`,
        blockNumber: 10691345
      },
    }
  },
  etherscan: {
    apiKey: process.env.ETHER_SCAN_KEY
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  }
};
