export function splitGrapeVarieties(text: string): string[] {
  return text.split("\n").map((v) => v.trim()).filter(Boolean);
}
