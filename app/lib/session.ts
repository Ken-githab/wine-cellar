import { createHmac, timingSafeEqual } from "crypto";
import type { AppUser } from "@/app/types/auth";

export const SESSION_COOKIE = "wine_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

interface SessionPayload extends AppUser {
  exp: number;
}

function getSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is not set");
  }
  return secret ?? "wine-cellar-local-development-secret";
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createSessionToken(user: AppUser) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined): AppUser | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.id || !payload.email || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: payload.id, email: payload.email };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}
