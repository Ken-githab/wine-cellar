create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  created_at timestamptz not null default now()
);

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

insert into households (id, slug, name)
values ('00000000-0000-0000-0000-000000000001', 'family-cellar', 'ファミリーセラー')
on conflict (slug) do nothing;

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
  household_id uuid not null default '00000000-0000-0000-0000-000000000001'
    references households(id) on delete cascade,
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
create index if not exists cellar_wines_household_id_idx on cellar_wines(household_id);
create index if not exists cellar_wines_created_at_idx on cellar_wines(created_at desc);

create table if not exists cellar_consumptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  cellar_wine_id text not null references cellar_wines(id) on delete cascade,
  started_by_user_id uuid not null references app_users(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists cellar_consumptions_one_open_idx
  on cellar_consumptions(cellar_wine_id)
  where completed_at is null;

create index if not exists cellar_consumptions_household_idx
  on cellar_consumptions(household_id, started_at desc);

create table if not exists cellar_consumption_members (
  consumption_id uuid not null references cellar_consumptions(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'recorded', 'no_record')),
  wine_id text references wines(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (consumption_id, user_id)
);

create index if not exists cellar_consumption_members_user_idx
  on cellar_consumption_members(user_id, updated_at desc);

create or replace function start_or_join_cellar_consumption(
  p_cellar_wine_id text,
  p_user_id uuid
)
returns table (
  consumption_id uuid,
  remaining_quantity integer,
  started_new boolean,
  member_status text
)
language plpgsql
as $$
declare
  v_household_id uuid;
  v_consumption_id uuid;
  v_remaining integer;
  v_started_new boolean := false;
  v_member_status text;
begin
  perform pg_advisory_xact_lock(hashtext(p_cellar_wine_id));

  select c.household_id
  into v_household_id
  from cellar_wines c
  join household_members hm
    on hm.household_id = c.household_id
   and hm.user_id = p_user_id
  where c.id = p_cellar_wine_id;

  if v_household_id is null then
    raise exception 'cellar wine not found or access denied';
  end if;

  select cc.id
  into v_consumption_id
  from cellar_consumptions cc
  where cc.cellar_wine_id = p_cellar_wine_id
    and cc.completed_at is null
  for update;

  if v_consumption_id is null then
    update cellar_wines
    set quantity = quantity - 1,
        updated_at = now()
    where id = p_cellar_wine_id
      and quantity > 0
    returning quantity into v_remaining;

    if v_remaining is null then
      raise exception 'cellar wine is out of stock';
    end if;

    insert into cellar_consumptions (
      household_id, cellar_wine_id, started_by_user_id
    )
    values (
      v_household_id, p_cellar_wine_id, p_user_id
    )
    returning id into v_consumption_id;

    insert into cellar_consumption_members (consumption_id, user_id)
    select v_consumption_id, hm.user_id
    from household_members hm
    where hm.household_id = v_household_id;

    v_started_new := true;
  else
    select quantity into v_remaining
    from cellar_wines
    where id = p_cellar_wine_id;
  end if;

  select ccm.status
  into v_member_status
  from cellar_consumption_members ccm
  where ccm.consumption_id = v_consumption_id
    and ccm.user_id = p_user_id;

  if v_member_status is null then
    raise exception 'household member state not found';
  end if;

  return query select
    v_consumption_id,
    v_remaining,
    v_started_new,
    v_member_status;
end;
$$;

create or replace function complete_cellar_consumption(
  p_consumption_id uuid,
  p_user_id uuid,
  p_status text,
  p_wine_id text default null
)
returns table (
  consumption_completed boolean,
  cellar_wine_deleted boolean
)
language plpgsql
as $$
declare
  v_cellar_wine_id text;
  v_household_id uuid;
  v_quantity integer;
  v_pending_count integer;
  v_completed boolean := false;
  v_deleted boolean := false;
begin
  if p_status not in ('recorded', 'no_record') then
    raise exception 'invalid consumption status';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_consumption_id::text));

  select cc.cellar_wine_id, cc.household_id
  into v_cellar_wine_id, v_household_id
  from cellar_consumptions cc
  join household_members hm
    on hm.household_id = cc.household_id
   and hm.user_id = p_user_id
  where cc.id = p_consumption_id
    and cc.completed_at is null;

  if v_cellar_wine_id is null then
    raise exception 'open consumption not found or access denied';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_cellar_wine_id));

  if p_status = 'recorded' then
    if p_wine_id is null or not exists (
      select 1 from wines w where w.id = p_wine_id and w.user_id = p_user_id
    ) then
      raise exception 'personal wine record not found';
    end if;
  end if;

  update cellar_consumption_members
  set status = p_status,
      wine_id = case when p_status = 'recorded' then p_wine_id else null end,
      updated_at = now()
  where consumption_id = p_consumption_id
    and user_id = p_user_id
    and status = 'pending';

  if not found then
    raise exception 'consumption member state not found';
  end if;

  select count(*)
  into v_pending_count
  from cellar_consumption_members
  where consumption_id = p_consumption_id
    and status = 'pending';

  if v_pending_count = 0 then
    update cellar_consumptions
    set completed_at = now()
    where id = p_consumption_id
      and completed_at is null;

    v_completed := true;

    select quantity into v_quantity
    from cellar_wines
    where id = v_cellar_wine_id;

    if v_quantity = 0 then
      delete from cellar_wines where id = v_cellar_wine_id;
      v_deleted := true;
    end if;
  end if;

  return query select v_completed, v_deleted;
end;
$$;

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
