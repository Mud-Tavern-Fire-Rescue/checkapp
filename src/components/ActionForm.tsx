"use client";

import { useActionState, type ReactNode } from "react";

// Result of a form's server action: an error to show, or a success message.
export type FormState = { error?: string; message?: string };

// Wraps a server action so validation errors and success messages show
// inline instead of crashing the page.
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
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
      {state.message && (
        <p aria-live="polite" className="basis-full text-sm text-green-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
