export type GrapeVariety =
  | "カベルネ・ソーヴィニヨン"
  | "メルロー"
  | "ピノ・ノワール"
  | "シラー/シラーズ"
  | "グルナッシュ"
  | "サンジョヴェーゼ"
  | "テンプラニーリョ"
  | "ネッビオーロ"
  | "シャルドネ"
  | "ソーヴィニヨン・ブラン"
  | "リースリング"
  | "ピノ・グリ"
  | "ゲヴュルツトラミネール"
  | "ヴィオニエ"
  | "その他";

export interface DetailedRatings {
  sweetness: number; // 甘み: 辛口(1)〜甘口(5)
  acidity: number;   // 酸味: 低い(1)〜高い(5)
  tannin: number;    // タンニン: 少ない(1)〜多い(5)
  alcohol: number;   // アルコール: 弱い(1)〜強い(5)
  body: number;      // ボディ: ライト(1)〜フル(5)
  flavor: number;    // 風味: 弱い(1)〜強い(5)
  finish: number;    // 後味: 短い(1)〜長い(5)
}

export const EMPTY_DETAILED_RATINGS: DetailedRatings = {
  sweetness: 0,
  acidity: 0,
  tannin: 0,
  alcohol: 0,
  body: 0,
  flavor: 0,
  finish: 0,
};

export const DETAILED_RATING_LABELS: Record<
  keyof DetailedRatings,
  { label: string; low: string; high: string }
> = {
  sweetness: { label: "甘み",     low: "辛口",   high: "甘口" },
  acidity:   { label: "酸味",     low: "低い",   high: "高い" },
  tannin:    { label: "タンニン", low: "少ない", high: "多い" },
  alcohol:   { label: "アルコール", low: "弱い", high: "強い" },
  body:      { label: "ボディ",   low: "ライト", high: "フル" },
  flavor:    { label: "風味",     low: "弱い",   high: "強い" },
  finish:    { label: "後味",     low: "短い",   high: "長い" },
};

export interface TastingNote {
  rating: number; // 0, 0.5, 1.0, ..., 5.0
  memo: string;
  date: string;
  detailedRatings: DetailedRatings;
}

export interface Wine {
  id: string;
  name: string;
  producer: string;
  vintage: string; // 例: "2019", "NV", "MV"
  country: string;
  region: string;
  grapeVariety: string;
  price: string;  // 例: "¥3,500" や "€25"
  url: string;    // 購入先・参考URLなど
  useCoravin: boolean;
  goodValue: boolean;
  photos: string[]; // base64 data URLs, max 4
  tastingNote: TastingNote;
  createdAt: string;
  updatedAt: string;
}

export type WineFormData = Omit<Wine, "id" | "createdAt" | "updatedAt">;
