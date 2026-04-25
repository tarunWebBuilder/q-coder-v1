import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const user = request.cookies.get("user")?.value;
  const { pathname } = request.nextUrl;

  const isPublicRoute =
    pathname === "/login" ||
    pathname.startsWith("/api/sso") ||
    pathname.startsWith("/api/og") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/share");

  if (!user && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/og|robots.txt|_next/static|_next/image).*)"],
};
