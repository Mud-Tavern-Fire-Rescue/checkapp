import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { requireSession } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { LOAN_STATUS, isOut, isOverdue } from "@/lib/loans";
import { prisma } from "@/lib/prisma";
import { dateOnlyInputValue, departmentToday, formatDateOnly } from "@/lib/supplies";
import { WORK_ORDER_STATUS } from "@/lib/work-orders";
import { approveLoan, cancelLoan, denyLoan, markLoanReturned, updateLoan } from "../actions";
import { LoanFields } from "../LoanFields";

export const metadata: Metadata = {
  title: "Equipment Loan | Equipment Checks",
};

const buttonClass =
  "rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50";
const inputClass = "rounded-md border border-gray-300 px-3 py-2 text-sm";

export default async function LoanPage({
  params,
  searchParams,
}: {
  params: Promise<{ loanId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await requireSession();
  const { loanId } = await params;
  const { created } = await searchParams;

  const [loan, history] = await Promise.all([
    prisma.equipmentLoan.findUnique({
      where: { id: loanId },
      include: {
        borrower: { select: { name: true } },
        approvedBy: { select: { name: true } },
        returnedBy: { select: { name: true } },
        items: { orderBy: { sortOrder: "asc" } },
        workOrders: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, status: true } },
      },
    }),
    prisma.recordEvent.findMany({
      where: { entityType: "EQUIPMENT_LOAN", entityId: loanId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    }),
  ]);
  if (!loan) notFound();

  const today = departmentToday();
  const isOfficer = session.user.role === "OFFICER";
  const isBorrower = loan.borrowerId === session.user.id;
  const out = isOut(loan, today);
  const overdue = isOverdue(loan, today);
  const canDecide = isOfficer && loan.status === "REQUESTED" && !isBorrower;
  const canEdit =
    (loan.status === "REQUESTED" && (isOfficer || isBorrower)) || (loan.status === "APPROVED" && isOfficer);
  const canCancel = (loan.status === "REQUESTED" || loan.status === "APPROVED") && !out && (isOfficer || isBorrower);
  const status = LOAN_STATUS[loan.status];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/loans" className="text-sm text-gray-500 hover:text-black">
          ← Equipment loans
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Loan to {loan.borrower.name}</h1>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
          {overdue ? (
            <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">Overdue</span>
          ) : (
            out && <span className="rounded-full bg-blue-600 px-2 py-1 text-xs font-semibold text-white">Out</span>
          )}
        </div>
        <p className="text-sm text-gray-500">Requested {formatDateTime(loan.createdAt)}</p>
      </div>

      {created && (
        <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          Request submitted. Officers have been notified, and you&apos;ll get an email when it&apos;s decided.
        </p>
      )}

      <section className="rounded-md border border-gray-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">Items</h2>
        <ul className="flex flex-col gap-1">
          {loan.items.map((item) => (
            <li key={item.id}>
              <span className="font-medium">{item.quantity} ×</span> {item.description}
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-gray-500">Date out</dt>
          <dd>{formatDateOnly(loan.dateOut)}</dd>
          <dt className="text-gray-500">Return by</dt>
          <dd className={overdue ? "font-medium text-red-700" : ""}>
            {formatDateOnly(loan.dateDue)}
            {overdue && " (overdue)"}
          </dd>
          {loan.notes && (
            <>
              <dt className="text-gray-500">Notes</dt>
              <dd className="whitespace-pre-wrap">{loan.notes}</dd>
            </>
          )}
          {loan.approvedAt && (
            <>
              <dt className="text-gray-500">Approved</dt>
              <dd>
                {formatDateTime(loan.approvedAt)}
                {loan.approvedBy && ` by ${loan.approvedBy.name}`}
              </dd>
            </>
          )}
          {loan.statusReason && (
            <>
              <dt className="text-gray-500">{loan.status === "DENIED" ? "Denied" : "Canceled"}</dt>
              <dd>{loan.statusReason}</dd>
            </>
          )}
          {loan.returnedAt && (
            <>
              <dt className="text-gray-500">Returned</dt>
              <dd>
                {formatDateTime(loan.returnedAt)}
                {loan.returnedBy && `, verified by ${loan.returnedBy.name}`}
                {loan.returnedWithIssue && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    With an issue
                  </span>
                )}
                {loan.returnNote && <span className="block whitespace-pre-wrap">{loan.returnNote}</span>}
              </dd>
            </>
          )}
          <dt className="text-gray-500">Agreed to</dt>
          <dd className="text-gray-600">
            {loan.acknowledgement}{" "}
            <span className="text-gray-400">({formatDateTime(loan.acknowledgedAt)})</span>
          </dd>
        </dl>
      </section>

      {(loan.workOrders.length > 0 || (loan.returnedWithIssue && isOfficer)) && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Work orders</h2>
          {loan.workOrders.map((w) => (
            <Link key={w.id} href={`/work-orders/${w.id}`} className="text-sm underline">
              {w.title} ({WORK_ORDER_STATUS[w.status].label})
            </Link>
          ))}
          {loan.returnedWithIssue && (
            <Link
              href={`/work-orders/new?loan=${loan.id}`}
              className="self-start rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
            >
              {loan.workOrders.length > 0 ? "Create another work order" : "Create work order"}
            </Link>
          )}
        </section>
      )}

      {isOfficer && loan.status === "REQUESTED" && (
        <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="font-semibold">Officer actions</h2>
          {canDecide ? (
            <>
              <ActionForm action={approveLoan.bind(null, loan.id)}>
                <button
                  type="submit"
                  className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
                >
                  Approve
                </button>
              </ActionForm>
              <ActionForm action={denyLoan.bind(null, loan.id)} className="flex flex-wrap items-center gap-2">
                <input
                  name="reason"
                  maxLength={1000}
                  placeholder="Reason for denying"
                  aria-label="Reason for denying"
                  className={`${inputClass} min-w-56 flex-1`}
                />
                <button type="submit" className={buttonClass}>
                  Deny
                </button>
              </ActionForm>
            </>
          ) : (
            <p className="text-sm text-gray-600">This is your own request, so another officer needs to approve it.</p>
          )}
        </section>
      )}

      {isOfficer && loan.status === "APPROVED" && (
        <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="font-semibold">Verify return</h2>
          <ActionForm action={markLoanReturned.bind(null, loan.id)} className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="withIssue" />
              Returned with an issue (damaged or missing items)
            </label>
            <textarea
              name="returnNote"
              rows={2}
              maxLength={1000}
              placeholder="Condition notes (required if there's an issue)"
              aria-label="Return notes"
              className={inputClass}
            />
            <button
              type="submit"
              className="self-start rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              Mark returned
            </button>
          </ActionForm>
          <p className="text-xs text-gray-500">If there&apos;s an issue, you can open a work order from this loan next.</p>
        </section>
      )}

      {canEdit && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">{loan.status === "APPROVED" ? "Change loan" : "Edit request"}</h2>
          <p className="text-sm text-gray-500">
            {loan.status === "APPROVED"
              ? "Officers can change an approved loan, for example to extend the return date. Changes are recorded below."
              : "You can change the request until an officer approves it. Changes are recorded below."}
          </p>
          <ActionForm action={updateLoan.bind(null, loan.id)} className="grid gap-4 sm:grid-cols-2">
            <LoanFields
              defaults={{
                items: loan.items,
                dateOut: dateOnlyInputValue(loan.dateOut),
                dateDue: dateOnlyInputValue(loan.dateDue),
                notes: loan.notes,
              }}
            />
            <button type="submit" className={`${buttonClass} justify-self-start`}>
              Save changes
            </button>
          </ActionForm>
        </section>
      )}

      {canCancel && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Cancel loan</h2>
          <ActionForm action={cancelLoan.bind(null, loan.id)} className="flex flex-wrap items-center gap-2">
            <input
              name="reason"
              maxLength={1000}
              placeholder="Reason (optional)"
              aria-label="Reason for canceling"
              className={`${inputClass} min-w-56 flex-1`}
            />
            <button type="submit" className={buttonClass}>
              Cancel loan
            </button>
          </ActionForm>
          <p className="text-xs text-gray-500">Canceled loans are kept in the archive.</p>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">History</h2>
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white text-sm">
          {history.map((event) => (
            <li key={event.id} className="px-4 py-2">
              <p>{event.summary}</p>
              <p className="text-gray-500">
                {event.actor.name} · {formatDateTime(event.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
