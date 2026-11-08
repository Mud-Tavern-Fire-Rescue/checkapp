"use client";

import { useState } from "react";

const inputClass = "rounded-md border border-gray-300 px-3 py-2 text-sm font-normal";

type Item = { description: string; quantity: number | string };

// Item rows plus dates and notes, shared by the request form and the edit
// form. Items are free text: there's no equipment catalog.
export function LoanFields({
  defaults,
}: {
  defaults?: { items: Item[]; dateOut: string; dateDue: string; notes: string | null };
}) {
  const [rows, setRows] = useState(() =>
    (defaults?.items.length ? defaults.items : [{ description: "", quantity: 1 }]).map((item, i) => ({
      key: i,
      ...item,
    })),
  );
  const [nextKey, setNextKey] = useState(rows.length);

  return (
    <>
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Items</legend>
        {rows.map((row, index) => (
          <div key={row.key} className="flex items-center gap-2">
            <input
              name="itemQuantity"
              type="number"
              min={1}
              max={999}
              required
              defaultValue={row.quantity}
              aria-label={`Quantity for item ${index + 1}`}
              className={`${inputClass} w-20`}
            />
            <span className="text-sm text-gray-500">×</span>
            <input
              name="itemDescription"
              required
              maxLength={200}
              defaultValue={row.description}
              placeholder={index === 0 ? 'e.g. 8-ft folding tables, or "Engine 2 chainsaw"' : "Item"}
              aria-label={`Item ${index + 1}`}
              className={`${inputClass} min-w-0 flex-1`}
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                aria-label={`Remove item ${index + 1}`}
                className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-black"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {rows.length < 25 && (
          <button
            type="button"
            onClick={() => {
              setRows([...rows, { key: nextKey, description: "", quantity: 1 }]);
              setNextKey(nextKey + 1);
            }}
            className="self-start text-sm font-medium text-gray-700 underline hover:text-black"
          >
            + Add another item
          </button>
        )}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Date out
        <input type="date" name="dateOut" required defaultValue={defaults?.dateOut} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Return by
        <input type="date" name="dateDue" required defaultValue={defaults?.dateDue} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
        Notes (optional)
        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={defaults?.notes ?? ""}
          placeholder="What it's for, pickup arrangements, etc."
          className={inputClass}
        />
      </label>
      <p className="text-xs text-gray-500 sm:col-span-2">
        Equipment only. Don&apos;t include patient or incident details.
      </p>
    </>
  );
}
