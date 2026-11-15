// Build used by Vercel for this branch only.
// Production deployments of this branch are refused. Preview builds compile
// the app and do not run `prisma db push` (that command can rewrite whatever
// DATABASE_URL the deployment inherited).

import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
  console.error(
    "REFUSING production deploy from preview/qa-payment-suite. Production stays frozen. Do not promote this branch."
  );
  process.exit(1);
}

console.log(
  `Flashant preview build (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}). Skipping prisma db push.`
);

execSync("prisma generate", { stdio: "inherit" });
execSync("next build", { stdio: "inherit" });
