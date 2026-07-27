import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, unauthorized } from "@/app/lib/api-auth";
import { getSql } from "@/app/lib/db";
import { toIsoDate } from "@/app/lib/event-date";

/** 参加した全ワイン会のワインを横断して返す(自分の評価つき)。検索・絞り込みは画面側で行う */
export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();

  const sql = getSql();
  const rows = (await sql`
    select
      w.id, w.position, w.name, w.producer, w.vintage, w.country, w.region,
      w.grape_variety, w.wine_type, w.price, w.url, w.photo_url,
      e.id as event_id, e.title as event_title, e.event_date, e.venue,
      n.rating, n.detailed, n.memo
    from tasting_event_wines w
      join tasting_events e on e.id = w.event_id
      left join tasting_event_notes n on n.event_wine_id = w.id and n.user_id = ${user.id}
    where e.owner_user_id = ${user.id}
       or exists (select 1 from tasting_event_members m
                   where m.event_id = e.id and m.user_id = ${user.id})
    order by e.event_date desc, w.position
  `) as Array<Record<string, unknown>>;

  return NextResponse.json({
    wines: rows.map((r) => ({
      id: r.id as string,
      position: Number(r.position),
      name: r.name as string,
      producer: (r.producer as string) ?? "",
      vintage: (r.vintage as string) ?? "",
      country: (r.country as string) ?? "",
      region: (r.region as string) ?? "",
      grapeVariety: (r.grape_variety as string) ?? "",
      wineType: (r.wine_type as string) ?? "",
      price: (r.price as string) ?? "",
      url: (r.url as string) ?? "",
      photoUrl: (r.photo_url as string) ?? "",
      eventId: r.event_id as string,
      eventTitle: r.event_title as string,
      eventDate: toIsoDate(r.event_date),
      venue: (r.venue as string) ?? "",
      rating: r.rating === null || r.rating === undefined ? null : Number(r.rating),
      detailed: (r.detailed as Record<string, number>) ?? {},
      memo: (r.memo as string) ?? "",
    })),
  });
}
