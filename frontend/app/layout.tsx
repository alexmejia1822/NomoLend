import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { LanguageProvider } from "@/i18n/context";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { RiskWarningBanner } from "@/components/RiskWarningBanner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "NomoLend — Decentralized P2P Lending on Base",
  description: "Overcollateralized P2P lending protocol on Base. Earn interest or borrow against your crypto assets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-bg-primary text-text-primary`}
        suppressHydrationWarning
      >
        <Providers>
          <LanguageProvider>
            <RiskWarningBanner />
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </main>
              <Footer />
            </div>
          </LanguageProvider>
        </Providers>
      </body>
    </html>
  );
}
