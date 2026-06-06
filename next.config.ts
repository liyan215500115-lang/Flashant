import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // standalone output for Docker self-hosting; default output for Vercel
  ...(!isVercel && { output: "standalone" }),
  // native pg packages only needed for direct TCP connections (local dev / Docker)
  serverExternalPackages: isVercel
    ? []
    : ["@prisma/adapter-pg", "pg", "pg-connection-string", "pgpass"],
  turbopack: {
    root: __dirname,
  },
};

export default withNextIntl(nextConfig);
