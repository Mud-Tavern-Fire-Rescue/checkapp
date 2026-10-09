import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { CheckForm } from "./CheckForm";

export const metadata: Metadata = {
  title: "Run Check | Equipment Checks",
};

export default async function RunCheckPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const session = await requireSession();
  const { templateId } = await params;

  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, isActive: true },
    include: {
      apparatus: { select: { name: true } },
      equipmentItem: { select: { name: true } },
      items: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, label: true, section: true },
      },
    },
  });

  if (!template) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/checks" className="text-sm text-gray-500 hover:text-black">
          ← All checks
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {template.apparatus?.name ?? template.equipmentItem?.name}
        </h1>
        <p className="text-sm text-gray-500">
          {template.name} · Checking as {session.user.name}
        </p>
      </div>

      <CheckForm templateId={template.id} items={template.items} />
    </div>
  );
}
