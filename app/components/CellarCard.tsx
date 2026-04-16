"use client";

import { useState } from "react";
import { CellarWine, WineType } from "@/app/types/cellar";
import { COUNTRIES } from "./WineForm";

interface Props {
  wine: CellarWine;
  onEdit: (wine: CellarWine) => void;
  onDelete: (id: string) => void;
  onDrink: (wine: CellarWine) => void;
}

function getFlag(countryName: string): string {
  return COUNTRIES.find((c) => c.name === countryName)?.flag ?? "";
}

function formatPrice(price: string | number): string {
  const s = String(price);
  if (/[€$£₩]/.test(s)) return s;
  const num = s.replace(/^¥/, "").trim();
  return num ? `${num}円` : "";
}

function drinkWindowLabel(from: string, until: string): string {
  if (from && until) return `${from} 〜 ${until}年`;
  if (from) return `${from}年〜`;
  if (until) return `〜${until}年`;
  return "";
}

const WINE_TYPE_BADGE: Record<WineType, { label: string; cls: string } | null> = {
  red:      { label: "赤",           cls: "bg-red-100 text-red-700" },
  white:    { label: "白",           cls: "bg-yellow-50 text-yellow-700" },
  sparkling:{ label: "スパークリング", cls: "bg-blue-50 text-blue-700" },
  rose:     { label: "ロゼ",         cls: "bg-pink-100 text-pink-600" },
  "":       null,
};

function drinkWindowStatus(from: string, until: string): "peak" | "soon" | "medium" | "long" | null {
  const currentYear = new Date().getFullYear();
  const f = parseInt(from);
  const u = parseInt(until);

  // 飲み頃が完全に過ぎている場合はバッジなし
  if (until && !isNaN(u) && currentYear > u) return null;

  if (from && !isNaN(f)) {
    const yearsUntil = f - currentYear;
    if (yearsUntil <= 0) return "peak";    // 今が旬: drinkFromが今年以前
    if (yearsUntil <= 2) return "soon";    // あと少し: 1〜2年後
    if (yearsUntil <= 7) return "medium";  // 中期熟成: 3〜7年後
    return "long";                         // 長期熟成: 8年以上
  }

  // drinkFrom なしで drinkUntil が未来なら今が旬
  if (until && !isNaN(u) && currentYear <= u) return "peak";

  return null;
}

export function CellarCard({ wine, onEdit, onDelete, onDrink }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const flag = wine.country ? getFlag(wine.country) : "";
  const windowLabel = drinkWindowLabel(wine.drinkFrom, wine.drinkUntil);
  const windowStatus = drinkWindowStatus(wine.drinkFrom, wine.drinkUntil);
  const typeBadge = WINE_TYPE_BADGE[wine.wineType ?? ""];

  const windowBadge = windowStatus === "peak"
    ? { label: "今が旬", cls: "bg-emerald-50 text-emerald-700" }
    : windowStatus === "soon"
    ? { label: "あと少し", cls: "bg-amber-50 text-amber-700" }
    : windowStatus === "medium"
    ? { label: "中期熟成", cls: "bg-blue-50 text-blue-700" }
    : windowStatus === "long"
    ? { label: "長期熟成", cls: "bg-[#E8E2F4] text-[#634B99]" }
    : null;

  return (
    <>
      <div className="bg-white rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(30,15,56,0.07)]">
        {/* 写真 */}
        {wine.photos.length > 0 && (
          <div className="bg-gray-100" style={{ height: 140 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wine.photos[0]} alt={wine.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#1E0F38] text-base leading-snug">{wine.name}</h3>
              {wine.producer && <p className="text-xs text-[#8E75B8] mt-0.5">{wine.producer}</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {typeBadge && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge.cls}`}>{typeBadge.label}</span>
              )}
              {wine.vintage && (
                <span className="text-xs font-semibold bg-[#E8E2F4] text-[#634B99] px-2 py-0.5 rounded-full">{wine.vintage}</span>
              )}
            </div>
          </div>

          {/* Grape variety */}
          {wine.grapeVariety && (
            <div className="mb-2">
              <span className="text-xs bg-[#E8E2F4] text-[#634B99] px-2 py-0.5 rounded-full">{wine.grapeVariety}</span>
            </div>
          )}

          {/* Country / Price */}
          {(wine.country || wine.region || wine.price) && (
            <div className="flex items-center justify-between text-sm gap-2 mb-2">
              <span className="text-[#8E75B8] truncate text-xs">
                {flag && <span className="mr-1">{flag}</span>}
                {wine.country}{wine.country && wine.region ? " / " : ""}{wine.region}
              </span>
              {wine.price && <span className="shrink-0 text-xs font-medium text-[#1E0F38]">{formatPrice(wine.price)}</span>}
            </div>
          )}

          {/* Drink window */}
          {windowLabel && (
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-3.5 h-3.5 text-[#8E75B8] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-[#8E75B8]">{windowLabel}</span>
              {windowBadge && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${windowBadge.cls}`}>
                  {windowBadge.label}
                </span>
              )}
            </div>
          )}

          {/* Bottom row: quantity + actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[#F0EBF8]">
            {/* Quantity */}
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#634B99]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-2xl font-bold text-[#1E0F38] leading-none">{wine.quantity}</span>
              <span className="text-xs text-[#8E75B8] self-end mb-0.5">本</span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(wine)}
                className="w-8 h-8 rounded-full bg-[#E8E2F4] flex items-center justify-center hover:bg-[#CABFE3] transition active:scale-95"
                title="編集">
                <svg className="w-3.5 h-3.5 text-[#634B99]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-8 h-8 rounded-full bg-[#E8E2F4] flex items-center justify-center hover:bg-red-100 transition active:scale-95"
                title="削除">
                <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={() => onDrink(wine)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#634B99] text-white rounded-2xl text-sm font-semibold hover:bg-[#1E0F38] transition active:scale-95 shadow-[0_2px_8px_rgba(99,75,153,0.3)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                飲む
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm bottom sheet */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 backdrop-blur-sm"
          onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full bg-white rounded-t-3xl p-6 space-y-3 max-w-lg mx-auto"
            onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-[#1E0F38] text-center text-base">「{wine.name}」をセラーから削除しますか？</p>
            <button onClick={() => { onDelete(wine.id); setShowDeleteConfirm(false); }}
              className="w-full py-3.5 bg-red-600 text-white rounded-2xl font-semibold text-sm">
              削除する
            </button>
            <button onClick={() => setShowDeleteConfirm(false)}
              className="w-full py-3.5 bg-[#E8E2F4] text-[#634B99] rounded-2xl font-semibold text-sm">
              キャンセル
            </button>
          </div>
        </div>
      )}
    </>
  );
}
