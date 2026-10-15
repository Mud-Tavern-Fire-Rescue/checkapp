import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";

export const submissionInclude = {
  template: { select: { name: true } },
  submittedBy: { select: { name: true } },
  _count: { select: { itemResults: { where: { status: "FAIL" } } } },
} satisfies Prisma.CheckSubmissionInclude;

type SubmissionRow = Prisma.CheckSubmissionGetPayload<{ include: typeof submissionInclude }>;

// Rows link to the read-only results page for each check.
export function SubmissionList({
  submissions,
  empty,
}: {
  submissions: SubmissionRow[];
  empty: string;
}) {
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
