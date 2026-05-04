"use client";

import { useState, useEffect, useCallback } from "react";
import { Wine, WineFormData } from "@/app/types/wine";
import type { AppUser } from "@/app/types/auth";

const LEGACY_KEY = "wine-cellar-data";
const CACHE_KEY = "wine-cellar-cache";
const LOCAL_KEY = "wine-cellar-local";

function loadJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}

function saveJson(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options?.body ? { "content-type": "application/json" } : {}),
      ...options?.headers,
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error ?? "通信に失敗しました。");
  return json as T;
}

export function useWines(user: AppUser | null) {
  const [wines, setWines] = useState<Wine[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsLoaded(false);
    if (!user) {
      setWines(loadJson<Wine[]>(LOCAL_KEY, []));
      setIsLoaded(true);
      return;
    }

    (async () => {
      try {
        const { wines: nextWines } = await api<{ wines: Wine[] }>("/api/wines");
        setWines(nextWines);
        saveJson(CACHE_KEY, nextWines);
        setIsOnline(true);
      } catch {
        setWines(loadJson<Wine[]>(CACHE_KEY, []));
        setIsOnline(false);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, [user?.id, user]);

  const addWine = useCallback(
    async (data: WineFormData): Promise<Wine> => {
      if (user) {
        const { wine } = await api<{ wine: Wine }>("/api/wines", {
          method: "POST",
          body: JSON.stringify(data),
        });
        const next = [wine, ...wines];
        setWines(next);
        saveJson(CACHE_KEY, next);
        return wine;
      }

      const now = new Date().toISOString();
      const wine: Wine = {
        ...data,
        id: `wine-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      };
      const next = [wine, ...wines];
      setWines(next);
      saveJson(LOCAL_KEY, next);
      return wine;
    },
    [user, wines]
  );

  const updateWine = useCallback(
    async (id: string, data: WineFormData): Promise<void> => {
      const existing = wines.find((w) => w.id === id);
      if (!existing) return;

      const updated = user
        ? (await api<{ wine: Wine }>(`/api/wines/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(data),
          })).wine
        : { ...existing, ...data, updatedAt: new Date().toISOString() };

      const next = wines.map((w) => (w.id === id ? updated : w));
      setWines(next);
      saveJson(user ? CACHE_KEY : LOCAL_KEY, next);
    },
    [user, wines]
  );

  const deleteWine = useCallback(
    async (id: string): Promise<void> => {
      if (user) {
        await api(`/api/wines/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      const next = wines.filter((w) => w.id !== id);
      setWines(next);
      saveJson(user ? CACHE_KEY : LOCAL_KEY, next);
    },
    [user, wines]
  );

  const migrateFromLocalStorage = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    const localWines = loadJson<Wine[]>(LEGACY_KEY, []);
    if (!localWines.length) return 0;

    let count = 0;
    for (const wine of localWines) {
      await addWine(wine);
      count += 1;
    }
    localStorage.removeItem(LEGACY_KEY);
    return count;
  }, [addWine, user]);

  return { wines, isLoaded, isOnline, addWine, updateWine, deleteWine, migrateFromLocalStorage };
}
