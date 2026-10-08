import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pg'],
  turbopack: { root: process.cwd() },
};

export default nextConfig;
