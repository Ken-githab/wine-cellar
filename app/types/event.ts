export interface EventWineGuide {
  headline?: string; // 一言での位置づけ
  body?: string; // 解説
  exam?: string[]; // 試験ポイント
  pairNote?: string; // 比較軸(隣のワインとの対比)
}

export interface EventWine {
  id: string;
  position: number;
  name: string;
  producer: string;
  vintage: string;
  country: string;
  region: string;
  grapeVariety: string;
  wineType: string;
  price: string;
  url: string;
  photoUrl: string;
  guide: EventWineGuide;
}

/** その場の評価。参加者ごとに独立して保存される */
export interface EventNote {
  eventWineId: string;
  rating: number | null;
  detailed: Record<string, number>;
  memo: string;
  updatedAt: string;
}

/** 他の参加者の評価(見比べ用。読み取り専用) */
export interface EventNoteByMember {
  eventWineId: string;
  email: string;
  rating: number | null;
  detailed: Record<string, number>;
  memo: string;
}

export interface TastingEvent {
  id: string;
  title: string;
  eventDate: string;
  venue: string;
  note: string;
  isOwner: boolean;
  memberEmails: string[];
  wineCount: number;
}

export interface EventDetail extends TastingEvent {
  wines: EventWine[];
  myNotes: EventNote[];
  otherNotes: EventNoteByMember[];
}

export const EVENT_AXES = [
  { key: "sweetness", label: "甘み" },
  { key: "acidity", label: "酸味" },
  { key: "tannin", label: "タンニン" },
  { key: "alcohol", label: "アルコール" },
  { key: "body", label: "ボディ" },
  { key: "flavor", label: "風味" },
  { key: "finish", label: "後味" },
] as const;
