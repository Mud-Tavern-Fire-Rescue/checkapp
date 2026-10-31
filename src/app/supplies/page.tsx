import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { z } from "zod";
import { requireSession } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  OPEN_SUPPLY_STATUSES,
  SUPPLY_STATUS,
  departmentToday,
  formatDateOnly,
  isOpen,
  parseDateOnly,
} from "@/lib/supplies";

export const metadata: Metadata = {
  title: "Supply Requests | Equipment Checks",
};

const PAGE_SIZE = 50;

// "open" (default) hides archived requests; "all" shows everything.
const STATUS_FILTERS = ["open", "all", "REQUESTED", "ORDERED", "RECEIVED", "DENIED", "CANCELED"] as const;

const filtersSchema = z.object({
  status: z.enum(STATUS_FILTERS).catch("open"),
  q: z.string().trim().max(100).catch(""),
  requester: z.string().trim().max(50).catch(""),
  from: z.string().trim().catch(""),
  to: z.string().trim().catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});

type Filters = z.infer<typeof filtersSchema>;

function hrefWith(filters: Filters, page: number) {
  const params = new URLSearchParams();
  if (filters.status !== "open") params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  if (filters.requester) params.set("requester", filters.requester);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/supplies${query ? `?${query}` : ""}`;
}

const inputClass = "rounded-md border border-gray-300 px-3 py-2 text-sm";

export default async function SuppliesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireSession();
  const raw = await searchParams;
  const filters = filtersSchema.parse({
    status: raw.status ?? "open",
    q: raw.q ?? "",
    requester: raw.requester ?? "",
    from: raw.from ?? "",
    to: raw.to ?? "",
    page: raw.page ?? 1,
  });

  const from = filters.from ? parseDateOnly(filters.from) : null;
  const to = filters.to ? parseDateOnly(filters.to) : null;

  const where: Prisma.SupplyRequestWhereInput = {
    ...(filters.status === "open"
      ? { status: { in: OPEN_SUPPLY_STATUSES } }
      : filters.status !== "all" && { status: filters.status }),
    ...(filters.q && {
      OR: [
        { item: { contains: filters.q, mode: "insensitive" } },
        { notes: { contains: filters.q, mode: "insensitive" } },
      ],
    }),
    ...(filters.requester && { requestedById: filters.requester }),
    ...((from || to) && {
      dateNeeded: { ...(from && { gte: from }), ...(to && { lte: to }) },
    }),
  };

  // Open requests sort by when they're needed (soonest first); everything
  // else newest first.
  const orderBy: Prisma.SupplyRequestOrderByWithRelationInput[] =
    filters.status === "open" || filters.status === "REQUESTED" || filters.status === "ORDERED"
      ? [{ dateNeeded: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]
      : [{ createdAt: "desc" }];

  const [requesters, total, requests] = await Promise.all([
    prisma.user.findMany({
      where: { supplyRequests: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.supplyRequest.count({ where }),
    prisma.supplyRequest.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { requestedBy: { select: { name: true } } },
    }),
  ]);

  const today = departmentToday();
  const firstShown = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(filters.page * PAGE_SIZE, total);
  const hasFilters = !!(
    filters.status !== "open" ||
    filters.q ||
    filters.requester ||
    filters.from ||
    filters.to
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Supply Requests</h1>
        <Link
          href="/supplies/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Request supplies
        </Link>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select name="status" defaultValue={filters.status} className={inputClass}>
            <option value="open">Open (requested or ordered)</option>
            <option value="all">All, including archived</option>
            {Object.entries(SUPPLY_STATUS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Search
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Item or notes"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Requested by
          <select name="requester" defaultValue={filters.requester} className={inputClass}>
            <option value="">Anyone</option>
            {requesters.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Needed from
          <input type="date" name="from" defaultValue={filters.from} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Needed to
          <input type="date" name="to" defaultValue={filters.to} className={inputClass} />
        </label>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Filter
        </button>
        {hasFilters && (
          <Link href="/supplies" className="py-2 text-sm text-gray-600 hover:text-black">
            Clear filters
          </Link>
        )}
      </form>

      <p className="text-sm text-gray-600">
        {total === 0
          ? "No requests match."
          : `Showing ${firstShown}–${lastShown} of ${total} request${total === 1 ? "" : "s"}.`}
      </p>

      {requests.length > 0 && (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {requests.map((request) => {
            const status = SUPPLY_STATUS[request.status];
            const late = isOpen(request.status) && request.dateNeeded && request.dateNeeded < today;
            return (
              <li key={request.id}>
                <Link
                  href={`/supplies/${request.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium">
                      {request.item}{" "}
                      <span className="font-normal text-gray-500">· {request.quantity}</span>
                    </p>
                    <p className={late ? "font-medium text-red-700" : "text-gray-500"}>
                      Needed by{" "}
                      {request.dateNeeded ? formatDateOnly(request.dateNeeded) : "—"}
                      {late && " (past due)"}
                    </p>
                    <p className="text-gray-500">
                      {request.requestedBy.name} · {formatDateTime(request.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${status.className}`}
                  >
                    {status.label}
                  </span>
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
