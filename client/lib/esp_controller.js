const CONTRACT_ADDRESS_DEMO = '0xFAD7EAb70eD7569Aa54AFd7b11Bb376D948b2665';
const STEP = {
  CHECK_BROWSER: 0,
  CONNECT_WALLET: 1,
  TOKEN_ADDRESS: 2,
  GET_SIGNATURE: 3,
  CLAIM_TOKEN: 4,
}

var ble = new EspBLE(UUID_SERVICE);
var eth = new EspETH();
var signSteps = M.Collapsible.getInstance(document.querySelector('#connector'));
var scannerEl = document.querySelector('#scanner');
var scanner = scannerEl && M.Collapsible.getInstance(scannerEl);

var signState = {
  signature: null,
  blockNumber: null,
  contractAddress: null,
};

var scanState = {
  devices: {},
  addresses: [],
}


// browser check
const checkBrowserSign = (showMessage) => {
  const hasWallet = window && !!(window.ethereum || (window.web3 && window.web3.currentProvider));
  const hasBluetooth = !!(navigator && navigator.bluetooth && navigator.bluetooth.requestDevice);

  if (hasBluetooth && hasWallet) {
    signSteps.open(STEP.CONNECT_WALLET);
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
document.querySelector('.js-browser-check').addEventListener('click', checkBrowserSign);
checkBrowserSign(false);
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
  signSteps.open(STEP.TOKEN_ADDRESS);

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
  } catch(e) {
    console.debug(e);
    M.toast({text: 'Error connecting wallet'});
  }
}
document.querySelector('.js-wallet-connect').addEventListener('click', connectWallet);


// token address
const validateTokenAddress = (showMessage) => {
  const input = document.querySelector('#input-token-address:valid');
  if (input && input.value && ethers.utils.isAddress(input.value)) {
    signSteps.open(STEP.GET_SIGNATURE);
    signState.contractAddress = input.value;
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
    validateTokenAddress(true);
    eth.switchNetwork(5);
  }
});


// BLE connection and signature
document.querySelector('.js-connect').addEventListener('click', async event => {
  try {
    signState.signature = null;
    signState.blockNumber = null;

    // create payload
    const account = await eth.getAccount();
    const block = await eth.getBlock();
    if (!account || !block) {
      M.toast({text: 'Error getting data from MetaMask, check wallet connection'});
      signSteps.open(STEP.CONNECT_WALLET);
      return;
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
    // console.log(`Sending message "${message}", waiting for notification callback. Block number is ${blockNumber}.`);
    await ble.write(UUID_INPUT_MESSAGE, message);

    // get signature
    await wait(200);
    const signature = await ble.read(UUID_OUTPUT_SIGNATURE);
    // console.log(`Signature retrieved: ${signature}`);

    // disconnect BLE
    ble.disconnect();

    // write signature into DOM and store
    document.querySelector('.js-connect-signature').innerHTML = `<b>Signature:</b> ${signature}`;
    document.querySelector('.js-connect-blocknumber').innerHTML = `<b>Block number:</b> ${blockNumber}`;
    signState.signature = signature;
    signState.blockNumber = blockNumber;

    M.toast({text: 'Signature generated successfully'});
    setTimeout(() => signSteps.open(STEP.CLAIM_TOKEN), 3000);
  } catch(e) {
    console.debug(e);
  }
});

// claim token
document.querySelector('.js-claim').addEventListener('click', async event => {
  const { signature, blockNumber, contractAddress } = signState;

  if (!signature || !blockNumber) {
    M.toast({text: 'No signature found, please sign again'});
    signSteps.open(STEP.GET_SIGNATURE);
    return;
  }
  if (!contractAddress) {
    M.toast({text: 'No contract address found, please check'});
    signSteps.open(STEP.TOKEN_ADDRESS);
    return;
  }

  const progressBar = document.querySelector('.js-claim-progress');
  const btn = document.querySelector('.js-claim');
  btn.disabled = true;
  progressBar.classList.remove('hide');

  try {
    const txResult = await eth.transferTokenWithChip(signature, blockNumber, contractAddress);
    // success
    console.debug(txResult);
    M.toast({text: 'NFT has been transferred successfully to your wallet'});
    document.querySelector('.js-claim-success').innerHTML = `Signature validated, the NFT has been transferred successfully! Check the transaction in your wallet for more details.`
  } catch (e) {
    M.toast({text: 'Transaction error or cancelled by user'});
  }

  btn.disabled = false;
  progressBar.classList.add('hide');
});

// BLE scanner
const checkBrowserScan = (showMessage) => {
  const hasBleScan = !!(navigator.bluetooth && navigator.bluetooth.requestLEScan);
  if (!hasBleScan) {
    if (showMessage) M.toast({text: 'Browser doesn\'t support BLE scanning.'});
    const toggle = document.querySelector('.js-scan-toggle');
    const warning = document.querySelector('.js-scan-browser-warning');
    if (toggle && warning) {
      toggle.disabled = true;
      warning.innerHTML = 'Browser doesn\'t support BLE scanning, check your settings';
    }
    return false;
  }
  return true;
}
checkBrowserScan(false);

const toggle = document.querySelector('.js-scan-toggle');
toggle && toggle.addEventListener('click', async event => {
  try {
    // toggle on
    if (event.target.checked) {
      if (checkBrowserScan(true)) {
        const callback = async (ev) => {
          if (!!ev.uuids.find((uuid) => uuid.includes('00005791-0000')) && !scanState.devices[ev.device.id]) {
            console.debug(ev);
            const { device } = ev;

            const template = document.querySelector('.js-scan-template');
            const entry = template.cloneNode(true);
            entry.classList.remove('js-scan-template');
            entry.classList.remove('hide');
            entry.querySelector('.js-scan-devicename').innerHTML = device.name;
            entry.querySelector('.js-scan-deviceid').innerHTML = `<b>Device ID:</b> ${device.id}`;

            /*
            await device.gatt.connect();
            const pubkey = await ble.read(UUID_READ_PUBKEY);
            const address = await ble.read(UUID_READ_ADDRESS);
            await device.gatt.disconnect();
            */
            entry.querySelector('.js-scan-chipaddress').innerHTML = `<b>Chip Address:</b> ${device.id}`;
            entry.querySelector('.js-scan-pubkey').innerHTML = `<b>Public Key:</b> ${device.id}`;

            document.querySelector('#scanner').appendChild(entry);
            scanState.devices[device.id] = device;
          }
        }

        ble.startScan(callback);
      } else {
        event.target.checked = false;
      }
    } else {
      ble.stopScan();
    }
  } catch (e) {
    console.debug(e);
  }
});
