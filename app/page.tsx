"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/app/hooks/useAuth";
import { useWines } from "@/app/hooks/useWines";
import { useCellar } from "@/app/hooks/useCellar";
import { LoginForm } from "@/app/components/LoginForm";
import { WineCard } from "@/app/components/WineCard";
import { WineForm } from "@/app/components/WineForm";
import { CellarCard } from "@/app/components/CellarCard";
import { CellarForm } from "@/app/components/CellarForm";
import { Modal } from "@/app/components/Modal";
import { Wine, WineFormData, EMPTY_DETAILED_RATINGS } from "@/app/types/wine";
import { CellarWine, CellarFormData } from "@/app/types/cellar";
import { isSupabaseConfigured } from "@/app/lib/supabase";
import { Toast } from "@/app/components/Toast";
import { WineDetailModal } from "@/app/components/WineDetailModal";

type SortKey = "createdAt" | "rating" | "vintage" | "price";
type Tab = "cellar" | "log";

// セラーワインからテイスティング記録フォームに転記するための変換
function cellarToWine(c: CellarWine): Wine {
  return {
    id: c.id,
    name: c.name,
    producer: c.producer,
    vintage: c.vintage,
    country: c.country,
    region: c.region,
    grapeVariety: c.grapeVariety,
    price: c.price,
    url: c.url,
    useCoravin: false,
    goodValue: false,
    photos: c.photos,
    tastingNote: {
      rating: 0,
      memo: "",
      date: new Date().toISOString().split("T")[0],
      detailedRatings: { ...EMPTY_DETAILED_RATINGS },
    },
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { wines, isLoaded, isOnline, addWine, updateWine, deleteWine, migrateFromLocalStorage } = useWines(user);
  const { cellarWines, isLoaded: cellarLoaded, addCellarWine, updateCellarWine, deleteCellarWine, drinkOne } = useCellar(user);

  const [tab, setTab] = useState<Tab>("cellar");
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Wine | null>(null);
  const [detailWine, setDetailWine] = useState<Wine | null>(null);
  const [showCellarAdd, setShowCellarAdd] = useState(false);
  const [cellarEditTarget, setCellarEditTarget] = useState<CellarWine | null>(null);
  const [drinkConfirm, setDrinkConfirm] = useState<CellarWine | null>(null);
  const [drinkAndRecord, setDrinkAndRecord] = useState<Wine | null>(null);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [filterGoodValue, setFilterGoodValue] = useState(false);
  const [migrateBanner, setMigrateBanner] = useState<{ count: number } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

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

  const handleCellarAdd = async (data: CellarFormData) => {
    try { await addCellarWine(data); setShowCellarAdd(false); setToast({ message: "セラーに追加しました", type: "success" }); }
    catch (err) { showError(err); }
  };

  const handleCellarEdit = async (data: CellarFormData) => {
    if (!cellarEditTarget) return;
    try { await updateCellarWine(cellarEditTarget.id, data); setCellarEditTarget(null); setToast({ message: "セラーを更新しました", type: "success" }); }
    catch (err) { showError(err); }
  };

  const handleDrink = (wine: CellarWine) => {
    setDrinkConfirm(wine);
  };

  const confirmDrink = async (record: boolean) => {
    if (!drinkConfirm) return;
    const wine = drinkConfirm;
    setDrinkConfirm(null);
    try {
      const remaining = await drinkOne(wine.id);
      if (record) {
        setDrinkAndRecord(cellarToWine(wine));
        setTab("log");
      } else {
        setToast({ message: remaining > 0 ? `残り ${remaining} 本` : `「${wine.name}」を飲み終わりました`, type: "success" });
      }
    } catch (err) { showError(err); }
  };

  const handleDrinkAndRecord = async (data: WineFormData) => {
    try { await addWine(data); setDrinkAndRecord(null); setToast({ message: "テイスティング記録を追加しました", type: "success" }); }
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
            <button
              onClick={() => tab === "cellar" ? setShowCellarAdd(true) : setShowAdd(true)}
              className="w-10 h-10 rounded-full bg-[#634B99] text-white shadow-md flex items-center justify-center hover:bg-[#1E0F38] transition"
              title={tab === "cellar" ? "セラーに追加" : "ワインを追加"}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-lg mx-auto px-4 pb-3">
          <div className="flex rounded-xl bg-[#E8E2F4] p-1">
            <button
              onClick={() => setTab("cellar")}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                tab === "cellar" ? "bg-white text-[#1E0F38] shadow-sm" : "text-[#8E75B8] hover:text-[#634B99]"
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              セラー
              {cellarLoaded && cellarWines.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === "cellar" ? "bg-[#E8E2F4] text-[#634B99]" : "bg-[#CABFE3] text-[#634B99]"}`}>
                  {cellarWines.reduce((s, w) => s + w.quantity, 0)}本
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("log")}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                tab === "log" ? "bg-white text-[#1E0F38] shadow-sm" : "text-[#8E75B8] hover:text-[#634B99]"
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              記録
              {isLoaded && wines.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === "log" ? "bg-[#E8E2F4] text-[#634B99]" : "bg-[#CABFE3] text-[#634B99]"}`}>
                  {wines.length}本
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter bar (記録タブのみ) */}
        {tab === "log" && isLoaded && wines.length > 0 && (
          <div className="max-w-lg mx-auto px-4 pb-3 space-y-2">
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
        {/* ── セラータブ ── */}
        {tab === "cellar" && (
          <>
            {!cellarLoaded ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#E8E2F4] border-t-[#634B99] rounded-full animate-spin" />
              </div>
            ) : cellarWines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="w-20 h-20 bg-[#E8E2F4] rounded-full flex items-center justify-center text-4xl">🍾</div>
                <div className="text-center space-y-1">
                  <p className="text-[#1E0F38] font-semibold text-lg">セラーはまだ空です</p>
                  <p className="text-[#8E75B8] text-sm">所有しているワインを登録しましょう</p>
                </div>
                <button onClick={() => setShowCellarAdd(true)}
                  className="mt-2 px-6 py-3 bg-[#634B99] text-white rounded-3xl text-sm font-semibold shadow-[0_4px_16px_rgba(99,75,153,0.3)] hover:bg-[#1E0F38] transition">
                  セラーに追加
                </button>
              </div>
            ) : (
              cellarWines.map((wine) => (
                <CellarCard
                  key={wine.id}
                  wine={wine}
                  onEdit={setCellarEditTarget}
                  onDelete={async (id) => { try { await deleteCellarWine(id); } catch (err) { showError(err); } }}
                  onDrink={handleDrink}
                />
              ))
            )}
          </>
        )}

        {/* ── 記録タブ ── */}
        {tab === "log" && (
          <>
            {!isLoaded ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#E8E2F4] border-t-[#634B99] rounded-full animate-spin" />
              </div>
            ) : wines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="w-20 h-20 bg-[#E8E2F4] rounded-full flex items-center justify-center text-4xl">🍾</div>
                <div className="text-center space-y-1">
                  <p className="text-[#1E0F38] font-semibold text-lg">まだ記録がありません</p>
                  <p className="text-[#8E75B8] text-sm">最初の一本を記録しましょう</p>
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
          </>
        )}
      </main>

      {/* ── モーダル類 ── */}

      {/* セラー追加 */}
      {showCellarAdd && (
        <Modal title="セラーに追加" onClose={() => setShowCellarAdd(false)}>
          <CellarForm onSubmit={handleCellarAdd} onCancel={() => setShowCellarAdd(false)} />
        </Modal>
      )}

      {/* セラー編集 */}
      {cellarEditTarget && (
        <Modal title="セラーを編集" onClose={() => setCellarEditTarget(null)}>
          <CellarForm initial={cellarEditTarget} onSubmit={handleCellarEdit} onCancel={() => setCellarEditTarget(null)} />
        </Modal>
      )}

      {/* 飲む確認シート */}
      {drinkConfirm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 backdrop-blur-sm"
          onClick={() => setDrinkConfirm(null)}>
          <div className="w-full bg-white rounded-t-3xl p-6 space-y-3 max-w-lg mx-auto"
            onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-[#1E0F38] text-center text-base">
              「{drinkConfirm.name}」を1本飲みますか？
            </p>
            {drinkConfirm.quantity === 1 && (
              <p className="text-center text-sm text-amber-600">最後の1本です</p>
            )}
            <button onClick={() => confirmDrink(true)}
              className="w-full py-3.5 bg-[#634B99] text-white rounded-2xl font-semibold text-sm shadow-[0_4px_16px_rgba(99,75,153,0.3)]">
              飲む＋テイスティング記録を追加
            </button>
            <button onClick={() => confirmDrink(false)}
              className="w-full py-3.5 bg-[#E8E2F4] text-[#634B99] rounded-2xl font-semibold text-sm">
              記録なしで飲む
            </button>
            <button onClick={() => setDrinkConfirm(null)}
              className="w-full py-2 text-[#8E75B8] text-sm">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 飲む→テイスティング記録転記 */}
      {drinkAndRecord && (
        <Modal title="テイスティング記録" onClose={() => setDrinkAndRecord(null)}>
          <WineForm initial={drinkAndRecord} onSubmit={handleDrinkAndRecord} onCancel={() => setDrinkAndRecord(null)} />
        </Modal>
      )}

      {/* テイスティング追加 */}
      {showAdd && (
        <Modal title="ワインを追加" onClose={() => setShowAdd(false)}>
          <WineForm onSubmit={handleAdd} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {/* テイスティング編集 */}
      {editTarget && (
        <Modal title="ワインを編集" onClose={() => setEditTarget(null)}>
          <WineForm initial={editTarget} onSubmit={handleEdit} onCancel={() => setEditTarget(null)} />
        </Modal>
      )}

      {/* 詳細 */}
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
