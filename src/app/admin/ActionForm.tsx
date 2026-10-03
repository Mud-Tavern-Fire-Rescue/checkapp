"use client";

import { useActionState, type ReactNode } from "react";
import type { AdminActionState } from "./actions";

// Wraps an admin server action so validation errors show inline instead of
// crashing the page.
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state.error && (
        <p aria-live="polite" className="basis-full text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
