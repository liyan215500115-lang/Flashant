/**
 * Cleanup expired GeneratedImage records that have external URLs (not R2 keys).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const url = new URL(connectionString);
if (url.port === "6543" || connectionString.includes("pgbouncer=true")) {
  if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
}

const adapter = new PrismaPg({ connectionString: url.toString() });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Finding expired generated images...");

  const expired = await db.generatedImage.findMany({
    where: {
      status: "SUCCEEDED",
      NOT: { s3Key: { startsWith: "generated/" } },
    },
    select: { id: true, s3Key: true, imageProjectId: true },
  });

  if (expired.length === 0) {
    console.log("✅ No expired images found.");
    await db.$disconnect();
    return;
  }

  console.log(`🗑  Found ${expired.length} expired images (external URLs, likely broken):`);
  for (const img of expired) {
    const preview = img.s3Key.length > 80 ? img.s3Key.substring(0, 80) + "..." : img.s3Key;
    console.log(`   ${img.id} → ${preview}`);
  }

  const ids = expired.map((i) => i.id);
  const result = await db.generatedImage.deleteMany({ where: { id: { in: ids } } });
  console.log(`✅ Deleted ${result.count} expired images.`);

  // Reset project statuses
  const projectIds = [...new Set(expired.map((i) => i.imageProjectId))];
  for (const pid of projectIds) {
    const remaining = await db.generatedImage.count({
      where: { imageProjectId: pid, status: "SUCCEEDED" },
    });
    if (remaining === 0) {
      const pending = await db.generatedImage.count({
        where: { imageProjectId: pid, status: { in: ["PENDING", "PROCESSING"] } },
      });
      await db.imageProject.update({
        where: { id: pid },
        data: { status: pending > 0 ? "GENERATING" : "DRAFT" },
      });
    }
  }

  await db.$disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
