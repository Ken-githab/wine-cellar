"use client";

import { useState } from "react";
import { useEvents, useEventDetail, useEventWines } from "@/app/hooks/useEvents";
import { EventWineCard } from "./EventWineCard";
import { EventCompare } from "./EventCompare";
import { EventSearch } from "./EventSearch";
import type { AppUser } from "@/app/types/auth";

interface Props {
  user: AppUser | null;
  onToast: (message: string, type: "success" | "error") => void;
}

export function EventView({ user, onToast }: Props) {
  const { events, isLoaded } = useEvents(user);
  const { wines: allWines } = useEventWines(user);
  const [openId, setOpenId] = useState<string | null>(null);
  const [listMode, setListMode] = useState<"events" | "search">("events");
  const [mode, setMode] = useState<"record" | "compare">("record");
  const { detail, isLoaded: detailLoaded, unsent, saveNote, flushNotes } = useEventDetail(openId);

  if (!user) {
    return (
      <p className="text-sm text-[#8A7CA8] text-center py-12">
        ワイン会の記録を使うにはログインしてください。
      </p>
    );
  }

  if (openId && detail) {
    const recorded = detail.myNotes.filter((n) => n.rating !== null || n.memo).length;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setOpenId(null); setMode("record"); }}
            className="text-sm text-[#634B99] font-semibold"
          >
            ← 一覧
          </button>
          <h2 className="text-base font-bold text-[#1E0F38] flex-1 min-w-0 truncate">{detail.title}</h2>
        </div>

        <div className="flex items-center justify-between gap-3 bg-[#F3EDFF] rounded-2xl px-4 py-3">
          <p className="text-xs text-[#4B2E83]">
            記録済み <b className="text-sm">{recorded}</b> / {detail.wines.length}
            {detail.memberEmails.length > 1 && `　参加 ${detail.memberEmails.length}人`}
            <span className="block mt-1 text-[#7A62A4]">
              少量で味わった第一印象の記録です。おすすめの学習には使いません
            </span>
          </p>
          <div className="flex gap-1.5 shrink-0">
            {(["record", "compare"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 ${
                  mode === m
                    ? "bg-[#8E75B8] border-[#7A62A4] text-white"
                    : "bg-white border-[#E8E2F4] text-[#8A7CA8]"
                }`}
              >
                {m === "record" ? "記録" : "見比べ"}
              </button>
            ))}
          </div>
        </div>

        {unsent > 0 && (
          <div className="flex items-center justify-between gap-3 bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-3">
            <p className="text-xs text-amber-800">
              💾 未送信の評価が{unsent}件（端末に保存済み・消えません）
            </p>
            <button
              type="button"
              onClick={async () => {
                const sent = await flushNotes(detail.id);
                onToast(sent > 0 ? `${sent}件を送信しました` : "まだ通信できません", sent > 0 ? "success" : "error");
              }}
              className="text-xs font-bold underline text-amber-900 shrink-0"
            >
              今すぐ送信
            </button>
          </div>
        )}

        {mode === "compare" ? (
          <EventCompare detail={detail} myEmail={user.email} />
        ) : (
          <div className="space-y-4">
            {detail.wines.map((wine) => (
              <EventWineCard
                key={wine.id}
                wine={wine}
                myNote={detail.myNotes.find((n) => n.eventWineId === wine.id)}
                otherNotes={detail.otherNotes.filter((n) => n.eventWineId === wine.id)}
                showOthers={false}
                onSave={saveNote}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (openId && !detailLoaded) {
    return <p className="text-sm text-[#8A7CA8] text-center py-12">読み込み中…</p>;
  }

  const recordedCount = allWines.filter((w) => w.rating !== null).length;

  return (
    <div className="space-y-4">
      {events.length > 0 && (
        <div className="flex rounded-xl bg-[#E8E2F4] p-1">
          {([
            { key: "events" as const, label: `ワイン会 ${events.length}回` },
            { key: "search" as const, label: `飲んだワインを探す ${recordedCount}本` },
          ]).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setListMode(m.key)}
              aria-pressed={listMode === m.key}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                listMode === m.key ? "bg-white text-[#1E0F38] shadow-sm" : "text-[#8E75B8]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {listMode === "search" && events.length > 0 && (
        <EventSearch wines={allWines} onOpenEvent={(id) => { setOpenId(id); setMode("record"); }} />
      )}

      {listMode === "events" && (
      <>
      {!isLoaded && <p className="text-sm text-[#8A7CA8] text-center py-12">読み込み中…</p>}

      {isLoaded && events.length === 0 && (
        <div className="text-center py-12 px-6">
          <p className="text-sm text-[#8A7CA8] leading-relaxed">
            まだワイン会がありません。<br />
            参加するワイン会が決まったら、Claude Codeに
            <br />
            「ワイン会を登録して」と伝えてください。
          </p>
        </div>
      )}

      {events.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => setOpenId(e.id)}
          className="w-full text-left bg-white border-2 border-[#E8E2F4] rounded-3xl p-4 hover:border-[#C9B6EC] transition-colors"
        >
          <p className="text-xs text-[#8A7CA8]">{e.eventDate}{e.venue && `　${e.venue}`}</p>
          <h3 className="text-sm font-bold text-[#1E0F38] mt-1">{e.title}</h3>
          <p className="text-xs text-[#8A7CA8] mt-2">
            {e.wineCount}種
            {e.memberEmails.length > 1 && `　参加 ${e.memberEmails.length}人`}
          </p>
        </button>
      ))}
      </>
      )}
    </div>
  );
}
