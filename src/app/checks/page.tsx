import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Checks | Equipment Checks",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Checklist = Awaited<ReturnType<typeof getChecklists>>[number];

// A checklist is due if it hasn't been run in the last week.
async function getChecklists() {
  const templates = await prisma.checklistTemplate.findMany({
    where: {
      isActive: true,
      OR: [
        { apparatus: { isActive: true } },
        { equipmentItem: { isActive: true } },
      ],
    },
    orderBy: { name: "asc" },
    include: {
      apparatus: { select: { name: true } },
      equipmentItem: { select: { name: true } },
      submissions: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        include: { submittedBy: { select: { name: true } } },
      },
    },
  });

  const dueBefore = Date.now() - WEEK_MS;
  return templates.map((template) => {
    const last = template.submissions[0];
    return {
      ...template,
      isDue: !last || last.submittedAt.getTime() < dueBefore,
    };
  });
}

export default async function ChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  await requireSession();
  const { submitted } = await searchParams;

  const templates = await getChecklists();

  const apparatusTemplates = templates.filter((t) => t.apparatus);
  const equipmentTemplates = templates.filter((t) => t.equipmentItem);

  function renderList(list: Checklist[]) {
    return (
      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
        {list.map((template) => {
          const last = template.submissions[0];
          return (
            <li key={template.id}>
              <Link
                href={`/checks/${template.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">
                    {template.apparatus?.name ?? template.equipmentItem?.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {last
                      ? `Last checked ${formatDateTime(last.submittedAt)} by ${last.submittedBy.name}`
                      : "Never checked"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs font-medium">
                  {last?.overallStatus === "FAIL" && (
                    <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">
                      Failed
                    </span>
                  )}
                  {template.isDue && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                      Due
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <h1 className="text-2xl font-semibold">Weekly Checks</h1>

      {submitted === "PASS" && (
        <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          Check saved. Everything passed.
        </p>
      )}
      {submitted === "FAIL" && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          Check saved with failures. Officers have been notified.
        </p>
      )}

      {templates.length === 0 && (
        <p className="text-sm text-gray-500">No checklists have been set up yet.</p>
      )}

      {apparatusTemplates.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Apparatus</h2>
          {renderList(apparatusTemplates)}
        </section>
      )}

      {equipmentTemplates.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Equipment</h2>
          {renderList(equipmentTemplates)}
        </section>
      )}
    </div>
  );
}
