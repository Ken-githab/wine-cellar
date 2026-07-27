import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, unauthorized } from "@/app/lib/api-auth";
import { getSql } from "@/app/lib/db";
import { toIsoDate } from "@/app/lib/event-date";

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 自分が主催した、または招待されたワイン会の一覧 */
export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const sql = getSql();
  const rows = (await sql`
    select e.*,
      (select count(*) from tasting_event_wines w where w.event_id = e.id) as wine_count,
      (select coalesce(array_agg(u.email), '{}')
         from tasting_event_members m join app_users u on u.id = m.user_id
        where m.event_id = e.id) as member_emails
    from tasting_events e
    where e.owner_user_id = ${user.id}
       or exists (select 1 from tasting_event_members m
                   where m.event_id = e.id and m.user_id = ${user.id})
    order by e.event_date desc
  `) as Array<Record<string, unknown>>;

  return NextResponse.json({
    events: rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      eventDate: toIsoDate(r.event_date),
      venue: (r.venue as string) ?? "",
      note: (r.note as string) ?? "",
      isOwner: r.owner_user_id === user.id,
      memberEmails: (r.member_emails as string[]) ?? [],
      wineCount: Number(r.wine_count ?? 0),
    })),
  });
}

/** ワイン会を作る。メールアドレスで参加者を招待できる */
export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const data = await request.json();
  if (!data.title || !data.eventDate) {
    return NextResponse.json({ error: "タイトルと日付は必須です。" }, { status: 400 });
  }

  const sql = getSql();
  const id = generateId("evt");
  await sql`
    insert into tasting_events (id, owner_user_id, title, event_date, venue, note)
    values (${id}, ${user.id}, ${data.title}, ${data.eventDate}, ${data.venue ?? ""}, ${data.note ?? ""})
  `;
  // 主催者自身もメンバーに入れておく(一覧・記録の扱いを揃えるため)
  await sql`insert into tasting_event_members (event_id, user_id) values (${id}, ${user.id})
            on conflict do nothing`;

  const invites: string[] = Array.isArray(data.inviteEmails) ? data.inviteEmails : [];
  const notFound: string[] = [];
  for (const email of invites) {
    const found = (await sql`select id from app_users where email = ${email}`) as Array<{ id: string }>;
    if (!found.length) {
      notFound.push(email);
      continue;
    }
    await sql`insert into tasting_event_members (event_id, user_id) values (${id}, ${found[0].id})
              on conflict do nothing`;
  }

  const wines = Array.isArray(data.wines) ? data.wines : [];
  for (const [index, w] of wines.entries()) {
    await sql`
      insert into tasting_event_wines (
        id, event_id, position, name, producer, vintage, country, region,
        grape_variety, wine_type, price, url, photo_url, guide
      ) values (
        ${generateId("ew")}, ${id}, ${w.position ?? index + 1}, ${w.name ?? ""}, ${w.producer ?? ""},
        ${w.vintage ?? ""}, ${w.country ?? ""}, ${w.region ?? ""}, ${w.grapeVariety ?? ""},
        ${w.wineType ?? ""}, ${w.price ?? ""}, ${w.url ?? ""}, ${w.photoUrl ?? ""},
        ${JSON.stringify(w.guide ?? {})}
      )`;
  }

  return NextResponse.json({ id, notFound }, { status: 201 });
}
