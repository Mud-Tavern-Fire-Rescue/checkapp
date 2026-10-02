import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isPublicPath =
    nextUrl.pathname.startsWith("/signin") ||
    nextUrl.pathname.startsWith("/api/auth");

  if (isPublicPath) return NextResponse.next();

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/signin", nextUrl));
  }

  const isOfficerRoute =
    nextUrl.pathname.startsWith("/officer") ||
    nextUrl.pathname.startsWith("/admin");

  if (isOfficerRoute && req.auth?.user?.role !== "OFFICER") {
    return NextResponse.redirect(new URL("/checks", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
