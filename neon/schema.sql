create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  created_at timestamptz not null default now()
);

create table if not exists wines (
  id text primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  producer text not null default '',
  vintage text,
  country text not null default '',
  region text not null default '',
  grape_variety text not null default '',
  wine_type text,
  price text,
  url text,
  use_coravin boolean not null default false,
  good_value boolean not null default false,
  photos jsonb not null default '[]'::jsonb,
  tasting_note jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wines_user_id_idx on wines(user_id);
create index if not exists wines_created_at_idx on wines(created_at desc);

create table if not exists cellar_wines (
  id text primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  producer text not null default '',
  vintage text,
  country text not null default '',
  region text not null default '',
  grape_variety text not null default '',
  price text,
  quantity integer not null default 1,
  wine_type text,
  purchase_source text,
  drink_from text,
  drink_until text,
  photos jsonb not null default '[]'::jsonb,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cellar_wines_user_id_idx on cellar_wines(user_id);
create index if not exists cellar_wines_created_at_idx on cellar_wines(created_at desc);

-- ワインセラー環境モニタリング
create table if not exists cellar_environment_readings (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  temperature numeric(5, 2) not null check (temperature between -50 and 100),
  humidity numeric(5, 2) not null check (humidity between 0 and 100),
  sample_slot timestamptz not null,
  recorded_at timestamptz not null default now(),
  unique (device_id, sample_slot)
);

create index if not exists cellar_environment_readings_device_recorded_idx
  on cellar_environment_readings(device_id, recorded_at desc);

-- QStashの再送を同じ取得回として扱い、通信失敗を重複カウントしない
create table if not exists cellar_environment_poll_attempts (
  id bigint generated always as identity primary key,
  device_id text not null,
  sample_slot timestamptz not null,
  status text not null check (status in ('success', 'failure')),
  error_message text,
  attempted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, sample_slot)
);

create index if not exists cellar_environment_poll_attempts_device_slot_idx
  on cellar_environment_poll_attempts(device_id, sample_slot desc);

-- 閾値の連続回数と通知状態を保持し、同じ異常を15分ごとに連投しない
create table if not exists cellar_environment_alert_state (
  device_id text primary key,
  temperature_state text not null default 'normal'
    check (temperature_state in ('normal', 'high_warning', 'high_urgent', 'low_warning', 'low_urgent')),
  temperature_high_count integer not null default 0,
  temperature_low_count integer not null default 0,
  temperature_recovery_count integer not null default 0,
  humidity_state text not null default 'normal'
    check (humidity_state in ('normal', 'low')),
  connectivity_state text not null default 'connected'
    check (connectivity_state in ('connected', 'stopped')),
  consecutive_failures integer not null default 0,
  last_success_at timestamptz,
  last_temperature_notification_at timestamptz,
  last_humidity_notification_at timestamptz,
  last_connectivity_notification_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Discord障害時にも通知を失わないための送信キュー
create table if not exists cellar_environment_alert_outbox (
  id bigint generated always as identity primary key,
  device_id text not null,
  dedupe_key text not null unique,
  category text not null check (category in ('temperature', 'humidity', 'connectivity')),
  event_kind text not null check (event_kind in ('opened', 'changed', 'reminder', 'resolved')),
  title text not null,
  description text not null,
  color integer not null,
  fields jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists cellar_environment_alert_outbox_pending_idx
  on cellar_environment_alert_outbox(status, next_attempt_at, created_at);
