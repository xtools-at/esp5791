const BLE_DEBUG = false;
const UUID_SERVICE = 0x5791;
const UUID_READ_PUBKEY = 0xA001;
const UUID_READ_ADDRESS = 0xA002;
const UUID_INPUT_MESSAGE = 0xB001;
const UUID_INPUT_HASHED_MESSAGE = 0xB002;
const UUID_OUTPUT_SIGNATURE = 0xC001;
const UUID_OUTPUT_SIGNED_MESSAGE_HASH = 0xC002;

const wait = (ms) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

class EspBLE {
  EVENT_BLE_VALUE_CHANGED = 'characteristicvaluechanged';
  EVENT_BLE_DEVICE_DISCONNECTED = 'gattserverdisconnected';
  encoder = new TextEncoder('utf-8');
  decoder = new TextDecoder('utf-8');

  constructor(uuidService) {
    this.device = null;
    this.uuidService = uuidService;
    this.onDisconnected = this.onDisconnected.bind(this);
  }

  encode(data) {
    return this.encoder.encode(data);
  }

  decode(data) {
    return this.decoder.decode(data);
  }

  async requestDevices() {
    let options = {
      filters: BLE_DEBUG ? undefined : [{
        services: [this.uuidService]
      }],
      acceptAllDevices: BLE_DEBUG ? true : undefined,
      optionalServices: [this.uuidService],
    };
    try {
      this.device = await navigator.bluetooth.requestDevice(options);
      if (!this.device) {
        throw "No device selected";
      }
      this.device.addEventListener(this.EVENT_BLE_DEVICE_DISCONNECTED, this.onDisconnected);
    } catch (e) {
      console.debug(e);
    }
  }

  async connect() {
    await this.requestDevices();

    if (!this.device) {
      return Promise.reject('Device is not connected.');
    }
    await this.device.gatt.connect();
  }

  async read(uuidCharacteristic) {
    const service = await this.device.gatt.getPrimaryService(this.uuidService);
    const characteristic = await service.getCharacteristic(uuidCharacteristic);
    const response = await characteristic.readValue();

    return this.decode(response);
  }

  async write(uuidCharacteristic, data) {
    const service = await this.device.gatt.getPrimaryService(this.uuidService);
    const characteristic = await service.getCharacteristic(uuidCharacteristic);

    return characteristic.writeValueWithResponse(this.encode(data));
  }

  async startNotifications(uuidCharacteristic, listener) {
    const service = await this.device.gatt.getPrimaryService(this.uuidService);
    const characteristic = await service.getCharacteristic(uuidCharacteristic);
    await characteristic.startNotifications();
    characteristic.addEventListener(this.EVENT_BLE_VALUE_CHANGED, listener);
  }

  async stopNotifications(uuidCharacteristic, listener) {
    const service = await this.device.gatt.getPrimaryService(this.uuidService);
    const characteristic = await service.getCharacteristic(uuidCharacteristic);
    await characteristic.stopNotifications();
    characteristic.removeEventListener(this.EVENT_BLE_VALUE_CHANGED, listener);
  }

  disconnect() {
    if (!this.device) {
      return Promise.reject('Device is not connected.');
    }
    return this.device.gatt.disconnect();
  }

  onDisconnected() {
    console.debug('Device is disconnected.');
    this.device.removeEventListener(this.EVENT_BLE_DEVICE_DISCONNECTED, this.onDisconnected);
  }
}
