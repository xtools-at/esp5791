# ESP5791 Smart Contracts

Ready-to-deploy PBT contract based on [Chiru Labs' PBT implementation](https://github.com/chiru-labs/PBT) and
[OpenZeppelin's ERC721 NFT contracts](https://github.com/OpenZeppelin/openzeppelin-contracts).

Also check out our [demo contract on Etherscan](https://goerli.etherscan.io/token/0xfad7eab70ed7569aa54afd7b11bb376d948b2665);

## Quickstart

- switch to `hardhat` directory: `cd hardhat`
- install dependencies: `yarn`
- copy `.env.example` to `.env` and put your own values in
- compile contracts: `yarn compile`
- deploy contract: `yarn deploy --network goerli --name "My Token" --symbol "ABC" --uri "https://example.com/path-to-token-metadata/"`
  - if you've changed the contract name, you also need to pass in `--contract MyCustomContract`
  - use your desired network instead of `goerli`. Check `hardhat.config.ts` for all network keys
- (recommended) verify contract source code on Etherscan: `yarn verify --network goerli YOUR_CONTRACT_ADDRESS "My Token" "ABC" "https://example.com/path-to-token-metadata/"`
  - you need to use the _exact_ same input as when deploying here
- TODO: seed chip addresses (no script yet)

## Interact with contract

- call `seedChipToTokenMapping(address[] chipAddresses, uint256[] tokenIds)` to link chips to token ids
- call `updateChips(address[] chipAddressesOld, address[] chipAddressesNew)` to "replace" defective chips
- call `getTokenData(address chipAddress)` to get data about a chip/token mapping
- call `transferTokenWithChip(bytes signatureFromChip, uint256 blockNumberUsedInSig)` to transfer or mint a token with a
  chip signature

## Notes

Hardhat dev environment based on [PaulRBerg's Hardhat Template](https://github.com/paulrberg/hardhat-template), refer to
that repo's README for specific questions on how to use the tools.

## License

MIT

Copyright © 2023 [@xtools-at](https://github.com/xtools-at)

## Disclaimer

> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
> WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
> COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
> OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
