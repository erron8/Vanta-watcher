import type { Metadata } from "next";
import "./globals.css";
import { WalletLabelsProvider } from './wallet-labels';

export const metadata: Metadata = {
  title: "Meteora Wallet Screener",
  description: "Persistent wallet performance screening for Meteora portfolios.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><WalletLabelsProvider>{children}</WalletLabelsProvider></body>
    </html>
  );
}
