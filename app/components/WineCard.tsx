"use client";

import { useState } from "react";
import { Wine, DETAILED_RATING_LABELS, DetailedRatings, EMPTY_DETAILED_RATINGS } from "@/app/types/wine";
import { StarRating } from "./StarRating";
import { COUNTRIES } from "./WineForm";

interface WineCardProps {
  wine: Wine;
  onEdit: (wine: Wine) => void;
  onDelete: (id: string) => void;
  onViewDetail: (wine: Wine) => void;
}

function getFlag(countryName: string): string {
  return COUNTRIES.find((c) => c.name === countryName)?.flag ?? "";
}

function DetailedRatingBar({ attrKey, value }: { attrKey: keyof DetailedRatings; value: number }) {
  const { label, low, high } = DETAILED_RATING_LABELS[attrKey];
  if (value === 0) return null;
  return (
    <div className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-1.5 text-xs">
      <span className="text-gray-500 text-right">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <div key={v} className={`flex-1 h-2 rounded-full ${v <= value ? "bg-rose-600" : "bg-gray-200"}`} />
        ))}
      </div>
      <span className="text-gray-400 text-[10px]">{value <= 2 ? low : value >= 4 ? high : "中"}</span>
    </div>
  );
}

export function WineCard({ wine, onEdit, onDelete, onViewDetail }: WineCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = wine.photos ?? [];
  const flag = wine.country ? getFlag(wine.country) : "";
  const detailedRatings = { ...EMPTY_DETAILED_RATINGS, ...(wine.tastingNote.detailedRatings ?? {}) };
  const hasDetailedRatings = Object.values(detailedRatings).some((v) => v > 0);

  const handleDelete = () => {
    if (confirm(`「${wine.name}」を削除しますか？`)) {
      onDelete(wine.id);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden">

      {/* Photo strip — クリックで詳細モーダルを開く */}
      {photos.length > 0 ? (
        <div className="relative bg-gray-100 group" style={{ height: 180 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[photoIndex]}
            alt={`${wine.name} 写真${photoIndex + 1}`}
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => onViewDetail(wine)}
          />
          {/* hover overlay */}
          <div
            className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center cursor-pointer"
            onClick={() => onViewDetail(wine)}
          >
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full">
              詳細を見る
            </span>
          </div>

          {photos.length > 1 && (
            <>
              {photoIndex > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => i - 1); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-black/60 transition z-10"
                >‹</button>
              )}
              {photoIndex < photos.length - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => i + 1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-black/60 transition z-10"
                >›</button>
              )}
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setPhotoIndex(i); }}
                    className={`w-1.5 h-1.5 rounded-full transition ${i === photoIndex ? "bg-white" : "bg-white/50"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => onViewDetail(wine)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-base leading-snug hover:text-rose-800 transition-colors">
                {wine.name}
              </h3>
              {wine.vintage && (
                <span className="shrink-0 text-xs font-semibold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                  {wine.vintage}
                </span>
              )}
              {wine.useCoravin && (
                <span className="shrink-0 text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  コラヴァン
                </span>
              )}
            </div>
            {wine.producer && (
              <p className="text-sm text-gray-500 mt-0.5">{wine.producer}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => onEdit(wine)}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              title="編集"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
              title="削除"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600">
          {wine.country && (
            <span className="flex items-center gap-1">
              <span>{flag}</span><span>{wine.country}</span>
            </span>
          )}
          {wine.region && <span>{wine.region}</span>}
          {wine.grapeVariety && <span className="text-gray-500">{wine.grapeVariety}</span>}
          {wine.price && (
            <span className="font-medium text-gray-700">{wine.price}</span>
          )}
        </div>

        {/* Tasting note */}
        {(wine.tastingNote.rating > 0 || wine.tastingNote.memo || hasDetailedRatings) && (
          <div className="border-t pt-3 space-y-2">
            {wine.tastingNote.rating > 0 && (
              <div className="flex items-center gap-2">
                <StarRating value={wine.tastingNote.rating} readonly size="sm" />
                {wine.tastingNote.date && (
                  <span className="text-xs text-gray-400">{wine.tastingNote.date}</span>
                )}
              </div>
            )}
            {hasDetailedRatings && (
              <div className="space-y-1.5">
                {(Object.keys(DETAILED_RATING_LABELS) as (keyof DetailedRatings)[]).map((key) => (
                  <DetailedRatingBar key={key} attrKey={key} value={detailedRatings[key]} />
                ))}
              </div>
            )}
            {wine.tastingNote.memo && (
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                {wine.tastingNote.memo}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
