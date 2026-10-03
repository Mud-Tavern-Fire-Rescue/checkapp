import { signIn } from "@/auth";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "Access denied. Ask an officer to add your Google account in Admin.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Equipment Checks</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sign in with the Google account an officer added for you.
        </p>
      </div>

      {error && (
        <p className="max-w-sm text-center text-sm text-red-600">
          {ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again."}
        </p>
      )}

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
