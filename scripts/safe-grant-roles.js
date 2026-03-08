/// @notice Execute 2 pending grantRole transactions FROM the Gnosis Safe
/// The Safe has DEFAULT_ADMIN_ROLE, so it can grant roles to itself
///
/// Usage: node scripts/safe-grant-roles.js
///
/// If threshold > 1, proposes the TX to the Safe Transaction Service
/// so other owners can confirm from app.safe.global

import { ethers } from "ethers";
import "dotenv/config";
import Safe from "@safe-global/protocol-kit";
import { CONTRACTS, getProvider } from "./shared.js";

const SAFE_ADDRESS = "0x362D5267A61f65cb4901B163B5D94adbf147DB87";
const SAFE_TX_SERVICE_URL = "https://safe-transaction-base.safe.global";

const SIGNER_PK = process.env.DEPLOYER_PRIVATE_KEY;

async function proposeToService(protocolKit, safeTx, signer) {
  const safeTxHash = await protocolKit.getTransactionHash(safeTx);
  const signature = await protocolKit.signHash(safeTxHash);
  const signerAddress = await new ethers.Wallet(SIGNER_PK).getAddress();

  // Build the payload for the Safe Transaction Service
  const payload = {
    to: safeTx.data.to,
    value: safeTx.data.value.toString(),
    data: safeTx.data.data,
    operation: safeTx.data.operation,
    safeTxGas: safeTx.data.safeTxGas.toString(),
    baseGas: safeTx.data.baseGas.toString(),
    gasPrice: safeTx.data.gasPrice.toString(),
    gasToken: safeTx.data.gasToken,
    refundReceiver: safeTx.data.refundReceiver,
    nonce: safeTx.data.nonce,
    contractTransactionHash: safeTxHash,
    sender: signerAddress,
    signature: signature.data,
  };

  const url = `${SAFE_TX_SERVICE_URL}/api/v1/safes/${SAFE_ADDRESS}/multisig-transactions/`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (response.ok || response.status === 201) {
    return { success: true, safeTxHash };
  }

  const errorText = await response.text();
  return { success: false, error: errorText, status: response.status };
}

async function main() {
  if (!SIGNER_PK) {
    console.error("DEPLOYER_PRIVATE_KEY required (Safe owner key)");
    process.exit(1);
  }

  const provider = getProvider();
  const rpcUrl = process.env.BASE_RPC_URL;

  console.log("\n=== Safe Self-Grant Roles ===");
  console.log(`  Safe: ${SAFE_ADDRESS}`);

  const protocolKit = await Safe.init({
    provider: rpcUrl,
    signer: SIGNER_PK,
    safeAddress: SAFE_ADDRESS,
  });

  const threshold = await protocolKit.getThreshold();
  const owners = await protocolKit.getOwners();
  console.log(`  Owners: ${owners.length}, Threshold: ${threshold}`);

  const iface = new ethers.Interface([
    "function grantRole(bytes32 role, address account) external",
  ]);

  const riskManagerRole = ethers.keccak256(ethers.toUtf8Bytes("RISK_MANAGER_ROLE"));
  const riskGuardianRole = ethers.keccak256(ethers.toUtf8Bytes("RISK_GUARDIAN_ROLE"));

  const transactions = [
    {
      to: CONTRACTS.ProtocolConfig,
      value: "0",
      data: iface.encodeFunctionData("grantRole", [riskManagerRole, SAFE_ADDRESS]),
    },
    {
      to: CONTRACTS.RiskGuardian,
      value: "0",
      data: iface.encodeFunctionData("grantRole", [riskGuardianRole, SAFE_ADDRESS]),
    },
  ];

  console.log("\n  TX 1: ProtocolConfig.grantRole(RISK_MANAGER_ROLE, Safe)");
  console.log("  TX 2: RiskGuardian.grantRole(RISK_GUARDIAN_ROLE, Safe)");

  const safeTx = await protocolKit.createTransaction({ transactions });
  console.log("\n  Safe transaction created (batch of 2)");

  const signedTx = await protocolKit.signTransaction(safeTx);
  console.log("  Transaction signed");

  if (threshold <= 1) {
    console.log("  Threshold is 1 — executing directly...");
    const result = await protocolKit.executeTransaction(signedTx);
    const receipt = await result.transactionResponse?.wait();
    console.log(`  Executed! tx: ${receipt?.hash || result.hash}`);
  } else {
    console.log(`  Threshold is ${threshold} — proposing to Safe Transaction Service...`);
    const result = await proposeToService(protocolKit, signedTx);
    if (result.success) {
      console.log(`  Proposed! safeTxHash: ${result.safeTxHash}`);
      console.log(`  Go to https://app.safe.global to confirm with another owner.`);
    } else {
      console.log(`  Proposal failed (${result.status}): ${result.error?.slice(0, 200)}`);
      console.log("\n  Manual alternative — paste these in Safe UI (Transaction Builder):");
      console.log(`  TX 1: to=${CONTRACTS.ProtocolConfig}`);
      console.log(`    data=${transactions[0].data}`);
      console.log(`  TX 2: to=${CONTRACTS.RiskGuardian}`);
      console.log(`    data=${transactions[1].data}`);
    }
  }

  // Verify
  console.log("\n  Verifying current state...");
  const configContract = new ethers.Contract(
    CONTRACTS.ProtocolConfig,
    ["function hasRole(bytes32, address) view returns (bool)"],
    provider,
  );
  const guardianContract = new ethers.Contract(
    CONTRACTS.RiskGuardian,
    ["function hasRole(bytes32, address) view returns (bool)"],
    provider,
  );

  const hasRM = await configContract.hasRole(riskManagerRole, SAFE_ADDRESS);
  const hasRG = await guardianContract.hasRole(riskGuardianRole, SAFE_ADDRESS);
  console.log(`  ProtocolConfig.RISK_MANAGER_ROLE: ${hasRM ? "✓" : "✗ (pending confirmation)"}`);
  console.log(`  RiskGuardian.RISK_GUARDIAN_ROLE:  ${hasRG ? "✓" : "✗ (pending confirmation)"}`);

  if (hasRM && hasRG) {
    console.log("\n  All roles complete! Migration 100% done.\n");
  }
}

main().catch(err => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
