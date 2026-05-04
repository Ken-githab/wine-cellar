import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/app/lib/session";
import type { AppUser } from "@/app/types/auth";

export function getRequestUser(request: NextRequest): AppUser | null {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
