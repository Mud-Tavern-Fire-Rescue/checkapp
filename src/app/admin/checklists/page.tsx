import type { Metadata } from "next";
import Link from "next/link";
import { requireOfficer } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { FREQUENCY_LABEL } from "@/lib/schedule";
import { ActionForm } from "../ActionForm";
import { createTemplate } from "../actions";
import { inputClass, primaryButtonClass } from "../ui";

export const metadata: Metadata = {
  title: "Checklists | Admin | Equipment Checks",
};

export default async function ChecklistsPage() {
  await requireOfficer();

  const [templates, apparatus, equipment] = await Promise.all([
    prisma.checklistTemplate.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }, { frequency: "asc" }],
      include: {
        apparatus: { select: { name: true, isActive: true } },
        equipmentItem: { select: { name: true, isActive: true } },
        _count: { select: { items: { where: { isActive: true } } } },
      },
    }),
    prisma.apparatus.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.equipmentItem.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">New checklist</h2>
        <ActionForm action={createTemplate} className="flex flex-wrap items-end gap-2">
          <input
            name="name"
            required
            placeholder="Name, e.g. Engine 1 Weekly Check"
            className={`${inputClass} min-w-64`}
          />
          <select name="target" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              For…
            </option>
            {apparatus.length > 0 && (
              <optgroup label="Apparatus">
                {apparatus.map((a) => (
                  <option key={a.id} value={`apparatus:${a.id}`}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            )}
            {equipment.length > 0 && (
              <optgroup label="Equipment">
                {equipment.map((e) => (
                  <option key={e.id} value={`equipment:${e.id}`}>
                    {e.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <select name="frequency" defaultValue="WEEKLY" aria-label="How often" className={inputClass}>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          <button type="submit" className={primaryButtonClass}>
            Create and add items
          </button>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Checklists</h2>
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {templates.map((template) => {
            const target = template.apparatus ?? template.equipmentItem;
            const hidden = !template.isActive || !target?.isActive;
            return (
              <li key={template.id}>
                <Link
                  href={`/admin/checklists/${template.id}`}
                  className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 ${
                    hidden ? "text-gray-400" : ""
                  }`}
                >
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-gray-500">
                      {target?.name} · {FREQUENCY_LABEL[template.frequency]} ·{" "}
                      {template._count.items} items
                    </p>
                  </div>
                  {hidden && (
                    <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-600">
                      {template.isActive ? "Target inactive" : "Inactive"}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          {templates.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No checklists yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
