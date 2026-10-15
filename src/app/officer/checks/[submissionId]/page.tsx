import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOfficer } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { groupBySection } from "@/lib/schedule";

export const metadata: Metadata = {
  title: "Check Results | Equipment Checks",
};

const STATUS_STYLE = {
  PASS: { label: "Pass", className: "bg-green-100 text-green-800" },
  FAIL: { label: "Fail", className: "bg-red-100 text-red-700" },
  NA: { label: "N/A", className: "bg-gray-100 text-gray-600" },
} as const;

const ALERT_LABEL = {
  PENDING: "Officer alert pending",
  SENT: "Officers emailed",
  FAILED: "Officer email could not be sent",
} as const;

// Read-only view of one completed check. Results can't be changed here.
export default async function CheckResultsPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  await requireOfficer();
  const { submissionId } = await params;

  const submission = await prisma.checkSubmission.findUnique({
    where: { id: submissionId },
    include: {
      template: { select: { name: true } },
      apparatus: { select: { name: true } },
      equipmentItem: { select: { name: true } },
      submittedBy: { select: { name: true } },
      alerts: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      itemResults: {
        include: {
          checklistItem: { select: { label: true, section: true, sortOrder: true } },
        },
      },
    },
  });
  if (!submission) notFound();

  // Results follow the checklist's order; the item text is the wording at
  // the time it's viewed (edits in Admin show here too).
  const results = submission.itemResults
    .map((r) => ({
      id: r.id,
      status: r.status,
      note: r.note,
      label: r.checklistItem.label,
      section: r.checklistItem.section,
      sortOrder: r.checklistItem.sortOrder,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const failed = results.filter((r) => r.status === "FAIL");
  const counts = {
    PASS: results.filter((r) => r.status === "PASS").length,
    FAIL: failed.length,
    NA: results.filter((r) => r.status === "NA").length,
  };
  const groups = groupBySection(results);
  const alert = submission.alerts[0];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/officer" className="text-sm text-gray-500 hover:text-black">
          ← Officer Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {submission.apparatus?.name ?? submission.equipmentItem?.name ?? submission.template.name}
        </h1>
        <p className="text-sm text-gray-500">
          {submission.template.name} · {formatDateTime(submission.submittedAt)} by{" "}
          {submission.submittedBy.name}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`rounded-full px-3 py-1 font-medium ${
            submission.overallStatus === "FAIL"
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-800"
          }`}
        >
          {submission.overallStatus === "FAIL" ? "Failed" : "Passed"}
        </span>
        <span className="text-gray-600">
          {counts.PASS} pass · {counts.FAIL} fail · {counts.NA} N/A
        </span>
        {alert && <span className="text-gray-500">· {ALERT_LABEL[alert.status]}</span>}
      </div>

      {submission.notes && (
        <section className="rounded-md border border-gray-200 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Overall notes</h2>
          <p className="mt-1 whitespace-pre-wrap">{submission.notes}</p>
        </section>
      )}

      {failed.length > 0 && (
        <section className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <h2 className="font-semibold text-red-800">Failed items</h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {failed.map((r) => (
              <li key={r.id}>
                <p className="font-medium">
                  {r.section && <span className="text-red-800">{r.section}: </span>}
                  {r.label}
                </p>
                {r.note && <p className="text-gray-700">{r.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">All items</h2>
        {groups.map((group, groupIndex) => (
          <div key={`${group.section}-${groupIndex}`}>
            {group.section && (
              <h3 className="mb-2 font-semibold text-gray-700">{group.section}</h3>
            )}
            <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
              {group.items.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
                  <div>
                    <p>{r.label}</p>
                    {r.note && <p className="text-gray-500">Note: {r.note}</p>}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status].className}`}
                  >
                    {STATUS_STYLE[r.status].label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
