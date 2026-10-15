import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { requireOfficer } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { OFFICERS } from "@/lib/officers";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Officer Dashboard | Equipment Checks",
};

const submissionInclude = {
  template: { select: { name: true } },
  submittedBy: { select: { name: true } },
  _count: { select: { itemResults: { where: { status: "FAIL" } } } },
} satisfies Prisma.CheckSubmissionInclude;

type SubmissionRow = Prisma.CheckSubmissionGetPayload<{ include: typeof submissionInclude }>;

function SubmissionList({ submissions, empty }: { submissions: SubmissionRow[]; empty: string }) {
  if (submissions.length === 0) {
    return <p className="text-sm text-gray-500">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
      {submissions.map((submission) => (
        <li key={submission.id}>
          <Link
            href={`/officer/checks/${submission.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-gray-50"
          >
            <div>
              <p className="font-medium">{submission.template.name}</p>
              <p className="text-gray-500">
                {formatDateTime(submission.submittedAt)} by {submission.submittedBy.name}
              </p>
              {submission.notes && <p className="mt-1 text-gray-700">{submission.notes}</p>}
            </div>
            {submission.overallStatus === "FAIL" ? (
              <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                {submission._count.itemResults} failed
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                Passed
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function OfficerPage() {
  await requireOfficer();

  const [recentFailures, recentChecks] = await Promise.all([
    prisma.checkSubmission.findMany({
      where: { overallStatus: "FAIL" },
      orderBy: { submittedAt: "desc" },
      take: 10,
      include: submissionInclude,
    }),
    prisma.checkSubmission.findMany({
      orderBy: { submittedAt: "desc" },
      take: 25,
      include: submissionInclude,
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <h1 className="text-2xl font-semibold">Officer Dashboard</h1>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Recent Failed Checks</h2>
        <p className="mb-3 text-sm text-gray-500">Select a check to see every item&apos;s result.</p>
        <SubmissionList submissions={recentFailures} empty="No failed checks." />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">All Recent Checks</h2>
        <SubmissionList submissions={recentChecks} empty="No checks yet." />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Department Officers</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {OFFICERS.map((officer) => (
            <li
              key={officer.name}
              className="rounded-md border border-gray-200 bg-white px-4 py-3"
            >
              <p className="font-medium">{officer.name}</p>
              <p className="text-sm text-gray-500">{officer.title}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
