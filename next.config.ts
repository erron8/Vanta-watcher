import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  serverExternalPackages: ['pg'],
  turbopack: { root: process.cwd() },
};

export default nextConfig;
