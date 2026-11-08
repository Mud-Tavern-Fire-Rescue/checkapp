import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { requireSession } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { subjectOptions, subjectValue } from "@/lib/work-orders";
import { createWorkOrder } from "../actions";
import { WorkOrderFields } from "../WorkOrderFields";

export const metadata: Metadata = {
  title: "New Work Order | Equipment Checks",
};

// ?result=<checkItemResultId> starts from a failed check item, carrying over
// the vehicle, item, and note.
export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const session = await requireSession();
  const { result: resultId } = await searchParams;

  const result = resultId
    ? await prisma.checkItemResult.findFirst({
        where: { id: resultId, status: "FAIL" },
        include: {
          checklistItem: { select: { label: true, section: true } },
          submission: {
            select: {
              apparatusId: true,
              equipmentItemId: true,
              submittedAt: true,
              submittedBy: { select: { name: true } },
              template: { select: { name: true } },
            },
          },
          workOrders: { where: { status: "OPEN" }, select: { id: true }, take: 1 },
        },
      })
    : null;

  const defaults = result
    ? {
        title: [result.checklistItem.section, result.checklistItem.label]
          .filter(Boolean)
          .join(": ")
          .slice(0, 200),
        description: result.note,
        subject: subjectValue(result.submission),
      }
    : undefined;
  const options = await subjectOptions(result?.submission);
  const existing = result?.workOrders[0];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/work-orders" className="text-sm text-gray-500 hover:text-black">
          ← Work orders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New work order</h1>
        <p className="text-sm text-gray-500">
          For missing or damaged equipment. Officers get an email when you submit, and everyone can
          see the list.
        </p>
      </div>

      {result && (
        <p className="rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-700">
          From the failed item on {result.submission.template.name},{" "}
          {formatDateTime(result.submission.submittedAt)} by {result.submission.submittedBy.name}.
        </p>
      )}
      {existing && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This item already has an open work order.{" "}
          <Link href={`/work-orders/${existing.id}`} className="font-medium underline">
            View it
          </Link>{" "}
          instead of opening a duplicate.
        </p>
      )}

      <ActionForm action={createWorkOrder} className="grid gap-4 sm:grid-cols-2">
        <WorkOrderFields options={options} defaults={defaults} />
        {result && <input type="hidden" name="checkItemResultId" value={result.id} />}
        {session.user.role === "OFFICER" && (
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="outOfService" className="mt-1" />
            <span>
              <span className="font-medium">Out of service.</span>{" "}
              <span className="text-gray-600">
                Affects safe operation or required function. Shows on the Status page until resolved.
              </span>
            </span>
          </label>
        )}
        <button
          type="submit"
          className="justify-self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          Submit work order
        </button>
      </ActionForm>
    </div>
  );
}
