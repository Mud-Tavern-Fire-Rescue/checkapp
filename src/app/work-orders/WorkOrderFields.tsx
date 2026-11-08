const inputClass = "rounded-md border border-gray-300 px-3 py-2 text-sm font-normal";

type Option = { value: string; label: string };

// Fields shared by the new work order form and the edit form.
export function WorkOrderFields({
  options,
  defaults,
}: {
  options: { vehicles: Option[]; equipment: Option[] };
  defaults?: { title: string; description: string | null; subject: string };
}) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
        What&apos;s missing or damaged
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={defaults?.title}
          placeholder="e.g. Driver-side mirror cracked"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
        Vehicle or equipment
        <select name="subject" defaultValue={defaults?.subject ?? ""} className={inputClass}>
          <option value="">None / other</option>
          {options.vehicles.length > 0 && (
            <optgroup label="Vehicles">
              {options.vehicles.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
          {options.equipment.length > 0 && (
            <optgroup label="Equipment">
              {options.equipment.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
        Details (optional)
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={defaults?.description ?? ""}
          placeholder="Where it is, what happened to the equipment, part numbers, etc."
          className={inputClass}
        />
      </label>
      <p className="text-xs text-gray-500 sm:col-span-2">
        Equipment only. Don&apos;t include patient or incident details.
      </p>
    </>
  );
}
