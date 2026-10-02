@AGENTS.md

# CheckApp: Equipment Checks

Weekly truck and equipment check app for Mud Tavern Volunteer Fire and Rescue (MTVFR). Firefighters record checks; officers review results and are alerted when something fails. Authorized users will reach it from the department website (mudtavernfire.org, a separate repo).

## Requirements

- Firefighters run weekly checks on apparatus (trucks) and standalone equipment (e.g. SCBA units) against a checklist.
- Every check records who did it and the date and time.
- Results are consolidated for officers to review.
- A failed check sends an alert to the officers.
- Sign-in through Google (Microsoft was considered; Google was chosen).

## Roles

- `MEMBER`: runs checks.
- `OFFICER`: everything a member can do, plus `/officer` and `/admin` routes.
- Role and `isActive` live on `User` in the database, not in code. Deactivated users can't sign in.
- Department officers: Richard Ennis (Chief), Brandon Adams (Deputy), Andrew Joseph (Fire Captain), Mike Russell (EMS Captain). The display list is `src/lib/officers.ts`; it does not grant access.

## Stack

- Next.js 16 (App Router), React 19, Tailwind 4, TypeScript. Read `node_modules/next/dist/docs/` before using Next APIs (see AGENTS.md).
- Postgres on Neon, via Prisma **6**. Do not upgrade to Prisma 7: `@auth/prisma-adapter` doesn't support it yet.
- Auth.js (next-auth v5 beta) with the Prisma adapter and **database sessions**, so role changes take effect immediately. Middleware runs on the Node.js runtime for this reason.
- Email alerts via nodemailer over SMTP. Locally, `npm run mail:dev` starts maildev to catch mail (no Docker on this Mac).
- Node is installed with nvm (no Homebrew Node).

## Sign-in rules (`src/auth.ts`)

- Google accounts only, restricted to `WORKSPACE_DOMAIN` (fails closed if unset).
- `DEV_ALLOW_ANY_DOMAIN=true` allows personal Gmail locally. Never set it in production.
- Users are pre-created (seeded) and matched to their Google account by email on first sign-in.

## Data model (`prisma/schema.prisma`)

- `Apparatus` (trucks) and `EquipmentItem` (optionally assigned to an apparatus).
- `ChecklistTemplate` belongs to exactly one apparatus **or** one equipment item (enforced in app code with Zod, not the DB), with ordered `ChecklistItem`s.
- `CheckSubmission`: one completed check, with `submittedBy`, `submittedAt`, `overallStatus` (PASS/FAIL), notes, and per-item `CheckItemResult` (PASS/FAIL/NA). Apparatus/equipment IDs are copied onto the submission for fast filtering.
- `FailureAlert`: one row per alert email attempt (recipients, status, attempts, last error) for auditing and retries.
- Prefer deactivating (`isActive = false`) over deleting, so past check history stays intact.

## Commands

- `npm run dev`: dev server
- `npm run build`, `npm run lint`, `npx tsc --noEmit`: verify before committing
- `npx prisma migrate dev --name <name>`: schema changes (runs against Neon)
- `npm run db:seed`: seed users, apparatus, and checklists

## Secrets

`.env` is gitignored and holds the database URL, Auth.js, Google OAuth, and SMTP settings. Never commit it or print its values.

## Status

Done:
- Database schema, first migration, seed data (Engine 1, Ladder 2, SCBA Unit 4 with checklists)
- Google sign-in, route protection, sign-in page
- Site header with sign-out
- `/officer` page: officer roster and recent failed checks

To do:
- `/checks`: pick an apparatus or item and complete its checklist (members land here after sign-in)
- Save submissions and send failure alerts to officers (write `FailureAlert` rows)
- Officer review: filter and browse all checks, not just recent failures
- `/admin`: manage users, apparatus, equipment, and checklists
- Seed the real officers once their Google account emails are known
- Rename `src/middleware.ts` to `src/proxy.ts` (Next 16 deprecation)
- Hosting, and linking from mudtavernfire.org

## Working rules

- Use a branch per feature; don't commit straight to `main`.
- Never put incident or patient details in check notes or sample data.
- Add new use cases to the Requirements and Status sections above as they come up.
