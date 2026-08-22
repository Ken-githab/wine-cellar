"use client";

import { useState, useEffect, useCallback } from "react";
import type { AppUser } from "@/app/types/auth";
import { CellarWine, CellarFormData } from "@/app/types/cellar";
import { enqueue, dequeue, loadOutbox } from "@/app/lib/offline-store";

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
  const [pendingCount, setPendingCount] = useState(0);
  const cacheKey = user ? `${CACHE_KEY}:${user.id}` : CACHE_KEY;

  const refreshCellar = useCallback(async (): Promise<CellarWine[]> => {
    if (!user) return [];
    const { cellarWines: nextCellarWines } = await api<{ cellarWines: CellarWine[] }>("/api/cellar");
    setCellarWines(nextCellarWines);
    saveJson(cacheKey, nextCellarWines);
    return nextCellarWines;
  }, [cacheKey, user]);

  useEffect(() => {
    setIsLoaded(false);
    if (!user) {
      setCellarWines(loadJson<CellarWine[]>(LOCAL_KEY, []));
      setIsLoaded(true);
      return;
    }

    (async () => {
      try {
        await refreshCellar();
      } catch {
        setCellarWines(loadJson<CellarWine[]>(cacheKey, []));
      } finally {
        setIsLoaded(true);
      }
    })();
  }, [cacheKey, refreshCellar, user?.id, user]);

  const addCellarWine = useCallback(
    async (data: CellarFormData): Promise<CellarWine> => {
      if (user) {
        try {
          const { cellarWine } = await api<{ cellarWine: CellarWine }>("/api/cellar", {
            method: "POST",
            body: JSON.stringify(data),
          });
          const next = [cellarWine, ...cellarWines];
          setCellarWines(next);
          saveJson(cacheKey, next);
          return cellarWine;
        } catch (error) {
          // 通信に失敗しても登録を捨てない。未送信として保持し、画面には即反映する
          if (navigator.onLine && !(error instanceof TypeError)) throw error;
          const queued = enqueue({
            kind: "cellar",
            op: "create",
            payload: data,
            label: data.name || "名称未設定のワイン",
          });
          const at = new Date().toISOString();
          const cellarWine: CellarWine = {
            ...data,
            id: queued.id,
            createdAt: at,
            updatedAt: at,
            activeConsumptionId: null,
            drinkStatus: "available",
          };
          const next = [cellarWine, ...cellarWines];
          setCellarWines(next);
          saveJson(cacheKey, next);
          setPendingCount(loadOutbox().length);
          return cellarWine;
        }
      }

      const now = new Date().toISOString();
      const cellarWine: CellarWine = {
        ...data,
        id: `cellar-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: now,
        updatedAt: now,
        activeConsumptionId: null,
        drinkStatus: "available",
      };
      const next = [cellarWine, ...cellarWines];
      setCellarWines(next);
      saveJson(LOCAL_KEY, next);
      return cellarWine;
    },
    [cacheKey, user, cellarWines]
  );

  const updateCellarWine = useCallback(
    async (id: string, data: CellarFormData): Promise<void> => {
      const existing = cellarWines.find((w) => w.id === id);
      if (!existing) return;

      const updated = user
        ? {
            ...(await api<{ cellarWine: CellarWine }>(`/api/cellar/${encodeURIComponent(id)}`, {
              method: "PUT",
              body: JSON.stringify(data),
            })).cellarWine,
            activeConsumptionId: existing.activeConsumptionId,
            drinkStatus: existing.drinkStatus,
          }
        : { ...existing, ...data, updatedAt: new Date().toISOString() };

      const next = cellarWines.map((w) => (w.id === id ? updated : w));
      setCellarWines(next);
      saveJson(user ? cacheKey : LOCAL_KEY, next);
    },
    [cacheKey, user, cellarWines]
  );

  const deleteCellarWine = useCallback(
    async (id: string, opts?: { keepPhotos?: boolean }): Promise<void> => {
      if (user) {
        const query = opts?.keepPhotos ? "?keepPhotos=1" : "";
        await api(`/api/cellar/${encodeURIComponent(id)}${query}`, { method: "DELETE" });
      }
      const next = cellarWines.filter((w) => w.id !== id);
      setCellarWines(next);
      saveJson(user ? cacheKey : LOCAL_KEY, next);
    },
    [cacheKey, user, cellarWines]
  );

  const startDrink = useCallback(
    async (id: string): Promise<{ consumptionId: string; remainingQuantity: number }> => {
      const result = await api<{
        consumptionId: string;
        remainingQuantity: number;
      }>(`/api/cellar/${encodeURIComponent(id)}/drink`, { method: "POST" });
      await refreshCellar();
      return result;
    },
    [refreshCellar]
  );

  const completeDrinkWithoutRecord = useCallback(
    async (id: string, consumptionId: string): Promise<void> => {
      await api(`/api/cellar/${encodeURIComponent(id)}/drink`, {
        method: "PATCH",
        body: JSON.stringify({ consumptionId }),
      });
      await refreshCellar();
    },
    [refreshCellar]
  );

  // 未送信のセラー登録をサーバーへ送り直す(成功したぶんだけキューから外す)
  const flushCellarOutbox = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    let sent = 0;
    for (const item of loadOutbox().filter((i) => i.kind === "cellar" && i.op === "create")) {
      try {
        const { cellarWine } = await api<{ cellarWine: CellarWine }>("/api/cellar", {
          method: "POST",
          body: JSON.stringify(item.payload),
        });
        setCellarWines((prev) => {
          const next = prev.map((w) => (w.id === item.id ? cellarWine : w));
          saveJson(cacheKey, next);
          return next;
        });
        dequeue(item.id);
        sent += 1;
      } catch {
        break; // まだ通信できない。残りは次回に回す
      }
    }
    setPendingCount(loadOutbox().length);
    return sent;
  }, [cacheKey, user]);

  useEffect(() => {
    if (!user) return;
    setPendingCount(loadOutbox().length);
    void flushCellarOutbox();
    const onOnline = () => void flushCellarOutbox();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [user, flushCellarOutbox]);

  // 別アカウント側の操作を、アプリへ戻ったタイミングで反映する。
  useEffect(() => {
    if (!user) return;
    const onFocus = () => void refreshCellar();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshCellar();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshCellar, user]);

  return {
    cellarWines,
    isLoaded,
    pendingCount,
    refreshCellar,
    flushCellarOutbox,
    addCellarWine,
    updateCellarWine,
    deleteCellarWine,
    startDrink,
    completeDrinkWithoutRecord,
  };
}
