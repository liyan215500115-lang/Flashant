// Vercel ignoreCommand: exit 0 skips the build, exit 1 continues it.
// This branch may build Preview. It must not build Production.

if (process.env.VERCEL_ENV === "production") {
  console.log(
    "Skipping production build. preview/qa-payment-suite is not allowed to deploy to production."
  );
  process.exit(0);
}

process.exit(1);
