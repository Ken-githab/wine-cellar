"use client";

import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { Wine, WineFormData, EMPTY_DETAILED_RATINGS } from "@/app/types/wine";
import { supabase, isSupabaseConfigured } from "@/app/lib/supabase";

// ─── localStorage keys ───────────────────────────────────────────────────────
const LEGACY_KEY = "wine-cellar-data";   // 移行元（旧バージョン）
const CACHE_KEY  = "wine-cellar-cache";  // Supabase取得後のオフラインキャッシュ
const LOCAL_KEY  = "wine-cellar-local";  // Supabase未設定時のローカルストレージ

// ─── DB <-> App 変換 ─────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): Wine {
  // Supabase が JSONB を文字列として返す場合があるので parse する
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tn: any = row.tasting_note ?? {};
  if (typeof tn === "string") {
    try { tn = JSON.parse(tn); } catch { tn = {}; }
  }
  return {
    id: row.id,
    name: row.name,
    producer: row.producer ?? "",
    vintage: row.vintage != null ? String(row.vintage) : "",
    country: row.country ?? "",
    region: row.region ?? "",
    grapeVariety: row.grape_variety ?? "",
    price: row.price ?? "",
    url: row.url ?? "",
    useCoravin: row.use_coravin ?? false,
    goodValue: row.good_value ?? false,
    photos: row.photos ?? [],
    tastingNote: {
      rating: tn.rating ?? 0,
      memo: tn.memo ?? "",
      date: tn.date ?? "",
      detailedRatings: {
        ...EMPTY_DETAILED_RATINGS,
        ...(tn.detailedRatings ?? {}),
      },
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(wine: Wine, userId: string) {
  return {
    id: wine.id,
    user_id: userId,
    name: wine.name,
    producer: wine.producer,
    vintage: wine.vintage || null,
    country: wine.country,
    region: wine.region,
    grape_variety: wine.grapeVariety,
    price: wine.price || null,
    url: wine.url || null,
    use_coravin: wine.useCoravin,
    good_value: wine.goodValue,
    photos: wine.photos,
    tasting_note: wine.tastingNote,
    created_at: wine.createdAt,
    updated_at: wine.updatedAt,
  };
}

function generateId() {
  return `wine-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useWines(user: User | null) {
  const [wines, setWines] = useState<Wine[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // localStorageキャッシュ操作
  const saveCache = (data: Wine[]) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
  };
  const loadCache = (): Wine[] => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]"); } catch { return []; }
  };

  // Supabase未設定時はローカルストレージを直接使う
  const saveLocal = (data: Wine[]) => {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch { /* quota */ }
  };
  const loadLocal = (): Wine[] => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]"); } catch { return []; }
  };

  // ─── データ読み込み ───────────────────────────────────────────────────────
  useEffect(() => {
    // Supabase未設定 or 未ログイン → ローカルモード
    if (!isSupabaseConfigured || !user) {
      setWines(loadLocal());
      setIsLoaded(true);
      return;
    }

    // Supabaseから取得
    (async () => {
      try {
        const { data, error } = await supabase
          .from("wines")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        const mapped = (data ?? []).map(fromRow);
        setWines(mapped);
        saveCache(mapped);
        setIsOnline(true);
      } catch {
        // オフライン時はキャッシュを表示
        setWines(loadCache());
        setIsOnline(false);
      } finally {
        setIsLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ─── CRUD ────────────────────────────────────────────────────────────────
  const addWine = useCallback(
    async (data: WineFormData): Promise<Wine> => {
      const now = new Date().toISOString();
      const wine: Wine = { ...data, id: generateId(), createdAt: now, updatedAt: now };

      if (isSupabaseConfigured && user) {
        const { error } = await supabase.from("wines").insert(toRow(wine, user.id));
        if (error) throw error;
        const next = [wine, ...wines];
        setWines(next);
        saveCache(next);
      } else {
        const next = [wine, ...wines];
        setWines(next);
        saveLocal(next);
      }
      return wine;
    },
    [user, wines]
  );

  const updateWine = useCallback(
    async (id: string, data: WineFormData): Promise<void> => {
      const now = new Date().toISOString();
      const existing = wines.find((w) => w.id === id);
      if (!existing) return;
      const updated: Wine = { ...existing, ...data, updatedAt: now };

      if (isSupabaseConfigured && user) {
        const { error } = await supabase
          .from("wines")
          .update({
            name: updated.name,
            producer: updated.producer,
            vintage: updated.vintage || null,
            country: updated.country,
            region: updated.region,
            grape_variety: updated.grapeVariety,
            price: updated.price || null,
            url: updated.url || null,
            use_coravin: updated.useCoravin,
            good_value: updated.goodValue,
            photos: updated.photos,
            tasting_note: updated.tastingNote,
            updated_at: now,
          })
          .eq("id", id)
          .eq("user_id", user.id);
        if (error) throw error;
        const next = wines.map((w) => (w.id === id ? updated : w));
        setWines(next);
        saveCache(next);
      } else {
        const next = wines.map((w) => (w.id === id ? updated : w));
        setWines(next);
        saveLocal(next);
      }
    },
    [user, wines]
  );

  const deleteWine = useCallback(
    async (id: string): Promise<void> => {
      if (isSupabaseConfigured && user) {
        const { error } = await supabase
          .from("wines")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);
        if (error) throw error;
        const next = wines.filter((w) => w.id !== id);
        setWines(next);
        saveCache(next);
      } else {
        const next = wines.filter((w) => w.id !== id);
        setWines(next);
        saveLocal(next);
      }
    },
    [user, wines]
  );

  // ─── localStorageからSupabaseへの一括移行 ────────────────────────────────
  const migrateFromLocalStorage = useCallback(
    async (): Promise<number> => {
      if (!user) return 0;
      try {
        const stored = localStorage.getItem(LEGACY_KEY);
        if (!stored) return 0;
        const localWines: Wine[] = JSON.parse(stored);
        if (!localWines.length) return 0;

        const rows = localWines.map((w) => toRow(w, user.id));
        const { error } = await supabase
          .from("wines")
          .upsert(rows, { onConflict: "id" });
        if (error) throw error;

        localStorage.removeItem(LEGACY_KEY);

        // Reload from Supabase
        const { data } = await supabase
          .from("wines")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        const mapped = (data ?? []).map(fromRow);
        setWines(mapped);
        saveCache(mapped);
        return localWines.length;
      } catch {
        return 0;
      }
    },
    [user]
  );

  return { wines, isLoaded, isOnline, addWine, updateWine, deleteWine, migrateFromLocalStorage };
}
