const DEMO_CONTRACT_ADDRESS = '0xFAD7EAb70eD7569Aa54AFd7b11Bb376D948b2665';
const DEMO_CONTRACT_NETWORK_ID = 5;

const STEP = {
  SIG_CONNECT_WALLET: 0,
  SIG_TOKEN_ADDRESS: 1,
  SIG_GET_SIGNATURE: 2,
  SIG_CLAIM_TOKEN: 3,
  SEED_LINK_CHIPS: 3,
  SEED_TOKEN_ADDRESS: 2,
  SEED_CONNECT_WALLET: 1,
}

var ble = new EspBLE(UUID_SERVICE);
var eth = new EspETH();
var signSteps = M.Collapsible.getInstance(document.querySelector('#connector'));
var seedSteps = M.Collapsible.getInstance(document.querySelector('#seeder'));

let walletConnected = false;

// browser check
const checkBrowserBluetooth = (showMessage) => {
  const hasBluetooth = !!(navigator && navigator.bluetooth && navigator.bluetooth.requestDevice);

  if (!hasBluetooth) {
    if (showMessage) M.toast({text: 'No Bluetooth support detected, please use Google Chrome on Desktop'});
  }

  return hasBluetooth;
};
const checkBrowserWallet = (showMessage) => {
  const hasWallet = window && !!(window.ethereum || (window.web3 && window.web3.currentProvider));

  if (!hasWallet) {
    if (showMessage) M.toast({text: 'No Wallet detected, please install the MetaMask Chrome extension'});
  }

  return hasWallet;
};

if (checkBrowserWallet(false)) {
  signSteps.open(STEP.SIG_TOKEN_ADDRESS);
}
eth.getAccount().then(account => {
  if (account) {
    connectWalletSuccess();
  }
}).catch(() => {});

/** Connect device for signature */
// wallet connection
const connectWalletSuccess = async () => {
  walletConnected = true;

  document.querySelectorAll('.js-wallet-connect').forEach((btn) => {
    btn.disabled = true;
    btn.innerHTML = "<i class='material-icons left'>check_circle</i> Wallet connected"
  });

  const { name, id } = await eth.getNetwork();
  document.querySelectorAll('.js-token-network').forEach((el) => el.innerHTML =
    `Your wallet is connected to <b>${name}</b> (ID ${id}). Switch networks in your wallet if this doesn't match your contract.`
  );

  eth.setAccountListener();
}

const connectWallet = async (showMessage, successCallback) => {
  if (!checkBrowserWallet(true)) return;
  try {
    // check if connected already
    let account = await eth.getAccount();
    // connect if not
    if (!account) account = await eth.connect();

    if (account) {
      connectWalletSuccess();
      if (successCallback) successCallback();
      if (showMessage) {
        M.toast({text: 'Wallet connected successfully'});
      }
    } else {
      if (showMessage) M.toast({text: 'Please confirm the wallet connection request in MetaMask'});
    }
  } catch(e) {
    console.debug(e);
    M.toast({text: 'Error connecting wallet'});
  }
}
document.querySelectorAll('.js-sig-wallet-connect').forEach((el) => el.addEventListener('click', () => {
  connectWallet(true, () => {
    signSteps.open(STEP.SIG_TOKEN_ADDRESS);
  });
}));
document.querySelectorAll('.js-seeder-wallet-connect').forEach((el) => el.addEventListener('click', () => {
  connectWallet(true, () => {
    seedSteps.open(STEP.SEED_TOKEN_ADDRESS);
  });
}));


// token address
const validateTokenAddress = (elId, showMessage) => {
  const input = document.querySelector(`#${elId}:valid`);
  const ok = (input && input.value && ethers.utils.isAddress(input.value));
  if (ok) {
    return input.value;
  } else if (showMessage) M.toast({text: 'Contract address invalid, please check your input'});
};

