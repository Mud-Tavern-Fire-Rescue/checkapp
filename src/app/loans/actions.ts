"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/ActionForm";
import { requireOfficer, requireSession } from "@/lib/auth-helpers";
import {
  LOAN_ACKNOWLEDGEMENT,
  LOAN_STATUS,
  isOut,
  itemsSummary,
  notifyBorrowerOfDecision,
  notifyOfficersOfLoanRequest,
} from "@/lib/loans";
import { prisma } from "@/lib/prisma";
import { departmentToday, formatDateOnly, parseDateOnly, recordEvent } from "@/lib/supplies";

// There is deliberately no delete: loans are kept as a permanent record
// (officer decision 2026-10-30). Closed loans are archived instead.

const MAX_ITEMS = 25;

const itemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce
    .number({ message: "Enter a whole number for each quantity." })
    .int("Enter a whole number for each quantity.")
    .min(1, "Each quantity must be at least 1.")
    .max(999, "Quantities must be under 1,000."),
});

const dateSchema = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => parseDateOnly(v) !== null, `Enter the ${label}.`)
    .transform((v) => parseDateOnly(v)!);

const loanSchema = z
  .object({
    items: z
      .array(itemSchema)
      .min(1, "List at least one item.")
      .max(MAX_ITEMS, `List at most ${MAX_ITEMS} items.`),
    dateOut: dateSchema("date out"),
    dateDue: dateSchema("return date"),
    notes: z
      .string()
      .trim()
      .max(1000)
      .transform((v) => v || null),
  })
  .refine((v) => v.dateDue >= v.dateOut, {
    message: "The return date can't be before the date out.",
  });

