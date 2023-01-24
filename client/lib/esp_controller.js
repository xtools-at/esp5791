const CONTRACT_ADDRESS_DEMO = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // TODO!!
const STEP = {
  CHECK_BROWSER: 0,
  CONNECT_WALLET: 1,
  TOKEN_ADDRESS: 2,
  GET_SIGNATURE: 3,
  CLAIM_TOKEN: 4,
}

var ble = new EspBLE(UUID_SERVICE);
var eth = new EspETH();
var collapsible = M.Collapsible.getInstance(document.querySelector('#connector'));
var state = {
  signature: null,
  blockNumber: null,
  contractAddress: null,
};


// browser check
const checkBrowser = (showMessage) => {
  const hasWallet = window && !!(window.ethereum || (window.web3 && window.web3.currentProvider));
  const hasBluetooth = !!(navigator && navigator.bluetooth && navigator.bluetooth.requestDevice);

  if (hasBluetooth && hasWallet) {
    collapsible.open(STEP.CONNECT_WALLET);
    const btn = document.querySelector('.js-browser-check');
    btn.disabled = true;
    btn.querySelector('i').innerHTML = 'check_circle';
    if (showMessage) M.toast({text: 'Everything looks alright, moving on'});
  } else if (!hasBluetooth) {
    if (showMessage) M.toast({text: 'No Bluetooth support detected, please use Google Chrome on Desktop'});
  } else if (!hasWallet) {
    if (showMessage) M.toast({text: 'No Wallet detected, please install the MetaMask Chrome extension'});
  }

  return hasBluetooth && hasWallet;
};
document.querySelector('.js-browser-check').addEventListener('click', checkBrowser);
checkBrowser(false);
eth.getAccount().then(account => {
  if (account) {
    connectWalletSuccess();
  }
}).catch(() => {});


// wallet connection
const connectWalletSuccess = async () => {
  const btn = document.querySelector('.js-wallet-connect');
  btn.disabled = true;
  btn.querySelector('i').innerHTML = 'check_circle';
  collapsible.open(STEP.TOKEN_ADDRESS);

  const { name, id } = await eth.getNetwork();
  document.querySelector('#js-token-network').innerHTML =
    `Your wallet is connected to <b>${name}</b> (ID ${id}). Switch networks in your wallet if this doesn't match your contract.`;
}

const connectWallet = async (showMessage) => {
  try {
    // check if connected already
    let account = await eth.getAccount();
    // connect if not
    if (!account) account = await eth.connect();

    if (account) {
      connectWalletSuccess();
      if (showMessage) M.toast({text: 'Wallet connected successfully'});
    } else {
      if (showMessage) M.toast({text: 'Please confirm the wallet connection request in MetaMask'});
    }
  } catch(error) {
    console.log(error);
    M.toast({text: 'Error connecting wallet'});
  }
}
document.querySelector('.js-wallet-connect').addEventListener('click', connectWallet);


// token address
const validateTokenAddress = (showMessage) => {
  const input = document.querySelector('#input-token-address:valid');
  if (input && input.value && ethers.utils.isAddress(input.value)) {
    collapsible.open(STEP.GET_SIGNATURE);
    state.contractAddress = input.value;
  } else {
    if (showMessage) M.toast({text: 'Contract address invalid, please check your input'});
  }
};

document.querySelector('.js-token-continue').addEventListener('click', validateTokenAddress);
document.querySelector('.js-token-demo').addEventListener('click', event => {
  const input = document.querySelector('#input-token-address');
  if (input) {
    input.value = CONTRACT_ADDRESS_DEMO;
    M.updateTextFields();
  }
  validateTokenAddress(true);
});


// BLE connection and signature
document.querySelector('.js-connect').addEventListener('click', async event => {
  try {
    state.signature = null;
    state.blockNumber = null;

    // create payload
    const account = await eth.getAccount();
    const block = await eth.getBlock();
    if (!account || !block) {
      M.toast({text: 'Error getting recent block from MetaMask'});
    }
    const { number: blockNumber, hash: blockHash } = block;
    const message = account + blockHash.substring(2);

    // connect BLE
    await ble.connect();

    // read chip values
    // const pubkey = await ble.read(UUID_READ_PUBKEY);
    const address = await ble.read(UUID_READ_ADDRESS);
    document.querySelector('.js-connect-chipaddress').innerHTML = `<b>Chip address:</b> ${address}`;

    // send message to sign
    console.log(`Sending message "${message}", waiting for notification callback. Block number is ${blockNumber}.`);
    await ble.write(UUID_INPUT_MESSAGE, message);

    // get signature
    await wait(200);
    const signature = await ble.read(UUID_OUTPUT_SIGNATURE);
    console.log(`Signature retrieved: ${signature}`);

    // disconnect BLE
    ble.disconnect();

    // write signature into DOM and store
    document.querySelector('.js-connect-signature').innerHTML = `<b>Signature:</b> ${signature}`;
    document.querySelector('.js-connect-blocknumber').innerHTML = `<b>Block number:</b> ${blockNumber}`;
    state.signature = signature;
    state.blockNumber = blockNumber;

    M.toast({text: 'Signature generated successfully'});
    collapsible.open(STEP.CLAIM_TOKEN);
  } catch(error) {
    console.log(error);
  }
});

// claim token
document.querySelector('.js-claim').addEventListener('click', event => {
  const { signature, blockNumber, contractAddress } = state;
  if (!signature || !blockNumber) {
    M.toast({text: 'No signature found, please sign again'});
    collapsible.open(STEP.GET_SIGNATURE);
  }
  if (!contractAddress) {
    M.toast({text: 'No contract address found, please check'});
    collapsible.open(STEP.TOKEN_ADDRESS);
  }

  const txResult = eth.transferTokenWithChip(signature, blockNumber, contractAddress);
  // TODO: success
  console.log(txResult);
});
