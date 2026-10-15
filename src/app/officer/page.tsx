import type { Metadata } from "next";
import Link from "next/link";
import { requireOfficer } from "@/lib/auth-helpers";
import { OFFICERS } from "@/lib/officers";
import { prisma } from "@/lib/prisma";
import { SubmissionList, submissionInclude } from "./SubmissionList";

export const metadata: Metadata = {
  title: "Officer Dashboard | Equipment Checks",
};

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
      take: 10,
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
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">All Recent Checks</h2>
          <Link href="/officer/checks" className="text-sm font-medium text-blue-700 hover:underline">
            Search all checks by vehicle, date, or result →
          </Link>
        </div>
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
