import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/app/lib/db";
import { hashPassword } from "@/app/lib/password";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/app/lib/session";

function isAllowedEmail(email: string) {
  const configured = process.env.ALLOWED_LOGIN_EMAILS;
  if (!configured) return true;
  return configured
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const plainPassword = String(password ?? "");

  if (!normalizedEmail || plainPassword.length < 6) {
    return NextResponse.json({ error: "メールアドレスと6文字以上のパスワードを入力してください。" }, { status: 400 });
  }
  if (!isAllowedEmail(normalizedEmail)) {
    return NextResponse.json({ error: "このメールアドレスは登録できません。" }, { status: 403 });
  }

  const sql = getSql();
  const passwordHash = hashPassword(plainPassword);
  try {
    const rows = await sql`
      insert into app_users (email, password_hash)
      values (${normalizedEmail}, ${passwordHash})
      returning id, email
    ` as Array<Record<string, string>>;
    const user = { id: rows[0].id as string, email: rows[0].email as string };
    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions());
    return response;
  } catch {
    const existing = await sql`
      update app_users
      set password_hash = ${passwordHash}
      where email = ${normalizedEmail} and password_hash is null
      returning id, email
    ` as Array<Record<string, string>>;
    if (!existing[0]) {
      return NextResponse.json({ error: "このメールアドレスはすでに登録済みです。" }, { status: 409 });
    }

    const user = { id: existing[0].id as string, email: existing[0].email as string };
    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions());
    return response;
  }
}
