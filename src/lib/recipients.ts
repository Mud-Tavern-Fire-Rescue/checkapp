import { prisma } from "@/lib/prisma";

// Where a person's app emails go: the notification email they (or an
// officer) set, otherwise their Google sign-in email.
export function deliveryEmail(user: { email: string; notificationEmail: string | null }) {
  return user.notificationEmail ?? user.email;
}

export const deliveryEmailSelect = { email: true, notificationEmail: true } as const;

// Every active officer's delivery address, without duplicates.
export async function activeOfficerEmails() {
  const officers = await prisma.user.findMany({
    where: { role: "OFFICER", isActive: true },
    select: deliveryEmailSelect,
  });
  return [...new Set(officers.map(deliveryEmail))];
}
