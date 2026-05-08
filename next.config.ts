import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "pg-connection-string", "pgpass"],
};

export default nextConfig;
