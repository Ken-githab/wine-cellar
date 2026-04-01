-- スキーマ修正マイグレーション
-- Supabase ダッシュボード > SQL Editor で実行してください

-- 1. price・url 列を追加（なければ）
alter table public.wines
  add column if not exists price text,
  add column if not exists url   text;

-- 2. vintage を text に変更（まだ integer のままなら）
alter table public.wines
  alter column vintage type text using vintage::text;

-- 3. UPDATE ポリシーに with check を追加（0件更新の防止）
drop policy if exists "Users can update their own wines" on public.wines;
create policy "Users can update their own wines"
  on public.wines for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
