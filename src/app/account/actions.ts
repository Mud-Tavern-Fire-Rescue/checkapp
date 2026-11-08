"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/ActionForm";
import { requireSession } from "@/lib/auth-helpers";
import { normalizeNotificationEmail, notificationEmailSchema } from "@/lib/notification-email";
import { prisma } from "@/lib/prisma";

// Anyone can choose where their own app emails go.
export async function updateMyNotificationEmail(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = notificationEmailSchema.safeParse(formData.get("notificationEmail") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } });
  if (!user) return { error: "Your account could not be found." };
  const notificationEmail = normalizeNotificationEmail(parsed.data, user.email);
  await prisma.user.update({ where: { id: session.user.id }, data: { notificationEmail } });
  refresh();
  return { message: notificationEmail ? `Emails will go to ${notificationEmail}.` : `Emails will go to ${user.email}.` };
}
