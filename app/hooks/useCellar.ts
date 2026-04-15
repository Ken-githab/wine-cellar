"use client";

import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { CellarWine, CellarFormData } from "@/app/types/cellar";
import { supabase, isSupabaseConfigured } from "@/app/lib/supabase";

const CACHE_KEY = "wine-cellar-cellar-cache";
const LOCAL_KEY = "wine-cellar-cellar-local";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): CellarWine {
  return {
    id: row.id,
    name: row.name,
    producer: row.producer ?? "",
    vintage: row.vintage != null ? String(row.vintage) : "",
    country: row.country ?? "",
    region: row.region ?? "",
    grapeVariety: row.grape_variety ?? "",
    price: row.price != null ? String(row.price) : "",
    quantity: row.quantity ?? 1,
    wineType: row.wine_type ?? "",
    drinkFrom: row.drink_from ?? "",
    drinkUntil: row.drink_until ?? "",
    photos: row.photos ?? [],
    url: row.url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateId() {
  return `cellar-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useCellar(user: User | null) {
  const [cellarWines, setCellarWines] = useState<CellarWine[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const saveCache = (data: CellarWine[]) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
  };
  const loadCache = (): CellarWine[] => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]"); } catch { return []; }
  };
  const saveLocal = (data: CellarWine[]) => {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch { /* quota */ }
  };
  const loadLocal = (): CellarWine[] => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]"); } catch { return []; }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !user) {
      setCellarWines(loadLocal());
      setIsLoaded(true);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from("cellar_wines")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const mapped = (data ?? []).map(fromRow);
        setCellarWines(mapped);
        saveCache(mapped);
      } catch {
        setCellarWines(loadCache());
      } finally {
        setIsLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const addCellarWine = useCallback(
    async (data: CellarFormData): Promise<CellarWine> => {
      const now = new Date().toISOString();
      const wine: CellarWine = { ...data, id: generateId(), createdAt: now, updatedAt: now };

      if (isSupabaseConfigured && user) {
        const { error } = await supabase.from("cellar_wines").insert({
          id: wine.id,
          user_id: user.id,
          name: wine.name,
          producer: wine.producer,
          vintage: wine.vintage || null,
          country: wine.country,
          region: wine.region,
          grape_variety: wine.grapeVariety,
          price: wine.price || null,
          quantity: wine.quantity,
          wine_type: wine.wineType || null,
          drink_from: wine.drinkFrom || null,
          drink_until: wine.drinkUntil || null,
          photos: wine.photos,
          url: wine.url || null,
          created_at: wine.createdAt,
          updated_at: wine.updatedAt,
        });
        if (error) throw error;
        const next = [wine, ...cellarWines];
        setCellarWines(next);
        saveCache(next);
      } else {
        const next = [wine, ...cellarWines];
        setCellarWines(next);
        saveLocal(next);
      }
      return wine;
    },
    [user, cellarWines]
  );

  const updateCellarWine = useCallback(
    async (id: string, data: CellarFormData): Promise<void> => {
      const now = new Date().toISOString();
      const existing = cellarWines.find((w) => w.id === id);
      if (!existing) return;
      const updated: CellarWine = { ...existing, ...data, updatedAt: now };

      if (isSupabaseConfigured && user) {
        const { error } = await supabase
          .from("cellar_wines")
          .update({
            name: updated.name,
            producer: updated.producer,
            vintage: updated.vintage || null,
            country: updated.country,
            region: updated.region,
            grape_variety: updated.grapeVariety,
            price: updated.price || null,
            quantity: updated.quantity,
            wine_type: updated.wineType || null,
            drink_from: updated.drinkFrom || null,
            drink_until: updated.drinkUntil || null,
            photos: updated.photos,
            url: updated.url || null,
            updated_at: now,
          })
          .eq("id", id)
          .eq("user_id", user.id);
        if (error) throw error;
        const next = cellarWines.map((w) => (w.id === id ? updated : w));
        setCellarWines(next);
        saveCache(next);
      } else {
        const next = cellarWines.map((w) => (w.id === id ? updated : w));
        setCellarWines(next);
        saveLocal(next);
      }
    },
    [user, cellarWines]
  );

  const deleteCellarWine = useCallback(
    async (id: string): Promise<void> => {
      if (isSupabaseConfigured && user) {
        const { error } = await supabase
          .from("cellar_wines")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);
        if (error) throw error;
        const next = cellarWines.filter((w) => w.id !== id);
        setCellarWines(next);
        saveCache(next);
      } else {
        const next = cellarWines.filter((w) => w.id !== id);
        setCellarWines(next);
        saveLocal(next);
      }
    },
    [user, cellarWines]
  );

  // 1本減らす。戻り値: 更新後の在庫数
  const drinkOne = useCallback(
    async (id: string): Promise<number> => {
      const wine = cellarWines.find((w) => w.id === id);
      if (!wine) return 0;
      const newQty = Math.max(0, wine.quantity - 1);

      if (newQty === 0) {
        await deleteCellarWine(id);
        return 0;
      }

      const now = new Date().toISOString();
      if (isSupabaseConfigured && user) {
        const { error } = await supabase
          .from("cellar_wines")
          .update({ quantity: newQty, updated_at: now })
          .eq("id", id)
          .eq("user_id", user.id);
        if (error) throw error;
        const next = cellarWines.map((w) => (w.id === id ? { ...w, quantity: newQty, updatedAt: now } : w));
        setCellarWines(next);
        saveCache(next);
      } else {
        const next = cellarWines.map((w) => (w.id === id ? { ...w, quantity: newQty, updatedAt: now } : w));
        setCellarWines(next);
        saveLocal(next);
      }
      return newQty;
    },
    [user, cellarWines, deleteCellarWine]
  );

  return { cellarWines, isLoaded, addCellarWine, updateCellarWine, deleteCellarWine, drinkOne };
}
