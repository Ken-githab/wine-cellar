import { readFile } from "fs/promises";
import { neon } from "@neondatabase/serverless";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: node scripts/import-supabase-export.mjs path/to/export.json");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const raw = await readFile(filePath, "utf8");
const parsed = JSON.parse(raw);
const payload = parsed.export_json ?? parsed[0]?.export_json ?? parsed;

const users = payload.users ?? [];
const wines = payload.wines ?? [];
const cellarWines = payload.cellar_wines ?? [];

try {
  for (const user of users) {
    await sql`
      insert into app_users (id, email)
      values (${user.id}, ${String(user.email).toLowerCase()})
      on conflict (id) do update set email = excluded.email
    `;
  }

  for (const wine of wines) {
    await sql`
      insert into wines (
        id, user_id, name, producer, vintage, country, region, grape_variety,
        price, url, use_coravin, good_value, photos, tasting_note, created_at, updated_at
      )
      values (
        ${wine.id}, ${wine.user_id}, ${wine.name ?? ""}, ${wine.producer ?? ""},
        ${wine.vintage ?? null}, ${wine.country ?? ""}, ${wine.region ?? ""},
        ${wine.grape_variety ?? ""}, ${wine.price ?? null}, ${wine.url ?? null},
        ${Boolean(wine.use_coravin)}, ${Boolean(wine.good_value)},
        ${JSON.stringify(wine.photos ?? [])}::jsonb,
        ${JSON.stringify(wine.tasting_note ?? {})}::jsonb,
        ${wine.created_at}, ${wine.updated_at}
      )
      on conflict (id) do update set
        user_id = excluded.user_id,
        name = excluded.name,
        producer = excluded.producer,
        vintage = excluded.vintage,
        country = excluded.country,
        region = excluded.region,
        grape_variety = excluded.grape_variety,
        price = excluded.price,
        url = excluded.url,
        use_coravin = excluded.use_coravin,
        good_value = excluded.good_value,
        photos = excluded.photos,
        tasting_note = excluded.tasting_note,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `;
  }

  for (const wine of cellarWines) {
    await sql`
      insert into cellar_wines (
        id, user_id, name, producer, vintage, country, region, grape_variety,
        price, quantity, wine_type, purchase_source, drink_from, drink_until,
        photos, url, created_at, updated_at
      )
      values (
        ${wine.id}, ${wine.user_id}, ${wine.name ?? ""}, ${wine.producer ?? ""},
        ${wine.vintage ?? null}, ${wine.country ?? ""}, ${wine.region ?? ""},
        ${wine.grape_variety ?? ""}, ${wine.price ?? null}, ${Number(wine.quantity) || 1},
        ${wine.wine_type ?? null}, ${wine.purchase_source ?? null},
        ${wine.drink_from ?? null}, ${wine.drink_until ?? null},
        ${JSON.stringify(wine.photos ?? [])}::jsonb, ${wine.url ?? null},
        ${wine.created_at}, ${wine.updated_at}
      )
      on conflict (id) do update set
        user_id = excluded.user_id,
        name = excluded.name,
        producer = excluded.producer,
        vintage = excluded.vintage,
        country = excluded.country,
        region = excluded.region,
        grape_variety = excluded.grape_variety,
        price = excluded.price,
        quantity = excluded.quantity,
        wine_type = excluded.wine_type,
        purchase_source = excluded.purchase_source,
        drink_from = excluded.drink_from,
        drink_until = excluded.drink_until,
        photos = excluded.photos,
        url = excluded.url,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
    `;
  }

  console.log(`Imported users=${users.length}, wines=${wines.length}, cellar_wines=${cellarWines.length}`);
} catch (error) {
  throw error;
}
