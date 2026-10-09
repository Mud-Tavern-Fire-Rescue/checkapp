import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // The first officer comes from .env so no one's email lives in the repo.
  // After that, officers add everyone else in Admin > People.
  const officerEmail = process.env.SEED_OFFICER_EMAIL?.trim().toLowerCase();
  const officerName = process.env.SEED_OFFICER_NAME?.trim();
  if (officerEmail && officerName) {
    const officer = await prisma.user.upsert({
      where: { email: officerEmail },
      update: { role: "OFFICER" },
      create: { email: officerEmail, name: officerName, role: "OFFICER" },
    });
    console.log(`Seeded officer: ${officer.email}`);
  } else {
    console.log("SEED_OFFICER_EMAIL/SEED_OFFICER_NAME not set; skipping officer.");
  }

  // Vehicles and checklists come from docs/apparatus-checklists.md:
  //   npm run checklists:import
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
