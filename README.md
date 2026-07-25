# notion-phrasebook

自分専用の英語フラッシュカードPWA。Notionをデータ正本とし、英会話から抽出したフレーズとスクリプトをスマートフォンで反復学習する。

## 概要

- **データ正本**：Notion（Phrase DB / Script Library）
- **学習方式**：フラッシュカード（英→日 / 日→英）＋ Script全文・1文モード
- **評価方式**：「覚えた」「忘れた」の2段階＋間隔反復（SM-2ベース）
- **形態**：スマートフォン対応PWA（390px基準）
- **人間の必須操作**：英会話・学習開始・「覚えた／忘れた」の3つだけ

詳細な要件は Notion の「English Flashcards App｜要件定義」が正本。

## 技術スタック

| 分類 | 技術 |
|---|---|
| フレームワーク | Next.js 16.2 (App Router) |
| 言語 | TypeScript 5 |
| スタイリング | Tailwind CSS 4 |
| フォント | next/font/google (Inter, Source Serif 4, Noto Sans JP) |
| データフェッチ | TanStack Query v5 |
| PWA | 手製 Service Worker (`public/sw.js`) |
| 認証 | Auth.js v5 (NextAuth) + Google OAuth |
| テスト | Vitest |
| Notion | @notionhq/client（サーバー側のみ） |

## ローカル開発環境のセットアップ

### 前提条件

- Node.js 20 LTS / npm 10
- Notionインテグレーションが作成済みで、Phrase DB・Script Library・Script Sentences DB・Review Log DBへのアクセス権がある
- Googleアカウント（OAuth認証用）

### 手順

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd notion-phrasebook

# 2. 依存パッケージをインストール
npm ci

# 3. 環境変数を設定
cp .env.example .env
# .env を編集し、下記の必須変数を設定する

# 4. 開発サーバーを起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

### 環境変数

`.env.example` をコピーして値を設定する。

| 変数 | 必須 | 説明 |
|---|---|---|
| `NOTION_TOKEN` | ✅ | Notionインテグレーショントークン |
| `NOTION_PHRASE_DB_ID` | ✅ | Phrase DBのID |
| `NOTION_SCRIPT_LIBRARY_DB_ID` | ✅ | Script LibraryのID |
| `NOTION_SCRIPT_SENTENCES_DB_ID` | ✅ | Script Sentences DBのID |
| `NOTION_REVIEW_LOG_DB_ID` | ✅ | Review Log DBのID |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 32` で生成 |
| `AUTH_ALLOWED_EMAIL` | ✅ | アクセスを許可するGmailアドレス |
| `AUTH_GOOGLE_ID` | ✅ | Google OAuth クライアントID |
| `AUTH_GOOGLE_SECRET` | ✅ | Google OAuth クライアントシークレット |
| `NEXTAUTH_URL` | ✅ | 本番URL（ローカルは `http://localhost:3000`） |
| `SRS_*` | — | 間隔反復アルゴリズム設定（省略時はデフォルト値） |
| `NOTION_REQUIREMENTS_PAGE_ID` | — | Claude Code開発時のみ使用（アプリ本体は参照しない） |

## コマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
npm run start        # プロダクションサーバー起動
npm run lint         # ESLintチェック
npm run typecheck    # TypeScriptの型チェック
npm run test         # Vitestでユニットテスト実行
```

## 主要機能

| 機能 | パス |
|---|---|
| フレーズ学習（SRS） | `/phrase` |
| スクリプト一覧 | `/script` |
| スクリプト全文表示 | `/script/[id]` |
| 1文ずつ学習 | `/script/sentence` |

### スクリプト同期

Script Library の Notion ページ本文からSentence DBへ文を取り込む際は、  
スクリプト詳細ページ (`/script/[id]`) の「同期」ボタン、または以下の API を使用する：

```
POST /api/scripts/{id}/sync
```

## ドキュメント

- `docs/implementation-plan.md` — 技術構成・DB設計・実装順序
- `docs/notion-schema.md` — NotionのBefore/Afterスキーマ詳細
- `docs/notion-phrasebook-audit.md` — 外部監査レポート（2026-07-24）

## セキュリティ

- NotionトークンはサーバーAPI Routesでのみ使用し、ブラウザに公開しない
- `.env` はGitにコミットしない（`.gitignore` で除外済み）
- アクセスはGoogleログイン＋メールアドレス制限で本人のみに限定する
- Proxyは Auth.js の `auth()` で JWT 検証済みセッションを確認する
- 書き込み API は全件セッション再検証する

## フェーズ進捗

- [x] フェーズ1：データ契約の確定（DBスキーマ拡張・新規DB作成）
- [x] フェーズ2：オンラインMVP（フレーズ学習）
- [x] フェーズ3：Script対応（全文・1文モード）
- [x] フェーズ4：品質向上（監査修正・冪等性・セキュリティ）
- [ ] フェーズ5：検索・統計・テスト拡充
- [ ] フェーズ6：オフライン対応（回答キュー・完全キャッシュ）
