# Supabase から Neon への移行手順

## 1. Supabase を再開する

Supabase Dashboard で `wine-cellar` の `Resume project` を押して、プロジェクトを再開します。

## 2. Supabase からデータを書き出す

Supabase SQL Editor で `supabase/export_for_neon.sql` を実行します。
結果の `export_json` をJSONファイルとして保存します。

例:

```text
/Users/kentaroono/wine-cellar/supabase-export.json
```

## 3. Neon を用意する

NeonでPostgresプロジェクトを作成し、接続文字列を `DATABASE_URL` として設定します。
Vercelにも同じ `DATABASE_URL` を Production / Preview / Development に設定します。

追加で、本番環境には `AUTH_SECRET` も設定します。

## 4. Neon にスキーマを作る

```bash
DATABASE_URL="Neonの接続文字列" npm run db:schema
```

## 5. Supabase のデータを取り込む

```bash
DATABASE_URL="Neonの接続文字列" npm run db:import:supabase -- /Users/kentaroono/wine-cellar/supabase-export.json
```

## 6. 2人分のログインを設定する

移行直後、旧SupabaseユーザーはNeon側に移っていますが、パスワードは未設定です。
あなたと奥さまは、アプリの「新規登録」からそれぞれ以前と同じメールアドレスで登録してください。
その時点で、既存データに新しいパスワードが紐づきます。

既にパスワード設定済みのメールアドレスでは、再登録できません。
