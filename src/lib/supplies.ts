import type { RecordType, SupplyStatus } from "@prisma/client";
import { DEPARTMENT_TIME_ZONE, formatDateTime } from "@/lib/format";
import { sendEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export const SUPPLY_STATUS: Record<SupplyStatus, { label: string; className: string }> = {
  REQUESTED: { label: "Requested", className: "bg-amber-100 text-amber-800" },
  ORDERED: { label: "Ordered", className: "bg-blue-100 text-blue-800" },
  RECEIVED: { label: "Received", className: "bg-green-100 text-green-800" },
  DENIED: { label: "Denied", className: "bg-red-100 text-red-700" },
  CANCELED: { label: "Canceled", className: "bg-gray-100 text-gray-600" },
};

// Open requests can still change; closed ones are archived but viewable.
export const OPEN_SUPPLY_STATUSES: SupplyStatus[] = ["REQUESTED", "ORDERED"];

export function isOpen(status: SupplyStatus) {
  return OPEN_SUPPLY_STATUSES.includes(status);
}

// Date-only values ("date needed") are stored as midnight UTC, so they're
// parsed and shown in UTC to keep the calendar day from shifting.
export function parseDateOnly(day: string): Date | null {
  const match = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

export function formatDateOnly(date: Date) {
  return date.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
}

// "YYYY-MM-DD" for a date-only value, for <input type="date">.
export function dateOnlyInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

// Today's calendar date in department (Central) time, as a date-only value.
export function departmentToday(): Date {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: DEPARTMENT_TIME_ZONE }).format(new Date());
  return parseDateOnly(day)!;
}

export async function recordEvent(
  entityType: RecordType,
  entityId: string,
  actorId: string,
  summary: string,
) {
  await prisma.recordEvent.create({ data: { entityType, entityId, actorId, summary } });
}

// Emails every active officer about a new supply request. Never throws: the
// request is already saved, and a missing email shouldn't undo it.
export async function notifyOfficersOfSupplyRequest(requestId: string) {
  try {
    const [request, officers] = await Promise.all([
      prisma.supplyRequest.findUnique({
        where: { id: requestId },
        include: { requestedBy: { select: { name: true } } },
      }),
      prisma.user.findMany({
        where: { role: "OFFICER", isActive: true },
        select: { email: true },
      }),
    ]);
    if (!request || officers.length === 0) return;

    const appUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
    await sendEmail({
      to: officers.map((o) => o.email),
      subject: `Supply request: ${request.item} (${request.quantity})`,
      text: [
        `${request.requestedBy.name} requested supplies.`,
        "",
        `Item: ${request.item}`,
        `Quantity: ${request.quantity}`,
        `Needed by: ${request.dateNeeded ? formatDateOnly(request.dateNeeded) : "Not specified"}`,
        `Requested: ${formatDateTime(request.createdAt)}`,
        ...(request.notes ? [`Notes: ${request.notes}`] : []),
        ...(appUrl ? ["", `View or update it: ${appUrl}/supplies/${request.id}`] : []),
        "",
        "Sent automatically by MTVFR Equipment Checks to all active officers.",
      ].join("\n"),
    });
  } catch (error) {
    console.error("Supply request email could not be sent", error);
  }
}
