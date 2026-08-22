-- 家族で共有するセラー在庫と、アカウント別の飲用状態。
-- 物理在庫は最初に「飲む」を押したときだけ1本減らし、各メンバーの記録は独立して完了できる。

CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_members (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id),
  UNIQUE (user_id)
);

INSERT INTO households (id, slug, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'family-cellar', 'ファミリーセラー')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO household_members (household_id, user_id)
SELECT h.id, u.id
FROM households h
CROSS JOIN app_users u
WHERE h.slug = 'family-cellar'
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE cellar_wines
  ADD COLUMN IF NOT EXISTS household_id uuid
    DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES households(id) ON DELETE CASCADE;

UPDATE cellar_wines c
SET household_id = hm.household_id
FROM household_members hm
WHERE hm.user_id = c.user_id
  AND c.household_id IS NULL;

-- 統合前の全行を退避し、万一の際に旧状態を復元できるようにする。
CREATE TABLE IF NOT EXISTS cellar_wines_pre_shared_backup
  AS TABLE cellar_wines WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS cellar_wines_pre_shared_backup_id_idx
  ON cellar_wines_pre_shared_backup(id);

INSERT INTO cellar_wines_pre_shared_backup (
  id, user_id, household_id, name, producer, vintage, country, region,
  grape_variety, price, quantity, wine_type, purchase_source, drink_from,
  drink_until, photos, url, created_at, updated_at
)
SELECT
  id, user_id, household_id, name, producer, vintage, country, region,
  grape_variety, price, quantity, wine_type, purchase_source, drink_from,
  drink_until, photos, url, created_at, updated_at
FROM cellar_wines
ON CONFLICT (id) DO NOTHING;

-- 旧仕様では同じ在庫をアカウントごとに複製していたため、初回移行時だけ同一内容の行を1行へ統合する。
-- 写真が多い行、次に古い行を共有在庫の正本として残す。
DO $$
BEGIN
  IF to_regclass('public.cellar_consumptions') IS NULL THEN
    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY
            household_id, name, producer, vintage, country, region, grape_variety,
            price, quantity, wine_type, purchase_source, drink_from, drink_until, url
          ORDER BY jsonb_array_length(photos) DESC, created_at ASC, id ASC
        ) AS position
      FROM cellar_wines
      WHERE household_id IS NOT NULL
    )
    DELETE FROM cellar_wines c
    USING ranked r
    WHERE c.id = r.id
      AND r.position > 1;
  END IF;
END;
$$;

ALTER TABLE cellar_wines
  ALTER COLUMN household_id SET DEFAULT '00000000-0000-0000-0000-000000000001',
  ALTER COLUMN household_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS cellar_wines_household_id_idx
  ON cellar_wines(household_id);

CREATE TABLE IF NOT EXISTS cellar_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  cellar_wine_id text NOT NULL REFERENCES cellar_wines(id) ON DELETE CASCADE,
  started_by_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS cellar_consumptions_one_open_idx
  ON cellar_consumptions(cellar_wine_id)
  WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS cellar_consumptions_household_idx
  ON cellar_consumptions(household_id, started_at DESC);

CREATE TABLE IF NOT EXISTS cellar_consumption_members (
  consumption_id uuid NOT NULL REFERENCES cellar_consumptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'recorded', 'no_record')),
  wine_id text REFERENCES wines(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumption_id, user_id)
);

