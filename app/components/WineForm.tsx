"use client";

import { useState } from "react";
import {
  Wine,
  WineFormData,
  EMPTY_DETAILED_RATINGS,
  DETAILED_RATING_LABELS,
  DetailedRatings,
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
  attrKey,
  value,
  onChange,
}: {
  attrKey: keyof DetailedRatings;
  value: number;
  onChange: (v: number) => void;
}) {
  const { label, low, high } = DETAILED_RATING_LABELS[attrKey];
  return (
    <div className="grid grid-cols-[4rem_1fr_auto] items-center gap-2 text-sm">
      <span className="text-gray-700 font-medium text-right">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400 shrink-0 w-10 text-right">{low}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(value === v ? 0 : v)}
              className={`w-6 h-6 rounded-full border-2 transition ${
                v <= value
                  ? "bg-rose-700 border-rose-700"
                  : "border-gray-300 hover:border-rose-400"
              }`}
              aria-label={`${label} ${v}`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-400 shrink-0 w-8">{high}</span>
      </div>
      <span className="text-xs text-rose-700 font-semibold w-4 text-center">
        {value > 0 ? value : ""}
      </span>
    </div>
  );
}

export function WineForm({ initial, onSubmit, onCancel }: WineFormProps) {
  const [form, setForm] = useState<WineFormData>(() =>
    initial
      ? {
          name: initial.name,
          producer: initial.producer,
          vintage: initial.vintage,
          country: initial.country ?? "",
          region: initial.region,
          grapeVariety: initial.grapeVariety,
          price: initial.price ?? "",
          url: initial.url ?? "",
          useCoravin: initial.useCoravin,
          photos: initial.photos ?? [],
          tastingNote: {
            ...initial.tastingNote,
            detailedRatings: {
              ...EMPTY_DETAILED_RATINGS,
              ...(initial.tastingNote.detailedRatings ?? {}),
            },
          },
        }
      : makeEmptyForm()
  );

  const set = <K extends keyof WineFormData>(key: K, value: WineFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setNote = <K extends keyof WineFormData["tastingNote"]>(
    key: K,
    value: WineFormData["tastingNote"][K]
  ) => setForm((f) => ({ ...f, tastingNote: { ...f.tastingNote, [key]: value } }));

  const setDetailedRating = (key: keyof DetailedRatings, value: number) =>
    setForm((f) => ({
      ...f,
      tastingNote: {
        ...f.tastingNote,
        detailedRatings: { ...f.tastingNote.detailedRatings, [key]: value },
      },
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const labelCls = "block text-sm font-medium text-gray-700 mb-1";
  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 基本情報 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls}>
            ワイン名 <span className="text-red-500">*</span>
          </label>
          <input
            required
            className={inputCls}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="例：シャトー・マルゴー"
          />
        </div>
        <div>
          <label className={labelCls}>生産者</label>
          <input
            className={inputCls}
            value={form.producer}
            onChange={(e) => set("producer", e.target.value)}
            placeholder="例：シャトー・マルゴー"
          />
        </div>
        <div>
          <label className={labelCls}>ヴィンテージ</label>
          <input
            className={inputCls}
            value={form.vintage}
            onChange={(e) => set("vintage", e.target.value)}
            placeholder="例：2019、NV、MV"
          />
        </div>
        <div>
          <label className={labelCls}>国</label>
          <select
            className={inputCls}
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
          >
            <option value="">選択してください</option>
            {COUNTRIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>産地・地域</label>
          <input
            className={inputCls}
            value={form.region}
            onChange={(e) => set("region", e.target.value)}
            placeholder="例：ボルドー、ブルゴーニュ"
          />
        </div>
        <div>
          <label className={labelCls}>品種</label>
          <input
            className={inputCls}
            value={form.grapeVariety}
            onChange={(e) => set("grapeVariety", e.target.value)}
            placeholder="例：カベルネ・ソーヴィニヨン、ピノ・ノワール"
          />
        </div>
        <div>
          <label className={labelCls}>価格</label>
          <input
            className={inputCls}
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="例：¥3,500、€25"
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>URL（購入先・参考ページ）</label>
          <input
            type="url"
            className={inputCls}
            value={form.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <input
            id="coravin"
            type="checkbox"
            className="w-4 h-4 accent-rose-700 cursor-pointer"
            checked={form.useCoravin}
            onChange={(e) => set("useCoravin", e.target.checked)}
          />
          <label htmlFor="coravin" className="text-sm font-medium text-gray-700 cursor-pointer">
            コラヴァン使用
          </label>
        </div>
      </div>

      {/* 写真 */}
      <div className="border-t pt-4">
        <label className={labelCls}>写真（最大4枚）</label>
        <PhotoUpload
          photos={form.photos}
          onChange={(photos) => set("photos", photos)}
        />
      </div>

      {/* テイスティングノート */}
      <div className="border-t pt-4 space-y-4">
        <h3 className="font-semibold text-gray-800">テイスティングノート</h3>

        <div>
          <label className={labelCls}>総合評価</label>
          <StarRating
            value={form.tastingNote.rating}
            onChange={(v) => setNote("rating", v)}
          />
        </div>

        <div>
          <label className={labelCls}>テイスティング日</label>
          <input
            type="date"
            className={`${inputCls} w-auto`}
            value={form.tastingNote.date}
            onChange={(e) => setNote("date", e.target.value)}
          />
        </div>

        {/* 詳細評価 */}
        <div>
          <label className={`${labelCls} mb-3`}>詳細評価</label>
          <div className="space-y-3 bg-gray-50 rounded-xl p-4">
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
          <textarea
            rows={4}
            className={`${inputCls} resize-none`}
            value={form.tastingNote.memo}
            onChange={(e) => setNote("memo", e.target.value)}
            placeholder="香り、味わい、余韻など..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-rose-800 text-white text-sm font-medium hover:bg-rose-900 transition"
        >
          {initial ? "更新する" : "登録する"}
        </button>
      </div>
    </form>
  );
}
