"use client";

import { useActionState } from "react";
import { submitCheck, type SubmitCheckState } from "../actions";

const STATUS_OPTIONS = [
  { value: "PASS", label: "Pass" },
  { value: "FAIL", label: "Fail" },
  { value: "NA", label: "N/A" },
] as const;

const initialState: SubmitCheckState = {};

export function CheckForm({
  templateId,
  items,
}: {
  templateId: string;
  items: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    submitCheck.bind(null, templateId),
    initialState,
  );

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        This checklist has no items yet. Ask an officer to set it up.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {items.map((item, index) => {
          const itemError = state.itemErrors?.[item.id];
          return (
            <li
              key={item.id}
              className={`rounded-md border bg-white px-4 py-3 ${
                itemError ? "border-red-400" : "border-gray-200"
              }`}
            >
              <fieldset>
                <legend className="font-medium">
                  {index + 1}. {item.label}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm has-[:checked]:border-black has-[:checked]:bg-gray-900 has-[:checked]:text-white"
                    >
                      <input
                        type="radio"
                        name={`status:${item.id}`}
                        value={option.value}
                        defaultChecked={
                          state.values?.[`status:${item.id}`] === option.value
                        }
                        required
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  name={`note:${item.id}`}
                  defaultValue={state.values?.[`note:${item.id}`] ?? ""}
                  placeholder="Note (required if failed)"
                  maxLength={500}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {itemError && (
                  <p className="mt-1 text-sm text-red-600">{itemError}</p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Overall notes (optional)
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={state.values?.notes ?? ""}
          className="rounded-md border border-gray-300 px-3 py-2 font-normal"
        />
      </label>

      {state.message && (
        <p aria-live="polite" className="text-sm text-red-600">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Submit check"}
      </button>
    </form>
  );
}
