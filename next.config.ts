import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo root para resolver correctamente los módulos
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
