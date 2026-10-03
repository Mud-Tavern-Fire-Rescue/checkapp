import type { Metadata } from "next";
import { requireOfficer } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "../ActionForm";
import { addUser, setUserActive, setUserRole } from "../actions";
import { inputClass, primaryButtonClass, smallButtonClass } from "../ui";

export const metadata: Metadata = {
  title: "People | Admin | Equipment Checks",
};

export default async function PeoplePage() {
  const session = await requireOfficer();

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      _count: { select: { accounts: true } },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-1 text-lg font-semibold">Add a person</h2>
        <p className="mb-3 text-sm text-gray-500">
          Use the Google account email they will sign in with.
        </p>
        <ActionForm action={addUser} className="flex flex-wrap items-end gap-2">
          <input name="name" required placeholder="Full name" className={inputClass} />
          <input
            name="email"
            type="email"
            required
            placeholder="name@gmail.com"
            className={`${inputClass} min-w-64`}
          />
          <select name="role" defaultValue="MEMBER" className={inputClass}>
            <option value="MEMBER">Member</option>
            <option value="OFFICER">Officer</option>
          </select>
          <button type="submit" className={primaryButtonClass}>
            Add
          </button>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">People</h2>
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {users.map((user) => {
            const isSelf = user.id === session.user.id;
            return (
              <li
                key={user.id}
                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                  user.isActive ? "" : "bg-gray-50 text-gray-400"
                }`}
              >
                <div>
                  <p className="font-medium">
                    {user.name}
                    {isSelf && <span className="ml-2 text-xs text-gray-500">(you)</span>}
                  </p>
                  <p className="text-sm text-gray-500">
                    {user.email}
                    {user._count.accounts === 0 && " · hasn't signed in yet"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      user.role === "OFFICER"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {user.role === "OFFICER" ? "Officer" : "Member"}
                  </span>
                  {!user.isActive && (
                    <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-600">
                      Inactive
                    </span>
                  )}
                  {!isSelf && (
                    <>
                      <ActionForm
                        action={setUserRole.bind(
                          null,
                          user.id,
                          user.role === "OFFICER" ? "MEMBER" : "OFFICER",
                        )}
                      >
                        <button type="submit" className={smallButtonClass}>
                          {user.role === "OFFICER" ? "Make member" : "Make officer"}
                        </button>
                      </ActionForm>
                      <ActionForm action={setUserActive.bind(null, user.id, !user.isActive)}>
                        <button type="submit" className={smallButtonClass}>
                          {user.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </ActionForm>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
