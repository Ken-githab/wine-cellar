# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # 開発サーバー起動 (http://localhost:3000)
npm run build    # プロダクションビルド
npm run lint     # ESLint チェック
```

## Architecture

Next.js 16 App Router + Tailwind CSS v4 のシングルページアプリ。データは `localStorage` に JSON で保存する（サーバー不要）。

### ディレクトリ構成

```
app/
  types/wine.ts       # Wine, TastingNote, WineFormData の型定義
  hooks/useWines.ts   # localStorage CRUD ロジック（addWine / updateWine / deleteWine）
  components/
    WineForm.tsx      # ワイン追加・編集フォーム
    WineCard.tsx      # ワイン一覧カード
    StarRating.tsx    # 星評価 UI（readonly / interactive 両対応）
    Modal.tsx         # モーダルラッパー（ESC キー・背景クリックで閉じる）
  page.tsx            # メインページ（状態管理・検索・ソート）
  layout.tsx          # HTML ルート・メタデータ
```

### データフロー

- `useWines` フックが `wines` 配列と CRUD 関数を公開
- `page.tsx` が唯一のステート保持コンポーネント（追加・編集モーダルの開閉、検索・ソート状態）
- フォームはモーダル内に表示し、送信後にモーダルを閉じる

### 主な型

```ts
interface Wine {
  id: string;
  name: string;
  producer: string;
  vintage: number | "";
  region: string;
  grapeVariety: string;
  useCoravin: boolean;
  tastingNote: { rating: number; memo: string; date: string };
  createdAt: string;
  updatedAt: string;
}
```
