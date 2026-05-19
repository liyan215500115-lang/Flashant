import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "pg-connection-string", "pgpass"],
  turbopack: {
    root: __dirname,
  },
};

export default withNextIntl(nextConfig);
