import type { Metadata } from "next";
import { requireSession } from "@/lib/auth-helpers";
import { DEPARTMENT_TIME_ZONE } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Vehicle Status | Equipment Checks",
};

// Engines first, then the other apparatus in the order the department lists
// them; anything new goes at the end alphabetically.
const ORDER_PREFIXES = ["E-", "QRV", "Rescue", "Brush"];

function rank(unit: string) {
  const index = ORDER_PREFIXES.findIndex((prefix) => unit.startsWith(prefix));
  return index === -1 ? ORDER_PREFIXES.length : index;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    timeZone: DEPARTMENT_TIME_ZONE,
  });
}

// One row per vehicle showing its most recent check of any kind (weekly or
// monthly). A vehicle that has never been checked shows blanks.
export default async function StatusPage() {
  await requireSession();

  const vehicles = await prisma.apparatus.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      unitNumber: true,
      submissions: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: {
          submittedAt: true,
          overallStatus: true,
          template: { select: { frequency: true } },
          submittedBy: { select: { name: true } },
        },
      },
    },
  });

  const rows = vehicles
    .map((v) => ({ ...v, label: v.unitNumber ?? v.name, last: v.submissions[0] }))
    .sort(
      (a, b) =>
        rank(a.label) - rank(b.label) ||
        a.label.localeCompare(b.label, undefined, { numeric: true }),
    );

  const cell = "px-3 py-3 sm:px-4";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Vehicle Status</h1>
      <p className="text-sm text-gray-500">
        Result of each vehicle&apos;s most recent check, weekly or monthly.
      </p>

      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="w-full bg-white text-left text-sm">
          <thead className="bg-[#2e5f7f] text-white">
            <tr>
              <th scope="col" className={`${cell} font-semibold`}>Equipment</th>
              <th scope="col" className={`${cell} font-semibold`}>Current Status</th>
              <th scope="col" className={`${cell} font-semibold`}>Last Check</th>
              <th scope="col" className={`${cell} font-semibold`}>Member who checked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => (
              <tr key={row.id} className="even:bg-gray-50">
                <th scope="row" className={`${cell} font-medium`}>
                  {row.label}
                </th>
                <td className={cell}>
                  {row.last &&
                    (row.last.overallStatus === "FAIL" ? (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                        Fail
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                        Pass
                      </span>
                    ))}
                </td>
                <td className={cell}>
                  {row.last && (
                    <>
                      {formatShortDate(row.last.submittedAt)}
                      <span className="block text-xs text-gray-500">
                        {row.last.template.frequency === "MONTHLY" ? "Monthly" : "Weekly"}
                      </span>
                    </>
                  )}
                </td>
                <td className={cell}>{row.last?.submittedBy.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className="text-sm text-gray-500">No vehicles have been set up.</p>}
    </div>
  );
}
