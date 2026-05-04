import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/app/lib/db";
import { verifyPassword } from "@/app/lib/password";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/app/lib/session";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const plainPassword = String(password ?? "");

  if (!normalizedEmail || !plainPassword) {
    return NextResponse.json({ error: "メールアドレスとパスワードを入力してください。" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    select id, email, password_hash
    from app_users
    where email = ${normalizedEmail}
    limit 1
  ` as Array<Record<string, string | null>>;
  const user = rows[0];

  if (!user || !user.password_hash || !verifyPassword(plainPassword, user.password_hash)) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません。" }, { status: 401 });
  }

  const appUser = { id: user.id as string, email: user.email as string };
  const response = NextResponse.json({ user: appUser });
  response.cookies.set(SESSION_COOKIE, createSessionToken(appUser), sessionCookieOptions());
  return response;
}
