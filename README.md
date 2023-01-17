# ESP5791

Physical Backed Tokens ([EIP-5791](https://eips.ethereum.org/EIPS/eip-5791)) for everyone using ESP32 and BLE

## Monorepo folder structure

- `Arduino` contains the microcontroller firmware and tweaked libraries to be used with Arduino IDE
- `hardhat` contains Solidity smart contracts implementing EIP-5791, based on the [PBT](https://github.com/chiru-labs/PBT) project

## _Make_ a PBT - the hardware side

### Requirements

- [Arduino IDE](https://docs.arduino.cc/software/ide-v1) Desktop App
- [esptool.py](https://github.com/espressif/esptool)
- ESP32 Dev board + USB cable

### Arduino IDE: Setup

- Go to `Tools > Board > Boards Manager`, search for and install **esp32** board definitions
- Symlink or copy libraries and sketch from the repo to the Arduino sketch folder

```bash
# example for symlinking on macOS
ln -s ~/path_to_repo/esp5791/Arduino/libraries/Web3E ~/Documents/Arduino/libraries/Web3E
ln -s ~/path_to_repo/esp5791/Arduino/libraries/NimBLE-Arduino ~/Documents/Arduino/libraries/NimBLE-Arduino
ln -s ~/path_to_repo/esp5791/Arduino/ESP5791 ~/Documents/Arduino/ESP5791
```

(Please use the libs included in the repo. You can find the original libs here for reference: [Web3E](https://github.com/AlphaWallet/Web3E) / [NimBLE](https://github.com/h2zero/NimBLE-Arduino])

### Arduino IDE: Flash firmware

- Connect ESP32 Dev board, choose correct settings in `Tools > Board` and `Tools > Port` for your setup
- Click _Upload_ to compile and flash the firmware
  - Depending on your ESP32 board, you may have to hold down the _boot_ button while flashing or you'll get an error
- On first boot, the ESP32 securely generates a random private key itself, and stores it in flash memory

### esptool.py: encrypt and secure chip using eFuses

!! Danger zone: this may brick your device !! changes done here are not reversible, thread carefully !!

- Read [ESP32 eFuse basics](https://blog.espressif.com/understanding-esp32s-security-features-14483e465724) first
- Enable [Flash encryption](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/security/flash-encryption.html).
  - For ESP32v3 chips and newer, also disable [UART ROM download mode](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/security/flash-encryption.html#enabling-uart-bootloader-encryption-decryption) here permanently
  - Be aware of the differences between _Development_ vs. _Release_ modes or you may brick your board
- Enable [Secure Boot V2](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/security/secure-boot-v2.html) (or [V1](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/security/secure-boot-v1.html) on older chips). This also disables JTAG access

## _Deploy_ your PBT - the smart contract

See the README in the `hardhat` directory.

## Thanks to

- The authors of [EIP-5791](https://eips.ethereum.org/EIPS/eip-5791)
- [Chiru Labs](https://github.com/chiru-labs) for the [PBT](https://github.com/chiru-labs/PBT) smart contract reference implementation
- [Espressif Systems](https://github.com/espressif) for all the ESP tooling
- [Firefly Wallet](https://github.com/firefly/wallet) for the inspiration
- [AlphaWallet](https://github.com/AlphaWallet) for the [Web3E](https://github.com/AlphaWallet/Web3E) ESP32 Ethereum lib (includes the [trezor-crypto](https://github.com/trezor/trezor-firmware/tree/master/crypto) lib)
- [Mbed TLS](https://github.com/Mbed-TLS/mbedtls) (cryptographic lib for embedded systems)
- [NimBLE](https://github.com/h2zero/NimBLE-Arduino) (lightweight BLE lib for Arduino/ESP32)

## License

MIT
Copyright © 2023 [@xtools-at](https://github.com/xtools-at)

## Disclaimer

> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
