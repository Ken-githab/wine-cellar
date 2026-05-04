import { EMPTY_DETAILED_RATINGS, Wine } from "@/app/types/wine";
import { CellarWine } from "@/app/types/cellar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wineFromRow(row: any): Wine {
  let tastingNote = row.tasting_note ?? {};
  if (typeof tastingNote === "string") {
    try { tastingNote = JSON.parse(tastingNote); } catch { tastingNote = {}; }
  }
  return {
    id: row.id,
    name: row.name,
    producer: row.producer ?? "",
    vintage: row.vintage != null ? String(row.vintage) : "",
    country: row.country ?? "",
    region: row.region ?? "",
    grapeVariety: row.grape_variety ?? "",
    price: row.price != null ? String(row.price) : "",
    url: row.url ?? "",
    useCoravin: row.use_coravin ?? false,
    goodValue: row.good_value ?? false,
    photos: Array.isArray(row.photos) ? row.photos : [],
    tastingNote: {
      rating: tastingNote.rating ?? 0,
      memo: tastingNote.memo ?? "",
      date: tastingNote.date ?? "",
      detailedRatings: {
        ...EMPTY_DETAILED_RATINGS,
        ...(tastingNote.detailedRatings ?? {}),
      },
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cellarFromRow(row: any): CellarWine {
  return {
    id: row.id,
    name: row.name,
    producer: row.producer ?? "",
    vintage: row.vintage != null ? String(row.vintage) : "",
    country: row.country ?? "",
    region: row.region ?? "",
    grapeVariety: row.grape_variety ?? "",
    price: row.price != null ? String(row.price) : "",
    quantity: row.quantity ?? 1,
    wineType: row.wine_type ?? "",
    purchaseSource: row.purchase_source ?? "",
    drinkFrom: row.drink_from ?? "",
    drinkUntil: row.drink_until ?? "",
    photos: Array.isArray(row.photos) ? row.photos : [],
    url: row.url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
