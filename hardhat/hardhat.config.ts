import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

import "./tasks/accounts";
import "./tasks/pbt";

const dotenvConfigPath: string = process.env.DOTENV_CONFIG_PATH || "./.env";
dotenvConfig({ path: resolve(__dirname, dotenvConfigPath) });

// Ensure that we have all the environment variables we need.
const mnemonic: string | undefined = process.env.MNEMONIC;
if (!mnemonic) {
  throw new Error("Please set your MNEMONIC in a .env file");
}

const accounts = {
  count: 10,
  mnemonic,
  path: "m/44'/60'/0'/0",
};

// networks
const networks = {
  /** local */
  hardhat: {
    allowUnlimitedContractSize: false,
    accounts,
  },
  localhost: {
    url: "http://localhost:8545",
    accounts,
  },

  /** public testnets */
  goerli: {
    // eth testnet
    chainId: 5,
    url: "https://rpc.ankr.com/eth_goerli",
    accounts,
  },
  polygonMumbai: {
    // polygon testnet
    chainId: 80001,
    url: "https://rpc.ankr.com/polygon_mumbai",
    accounts,
  },
  avalancheFujiTestnet: {
    // avalanche testnet
    chainId: 43113,
    url: "https://rpc.ankr.com/avalanche_fuji",
    accounts,
  },
  bscTestnet: {
    // bsc testnet
    chainId: 97,
    url: "https://rpc.ankr.com/bsc_testnet_chapel",
    accounts,
  },

  /** public mainnets */
  mainnet: {
    chainId: 1,
    url: "https://rpc.ankr.com/eth",
    accounts,
  },
  polygon: {
    chainId: 137,
    url: "https://rpc.ankr.com/polygon",
    accounts,
  },
  avalanche: {
    chainId: 43114,
    url: "https://rpc.ankr.com/avalanche",
    accounts,
  },
  bsc: {
    chainId: 56,
    url: "https://rpc.ankr.com/bsc",
    accounts,
  },
};

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  settings: {
    metadata: {
      // Not including the metadata hash
      // https://github.com/paulrberg/hardhat-template/issues/31
      bytecodeHash: "none",
    },
    // Disable the optimizer when debugging
    // https://hardhat.org/hardhat-network/#solidity-optimizer-support
    optimizer: {
      enabled: true,
      runs: 800,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },
  defaultNetwork: "hardhat",
  networks,
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "", // TODO
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
      avalanche: process.env.SNOWTRACE_API_KEY || "",
      avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      optimisticEthereum: process.env.OPTIMISM_API_KEY || "", // TODO
      arbitrumOne: process.env.ARBISCAN_API_KEY || "", // TODO
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v5",
  },
};
