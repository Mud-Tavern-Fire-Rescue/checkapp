import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      isActive: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: Role;
    isActive: boolean;
  }
}
