"use client";

import { useEffect, useState } from "react";
import type { AppUser } from "@/app/types/auth";

async function postAuth(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error ?? "通信に失敗しました。");
  }
  return json as { user?: AppUser };
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/auth/session");
        const json = await response.json();
        setUser(json.user ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { user: nextUser } = await postAuth("/api/auth/login", { email, password });
      setUser(nextUser ?? null);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { user: nextUser } = await postAuth("/api/auth/signup", { email, password });
      setUser(nextUser ?? null);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    await postAuth("/api/auth/logout");
    setUser(null);
  };

  return { user, loading, signIn, signUp, signOut };
}
