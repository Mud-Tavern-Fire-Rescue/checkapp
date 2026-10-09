@AGENTS.md

# CheckApp: Equipment Checks

Weekly truck and equipment check app for Mud Tavern Volunteer Fire and Rescue (MTVFR). Firefighters record checks; officers review results and are alerted when something fails. Authorized users will reach it from the department website (mudtavernfire.org, a separate repo).

## Requirements

- Firefighters run weekly checks on apparatus (trucks) and standalone equipment (e.g. SCBA units) against a checklist.
- Each vehicle has a Weekly Check (operational readiness) and a Monthly Check (periodic inspections, expiration dates, inventory).
- Vehicles: E-1, E-2, E-3 (pumpers, air brakes), E-4 (KME cabover rescue pumper), QRV-1 (ALS F-150, winch), Brush 1 (Type 6, F-550), Rescue 1 (light rescue, F-450, winch).
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
- `ChecklistTemplate` belongs to exactly one apparatus **or** one equipment item (enforced in app code with Zod, not the DB), has a `frequency` (WEEKLY = due after 7 days, MONTHLY = 30 days; `src/lib/schedule.ts`), and ordered `ChecklistItem`s.
- `ChecklistItem.section` groups items under a heading (e.g. "Air brakes"); items in a section stay together in `sortOrder`.
- `CheckSubmission`: one completed check, with `submittedBy`, `submittedAt`, `overallStatus` (PASS/FAIL), notes, and per-item `CheckItemResult` (PASS/FAIL/NA). Apparatus/equipment IDs are copied onto the submission for fast filtering.
- `FailureAlert`: one row per alert email attempt (recipients, status, attempts, last error) for auditing and retries.
- Prefer deactivating (`isActive = false`) over deleting, so past check history stays intact.

## Commands

- `.claude/launch.json` defines `dev` (port 3000) and `maildev` (web UI on port 1080, SMTP on 1025)
- `npm run dev`: dev server
- `npm run build`, `npm run lint`, `npx tsc --noEmit`: verify before committing
- `npx prisma migrate dev --name <name>`: schema changes (runs against Neon)
- `npm run db:seed`: creates the first officer from `SEED_OFFICER_EMAIL` / `SEED_OFFICER_NAME` in `.env`
- `npm run checklists:import -- --dry-run`: preview vehicles and checklists parsed from `docs/apparatus-checklists.md`
- `npm run checklists:import -- --reset`: back up to `backups/` (gitignored), delete all vehicles, equipment, checklists, and check history, and load the file. People are kept. Claude Code's safety check blocks Claude from running `--reset`; the user runs it.

## Checklist source

- `docs/apparatus-checklists.md` is the source for vehicles and checklists: `##` vehicle (`CODE — Name`), `###` checklist (name must say Weekly or Monthly), `####` section, `- ` item.
- The department edits a Word copy (`docs/apparatus-checklists.docx`, not committed). Convert edits back with `pandoc file.docx -t markdown --wrap=none`, then rebuild the .md, keeping the heading structure.
- After the first import, day-to-day changes are made in Admin > Checklists; re-importing with `--reset` wipes check history.

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
- Google sign-in (only people added in Admin), route protection, site header
- `/checks`: each vehicle's Weekly and Monthly checklists with last check, Due, and Failed badges
- Running a check: items grouped by section, "Mark unanswered as Pass" per section, note required on failures
- Failure alerts email all active officers and record a `FailureAlert` row; email errors never block saving
- `/officer`: officer roster and recent failed checks
- `/admin`: people, apparatus and equipment, checklists (frequency, sections, reorder within section, remove/restore)
- Real checklists for all 7 vehicles imported 2026-10-09 (843 items); old sample data and test checks removed

To do:
- Production SMTP settings (alerts are not emailed from the live site yet)
- Publish the Google OAuth app (Testing mode: only listed test users can sign in)
- Retry `FailureAlert` rows with status FAILED
- Officer review: filter and browse all checks, not just recent failures
- Admin: renaming apparatus/equipment and moving equipment between trucks
- Separate Neon branch for local development (production and local share one database)
- Possible: "Out of service" status when a safety-critical item fails; two-signature controlled-substance checks on QRV-1

## Working rules

- Use a branch per feature; don't commit straight to `main`.
- Never put incident or patient details in check notes or sample data.
- Never put personal email addresses in code; the repo is public. Commits use the GitHub noreply address.
- Add new use cases to the Requirements and Status sections above as they come up.
