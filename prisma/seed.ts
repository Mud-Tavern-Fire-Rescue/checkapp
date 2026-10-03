import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const officer = await prisma.user.upsert({
    where: { email: "officer@example.com" },
    update: { role: "OFFICER" },
    create: {
      email: "officer@example.com",
      name: "Mike Russell",
      role: "OFFICER",
    },
  });
  console.log(`Seeded officer: ${officer.email}`);

  const engine1 = await prisma.apparatus.upsert({
    where: { unitNumber: "E1" },
    update: {},
    create: { name: "Engine 1", unitNumber: "E1" },
  });

  const ladder2 = await prisma.apparatus.upsert({
    where: { unitNumber: "L2" },
    update: {},
    create: { name: "Ladder 2", unitNumber: "L2" },
  });

  const scbaUnit = await prisma.equipmentItem.upsert({
    where: { id: "seed-scba-unit-4" },
    update: {},
    create: {
      id: "seed-scba-unit-4",
      name: "SCBA Unit 4",
    },
  });

  await createTemplateIfMissing({
    name: "Engine 1 Weekly Check",
    apparatusId: engine1.id,
    items: [
      "Tire pressure OK",
      "Lights and sirens functional",
      "Water tank full",
      "Hose connections secure",
      "Fuel level above 3/4",
    ],
  });

  await createTemplateIfMissing({
    name: "Ladder 2 Weekly Check",
    apparatusId: ladder2.id,
    items: [
      "Tire pressure OK",
      "Ladder hydraulics functional",
      "Outriggers deploy correctly",
      "Lights and sirens functional",
      "Fuel level above 3/4",
    ],
  });

  await createTemplateIfMissing({
    name: "SCBA Unit 4 Weekly Check",
    equipmentItemId: scbaUnit.id,
    items: [
      "Cylinder pressure full",
      "Mask seal intact",
      "Regulator functions correctly",
      "Alarm/PASS device functional",
    ],
  });
}

async function createTemplateIfMissing(opts: {
  name: string;
  apparatusId?: string;
  equipmentItemId?: string;
  items: string[];
}) {
  const existing = await prisma.checklistTemplate.findFirst({
    where: { name: opts.name },
  });
  if (existing) return existing;

  return prisma.checklistTemplate.create({
    data: {
      name: opts.name,
      apparatusId: opts.apparatusId,
      equipmentItemId: opts.equipmentItemId,
      items: {
        create: opts.items.map((label, index) => ({
          label,
          sortOrder: index,
        })),
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
