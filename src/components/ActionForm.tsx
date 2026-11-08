"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";

// Result of a form's server action: an error to show, or a success message.
export type FormState = { error?: string; message?: string };

const INITIAL_STATE: FormState = {};

// Wraps a server action so validation errors and success messages show
// inline instead of crashing the page.
//
// React clears a form after its action runs. Here the form keeps what was
// typed when the action returns an error, and clears only after success.
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state !== INITIAL_STATE && !state.error) formRef.current?.reset();
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className={className}>
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
