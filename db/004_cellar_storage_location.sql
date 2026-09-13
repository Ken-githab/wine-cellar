-- 既存の在庫はすべて自宅セラー。購入元・本数・家族共有には変更を加えない。
-- 新しい保存処理をデプロイする前に適用する。
alter table cellar_wines
  add column if not exists storage_location text not null default 'home'
    constraint cellar_wines_storage_location_check check (storage_location in ('home', 'enoteca'));
