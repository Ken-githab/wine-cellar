"use client";

import { useState } from "react";
import {
  Wine, WineFormData, EMPTY_DETAILED_RATINGS, DETAILED_RATING_LABELS, DetailedRatings,
} from "@/app/types/wine";
import { StarRating } from "./StarRating";
import { PhotoUpload } from "./PhotoUpload";

export const COUNTRIES: { flag: string; name: string }[] = [
  { flag: "🇫🇷", name: "フランス" },
  { flag: "🇮🇹", name: "イタリア" },
  { flag: "🇪🇸", name: "スペイン" },
  { flag: "🇩🇪", name: "ドイツ" },
  { flag: "🇵🇹", name: "ポルトガル" },
  { flag: "🇺🇸", name: "アメリカ" },
  { flag: "🇦🇷", name: "アルゼンチン" },
  { flag: "🇨🇱", name: "チリ" },
  { flag: "🇦🇺", name: "オーストラリア" },
  { flag: "🇳🇿", name: "ニュージーランド" },
  { flag: "🇿🇦", name: "南アフリカ" },
  { flag: "🇦🇹", name: "オーストリア" },
  { flag: "🇬🇷", name: "ギリシャ" },
  { flag: "🇭🇺", name: "ハンガリー" },
  { flag: "🇷🇴", name: "ルーマニア" },
  { flag: "🇧🇬", name: "ブルガリア" },
  { flag: "🇬🇪", name: "ジョージア" },
  { flag: "🇭🇷", name: "クロアチア" },
  { flag: "🇸🇮", name: "スロベニア" },
  { flag: "🇲🇩", name: "モルドバ" },
  { flag: "🇨🇭", name: "スイス" },
  { flag: "🇨🇦", name: "カナダ" },
  { flag: "🇯🇵", name: "日本" },
  { flag: "🇮🇱", name: "イスラエル" },
  { flag: "🇱🇧", name: "レバノン" },
  { flag: "🇲🇦", name: "モロッコ" },
  { flag: "🇹🇷", name: "トルコ" },
  { flag: "🇨🇳", name: "中国" },
  { flag: "🇧🇷", name: "ブラジル" },
  { flag: "🇲🇽", name: "メキシコ" },
  { flag: "🇺🇾", name: "ウルグアイ" },
];

const makeEmptyForm = (): WineFormData => ({
  name: "",
  producer: "",
  vintage: "",
  country: "",
  region: "",
  grapeVariety: "",
  price: "",
  url: "",
  useCoravin: false,
  goodValue: false,
  photos: [],
  tastingNote: {
    rating: 0,
    memo: "",
    date: new Date().toISOString().split("T")[0],
    detailedRatings: { ...EMPTY_DETAILED_RATINGS },
  },
});

interface WineFormProps {
  initial?: Wine;
  onSubmit: (data: WineFormData) => void;
  onCancel: () => void;
}

