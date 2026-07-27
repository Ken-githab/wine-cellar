import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, unauthorized } from "@/app/lib/api-auth";
import { getSql } from "@/app/lib/db";
import { toIsoDate } from "@/app/lib/event-date";

async function canAccess(sql: ReturnType<typeof getSql>, eventId: string, userId: string) {
  const rows = (await sql`
    select 1 from tasting_events e
    where e.id = ${eventId}
      and (e.owner_user_id = ${userId}
           or exists (select 1 from tasting_event_members m
                       where m.event_id = e.id and m.user_id = ${userId}))
  `) as unknown[];
  return rows.length > 0;
}

/** ワイン会の中身。自分の評価と、他の参加者の評価(見比べ用)を返す */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;

  const sql = getSql();
  if (!(await canAccess(sql, id, user.id))) {
    return NextResponse.json({ error: "このワイン会は表示できません。" }, { status: 404 });
  }

  const events = (await sql`
    select e.*,
      (select coalesce(array_agg(u.email), '{}')
         from tasting_event_members m join app_users u on u.id = m.user_id
        where m.event_id = e.id) as member_emails
    from tasting_events e where e.id = ${id}
  `) as Array<Record<string, unknown>>;
  const event = events[0];

  const wines = (await sql`
    select * from tasting_event_wines where event_id = ${id} order by position
  `) as Array<Record<string, unknown>>;

  const myNotes = (await sql`
    select n.* from tasting_event_notes n
      join tasting_event_wines w on w.id = n.event_wine_id
     where w.event_id = ${id} and n.user_id = ${user.id}
  `) as Array<Record<string, unknown>>;

  const otherNotes = (await sql`
    select n.*, u.email from tasting_event_notes n
      join tasting_event_wines w on w.id = n.event_wine_id
      join app_users u on u.id = n.user_id
     where w.event_id = ${id} and n.user_id <> ${user.id}
  `) as Array<Record<string, unknown>>;

  return NextResponse.json({
    event: {
      id: event.id as string,
      title: event.title as string,
      eventDate: toIsoDate(event.event_date),
      venue: (event.venue as string) ?? "",
      note: (event.note as string) ?? "",
      isOwner: event.owner_user_id === user.id,
      memberEmails: (event.member_emails as string[]) ?? [],
      wineCount: wines.length,
      wines: wines.map((w) => ({
        id: w.id as string,
        position: Number(w.position),
        name: w.name as string,
        producer: (w.producer as string) ?? "",
        vintage: (w.vintage as string) ?? "",
        country: (w.country as string) ?? "",
        region: (w.region as string) ?? "",
        grapeVariety: (w.grape_variety as string) ?? "",
        wineType: (w.wine_type as string) ?? "",
        price: (w.price as string) ?? "",
        url: (w.url as string) ?? "",
        photoUrl: (w.photo_url as string) ?? "",
        guide: (w.guide as Record<string, unknown>) ?? {},
      })),
      myNotes: myNotes.map((n) => ({
        eventWineId: n.event_wine_id as string,
        rating: n.rating === null ? null : Number(n.rating),
        detailed: (n.detailed as Record<string, number>) ?? {},
        memo: (n.memo as string) ?? "",
        updatedAt: String(n.updated_at),
      })),
      otherNotes: otherNotes.map((n) => ({
        eventWineId: n.event_wine_id as string,
        email: n.email as string,
        rating: n.rating === null ? null : Number(n.rating),
        detailed: (n.detailed as Record<string, number>) ?? {},
        memo: (n.memo as string) ?? "",
      })),
    },
  });
}

/** 自分の評価を保存する。他の参加者の記録には触れない */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;

  const sql = getSql();
  if (!(await canAccess(sql, id, user.id))) {
    return NextResponse.json({ error: "このワイン会は編集できません。" }, { status: 404 });
  }

  const data = await request.json();
  const eventWineId: string = data.eventWineId;
  // 他のイベントのワインIDを渡されても書き込めないようにする
  const owned = (await sql`
    select 1 from tasting_event_wines where id = ${eventWineId} and event_id = ${id}
  `) as unknown[];
  if (!owned.length) {
    return NextResponse.json({ error: "対象のワインが見つかりません。" }, { status: 400 });
  }

  await sql`
    insert into tasting_event_notes (event_wine_id, user_id, rating, detailed, memo, updated_at)
    values (${eventWineId}, ${user.id}, ${data.rating ?? null},
            ${JSON.stringify(data.detailed ?? {})}, ${data.memo ?? ""}, now())
    on conflict (event_wine_id, user_id) do update
      set rating = excluded.rating, detailed = excluded.detailed,
          memo = excluded.memo, updated_at = now()
  `;
  return NextResponse.json({ ok: true });
}

/** ワイン会の名前などを書き換える。主催者のみ */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;

  const data = await request.json();
  const title = String(data.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "名前を入力してください。" }, { status: 400 });
  }

  const sql = getSql();
  const rows = (await sql`
    update tasting_events
       set title = ${title},
           venue = coalesce(${data.venue ?? null}, venue)
     where id = ${id} and owner_user_id = ${user.id}
    returning id
  `) as unknown[];

  if (!rows.length) {
    return NextResponse.json({ error: "主催者のみ変更できます。" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}

/** 主催者のみ削除できる */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;

  const sql = getSql();
  const rows = (await sql`
    delete from tasting_events where id = ${id} and owner_user_id = ${user.id} returning id
  `) as unknown[];
  if (!rows.length) {
    return NextResponse.json({ error: "主催者のみ削除できます。" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
