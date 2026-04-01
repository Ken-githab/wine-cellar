-- Wine Cellar — Supabase スキーマ
-- Supabase ダッシュボード > SQL Editor にコピー&実行してください

-- wines テーブル
create table if not exists public.wines (
  id            text        primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  name          text        not null,
  producer      text        not null default '',
  vintage       integer,
  country       text        not null default '',
  region        text        not null default '',
  grape_variety text        not null default '',
  use_coravin   boolean     not null default false,
  photos        text[]      not null default '{}',
  tasting_note  jsonb       not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- インデックス
create index if not exists wines_user_id_idx on public.wines(user_id);
create index if not exists wines_created_at_idx on public.wines(created_at desc);

-- テーブルアクセス権（authenticated ロールに必要）
-- ※ これがないと PostgREST が 404 を返す
grant select, insert, update, delete on public.wines to authenticated;

-- Row Level Security（自分のデータだけ操作可能）
alter table public.wines enable row level security;

create policy "Users can select their own wines"
  on public.wines for select
  using (auth.uid() = user_id);

create policy "Users can insert their own wines"
  on public.wines for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own wines"
  on public.wines for update
  using (auth.uid() = user_id);

create policy "Users can delete their own wines"
  on public.wines for delete
  using (auth.uid() = user_id);

-- updated_at を自動更新するトリガー
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger wines_set_updated_at
  before update on public.wines
  for each row execute function public.set_updated_at();
