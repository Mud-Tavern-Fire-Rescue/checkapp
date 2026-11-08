import type { LoanStatus } from "@prisma/client";
import { sendEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { activeOfficerEmails, deliveryEmail, deliveryEmailSelect } from "@/lib/recipients";
import { departmentToday, formatDateOnly } from "@/lib/supplies";

export const LOAN_STATUS: Record<LoanStatus, { label: string; className: string }> = {
  REQUESTED: { label: "Requested", className: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "Approved", className: "bg-blue-100 text-blue-800" },
  RETURNED: { label: "Returned", className: "bg-green-100 text-green-800" },
  DENIED: { label: "Denied", className: "bg-red-100 text-red-700" },
  CANCELED: { label: "Canceled", className: "bg-gray-100 text-gray-600" },
};

export const ACTIVE_LOAN_STATUSES: LoanStatus[] = ["REQUESTED", "APPROVED"];

// PLACEHOLDER until the department finishes its loan policy (it should also
// cover normal wear and tear). Each loan stores the wording the borrower
// agreed to, so changing this later doesn't alter past loans.
export const LOAN_ACKNOWLEDGEMENT =
  "I am responsible for this equipment while it is in my care. I will return it on time and in " +
  "the condition I received it, and I accept responsibility for damage, loss, or replacement " +
  "beyond normal wear and tear, as set out in the department's equipment loan policy.";

type Dated = { status: LoanStatus; dateOut: Date; dateDue: Date };

// Approved and its date out has arrived.
export function isOut(loan: Dated, today = departmentToday()) {
  return loan.status === "APPROVED" && loan.dateOut <= today;
}

export function isOverdue(loan: Dated, today = departmentToday()) {
  return loan.status === "APPROVED" && loan.dateDue < today;
}

export function itemsSummary(items: { description: string; quantity: number }[]) {
  return items.map((i) => (i.quantity === 1 ? i.description : `${i.quantity} × ${i.description}`)).join(", ");
}

function appLink(path: string) {
  const appUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  return appUrl ? [``, `View it: ${appUrl}${path}`] : [];
}

async function loadLoan(loanId: string) {
  return prisma.equipmentLoan.findUnique({
    where: { id: loanId },
    include: {
      borrower: { select: { name: true, ...deliveryEmailSelect } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
}

function loanLines(loan: NonNullable<Awaited<ReturnType<typeof loadLoan>>>) {
  return [
    "Items:",
    ...loan.items.map((i) => `  - ${i.quantity} × ${i.description}`),
    `Out: ${formatDateOnly(loan.dateOut)}`,
    `Return by: ${formatDateOnly(loan.dateDue)}`,
    ...(loan.notes ? [`Notes: ${loan.notes}`] : []),
  ];
}

// The functions below never throw: the loan change is already saved, and a
// missing email shouldn't undo it.

export async function notifyOfficersOfLoanRequest(loanId: string) {
  try {
    const [loan, to] = await Promise.all([loadLoan(loanId), activeOfficerEmails()]);
    if (!loan || to.length === 0) return;
    await sendEmail({
      to,
      subject: `Equipment loan request: ${loan.borrower.name} (${formatDateOnly(loan.dateOut)})`,
      text: [
        `${loan.borrower.name} asked to borrow equipment. An officer needs to approve or deny it.`,
        "",
        ...loanLines(loan),
        ...appLink(`/loans/${loan.id}`),
        "",
        "Sent automatically by MTVFR Equipment Checks to all active officers.",
      ].join("\n"),
    });
  } catch (error) {
    console.error("Loan request email could not be sent", error);
  }
}

export async function notifyBorrowerOfDecision(loanId: string) {
  try {
    const loan = await loadLoan(loanId);
    if (!loan || (loan.status !== "APPROVED" && loan.status !== "DENIED")) return;
    const approved = loan.status === "APPROVED";
    await sendEmail({
      to: [deliveryEmail(loan.borrower)],
      subject: `Equipment loan ${approved ? "approved" : "denied"}`,
      text: [
        approved
          ? "Your equipment loan request was approved."
          : `Your equipment loan request was denied${loan.statusReason ? `: ${loan.statusReason}` : "."}`,
        "",
        ...loanLines(loan),
        ...appLink(`/loans/${loan.id}`),
        "",
        "Sent automatically by MTVFR Equipment Checks.",
      ].join("\n"),
    });
  } catch (error) {
    console.error("Loan decision email could not be sent", error);
  }
}

// Emails each borrower whose loan is due back today: one reminder per loan,
// nothing after (department decision 2026-11-07). Run once a day (see
// vercel.json). Returns how many were sent.
export async function sendDueTodayReminders(now = new Date()) {
  const today = departmentToday();
  const loans = await prisma.equipmentLoan.findMany({
    where: { status: "APPROVED", dateDue: today, lastReminderAt: null },
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  for (const { id } of loans) {
    const loan = await loadLoan(id);
    if (!loan) continue;
    try {
      await sendEmail({
        to: [deliveryEmail(loan.borrower)],
        subject: "Reminder: borrowed equipment is due back today",
        text: [
          `The equipment you borrowed is due back today, ${formatDateOnly(loan.dateDue)}.`,
          "",
          ...loanLines(loan),
          "",
          "If you need more time, ask an officer to change the return date.",
          ...appLink(`/loans/${loan.id}`),
          "",
          "Sent automatically by MTVFR Equipment Checks.",
        ].join("\n"),
      });
      await prisma.equipmentLoan.update({ where: { id }, data: { lastReminderAt: now } });
      sent++;
    } catch (error) {
      failed++;
      console.error(`Due-today reminder for loan ${id} could not be sent`, error);
    }
  }
  return { dueToday: loans.length, sent, failed };
}
