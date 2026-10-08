import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./palette.css";
import "./login.css";
import { WalletLabelsProvider } from './wallet-labels';

export const metadata: Metadata = {
  title: "Vanta | Meteora wallet research",
  description: "Explore Meteora wallet performance, daily P&L, and your own wallet shortlist.",
  icons: {
    icon: "/favicon.svg?v=2",
    shortcut: "/favicon.svg?v=2",
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
