// 既存のbase64写真をVercel Blobへ移行し、DBにはURLだけを残す。
// 再実行可能（data:URLを含む行だけ処理する）。
// 使い方: set -a && source .env.local && set +a && node scripts/migrate-photos-to-blob.mjs

import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import { createHash } from "crypto";

for (const key of ["DATABASE_URL", "BLOB_READ_WRITE_TOKEN"]) {
  if (!process.env[key]) {
    console.error(`${key} is not set`);
    process.exit(1);
  }
}

const sql = neon(process.env.DATABASE_URL);

async function uploadDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-z.+-]+);base64,(.+)$/s);
  if (!match) throw new Error(`unexpected data URL prefix: ${dataUrl.slice(0, 40)}`);
  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  // 内容ハッシュをパスにして、同じ写真（飲む→記録の転記で複製されたもの）を1つのBlobに集約する
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 32);
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const blob = await put(`photos/migrated/${hash}.${ext}`, buffer, {
    access: "public",
    contentType: mime,
    allowOverwrite: true,
  });
  return { url: blob.url, bytes: buffer.length };
}

async function migrateTable(table) {
  const rows = await sql.query(`select id, photos from ${table} order by created_at`);
  let migratedPhotos = 0;
  let migratedRows = 0;
  let totalBytes = 0;

  for (const row of rows) {
    const photos = Array.isArray(row.photos) ? row.photos : [];
    if (!photos.some((p) => typeof p === "string" && p.startsWith("data:"))) continue;

    const next = [];
    for (const photo of photos) {
      if (typeof photo !== "string" || !photo.startsWith("data:")) {
        next.push(photo);
        continue;
      }
      const { url, bytes } = await uploadDataUrl(photo);
      next.push(url);
      migratedPhotos += 1;
      totalBytes += bytes;
    }

    await sql.query(`update ${table} set photos = $1::jsonb where id = $2`, [
      JSON.stringify(next),
      row.id,
    ]);
    migratedRows += 1;
    console.log(`${table} ${row.id}: ${next.length}枚`);
  }

  console.log(
    `${table}: ${migratedRows}行 / ${migratedPhotos}枚を移行 (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`
  );
}

await migrateTable("wines");
await migrateTable("cellar_wines");
console.log("done");
