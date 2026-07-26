"use client";

import type { EventDetail } from "@/app/types/event";

interface Props {
  detail: EventDetail;
  myEmail: string;
}

const nameOf = (email: string) => email.split("@")[0];

export function EventCompare({ detail, myEmail }: Props) {
  const others = [...new Set(detail.otherNotes.map((n) => n.email))];

  if (others.length === 0) {
    return (
      <p className="text-sm text-[#8A7CA8] text-center py-12 leading-relaxed">
        まだ他の参加者の記録がありません。<br />
        相手が入力すると、ここに並べて表示されます。
      </p>
    );
  }

  const rows = detail.wines.map((wine) => {
    const mine = detail.myNotes.find((n) => n.eventWineId === wine.id);
    const theirs = others.map((email) => ({
      email,
      note: detail.otherNotes.find((n) => n.eventWineId === wine.id && n.email === email),
    }));
    const values = [mine?.rating, ...theirs.map((t) => t.note?.rating)].filter(
      (v): v is number => typeof v === "number"
    );
    const gap = values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
    return { wine, mine, theirs, gap };
  });

  // 感じ方がいちばん違った1本を見つける(ここがこの画面の面白さ)
  const mostSplit = rows.reduce((a, b) => (b.gap > a.gap ? b : a), rows[0]);

  return (
    <div className="space-y-4">
      {mostSplit && mostSplit.gap >= 1 && (
        <div className="bg-[#FBF3DE] border-2 border-[#D9B968] rounded-3xl p-4">
          <p className="text-xs font-bold text-[#7A5E10]">🎭 いちばん評価が割れた1本</p>
          <p className="text-sm font-bold text-[#1E0F38] mt-1.5">
            {mostSplit.wine.position}. {mostSplit.wine.name}
          </p>
          <p className="text-xs text-[#7A5E10] mt-1">★の差 {mostSplit.gap}</p>
        </div>
      )}

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="text-xs text-[#8A7CA8] text-left">
              <th className="py-2 pr-2 font-semibold">ワイン</th>
              <th className="py-2 px-2 font-semibold whitespace-nowrap">{nameOf(myEmail)}</th>
              {others.map((email) => (
                <th key={email} className="py-2 px-2 font-semibold whitespace-nowrap">
                  {nameOf(email)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ wine, mine, theirs, gap }) => (
              <tr key={wine.id} className="border-t-2 border-[#F0EBFA] align-top">
                <td className="py-3 pr-2">
                  <p className="text-xs font-bold text-[#1E0F38] leading-snug">
                    {wine.position}. {wine.name}
                  </p>
                  {gap >= 1.5 && (
                    <span className="inline-block mt-1 text-[10px] font-bold text-[#8E2A44] bg-[#F6E7EC] rounded-full px-2 py-0.5">
                      好みが分かれた
                    </span>
                  )}
                </td>
                <td className="py-3 px-2">
                  <p className="text-sm font-bold text-[#B79A45] tabular-nums">
                    {mine?.rating == null ? "—" : `★${mine.rating}`}
                  </p>
                  {mine?.memo && <p className="text-[11px] text-[#6E5F6B] mt-1">「{mine.memo}」</p>}
                </td>
                {theirs.map(({ email, note }) => (
                  <td key={email} className="py-3 px-2">
                    <p className="text-sm font-bold text-[#B79A45] tabular-nums">
                      {note?.rating == null ? "—" : `★${note.rating}`}
                    </p>
                    {note?.memo && <p className="text-[11px] text-[#6E5F6B] mt-1">「{note.memo}」</p>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
