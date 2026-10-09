import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { isDue } from "@/lib/schedule";

export const metadata: Metadata = {
  title: "Checks | Equipment Checks",
};

type Group = Awaited<ReturnType<typeof getGroups>>[number];

// One group per vehicle or piece of equipment, each with its checklists
// (weekly first, then monthly).
async function getGroups() {
  const templates = await prisma.checklistTemplate.findMany({
    where: {
      isActive: true,
      OR: [
        { apparatus: { isActive: true } },
        { equipmentItem: { isActive: true } },
      ],
    },
    orderBy: [{ frequency: "asc" }, { name: "asc" }],
    include: {
      apparatus: { select: { id: true, name: true, unitNumber: true } },
      equipmentItem: { select: { id: true, name: true } },
      submissions: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        include: { submittedBy: { select: { name: true } } },
      },
    },
  });

  const now = Date.now();
  const groups = new Map<
    string,
    {
      key: string;
      name: string;
      unitNumber: string | null;
      kind: "apparatus" | "equipment";
      checklists: (typeof templates[number] & { isDue: boolean })[];
    }
  >();

  for (const template of templates) {
    const target = template.apparatus ?? template.equipmentItem;
    if (!target) continue;
    const key = `${template.apparatus ? "a" : "e"}:${target.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: target.name,
        unitNumber: template.apparatus?.unitNumber ?? null,
        kind: template.apparatus ? "apparatus" : "equipment",
        checklists: [],
      });
    }
    groups.get(key)!.checklists.push({
      ...template,
      isDue: isDue(template.frequency, template.submissions[0]?.submittedAt, now),
    });
  }

  return [...groups.values()].sort((a, b) =>
    (a.unitNumber ?? a.name).localeCompare(b.unitNumber ?? b.name, undefined, {
      numeric: true,
    }),
  );
}

function GroupCard({ group }: { group: Group }) {
  return (
    <section className="rounded-md border border-gray-200 bg-white">
      <h3 className="border-b border-gray-200 px-4 py-2 font-semibold">
        {group.name}
        {group.unitNumber && group.unitNumber !== group.name && (
          <span className="ml-2 text-sm font-normal text-gray-500">{group.unitNumber}</span>
        )}
      </h3>
      <ul className="divide-y divide-gray-200">
        {group.checklists.map((checklist) => {
          const last = checklist.submissions[0];
          return (
            <li key={checklist.id}>
              <Link
                href={`/checks/${checklist.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">{checklist.name}</p>
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
                  {checklist.isDue && (
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
    </section>
  );
}

export default async function ChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  await requireSession();
  const { submitted } = await searchParams;

  const groups = await getGroups();
  const apparatus = groups.filter((g) => g.kind === "apparatus");
  const equipment = groups.filter((g) => g.kind === "equipment");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <h1 className="text-2xl font-semibold">Checks</h1>

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

      {groups.length === 0 && (
        <p className="text-sm text-gray-500">No checklists have been set up yet.</p>
      )}

      {apparatus.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Apparatus</h2>
          {apparatus.map((group) => (
            <GroupCard key={group.key} group={group} />
          ))}
        </section>
      )}

      {equipment.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Equipment</h2>
          {equipment.map((group) => (
            <GroupCard key={group.key} group={group} />
          ))}
        </section>
      )}
    </div>
  );
}
