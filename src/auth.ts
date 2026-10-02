import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

function isAllowedDomain(profile: unknown): boolean {
  if (process.env.DEV_ALLOW_ANY_DOMAIN === "true") return true;

  const workspaceDomain = process.env.WORKSPACE_DOMAIN;
  if (!workspaceDomain) return false; // fail closed if misconfigured

  const hd = (profile as { hd?: string } | undefined)?.hd;
  return hd === workspaceDomain;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Seeded users are matched to their Google account by email on first
      // sign-in (no pre-existing Account row yet); Google-verified emails
      // make this safe.
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          hd: process.env.WORKSPACE_DOMAIN || undefined,
        },
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async signIn({ profile, user }) {
      if (!isAllowedDomain(profile)) return false;

      const email = profile?.email ?? user?.email;
      if (email) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing && !existing.isActive) return false;
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
        session.user.isActive = user.isActive;
      }
      return session;
    },
  },
});
