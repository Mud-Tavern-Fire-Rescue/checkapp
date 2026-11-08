import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { updateMyNotificationEmail } from "./actions";

export const metadata: Metadata = {
  title: "My Account | Equipment Checks",
};

export default async function AccountPage() {
  const session = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { name: true, email: true, notificationEmail: true, role: true },
  });
  const isOfficer = user.role === "OFFICER";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">My account</h1>
        <p className="text-sm text-gray-500">
          {user.name} · {isOfficer ? "Officer" : "Member"}
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-md border border-gray-200 bg-white p-4 text-sm">
        <dt className="text-gray-500">Signs in with</dt>
        <dd>{user.email} (Google)</dd>
        <dt className="text-gray-500">Emails go to</dt>
        <dd className="font-medium">{user.notificationEmail ?? user.email}</dd>
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Where should app emails go?</h2>
        <p className="text-sm text-gray-600">
          {isOfficer
            ? "Failed-check alerts, new supply requests, work orders, and loan requests are sent here, along with emails about your own loans."
            : "Emails about your equipment loans (approval and due-date reminders) are sent here."}{" "}
          Leave it blank to use your sign-in email. This doesn&apos;t change how you sign in.
        </p>
        <ActionForm action={updateMyNotificationEmail} className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            name="notificationEmail"
            maxLength={254}
            defaultValue={user.notificationEmail ?? ""}
            placeholder={user.email}
            aria-label="Notification email"
            className="min-w-64 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Save
          </button>
        </ActionForm>
      </section>
    </div>
  );
}
