"use client";

import { useState } from "react";
import {
  Wine,
  DETAILED_RATING_LABELS,
  DetailedRatings,
  EMPTY_DETAILED_RATINGS,
} from "@/app/types/wine";
import { StarRating } from "./StarRating";
import { COUNTRIES } from "./WineForm";

function getFlag(name: string) {
  return COUNTRIES.find((c) => c.name === name)?.flag ?? "";
}

interface Props {
  wine: Wine;
  onEdit: (wine: Wine) => void;
  onClose: () => void;
}

export function WineDetailModal({ wine, onEdit, onClose }: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = wine.photos ?? [];
  const flag = wine.country ? getFlag(wine.country) : "";
  const dr = { ...EMPTY_DETAILED_RATINGS, ...(wine.tastingNote.detailedRatings ?? {}) };
  const hasDr = Object.values(dr).some((v) => v > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white w-full sm:rounded-2xl sm:max-w-lg max-h-[92dvh] overflow-y-auto shadow-2xl rounded-t-2xl">

        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-5 py-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-gray-900 text-lg leading-snug">{wine.name}</h2>
              {wine.vintage && (
                <span className="text-xs font-semibold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full shrink-0">
                  {wine.vintage}
                </span>
              )}
              {wine.useCoravin && (
                <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">
                  コラヴァン
                </span>
              )}
            </div>
            {wine.producer && (
              <p className="text-sm text-gray-500 mt-0.5">{wine.producer}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <button
              onClick={() => { onEdit(wine); onClose(); }}
              className="text-sm font-medium text-rose-800 border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition"
            >
              編集
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Photo carousel */}
        {photos.length > 0 && (
          <div className="relative bg-gray-900" style={{ height: 260 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[photoIndex]}
              alt={`${wine.name} 写真${photoIndex + 1}`}
              className="w-full h-full object-contain"
            />
            {photos.length > 1 && (
              <>
                {photoIndex > 0 && (
                  <button
                    onClick={() => setPhotoIndex((i) => i - 1)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70 transition"
                  >‹</button>
                )}
                {photoIndex < photos.length - 1 && (
                  <button
                    onClick={() => setPhotoIndex((i) => i + 1)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70 transition"
                  >›</button>
                )}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoIndex(i)}
                      className={`w-2 h-2 rounded-full transition ${i === photoIndex ? "bg-white" : "bg-white/40"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="p-5 space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {wine.country && (
              <InfoItem label="国" value={`${flag} ${wine.country}`} />
            )}
            {wine.region && (
              <InfoItem label="産地・地域" value={wine.region} />
            )}
            {wine.grapeVariety && (
              <InfoItem label="品種" value={wine.grapeVariety} />
            )}
            {wine.price && (
              <InfoItem label="価格" value={wine.price} />
            )}
          </div>

          {/* URL */}
          {wine.url && (
            <a
              href={wine.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-rose-700 hover:text-rose-900 hover:underline break-all"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {wine.url}
            </a>
          )}

          {/* Tasting note */}
          {(wine.tastingNote.rating > 0 || wine.tastingNote.memo || hasDr) && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold text-gray-800">テイスティングノート</h3>

              {wine.tastingNote.rating > 0 && (
                <div className="flex items-center gap-3">
                  <StarRating value={wine.tastingNote.rating} readonly size="md" />
                  {wine.tastingNote.date && (
                    <span className="text-sm text-gray-400">{wine.tastingNote.date}</span>
                  )}
                </div>
              )}

              {hasDr && (
                <div className="space-y-2 bg-gray-50 rounded-xl p-4">
                  {(Object.keys(DETAILED_RATING_LABELS) as (keyof DetailedRatings)[]).map((key) => {
                    const v = dr[key];
                    if (v === 0) return null;
                    const { label, low, high } = DETAILED_RATING_LABELS[key];
                    return (
                      <div key={key} className="grid grid-cols-[4rem_1fr_2.5rem] items-center gap-2 text-xs">
                        <span className="text-gray-600 font-medium text-right">{label}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <div
                              key={n}
                              className={`flex-1 h-2.5 rounded-full ${n <= v ? "bg-rose-600" : "bg-gray-200"}`}
                            />
                          ))}
                        </div>
                        <span className="text-gray-400 text-[10px]">
                          {v <= 2 ? low : v >= 4 ? high : "中"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {wine.tastingNote.memo && (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {wine.tastingNote.memo}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}