// Item rows post parallel lists; rows left completely blank are ignored.
function parseLoan(formData: FormData) {
  const descriptions = formData.getAll("itemDescription").map(String);
  const quantities = formData.getAll("itemQuantity").map(String);
  const rows = descriptions
    .map((description, i) => ({ description: description.trim(), quantity: (quantities[i] ?? "").trim() }))
    .filter((row) => row.description || row.quantity);
  if (rows.some((row) => !row.description)) {
    return { error: "Describe each item, or clear the row." } as const;
  }
  const parsed = loanSchema.safeParse({
    items: rows,
    dateOut: formData.get("dateOut") ?? "",
    dateDue: formData.get("dateDue") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." } as const;
  return { data: parsed.data } as const;
}

const reasonSchema = z.string().trim().max(1000);

export async function createLoan(_state: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  if (formData.get("acknowledge") !== "on") {
    return { error: "Check the box to accept responsibility for the equipment." };
  }
  const parsed = parseLoan(formData);
  if ("error" in parsed) return { error: parsed.error };
  if (parsed.data.dateOut < departmentToday()) {
    return { error: "The date out can't be in the past." };
  }

  const { items, ...rest } = parsed.data;
  const loan = await prisma.equipmentLoan.create({
    data: {
      ...rest,
      borrowerId: session.user.id,
      acknowledgement: LOAN_ACKNOWLEDGEMENT,
      items: { create: items.map((item, sortOrder) => ({ ...item, sortOrder })) },
    },
  });
  await recordEvent("EQUIPMENT_LOAN", loan.id, session.user.id, "Requested");
  await notifyOfficersOfLoanRequest(loan.id);
  redirect(`/loans/${loan.id}?created=1`);
}

// The borrower can change a request until it's approved; officers can also
// change an approved loan (for example, extend the return date).
export async function updateLoan(
  loanId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = parseLoan(formData);
  if ("error" in parsed) return { error: parsed.error };

  const before = await prisma.equipmentLoan.findUnique({
    where: { id: loanId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!before) return { error: "This loan no longer exists." };
  const isOfficer = session.user.role === "OFFICER";
  const canEdit =
    (before.status === "REQUESTED" && (isOfficer || before.borrowerId === session.user.id)) ||
    (before.status === "APPROVED" && isOfficer);
  if (!canEdit) {
    return {
      error:
        before.status === "APPROVED"
          ? "This loan is approved. Ask an officer to change it."
          : "This loan is closed, so it can't be changed.",
    };
  }

  const after = parsed.data;
  const changes = [
    itemsSummary(before.items) !== itemsSummary(after.items) &&
      `Items: ${itemsSummary(before.items)} → ${itemsSummary(after.items)}`,
    before.dateOut.getTime() !== after.dateOut.getTime() &&
      `Date out: ${formatDateOnly(before.dateOut)} → ${formatDateOnly(after.dateOut)}`,
    before.dateDue.getTime() !== after.dateDue.getTime() &&
      `Return by: ${formatDateOnly(before.dateDue)} → ${formatDateOnly(after.dateDue)}`,
    (before.notes ?? "") !== (after.notes ?? "") && "Notes changed",
  ].filter((c): c is string => Boolean(c));
  if (changes.length === 0) return { message: "No changes to save." };

  const { items, ...rest } = after;
  await prisma.$transaction([
    prisma.loanItem.deleteMany({ where: { loanId } }),
    prisma.equipmentLoan.update({
      where: { id: loanId },
      data: {
        ...rest,
        // A new return date gets its own due-today reminder.
        ...(before.dateDue.getTime() !== after.dateDue.getTime() && { lastReminderAt: null }),
        items: { create: items.map((item, sortOrder) => ({ ...item, sortOrder })) },
      },
    }),
  ]);
  await recordEvent("EQUIPMENT_LOAN", loanId, session.user.id, changes.join("; "));
  refresh();
  return { message: "Saved." };
}

// Another officer approves or denies; an officer can't decide their own loan
// (interim rule until the officers decide).
async function requireDecidableLoan(loanId: string) {
  const session = await requireOfficer();
  const loan = await prisma.equipmentLoan.findUnique({ where: { id: loanId } });
  if (!loan) return { error: "This loan no longer exists." } as const;
  if (loan.status !== "REQUESTED") return { error: "This loan has already been decided." } as const;
  if (loan.borrowerId === session.user.id) {
    return { error: "Another officer needs to decide your own loan request." } as const;
  }
  return { session, loan } as const;
}

export async function approveLoan(loanId: string): Promise<FormState> {
  const checked = await requireDecidableLoan(loanId);
  if ("error" in checked) return { error: checked.error };

  await prisma.equipmentLoan.update({
    where: { id: loanId },
    data: { status: "APPROVED", approvedAt: new Date(), approvedById: checked.session.user.id },
  });
  await recordEvent("EQUIPMENT_LOAN", loanId, checked.session.user.id, "Approved");
  await notifyBorrowerOfDecision(loanId);
  refresh();
  return {};
}

export async function denyLoan(loanId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const parsed = reasonSchema.safeParse(formData.get("reason") ?? "");
  if (!parsed.success) return { error: "Keep the reason under 1,000 characters." };
  if (!parsed.data) return { error: "Give a short reason for denying it." };
  const checked = await requireDecidableLoan(loanId);
  if ("error" in checked) return { error: checked.error };

  await prisma.equipmentLoan.update({
    where: { id: loanId },
    data: { status: "DENIED", statusReason: parsed.data },
  });
  await recordEvent("EQUIPMENT_LOAN", loanId, checked.session.user.id, `Denied (${parsed.data})`);
  await notifyBorrowerOfDecision(loanId);
  refresh();
  return {};
}

// An officer verifies the return and notes any damage or missing items.
export async function markLoanReturned(
  loanId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOfficer();
  const withIssue = formData.get("withIssue") === "on";
  const parsed = reasonSchema.safeParse(formData.get("returnNote") ?? "");
  if (!parsed.success) return { error: "Keep the note under 1,000 characters." };
  if (withIssue && !parsed.data) return { error: "Describe what's damaged or missing." };

  const loan = await prisma.equipmentLoan.findUnique({ where: { id: loanId } });
  if (!loan) return { error: "This loan no longer exists." };
  if (loan.status !== "APPROVED") return { error: "Only an approved loan can be returned." };

  await prisma.equipmentLoan.update({
    where: { id: loanId },
    data: {
      status: "RETURNED",
      returnedAt: new Date(),
      returnedById: session.user.id,
      returnedWithIssue: withIssue,
      returnNote: parsed.data || null,
    },
  });
  await recordEvent(
    "EQUIPMENT_LOAN",
    loanId,
    session.user.id,
    withIssue ? `Returned with an issue (${parsed.data})` : `Returned${parsed.data ? ` (${parsed.data})` : ""}`,
  );
  refresh();
  return {};
}

// The borrower or an officer can cancel before the equipment goes out. Once
// it's out, an officer marks it returned instead.
export async function cancelLoan(loanId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = reasonSchema.safeParse(formData.get("reason") ?? "");
  if (!parsed.success) return { error: "Keep the reason under 1,000 characters." };

  const loan = await prisma.equipmentLoan.findUnique({ where: { id: loanId } });
  if (!loan) return { error: "This loan no longer exists." };
  if (loan.borrowerId !== session.user.id && session.user.role !== "OFFICER") {
    return { error: "Only the borrower, or an officer, can cancel it." };
  }
  if (loan.status !== "REQUESTED" && loan.status !== "APPROVED") {
    return { error: "This loan is already closed." };
  }
  if (isOut(loan)) {
    return { error: "This equipment is already out. An officer marks it returned instead." };
  }

  await prisma.equipmentLoan.update({
    where: { id: loanId },
    data: { status: "CANCELED", statusReason: parsed.data || null },
  });
  await recordEvent(
    "EQUIPMENT_LOAN",
    loanId,
    session.user.id,
    `Status: ${LOAN_STATUS[loan.status].label} → Canceled${parsed.data ? ` (${parsed.data})` : ""}`,
  );
  refresh();
  return {};
}
