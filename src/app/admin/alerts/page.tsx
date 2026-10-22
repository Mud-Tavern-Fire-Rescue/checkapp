import type { Metadata } from "next";
import Link from "next/link";
import { emailSettingsStatus } from "@/lib/alerts";
import { requireOfficer } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "../ActionForm";
import { sendTestAlertEmail } from "../actions";
import { primaryButtonClass } from "../ui";

export const metadata: Metadata = {
  title: "Email Alerts | Admin | Equipment Checks",
};

const ALERT_STATUS = {
  PENDING: { label: "Pending", className: "bg-gray-100 text-gray-700" },
  SENT: { label: "Sent", className: "bg-green-100 text-green-800" },
  FAILED: { label: "Not sent", className: "bg-red-100 text-red-700" },
} as const;

export default async function EmailAlertsPage() {
  await requireOfficer();
  const settings = emailSettingsStatus();

  const [officers, recentAlerts] = await Promise.all([
    prisma.user.findMany({
      where: { role: "OFFICER", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.failureAlert.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        submission: { select: { id: true, template: { select: { name: true } } } },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Email sending</h2>
        {settings.configured ? (
          <p className="text-sm text-green-800">
            Set up. Alerts are sent from <strong>{settings.from}</strong> through{" "}
            {settings.host}.
          </p>
        ) : (
          <p className="text-sm text-red-700">
            Not set up yet, so failed checks are saved but no email goes out. Missing settings:{" "}
            {settings.missing.join(", ")}.
          </p>
        )}
        <p className="text-sm text-gray-500">
          When a check fails, every active officer gets one email listing the failed items, with a
          link to the full results.
        </p>
        <ActionForm action={sendTestAlertEmail} className="mt-2 flex flex-wrap items-center gap-2">
          <button type="submit" className={primaryButtonClass}>
            Send test email to me
          </button>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Who gets alerts</h2>
        <p className="mb-3 text-sm text-gray-500">
          All active officers. Change this by making someone an officer or member in{" "}
          <Link href="/admin/people" className="text-blue-700 hover:underline">
            People
          </Link>
          .
        </p>
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white text-sm">
          {officers.map((officer) => (
            <li key={officer.id} className="px-4 py-2">
              {officer.name} <span className="text-gray-500">· {officer.email}</span>
            </li>
          ))}
          {officers.length === 0 && (
            <li className="px-4 py-2 text-gray-500">No active officers.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent alerts</h2>
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white text-sm">
          {recentAlerts.map((alert) => (
            <li key={alert.id} className="flex items-start justify-between gap-3 px-4 py-2">
              <div>
                <Link
                  href={`/officer/checks/${alert.submission.id}`}
                  className="font-medium hover:underline"
                >
                  {alert.submission.template.name}
                </Link>
                <p className="text-gray-500">{formatDateTime(alert.createdAt)}</p>
                {alert.lastError && <p className="text-red-700">{alert.lastError}</p>}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ALERT_STATUS[alert.status].className}`}
              >
                {ALERT_STATUS[alert.status].label}
              </span>
            </li>
          ))}
          {recentAlerts.length === 0 && (
            <li className="px-4 py-2 text-gray-500">No alerts yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
