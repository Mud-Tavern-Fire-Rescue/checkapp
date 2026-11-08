import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { requireSession } from "@/lib/auth-helpers";
import { LOAN_ACKNOWLEDGEMENT } from "@/lib/loans";
import { dateOnlyInputValue, departmentToday } from "@/lib/supplies";
import { createLoan } from "../actions";
import { LoanFields } from "../LoanFields";

export const metadata: Metadata = {
  title: "Borrow Equipment | Equipment Checks",
};

export default async function NewLoanPage() {
  await requireSession();
  const today = dateOnlyInputValue(departmentToday());

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/loans" className="text-sm text-gray-500 hover:text-black">
          ← Equipment loans
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Borrow equipment</h1>
        <p className="text-sm text-gray-500">
          An officer approves each loan. Officers get an email when you submit, and you&apos;ll get an
          email when it&apos;s approved or denied.
        </p>
      </div>

      <ActionForm action={createLoan} className="grid gap-4 sm:grid-cols-2">
        <LoanFields defaults={{ items: [], dateOut: today, dateDue: "", notes: null }} />
        <label className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm sm:col-span-2">
          <input type="checkbox" name="acknowledge" required className="mt-1" />
          <span>{LOAN_ACKNOWLEDGEMENT}</span>
        </label>
        <button
          type="submit"
          className="justify-self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          Submit request
        </button>
      </ActionForm>
    </div>
  );
}
