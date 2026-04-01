-- vintageカラムを integer から text に変更するマイグレーション
-- Supabase ダッシュボード > SQL Editor で実行してください

alter table public.wines
  alter column vintage type text using vintage::text;
