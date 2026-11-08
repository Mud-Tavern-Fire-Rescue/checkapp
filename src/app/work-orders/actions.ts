"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/ActionForm";
import { requireOfficer, requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/supplies";
import { notifyOfficersOfWorkOrder, parseSubject, subjectLabel } from "@/lib/work-orders";

// There is deliberately no delete: work orders and their notes are kept as a
// permanent record (officer decision 2026-10-30). Closed ones are archived.

const workOrderSchema = z.object({
  title: z.string().trim().min(1, "Describe what's missing or damaged.").max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => v || null),
  subject: z.string().trim().max(60),
});

function parseWorkOrder(formData: FormData) {
  return workOrderSchema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    subject: formData.get("subject") ?? "",
  });
}

// Confirms the chosen vehicle or equipment exists.
async function resolveSubject(value: string) {
  const subject = parseSubject(value);
  if (subject.apparatusId) {
    const found = await prisma.apparatus.findUnique({ where: { id: subject.apparatusId } });
    if (!found) return null;
  }
  if (subject.equipmentItemId) {
    const found = await prisma.equipmentItem.findUnique({ where: { id: subject.equipmentItemId } });
    if (!found) return null;
  }
  return subject;
}

const textSchema = z.string().trim().max(1000);

export async function createWorkOrder(_state: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = parseWorkOrder(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const subject = await resolveSubject(parsed.data.subject);
  if (!subject) return { error: "Choose a vehicle or equipment from the list." };

  // Created from a failed check item: keep the link, but only to a real
  // failed result.
  let checkItemResultId: string | null = null;
  const resultId = formData.get("checkItemResultId");
  if (typeof resultId === "string" && resultId) {
    const result = await prisma.checkItemResult.findUnique({ where: { id: resultId } });
    if (result?.status === "FAIL") checkItemResultId = result.id;
  }
  // Created from an equipment loan that came back with an issue.
  let loanId: string | null = null;
  const loanValue = formData.get("loanId");
  if (typeof loanValue === "string" && loanValue) {
    const loan = await prisma.equipmentLoan.findUnique({ where: { id: loanValue } });
    if (loan?.status === "RETURNED") loanId = loan.id;
  }

  // Only officers can take something out of service.
  const outOfService = session.user.role === "OFFICER" && formData.get("outOfService") === "on";

  const workOrder = await prisma.workOrder.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      ...subject,
      checkItemResultId,
      loanId,
      outOfService,
      reportedById: session.user.id,
    },
  });
  await recordEvent(
    "WORK_ORDER",
    workOrder.id,
    session.user.id,
    outOfService ? "Opened (out of service)" : "Opened",
  );
  await notifyOfficersOfWorkOrder(workOrder.id, "created");
  redirect(`/work-orders/${workOrder.id}?created=1`);
}

// Any member can correct an open work order's details; each change is
// recorded.
export async function updateWorkOrder(
  workOrderId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = parseWorkOrder(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const subject = await resolveSubject(parsed.data.subject);
  if (!subject) return { error: "Choose a vehicle or equipment from the list." };

  const before = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      apparatus: { select: { name: true, unitNumber: true } },
      equipmentItem: { select: { name: true } },
    },
  });
  if (!before) return { error: "This work order no longer exists." };
  if (before.status !== "OPEN") return { error: "This work order is closed, so it can't be edited." };

  const subjectChanged =
    before.apparatusId !== subject.apparatusId || before.equipmentItemId !== subject.equipmentItemId;
  let subjectChange: string | false = false;
  if (subjectChanged) {
    const [apparatus, equipmentItem] = await Promise.all([
      subject.apparatusId
        ? prisma.apparatus.findUnique({ where: { id: subject.apparatusId }, select: { name: true, unitNumber: true } })
        : null,
      subject.equipmentItemId
        ? prisma.equipmentItem.findUnique({ where: { id: subject.equipmentItemId }, select: { name: true } })
        : null,
    ]);
    subjectChange = `Vehicle or equipment: ${subjectLabel(before) ?? "none"} → ${
      subjectLabel({ apparatus, equipmentItem }) ?? "none"
    }`;
  }

  const changes = [
    before.title !== parsed.data.title && `Problem: "${before.title}" → "${parsed.data.title}"`,
    subjectChange,
    (before.description ?? "") !== (parsed.data.description ?? "") && "Details changed",
  ].filter((c): c is string => Boolean(c));
  if (changes.length === 0) return { message: "No changes to save." };

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { title: parsed.data.title, description: parsed.data.description, ...subject },
  });
  await recordEvent("WORK_ORDER", workOrderId, session.user.id, changes.join("; "));
  refresh();
  return { message: "Saved." };
}

