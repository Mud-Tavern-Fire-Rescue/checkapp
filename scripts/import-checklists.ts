// Loads vehicles and checklists from docs/apparatus-checklists.md.
//
//   npm run checklists:import -- --dry-run   show what would be created
//   npm run checklists:import -- --reset     back up, delete all vehicles,
//                                           equipment, checklists, and check
//                                           history, then load the file
//
// People accounts and sign-ins are never touched. The delete and load run in
// one transaction, so a failure leaves the database as it was.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type CheckFrequency } from "@prisma/client";

const FILE = join(process.cwd(), "docs/apparatus-checklists.md");
const BACKUP_DIR = join(process.cwd(), "backups");

type Section = { name: string; items: string[] };
type Checklist = { name: string; frequency: CheckFrequency; sections: Section[] };
type Vehicle = { unitNumber: string; name: string; checklists: Checklist[] };

export function parseChecklists(markdown: string): Vehicle[] {
  const vehicles: Vehicle[] = [];
  let vehicle: Vehicle | undefined;
  let checklist: Checklist | undefined;
  let section: Section | undefined;

  for (const [index, raw] of markdown.split("\n").entries()) {
    const line = raw.trimEnd();
    const where = `line ${index + 1}`;

    // "## E-1 — Engine 1" starts a vehicle; other "## " headings are intro text.
    const vehicleMatch = line.match(/^## (.+?) — (.+)$/);
    if (vehicleMatch) {
      vehicle = { unitNumber: vehicleMatch[1].trim(), name: vehicleMatch[2].trim(), checklists: [] };
      vehicles.push(vehicle);
      checklist = section = undefined;
      continue;
    }
    if (line.startsWith("## ")) {
      vehicle = checklist = section = undefined;
      continue;
    }
    if (!vehicle) continue;

    if (line.startsWith("### ")) {
      const name = line.slice(4).trim();
      const frequency: CheckFrequency | undefined = /monthly/i.test(name)
        ? "MONTHLY"
        : /weekly/i.test(name)
          ? "WEEKLY"
          : undefined;
      if (!frequency) throw new Error(`${where}: "${name}" must say Weekly or Monthly`);
      checklist = { name, frequency, sections: [] };
      vehicle.checklists.push(checklist);
      section = undefined;
    } else if (line.startsWith("#### ")) {
      if (!checklist) throw new Error(`${where}: section outside a checklist`);
      section = { name: line.slice(5).trim(), items: [] };
      checklist.sections.push(section);
    } else if (line.startsWith("- ")) {
      if (!section) throw new Error(`${where}: item outside a section`);
      const label = line.slice(2).replace(/\*\*/g, "").trim();
      if (label.length > 200) throw new Error(`${where}: item is over 200 characters`);
      if (label) section.items.push(label);
    }
  }
  return vehicles;
}

async function backup(prisma: PrismaClient) {
  const data = {
    exportedAt: new Date().toISOString(),
    apparatus: await prisma.apparatus.findMany(),
    equipmentItems: await prisma.equipmentItem.findMany(),
    checklistTemplates: await prisma.checklistTemplate.findMany(),
    checklistItems: await prisma.checklistItem.findMany(),
    checkSubmissions: await prisma.checkSubmission.findMany(),
    checkItemResults: await prisma.checkItemResult.findMany(),
    failureAlerts: await prisma.failureAlert.findMany(),
    users: await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true },
    }),
  };
  mkdirSync(BACKUP_DIR, { recursive: true });
  const path = join(BACKUP_DIR, `checkapp-${data.exportedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const vehicles = parseChecklists(readFileSync(FILE, "utf8"));
  if (vehicles.length === 0) throw new Error(`No vehicles found in ${FILE}`);

  for (const v of vehicles) {
    for (const c of v.checklists) {
      const count = c.sections.reduce((n, s) => n + s.items.length, 0);
      console.log(`${v.unitNumber} (${v.name}) · ${c.name} · ${c.frequency} · ${c.sections.length} sections · ${count} items`);
    }
  }
  if (args.has("--dry-run")) return;

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.checklistTemplate.count();
    if (existing > 0 && !args.has("--reset")) {
      throw new Error(
        `The database already has ${existing} checklists. Re-run with --reset to replace everything.`,
      );
    }

    if (args.has("--reset")) {
      console.log(`Backup written to ${await backup(prisma)}`);
    }

    await prisma.$transaction(
      async (tx) => {
        if (args.has("--reset")) {
          // Children first, to satisfy foreign keys.
          await tx.failureAlert.deleteMany();
          await tx.checkItemResult.deleteMany();
          await tx.checkSubmission.deleteMany();
          await tx.checklistItem.deleteMany();
          await tx.checklistTemplate.deleteMany();
          await tx.equipmentItem.deleteMany();
          await tx.apparatus.deleteMany();
        }

        for (const v of vehicles) {
          const apparatus = await tx.apparatus.create({
            data: { name: v.name, unitNumber: v.unitNumber },
          });
          for (const c of v.checklists) {
            const template = await tx.checklistTemplate.create({
              data: { name: c.name, frequency: c.frequency, apparatusId: apparatus.id },
            });
            let sortOrder = 0;
            await tx.checklistItem.createMany({
              data: c.sections.flatMap((s) =>
                s.items.map((label) => ({
                  templateId: template.id,
                  section: s.name,
                  label,
                  sortOrder: sortOrder++,
                })),
              ),
            });
          }
        }
      },
      { timeout: 60_000 },
    );

    console.log(
      `Loaded ${vehicles.length} vehicles and ${vehicles.reduce((n, v) => n + v.checklists.length, 0)} checklists.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
