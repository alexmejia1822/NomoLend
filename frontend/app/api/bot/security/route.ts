import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { CONTRACTS } from "@/lib/contracts";

const client = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
});

const DEPLOYER_WALLET = "0x9ce3F036365DfAf608D5F98B34A5872bbe5Ee125" as `0x${string}`;
const SAFE_ADDRESS = "0x362D5267A61f65cb4901B163B5D94adbf147DB87" as `0x${string}`;

const AccessControlABI = [
  { inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], name: "hasRole", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "DEFAULT_ADMIN_ROLE", outputs: [{ type: "bytes32" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "ADMIN_ROLE", outputs: [{ type: "bytes32" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "RISK_MANAGER_ROLE", outputs: [{ type: "bytes32" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "PRICE_UPDATER_ROLE", outputs: [{ type: "bytes32" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "LIQUIDATOR_ROLE", outputs: [{ type: "bytes32" }], stateMutability: "view", type: "function" },
] as const;

type ContractRoleConfig = {
  name: string;
  address: `0x${string}`;
  roles: string[]; // function names for role getters
};

const CONTRACT_ROLES: ContractRoleConfig[] = [
  {
    name: "ProtocolConfig",
    address: CONTRACTS.ProtocolConfig,
    roles: ["DEFAULT_ADMIN_ROLE", "ADMIN_ROLE"],
  },
  {
    name: "PriceOracle",
    address: CONTRACTS.PriceOracle,
    roles: ["DEFAULT_ADMIN_ROLE", "PRICE_UPDATER_ROLE"],
  },
  {
    name: "RiskEngine",
    address: CONTRACTS.RiskEngine,
    roles: ["DEFAULT_ADMIN_ROLE", "RISK_MANAGER_ROLE"],
  },
  {
    name: "LoanManager",
    address: CONTRACTS.LoanManager,
    roles: ["DEFAULT_ADMIN_ROLE", "LIQUIDATOR_ROLE"],
  },
];

async function checkRole(
  contractAddress: `0x${string}`,
  roleFnName: string,
  account: `0x${string}`,
): Promise<{ hasRole: boolean; error?: string }> {
  try {
    const roleHash = await client.readContract({
      address: contractAddress,
      abi: AccessControlABI,
      functionName: roleFnName as "DEFAULT_ADMIN_ROLE" | "ADMIN_ROLE" | "RISK_MANAGER_ROLE" | "PRICE_UPDATER_ROLE" | "LIQUIDATOR_ROLE",
    });

    const has = await client.readContract({
      address: contractAddress,
      abi: AccessControlABI,
      functionName: "hasRole",
      args: [roleHash, account],
    });

    return { hasRole: has };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Role might not exist on this contract
    return { hasRole: false, error: message.slice(0, 120) };
  }
}

export async function GET() {
  try {
    const results = [];

    for (const contract of CONTRACT_ROLES) {
      const contractResult: {
        name: string;
        address: string;
        roles: { role: string; deployer: boolean; deployerError?: string; safe: boolean; safeError?: string }[];
      } = {
        name: contract.name,
        address: contract.address,
        roles: [],
      };

      for (const roleFn of contract.roles) {
        const [deployerCheck, safeCheck] = await Promise.all([
          checkRole(contract.address, roleFn, DEPLOYER_WALLET),
          checkRole(contract.address, roleFn, SAFE_ADDRESS),
        ]);

        contractResult.roles.push({
          role: roleFn.replace("_ROLE", "").replace("DEFAULT_ADMIN", "DEFAULT_ADMIN"),
          deployer: deployerCheck.hasRole,
          deployerError: deployerCheck.error,
          safe: safeCheck.hasRole,
          safeError: safeCheck.error,
        });
      }

      results.push(contractResult);
    }

    return NextResponse.json({
      deployerWallet: DEPLOYER_WALLET,
      safeAddress: SAFE_ADDRESS,
      contracts: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
