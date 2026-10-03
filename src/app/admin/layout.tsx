import Link from "next/link";
import type { ReactNode } from "react";
import { requireOfficer } from "@/lib/auth-helpers";

const SECTIONS = [
  { href: "/admin/people", label: "People" },
  { href: "/admin/equipment", label: "Apparatus & Equipment" },
  { href: "/admin/checklists", label: "Checklists" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireOfficer();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <nav className="mt-3 flex flex-wrap gap-4 border-b border-gray-200 text-sm">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="-mb-px border-b-2 border-transparent pb-2 text-gray-600 hover:border-gray-400 hover:text-black"
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
