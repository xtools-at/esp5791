import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import type { ESP5791 } from "../../types/contracts/PBT/ESP5791";
import type { ESP5791__factory } from "../../types/factories/contracts/PBT/ESP5791__factory";

task("deploy", "deploys the demo PBT contract which simply assigns a token to each address")
  .addParam("name", "The token name")
  .addParam("symbol", "The token symbol")
  .addParam("uri", "The token metadata base uri")
  .addParam("contract", "The solidity contract's name (MyPBT by default)", "MyPBT")
  .setAction(async function (tArgs: TaskArguments, { ethers }) {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const tokenFactory: ESP5791__factory = <ESP5791__factory>await ethers.getContractFactory(tArgs.contract);
    const tokenContract: ESP5791 = <ESP5791>await tokenFactory.connect(signers[0]).deploy(tArgs.name, tArgs.symbol, tArgs.uri);
    await tokenContract.deployed();
    console.log("Token contract deployed to: ", tokenContract.address);
  });

