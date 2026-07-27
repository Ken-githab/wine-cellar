/** DBのdate列は driver によって Date で返るため、文字列の先頭を切ると "Sun Jul 26" になってしまう。
 *  必ずこの関数を通して YYYY-MM-DD に揃える。 */
export function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value ?? "").slice(0, 10);
}

/** 画面表示用。2026-07-26 → 2026.7.26 */
export function formatEventDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[1]}.${Number(m[2])}.${Number(m[3])}`;
}
