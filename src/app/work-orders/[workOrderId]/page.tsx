import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { requireSession } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  OUT_OF_SERVICE_BADGE,
  WORK_ORDER_STATUS,
  subjectLabel,
  subjectOptions,
  subjectValue,
} from "@/lib/work-orders";
import {
  addWorkOrderNote,
  cancelWorkOrder,
  resolveWorkOrder,
  setOutOfService,
  updateWorkOrder,
} from "../actions";
import { WorkOrderFields } from "../WorkOrderFields";

export const metadata: Metadata = {
  title: "Work Order | Equipment Checks",
};

const buttonClass =
  "rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50";
const inputClass = "rounded-md border border-gray-300 px-3 py-2 text-sm";

export default async function WorkOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ workOrderId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await requireSession();
  const { workOrderId } = await params;
  const { created } = await searchParams;

  const [workOrder, history] = await Promise.all([
    prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        reportedBy: { select: { name: true } },
        resolvedBy: { select: { name: true } },
        apparatus: { select: { name: true, unitNumber: true } },
        equipmentItem: { select: { name: true } },
        checkItemResult: {
          select: {
            note: true,
            submission: {
              select: { id: true, submittedAt: true, template: { select: { name: true } } },
            },
          },
        },
        loan: { select: { id: true, borrower: { select: { name: true } } } },
        notes: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        },
      },
    }),
    prisma.recordEvent.findMany({
      where: { entityType: "WORK_ORDER", entityId: workOrderId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    }),
  ]);
  if (!workOrder) notFound();

  const open = workOrder.status === "OPEN";
  const isOfficer = session.user.role === "OFFICER";
  const canCancel = open && (isOfficer || workOrder.reportedById === session.user.id);
  const status = WORK_ORDER_STATUS[workOrder.status];
  const subject = subjectLabel(workOrder);
  const fromCheck = workOrder.checkItemResult?.submission;
  const options = open ? await subjectOptions(workOrder) : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/work-orders" className="text-sm text-gray-500 hover:text-black">
          ← Work orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{workOrder.title}</h1>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
          {open && workOrder.outOfService && <span className={OUT_OF_SERVICE_BADGE}>Out of service</span>}
        </div>
        <p className="text-sm text-gray-500">
          {subject ? `${subject} · ` : ""}Reported by {workOrder.reportedBy.name} ·{" "}
          {formatDateTime(workOrder.createdAt)}
        </p>
      </div>

      {created && (
        <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          Work order submitted. Officers have been notified.
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-md border border-gray-200 bg-white p-4 text-sm">
        <dt className="text-gray-500">Vehicle or equipment</dt>
        <dd>{subject ?? "Not specified"}</dd>
        {workOrder.description && (
          <>
            <dt className="text-gray-500">Details</dt>
            <dd className="whitespace-pre-wrap">{workOrder.description}</dd>
          </>
        )}
        {fromCheck && (
          <>
            <dt className="text-gray-500">From check</dt>
            <dd>
              {isOfficer ? (
                <Link href={`/officer/checks/${fromCheck.id}`} className="underline">
                  {fromCheck.template.name}, {formatDateTime(fromCheck.submittedAt)}
                </Link>
              ) : (
                `${fromCheck.template.name}, ${formatDateTime(fromCheck.submittedAt)}`
              )}
            </dd>
          </>
        )}
        {workOrder.loan && (
          <>
            <dt className="text-gray-500">From loan</dt>
            <dd>
              <Link href={`/loans/${workOrder.loan.id}`} className="underline">
                Equipment loan to {workOrder.loan.borrower.name}
              </Link>
            </dd>
          </>
        )}
        {workOrder.status === "RESOLVED" && (
          <>
            <dt className="text-gray-500">Resolved</dt>
            <dd>
              {workOrder.resolvedAt && formatDateTime(workOrder.resolvedAt)}
              {workOrder.resolvedBy && ` by ${workOrder.resolvedBy.name}`}
              {workOrder.statusReason && (
                <span className="block whitespace-pre-wrap">{workOrder.statusReason}</span>
              )}
            </dd>
          </>
        )}
        {workOrder.status === "CANCELED" && workOrder.statusReason && (
          <>
            <dt className="text-gray-500">Canceled</dt>
            <dd>{workOrder.statusReason}</dd>
          </>
        )}
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Progress notes</h2>
        {workOrder.notes.length === 0 ? (
          <p className="text-sm text-gray-500">No notes yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white text-sm">
            {workOrder.notes.map((note) => (
              <li key={note.id} className="px-4 py-2">
                <p className="whitespace-pre-wrap">{note.body}</p>
                <p className="text-gray-500">
                  {note.author.name} · {formatDateTime(note.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {open && (
          <ActionForm
            action={addWorkOrderNote.bind(null, workOrder.id)}
            className="flex flex-wrap items-start gap-2"
          >
            <textarea
              name="body"
              rows={2}
              maxLength={1000}
              placeholder='e.g. "Replacement ordered" or "Replaced, tested OK"'
              aria-label="Progress note"
              className={`${inputClass} min-w-56 flex-1`}
            />
            <button type="submit" className={buttonClass}>
              Add note
            </button>
          </ActionForm>
        )}
        {open && (
          <p className="text-xs text-gray-500">
            Notes are dated and kept permanently. Equipment only; don&apos;t include patient or
            incident details.
          </p>
        )}
      </section>

      {open && isOfficer && (
        <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="font-semibold">Officer actions</h2>
          <ActionForm action={setOutOfService.bind(null, workOrder.id, !workOrder.outOfService)}>
            {workOrder.outOfService ? (
              <button type="submit" className={buttonClass}>
                Return to service
              </button>
            ) : (
              <button
                type="submit"
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Mark out of service
              </button>
            )}
          </ActionForm>
          <ActionForm
            action={resolveWorkOrder.bind(null, workOrder.id)}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              name="reason"
              maxLength={1000}
              placeholder="How it was resolved"
              aria-label="How it was resolved"
              className={`${inputClass} min-w-56 flex-1`}
            />
            <button
              type="submit"
              className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              Resolve
            </button>
          </ActionForm>
          {workOrder.outOfService && (
            <p className="text-xs text-gray-500">Resolving also returns it to service.</p>
          )}
        </section>
      )}

      {open && options && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Edit work order</h2>
          <p className="text-sm text-gray-500">
            Any member can correct an open work order; changes are recorded below.
          </p>
          <ActionForm
            action={updateWorkOrder.bind(null, workOrder.id)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <WorkOrderFields
              options={options}
              defaults={{ ...workOrder, subject: subjectValue(workOrder) }}
            />
            <button type="submit" className={`${buttonClass} justify-self-start`}>
              Save changes
            </button>
          </ActionForm>
        </section>
      )}

      {canCancel && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Cancel work order</h2>
          <ActionForm
            action={cancelWorkOrder.bind(null, workOrder.id)}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              name="reason"
              maxLength={1000}
              placeholder="Reason (optional), e.g. duplicate"
              aria-label="Reason for canceling"
              className={`${inputClass} min-w-56 flex-1`}
            />
            <button type="submit" className={buttonClass}>
              Cancel work order
            </button>
          </ActionForm>
          <p className="text-xs text-gray-500">Canceled work orders are kept in the archive.</p>
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
