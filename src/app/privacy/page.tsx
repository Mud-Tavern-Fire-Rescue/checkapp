import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Equipment Checks",
};

// Public page (see src/proxy.ts): Google requires a privacy policy link for
// the sign-in consent screen. Keep it in step with what the app stores.
export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10 text-sm leading-6 text-gray-800">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Privacy Policy</h1>
        <p className="text-gray-500">MTVFR Equipment Checks · Effective October 22, 2026</p>
      </div>

      <p>
        MTVFR Equipment Checks (checks.mudtavernfire.org) is an internal tool used by members of
        Mud Tavern Volunteer Fire and Rescue to record and review inspections of department
        vehicles and equipment. Only people the department has added can sign in.
      </p>

      <section>
        <h2 className="text-base font-semibold text-gray-900">What we collect</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>From Google when you sign in:</strong>{" "}your name, email address, and profile
            picture, plus the sign-in tokens Google issues. We do not request access to your
            Gmail, contacts, calendar, files, or any other Google data.
          </li>
          <li>
            <strong>Your role</strong>{" "}(member or officer) and whether your access is active, set by
            department officers.
          </li>
          <li>
            <strong>Checks you submit:</strong>{" "}the vehicle or equipment, the date and time, each
            item&apos;s result (pass, fail, or not applicable), and any notes you enter.
          </li>
          <li>
            <strong>A sign-in cookie</strong>{" "}that keeps you signed in. We use no advertising or
            analytics cookies and no tracking tools.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900">How we use it</h2>
        <p className="mt-2">
          Only to run the equipment check program: signing you in, recording who completed each
          check, showing vehicle status to members, and letting officers review results and
          receive email alerts when a check fails. We do not sell, rent, or share your
          information for marketing.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900">Who can see it</h2>
        <p className="mt-2">
          Signed-in members can see each vehicle&apos;s latest check and who completed it.
          Department officers can see all check records and the list of members. Data is stored
          with the service providers that host the app (Vercel for hosting and Neon for the
          database), who process it on the department&apos;s behalf. Failed-check alert emails are sent
          to officers through the department&apos;s Microsoft 365 email. Hosting providers may keep
          routine server logs, such as IP addresses, for security and reliability.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900">What not to enter</h2>
        <p className="mt-2">
          Check notes are for equipment condition only. Do not enter patient information or
          incident details.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900">How long we keep it</h2>
        <p className="mt-2">
          Check records are kept as part of the department&apos;s maintenance history. Sign-in
          sessions expire after 90 days without use. If you leave the department, officers
          deactivate your access, which signs you out immediately; your past checks remain part
          of the equipment history. To ask for a copy or removal of your personal information,
          contact us below.
        </p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900">Contact</h2>
        <p className="mt-2">
          Mud Tavern Volunteer Fire and Rescue ·{" "}
          <a href="mailto:contact@mudtavernfire.org" className="text-blue-700 hover:underline">
            contact@mudtavernfire.org
          </a>
        </p>
      </section>

      <p className="text-gray-500">
        We may update this policy as the app changes; the effective date above will change when we
        do.
      </p>

      <Link href="/" className="text-blue-700 hover:underline">
        ← Back to Equipment Checks
      </Link>
    </div>
  );
}
