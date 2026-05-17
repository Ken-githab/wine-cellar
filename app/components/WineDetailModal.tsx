"use client";

import { useState, useRef, useEffect } from "react";
import { Wine, DETAILED_RATING_LABELS, DetailedRatings, EMPTY_DETAILED_RATINGS } from "@/app/types/wine";
import { StarRating } from "./StarRating";
import { COUNTRIES } from "./WineForm";

function getFlag(name: string) {
  return COUNTRIES.find((c) => c.name === name)?.flag ?? "";
}

function formatPrice(price: string | number): string {
  const s = String(price);
  if (/[€$£₩]/.test(s)) return s;
  const num = s.replace(/^¥/, "").trim();
  return `${num}円`;
}

const MIN_VIEWER_SCALE = 1;
const MAX_VIEWER_SCALE = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function touchPoint(touch: Touch) {
  return { x: touch.clientX, y: touch.clientY };
}

function touchDistance(a: Touch, b: Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

interface Props {
  wine: Wine;
  onEdit: (wine: Wine) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function WineDetailModal({ wine, onEdit, onDelete, onClose }: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [viewerScale, setViewerScale] = useState(MIN_VIEWER_SCALE);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const photoIndexRef = useRef(photoIndex);
  const carouselRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerImageRef = useRef<HTMLImageElement>(null);
  const viewerScaleRef = useRef(viewerScale);
  const viewerOffsetRef = useRef(viewerOffset);
  const viewerGestureRef = useRef<{
    mode: "idle" | "swipe" | "pinch" | "pan";
    startDistance: number;
    startScale: number;
    startOffset: { x: number; y: number };
    startPoint: { x: number; y: number } | null;
  }>({
    mode: "idle",
    startDistance: 0,
    startScale: MIN_VIEWER_SCALE,
    startOffset: { x: 0, y: 0 },
    startPoint: null,
  });
  const photos = wine.photos ?? [];
  const flag = wine.country ? getFlag(wine.country) : "";
  const dr = { ...EMPTY_DETAILED_RATINGS, ...(wine.tastingNote.detailedRatings ?? {}) };
  const hasDr = Object.values(dr).some((v) => v > 0);

  useEffect(() => { photoIndexRef.current = photoIndex; }, [photoIndex]);
  useEffect(() => { viewerScaleRef.current = viewerScale; }, [viewerScale]);
  useEffect(() => { viewerOffsetRef.current = viewerOffset; }, [viewerOffset]);

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

  useEffect(() => {
    const el = viewerRef.current;
    if (!showPhotoViewer || !el) return;

    const clampViewerOffset = (scale: number, offset: { x: number; y: number }) => {
      const image = viewerImageRef.current;
      if (!image || scale <= MIN_VIEWER_SCALE) return { x: 0, y: 0 };

      const containerWidth = el.clientWidth;
      const containerHeight = el.clientHeight;
      const naturalWidth = image.naturalWidth || containerWidth;
      const naturalHeight = image.naturalHeight || containerHeight;
      const containerRatio = containerWidth / containerHeight;
      const imageRatio = naturalWidth / naturalHeight;
      const renderedWidth = imageRatio > containerRatio ? containerWidth : containerHeight * imageRatio;
      const renderedHeight = imageRatio > containerRatio ? containerWidth / imageRatio : containerHeight;
      const maxX = Math.max(0, (renderedWidth * scale - containerWidth) / 2);
      const maxY = Math.max(0, (renderedHeight * scale - containerHeight) / 2);

      return {
        x: clamp(offset.x, -maxX, maxX),
        y: clamp(offset.y, -maxY, maxY),
      };
    };

    const applyViewerTransform = (scale: number, offset: { x: number; y: number }) => {
      const nextScale = scale <= 1.02
        ? MIN_VIEWER_SCALE
        : clamp(scale, MIN_VIEWER_SCALE, MAX_VIEWER_SCALE);
      const nextOffset = nextScale === MIN_VIEWER_SCALE ? { x: 0, y: 0 } : clampViewerOffset(nextScale, offset);
      viewerScaleRef.current = nextScale;
      viewerOffsetRef.current = nextOffset;
      setViewerScale(nextScale);
      setViewerOffset(nextOffset);
    };

    const onStart = (e: TouchEvent) => {
      const gesture = viewerGestureRef.current;

      if (e.touches.length === 2) {
        e.preventDefault();
        gesture.mode = "pinch";
        gesture.startDistance = Math.max(touchDistance(e.touches[0], e.touches[1]), 1);
        gesture.startScale = viewerScaleRef.current;
        gesture.startOffset = viewerOffsetRef.current;
        gesture.startPoint = null;
        return;
      }

      if (e.touches.length === 1) {
        gesture.startPoint = touchPoint(e.touches[0]);
        gesture.startOffset = viewerOffsetRef.current;
        gesture.mode = viewerScaleRef.current > MIN_VIEWER_SCALE ? "pan" : "swipe";
      }
    };

    const onMove = (e: TouchEvent) => {
      const gesture = viewerGestureRef.current;

      if (e.touches.length === 2 && gesture.mode === "pinch") {
        e.preventDefault();
        const nextScale = gesture.startScale * (touchDistance(e.touches[0], e.touches[1]) / gesture.startDistance);
        applyViewerTransform(nextScale, gesture.startOffset);
        return;
      }

      if (e.touches.length === 1 && gesture.mode === "pan" && gesture.startPoint) {
        e.preventDefault();
        const current = touchPoint(e.touches[0]);
        applyViewerTransform(viewerScaleRef.current, {
          x: gesture.startOffset.x + current.x - gesture.startPoint.x,
          y: gesture.startOffset.y + current.y - gesture.startPoint.y,
        });
      }
    };

    const onEnd = (e: TouchEvent) => {
      const gesture = viewerGestureRef.current;

      if (gesture.mode === "swipe" && gesture.startPoint && e.changedTouches[0]) {
        const endPoint = touchPoint(e.changedTouches[0]);
        const diffX = gesture.startPoint.x - endPoint.x;
        const diffY = Math.abs(gesture.startPoint.y - endPoint.y);

        if (Math.abs(diffX) > 40 && Math.abs(diffX) > diffY) {
          const idx = photoIndexRef.current;
          if (diffX > 0 && idx < photos.length - 1) setPhotoIndex(idx + 1);
          else if (diffX < 0 && idx > 0) setPhotoIndex(idx - 1);
        }
      }

      if (e.touches.length === 1 && viewerScaleRef.current > MIN_VIEWER_SCALE) {
        gesture.mode = "pan";
        gesture.startPoint = touchPoint(e.touches[0]);
        gesture.startOffset = viewerOffsetRef.current;
        return;
      }

      if (e.touches.length === 0) {
        gesture.mode = "idle";
        gesture.startPoint = null;
      }
    };

    const onCancel = () => {
      viewerGestureRef.current.mode = "idle";
      viewerGestureRef.current.startPoint = null;
    };

    const onResize = () => applyViewerTransform(viewerScaleRef.current, viewerOffsetRef.current);

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    el.addEventListener("touchcancel", onCancel, { passive: false });
    window.addEventListener("resize", onResize);

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      window.removeEventListener("resize", onResize);
    };
  }, [photos.length, showPhotoViewer]);

  useEffect(() => {
    if (!showPhotoViewer) {
      viewerScaleRef.current = MIN_VIEWER_SCALE;
      viewerOffsetRef.current = { x: 0, y: 0 };
      setViewerScale(MIN_VIEWER_SCALE);
      setViewerOffset({ x: 0, y: 0 });
    }
  }, [showPhotoViewer]);

  useEffect(() => {
    viewerScaleRef.current = MIN_VIEWER_SCALE;
    viewerOffsetRef.current = { x: 0, y: 0 };
    setViewerScale(MIN_VIEWER_SCALE);
    setViewerOffset({ x: 0, y: 0 });
  }, [photoIndex]);

  useEffect(() => {
    if (!showPhotoViewer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPhotoViewer(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showPhotoViewer]);

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
            <div
              ref={carouselRef}
              onClick={() => setShowPhotoViewer(true)}
              className="relative bg-gray-900 cursor-zoom-in"
              style={{ height: 260, touchAction: "pan-y" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[photoIndex]} alt={`${wine.name} 写真${photoIndex + 1}`}
                className="w-full h-full object-contain" />
              <div className="absolute right-3 bottom-3 bg-black/55 text-white rounded-full w-9 h-9 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h6m0 0v6m0-6-7 7M9 21H3m0 0v-6m0 6 7-7" />
                </svg>
              </div>
              {photos.length > 1 && (
                <>
                  {photoIndex > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => i - 1); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl">‹</button>
                  )}
                  {photoIndex < photos.length - 1 && (
                    <button onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => i + 1); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl">›</button>
                  )}
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                    {photos.map((_, i) => (
                      <button key={i} onClick={(e) => { e.stopPropagation(); setPhotoIndex(i); }}
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

      {/* Fullscreen photo viewer */}
      {showPhotoViewer && (
        <div
          className="fixed inset-0 z-[70] bg-black flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="写真を拡大表示"
          onClick={() => setShowPhotoViewer(false)}
        >
          <button
            onClick={() => setShowPhotoViewer(false)}
            className="absolute right-4 z-10 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center"
            style={{ top: "max(1rem, env(safe-area-inset-top))" }}
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div
            ref={viewerRef}
            className="relative w-full h-full flex items-center justify-center"
            style={{ touchAction: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={viewerImageRef}
              src={photos[photoIndex]}
              alt={`${wine.name} 写真${photoIndex + 1} 拡大`}
              className="w-full h-full object-contain select-none"
              draggable={false}
              style={{
                transform: `translate3d(${viewerOffset.x}px, ${viewerOffset.y}px, 0) scale(${viewerScale})`,
                transition: viewerScale === MIN_VIEWER_SCALE ? "transform 120ms ease-out" : undefined,
              }}
              onClick={(e) => e.stopPropagation()}
            />

            {photos.length > 1 && (
              <>
                {photoIndex > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => i - 1); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/45 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl"
                    aria-label="前の写真"
                  >
                    ‹
                  </button>
                )}
                {photoIndex < photos.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => i + 1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/45 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl"
                    aria-label="次の写真"
                  >
                    ›
                  </button>
                )}
                <div
                  className="absolute left-0 right-0 flex justify-center gap-2"
                  style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
                >
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setPhotoIndex(i); }}
                      className={`w-2 h-2 rounded-full transition ${i === photoIndex ? "bg-white" : "bg-white/40"}`}
                      aria-label={`${i + 1}枚目の写真`}
                    />
                  ))}
                </div>
              </>
            )}
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
