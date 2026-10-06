import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import { WalletLabelsProvider } from './wallet-labels';

export const metadata: Metadata = {
  title: "Supir | Meteora wallet research",
  description: "Explore Meteora wallet performance, daily P&L, and your own wallet shortlist.",
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
