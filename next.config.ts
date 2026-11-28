import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // standalone output for Docker self-hosting; default output for Vercel
  ...(!isVercel && { output: "standalone" }),
  outputFileTracingIncludes: {
    "/api/generate": [
      "./assets/fonts/DroidSansFallbackFull.ttf",
      "./assets/fonts/NotoSans-Regular.ttf",
      "./assets/fonts/NotoSans-Bold.ttf",
      "./assets/fonts/NotoSansJP-Regular.ttf",
      "./assets/fonts/NotoSansJP-Bold.ttf",
      "./assets/fonts/NotoSansKR-Regular.ttf",
      "./assets/fonts/NotoSansKR-Bold.ttf",
    ],
  },
  // native pg packages only needed for direct TCP connections (local dev / Docker)
  serverExternalPackages: isVercel
    ? []
    : ["@prisma/adapter-pg", "pg", "pg-connection-string", "pgpass"],
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      { source: "/aup", destination: "/acceptable-use", permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
