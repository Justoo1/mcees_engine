import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained ./.next/standalone build for Docker:
  // a minimal server.js + only the node_modules it actually needs.
  output: "standalone",
};

export default nextConfig;
