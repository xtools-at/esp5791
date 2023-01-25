const NETWORK_ID_TO_NAME = {
  [1]: 'Ethereum',
  [5]: 'Ethereum Goerli',
  [11155111]: 'Ethereum Sepolia',
  [3]: 'Ethereum Ropsten',
  [4]: 'Ethereum Rinkeby',
  [56]: 'BNB Chain',
  [97]: 'BNB Chain Testnet',
  [137]: 'Polygon',
  [80001]: 'Polygon Mumbai',
  [43114]: 'Avalanche',
  [43113]: 'Avalanche Fuji',
  [250]: 'Fantom',
  [4002]: 'Fantom Testnet',
  [10]: 'Optimism',
  [420]: 'Optimism Goerli',
  [42161]: 'Arbitrum',
  [42170]: 'Arbitrum Nova',
  [421613]: 'Arbitrum Goerli',
  [8217]: 'Klaytn',
  [1001]: 'Klaytn Testnet',
};

const pbtAbi = [{
  "inputs": [
    {
      "internalType": "bytes",
      "name": "signatureFromChip",
      "type": "bytes"
    },
    {
      "internalType": "uint256",
      "name": "blockNumberUsedInSig",
      "type": "uint256"
    },
    {
      "internalType": "bool",
      "name": "useSafeTransferFrom",
      "type": "bool"
    }
  ],
  "name": "transferTokenWithChip",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}];

class EspETH {
  web3provider;

  constructor() {
    if (window.ethereum) {
      this.web3provider = new ethers.providers.Web3Provider(window.ethereum);
    } else if (window.web3 && window.web3.currentProvider) {
      this.web3provider = new ethers.providers.Web3Provider(window.web3.currentProvider);
    }

    if (this.web3provider) {
      const changeCallback = () => window && window.location.reload();
      this.web3provider.provider.on('accountsChanged', changeCallback);
      this.web3provider.provider.on('chainChanged', changeCallback);
      this.web3provider.provider.on('disconnect', changeCallback);
    }
  }

  async connect() {
    if (!this.web3provider) {
      return Promise.reject('No injected wallet found');
    }
    const accounts = await this.web3provider.send("eth_requestAccounts", []);
    const account = accounts.length ? accounts[0] : undefined;

    return account;
  }

  async getAccount() {
    if (!this.web3provider) {
      return Promise.reject('No injected wallet found');
    }
    const accounts = await this.web3provider.listAccounts();
    const account = accounts.length ? accounts[0] : undefined;

    return account;
  }

  async getNetwork() {
    if (!this.web3provider) {
      return Promise.reject('No injected wallet found');
    }
    const network = await this.web3provider.getNetwork();
    const chainId = network.chainId;
    const networkName = NETWORK_ID_TO_NAME[chainId] || network.name || "Unknown network"

    return {
      name: networkName,
      id: chainId,
    }
  }

  async getBlock() {
    if (!this.web3provider) {
      return Promise.reject('No injected wallet found');
    }
    return this.web3provider.getBlock();
  }

  async transferTokenWithChip(signature, blockNumber, contractAddress) {
    const contract = new ethers.Contract(
      contractAddress,
      pbtAbi,
      this.web3provider.getSigner(),
    );

    const tx = await contract.transferTokenWithChip(signature, blockNumber, true);
    return tx.wait();
  }

  async switchNetwork(chainId) {
    try {
      if (!this.web3provider) {
        return Promise.reject('No injected wallet found');
      }
      await this.web3provider.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${Number(chainId || 5).toString(16)}`}],
      });
    } catch (e) {
      console.debug(e);
    }
  }
}
