import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOfficer } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { groupBySection } from "@/lib/schedule";
import { ActionForm } from "../../ActionForm";
import {
  addChecklistItem,
  moveChecklistItem,
  setChecklistItemActive,
  setTemplateActive,
  updateChecklistItem,
  updateTemplate,
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
  const groups = groupBySection(activeItems);
  const sectionNames = [
    ...new Set(activeItems.map((i) => i.section).filter((s): s is string => !!s)),
  ];
  const lastSection = activeItems[activeItems.length - 1]?.section ?? "";
  const numberById = new Map(activeItems.map((item, index) => [item.id, index + 1]));
  const datalistId = `sections-${template.id}`;

  return (
    <div className="flex flex-col gap-8">
      <datalist id={datalistId}>
        {sectionNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div>
        <Link href="/admin/checklists" className="text-sm text-gray-500 hover:text-black">
          ← All checklists
        </Link>
        <p className="mt-2 text-sm text-gray-500">
          For {template.apparatus?.name ?? template.equipmentItem?.name}
        </p>
        <ActionForm
          action={updateTemplate.bind(null, template.id)}
          className="mt-1 flex flex-wrap items-end gap-2"
        >
          <input
            name="name"
            required
            defaultValue={template.name}
            aria-label="Checklist name"
            className={`${inputClass} min-w-72 text-base font-semibold`}
          />
          <select
            name="frequency"
            defaultValue={template.frequency}
            aria-label="How often"
            className={inputClass}
          >
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          <button type="submit" className={smallButtonClass}>
            Save
          </button>
        </ActionForm>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Items</h2>
        {groups.map((group, groupIndex) => (
          <div key={`${group.section}-${groupIndex}`} className="flex flex-col gap-2">
            <h3 className="font-semibold text-gray-700">{group.section ?? "No section"}</h3>
            <ol className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
              {group.items.map((item, index) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                  <span className="w-8 text-sm text-gray-500">{numberById.get(item.id)}.</span>
                  <ActionForm
                    action={updateChecklistItem.bind(null, item.id)}
                    className="flex flex-1 flex-wrap items-center gap-2"
                  >
                    <input
                      name="label"
                      required
                      defaultValue={item.label}
                      aria-label={`Item ${numberById.get(item.id)}`}
                      className={`${inputClass} min-w-64 flex-1`}
                    />
                    <input
                      name="section"
                      defaultValue={item.section ?? ""}
                      list={datalistId}
                      aria-label="Section"
                      placeholder="Section"
                      className={`${inputClass} w-44`}
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
                      disabled={index === group.items.length - 1}
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
            </ol>
          </div>
        ))}
        {activeItems.length === 0 && (
          <p className="text-sm text-gray-500">No items yet. Add the first one below.</p>
        )}

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
          <input
            name="section"
            defaultValue={lastSection}
            list={datalistId}
            aria-label="Section"
            placeholder="Section"
            className={`${inputClass} w-44`}
          />
          <button type="submit" className={primaryButtonClass}>
            Add item
          </button>
        </ActionForm>
        <p className="text-sm text-gray-500">
          New items go at the end of their section. Type a new section name to start a section.
        </p>
      </section>

      {removedItems.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Removed items</h2>
          <p className="text-sm text-gray-500">
            Kept so past checks still show them. Restore to add back to the end of their section.
          </p>
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-gray-50">
            {removedItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-gray-500"
              >
                <span>
                  {item.section && <span className="font-medium">{item.section}: </span>}
                  {item.label}
                </span>
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
            ? "Deactivated checklists disappear from Checks but keep their history."
            : "This checklist is hidden from Checks."}
        </p>
      </section>
    </div>
  );
}
