"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOfficer } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export type AdminActionState = { error?: string };

const roleSchema = z.enum(["MEMBER", "OFFICER"]);
const nameSchema = z.string().trim().min(1, "Name is required.").max(100);
const optionalIdSchema = z
  .string()
  .trim()
  .transform((v) => v || null);

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

// --- People ---

const addUserSchema = z.object({
  name: nameSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: roleSchema,
});

export async function addUser(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOfficer();
  const parsed = addUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  try {
    await prisma.user.create({ data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Someone with that email already exists." };
    }
    throw error;
  }
  refresh();
  return {};
}

export async function setUserRole(
  userId: string,
  role: "MEMBER" | "OFFICER",
): Promise<AdminActionState> {
  const session = await requireOfficer();
  if (userId === session.user.id) {
    return { error: "You can't change your own role." };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { role: roleSchema.parse(role) },
  });
  refresh();
  return {};
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<AdminActionState> {
  const session = await requireOfficer();
  if (userId === session.user.id) {
    return { error: "You can't deactivate yourself." };
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { isActive } }),
    // Sign a deactivated user out everywhere right away.
    ...(isActive ? [] : [prisma.session.deleteMany({ where: { userId } })]),
  ]);
  refresh();
  return {};
}

// --- Apparatus and equipment ---

const addApparatusSchema = z.object({
  name: nameSchema,
  unitNumber: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v.toUpperCase() || null),
});

export async function addApparatus(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOfficer();
  const parsed = addApparatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  try {
    await prisma.apparatus.create({ data: parsed.data });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "That unit number is already in use." };
    }
    throw error;
  }
  refresh();
  return {};
}

export async function setApparatusActive(
  apparatusId: string,
  isActive: boolean,
): Promise<AdminActionState> {
  await requireOfficer();
  await prisma.apparatus.update({ where: { id: apparatusId }, data: { isActive } });
  refresh();
  return {};
}

const addEquipmentSchema = z.object({
  name: nameSchema,
  apparatusId: optionalIdSchema,
});

export async function addEquipmentItem(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOfficer();
  const parsed = addEquipmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  await prisma.equipmentItem.create({ data: parsed.data });
  refresh();
  return {};
}

export async function setEquipmentActive(
  equipmentItemId: string,
  isActive: boolean,
): Promise<AdminActionState> {
  await requireOfficer();
  await prisma.equipmentItem.update({
    where: { id: equipmentItemId },
    data: { isActive },
  });
  refresh();
  return {};
}

// --- Checklists ---

// The target select's value is "apparatus:<id>" or "equipment:<id>", so a
// template always belongs to exactly one of the two.
const createTemplateSchema = z.object({
  name: nameSchema,
  target: z
    .string()
    .regex(/^(apparatus|equipment):.+$/, "Choose what this checklist is for."),
  frequency: z.enum(["WEEKLY", "MONTHLY"]),
});

export async function createTemplate(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOfficer();
  const parsed = createTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const [kind, id] = parsed.data.target.split(/:(.+)/);
  const template = await prisma.checklistTemplate.create({
    data: {
      name: parsed.data.name,
      frequency: parsed.data.frequency,
      apparatusId: kind === "apparatus" ? id : null,
      equipmentItemId: kind === "equipment" ? id : null,
    },
  });
  redirect(`/admin/checklists/${template.id}`);
}

const updateTemplateSchema = z.object({
  name: nameSchema,
  frequency: z.enum(["WEEKLY", "MONTHLY"]),
});

export async function updateTemplate(
  templateId: string,
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOfficer();
  const parsed = updateTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  await prisma.checklistTemplate.update({
    where: { id: templateId },
    data: parsed.data,
  });
  refresh();
  return {};
}

export async function setTemplateActive(
  templateId: string,
  isActive: boolean,
): Promise<AdminActionState> {
  await requireOfficer();
  await prisma.checklistTemplate.update({
    where: { id: templateId },
    data: { isActive },
  });
  refresh();
  return {};
}

const itemSchema = z.object({
  label: z.string().trim().min(1, "Item text is required.").max(200),
  section: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || null),
});

// Moves an item to just after the last active item in its section (or the
// end of the list for a new section) and renumbers the whole checklist, so
// sections stay together and sortOrder has no gaps.
async function placeAtEndOfSection(itemId: string) {
  const item = await prisma.checklistItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { templateId: true, section: true },
  });
  const others = await prisma.checklistItem.findMany({
    where: { templateId: item.templateId, isActive: true, id: { not: itemId } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, section: true },
  });
  const lastInSection = others.findLastIndex((i) => i.section === item.section);
  const insertAt = lastInSection === -1 ? others.length : lastInSection + 1;
  const ordered = [...others.slice(0, insertAt), { id: itemId }, ...others.slice(insertAt)];
  await prisma.$transaction(
    ordered.map((i, sortOrder) =>
      prisma.checklistItem.update({ where: { id: i.id }, data: { sortOrder } }),
    ),
  );
}

export async function addChecklistItem(
  templateId: string,
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOfficer();
  const parsed = itemSchema.safeParse({
    label: formData.get("label"),
    section: formData.get("section") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const item = await prisma.checklistItem.create({
    data: { templateId, ...parsed.data },
  });
  await placeAtEndOfSection(item.id);
  refresh();
  return {};
}

export async function updateChecklistItem(
  itemId: string,
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOfficer();
  const parsed = itemSchema.safeParse({
    label: formData.get("label"),
    section: formData.get("section") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const before = await prisma.checklistItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { section: true },
  });
  await prisma.checklistItem.update({ where: { id: itemId }, data: parsed.data });
  if (before.section !== parsed.data.section) {
    await placeAtEndOfSection(itemId);
  }
  refresh();
  return {};
}

export async function setChecklistItemActive(
  itemId: string,
  isActive: boolean,
): Promise<AdminActionState> {
  await requireOfficer();
  await prisma.checklistItem.update({ where: { id: itemId }, data: { isActive } });
  if (isActive) {
    // Restored items go back to the end of their section.
    await placeAtEndOfSection(itemId);
  }
  refresh();
  return {};
}

// Swaps an active item with its neighbor in the same section and renumbers
// the whole list, so sortOrder stays clean even if older data has gaps or ties.
export async function moveChecklistItem(
  itemId: string,
  direction: "up" | "down",
): Promise<AdminActionState> {
  await requireOfficer();
  const item = await prisma.checklistItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { templateId: true },
  });
  const items = await prisma.checklistItem.findMany({
    where: { templateId: item.templateId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, section: true },
  });

  const index = items.findIndex((i) => i.id === itemId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= items.length) return {};
  if (items[index].section !== items[swapWith].section) return {};

  [items[index], items[swapWith]] = [items[swapWith], items[index]];
  await prisma.$transaction(
    items.map((i, sortOrder) =>
      prisma.checklistItem.update({ where: { id: i.id }, data: { sortOrder } }),
    ),
  );
  refresh();
  return {};
}
