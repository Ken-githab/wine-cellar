import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, unauthorized } from "@/app/lib/api-auth";
import { getSql } from "@/app/lib/db";
import { wineFromRow } from "@/app/lib/wine-mappers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: Params) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const data = await request.json();
  const now = new Date().toISOString();
  const sql = getSql();

  const rows = await sql`
    update wines
    set name = ${data.name ?? ""},
        producer = ${data.producer ?? ""},
        vintage = ${data.vintage || null},
        country = ${data.country ?? ""},
        region = ${data.region ?? ""},
        grape_variety = ${data.grapeVariety ?? ""},
        price = ${data.price || null},
        url = ${data.url || null},
        use_coravin = ${Boolean(data.useCoravin)},
        good_value = ${Boolean(data.goodValue)},
        photos = ${JSON.stringify(data.photos ?? [])}::jsonb,
        tasting_note = ${JSON.stringify(data.tastingNote ?? {})}::jsonb,
        updated_at = ${now}
    where id = ${id} and user_id = ${user.id}
    returning *
  ` as Array<Record<string, unknown>>;

  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ wine: wineFromRow(rows[0]) });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const sql = getSql();
  await sql`delete from wines where id = ${id} and user_id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
