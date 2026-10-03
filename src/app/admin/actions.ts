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
      apparatusId: kind === "apparatus" ? id : null,
      equipmentItemId: kind === "equipment" ? id : null,
    },
  });
  redirect(`/admin/checklists/${template.id}`);
}

export async function renameTemplate(
  templateId: string,
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOfficer();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: firstError(parsed.error) };

  await prisma.checklistTemplate.update({
    where: { id: templateId },
    data: { name: parsed.data },
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

const itemLabelSchema = z.string().trim().min(1, "Item text is required.").max(200);

export async function addChecklistItem(
  templateId: string,
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOfficer();
  const parsed = itemLabelSchema.safeParse(formData.get("label"));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const last = await prisma.checklistItem.findFirst({
    where: { templateId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.checklistItem.create({
    data: { templateId, label: parsed.data, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  refresh();
  return {};
}

export async function updateChecklistItem(
  itemId: string,
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOfficer();
  const parsed = itemLabelSchema.safeParse(formData.get("label"));
  if (!parsed.success) return { error: firstError(parsed.error) };

  await prisma.checklistItem.update({
    where: { id: itemId },
    data: { label: parsed.data },
  });
  refresh();
  return {};
}

export async function setChecklistItemActive(
  itemId: string,
  isActive: boolean,
): Promise<AdminActionState> {
  await requireOfficer();
  let sortOrder: number | undefined;
  if (isActive) {
    // Restored items go to the end of the list.
    const item = await prisma.checklistItem.findUniqueOrThrow({
      where: { id: itemId },
      select: { templateId: true },
    });
    const last = await prisma.checklistItem.findFirst({
      where: { templateId: item.templateId, isActive: true },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }
  await prisma.checklistItem.update({
    where: { id: itemId },
    data: { isActive, sortOrder },
  });
  refresh();
  return {};
}

// Swaps an active item with its active neighbor and renumbers the whole
// list, so sortOrder stays clean even if older data has gaps or ties.
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
    select: { id: true },
  });

  const index = items.findIndex((i) => i.id === itemId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= items.length) return {};

  [items[index], items[swapWith]] = [items[swapWith], items[index]];
  await prisma.$transaction(
    items.map((i, sortOrder) =>
      prisma.checklistItem.update({ where: { id: i.id }, data: { sortOrder } }),
    ),
  );
  refresh();
  return {};
}
