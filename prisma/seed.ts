import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const existing = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  if (existing) {
    console.log("Admin user already exists, skipping seed.");
    await prisma.$disconnect();
    return;
  }

  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      username: "admin",
      password: hashed,
      role: "admin",
    },
  });

  console.log("Seed complete: admin user created.");
  console.log(`  Username: admin`);
  console.log(`  Password: ${password === "admin123" ? "admin123 (change via ADMIN_PASSWORD env)" : "(from ADMIN_PASSWORD)"}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
