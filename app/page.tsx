"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/app/hooks/useAuth";
import { useWines } from "@/app/hooks/useWines";
import { LoginForm } from "@/app/components/LoginForm";
import { WineCard } from "@/app/components/WineCard";
import { WineForm } from "@/app/components/WineForm";
import { Modal } from "@/app/components/Modal";
import { Wine, WineFormData } from "@/app/types/wine";
import { isSupabaseConfigured } from "@/app/lib/supabase";
import { Toast } from "@/app/components/Toast";
import { WineDetailModal } from "@/app/components/WineDetailModal";

type SortKey = "createdAt" | "rating" | "vintage" | "price";

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { wines, isLoaded, isOnline, addWine, updateWine, deleteWine, migrateFromLocalStorage } = useWines(user);

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Wine | null>(null);
  const [detailWine, setDetailWine] = useState<Wine | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [filterGoodValue, setFilterGoodValue] = useState(false);
  const [migrateBanner, setMigrateBanner] = useState<{ count: number } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showError = (err: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = (err as any)?.message ?? (err as any)?.details ?? JSON.stringify(err);
    setToast({ message: `エラー: ${msg}`, type: "error" });
  };

  useEffect(() => {
    if (!user || !isLoaded || !isSupabaseConfigured) return;
    try {
      const old = localStorage.getItem("wine-cellar-data");
      if (old) {
        const parsed: Wine[] = JSON.parse(old);
        if (parsed.length > 0) setMigrateBanner({ count: parsed.length });
      }
    } catch { /* ignore */ }
  }, [user, isLoaded]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsePrice = (p: any) => typeof p === "number" ? p : parseInt(String(p ?? "").replace(/[^\d]/g, "")) || 0;
    const result = wines.filter((w) => {
      const textOk = !q || w.name.toLowerCase().includes(q) || w.producer.toLowerCase().includes(q) ||
        w.region.toLowerCase().includes(q) || w.grapeVariety.toLowerCase().includes(q) || w.country.toLowerCase().includes(q);
      const goodValueOk = !filterGoodValue || (w.goodValue ?? false);
      return textOk && goodValueOk;
    });
    return [...result].sort((a, b) => {
      if (sortKey === "createdAt") return b.createdAt.localeCompare(a.createdAt);
      if (sortKey === "rating") return b.tastingNote.rating - a.tastingNote.rating;
      if (sortKey === "vintage") return (parseInt(String(b.vintage)) || 0) - (parseInt(String(a.vintage)) || 0);
      if (sortKey === "price") return parsePrice(b.price) - parsePrice(a.price);
      return 0;
    });
  }, [wines, search, sortKey, filterGoodValue]);

  const handleAdd = async (data: WineFormData) => {
    try { await addWine(data); setShowAdd(false); setToast({ message: "ワインを登録しました", type: "success" }); }
    catch (err) { showError(err); }
  };

  const handleEdit = async (data: WineFormData) => {
    if (!editTarget) return;
    try { await updateWine(editTarget.id, data); setEditTarget(null); setToast({ message: "ワインを更新しました", type: "success" }); }
    catch (err) { showError(err); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteWine(id); }
    catch (err) { showError(err); }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8FC] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E8E2F4] border-t-[#634B99] rounded-full animate-spin" />
      </div>
    );
  }

  if (isSupabaseConfigured && !user) return <LoginForm />;

  return (
    <div className="min-h-screen bg-[#FAF8FC]">

      {/* Header */}
      <header
        className="sticky top-0 z-40 bg-[#FAF8FC]/95 backdrop-blur-sm border-b border-[#E8E2F4]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[#1E0F38] leading-tight">🍇 Wine Cellar</h1>
            {isLoaded && wines.length > 0 && (
              <p className="text-xs text-[#8E75B8]">{wines.length} 本のワイン</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <button onClick={() => signOut()}
                className="w-9 h-9 rounded-full bg-[#E8E2F4] text-[#634B99] flex items-center justify-center hover:bg-[#CABFE3] transition"
                title="ログアウト">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
            <button onClick={() => setShowAdd(true)}
              className="w-10 h-10 rounded-full bg-[#634B99] text-white shadow-md flex items-center justify-center hover:bg-[#1E0F38] transition"
              title="ワインを追加">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {isLoaded && wines.length > 0 && (
          <div className="max-w-lg mx-auto px-4 pb-3 space-y-2">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E75B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                className="w-full pl-9 pr-3 py-2 bg-[#E8E2F4] rounded-2xl text-sm text-[#1E0F38] placeholder:text-[#CABFE3] focus:outline-none focus:ring-2 focus:ring-[#8E75B8]/20"
                placeholder="ワイン名・国・産地・品種で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {/* Sort + filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  className="w-full appearance-none bg-[#E8E2F4] text-[#634B99] rounded-2xl pl-3 pr-7 py-2 text-sm font-medium focus:outline-none"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                >
                  <option value="createdAt">登録順</option>
                  <option value="rating">評価順</option>
                  <option value="vintage">ビンテージ順</option>
                  <option value="price">価格順</option>
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#634B99] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <button
                onClick={() => setFilterGoodValue(!filterGoodValue)}
                className={`shrink-0 px-4 py-2 rounded-2xl border-2 text-sm font-medium transition ${
                  filterGoodValue ? "bg-[#634B99] text-white border-[#634B99]" : "bg-[#FAF8FC] border-[#E8E2F4] text-[#8E75B8]"
                }`}
              >
                コスパ最高
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs text-center py-2 px-4">
          オフライン中 — キャッシュデータを表示しています
        </div>
      )}

      {/* Migration banner */}
      {migrateBanner && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          <div className="bg-blue-50 rounded-2xl p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-blue-800">
              📦 ローカルに <strong>{migrateBanner.count} 本</strong> のデータが見つかりました
            </p>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setMigrateBanner(null)} className="text-xs text-blue-500">あとで</button>
              <button onClick={async () => { setMigrating(true); await migrateFromLocalStorage(); setMigrateBanner(null); setMigrating(false); }}
                disabled={migrating}
                className="text-xs bg-blue-700 text-white px-3 py-1.5 rounded-xl disabled:opacity-50">
                {migrating ? "移行中..." : "移行する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main
        className="max-w-lg mx-auto px-4 py-4 space-y-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
      >
        {!isLoaded ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#E8E2F4] border-t-[#634B99] rounded-full animate-spin" />
          </div>
        ) : wines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-20 h-20 bg-[#E8E2F4] rounded-full flex items-center justify-center text-4xl">🍾</div>
            <div className="text-center space-y-1">
              <p className="text-[#1E0F38] font-semibold text-lg">まだワインがありません</p>
              <p className="text-[#8E75B8] text-sm">最初の一本を登録しましょう</p>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="mt-2 px-6 py-3 bg-[#634B99] text-white rounded-3xl text-sm font-semibold shadow-[0_4px_16px_rgba(99,75,153,0.3)] hover:bg-[#1E0F38] transition">
              ワインを追加
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-16 h-16 bg-[#E8E2F4] rounded-full flex items-center justify-center text-2xl">🔍</div>
            <p className="text-[#8E75B8] text-sm text-center">
              {filterGoodValue ? "コスパ最高のワインがありません" : `「${search}」に一致するワインは見つかりませんでした`}
            </p>
            <button onClick={() => { setSearch(""); setFilterGoodValue(false); }}
              className="text-[#634B99] text-sm underline underline-offset-2">
              すべて表示
            </button>
          </div>
        ) : (
          filtered.map((wine) => (
            <WineCard
              key={wine.id}
              wine={wine}
              onEdit={setEditTarget}
              onDelete={handleDelete}
              onViewDetail={setDetailWine}
            />
          ))
        )}
      </main>

      {/* Add modal */}
      {showAdd && (
        <Modal title="ワインを追加" onClose={() => setShowAdd(false)}>
          <WineForm onSubmit={handleAdd} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {/* Edit modal */}
      {editTarget && (
        <Modal title="ワインを編集" onClose={() => setEditTarget(null)}>
          <WineForm initial={editTarget} onSubmit={handleEdit} onCancel={() => setEditTarget(null)} />
        </Modal>
      )}

      {/* Detail modal */}
      {detailWine && (
        <WineDetailModal
          wine={detailWine}
          onEdit={(w) => { setEditTarget(w); setDetailWine(null); }}
          onDelete={handleDelete}
          onClose={() => setDetailWine(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
