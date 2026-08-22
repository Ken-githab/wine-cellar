export type WineType = "red" | "white" | "sparkling" | "rose" | "";

export const WINE_TYPES: { value: WineType; label: string; color: string }[] = [
  { value: "red",       label: "赤",            color: "bg-red-100 text-red-700 border-red-200" },
  { value: "white",     label: "白",            color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "sparkling", label: "スパークリング", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "rose",      label: "ロゼ",          color: "bg-pink-100 text-pink-600 border-pink-200" },
];

export const WINE_TYPE_BADGE: Record<WineType, { label: string; cls: string } | null> = {
  red:       { label: "赤",            cls: "bg-red-100 text-red-700" },
  white:     { label: "白",            cls: "bg-yellow-50 text-yellow-700" },
  sparkling: { label: "スパークリング", cls: "bg-blue-50 text-blue-700" },
  rose:      { label: "ロゼ",          cls: "bg-pink-100 text-pink-600" },
  "":        null,
};

export interface CellarWine {
  id: string;
  name: string;
  producer: string;
  vintage: string;
  country: string;
  region: string;
  grapeVariety: string;
  price: string;
  quantity: number;
  wineType: WineType;
  purchaseSource: string;
  drinkFrom: string;  // 例: "2024"
  drinkUntil: string; // 例: "2030"
  photos: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
  activeConsumptionId: string | null;
  drinkStatus: "available" | "pending" | "recorded" | "no_record";
}

export type CellarFormData = Omit<
  CellarWine,
  "id" | "createdAt" | "updatedAt" | "activeConsumptionId" | "drinkStatus"
>;
