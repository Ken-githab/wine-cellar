import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, unauthorized } from "@/app/lib/api-auth";
import { getSql } from "@/app/lib/db";
import { wineFromRow } from "@/app/lib/wine-mappers";

function generateId() {
  return `wine-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const sql = getSql();
  const rows = await sql`
    select *
    from wines
    where user_id = ${user.id}
    order by created_at desc
  ` as Array<Record<string, unknown>>;
  return NextResponse.json({ wines: rows.map(wineFromRow) });
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const data = await request.json();
  const now = new Date().toISOString();
  const id = generateId();
  const sql = getSql();

  const rows = await sql`
    insert into wines (
      id, user_id, name, producer, vintage, country, region, grape_variety,
      price, url, use_coravin, good_value, photos, tasting_note, created_at, updated_at
    )
    values (
      ${id}, ${user.id}, ${data.name ?? ""}, ${data.producer ?? ""}, ${data.vintage || null},
      ${data.country ?? ""}, ${data.region ?? ""}, ${data.grapeVariety ?? ""},
      ${data.price || null}, ${data.url || null}, ${Boolean(data.useCoravin)},
      ${Boolean(data.goodValue)}, ${JSON.stringify(data.photos ?? [])}::jsonb,
      ${JSON.stringify(data.tastingNote ?? {})}::jsonb, ${now}, ${now}
    )
    returning *
  ` as Array<Record<string, unknown>>;
  return NextResponse.json({ wine: wineFromRow(rows[0]) });
}
