"use client";

import { useState, useEffect, useCallback } from "react";
import type { AppUser } from "@/app/types/auth";
import type { TastingEvent, EventDetail, EventNote, EventWineHit } from "@/app/types/event";
import { saveDraft, loadDraft } from "@/app/lib/offline-store";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options?.body ? { "content-type": "application/json" } : {}), ...options?.headers },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error ?? "通信に失敗しました。");
  return json as T;
}

const detailKey = (eventId: string) => `event-detail:${eventId}`;
const noteQueueKey = (eventId: string) => `event-notes:${eventId}`;

interface QueuedNote {
  eventWineId: string;
  rating: number | null;
  detailed: Record<string, number>;
  memo: string;
}

export function useEvents(user: AppUser | null) {
  const [events, setEvents] = useState<TastingEvent[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const { events: next } = await api<{ events: TastingEvent[] }>("/api/events");
      setEvents(next);
      saveDraft("event-list", next);
    } catch {
      setEvents(loadDraft<TastingEvent[]>("event-list")?.data ?? []);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setEvents([]);
        setIsLoaded(true);
      });
      return;
    }
    (async () => {
      await refresh();
      setIsLoaded(true);
    })();
  }, [user, refresh]);

  const createEvent = useCallback(
    async (payload: unknown): Promise<{ id: string; notFound: string[] }> => {
      const result = await api<{ id: string; notFound: string[] }>("/api/events", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const { events: next } = await api<{ events: TastingEvent[] }>("/api/events");
      setEvents(next);
      return result;
    },
    []
  );

  return { events, isLoaded, refresh, createEvent };
}

/** 全ワイン会のワインを横断して持つ(検索用)。圏外でも直近の内容を見られるよう控えておく */
export function useEventWines(user: AppUser | null) {
  const [wines, setWines] = useState<EventWineHit[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const { wines: next } = await api<{ wines: EventWineHit[] }>("/api/events/wines");
      setWines(next);
      saveDraft("event-wines", next);
    } catch {
      setWines(loadDraft<EventWineHit[]>("event-wines")?.data ?? []);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setWines([]);
        setIsLoaded(true);
      });
      return;
    }
    (async () => {
      await refresh();
      setIsLoaded(true);
    })();
  }, [user, refresh]);

  return { wines, isLoaded, refresh };
}

/** 1つのワイン会の中身と、自分の評価の保存を扱う */
export function useEventDetail(eventId: string | null) {
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [unsent, setUnsent] = useState(0);

  const loadQueue = useCallback(
    (id: string) => loadDraft<QueuedNote[]>(noteQueueKey(id))?.data ?? [],
    []
  );

  // 未送信の評価をサーバーへ送る。失敗したぶんだけ残すので記録は消えない
  const flushNotes = useCallback(
    async (id: string) => {
      const queue = loadQueue(id);
      const remaining: QueuedNote[] = [];
      for (const item of queue) {
        try {
          await api(`/api/events/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(item),
          });
        } catch {
          remaining.push(item);
        }
      }
      saveDraft(noteQueueKey(id), remaining);
      setUnsent(remaining.length);
      return queue.length - remaining.length;
    },
    [loadQueue]
  );

  useEffect(() => {
    if (!eventId) {
      setDetail(null);
      setIsLoaded(true);
      return;
    }
    setIsLoaded(false);
    (async () => {
      await flushNotes(eventId);
      try {
        const { event } = await api<{ event: EventDetail }>(`/api/events/${encodeURIComponent(eventId)}`);
        setDetail(event);
        saveDraft(detailKey(eventId), event); // 会場で圏外でも開けるように控えておく
      } catch {
        setDetail(loadDraft<EventDetail>(detailKey(eventId))?.data ?? null);
      } finally {
        setUnsent(loadQueue(eventId).length);
        setIsLoaded(true);
      }
    })();
  }, [eventId, flushNotes, loadQueue]);

  useEffect(() => {
    if (!eventId) return;
    const onOnline = () => void flushNotes(eventId);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [eventId, flushNotes]);

  /** 評価を保存する。通信できなければ端末に積んで後で自動送信する */
  const saveNote = useCallback(
    async (note: QueuedNote) => {
      if (!eventId) return;
      // 画面は即座に更新する(入力が消えたように見えないように)
      setDetail((prev) => {
        if (!prev) return prev;
        const others = prev.myNotes.filter((n) => n.eventWineId !== note.eventWineId);
        const next: EventNote = { ...note, updatedAt: new Date().toISOString() };
        const updated = { ...prev, myNotes: [...others, next] };
        saveDraft(detailKey(eventId), updated);
        return updated;
      });

      try {
        await api(`/api/events/${encodeURIComponent(eventId)}`, {
          method: "PUT",
          body: JSON.stringify(note),
        });
        // 同じワインの古い未送信ぶんは不要になる
        const queue = loadQueue(eventId).filter((q) => q.eventWineId !== note.eventWineId);
        saveDraft(noteQueueKey(eventId), queue);
        setUnsent(queue.length);
      } catch {
        const queue = loadQueue(eventId).filter((q) => q.eventWineId !== note.eventWineId);
        queue.push(note);
        saveDraft(noteQueueKey(eventId), queue);
        setUnsent(queue.length);
      }
    },
    [eventId, loadQueue]
  );

  /** ワイン会の名前を変える(主催者のみ)。画面と控えも即座に合わせる */
  const renameEvent = useCallback(
    async (title: string) => {
      if (!eventId) return;
      await api(`/api/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      setDetail((prev) => {
        if (!prev) return prev;
        const next = { ...prev, title };
        saveDraft(detailKey(eventId), next);
        return next;
      });
    },
    [eventId]
  );

  return { detail, isLoaded, unsent, saveNote, flushNotes, renameEvent };
}
