import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOfficer } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "../../ActionForm";
import {
  addChecklistItem,
  moveChecklistItem,
  renameTemplate,
  setChecklistItemActive,
  setTemplateActive,
  updateChecklistItem,
} from "../../actions";
import { inputClass, primaryButtonClass, smallButtonClass } from "../../ui";

export const metadata: Metadata = {
  title: "Edit Checklist | Admin | Equipment Checks",
};

export default async function EditChecklistPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  await requireOfficer();
  const { templateId } = await params;

  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
    include: {
      apparatus: { select: { name: true } },
      equipmentItem: { select: { name: true } },
      items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!template) notFound();

  const activeItems = template.items.filter((i) => i.isActive);
  const removedItems = template.items.filter((i) => !i.isActive);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/checklists" className="text-sm text-gray-500 hover:text-black">
          ← All checklists
        </Link>
        <p className="mt-2 text-sm text-gray-500">
          For {template.apparatus?.name ?? template.equipmentItem?.name}
        </p>
        <ActionForm
          action={renameTemplate.bind(null, template.id)}
          className="mt-1 flex flex-wrap items-end gap-2"
        >
          <input
            name="name"
            required
            defaultValue={template.name}
            aria-label="Checklist name"
            className={`${inputClass} min-w-72 text-base font-semibold`}
          />
          <button type="submit" className={smallButtonClass}>
            Rename
          </button>
        </ActionForm>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Items</h2>
        <ol className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {activeItems.map((item, index) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
              <span className="w-6 text-sm text-gray-500">{index + 1}.</span>
              <ActionForm
                action={updateChecklistItem.bind(null, item.id)}
                className="flex flex-1 flex-wrap items-center gap-2"
              >
                <input
                  name="label"
                  required
                  defaultValue={item.label}
                  aria-label={`Item ${index + 1}`}
                  className={`${inputClass} min-w-64 flex-1`}
                />
                <button type="submit" className={smallButtonClass}>
                  Save
                </button>
              </ActionForm>
              <ActionForm action={moveChecklistItem.bind(null, item.id, "up")}>
                <button
                  type="submit"
                  disabled={index === 0}
                  aria-label="Move up"
                  className={smallButtonClass}
                >
                  ↑
                </button>
              </ActionForm>
              <ActionForm action={moveChecklistItem.bind(null, item.id, "down")}>
                <button
                  type="submit"
                  disabled={index === activeItems.length - 1}
                  aria-label="Move down"
                  className={smallButtonClass}
                >
                  ↓
                </button>
              </ActionForm>
              <ActionForm action={setChecklistItemActive.bind(null, item.id, false)}>
                <button type="submit" className={smallButtonClass}>
                  Remove
                </button>
              </ActionForm>
            </li>
          ))}
          {activeItems.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">
              No items yet. Add the first one below.
            </li>
          )}
        </ol>

        <ActionForm
          action={addChecklistItem.bind(null, template.id)}
          className="flex flex-wrap items-end gap-2"
        >
          <input
            name="label"
            required
            placeholder="New item, e.g. Pump primes within 30 seconds"
            className={`${inputClass} min-w-72 flex-1`}
          />
          <button type="submit" className={primaryButtonClass}>
            Add item
          </button>
        </ActionForm>
      </section>

      {removedItems.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Removed items</h2>
          <p className="text-sm text-gray-500">
            Kept so past checks still show them. Restore to add back to the end of the list.
          </p>
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-gray-50">
            {removedItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-gray-500"
              >
                {item.label}
                <ActionForm action={setChecklistItemActive.bind(null, item.id, true)}>
                  <button type="submit" className={smallButtonClass}>
                    Restore
                  </button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t border-gray-200 pt-6">
        <ActionForm action={setTemplateActive.bind(null, template.id, !template.isActive)}>
          <button type="submit" className={smallButtonClass}>
            {template.isActive ? "Deactivate this checklist" : "Reactivate this checklist"}
          </button>
        </ActionForm>
        <p className="mt-2 text-sm text-gray-500">
          {template.isActive
            ? "Deactivated checklists disappear from Weekly Checks but keep their history."
            : "This checklist is hidden from Weekly Checks."}
        </p>
      </section>
    </div>
  );
}
