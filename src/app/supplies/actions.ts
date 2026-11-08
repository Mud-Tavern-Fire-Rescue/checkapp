"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/ActionForm";
import { requireOfficer, requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  SUPPLY_STATUS,
  formatDateOnly,
  isOpen,
  notifyOfficersOfSupplyRequest,
  parseDateOnly,
  recordEvent,
} from "@/lib/supplies";

// There is deliberately no delete: requests are kept as a permanent record
// (officer decision 2026-10-30). Closed requests are archived instead.

const requestSchema = z.object({
  item: z.string().trim().min(1, "Describe what's needed.").max(200),
  quantity: z.string().trim().min(1, "Enter a quantity.").max(50),
  dateNeeded: z
    .string()
    .trim()
    .refine((v) => v === "" || parseDateOnly(v) !== null, "Enter a valid date needed.")
    .transform((v) => (v ? parseDateOnly(v) : null)),
  notes: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => v || null),
});

function parseRequest(formData: FormData) {
  return requestSchema.safeParse({
    item: formData.get("item") ?? "",
    quantity: formData.get("quantity") ?? "",
    dateNeeded: formData.get("dateNeeded") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

const reasonSchema = z.string().trim().max(500);

export async function createSupplyRequest(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = parseRequest(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const request = await prisma.supplyRequest.create({
    data: { ...parsed.data, requestedById: session.user.id },
  });
  await recordEvent("SUPPLY_REQUEST", request.id, session.user.id, "Requested");
  await notifyOfficersOfSupplyRequest(request.id);
  redirect(`/supplies/${request.id}?created=1`);
}

// Any member can edit an open request; each change is recorded.
export async function updateSupplyRequest(
  requestId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = parseRequest(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const before = await prisma.supplyRequest.findUnique({ where: { id: requestId } });
  if (!before) return { error: "This request no longer exists." };
  if (!isOpen(before.status)) {
    return { error: "This request is closed, so it can't be edited." };
  }

  const after = parsed.data;
  const dateText = (d: Date | null) => (d ? formatDateOnly(d) : "none");
  const changes = [
    before.item !== after.item && `Item: "${before.item}" → "${after.item}"`,
    before.quantity !== after.quantity && `Quantity: ${before.quantity} → ${after.quantity}`,
    dateText(before.dateNeeded) !== dateText(after.dateNeeded) &&
      `Date needed: ${dateText(before.dateNeeded)} → ${dateText(after.dateNeeded)}`,
    (before.notes ?? "") !== (after.notes ?? "") && "Notes changed",
  ].filter((c): c is string => Boolean(c));
  if (changes.length === 0) return { message: "No changes to save." };

  await prisma.supplyRequest.update({ where: { id: requestId }, data: after });
  await recordEvent("SUPPLY_REQUEST", requestId, session.user.id, changes.join("; "));
  refresh();
  return { message: "Saved." };
}

// Officers move a request through Ordered, Received, or Denied.
export async function setSupplyStatus(
  requestId: string,
  status: "ORDERED" | "RECEIVED" | "DENIED",
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOfficer();
  const parsedReason = reasonSchema.safeParse(formData.get("reason") ?? "");
  if (!parsedReason.success) return { error: "Keep the reason under 500 characters." };
  const reason = parsedReason.data;
  if (status === "DENIED" && !reason) return { error: "Give a short reason for denying it." };

  const before = await prisma.supplyRequest.findUnique({ where: { id: requestId } });
  if (!before) return { error: "This request no longer exists." };
  if (!isOpen(before.status)) return { error: "This request is already closed." };
  if (before.status === status) return {};

  await prisma.supplyRequest.update({
    where: { id: requestId },
    data: {
      status,
      statusReason: status === "DENIED" ? reason : null,
      ...(status === "RECEIVED" && { receivedAt: new Date(), receivedById: session.user.id }),
    },
  });
  await recordEvent(
    "SUPPLY_REQUEST",
    requestId,
    session.user.id,
    `Status: ${SUPPLY_STATUS[before.status].label} → ${SUPPLY_STATUS[status].label}` +
      (reason ? ` (${reason})` : ""),
  );
  refresh();
  return {};
}

// The person who asked, or any officer, can cancel an open request.
export async function cancelSupplyRequest(
  requestId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsedReason = reasonSchema.safeParse(formData.get("reason") ?? "");
  if (!parsedReason.success) return { error: "Keep the reason under 500 characters." };
  const reason = parsedReason.data;

  const before = await prisma.supplyRequest.findUnique({ where: { id: requestId } });
  if (!before) return { error: "This request no longer exists." };
  if (!isOpen(before.status)) return { error: "This request is already closed." };
  if (before.requestedById !== session.user.id && session.user.role !== "OFFICER") {
    return { error: "Only the person who asked for it, or an officer, can cancel it." };
  }

  await prisma.supplyRequest.update({
    where: { id: requestId },
    data: { status: "CANCELED", statusReason: reason || null },
  });
  await recordEvent(
    "SUPPLY_REQUEST",
    requestId,
    session.user.id,
    `Status: ${SUPPLY_STATUS[before.status].label} → Canceled` + (reason ? ` (${reason})` : ""),
  );
  refresh();
  return {};
}
