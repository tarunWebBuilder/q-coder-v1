import { NextRequest, NextResponse } from "next/server";
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

function getProfilePictureUrl(profile: {
  rawAttributes?: Record<string, unknown>;
}) {
  const picture =
    profile.rawAttributes?.picture ||
    profile.rawAttributes?.avatar_url ||
    profile.rawAttributes?.profile_picture_url;

  return typeof picture === "string" ? picture : undefined;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.WORKOS_CLIENT_ID!;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const returnTo =
    state?.startsWith("/") && !state.startsWith("//") ? state : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { profile } = await workos.sso.getProfileAndToken({
      code,
      clientId,
    });

    const user = {
      id: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      profilePictureUrl: getProfilePictureUrl(profile),
    };

    const response = NextResponse.redirect(new URL(returnTo, req.url));

    response.cookies.set("user", encodeURIComponent(JSON.stringify(user)), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    console.error("SSO Error:", err);
    return NextResponse.redirect(new URL("/login?error=sso", req.url));
  }
}
