import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { z } from "zod";
import { requireSession } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  OUT_OF_SERVICE_BADGE,
  WORK_ORDER_STATUS,
  parseSubject,
  subjectLabel,
  subjectOptions,
} from "@/lib/work-orders";

export const metadata: Metadata = {
  title: "Work Orders | Equipment Checks",
};

const PAGE_SIZE = 50;

// "OPEN" (default) hides archived work orders; "all" shows everything.
const STATUS_FILTERS = ["OPEN", "all", "RESOLVED", "CANCELED"] as const;

const filtersSchema = z.object({
  status: z.enum(STATUS_FILTERS).catch("OPEN"),
  subject: z.string().trim().max(60).catch(""),
  q: z.string().trim().max(100).catch(""),
  oos: z.literal("1").or(z.literal("")).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});

type Filters = z.infer<typeof filtersSchema>;

function hrefWith(filters: Filters, page: number) {
  const params = new URLSearchParams();
  if (filters.status !== "OPEN") params.set("status", filters.status);
  if (filters.subject) params.set("subject", filters.subject);
  if (filters.q) params.set("q", filters.q);
  if (filters.oos) params.set("oos", "1");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/work-orders${query ? `?${query}` : ""}`;
}

const inputClass = "rounded-md border border-gray-300 px-3 py-2 text-sm";

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireSession();
  const raw = await searchParams;
  const filters = filtersSchema.parse({
    status: raw.status ?? "OPEN",
    subject: raw.subject ?? "",
    q: raw.q ?? "",
    oos: raw.oos ?? "",
    page: raw.page ?? 1,
  });

  const subject = parseSubject(filters.subject);
  const where: Prisma.WorkOrderWhereInput = {
    ...(filters.status !== "all" && { status: filters.status }),
    ...(subject.apparatusId && { apparatusId: subject.apparatusId }),
    ...(subject.equipmentItemId && { equipmentItemId: subject.equipmentItemId }),
    ...(filters.oos && { outOfService: true, status: "OPEN" }),
    ...(filters.q && {
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
        { notes: { some: { body: { contains: filters.q, mode: "insensitive" } } } },
      ],
    }),
  };

  // Out-of-service work orders first, then most recently active.
  const orderBy: Prisma.WorkOrderOrderByWithRelationInput[] =
    filters.status === "OPEN"
      ? [{ outOfService: "desc" }, { updatedAt: "desc" }]
      : [{ updatedAt: "desc" }];

  const [options, total, workOrders] = await Promise.all([
    subjectOptions(),
    prisma.workOrder.count({ where }),
    prisma.workOrder.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        reportedBy: { select: { name: true } },
        apparatus: { select: { name: true, unitNumber: true } },
        equipmentItem: { select: { name: true } },
        _count: { select: { notes: true } },
      },
    }),
  ]);

  const firstShown = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(filters.page * PAGE_SIZE, total);
  const hasFilters = !!(filters.status !== "OPEN" || filters.subject || filters.q || filters.oos);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Work Orders</h1>
        <Link
          href="/work-orders/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          New work order
        </Link>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select name="status" defaultValue={filters.status} className={inputClass}>
            <option value="OPEN">Open</option>
            <option value="all">All, including archived</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CANCELED">Canceled</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Vehicle or equipment
          <select name="subject" defaultValue={filters.subject} className={inputClass}>
            <option value="">All</option>
            <optgroup label="Vehicles">
              {options.vehicles.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            {options.equipment.length > 0 && (
              <optgroup label="Equipment">
                {options.equipment.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Search
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Problem, details, or notes"
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 py-2 text-sm font-medium">
          <input type="checkbox" name="oos" value="1" defaultChecked={!!filters.oos} />
          Out of service only
        </label>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Filter
        </button>
        {hasFilters && (
          <Link href="/work-orders" className="py-2 text-sm text-gray-600 hover:text-black">
            Clear filters
          </Link>
        )}
      </form>

      <p className="text-sm text-gray-600">
        {total === 0
          ? "No work orders match."
          : `Showing ${firstShown}–${lastShown} of ${total} work order${total === 1 ? "" : "s"}.`}
      </p>

      {workOrders.length > 0 && (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {workOrders.map((workOrder) => {
            const status = WORK_ORDER_STATUS[workOrder.status];
            const label = subjectLabel(workOrder);
            return (
              <li key={workOrder.id}>
                <Link
                  href={`/work-orders/${workOrder.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium">
                      {label && <span className="text-gray-500">{label} · </span>}
                      {workOrder.title}
                    </p>
                    <p className="text-gray-500">
                      {workOrder.reportedBy.name} · {formatDateTime(workOrder.createdAt)}
                      {workOrder._count.notes > 0 &&
                        ` · ${workOrder._count.notes} note${workOrder._count.notes === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {workOrder.status === "OPEN" && workOrder.outOfService && (
                      <span className={OUT_OF_SERVICE_BADGE}>Out of service</span>
                    )}
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <nav className="flex items-center justify-between text-sm">
          {filters.page > 1 ? (
            <Link href={hrefWith(filters, filters.page - 1)} className="text-gray-700 hover:text-black">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {lastShown < total && (
            <Link href={hrefWith(filters, filters.page + 1)} className="text-gray-700 hover:text-black">
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
