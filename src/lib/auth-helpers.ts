import { auth } from "@/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user || !session.user.isActive) {
    throw new Error("Not authenticated");
  }
  return session;
}

export async function requireOfficer() {
  const session = await requireSession();
  if (session.user.role !== "OFFICER") {
    throw new Error("Officer role required");
  }
  return session;
}
