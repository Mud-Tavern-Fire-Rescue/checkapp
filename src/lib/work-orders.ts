import type { WorkOrderStatus } from "@prisma/client";
import { formatDateTime } from "@/lib/format";
import { sendEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export const WORK_ORDER_STATUS: Record<WorkOrderStatus, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-amber-100 text-amber-800" },
  RESOLVED: { label: "Resolved", className: "bg-green-100 text-green-800" },
  CANCELED: { label: "Canceled", className: "bg-gray-100 text-gray-600" },
};

export const OUT_OF_SERVICE_BADGE =
  "rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white";

// What a work order is about: a vehicle, a piece of equipment, or neither
// (station equipment, for example).
type Subject = {
  apparatus: { name: string; unitNumber: string | null } | null;
  equipmentItem: { name: string } | null;
};

export function subjectLabel({ apparatus, equipmentItem }: Subject) {
  if (apparatus) return apparatus.unitNumber ?? apparatus.name;
  if (equipmentItem) return equipmentItem.name;
  return null;
}

// The vehicle/equipment picker posts "a:<id>", "e:<id>", or "" for none.
export function parseSubject(value: string) {
  const [kind, id] = value.split(":");
  if (kind === "a" && id) return { apparatusId: id, equipmentItemId: null };
  if (kind === "e" && id) return { apparatusId: null, equipmentItemId: id };
  return { apparatusId: null, equipmentItemId: null };
}

export function subjectValue(w: { apparatusId: string | null; equipmentItemId: string | null }) {
  if (w.apparatusId) return `a:${w.apparatusId}`;
  if (w.equipmentItemId) return `e:${w.equipmentItemId}`;
  return "";
}

// Active vehicles and equipment for the picker, plus the current choice even
// if it has since been deactivated.
export async function subjectOptions(current?: { apparatusId: string | null; equipmentItemId: string | null }) {
  const [vehicles, equipment] = await Promise.all([
    prisma.apparatus.findMany({
      where: { OR: [{ isActive: true }, ...(current?.apparatusId ? [{ id: current.apparatusId }] : [])] },
      select: { id: true, name: true, unitNumber: true },
    }),
    prisma.equipmentItem.findMany({
      where: {
        OR: [{ isActive: true }, ...(current?.equipmentItemId ? [{ id: current.equipmentItemId }] : [])],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return {
    vehicles: vehicles
      .map((v) => ({ value: `a:${v.id}`, label: v.unitNumber ? `${v.unitNumber} — ${v.name}` : v.name }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    equipment: equipment.map((e) => ({ value: `e:${e.id}`, label: e.name })),
  };
}

// Emails every active officer about a new work order, or one just marked out
// of service. Never throws: the change is already saved.
export async function notifyOfficersOfWorkOrder(
  workOrderId: string,
  reason: "created" | "outOfService",
) {
  try {
    const [workOrder, officers] = await Promise.all([
      prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
          reportedBy: { select: { name: true } },
          apparatus: { select: { name: true, unitNumber: true } },
          equipmentItem: { select: { name: true } },
        },
      }),
      prisma.user.findMany({
        where: { role: "OFFICER", isActive: true },
        select: { email: true },
      }),
    ]);
    if (!workOrder || officers.length === 0) return;

    const subject = subjectLabel(workOrder);
    const prefix = reason === "outOfService" || workOrder.outOfService ? "OUT OF SERVICE: " : "";
    const appUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
    await sendEmail({
      to: officers.map((o) => o.email),
      subject: `${prefix}Work order: ${subject ? `${subject} – ` : ""}${workOrder.title}`,
      text: [
        reason === "created"
          ? `${workOrder.reportedBy.name} opened a work order.`
          : `A work order was marked out of service.`,
        "",
        `Problem: ${workOrder.title}`,
        `Vehicle or equipment: ${subject ?? "Not specified"}`,
        ...(workOrder.outOfService ? ["Out of service: YES"] : []),
        `Reported: ${formatDateTime(workOrder.createdAt)}`,
        ...(workOrder.description ? [`Details: ${workOrder.description}`] : []),
        ...(appUrl ? ["", `View or update it: ${appUrl}/work-orders/${workOrder.id}`] : []),
        "",
        "Sent automatically by MTVFR Equipment Checks to all active officers.",
      ].join("\n"),
    });
  } catch (error) {
    console.error("Work order email could not be sent", error);
  }
}
