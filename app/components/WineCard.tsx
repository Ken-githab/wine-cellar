"use client";

import { useState, useRef, useEffect } from "react";
import { Wine } from "@/app/types/wine";
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

function formatPrice(price: string): string {
  if (/[¥€$£₩]/.test(price)) return price;
  return `¥${price}`;
}

export function WineCard({ wine, onDelete, onViewDetail }: WineCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const photoIndexRef = useRef(photoIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLongPress = useRef(false);
  const photos = wine.photos ?? [];
  const flag = wine.country ? getFlag(wine.country) : "";

  useEffect(() => { photoIndexRef.current = photoIndex; }, [photoIndex]);

  useEffect(() => {
    const el = containerRef.current;
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

  const handlePressStart = () => {
    longPressTimer.current = setTimeout(() => {
      wasLongPress.current = true;
      navigator.vibrate?.(50);
      setShowDeleteConfirm(true);
    }, 600);
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const handleCardClick = () => {
    if (wasLongPress.current) { wasLongPress.current = false; return; }
    onViewDetail(wine);
  };

  return (
    <>
      <div
        className="bg-white rounded-3xl overflow-hidden shadow-[0_2px_12px_rgba(30,15,56,0.07)] active:scale-[0.98] transition-transform cursor-pointer select-none"
        onClick={handleCardClick}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerCancel={handlePressEnd}
        onPointerLeave={handlePressEnd}
      >
        {/* Photo carousel */}
        {photos.length > 0 && (
          <div ref={containerRef} className="relative bg-gray-100" style={{ height: 176, touchAction: "pan-y" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[photoIndex]} alt={`${wine.name} 写真${photoIndex + 1}`}
              className="w-full h-full object-cover" draggable={false} />
            {photos.length > 1 && (
              <>
                {photoIndex > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => i - 1); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-7 h-7 flex items-center justify-center z-10">‹</button>
                )}
                {photoIndex < photos.length - 1 && (
                  <button onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => i + 1); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-7 h-7 flex items-center justify-center z-10">›</button>
                )}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10">
                  {photos.map((_, i) => (
                    <button key={i} onClick={(e) => { e.stopPropagation(); setPhotoIndex(i); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`w-1.5 h-1.5 rounded-full transition ${i === photoIndex ? "bg-white" : "bg-white/50"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Info */}
        <div className="p-4 space-y-2">
          {/* Title + vintage */}
          <div className="flex items-start gap-2">
            <h3 className="flex-1 font-semibold text-[#1E0F38] text-base leading-snug truncate">{wine.name}</h3>
            {wine.vintage && (
              <span className="shrink-0 text-xs font-semibold bg-[#E8E2F4] text-[#634B99] px-2 py-0.5 rounded-full">{wine.vintage}</span>
            )}
          </div>

          {/* Country / Price */}
          {(wine.country || wine.region || wine.price) && (
            <div className="flex items-center justify-between text-sm gap-2">
              <span className="text-[#8E75B8] truncate">
                {flag && <span className="mr-1">{flag}</span>}
                {wine.country}{wine.country && wine.region ? " / " : ""}{wine.region}
              </span>
              {wine.price && <span className="shrink-0 font-medium text-[#1E0F38]">{formatPrice(wine.price)}</span>}
            </div>
          )}

          {/* Tags */}
          {(wine.grapeVariety || wine.goodValue) && (
            <div className="flex flex-wrap gap-1.5">
              {wine.grapeVariety && (
                <span className="text-xs bg-[#E8E2F4] text-[#634B99] px-2 py-0.5 rounded-full">{wine.grapeVariety}</span>
              )}
              {wine.goodValue && (
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">コスパ最高</span>
              )}
            </div>
          )}

          {/* Stars */}
          {wine.tastingNote.rating > 0 && (
            <StarRating value={wine.tastingNote.rating} readonly size="sm" />
          )}
        </div>
      </div>

      {/* Delete confirm bottom sheet */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 backdrop-blur-sm"
          onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full bg-white rounded-t-3xl p-6 space-y-3 max-w-lg mx-auto"
            onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-[#1E0F38] text-center text-base">「{wine.name}」を削除しますか？</p>
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
