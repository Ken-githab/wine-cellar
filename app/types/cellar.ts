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
  drinkFrom: string;  // 例: "2024"
  drinkUntil: string; // 例: "2030"
  photos: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
}

export type CellarFormData = Omit<CellarWine, "id" | "createdAt" | "updatedAt">;
