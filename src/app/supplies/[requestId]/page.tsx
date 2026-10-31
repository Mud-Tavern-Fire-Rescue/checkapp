import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { requireSession } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { SUPPLY_STATUS, departmentToday, formatDateOnly, isOpen } from "@/lib/supplies";
import { cancelSupplyRequest, setSupplyStatus, updateSupplyRequest } from "../actions";
import { SupplyFields } from "../SupplyFields";

export const metadata: Metadata = {
  title: "Supply Request | Equipment Checks",
};

const buttonClass =
  "rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50";
const inputClass = "rounded-md border border-gray-300 px-3 py-2 text-sm";

export default async function SupplyRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await requireSession();
  const { requestId } = await params;
  const { created } = await searchParams;

  const [request, history] = await Promise.all([
    prisma.supplyRequest.findUnique({
      where: { id: requestId },
      include: {
        requestedBy: { select: { name: true } },
        receivedBy: { select: { name: true } },
      },
    }),
    prisma.recordEvent.findMany({
      where: { entityType: "SUPPLY_REQUEST", entityId: requestId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    }),
  ]);
  if (!request) notFound();

  const open = isOpen(request.status);
  const isOfficer = session.user.role === "OFFICER";
  const canCancel = open && (isOfficer || request.requestedById === session.user.id);
  const late = open && request.dateNeeded && request.dateNeeded < departmentToday();
  const status = SUPPLY_STATUS[request.status];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/supplies" className="text-sm text-gray-500 hover:text-black">
          ← Supply requests
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{request.item}</h1>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Requested by {request.requestedBy.name} · {formatDateTime(request.createdAt)}
        </p>
      </div>

      {created && (
        <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          Request submitted. Officers have been notified.
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-md border border-gray-200 bg-white p-4 text-sm">
        <dt className="text-gray-500">Quantity</dt>
        <dd>{request.quantity}</dd>
        <dt className="text-gray-500">Date needed</dt>
        <dd className={late ? "font-medium text-red-700" : ""}>
          {request.dateNeeded ? formatDateOnly(request.dateNeeded) : "Not specified"}
          {late && " (past due)"}
        </dd>
        {request.notes && (
          <>
            <dt className="text-gray-500">Notes</dt>
            <dd className="whitespace-pre-wrap">{request.notes}</dd>
          </>
        )}
        {request.statusReason && (
          <>
            <dt className="text-gray-500">Reason</dt>
            <dd>{request.statusReason}</dd>
          </>
        )}
        {request.receivedAt && (
          <>
            <dt className="text-gray-500">Received</dt>
            <dd>
              {formatDateTime(request.receivedAt)}
              {request.receivedBy && ` by ${request.receivedBy.name}`}
            </dd>
          </>
        )}
      </dl>

      {open && isOfficer && (
        <section className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
          <h2 className="font-semibold">Officer actions</h2>
          <div className="flex flex-wrap gap-2">
            {request.status !== "ORDERED" && (
              <ActionForm action={setSupplyStatus.bind(null, request.id, "ORDERED")}>
                <button type="submit" className={buttonClass}>
                  Mark ordered
                </button>
              </ActionForm>
            )}
            <ActionForm action={setSupplyStatus.bind(null, request.id, "RECEIVED")}>
              <button
                type="submit"
                className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
              >
                Mark received
              </button>
            </ActionForm>
          </div>
          <ActionForm
            action={setSupplyStatus.bind(null, request.id, "DENIED")}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              name="reason"
              maxLength={500}
              placeholder="Reason for denying"
              aria-label="Reason for denying"
              className={`${inputClass} min-w-56 flex-1`}
            />
            <button type="submit" className={buttonClass}>
              Deny
            </button>
          </ActionForm>
        </section>
      )}

      {open && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Edit request</h2>
          <p className="text-sm text-gray-500">Any member can update an open request; changes are recorded below.</p>
          <ActionForm
            action={updateSupplyRequest.bind(null, request.id)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <SupplyFields defaults={request} />
            <button type="submit" className={`${buttonClass} justify-self-start`}>
              Save changes
            </button>
          </ActionForm>
        </section>
      )}

      {canCancel && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Cancel request</h2>
          <ActionForm
            action={cancelSupplyRequest.bind(null, request.id)}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              name="reason"
              maxLength={500}
              placeholder="Reason (optional)"
              aria-label="Reason for canceling"
              className={`${inputClass} min-w-56 flex-1`}
            />
            <button type="submit" className={buttonClass}>
              Cancel request
            </button>
          </ActionForm>
          <p className="text-xs text-gray-500">Canceled requests are kept in the archive.</p>
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
