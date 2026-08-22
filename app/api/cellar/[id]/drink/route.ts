import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, unauthorized } from "@/app/lib/api-auth";
import { getSql } from "@/app/lib/db";

interface Params {
  params: Promise<{ id: string }>;
}

interface StartRow {
  consumption_id: string;
  remaining_quantity: number;
  started_new: boolean;
  member_status: "pending" | "recorded" | "no_record";
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const sql = getSql();

  try {
    const rows = await sql`
      select * from start_or_join_cellar_consumption(${id}, ${user.id})
    ` as StartRow[];
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "飲用処理を開始できませんでした。" }, { status: 409 });
    }
    if (row.member_status !== "pending") {
      return NextResponse.json(
        { error: row.member_status === "recorded" ? "このワインは記録済みです。" : "このワインは飲用済みです。" },
        { status: 409 },
      );
    }

    return NextResponse.json({
      consumptionId: row.consumption_id,
      remainingQuantity: row.remaining_quantity,
      startedNew: row.started_new,
      drinkStatus: row.member_status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "飲用処理に失敗しました。";
    if (message.includes("not found") || message.includes("access denied")) {
      return NextResponse.json({ error: "対象のワインが見つかりません。" }, { status: 404 });
    }
    if (message.includes("out of stock")) {
      return NextResponse.json({ error: "このワインの在庫はありません。" }, { status: 409 });
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const { consumptionId } = await request.json();
  if (typeof consumptionId !== "string" || !consumptionId) {
    return NextResponse.json({ error: "飲用処理IDが必要です。" }, { status: 400 });
  }

  const sql = getSql();
  const matches = await sql`
    select 1
    from cellar_consumptions
    where id = ${consumptionId}
      and cellar_wine_id = ${id}
      and completed_at is null
  ` as Array<Record<string, unknown>>;
  if (!matches[0]) {
    return NextResponse.json({ error: "進行中の飲用処理が見つかりません。" }, { status: 404 });
  }

  try {
    const rows = await sql`
      select * from complete_cellar_consumption(
        ${consumptionId}, ${user.id}, 'no_record', null
      )
    ` as Array<{ consumption_completed: boolean; cellar_wine_deleted: boolean }>;

    return NextResponse.json({
      ok: true,
      consumptionCompleted: rows[0]?.consumption_completed ?? false,
      cellarWineDeleted: rows[0]?.cellar_wine_deleted ?? false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "飲用処理に失敗しました。";
    if (message.includes("not found") || message.includes("access denied")) {
      return NextResponse.json({ error: "進行中の飲用処理が見つかりません。" }, { status: 404 });
    }
    throw error;
  }
}
