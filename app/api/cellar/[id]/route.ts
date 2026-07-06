import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, unauthorized } from "@/app/lib/api-auth";
import { getSql } from "@/app/lib/db";
import { cellarFromRow } from "@/app/lib/wine-mappers";
import { deletePhotosIfUnreferenced } from "@/app/lib/photo-cleanup";

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

  const oldRows = await sql`
    select photos from cellar_wines where id = ${id} and user_id = ${user.id}
  ` as Array<{ photos: unknown }>;

  const rows = await sql`
    update cellar_wines
    set name = ${data.name ?? ""},
        producer = ${data.producer ?? ""},
        vintage = ${data.vintage || null},
        country = ${data.country ?? ""},
        region = ${data.region ?? ""},
        grape_variety = ${data.grapeVariety ?? ""},
        price = ${data.price || null},
        quantity = ${Number(data.quantity) || 1},
        wine_type = ${data.wineType || null},
        purchase_source = ${data.purchaseSource || null},
        drink_from = ${data.drinkFrom || null},
        drink_until = ${data.drinkUntil || null},
        photos = ${JSON.stringify(data.photos ?? [])}::jsonb,
        url = ${data.url || null},
        updated_at = ${now}
    where id = ${id} and user_id = ${user.id}
    returning *
  ` as Array<Record<string, unknown>>;

  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deletePhotosIfUnreferenced(sql, oldRows[0]?.photos);
  return NextResponse.json({ cellarWine: cellarFromRow(rows[0]) });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const sql = getSql();
  // 「飲む→記録」では写真URLがテイスティング記録に引き継がれるため、
  // keepPhotos=1 のときはBlobを消さない（記録はこの削除の後に作成される）
  const keepPhotos = request.nextUrl.searchParams.get("keepPhotos") === "1";
  const oldRows = await sql`
    select photos from cellar_wines where id = ${id} and user_id = ${user.id}
  ` as Array<{ photos: unknown }>;
  await sql`delete from cellar_wines where id = ${id} and user_id = ${user.id}`;
  if (!keepPhotos) await deletePhotosIfUnreferenced(sql, oldRows[0]?.photos);
  return NextResponse.json({ ok: true });
}
