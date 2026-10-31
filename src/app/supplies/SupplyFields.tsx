import { dateOnlyInputValue } from "@/lib/supplies";

const inputClass = "rounded-md border border-gray-300 px-3 py-2 text-sm font-normal";

// Fields shared by the new-request form and the edit form.
export function SupplyFields({
  defaults,
}: {
  defaults?: { item: string; quantity: string; dateNeeded: Date | null; notes: string | null };
}) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
        What&apos;s needed
        <input
          name="item"
          required
          maxLength={200}
          defaultValue={defaults?.item}
          placeholder="e.g. Nitrile gloves, size large"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Quantity
        <input
          name="quantity"
          required
          maxLength={50}
          defaultValue={defaults?.quantity}
          placeholder="e.g. 2 boxes"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Date needed
        <input
          type="date"
          name="dateNeeded"
          defaultValue={dateOnlyInputValue(defaults?.dateNeeded ?? null)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
        Notes (optional)
        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={defaults?.notes ?? ""}
          placeholder="Where it's needed, brand or size, links, etc."
          className={inputClass}
        />
      </label>
      <p className="text-xs text-gray-500 sm:col-span-2">
        Equipment and supplies only. Don&apos;t include patient or incident details.
      </p>
    </>
  );
}