CREATE INDEX IF NOT EXISTS cellar_consumption_members_user_idx
  ON cellar_consumption_members(user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION start_or_join_cellar_consumption(
  p_cellar_wine_id text,
  p_user_id uuid
)
RETURNS TABLE (
  consumption_id uuid,
  remaining_quantity integer,
  started_new boolean,
  member_status text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_household_id uuid;
  v_consumption_id uuid;
  v_remaining integer;
  v_started_new boolean := false;
  v_member_status text;
BEGIN
  -- 同じ銘柄に対する同時操作を直列化し、二重減算を防ぐ。
  PERFORM pg_advisory_xact_lock(hashtext(p_cellar_wine_id));

  SELECT c.household_id
  INTO v_household_id
  FROM cellar_wines c
  JOIN household_members hm
    ON hm.household_id = c.household_id
   AND hm.user_id = p_user_id
  WHERE c.id = p_cellar_wine_id;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'cellar wine not found or access denied';
  END IF;

  SELECT cc.id
  INTO v_consumption_id
  FROM cellar_consumptions cc
  WHERE cc.cellar_wine_id = p_cellar_wine_id
    AND cc.completed_at IS NULL
  FOR UPDATE;

  IF v_consumption_id IS NULL THEN
    UPDATE cellar_wines
    SET quantity = quantity - 1,
        updated_at = now()
    WHERE id = p_cellar_wine_id
      AND quantity > 0
    RETURNING quantity INTO v_remaining;

    IF v_remaining IS NULL THEN
      RAISE EXCEPTION 'cellar wine is out of stock';
    END IF;

    INSERT INTO cellar_consumptions (
      household_id, cellar_wine_id, started_by_user_id
    )
    VALUES (
      v_household_id, p_cellar_wine_id, p_user_id
    )
    RETURNING id INTO v_consumption_id;

    INSERT INTO cellar_consumption_members (consumption_id, user_id)
    SELECT v_consumption_id, hm.user_id
    FROM household_members hm
    WHERE hm.household_id = v_household_id;

    v_started_new := true;
  ELSE
    SELECT quantity INTO v_remaining
    FROM cellar_wines
    WHERE id = p_cellar_wine_id;
  END IF;

  SELECT ccm.status
  INTO v_member_status
  FROM cellar_consumption_members ccm
  WHERE ccm.consumption_id = v_consumption_id
    AND ccm.user_id = p_user_id;

  IF v_member_status IS NULL THEN
    RAISE EXCEPTION 'household member state not found';
  END IF;

  RETURN QUERY SELECT
    v_consumption_id,
    v_remaining,
    v_started_new,
    v_member_status;
END;
$$;

CREATE OR REPLACE FUNCTION complete_cellar_consumption(
  p_consumption_id uuid,
  p_user_id uuid,
  p_status text,
  p_wine_id text DEFAULT NULL
)
RETURNS TABLE (
  consumption_completed boolean,
  cellar_wine_deleted boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_cellar_wine_id text;
  v_household_id uuid;
  v_quantity integer;
  v_pending_count integer;
  v_completed boolean := false;
  v_deleted boolean := false;
BEGIN
  IF p_status NOT IN ('recorded', 'no_record') THEN
    RAISE EXCEPTION 'invalid consumption status';
  END IF;

  -- 同じ飲用処理の完了要求を直列化する。
  PERFORM pg_advisory_xact_lock(hashtext(p_consumption_id::text));

  SELECT cc.cellar_wine_id, cc.household_id
  INTO v_cellar_wine_id, v_household_id
  FROM cellar_consumptions cc
  JOIN household_members hm
    ON hm.household_id = cc.household_id
   AND hm.user_id = p_user_id
  WHERE cc.id = p_consumption_id
    AND cc.completed_at IS NULL;

  IF v_cellar_wine_id IS NULL THEN
    RAISE EXCEPTION 'open consumption not found or access denied';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_cellar_wine_id));

  IF p_status = 'recorded' THEN
    IF p_wine_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM wines w WHERE w.id = p_wine_id AND w.user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'personal wine record not found';
    END IF;
  END IF;

  UPDATE cellar_consumption_members
  SET status = p_status,
      wine_id = CASE WHEN p_status = 'recorded' THEN p_wine_id ELSE NULL END,
      updated_at = now()
  WHERE consumption_id = p_consumption_id
    AND user_id = p_user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consumption member state not found';
  END IF;

  SELECT count(*)
  INTO v_pending_count
  FROM cellar_consumption_members
  WHERE consumption_id = p_consumption_id
    AND status = 'pending';

  IF v_pending_count = 0 THEN
    UPDATE cellar_consumptions
    SET completed_at = now()
    WHERE id = p_consumption_id
      AND completed_at IS NULL;

    v_completed := true;

    SELECT quantity INTO v_quantity
    FROM cellar_wines
    WHERE id = v_cellar_wine_id;

    IF v_quantity = 0 THEN
      DELETE FROM cellar_wines WHERE id = v_cellar_wine_id;
      v_deleted := true;
    END IF;
  END IF;

  RETURN QUERY SELECT v_completed, v_deleted;
END;
$$;
