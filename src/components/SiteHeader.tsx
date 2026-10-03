import Link from "next/link";
import { auth, signOut } from "@/auth";

export async function SiteHeader() {
  const session = await auth();

  // The sign-in page renders its own branding; only show the header to
  // signed-in users.
  if (!session?.user) return null;

  const { name, email, role } = session.user;

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-base font-semibold">
            Equipment Checks
          </Link>
          <Link href="/checks" className="text-gray-600 hover:text-black">
            Checks
          </Link>
          {role === "OFFICER" && (
            <>
              <Link href="/officer" className="text-gray-600 hover:text-black">
                Officer
              </Link>
              <Link href="/admin" className="text-gray-600 hover:text-black">
                Admin
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">{name ?? email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1 font-medium hover:bg-gray-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
