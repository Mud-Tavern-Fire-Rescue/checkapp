import type { Metadata } from "next";
import { requireOfficer } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "../ActionForm";
import {
  addApparatus,
  addEquipmentItem,
  setApparatusActive,
  setEquipmentActive,
} from "../actions";
import { inputClass, primaryButtonClass, smallButtonClass } from "../ui";

export const metadata: Metadata = {
  title: "Apparatus & Equipment | Admin | Equipment Checks",
};

export default async function EquipmentPage() {
  await requireOfficer();

  const [apparatus, equipment] = await Promise.all([
    prisma.apparatus.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.equipmentItem.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { apparatus: { select: { name: true } } },
    }),
  ]);
  const activeApparatus = apparatus.filter((a) => a.isActive);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Apparatus</h2>
        <ActionForm action={addApparatus} className="flex flex-wrap items-end gap-2">
          <input name="name" required placeholder="Name, e.g. Engine 1" className={inputClass} />
          <input name="unitNumber" placeholder="Unit #, e.g. E1" className={`${inputClass} w-32`} />
          <button type="submit" className={primaryButtonClass}>
            Add apparatus
          </button>
        </ActionForm>
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {apparatus.map((a) => (
            <li
              key={a.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${
                a.isActive ? "" : "bg-gray-50 text-gray-400"
              }`}
            >
              <p className="font-medium">
                {a.name}
                {a.unitNumber && a.unitNumber !== a.name && (
                  <span className="ml-2 text-sm font-normal text-gray-500">{a.unitNumber}</span>
                )}
                {!a.isActive && <span className="ml-2 text-xs">(inactive)</span>}
              </p>
              <ActionForm action={setApparatusActive.bind(null, a.id, !a.isActive)}>
                <button type="submit" className={smallButtonClass}>
                  {a.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </ActionForm>
            </li>
          ))}
          {apparatus.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No apparatus yet.</li>
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Equipment</h2>
        <ActionForm action={addEquipmentItem} className="flex flex-wrap items-end gap-2">
          <input
            name="name"
            required
            placeholder="Name, e.g. SCBA Unit 5"
            className={inputClass}
          />
          <select name="apparatusId" defaultValue="" className={inputClass}>
            <option value="">Not assigned to a truck</option>
            {activeApparatus.map((a) => (
              <option key={a.id} value={a.id}>
                On {a.name}
              </option>
            ))}
          </select>
          <button type="submit" className={primaryButtonClass}>
            Add equipment
          </button>
        </ActionForm>
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {equipment.map((item) => (
            <li
              key={item.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${
                item.isActive ? "" : "bg-gray-50 text-gray-400"
              }`}
            >
              <p className="font-medium">
                {item.name}
                {item.apparatus && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    on {item.apparatus.name}
                  </span>
                )}
                {!item.isActive && <span className="ml-2 text-xs">(inactive)</span>}
              </p>
              <ActionForm action={setEquipmentActive.bind(null, item.id, !item.isActive)}>
                <button type="submit" className={smallButtonClass}>
                  {item.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </ActionForm>
            </li>
          ))}
          {equipment.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No equipment yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
