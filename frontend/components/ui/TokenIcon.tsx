"use client";

import { useState } from "react";
import clsx from "clsx";

const TOKEN_IMAGES: Record<string, string> = {
  WETH: "/tokens/weth.png",
  cbETH: "/tokens/cbeth.png",
  DAI: "/tokens/dai.png",
  USDbC: "/tokens/usdbc.png",
  USDC: "/tokens/usdc.png",
  LINK: "/tokens/link.png",
  UNI: "/tokens/uni.png",
  CYPR: "/tokens/cypr.png",
  REI: "/tokens/rei.png",
  AVNT: "/tokens/avnt.png",
  GHST: "/tokens/ghst.png",
  VFY: "/tokens/vfy.png",
  ZRO: "/tokens/zro.png",
  TIG: "/tokens/tig.png",
  BID: "/tokens/bid.png",
  MAMO: "/tokens/mamo.png",
  GIZA: "/tokens/giza.png",
  MOCA: "/tokens/moca.png",
  AVAIL: "/tokens/avail.png",
  KTA: "/tokens/kta.png",
  BRETT: "/tokens/brett.png",
  VIRTUAL: "/tokens/virtual.png",
};

const TOKEN_COLORS: Record<string, string> = {
  WETH: "from-blue-500 to-blue-700",
  cbETH: "from-blue-400 to-indigo-600",
  DAI: "from-yellow-400 to-yellow-600",
  USDbC: "from-blue-400 to-blue-600",
  USDC: "from-blue-400 to-blue-600",
  LINK: "from-blue-500 to-blue-800",
  UNI: "from-pink-400 to-pink-600",
  CYPR: "from-purple-400 to-purple-700",
  REI: "from-cyan-400 to-cyan-600",
  AVNT: "from-orange-400 to-orange-600",
  GHST: "from-violet-400 to-violet-700",
  VFY: "from-green-400 to-green-600",
  ZRO: "from-indigo-400 to-indigo-700",
  TIG: "from-amber-400 to-amber-600",
  BID: "from-rose-400 to-rose-600",
  MAMO: "from-lime-400 to-lime-600",
  GIZA: "from-yellow-500 to-orange-600",
  MOCA: "from-sky-400 to-sky-600",
  AVAIL: "from-teal-400 to-teal-600",
  KTA: "from-emerald-400 to-emerald-600",
  BRETT: "from-blue-400 to-blue-700",
  VIRTUAL: "from-purple-500 to-pink-600",
};

const sizeMap = {
  sm: { container: "w-6 h-6", text: "text-[10px]", img: 24 },
  md: { container: "w-8 h-8", text: "text-xs", img: 32 },
  lg: { container: "w-10 h-10", text: "text-sm", img: 40 },
};

type TokenIconProps = {
  symbol: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function TokenIcon({ symbol, size = "md", className }: TokenIconProps) {
  const [imgError, setImgError] = useState(false);
  const src = TOKEN_IMAGES[symbol];
  const s = sizeMap[size];

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={symbol}
        width={s.img}
        height={s.img}
        onError={() => setImgError(true)}
        className={clsx("rounded-full object-cover", s.container, className)}
      />
    );
  }

  const colors = TOKEN_COLORS[symbol] || "from-gray-400 to-gray-600";
  return (
    <div
      className={clsx(
        "rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white",
        colors,
        s.container,
        s.text,
        className
      )}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}
