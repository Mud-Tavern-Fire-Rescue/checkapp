// Applies pending Prisma migrations to the LIVE database. Run this after a
// schema change has been tested on the dev branch and before (or right after)
// merging code that needs it:
//
//   npm run db:migrate:prod
//
// Uses `migrate deploy`, which only applies committed migrations and never
// resets or deletes data.

import { spawnSync } from "node:child_process";

const prod = process.env.PROD_DATABASE_URL;
if (!prod) {
  console.error("PROD_DATABASE_URL is not set in .env.");
  process.exit(1);
}

console.log("Applying migrations to the LIVE database...");
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: prod },
});
process.exit(result.status ?? 1);
