import { z } from "zod";

// A notification email is optional; blank means "use my sign-in email".
export const notificationEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address.")
  .transform((v) => v || null);

// Stores null when the address is blank or the same as the sign-in email, so
// a later change to the sign-in email is followed automatically.
export function normalizeNotificationEmail(value: string | null, signInEmail: string) {
  return value && value !== signInEmail.toLowerCase() ? value : null;
}
