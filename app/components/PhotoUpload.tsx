"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAX_PHOTOS = 4;
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.75;
const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD = 8; // px — この距離を超えたら長押しキャンセル

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = reject;
    img.src = url;
  });
}

interface PhotoUploadProps {
  photos: string[];
  onChange: (photos: string[]) => void;
}

export function PhotoUpload({ photos, onChange }: PhotoUploadProps) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number>(-1);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; w: number; h: number; src: string } | null>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragActiveRef = useRef(false);
  const capturedPointerId = useRef<number | null>(null);
  const captureElementRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  // ---- Add photos ----
  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toProcess = Array.from(files).slice(0, remaining);
    const compressed = await Promise.all(toProcess.map(compressImage));
    onChange([...photos, ...compressed]);
  };

  // ---- Replace photo ----
  const handleReplace = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const idx = replaceIndexRef.current;
    if (idx < 0) return;
    const compressed = await compressImage(files[0]);
    const updated = [...photos];
    updated[idx] = compressed;
    onChange(updated);
  };

  const startReplace = (idx: number) => {
    replaceIndexRef.current = idx;
    replaceInputRef.current!.value = "";
    replaceInputRef.current!.click();
  };

  // ---- Remove photo ----
  const remove = (idx: number) => {
    onChange(photos.filter((_, i) => i !== idx));
  };

  // ---- Drag helpers ----
  const getDropIndexFromPoint = (x: number, y: number): number | null => {
    for (let i = 0; i < cellRefs.current.length; i++) {
      const el = cellRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const endDrag = () => {
    dragActiveRef.current = false;
    capturedPointerId.current = null;
    captureElementRef.current = null;
    pointerStartRef.current = null;
    setDragIndex(null);
    setDropIndex(null);
    setGhost(null);
  };

  const handlePointerDown = (idx: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (dragActiveRef.current) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const pointerId = e.pointerId;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };

    longPressTimer.current = setTimeout(() => {
      navigator.vibrate?.(50);
      dragActiveRef.current = true;
      capturedPointerId.current = pointerId;
      captureElementRef.current = el;
      el.setPointerCapture(pointerId);
      setDragIndex(idx);
      setDropIndex(idx);
      setGhost({
        x: e.clientX - rect.width / 2,
        y: e.clientY - rect.height / 2,
        w: rect.width,
        h: rect.height,
        src: photos[idx],
      });
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragActiveRef.current) {
      // 長押し待機中 — 一定距離動いたらキャンセル
      if (pointerStartRef.current) {
        const dx = e.clientX - pointerStartRef.current.x;
        const dy = e.clientY - pointerStartRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          cancelLongPress();
        }
      }
      return;
    }
    if (e.pointerId !== capturedPointerId.current) return;
    e.preventDefault();

    setGhost((prev) =>
      prev ? { ...prev, x: e.clientX - prev.w / 2, y: e.clientY - prev.h / 2 } : prev
    );

    const hit = getDropIndexFromPoint(e.clientX, e.clientY);
    if (hit !== null) setDropIndex(hit);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    cancelLongPress();
    if (!dragActiveRef.current || e.pointerId !== capturedPointerId.current) return;

    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const updated = [...photos];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(dropIndex, 0, moved);
      onChange(updated);
    }
    endDrag();
  };

  const handlePointerCancel = () => {
    cancelLongPress();
    endDrag();
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {photos.map((src, i) => {
          const isSource = dragIndex === i;
          const isTarget = dropIndex === i && dragIndex !== null && dragIndex !== i;
          return (
            <div
              key={i}
              ref={(el) => { cellRefs.current[i] = el; }}
              className={[
                "relative aspect-square rounded-lg overflow-hidden border touch-none select-none",
                isSource ? "opacity-30 border-rose-400" : "border-gray-200",
                isTarget ? "ring-2 ring-rose-500 ring-offset-1" : "",
              ].join(" ")}
              onPointerDown={(e) => handlePointerDown(i, e)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`写真${i + 1}`} className="w-full h-full object-cover pointer-events-none" />

              {/* 操作ボタン — 常時表示（タッチデバイス対応） */}
              {dragIndex === null && (
                <div className="absolute inset-0 flex items-start justify-between p-1">
                  <button
                    type="button"
                    onClick={() => startReplace(i)}
                    className="w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center"
                    aria-label="差し替え"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="w-6 h-6 rounded-full bg-black/50 text-white text-sm font-bold flex items-center justify-center leading-none"
                    aria-label="削除"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => addInputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">{photos.length}/{MAX_PHOTOS}</span>
          </button>
        )}
      </div>

      {/* Drag ghost — Portal で body 直下に描画 */}
      {ghost && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            left: ghost.x,
            top: ghost.y,
            width: ghost.w,
            height: ghost.h,
            pointerEvents: "none",
            zIndex: 9999,
            borderRadius: "0.5rem",
            overflow: "hidden",
            boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
            transform: "scale(1.08)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ghost.src} alt="dragging" className="w-full h-full object-cover" />
        </div>,
        document.body
      )}

      <input
        ref={addInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleReplace(e.target.files)}
      />
    </div>
  );
}