function DetailedRatingRow({
  attrKey, value, onChange,
}: { attrKey: keyof DetailedRatings; value: number; onChange: (v: number) => void; }) {
  const { label, low, high } = DETAILED_RATING_LABELS[attrKey];
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[#634B99] font-medium w-16 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 flex-1">
        <span className="text-xs text-[#CABFE3] w-8 text-right shrink-0">{low}</span>
        <div className="flex gap-1 flex-1 justify-center">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(value === v ? 0 : v)}
              className={`w-7 h-7 rounded-full border-2 transition active:scale-95 ${
                v <= value ? "bg-[#8E75B8] border-[#8E75B8]" : "border-[#E8E2F4] hover:border-[#8E75B8]"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-[#CABFE3] w-8 shrink-0">{high}</span>
      </div>
      <span className="text-xs text-[#8E75B8] font-semibold w-4 text-center shrink-0">{value > 0 ? value : ""}</span>
    </div>
  );
}

export function WineForm({ initial, onSubmit, onCancel }: WineFormProps) {
  const [form, setForm] = useState<WineFormData>(() =>
    initial ? {
      name: initial.name,
      producer: initial.producer,
      vintage: initial.vintage,
      country: initial.country ?? "",
      region: initial.region,
      grapeVariety: initial.grapeVariety,
      price: initial.price ?? "",
      url: initial.url ?? "",
      useCoravin: initial.useCoravin,
      goodValue: initial.goodValue ?? false,
      photos: initial.photos ?? [],
      tastingNote: {
        ...initial.tastingNote,
        detailedRatings: { ...EMPTY_DETAILED_RATINGS, ...(initial.tastingNote.detailedRatings ?? {}) },
      },
    } : makeEmptyForm()
  );

  const set = <K extends keyof WineFormData>(key: K, value: WineFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setNote = <K extends keyof WineFormData["tastingNote"]>(key: K, value: WineFormData["tastingNote"][K]) =>
    setForm((f) => ({ ...f, tastingNote: { ...f.tastingNote, [key]: value } }));
  const setDetailedRating = (key: keyof DetailedRatings, value: number) =>
    setForm((f) => ({ ...f, tastingNote: { ...f.tastingNote, detailedRatings: { ...f.tastingNote.detailedRatings, [key]: value } } }));

  const inputCls = "w-full bg-white border-2 border-[#E8E2F4] rounded-2xl px-4 py-3 text-sm text-[#1E0F38] placeholder:text-[#CABFE3] focus:outline-none focus:border-[#8E75B8] transition-colors";
  const labelCls = "block text-xs font-semibold text-[#634B99] mb-1.5 uppercase tracking-wide";

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-5">

      {/* 基本情報 */}
      <div className="space-y-4">
        <div>
          <label className={labelCls}>ワイン名 <span className="text-red-500">*</span></label>
          <input required className={inputCls} value={form.name}
            onChange={(e) => set("name", e.target.value)} placeholder="例：シャトー・マルゴー" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>生産者</label>
            <input className={inputCls} value={form.producer}
              onChange={(e) => set("producer", e.target.value)} placeholder="生産者名" />
          </div>
          <div>
            <label className={labelCls}>ヴィンテージ</label>
            <input className={inputCls} value={form.vintage}
              onChange={(e) => set("vintage", e.target.value)} placeholder="例：2019、NV" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>国</label>
            <select className={inputCls} value={form.country} onChange={(e) => set("country", e.target.value)}>
              <option value="">選択</option>
              {COUNTRIES.map((c) => (
                <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>産地・地域</label>
            <input className={inputCls} value={form.region}
              onChange={(e) => set("region", e.target.value)} placeholder="例：ボルドー" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>品種</label>
            <input className={inputCls} value={form.grapeVariety}
              onChange={(e) => set("grapeVariety", e.target.value)} placeholder="例：ピノ・ノワール" />
          </div>
          <div>
            <label className={labelCls}>価格</label>
            <input className={inputCls} value={form.price}
              onChange={(e) => set("price", e.target.value)} placeholder="例：¥3,500" />
          </div>
        </div>
        <div>
          <label className={labelCls}>URL</label>
          <input type="url" className={inputCls} value={form.url}
            onChange={(e) => set("url", e.target.value)} placeholder="https://..." />
        </div>

        {/* コスパ最高 toggle */}
        <div>
          <label className={labelCls}>タグ</label>
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => set("goodValue", !form.goodValue)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 text-sm font-medium transition active:scale-95 ${
                form.goodValue
                  ? "bg-[#634B99] text-white border-[#634B99]"
                  : "bg-white border-[#E8E2F4] text-[#8E75B8]"
              }`}
            >
              <svg className="w-4 h-4" fill={form.goodValue ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              コスパ最高
            </button>
          </div>
        </div>
      </div>

      {/* 写真 */}
      <div className="border-t border-[#E8E2F4] pt-5">
        <label className={labelCls}>写真（最大4枚）</label>
        <PhotoUpload photos={form.photos} onChange={(photos) => set("photos", photos)} />
      </div>

      {/* テイスティングノート */}
      <div className="border-t border-[#E8E2F4] pt-5 space-y-5">
        <h3 className="font-semibold text-[#1E0F38]">テイスティングノート</h3>

        <div className="bg-[#FAF8FC] rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#634B99]">総合評価</span>
            <StarRating value={form.tastingNote.rating} onChange={(v) => setNote("rating", v)} size="md" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#634B99]">テイスティング日</span>
            <input type="date"
              className="bg-white border-2 border-[#E8E2F4] rounded-xl px-3 py-1.5 text-sm text-[#1E0F38] focus:outline-none focus:border-[#8E75B8] transition-colors"
              value={form.tastingNote.date}
              onChange={(e) => setNote("date", e.target.value)} />
          </div>
        </div>

        {/* 詳細評価 */}
        <div>
          <label className={labelCls}>詳細評価</label>
          <div className="bg-[#FAF8FC] rounded-3xl p-4 space-y-4">
            {(Object.keys(DETAILED_RATING_LABELS) as (keyof DetailedRatings)[]).map((key) => (
              <DetailedRatingRow
                key={key}
                attrKey={key}
                value={form.tastingNote.detailedRatings[key]}
                onChange={(v) => setDetailedRating(key, v)}
              />
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>メモ</label>
          <textarea rows={4}
            className={`${inputCls} resize-none`}
            value={form.tastingNote.memo}
            onChange={(e) => setNote("memo", e.target.value)}
            placeholder="香り、味わい、余韻など..." />
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2 space-y-3">
        <button type="submit"
          className="w-full py-4 bg-[#634B99] text-white rounded-3xl font-semibold text-sm shadow-[0_4px_16px_rgba(99,75,153,0.3)] hover:bg-[#1E0F38] transition active:scale-[0.98]">
          {initial ? "更新する" : "登録する"}
        </button>
        <button type="button" onClick={onCancel}
          className="w-full py-3.5 bg-[#E8E2F4] text-[#634B99] rounded-3xl font-semibold text-sm hover:bg-[#CABFE3] transition">
          キャンセル
        </button>
      </div>
    </form>
  );
}