// Dated progress notes ("replacement ordered", "replaced"). Any member can
// add one to an open work order.
export async function addWorkOrderNote(
  workOrderId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = textSchema.safeParse(formData.get("body") ?? "");
  if (!parsed.success) return { error: "Keep the note under 1,000 characters." };
  if (!parsed.data) return { error: "Write a note first." };

  const workOrder = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!workOrder) return { error: "This work order no longer exists." };
  if (workOrder.status !== "OPEN") return { error: "This work order is closed." };

  await prisma.workOrderNote.create({
    data: { workOrderId, authorId: session.user.id, body: parsed.data },
  });
  await prisma.workOrder.update({ where: { id: workOrderId }, data: { updatedAt: new Date() } });
  refresh();
  return {};
}

// Officers take a vehicle or equipment out of service, or return it.
export async function setOutOfService(
  workOrderId: string,
  outOfService: boolean,
): Promise<FormState> {
  const session = await requireOfficer();
  const workOrder = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!workOrder) return { error: "This work order no longer exists." };
  if (workOrder.status !== "OPEN") return { error: "This work order is closed." };
  if (workOrder.outOfService === outOfService) return {};

  await prisma.workOrder.update({ where: { id: workOrderId }, data: { outOfService } });
  await recordEvent(
    "WORK_ORDER",
    workOrderId,
    session.user.id,
    outOfService ? "Marked out of service" : "Returned to service",
  );
  if (outOfService) await notifyOfficersOfWorkOrder(workOrderId, "outOfService");
  refresh();
  return {};
}

// An officer resolves a work order once the repair or replacement is done.
// Resolving also returns it to service.
export async function resolveWorkOrder(
  workOrderId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOfficer();
  const parsed = textSchema.safeParse(formData.get("reason") ?? "");
  if (!parsed.success) return { error: "Keep the summary under 1,000 characters." };
  if (!parsed.data) return { error: "Say briefly how it was resolved." };

  const workOrder = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!workOrder) return { error: "This work order no longer exists." };
  if (workOrder.status !== "OPEN") return { error: "This work order is already closed." };

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: "RESOLVED",
      statusReason: parsed.data,
      outOfService: false,
      resolvedAt: new Date(),
      resolvedById: session.user.id,
    },
  });
  await recordEvent(
    "WORK_ORDER",
    workOrderId,
    session.user.id,
    `Resolved (${parsed.data})${workOrder.outOfService ? "; returned to service" : ""}`,
  );
  refresh();
  return {};
}

// The person who reported it, or any officer, can cancel an open work order
// (for example a duplicate).
export async function cancelWorkOrder(
  workOrderId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = textSchema.safeParse(formData.get("reason") ?? "");
  if (!parsed.success) return { error: "Keep the reason under 1,000 characters." };

  const workOrder = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!workOrder) return { error: "This work order no longer exists." };
  if (workOrder.status !== "OPEN") return { error: "This work order is already closed." };
  if (workOrder.reportedById !== session.user.id && session.user.role !== "OFFICER") {
    return { error: "Only the person who reported it, or an officer, can cancel it." };
  }

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { status: "CANCELED", statusReason: parsed.data || null, outOfService: false },
  });
  await recordEvent(
    "WORK_ORDER",
    workOrderId,
    session.user.id,
    `Canceled${parsed.data ? ` (${parsed.data})` : ""}${workOrder.outOfService ? "; returned to service" : ""}`,
  );
  refresh();
  return {};
}
