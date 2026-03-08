import { formatUnits } from "viem";

export function formatUsdc(amount: bigint): string {
  return parseFloat(formatUnits(amount, 6)).toLocaleString("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatToken(amount: bigint, decimals: number = 18): string {
  return parseFloat(formatUnits(amount, decimals)).toLocaleString("es-CO", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getDurationLabel(duration: number): string {
  const map: Record<number, string> = {
    0: "7 days",
    1: "14 days",
    2: "30 days",
  };
  return map[duration] || "Unknown";
}

export function getInterestLabel(duration: number): string {
  const map: Record<number, string> = {
    0: "2%",
    1: "4%",
    2: "8%",
  };
  return map[duration] || "?%";
}

export function getStatusColor(status: number, type: "loan" | "order"): string {
  if (type === "loan") {
    const colors: Record<number, string> = {
      0: "text-green-400", // Active
      1: "text-blue-400",  // Repaid
      2: "text-red-400",   // Liquidated
      3: "text-gray-400",  // Expired
    };
    return colors[status] || "text-gray-400";
  }
  const colors: Record<number, string> = {
    0: "text-green-400", // Open
    1: "text-blue-400",  // Filled
    2: "text-gray-400",  // Cancelled
  };
  return colors[status] || "text-gray-400";
}

export function getHealthColor(healthFactor: bigint): string {
  const hf = Number(healthFactor);
  if (hf >= 15000) return "text-green-400";
  if (hf >= 12000) return "text-yellow-400";
  if (hf >= 10000) return "text-orange-400";
  return "text-red-400";
}