document.querySelector('.js-token-continue').addEventListener('click', async (event) => {
  const token = validateTokenAddress('input-token-address', true);
  if (token) {
    signSteps.open(STEP.SIG_GET_SIGNATURE);
  }
});
document.querySelector('.js-token-demo').addEventListener('click', event => {
  const input = document.querySelector('#input-token-address');
  if (input) {
    input.value = DEMO_CONTRACT_ADDRESS;
    M.updateTextFields();
    const token = validateTokenAddress('input-token-address', true);
    if (token) {
      signSteps.open(STEP.SIG_GET_SIGNATURE);
    }
    eth.switchNetwork(DEMO_CONTRACT_NETWORK_ID); // testnet
  }
});

// BLE connection and signature
document.querySelector('.js-connect').addEventListener('click', async event => {
  if (!checkBrowserBluetooth(true)) return;
  try {
    // create payload
    const account = await eth.getAccount();
    const block = await eth.getBlock();
    if (!account || !block) {
      M.toast({text: 'Error getting data from MetaMask, check wallet connection'});
      signSteps.open(STEP.SIG_CONNECT_WALLET);
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
    console.debug(`Signature retrieved: ${signature}`);

    // disconnect BLE
    ble.disconnect();

    // write signature into DOM and store
    document.querySelector('.js-connect-blocknumber').innerHTML = `<b>Block number:</b> ${blockNumber}`;
    document.querySelector('.js-connect-signature').innerHTML = `<b>Signature:</b> ${signature}`;
    document.querySelector('#input-signature').value = signature;
    document.querySelector('#input-blockno').value = blockNumber;

    M.toast({text: 'Signature generated successfully'});
    setTimeout(() => signSteps.open(STEP.SIG_CLAIM_TOKEN), 2000);
  } catch(e) {
    console.debug(e);
  }
});

// claim token
document.querySelector('.js-claim').addEventListener('click', async event => {
  event.preventDefault();
  document.querySelector('.js-claim-success').innerHTML = '';
  const contractAddress = document.querySelector('#input-token-address').value;
  const signature = document.querySelector('#input-signature').value;
  const blockNumber = document.querySelector('#input-blockno').value;

  if (!signature || !blockNumber) {
    M.toast({text: 'No signature found, please sign again'});
    signSteps.open(STEP.SIG_GET_SIGNATURE);
    return;
  }
  if (!contractAddress) {
    M.toast({text: 'No contract address found, please check'});
    signSteps.open(STEP.SIG_TOKEN_ADDRESS);
    return;
  }

  if (!walletConnected) {
    M.toast({text: 'Please connect wallet first'});
    signSteps.open(STEP.SIG_CONNECT_WALLET);
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
    document.querySelector('.js-claim-success').innerHTML =
      `Signature validated, the NFT has been transferred successfully! Check the transaction in your wallet for more details.`;
  } catch (e) {
    M.toast({text: 'Transaction error or cancelled by user'});
  }

  btn.disabled = false;
  progressBar.classList.add('hide');
});


/* Scanner */
// Scan devices
const scanResult = document.querySelector('#scan-result');
const renderScanResults = () => {
  // prepare step 4
  const list = document.querySelector('.js-seeder-form ul');
  const chipAddresses = scanResult.value.split('\n')
    .map((addr) => addr.trim())
    .filter((addr) => !!addr);

  let currentEls = list.querySelectorAll('li:not(.hide)');
  if (chipAddresses.length > currentEls.length) {
    const delta = chipAddresses.length - currentEls.length;
    for (let i = 0; i < delta; i++) {
      // add form element
      createLinkElement();
    }
  }

  // populate input fields
  list.querySelectorAll('li:not(.hide)').forEach((row, i) => {
    if (i < chipAddresses.length) {
      row.querySelector('input').value = chipAddresses[i];
    }
  });

  M.updateTextFields();
};
scanResult.addEventListener('change', renderScanResults);

document.querySelector('.js-seeder-copy').addEventListener('click', async event => {
  // copy results
  if (navigator.clipboard && scanResult.value) {
    navigator.clipboard.writeText(scanResult.value);
    M.toast({text: 'Copied to clipboard'});
  }
});
const scan = async () => {
  try {
    // connect BLE
    await ble.connect();
    // read chip values
    const address = await ble.read(UUID_READ_ADDRESS);
    scanResult.value = `${scanResult.value}${address}\n`;

    M.textareaAutoResize(scanResult);
    M.updateTextFields();

    renderScanResults();

    M.toast({text: 'Chip address scanned successfully'});
  } catch (e) {
    console.debug(e);
  }
};
document.querySelector('.js-seeder-scan').addEventListener('click', scan);

// contract
document.querySelector('.js-seeder-continue').addEventListener('click', async (event) => {
  const token = validateTokenAddress('input-seeder-address', true);
  if (token) {
    seedSteps.open(STEP.SEED_LINK_CHIPS);
  }
});

// link chips
const createLinkElement = (chipAddress) => {
  const list = document.querySelector('.js-seeder-form ul');
  const template = list.querySelector('li.hide');
  const newLink = template.cloneNode(true);
  newLink.classList.remove('hide');

  if (chipAddress) {
    const chipInput = newLink.querySelector('input');
    chipInput.value = chipAddress;
  }

  list.appendChild(newLink);
};

document.querySelector('.js-seeder-add').addEventListener('click', (ev) => {
  ev.preventDefault();
  createLinkElement();
});
createLinkElement();

// - actual link step
document.querySelector('.js-seeder-link').addEventListener('click', async event => {
  event.preventDefault();

  document.querySelector('.js-seeder-success').innerHTML = '';

  const contractAddress = document.querySelector('#input-seeder-address').value;

  if (!contractAddress) {
    M.toast({text: 'No contract address found, please check'});
    seedSteps.open(STEP.SEED_TOKEN_ADDRESS);
    return;
  }

  if (!walletConnected) {
    M.toast({text: 'Wallet not connected yet'});
    seedSteps.open(STEP.SEED_CONNECT_WALLET);
    return;
  }

  // get input
  let formValid = true;
  const chipAddresses = [];
  const  tokenIds = [];

  const links = document.querySelectorAll('.js-seeder-form ul li:not(.hide)');
  links.forEach((el) => {
    const [chip, token] = Array.from(el.querySelectorAll('input'));
    let fieldValid = true;

    // skip empty
    if (!chip.value && !token.value) {
      return;
    }

    if (!chip.value || !ethers.utils.isAddress(chip.value)) {
      chip.classList.add('invalid');
      formValid = false;
      fieldValid = false;
    }
    if (!token.value || parseInt(token.value) < 0) {
      token.classList.add('invalid');
      formValid = false;
      fieldValid = false;
    }

    if (fieldValid) {
      chipAddresses.push(chip.value);
      tokenIds.push(token.value);
    }
  });

  if (!formValid || chipAddresses.length !== tokenIds.length || chipAddresses.length === 0) {
    M.toast({text: 'Invalid input, please check'});
    return;
  }

  const progressBar = document.querySelector('.js-seeder-progress');
  const btn = document.querySelector('.js-seeder-link');
  btn.disabled = true;
  progressBar.classList.remove('hide');

  try {
    const txResult = await eth.seedChipToTokenMapping(chipAddresses, tokenIds, contractAddress);
    // success
    console.debug(txResult);
    M.toast({text: 'Chip addresses linked successfully'});
    document.querySelector('.js-seeder-success').innerHTML =
      `Chip addresses linked successfully! Check the transaction in your wallet for more details.`;
  } catch (e) {
    console.debug(e);
    M.toast({text: 'Transaction error or cancelled by user'});
  }

  btn.disabled = false;
  progressBar.classList.add('hide');
});
