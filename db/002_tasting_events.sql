-- ワイン会(イベント)機能。既存テーブルには一切変更を加えない追加のみ。
-- 評価は参加者ごとに独立して保存される(tasting_event_notes の主キーが event_wine_id + user_id)。

CREATE TABLE IF NOT EXISTS tasting_events (
  id text PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_date date NOT NULL,
  venue text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 供されるワインの台帳。解説(guide)は参加者全員で共有する
CREATE TABLE IF NOT EXISTS tasting_event_wines (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES tasting_events(id) ON DELETE CASCADE,
  position int NOT NULL,
  name text NOT NULL,
  producer text NOT NULL DEFAULT '',
  vintage text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  grape_variety text NOT NULL DEFAULT '',
  wine_type text NOT NULL DEFAULT '',
  price text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  photo_url text NOT NULL DEFAULT '',
  guide jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 誰がこのイベントを開けるか
CREATE TABLE IF NOT EXISTS tasting_event_members (
  event_id text NOT NULL REFERENCES tasting_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);

-- その場の評価。同じワインでも参加者ごとに別の行になる
CREATE TABLE IF NOT EXISTS tasting_event_notes (
  event_wine_id text NOT NULL REFERENCES tasting_event_wines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  rating numeric,
  detailed jsonb NOT NULL DEFAULT '{}'::jsonb,
  memo text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_wine_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_wines_event ON tasting_event_wines(event_id, position);
CREATE INDEX IF NOT EXISTS idx_event_members_user ON tasting_event_members(user_id);
