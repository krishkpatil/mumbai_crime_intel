import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",   // enables slim Docker image via .next/standalone
};

export default nextConfig;
