"use client";

import { useState, useRef, useEffect } from "react";
import { Wine, DETAILED_RATING_LABELS, DetailedRatings, EMPTY_DETAILED_RATINGS } from "@/app/types/wine";
import { StarRating } from "./StarRating";
import { COUNTRIES } from "./WineForm";

function getFlag(name: string) {
  return COUNTRIES.find((c) => c.name === name)?.flag ?? "";
}

function formatPrice(price: string): string {
  if (/[¥€$£₩]/.test(price)) return price;
  return `¥${price}`;
}

interface Props {
  wine: Wine;
  onEdit: (wine: Wine) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function WineDetailModal({ wine, onEdit, onDelete, onClose }: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const photoIndexRef = useRef(photoIndex);
  const carouselRef = useRef<HTMLDivElement>(null);
  const photos = wine.photos ?? [];
  const flag = wine.country ? getFlag(wine.country) : "";
  const dr = { ...EMPTY_DETAILED_RATINGS, ...(wine.tastingNote.detailedRatings ?? {}) };
  const hasDr = Object.values(dr).some((v) => v > 0);

  useEffect(() => { photoIndexRef.current = photoIndex; }, [photoIndex]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || photos.length <= 1) return;
    const onStart = (e: TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
    const onEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      touchStartX.current = null;
      if (Math.abs(diff) > 40) {
        const idx = photoIndexRef.current;
        if (diff > 0 && idx < photos.length - 1) setPhotoIndex(idx + 1);
        else if (diff < 0 && idx > 0) setPhotoIndex(idx - 1);
      }
    };
    const onCancel = () => { touchStartX.current = null; };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [photos.length]);

  return (
    <>
      <div className="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4">
        <div className="hidden sm:block absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

        <div className="absolute inset-0 bg-[#FAF8FC] overflow-y-auto sm:relative sm:inset-auto sm:rounded-3xl sm:w-full sm:max-w-lg sm:max-h-[90vh] sm:shadow-2xl">

          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#FAF8FC]/95 backdrop-blur-sm border-b border-[#E8E2F4] px-4 py-3 flex items-center gap-3"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#E8E2F4] text-[#634B99] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-[#1E0F38] text-base leading-snug truncate">{wine.name}</h2>
                {wine.vintage && (
                  <span className="text-xs font-semibold bg-[#E8E2F4] text-[#634B99] px-2 py-0.5 rounded-full shrink-0">{wine.vintage}</span>
                )}
                {wine.goodValue && (
                  <span className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">コスパ最高</span>
                )}
              </div>
              {wine.producer && <p className="text-xs text-[#8E75B8] mt-0.5 truncate">{wine.producer}</p>}
            </div>
          </div>

          {/* Photo carousel */}
          {photos.length > 0 && (
            <div ref={carouselRef} className="relative bg-gray-900" style={{ height: 260, touchAction: "pan-y" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[photoIndex]} alt={`${wine.name} 写真${photoIndex + 1}`}
                className="w-full h-full object-contain" />
              {photos.length > 1 && (
                <>
                  {photoIndex > 0 && (
                    <button onClick={() => setPhotoIndex((i) => i - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl">‹</button>
                  )}
                  {photoIndex < photos.length - 1 && (
                    <button onClick={() => setPhotoIndex((i) => i + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl">›</button>
                  )}
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                    {photos.map((_, i) => (
                      <button key={i} onClick={() => setPhotoIndex(i)}
                        className={`w-2 h-2 rounded-full transition ${i === photoIndex ? "bg-white" : "bg-white/40"}`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Body */}
          <div className="p-5 space-y-5 pb-4">
            {/* 基本情報 */}
            <div className="grid grid-cols-2 gap-4">
              {wine.country && (
                <InfoItem label="国" value={`${flag} ${wine.country}`} />
              )}
              {wine.region && <InfoItem label="産地・地域" value={wine.region} />}
              {wine.grapeVariety && <InfoItem label="品種" value={wine.grapeVariety} />}
              {wine.price && <InfoItem label="価格" value={formatPrice(wine.price)} />}
            </div>

            {/* URL */}
            {wine.url && (
              <a href={wine.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[#634B99] hover:underline break-all">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {wine.url}
              </a>
            )}

            {/* テイスティングノート */}
            {(wine.tastingNote.rating > 0 || wine.tastingNote.memo || hasDr) && (
              <div className="border-t border-[#E8E2F4] pt-5 space-y-4">
                <h3 className="font-semibold text-[#1E0F38]">テイスティングノート</h3>
                {wine.tastingNote.rating > 0 && (
                  <div className="flex items-center gap-3">
                    <StarRating value={wine.tastingNote.rating} readonly size="md" />
                    {wine.tastingNote.date && (
                      <span className="text-sm text-[#8E75B8]">{wine.tastingNote.date}</span>
                    )}
                  </div>
                )}
                {hasDr && (
                  <div className="space-y-3 bg-[#E8E2F4] rounded-2xl p-4">
                    {(Object.keys(DETAILED_RATING_LABELS) as (keyof DetailedRatings)[]).map((key) => {
                      const v = dr[key];
                      if (v === 0) return null;
                      const { label, low, high } = DETAILED_RATING_LABELS[key];
                      return (
                        <div key={key} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2 text-sm">
                          <span className="text-[#634B99] font-medium text-right">{label}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <div key={n} className={`flex-1 h-3 rounded-full ${n <= v ? "bg-[#8E75B8]" : "bg-[#CABFE3]"}`} />
                            ))}
                          </div>
                          <span className="text-[#8E75B8] text-xs">{v <= 2 ? low : v >= 4 ? high : "中"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {wine.tastingNote.memo && (
                  <p className="text-sm text-[#1E0F38] leading-relaxed whitespace-pre-wrap">{wine.tastingNote.memo}</p>
                )}
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="sticky bottom-0 bg-[#FAF8FC]/95 backdrop-blur-sm border-t border-[#E8E2F4] px-4 py-3 flex gap-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <button
              onClick={() => { onEdit(wine); onClose(); }}
              className="flex-1 py-3 bg-[#634B99] text-white rounded-2xl font-semibold text-sm shadow-[0_4px_16px_rgba(99,75,153,0.25)] hover:bg-[#1E0F38] transition"
            >
              編集する
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-5 py-3 bg-[#E8E2F4] text-red-500 rounded-2xl font-semibold text-sm hover:bg-red-50 transition"
            >
              削除
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/30 backdrop-blur-sm"
          onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full bg-white rounded-t-3xl p-6 space-y-3 max-w-lg mx-auto"
            onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-[#1E0F38] text-center">「{wine.name}」を削除しますか？</p>
            <button
              onClick={() => { onDelete(wine.id); setShowDeleteConfirm(false); onClose(); }}
              className="w-full py-3.5 bg-red-600 text-white rounded-2xl font-semibold text-sm"
            >
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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[#8E75B8] mb-0.5">{label}</p>
      <p className="text-base font-medium text-[#1E0F38]">{value}</p>
    </div>
  );
}
