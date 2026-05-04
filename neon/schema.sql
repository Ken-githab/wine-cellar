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
