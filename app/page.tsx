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

type SortKey = "createdAt" | "rating" | "vintage" | "price" | "goodValue";

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { wines, isLoaded, isOnline, addWine, updateWine, deleteWine, migrateFromLocalStorage } =
    useWines(user);

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Wine | null>(null);
  const [detailWine, setDetailWine] = useState<Wine | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [migrateBanner, setMigrateBanner] = useState<{ count: number } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const showError = (err: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = (err as any)?.message ?? (err as any)?.details ?? JSON.stringify(err);
    setToast({ message: `エラー: ${msg}`, type: "error" });
  };

  // ログイン後に旧localStorageデータの移行を促す
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

  const handleMigrate = async () => {
    setMigrating(true);
    await migrateFromLocalStorage();
    setMigrateBanner(null);
    setMigrating(false);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = wines.filter((w) => {
      const textOk = !q ||
        w.name.toLowerCase().includes(q) ||
        w.producer.toLowerCase().includes(q) ||
        w.region.toLowerCase().includes(q) ||
        w.grapeVariety.toLowerCase().includes(q) ||
        w.country.toLowerCase().includes(q);
      const goodValueOk = sortKey !== "goodValue" || (w.goodValue ?? false);
      return textOk && goodValueOk;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsePrice = (p: any) => typeof p === "number" ? p : parseInt(String(p ?? "").replace(/[^\d]/g, "")) || 0;
    return [...result].sort((a, b) => {
      if (sortKey === "createdAt") return b.createdAt.localeCompare(a.createdAt);
      if (sortKey === "rating" || sortKey === "goodValue") return b.tastingNote.rating - a.tastingNote.rating;
      if (sortKey === "vintage") return (parseInt(String(b.vintage)) || 0) - (parseInt(String(a.vintage)) || 0);
      if (sortKey === "price") return parsePrice(b.price) - parsePrice(a.price);
      return 0;
    });
  }, [wines, search, sortKey]);

  const handleAdd = async (data: WineFormData) => {
    try {
      await addWine(data);
      setShowAdd(false);
      setToast({ message: "ワインを登録しました", type: "success" });
    } catch (err) {
      showError(err);
    }
  };

  const handleEdit = async (data: WineFormData) => {
    if (!editTarget) return;
    try {
      await updateWine(editTarget.id, data);
      setEditTarget(null);
      setToast({ message: "ワインを更新しました", type: "success" });
    } catch (err) {
      showError(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWine(id);
    } catch (err) {
      showError(err);
    }
  };

  // 認証ローディング中
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">読み込み中...</div>
      </div>
    );
  }

  // Supabase設定済みで未ログイン → ログイン画面
  if (isSupabaseConfigured && !user) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-rose-900 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🍷</span>
            <div>
              <h1 className="text-xl font-bold leading-tight">Wine Cellar</h1>
              <p className="text-rose-200 text-xs">
                {user ? user.email : "マイワインコレクション"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-white text-rose-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-rose-50 transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">ワインを追加</span>
              <span className="sm:hidden">追加</span>
            </button>
            {user && (
              <button
                onClick={() => signOut()}
                className="p-2 rounded-lg text-rose-200 hover:text-white hover:bg-rose-800 transition"
                title="ログアウト"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm text-center py-2 px-4">
          オフライン中 — キャッシュデータを表示しています
        </div>
      )}

      {/* Migration banner */}
      {migrateBanner && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-blue-800">
              📦 ローカルに <strong>{migrateBanner.count} 本</strong> のワインデータが見つかりました。
              Supabaseへ移行しますか？
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setMigrateBanner(null)}
                className="text-sm text-blue-600 hover:underline"
              >
                あとで
              </button>
              <button
                onClick={handleMigrate}
                disabled={migrating}
                className="text-sm bg-blue-700 text-white px-3 py-1 rounded-lg hover:bg-blue-800 transition disabled:opacity-50"
              >
                {migrating ? "移行中..." : "移行する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Stats bar */}
        {isLoaded && wines.length > 0 && (
          <div className="flex gap-4 text-sm text-gray-600">
            <span>
              <strong className="text-gray-900">{wines.length}</strong> 本のワイン
            </span>
          </div>
        )}

        {/* Search & Sort */}
        {isLoaded && wines.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                placeholder="ワイン名・国・産地・品種で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="py-2 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="createdAt">登録順</option>
              <option value="rating">評価順</option>
              <option value="vintage">ビンテージ順</option>
              <option value="price">価格順</option>
              <option value="goodValue">コスパ最高</option>
            </select>
          </div>
        )}

        {/* Wine list */}
        {!isLoaded ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : wines.length === 0 ? (
          <div className="text-center py-24 space-y-3">
            <div className="text-6xl">🍾</div>
            <p className="text-gray-500 text-lg font-medium">まだワインが登録されていません</p>
            <p className="text-gray-400 text-sm">「ワインを追加」から最初の一本を登録しましょう</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-2 inline-flex items-center gap-1.5 bg-rose-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-rose-900 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              ワインを追加
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            「{search}」に一致するワインは見つかりませんでした
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((wine) => (
              <WineCard
                key={wine.id}
                wine={wine}
                onEdit={setEditTarget}
                onDelete={handleDelete}
                onViewDetail={setDetailWine}
              />
            ))}
          </div>
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
          <WineForm
            initial={editTarget}
            onSubmit={handleEdit}
            onCancel={() => setEditTarget(null)}
          />
        </Modal>
      )}

      {/* Detail modal */}
      {detailWine && (
        <WineDetailModal
          wine={detailWine}
          onEdit={(w) => { setEditTarget(w); setDetailWine(null); }}
          onClose={() => setDetailWine(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
