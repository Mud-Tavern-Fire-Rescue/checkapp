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
- Auth.js (next-auth v5 beta) with the Prisma adapter and **database sessions**, so role changes take effect immediately. The proxy (`src/proxy.ts`, formerly middleware) runs on Node.js, which this needs.
- Email alerts via nodemailer over SMTP. Locally, `npm run mail:dev` starts maildev to catch mail (no Docker on this Mac).
- Node is installed with nvm (no Homebrew Node).

## Sign-in rules (`src/auth.ts`)

- Google accounts only. Only people an officer has added in Admin > People (active, Google-verified email) can sign in; everyone else gets "Access denied." No one is created automatically.
- New people are matched to their Google account by email on first sign-in.
- While the Google OAuth app is in Testing mode, each person must also be a test user in Google Cloud.

## Data model (`prisma/schema.prisma`)

- `Apparatus` (trucks) and `EquipmentItem` (optionally assigned to an apparatus).
- `ChecklistTemplate` belongs to exactly one apparatus **or** one equipment item (enforced in app code with Zod, not the DB), with ordered `ChecklistItem`s.
- `CheckSubmission`: one completed check, with `submittedBy`, `submittedAt`, `overallStatus` (PASS/FAIL), notes, and per-item `CheckItemResult` (PASS/FAIL/NA). Apparatus/equipment IDs are copied onto the submission for fast filtering.
- `FailureAlert`: one row per alert email attempt (recipients, status, attempts, last error) for auditing and retries.
- Prefer deactivating (`isActive = false`) over deleting, so past check history stays intact.

## Commands

- `.claude/launch.json` defines `dev` (port 3000) and `maildev` (web UI on port 1080, SMTP on 1025)
- `npm run dev`: dev server
- `npm run build`, `npm run lint`, `npx tsc --noEmit`: verify before committing
- `npx prisma migrate dev --name <name>`: schema changes (runs against Neon)
- `npm run db:seed`: seed apparatus and checklists, plus the first officer from `SEED_OFFICER_EMAIL` / `SEED_OFFICER_NAME` in `.env`

## Hosting

- Live at https://checks.mudtavernfire.org (Vercel Hobby, project `checkapp`; also `checkapp-eight.vercel.app`). Every push to `main` deploys automatically.
- The repo is **public** (Vercel Hobby can't deploy private org repos). Keep secrets and personal emails out of it.
- DNS: CNAME `checks` in Cloudflare (DNS only, gray cloud) pointing at Vercel.
- Vercel environment variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`. Changing one requires a redeploy.
- Production and local development share the same Neon database.
- Schema changes: run `npx prisma migrate dev` locally (applies to Neon) before merging code that needs it.
- Linked from mudtavernfire.org under MEMBERS → EQUIPMENT CHECKS.

## Secrets

`.env` is gitignored and holds the database URL, Auth.js, Google OAuth, and SMTP settings. Never commit it or print its values.

## Status

Done:
- Database schema, first migration, seed data (Engine 1, Ladder 2, SCBA Unit 4 with checklists)
- Google sign-in, route protection, sign-in page
- Site header with sign-out
- `/officer` page: officer roster and recent failed checks
- `/checks`: list of checklists with last check and "Due" (none in 7 days) / "Failed" badges; `/` redirects here
- `/checks/[templateId]`: Pass/Fail/N/A per item, note required on failures, saves a `CheckSubmission`
- Failure alerts: on a failed check, emails all active officers and records a `FailureAlert` row (`src/lib/alerts.ts`); email errors never block saving the check
- `/admin` (officers only): People (add, make officer/member, deactivate; can't change your own role or deactivate yourself), Apparatus & Equipment (add, deactivate), Checklists (create for a truck or item; add, rename, reorder, remove, restore items). Nothing is deleted, only deactivated. Admin server actions are in `src/app/admin/actions.ts`, each guarded by `requireOfficer()`.

To do:
- Google OAuth for production: the local client is in Testing mode (only listed test users can sign in, redirect URI is localhost); production needs its redirect URI added and the app published
- Production SMTP settings (`.env` currently points at local maildev on port 1025)
- Retry `FailureAlert` rows with status FAILED
- Officer review: filter and browse all checks, not just recent failures
- Add the other officers (Ennis, Adams, Joseph) through `/admin/people` once their Google emails are known
- Admin: renaming apparatus/equipment and moving equipment between trucks

## Working rules

- Use a branch per feature; don't commit straight to `main`.
- Never put incident or patient details in check notes or sample data.
- Never put personal email addresses in code; the repo is public. Commits use the GitHub noreply address.
- Add new use cases to the Requirements and Status sections above as they come up.
