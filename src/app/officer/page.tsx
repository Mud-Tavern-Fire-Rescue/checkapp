import type { Metadata } from "next";
import { requireOfficer } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { OFFICERS } from "@/lib/officers";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Officer Dashboard | Equipment Checks",
};

export default async function OfficerPage() {
  await requireOfficer();

  const recentFailures = await prisma.checkSubmission.findMany({
    where: { overallStatus: "FAIL" },
    orderBy: { submittedAt: "desc" },
    take: 10,
    include: {
      template: { select: { name: true } },
      submittedBy: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
      <h1 className="text-2xl font-semibold">Officer Dashboard</h1>

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

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent Failed Checks</h2>
        {recentFailures.length === 0 ? (
          <p className="text-sm text-gray-500">No failed checks.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
            {recentFailures.map((submission) => (
              <li key={submission.id} className="px-4 py-3 text-sm">
                <p className="font-medium">{submission.template.name}</p>
                <p className="text-gray-500">
                  {formatDateTime(submission.submittedAt)}{" "}
                  by {submission.submittedBy.name}
                </p>
                {submission.notes && (
                  <p className="mt-1 text-gray-700">{submission.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
