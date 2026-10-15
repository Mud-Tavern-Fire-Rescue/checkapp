import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // People added in Admin are matched to their Google account by email
      // on first sign-in (no Account row yet); requiring a Google-verified
      // email makes this safe.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  // Members open the app from their phone's home screen, so keep them signed
  // in: a session lasts 90 days and is extended each day it's used.
  // Deactivating someone in Admin still signs them out immediately.
  session: {
    strategy: "database",
    maxAge: 90 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  callbacks: {
    // Only people an officer has added in Admin > People can sign in.
    // Unknown or deactivated emails are rejected, so the adapter never
    // creates accounts on its own.
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email || profile?.email_verified !== true) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      return !!existing?.isActive;
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
