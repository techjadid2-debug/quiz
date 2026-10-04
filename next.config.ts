import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O'z serverimizda `node server.js` bilan ishga tushirish uchun (deploy/deploy.sh).
  output: "standalone",
};

export default nextConfig;
