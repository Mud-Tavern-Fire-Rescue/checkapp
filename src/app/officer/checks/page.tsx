import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { z } from "zod";
import { requireOfficer } from "@/lib/auth-helpers";
import { departmentDayStart } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { SubmissionList, submissionInclude } from "../SubmissionList";

export const metadata: Metadata = {
  title: "Check History | Equipment Checks",
};

const PAGE_SIZE = 50;

// "2026-10-14" -> "2026-10-15"
function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

// Filters arrive as plain GET parameters so a filtered view can be
// bookmarked or shared. Anything invalid is ignored rather than erroring.
const filtersSchema = z.object({
  vehicle: z.string().trim().max(50).catch(""),
  result: z.enum(["PASS", "FAIL"]).or(z.literal("")).catch(""),
  from: z.string().trim().catch(""),
  to: z.string().trim().catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});

type Filters = z.infer<typeof filtersSchema>;

function hrefWith(filters: Filters, page: number) {
  const params = new URLSearchParams();
  if (filters.vehicle) params.set("vehicle", filters.vehicle);
  if (filters.result) params.set("result", filters.result);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/officer/checks${query ? `?${query}` : ""}`;
}

const inputClass = "rounded-md border border-gray-300 px-3 py-2 text-sm";

export default async function CheckHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireOfficer();
  const raw = await searchParams;
  const filters = filtersSchema.parse({
    vehicle: raw.vehicle ?? "",
    result: raw.result ?? "",
    from: raw.from ?? "",
    to: raw.to ?? "",
    page: raw.page ?? 1,
  });

  // "from" and "to" are whole days in department (Central) time; "to" includes
  // the entire day.
  const fromDate = filters.from ? departmentDayStart(filters.from) : null;
  const toDayStart = filters.to ? departmentDayStart(filters.to) : null;
  const toDate = toDayStart ? departmentDayStart(nextDay(filters.to)) : null;

  const where: Prisma.CheckSubmissionWhereInput = {
    ...(filters.vehicle && { apparatusId: filters.vehicle }),
    ...(filters.result && { overallStatus: filters.result }),
    ...((fromDate || toDate) && {
      submittedAt: {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lt: toDate }),
      },
    }),
  };

  const [vehicles, total, submissions] = await Promise.all([
    prisma.apparatus.findMany({
      orderBy: { unitNumber: "asc" },
      select: { id: true, name: true, unitNumber: true, isActive: true },
    }),
    prisma.checkSubmission.count({ where }),
    prisma.checkSubmission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: submissionInclude,
    }),
  ]);

  const firstShown = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(filters.page * PAGE_SIZE, total);
  const hasFilters = !!(filters.vehicle || filters.result || filters.from || filters.to);
  const badDate = (filters.from && !fromDate) || (filters.to && !toDayStart);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/officer" className="text-sm text-gray-500 hover:text-black">
          ← Officer Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Check History</h1>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Vehicle
          <select name="vehicle" defaultValue={filters.vehicle} className={inputClass}>
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.unitNumber && v.unitNumber !== v.name ? `${v.unitNumber} — ${v.name}` : v.name}
                {v.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Result
          <select name="result" defaultValue={filters.result} className={inputClass}>
            <option value="">Passed and failed</option>
            <option value="FAIL">Failed only</option>
            <option value="PASS">Passed only</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          From
          <input type="date" name="from" defaultValue={filters.from} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          To
          <input type="date" name="to" defaultValue={filters.to} className={inputClass} />
        </label>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Filter
        </button>
        {hasFilters && (
          <Link href="/officer/checks" className="py-2 text-sm text-gray-600 hover:text-black">
            Clear filters
          </Link>
        )}
      </form>

      {badDate && (
        <p className="text-sm text-red-600">A date wasn&apos;t valid and was ignored.</p>
      )}

      <p className="text-sm text-gray-600">
        {total === 0
          ? "No checks match."
          : `Showing ${firstShown}–${lastShown} of ${total} check${total === 1 ? "" : "s"}, newest first.`}
      </p>

      <SubmissionList submissions={submissions} empty="" />

      {total > PAGE_SIZE && (
        <nav className="flex items-center justify-between text-sm">
          {filters.page > 1 ? (
            <Link href={hrefWith(filters, filters.page - 1)} className="text-gray-700 hover:text-black">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {lastShown < total && (
            <Link href={hrefWith(filters, filters.page + 1)} className="text-gray-700 hover:text-black">
              Older →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
