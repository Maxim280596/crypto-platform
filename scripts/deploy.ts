import { ethers } from "hardhat";
import { verifyContract } from "./verify";

async function main() {
  const admin = process.env.DEFAULT_ADMIN_ADDRESS
    ? process.env.DEFAULT_ADMIN_ADDRESS
    : ethers.constants.AddressZero;
  const feeReceiver = process.env.FEE_RECEIVER_ADDRESS
    ? process.env.FEE_RECEIVER_ADDRESS
    : ethers.constants.AddressZero;
  const feePercent = process.env.FEE ? process.env.FEE : "500";

  if (admin === ethers.constants.AddressZero) {
    throw new Error("DEFAULT_ADMIN_ADDRESS is not set");
  }
  if (feeReceiver === ethers.constants.AddressZero) {
    throw new Error("FEE_RECEIVER_ADDRESS is not set");
  }

  const CRYPTO_PLATFORM_FACTORY = await ethers.getContractFactory(
    "CryptoPlatform"
  );
  console.log("Deploying CryptoPlatform...");
  const cryptoPlatform = await CRYPTO_PLATFORM_FACTORY.deploy(
    admin,
    feeReceiver,
    feePercent
  );
  await cryptoPlatform.deployTransaction.wait(5);
  console.log(
    `CryptoPlatform deployed to: ${
      cryptoPlatform.address
    }, at ${new Date().toLocaleString()} `
  );

  try {
    await verifyContract(cryptoPlatform.address, [
      admin,
      feeReceiver,
      feePercent,
    ]);
  } catch (error) {
    console.log(error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
