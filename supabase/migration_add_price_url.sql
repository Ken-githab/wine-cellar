-- 価格・URL カラムを追加するマイグレーション
-- Supabase ダッシュボード > SQL Editor で実行してください

alter table public.wines
  add column if not exists price text not null default '',
  add column if not exists url   text not null default '';
