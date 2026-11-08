import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { z } from "zod";
import { requireSession } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { ACTIVE_LOAN_STATUSES, LOAN_STATUS, isOut, isOverdue, itemsSummary } from "@/lib/loans";
import { prisma } from "@/lib/prisma";
import { departmentToday, formatDateOnly } from "@/lib/supplies";

export const metadata: Metadata = {
  title: "Equipment Loans | Equipment Checks",
};

const PAGE_SIZE = 50;

// "active" (default) is requested or approved; "all" includes archived loans.
const STATUS_FILTERS = ["active", "all", "REQUESTED", "APPROVED", "RETURNED", "DENIED", "CANCELED"] as const;

const filtersSchema = z.object({
  status: z.enum(STATUS_FILTERS).catch("active"),
  borrower: z.string().trim().max(50).catch(""),
  q: z.string().trim().max(100).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});

type Filters = z.infer<typeof filtersSchema>;

function hrefWith(filters: Filters, page: number) {
  const params = new URLSearchParams();
  if (filters.status !== "active") params.set("status", filters.status);
  if (filters.borrower) params.set("borrower", filters.borrower);
  if (filters.q) params.set("q", filters.q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/loans${query ? `?${query}` : ""}`;
}

const inputClass = "rounded-md border border-gray-300 px-3 py-2 text-sm";
const cell = "px-3 py-2";

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireSession();
  const raw = await searchParams;
  const filters = filtersSchema.parse({
    status: raw.status ?? "active",
    borrower: raw.borrower ?? "",
    q: raw.q ?? "",
    page: raw.page ?? 1,
  });
  const today = departmentToday();

  const where: Prisma.EquipmentLoanWhereInput = {
    ...(filters.status === "active"
      ? { status: { in: ACTIVE_LOAN_STATUSES } }
      : filters.status !== "all" && { status: filters.status }),
    ...(filters.borrower && { borrowerId: filters.borrower }),
    ...(filters.q && {
      OR: [
        { items: { some: { description: { contains: filters.q, mode: "insensitive" } } } },
        { notes: { contains: filters.q, mode: "insensitive" } },
        { returnNote: { contains: filters.q, mode: "insensitive" } },
      ],
    }),
  };

  const include = {
    borrower: { select: { name: true } },
    items: { orderBy: { sortOrder: "asc" } },
  } satisfies Prisma.EquipmentLoanInclude;

  const [onLoan, borrowers, total, loans] = await Promise.all([
    // Everything currently out: approved and its date out has arrived.
    prisma.equipmentLoan.findMany({
      where: { status: "APPROVED", dateOut: { lte: today } },
      orderBy: [{ dateDue: "asc" }],
      include,
    }),
    prisma.user.findMany({
      where: { loansBorrowed: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.equipmentLoan.count({ where }),
    prisma.equipmentLoan.findMany({
      where,
      orderBy: filters.status === "active" ? [{ dateOut: "asc" }] : [{ createdAt: "desc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include,
    }),
  ]);

  const firstShown = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(filters.page * PAGE_SIZE, total);
  const hasFilters = !!(filters.status !== "active" || filters.borrower || filters.q);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Equipment Loans</h1>
        <Link
          href="/loans/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Borrow equipment
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Currently on loan</h2>
        {onLoan.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing is out right now.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full bg-white text-left text-sm">
              <thead className="bg-[#2e5f7f] text-white">
                <tr>
                  <th scope="col" className={`${cell} font-semibold`}>Items</th>
                  <th scope="col" className={`${cell} font-semibold`}>Borrower</th>
                  <th scope="col" className={`${cell} font-semibold`}>Out</th>
                  <th scope="col" className={`${cell} font-semibold`}>Return by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {onLoan.map((loan) => {
                  const overdue = isOverdue(loan, today);
                  return (
                    <tr key={loan.id} className={overdue ? "bg-red-50" : "even:bg-gray-50"}>
                      <td className={cell}>
                        <Link href={`/loans/${loan.id}`} className="underline">
                          {itemsSummary(loan.items)}
                        </Link>
                      </td>
                      <td className={cell}>{loan.borrower.name}</td>
                      <td className={cell}>{formatDateOnly(loan.dateOut)}</td>
                      <td className={`${cell} ${overdue ? "font-semibold text-red-700" : ""}`}>
                        {formatDateOnly(loan.dateDue)}
                        {overdue && " (overdue)"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">All loans</h2>
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Status
            <select name="status" defaultValue={filters.status} className={inputClass}>
              <option value="active">Active (requested or approved)</option>
              <option value="all">All, including archived</option>
              {Object.entries(LOAN_STATUS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Borrower
            <select name="borrower" defaultValue={filters.borrower} className={inputClass}>
              <option value="">Anyone</option>
              {borrowers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Search
            <input name="q" defaultValue={filters.q} placeholder="Items or notes" className={inputClass} />
          </label>
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Filter
          </button>
          {hasFilters && (
            <Link href="/loans" className="py-2 text-sm text-gray-600 hover:text-black">
              Clear filters
            </Link>
          )}
        </form>

        <p className="text-sm text-gray-600">
          {total === 0
            ? "No loans match."
            : `Showing ${firstShown}–${lastShown} of ${total} loan${total === 1 ? "" : "s"}.`}
        </p>

        {loans.length > 0 && (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {loans.map((loan) => {
              const status = LOAN_STATUS[loan.status];
              const overdue = isOverdue(loan, today);
              return (
                <li key={loan.id}>
                  <Link
                    href={`/loans/${loan.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium">{itemsSummary(loan.items)}</p>
                      <p className={overdue ? "font-medium text-red-700" : "text-gray-500"}>
                        {formatDateOnly(loan.dateOut)} – {formatDateOnly(loan.dateDue)}
                        {overdue && " (overdue)"}
                      </p>
                      <p className="text-gray-500">
                        {loan.borrower.name} · requested {formatDateTime(loan.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {overdue ? (
                        <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">Overdue</span>
                      ) : (
                        isOut(loan, today) && (
                          <span className="rounded-full bg-blue-600 px-2 py-1 text-xs font-semibold text-white">Out</span>
                        )
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
      </section>
    </div>
  );
}
