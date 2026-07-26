"use client";

import { useState, useEffect, useRef } from "react";
import { EVENT_AXES } from "@/app/types/event";
import type { EventWine, EventNote, EventNoteByMember } from "@/app/types/event";

const RATINGS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

interface Props {
  wine: EventWine;
  myNote: EventNote | undefined;
  otherNotes: EventNoteByMember[];
  showOthers: boolean;
  onSave: (note: { eventWineId: string; rating: number | null; detailed: Record<string, number>; memo: string }) => void;
}

export function EventWineCard({ wine, myNote, otherNotes, showOthers, onSave }: Props) {
  const [rating, setRating] = useState<number | null>(myNote?.rating ?? null);
  const [detailed, setDetailed] = useState<Record<string, number>>(myNote?.detailed ?? {});
  const [memo, setMemo] = useState(myNote?.memo ?? "");
  const first = useRef(true);

  // 入力が止まってから保存する(1文字ごとに通信しない)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      onSave({ eventWineId: wine.id, rating, detailed, memo });
    }, 600);
    return () => clearTimeout(timer);
  }, [rating, detailed, memo, wine.id, onSave]);

  const guide = wine.guide ?? {};
  const exam = Array.isArray(guide.exam) ? guide.exam : [];
  const recorded = rating !== null || memo !== "" || Object.keys(detailed).length > 0;

  return (
    <article className="bg-white border-2 border-[#E8E2F4] rounded-3xl overflow-hidden">
      <header className="flex items-start gap-3 p-4">
        <span className="shrink-0 w-9 h-9 rounded-full bg-[#F3EDFF] text-[#634B99] font-bold flex items-center justify-center">
          {wine.position}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[#1E0F38] leading-snug">
            {wine.producer && !wine.name.startsWith(wine.producer) ? `${wine.producer} / ` : ""}
            {wine.name}
          </h3>
          <p className="text-xs text-[#8A7CA8] mt-1">
            {[wine.region, wine.grapeVariety.split("\n")[0], wine.price].filter(Boolean).join(" ／ ")}
          </p>
        </div>
        {recorded && <span className="shrink-0 text-[#2E7D54] text-xs font-bold">記録済み</span>}
      </header>

      {(guide.headline || guide.body) && (
        <div className="px-4 pb-3">
          {guide.headline && <p className="text-xs font-bold text-[#8E2A44] mb-1">{guide.headline}</p>}
          {guide.body && <p className="text-xs text-[#4A3D63] leading-relaxed">{guide.body}</p>}
        </div>
      )}

      {exam.length > 0 && (
        <details className="mx-4 mb-3 bg-[#F7F4FF] rounded-2xl px-4 py-3">
          <summary className="text-xs font-bold text-[#634B99] cursor-pointer">🎓 試験ポイント</summary>
          <ul className="mt-2 space-y-1.5">
            {exam.map((line, i) => (
              <li key={i} className="text-xs text-[#4A3D63] leading-relaxed">・{line}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="border-t-2 border-[#F0EBFA] p-4 space-y-3">
        <p className="text-xs font-semibold text-[#634B99]">📝 あなたの評価</p>

        <div className="flex flex-wrap gap-1.5">
          {RATINGS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRating(rating === r ? null : r)}
              aria-pressed={rating === r}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-colors ${
                rating === r
                  ? "bg-[#D9B968] border-[#B79A45] text-[#3A2B00]"
                  : "bg-white border-[#E8E2F4] text-[#8A7CA8]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          {EVENT_AXES.map((axis) => (
            <div key={axis.key} className="flex items-center gap-2">
              <label htmlFor={`${wine.id}-${axis.key}`} className="w-16 shrink-0 text-xs text-[#8A7CA8]">
                {axis.label}
              </label>
              <input
                id={`${wine.id}-${axis.key}`}
                type="range"
                min={0}
                max={5}
                step={1}
                value={detailed[axis.key] ?? 0}
                onChange={(e) =>
                  setDetailed((d) => ({ ...d, [axis.key]: Number(e.target.value) }))
                }
                className="flex-1 accent-[#8E75B8]"
              />
              <span className="w-4 text-right text-xs tabular-nums text-[#4A3D63]">
                {detailed[axis.key] || "-"}
              </span>
            </div>
          ))}
        </div>

        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={2}
          placeholder="香り・印象をひとこと"
          className="w-full bg-white border-2 border-[#E8E2F4] rounded-2xl px-4 py-3 text-sm text-[#1E0F38] placeholder:text-[#CABFE3] focus:outline-none focus:border-[#8E75B8] resize-none"
        />
      </div>

      {showOthers && otherNotes.length > 0 && (
        <div className="border-t-2 border-[#F0EBFA] bg-[#FBF9FF] p-4 space-y-2">
          <p className="text-xs font-semibold text-[#634B99]">👥 みんなの評価</p>
          {otherNotes.map((n) => (
            <div key={n.email} className="text-xs text-[#4A3D63]">
              <span className="font-bold">{n.email.split("@")[0]}</span>
              <span className="ml-2 text-[#B79A45] font-bold">
                {n.rating === null ? "—" : `★${n.rating}`}
              </span>
              {n.memo && <p className="mt-0.5 text-[#6E5F6B]">「{n.memo}」</p>}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
