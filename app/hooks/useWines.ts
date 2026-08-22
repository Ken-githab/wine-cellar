"use client";

import { useState, useEffect, useCallback } from "react";
import { Wine, WineFormData } from "@/app/types/wine";
import type { AppUser } from "@/app/types/auth";
import { enqueue, dequeue, loadOutbox } from "@/app/lib/offline-store";

const LEGACY_KEY = "wine-cellar-data";
const CACHE_KEY = "wine-cellar-cache";
const LOCAL_KEY = "wine-cellar-local";

interface AddWineOptions {
  cellarConsumptionId?: string;
}

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
  const [pendingCount, setPendingCount] = useState(0);
  const cacheKey = user ? `${CACHE_KEY}:${user.id}` : CACHE_KEY;

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
        saveJson(cacheKey, nextWines);
        setIsOnline(true);
      } catch {
        setWines(loadJson<Wine[]>(cacheKey, []));
        setIsOnline(false);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, [cacheKey, user?.id, user]);

  const addWine = useCallback(
    async (data: WineFormData, options?: AddWineOptions): Promise<Wine> => {
      if (user) {
        try {
          const { wine } = await api<{ wine: Wine }>("/api/wines", {
            method: "POST",
            body: JSON.stringify({ ...data, cellarConsumptionId: options?.cellarConsumptionId }),
          });
          const next = [wine, ...wines];
          setWines(next);
          saveJson(cacheKey, next);
          return wine;
        } catch (error) {
          // 共有在庫からの飲用は、在庫状態との原子性を守るためオンライン時だけ保存する。
          if (options?.cellarConsumptionId) throw error;
          // 通信に失敗しても通常の記録を捨てない。未送信として保持し、画面には即反映する
          if (navigator.onLine && !(error instanceof TypeError)) throw error;
          const queued = enqueue({
            kind: "wine",
            op: "create",
            payload: data,
            label: data.name || "名称未設定のワイン",
          });
          const now = new Date().toISOString();
          const wine: Wine = { ...data, id: queued.id, createdAt: now, updatedAt: now };
          const next = [wine, ...wines];
          setWines(next);
          saveJson(cacheKey, next);
          setPendingCount(loadOutbox().length);
          return wine;
        }
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
    [cacheKey, user, wines]
  );

  const updateWine = useCallback(
    async (id: string, data: WineFormData): Promise<void> => {
      const existing = wines.find((w) => w.id === id);
      if (!existing) return;

      let updated: Wine = { ...existing, ...data, updatedAt: new Date().toISOString() };
      if (user) {
        try {
          updated = (
            await api<{ wine: Wine }>(`/api/wines/${encodeURIComponent(id)}`, {
              method: "PUT",
              body: JSON.stringify(data),
            })
          ).wine;
        } catch (error) {
          if (navigator.onLine && !(error instanceof TypeError)) throw error;
          // 未送信のまま(id が ob- で始まる)なら、キューの中身を差し替えるだけでよい
          const pending = loadOutbox().find((item) => item.id === id);
          if (pending) {
            dequeue(id);
            enqueue({ ...pending, payload: data, label: data.name || pending.label });
          } else {
            enqueue({
              kind: "wine",
              op: "update",
              targetId: id,
              payload: data,
              label: data.name || "名称未設定のワイン",
            });
          }
          setPendingCount(loadOutbox().length);
        }
      }

      const next = wines.map((w) => (w.id === id ? updated : w));
      setWines(next);
      saveJson(user ? cacheKey : LOCAL_KEY, next);
    },
    [cacheKey, user, wines]
  );

  const deleteWine = useCallback(
    async (id: string): Promise<void> => {
      if (user) {
        await api(`/api/wines/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      const next = wines.filter((w) => w.id !== id);
      setWines(next);
      saveJson(user ? cacheKey : LOCAL_KEY, next);
    },
    [cacheKey, user, wines]
  );

  // 未送信の記録をサーバーへ送り直す。成功したぶんだけキューから外すので、
  // 途中で再び通信が切れても残りは次の機会に再送される
  const flushOutbox = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    const queue = loadOutbox().filter((item) => item.kind === "wine");
    let sent = 0;
    for (const item of queue) {
      try {
        if (item.op === "create") {
          const { wine } = await api<{ wine: Wine }>("/api/wines", {
            method: "POST",
            body: JSON.stringify(item.payload),
          });
          setWines((prev) => {
            const next = prev.map((w) => (w.id === item.id ? wine : w));
            saveJson(cacheKey, next);
            return next;
          });
        } else if (item.targetId) {
          await api(`/api/wines/${encodeURIComponent(item.targetId)}`, {
            method: "PUT",
            body: JSON.stringify(item.payload),
          });
        }
        dequeue(item.id);
        sent += 1;
      } catch {
        break; // まだ通信できない。残りは次回に回す
      }
    }
    setPendingCount(loadOutbox().length);
    return sent;
  }, [cacheKey, user]);

  // 起動時とオンライン復帰時に自動で再送
  useEffect(() => {
    if (!user) return;
    setPendingCount(loadOutbox().length);
    void flushOutbox();
    const onOnline = () => void flushOutbox();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [user, flushOutbox]);

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

  return {
    wines,
    isLoaded,
    isOnline,
    pendingCount,
    flushOutbox,
    addWine,
    updateWine,
    deleteWine,
    migrateFromLocalStorage,
  };
}
