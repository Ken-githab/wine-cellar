-- Supabase SQL Editorで実行し、結果のJSONを保存してください。
-- SupabaseプロジェクトをResumeした後に使います。

select jsonb_build_object(
  'users',
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'email', email
    ) order by email)
    from auth.users
  ), '[]'::jsonb),
  'wines',
  coalesce((
    select jsonb_agg(to_jsonb(w) order by w.created_at)
    from public.wines w
  ), '[]'::jsonb),
  'cellar_wines',
  coalesce((
    select jsonb_agg(to_jsonb(c) order by c.created_at)
    from public.cellar_wines c
  ), '[]'::jsonb)
) as export_json;
