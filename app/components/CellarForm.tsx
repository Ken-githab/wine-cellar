"use client";

import { useState } from "react";
import { CellarWine, CellarFormData, WineType } from "@/app/types/cellar";
import { PhotoUpload } from "./PhotoUpload";
import { COUNTRIES } from "./WineForm";

const WINE_TYPES: { value: WineType; label: string; color: string }[] = [
  { value: "red",      label: "赤",          color: "bg-red-100 text-red-700 border-red-200" },
  { value: "white",    label: "白",          color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "sparkling",label: "スパークリング", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "rose",     label: "ロゼ",        color: "bg-pink-100 text-pink-600 border-pink-200" },
];

const makeEmpty = (): CellarFormData => ({
  name: "",
  producer: "",
  vintage: "",
  country: "",
  region: "",
  grapeVariety: "",
  price: "",
  quantity: 1,
  wineType: "",
  drinkFrom: "",
  drinkUntil: "",
  photos: [],
  url: "",
});

interface Props {
  initial?: CellarWine;
  onSubmit: (data: CellarFormData) => void;
  onCancel: () => void;
}

export function CellarForm({ initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<CellarFormData>(() =>
    initial ? {
      name: initial.name,
      producer: initial.producer,
      vintage: initial.vintage,
      country: initial.country,
      region: initial.region,
      grapeVariety: initial.grapeVariety,
      price: initial.price,
      quantity: initial.quantity,
      wineType: initial.wineType,
      drinkFrom: initial.drinkFrom,
      drinkUntil: initial.drinkUntil,
      photos: initial.photos,
      url: initial.url,
    } : makeEmpty()
  );

  const set = <K extends keyof CellarFormData>(key: K, value: CellarFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const inputCls = "w-full bg-white border-2 border-[#E8E2F4] rounded-2xl px-4 py-3 text-sm text-[#1E0F38] placeholder:text-[#CABFE3] focus:outline-none focus:border-[#8E75B8] transition-colors";
  const labelCls = "block text-xs font-semibold text-[#634B99] mb-1.5 uppercase tracking-wide";

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-5">

      {/* ワイン種別 */}
      <div>
        <label className={labelCls}>種別</label>
        <div className="flex gap-2 flex-wrap">
          {WINE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set("wineType", form.wineType === t.value ? "" : t.value)}
              className={`px-4 py-2 rounded-2xl border-2 text-sm font-medium transition active:scale-95 ${
                form.wineType === t.value ? t.color + " border-current" : "bg-white border-[#E8E2F4] text-[#8E75B8]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

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
              onChange={(e) => set("price", e.target.value)} placeholder="例：5,000" />
          </div>
        </div>
      </div>

      {/* 在庫・飲み頃 */}
      <div className="border-t border-[#E8E2F4] pt-5 space-y-4">
        <h3 className="font-semibold text-[#1E0F38]">在庫 / 飲み頃</h3>

        <div>
          <label className={labelCls}>本数 <span className="text-red-500">*</span></label>
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => set("quantity", Math.max(1, form.quantity - 1))}
              className="w-10 h-10 rounded-full bg-[#E8E2F4] text-[#634B99] font-bold text-lg flex items-center justify-center hover:bg-[#CABFE3] transition active:scale-95">
              −
            </button>
            <span className="text-2xl font-bold text-[#1E0F38] w-12 text-center">{form.quantity}</span>
            <button type="button"
              onClick={() => set("quantity", form.quantity + 1)}
              className="w-10 h-10 rounded-full bg-[#634B99] text-white font-bold text-lg flex items-center justify-center hover:bg-[#1E0F38] transition active:scale-95">
              ＋
            </button>
            <span className="text-sm text-[#8E75B8]">本</span>
          </div>
        </div>

        <div>
          <label className={labelCls}>飲み頃期間</label>
          <div className="flex items-center gap-2">
            <input className={`${inputCls} flex-1`} value={form.drinkFrom}
              onChange={(e) => set("drinkFrom", e.target.value)}
              placeholder="例：2024" maxLength={4} />
            <span className="text-[#8E75B8] text-sm shrink-0">〜</span>
            <input className={`${inputCls} flex-1`} value={form.drinkUntil}
              onChange={(e) => set("drinkUntil", e.target.value)}
              placeholder="例：2030" maxLength={4} />
          </div>
        </div>
      </div>

      {/* 写真 */}
      <div className="border-t border-[#E8E2F4] pt-5">
        <label className={labelCls}>写真（最大4枚）</label>
        <PhotoUpload photos={form.photos} onChange={(photos) => set("photos", photos)} />
      </div>

      {/* URL */}
      <div>
        <label className={labelCls}>URL</label>
        <input type="url" className={inputCls} value={form.url}
          onChange={(e) => set("url", e.target.value)} placeholder="https://..." />
      </div>

      {/* Actions */}
      <div className="pt-2 space-y-3">
        <button type="submit"
          className="w-full py-4 bg-[#634B99] text-white rounded-3xl font-semibold text-sm shadow-[0_4px_16px_rgba(99,75,153,0.3)] hover:bg-[#1E0F38] transition active:scale-[0.98]">
          {initial ? "更新する" : "セラーに追加"}
        </button>
        <button type="button" onClick={onCancel}
          className="w-full py-3.5 bg-[#E8E2F4] text-[#634B99] rounded-3xl font-semibold text-sm hover:bg-[#CABFE3] transition">
          キャンセル
        </button>
      </div>
    </form>
  );
}
