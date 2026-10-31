import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { requireSession } from "@/lib/auth-helpers";
import { createSupplyRequest } from "../actions";
import { SupplyFields } from "../SupplyFields";

export const metadata: Metadata = {
  title: "Request Supplies | Equipment Checks",
};

export default async function NewSupplyRequestPage() {
  await requireSession();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/supplies" className="text-sm text-gray-500 hover:text-black">
          ← Supply requests
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Request supplies</h1>
        <p className="text-sm text-gray-500">
          Officers get an email when you submit. Everyone can see the list of requests.
        </p>
      </div>

      <ActionForm action={createSupplyRequest} className="grid gap-4 sm:grid-cols-2">
        <SupplyFields />
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
