import { NextRequest, NextResponse } from "next/server";
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

export async function GET(req: NextRequest) {
  const clientId = process.env.WORKOS_CLIENT_ID!;
  const redirectUri =
    process.env.WORKOS_REDIRECT_URI ||
    new URL("/api/sso/callback", req.url).toString();
  const next = req.nextUrl.searchParams.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const authorizationUrl = workos.sso.getAuthorizationUrl({
    provider: "GoogleOAuth",
    redirectUri,
    clientId,
    state: safeNext,
  });

  return NextResponse.redirect(authorizationUrl);
}
