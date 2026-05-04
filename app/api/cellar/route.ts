import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, unauthorized } from "@/app/lib/api-auth";
import { getSql } from "@/app/lib/db";
import { cellarFromRow } from "@/app/lib/wine-mappers";

function generateId() {
  return `cellar-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const sql = getSql();
  const rows = await sql`
    select *
    from cellar_wines
    where user_id = ${user.id}
    order by created_at desc
  ` as Array<Record<string, unknown>>;
  return NextResponse.json({ cellarWines: rows.map(cellarFromRow) });
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const data = await request.json();
  const now = new Date().toISOString();
  const id = generateId();
  const sql = getSql();

  const rows = await sql`
    insert into cellar_wines (
      id, user_id, name, producer, vintage, country, region, grape_variety,
      price, quantity, wine_type, purchase_source, drink_from, drink_until,
      photos, url, created_at, updated_at
    )
    values (
      ${id}, ${user.id}, ${data.name ?? ""}, ${data.producer ?? ""}, ${data.vintage || null},
      ${data.country ?? ""}, ${data.region ?? ""}, ${data.grapeVariety ?? ""},
      ${data.price || null}, ${Number(data.quantity) || 1}, ${data.wineType || null},
      ${data.purchaseSource || null}, ${data.drinkFrom || null}, ${data.drinkUntil || null},
      ${JSON.stringify(data.photos ?? [])}::jsonb, ${data.url || null}, ${now}, ${now}
    )
    returning *
  ` as Array<Record<string, unknown>>;
  return NextResponse.json({ cellarWine: cellarFromRow(rows[0]) });
}
