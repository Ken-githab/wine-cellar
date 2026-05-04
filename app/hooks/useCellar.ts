"use client";

import { useState, useEffect, useCallback } from "react";
import type { AppUser } from "@/app/types/auth";
import { CellarWine, CellarFormData } from "@/app/types/cellar";

const CACHE_KEY = "wine-cellar-cellar-cache";
const LOCAL_KEY = "wine-cellar-cellar-local";

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

export function useCellar(user: AppUser | null) {
  const [cellarWines, setCellarWines] = useState<CellarWine[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    if (!user) {
      setCellarWines(loadJson<CellarWine[]>(LOCAL_KEY, []));
      setIsLoaded(true);
      return;
    }

    (async () => {
      try {
        const { cellarWines: nextCellarWines } = await api<{ cellarWines: CellarWine[] }>("/api/cellar");
        setCellarWines(nextCellarWines);
        saveJson(CACHE_KEY, nextCellarWines);
      } catch {
        setCellarWines(loadJson<CellarWine[]>(CACHE_KEY, []));
      } finally {
        setIsLoaded(true);
      }
    })();
  }, [user?.id, user]);

  const addCellarWine = useCallback(
    async (data: CellarFormData): Promise<CellarWine> => {
      if (user) {
        const { cellarWine } = await api<{ cellarWine: CellarWine }>("/api/cellar", {
          method: "POST",
          body: JSON.stringify(data),
        });
        const next = [cellarWine, ...cellarWines];
        setCellarWines(next);
        saveJson(CACHE_KEY, next);
        return cellarWine;
      }

      const now = new Date().toISOString();
      const cellarWine: CellarWine = {
        ...data,
        id: `cellar-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      };
      const next = [cellarWine, ...cellarWines];
      setCellarWines(next);
      saveJson(LOCAL_KEY, next);
      return cellarWine;
    },
    [user, cellarWines]
  );

  const updateCellarWine = useCallback(
    async (id: string, data: CellarFormData): Promise<void> => {
      const existing = cellarWines.find((w) => w.id === id);
      if (!existing) return;

      const updated = user
        ? (await api<{ cellarWine: CellarWine }>(`/api/cellar/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(data),
          })).cellarWine
        : { ...existing, ...data, updatedAt: new Date().toISOString() };

      const next = cellarWines.map((w) => (w.id === id ? updated : w));
      setCellarWines(next);
      saveJson(user ? CACHE_KEY : LOCAL_KEY, next);
    },
    [user, cellarWines]
  );

  const deleteCellarWine = useCallback(
    async (id: string): Promise<void> => {
      if (user) {
        await api(`/api/cellar/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      const next = cellarWines.filter((w) => w.id !== id);
      setCellarWines(next);
      saveJson(user ? CACHE_KEY : LOCAL_KEY, next);
    },
    [user, cellarWines]
  );

  const drinkOne = useCallback(
    async (id: string): Promise<number> => {
      const wine = cellarWines.find((w) => w.id === id);
      if (!wine) return 0;
      const quantity = Math.max(0, wine.quantity - 1);

      if (quantity === 0) {
        await deleteCellarWine(id);
        return 0;
      }

      await updateCellarWine(id, { ...wine, quantity });
      return quantity;
    },
    [cellarWines, deleteCellarWine, updateCellarWine]
  );

  return { cellarWines, isLoaded, addCellarWine, updateCellarWine, deleteCellarWine, drinkOne };
}
