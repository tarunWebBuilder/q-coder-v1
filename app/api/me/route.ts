// app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("user");

  if (!cookie) {
    return NextResponse.json({ user: null });
  }

  try {
    const user = JSON.parse(decodeURIComponent(cookie.value));
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}