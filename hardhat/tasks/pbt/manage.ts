import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import type { ESP5791 } from "../../types/contracts/PBT/ESP5791";

task("seed", "adds chipAddress=>tokenId mappings")
  .addParam("address", "The token contract address")
  .addParam("chips", "Comma-separated list of chip addresses, e.g. '0x0123,0x0234,0x0345'")
  .addParam("tokenids", "Comma-separated list of token ids, e.g. '1,2,3'")
  .setAction(async function (tArgs: TaskArguments, { ethers }) {
    const signers: SignerWithAddress[] = await ethers.getSigners();

    const tokenContract: ESP5791 = <ESP5791>await ethers.getContractAt("ESP5791", tArgs.address, signers[0]);

    const chipAddresses = tArgs.chips.split(",").map((address: string) => address.trim());
    const tokenIds = tArgs.tokenids.split(",").map((id: string) => parseInt(id.trim(), 10));

    if (
      !chipAddresses ||
      !chipAddresses.length ||
      !tokenIds ||
      !tokenIds.length ||
      chipAddresses.length !== tokenIds.length
    ) {
      throw "Input error, no arguments or length mismatch";
    }

    console.table([chipAddresses, tokenIds]);

    const tx = await tokenContract.seedChipToTokenMapping(chipAddresses, tokenIds);
    console.log("Tx submitted, waiting for confirmation...");
    await tx.wait();

    console.log("Chip addresses seeded successfully!");
  });

task("update", "remaps chipAddresses (old=>new)")
  .addParam("address", "The token contract address")
  .addParam("oldchips", "Comma-separated list of chip addresses, e.g. '0x0123,0x0234,0x0345'")
  .addParam("newchips", "Comma-separated list of chip addresses to replace the old ones")
  .setAction(async function (tArgs: TaskArguments, { ethers }) {
    const signers: SignerWithAddress[] = await ethers.getSigners();

    const tokenContract: ESP5791 = <ESP5791>await ethers.getContractAt("ESP5791", tArgs.address, signers[0]);

    const oldChips = tArgs.oldchips.split(",").map((address: string) => address.trim());
    const newChips = tArgs.newchips.split(",").map((address: string) => address.trim());

    if (!oldChips || !oldChips.length || !newChips || !newChips.length || oldChips.length !== newChips.length) {
      throw "Input error, no arguments or length mismatch";
    }

    console.table([oldChips, newChips]);

    const tx = await tokenContract.updateChips(oldChips, newChips);

    console.log("Tx submitted, waiting for confirmation...");
    await tx.wait();
    console.log("Chip addresses updated successfully!");
  });

task("admin", "adds a new admin to the token contract")
  .addParam("address", "The token contract address")
  .addParam("admin", "Address of new (additional) contract admin")
  .setAction(async function (tArgs: TaskArguments, { ethers }) {
    const signers: SignerWithAddress[] = await ethers.getSigners();

    const tokenContract: ESP5791 = <ESP5791>await ethers.getContractAt("ESP5791", tArgs.address, signers[0]);

    const adminRole = await tokenContract.DEFAULT_ADMIN_ROLE();
    const tx = await tokenContract.grantRole(adminRole, tArgs.admin);

    console.log("Tx submitted, waiting for confirmation...");
    await tx.wait();
    console.log("New admin set successfully!", tArgs.admin);
  });

task("uri", "updates the token metadata uri")
  .addParam("address", "The token contract address")
  .addParam("uri", "The new metadata uri")
  .setAction(async function (tArgs: TaskArguments, { ethers }) {
    const signers: SignerWithAddress[] = await ethers.getSigners();

    const tokenContract: ESP5791 = <ESP5791>await ethers.getContractAt("ESP5791", tArgs.address, signers[0]);

    const tx = await tokenContract.setBaseURI(tArgs.uri);

    console.log("Tx submitted, waiting for confirmation...");
    await tx.wait();
    console.log("New uri set successfully!", tArgs.uri);
  });

task("token", "get mapped token data for chip address")
  .addParam("address", "The token contract address")
  .addParam("chip", "The mapped chip address")
  .setAction(async function (tArgs: TaskArguments, { ethers }) {
    const signers: SignerWithAddress[] = await ethers.getSigners();

    const tokenContract: ESP5791 = <ESP5791>await ethers.getContractAt("ESP5791", tArgs.address, signers[0]);

    const data = await tokenContract.getTokenData(tArgs.chip);

    console.log(`Retrieved data for ${tArgs.chip}:`, JSON.stringify(data));
  });

task("transfer", "get mapped token data for chip address")
  .addParam("address", "The token contract address")
  .addParam("signature", "The signature hex-string from the chip")
  .addParam("block", "The block number used in the signature")
  .setAction(async function (tArgs: TaskArguments, { ethers }) {
    const signers: SignerWithAddress[] = await ethers.getSigners();

    const tokenContract: ESP5791 = <ESP5791>await ethers.getContractAt("ESP5791", tArgs.address, signers[0]);

    const tx = await tokenContract["transferTokenWithChip(bytes,uint256,bool)"](tArgs.signature, tArgs.block, true);

    console.log("Tx submitted, waiting for confirmation...");
    await tx.wait();
    console.log("Token transferred successfully!", tArgs.uri);
  });
