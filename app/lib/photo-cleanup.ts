import { del } from "@vercel/blob";

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

export function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

// 行の更新・削除が終わった後に呼ぶこと。
// 「飲む→記録」でセラーの写真URLがテイスティング記録に転記されるため、
// どの行からも参照されなくなったBlobだけを削除する。
export async function deletePhotosIfUnreferenced(sql: Sql, candidates: unknown) {
  const urls = (Array.isArray(candidates) ? candidates : [])
    .filter((p): p is string => typeof p === "string" && isBlobUrl(p));
  if (urls.length === 0) return;

  const orphans: string[] = [];
  for (const url of urls) {
    const contains = JSON.stringify([url]);
    const rows = await sql`
      select
        (select count(*) from wines where photos @> ${contains}::jsonb) +
        (select count(*) from cellar_wines where photos @> ${contains}::jsonb) as refs
    ` as Array<{ refs: string | number }>;
    if (Number(rows[0]?.refs ?? 0) === 0) orphans.push(url);
  }
  if (orphans.length === 0) return;

  try {
    await del(orphans);
  } catch {
    // Blob削除の失敗でリクエスト全体を落とさない（孤児Blobが残るだけ）
  }
}
