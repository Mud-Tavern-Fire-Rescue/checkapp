// Runs before `npm run dev` and says which database local development is
// using, so testing doesn't accidentally change live data.

const local = process.env.DATABASE_URL ?? "";
const prod = process.env.PROD_DATABASE_URL ?? "";

function host(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "(not set)";
  }
}

if (!local) {
  console.error("DATABASE_URL is not set in .env.");
  process.exit(1);
}

if (prod && local === prod) {
  console.warn(
    [
      "",
      "WARNING: local development is using the LIVE database.",
      "Anything you create or change here appears on checks.mudtavernfire.org.",
      'Set DATABASE_URL in .env to the Neon "dev" branch connection string.',
      "",
    ].join("\n"),
  );
} else {
  console.log(`Local development database: ${host(local)} (not the live database)`);
}
