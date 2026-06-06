import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // DIRECT_URL takes precedence for connection pooling (Supabase pooler, PgBouncer).
  // Falls back to DATABASE_URL for direct connections (local dev with embedded PG).
  const connectionString =
    process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // PgBouncer transaction mode doesn't support prepared statements.
  // Add pgbouncer=true when using a pooler (port 6543 or explicit param).
  const url = new URL(connectionString);
  const needsPgbouncer =
    url.port === "6543" || connectionString.includes("pgbouncer=true");
  if (needsPgbouncer && !url.searchParams.has("pgbouncer")) {
    url.searchParams.set("pgbouncer", "true");
  }

  const adapter = new PrismaPg({ connectionString: url.toString() });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
