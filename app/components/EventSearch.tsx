"use client";

import { useState, useMemo } from "react";
import type { EventWineHit } from "@/app/types/event";

const TYPES = [
  { value: "", label: "すべて" },
  { value: "red", label: "赤" },
  { value: "white", label: "白" },
  { value: "sparkling", label: "泡" },
  { value: "rose", label: "ロゼ" },
] as const;

const MIN_RATINGS = [
  { value: 0, label: "すべて" },
  { value: 3, label: "★3+" },
  { value: 4, label: "★4+" },
  { value: 4.5, label: "★4.5+" },
] as const;

type SortKey = "rating" | "date" | "price";
const SORTS: { value: SortKey; label: string }[] = [
  { value: "rating", label: "★が高い順" },
  { value: "date", label: "新しい順" },
  { value: "price", label: "高価な順" },
];

const yen = (p: string) => Number(String(p).replace(/[^\d]/g, "")) || 0;

interface Props {
  wines: EventWineHit[];
  onOpenEvent: (eventId: string) => void;
}

export function EventSearch({ wines, onOpenEvent }: Props) {
  const [q, setQ] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [type, setType] = useState("");
  const [eventId, setEventId] = useState("");
  const [sort, setSort] = useState<SortKey>("rating");
  const [ratedOnly, setRatedOnly] = useState(false);

  // 絞り込み用のワイン会一覧(新しい順)
  const events = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>();
    for (const w of wines) {
      if (!seen.has(w.eventId)) {
        seen.set(w.eventId, { id: w.eventId, label: `${w.eventDate}　${w.eventTitle}` });
      }
    }
    return [...seen.values()];
  }, [wines]);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const result = wines.filter((w) => {
      if (minRating > 0 && (w.rating ?? 0) < minRating) return false;
      if (ratedOnly && w.rating === null) return false;
      if (type && w.wineType !== type) return false;
      if (eventId && w.eventId !== eventId) return false;
      if (!needle) return true;
      // 名前・生産者・産地・品種・メモ・ワイン会名を横断して探す
      return [
        w.name, w.producer, w.country, w.region, w.grapeVariety,
        w.memo, w.eventTitle, w.vintage, w.venue,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    return [...result].sort((a, b) => {
      if (sort === "rating") {
        const d = (b.rating ?? -1) - (a.rating ?? -1);
        return d !== 0 ? d : b.eventDate.localeCompare(a.eventDate);
      }
      if (sort === "price") return yen(b.price) - yen(a.price);
      return b.eventDate.localeCompare(a.eventDate);
    });
  }, [wines, q, minRating, type, eventId, sort, ratedOnly]);

  const chipCls = (on: boolean) =>
    `px-3 py-1.5 rounded-xl text-xs font-bold border-2 whitespace-nowrap transition-colors ${
      on ? "bg-[#8E75B8] border-[#7A62A4] text-white" : "bg-white border-[#E8E2F4] text-[#8A7CA8]"
    }`;
  const selectCls =
    "flex-1 min-w-0 bg-white border-2 border-[#E8E2F4] rounded-xl px-3 py-2 text-xs text-[#1E0F38] focus:outline-none focus:border-[#8E75B8]";

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ワイン名・生産者・産地・品種・メモで探す"
        aria-label="ワインを検索"
        className="w-full bg-white border-2 border-[#E8E2F4] rounded-2xl px-4 py-3 text-sm text-[#1E0F38] placeholder:text-[#CABFE3] focus:outline-none focus:border-[#8E75B8]"
      />

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {MIN_RATINGS.map((r) => (
          <button key={r.value} type="button" onClick={() => setMinRating(r.value)}
            aria-pressed={minRating === r.value} className={chipCls(minRating === r.value)}>
            {r.label}
          </button>
        ))}
        <span className="w-px bg-[#E8E2F4] shrink-0 mx-1" aria-hidden="true" />
        {TYPES.map((t) => (
          <button key={t.value} type="button" onClick={() => setType(t.value)}
            aria-pressed={type === t.value} className={chipCls(type === t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}
          aria-label="ワイン会で絞り込む" className={selectCls}>
          <option value="">すべてのワイン会</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.label}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="並び順" className={selectCls}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[#8A7CA8]">
          <b className="text-sm text-[#1E0F38]">{hits.length}</b> 本
          {wines.length > 0 && ` / 全${wines.length}本`}
        </p>
        <label className="flex items-center gap-1.5 text-xs text-[#8A7CA8]">
          <input type="checkbox" checked={ratedOnly} onChange={(e) => setRatedOnly(e.target.checked)}
            className="accent-[#8E75B8]" />
          記録したものだけ
        </label>
      </div>

      {hits.length === 0 && (
        <p className="text-sm text-[#8A7CA8] text-center py-12 leading-relaxed">
          条件に合うワインがありません。<br />
          キーワードや★の条件をゆるめてみてください。
        </p>
      )}

      <div className="space-y-3">
        {hits.map((w) => (
          <article key={w.id} className="bg-white border-2 border-[#E8E2F4] rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-[#1E0F38] leading-snug">
                  {w.producer && !w.name.startsWith(w.producer) ? `${w.producer} / ` : ""}
                  {w.name}
                </h3>
                <p className="text-xs text-[#8A7CA8] mt-1">
                  {[w.region, w.grapeVariety.split("\n")[0], w.price].filter(Boolean).join(" ／ ")}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-[#B79A45] tabular-nums">
                {w.rating === null ? "—" : `★${w.rating}`}
              </p>
            </div>

            {w.memo && (
              <p className="mt-2 text-xs text-[#4A3D63] bg-[#FBF3DE] border-l-4 border-[#D9B968] rounded-r-lg px-3 py-2">
                「{w.memo}」
              </p>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              <button type="button" onClick={() => onOpenEvent(w.eventId)}
                className="text-xs text-[#634B99] font-semibold underline text-left">
                {w.eventDate}　{w.eventTitle}
              </button>
              {w.url && (
                <a href={w.url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 text-xs text-[#8A7CA8] underline">
                  ショップ
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
