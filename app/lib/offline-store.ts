"use client";

// 記録を失わないための端末側の保管庫。
// 1. 下書き(draft): 入力途中の内容。アプリが落ちても次回開いたときに復元できる
// 2. 送信キュー(outbox): 通信に失敗した保存操作。オンライン復帰時に自動で再送する

const DRAFT_PREFIX = "wine-cellar-draft:";
const OUTBOX_KEY = "wine-cellar-outbox";

export interface OutboxItem {
  id: string;
  kind: "wine" | "cellar";
  op: "create" | "update";
  targetId?: string; // updateのとき対象のid
  payload: unknown;
  label: string; // 未送信一覧に出す表示名
  queuedAt: string;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // 容量超過など
  }
}

// --- 下書き ---

export function saveDraft(formKey: string, data: unknown): void {
  write(DRAFT_PREFIX + formKey, { data, savedAt: new Date().toISOString() });
}

export function loadDraft<T>(formKey: string): { data: T; savedAt: string } | null {
  return read<{ data: T; savedAt: string } | null>(DRAFT_PREFIX + formKey, null);
}

export function clearDraft(formKey: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_PREFIX + formKey);
  } catch {
    /* noop */
  }
}

// --- 送信キュー ---

export function loadOutbox(): OutboxItem[] {
  return read<OutboxItem[]>(OUTBOX_KEY, []);
}

export function enqueue(item: Omit<OutboxItem, "id" | "queuedAt">): OutboxItem {
  const full: OutboxItem = {
    ...item,
    id: `ob-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    queuedAt: new Date().toISOString(),
  };
  write(OUTBOX_KEY, [...loadOutbox(), full]);
  return full;
}

export function dequeue(id: string): void {
  write(
    OUTBOX_KEY,
    loadOutbox().filter((item) => item.id !== id)
  );
}

// iOSが空き容量確保のためにデータを消すのを防ぐ(拒否されても実害はない)
export async function requestPersistentStorage(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return;
  try {
    if (await navigator.storage.persisted?.()) return;
    await navigator.storage.persist();
  } catch {
    /* noop */
  }
}
