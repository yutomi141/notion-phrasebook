# notion-phrasebook

Notionをデータ正本とする自分専用の英語フラッシュカードPWA。  
英会話から抽出したフレーズとスクリプトをスマートフォンで反復学習する。

---

## 概要

- **データ正本**：Notion（Phrase DB / Script Library）
- **学習方式**：フラッシュカード（英→日 / 日→英）＋ Script全文・1文モード
- **評価方式**：「覚えた」「忘れた」の2段階＋間隔反復（SM-2ベース）
- **形態**：スマートフォン対応PWA（390px基準）
- **人間の必須操作**：英会話・学習開始・「覚えた／忘れた」の3つだけ

---

## 技術スタック

| 分類 | 技術 |
|---|---|
| フレームワーク | Next.js（App Router） |
| 言語 | TypeScript 5 |
| スタイリング | Tailwind CSS 4 |
| データフェッチ | TanStack Query v5 |
| PWA | Service Worker |
| 認証 | Auth.js v5（NextAuth）+ Google OAuth |
| テスト | Vitest |
| Notion | @notionhq/client（サーバー側のみ） |

---

## セットアップ手順

### 1. Notionインテグレーションを作成する

1. [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations) を開く
2. **「+ New integration」** をクリック
3. 以下を設定して「Submit」
   - **Name**：任意（例：`flashcard-app`）
   - **Associated workspace**：自分のワークスペース
   - **Type**：Internal
4. 作成後に表示される **「Internal Integration Secret」**（`secret_xxx...`）をコピーして控える
   → `.env` の `NOTION_TOKEN` に設定する

---

### 2. Notionに4つのデータベースを作成する

以下の4つのデータベースが必要です。  
**プロパティ名は表の通りに設定してください**（大文字・小文字・スペース含め完全一致）。

---

#### 2-1. Phrase DB

フレーズを登録するメインのDB。

| プロパティ名 | 型 | 備考 |
|---|---|---|
| `Phrase` | **タイトル（デフォルト）** | 自動で作成済み。名前を変更しないこと |
| `Meaning` | テキスト | 日本語の意味 |
| `Example` | テキスト | 例文 |
| `Tags` | マルチセレクト | 任意のタグ |
| `ステータス` | ステータス | オプション名を **New / Reviewing / Mastered** に変更する |
| `Normalized Phrase` | テキスト | アプリが自動設定。手入力不要 |
| `Source Type` | セレクト | アプリが自動設定。手入力不要 |
| `Source Reference` | テキスト | アプリが自動設定。手入力不要 |
| `Last Reviewed` | 日付 | アプリが自動更新 |
| `Next Review` | 日付 | アプリが自動更新 |
| `Interval Days` | 数値 | アプリが自動更新 |
| `Correct Streak` | 数値 | アプリが自動更新 |
| `Review Count` | 数値 | アプリが自動更新 |
| `Forgotten Count` | 数値 | アプリが自動更新 |
| `Sync Version` | テキスト | アプリが自動更新 |

> **ステータスのオプション設定**：Notionのステータスプロパティはデフォルトで「To-do / In progress / Done」という名前になっています。これをそれぞれ **New / Reviewing / Mastered** に変更してください。

---

#### 2-2. Script Library

スクリプト（まとまった英文）を管理するDB。ページ本文に英文を書いておくと、アプリが1文ずつ分割してくれます。

| プロパティ名 | 型 | 備考 |
|---|---|---|
| `名前` | **タイトル（デフォルト）** | 自動で作成済み。名前を変更しないこと |
| `ステータス` | ステータス | オプション名を **Draft / Memorizing / Perfect** に変更する |
| `タグ` | マルチセレクト | 任意のタグ |
| `作成日時` | 作成日時 | 自動設定（読み取り専用） |
| `Last Reviewed` | 日付 | アプリが自動更新 |
| `Next Review` | 日付 | アプリが自動更新 |
| `Sentence Count` | 数値 | アプリが自動更新 |
| `Sync Version` | テキスト | アプリが自動更新 |

---

#### 2-3. Script Sentences DB

Script Library の各スクリプトを1文ずつ分割して格納するDB。**手動でデータを入れる必要はありません**。アプリの「同期」ボタンで自動生成されます。

| プロパティ名 | 型 | 備考 |
|---|---|---|
| `Sentence` | **タイトル（デフォルト）** | 自動で作成済み |
| `Meaning` | テキスト | アプリが自動設定 |
| `Script` | リレーション → Script Library | アプリが自動設定 |
| `Order` | 数値 | アプリが自動設定 |
| `Status` | ステータス | **オプション名を変更しないこと**。`Not started / In progress / Done` のまま使う |
| `Last Reviewed` | 日付 | アプリが自動更新 |
| `Next Review` | 日付 | アプリが自動更新 |
| `Interval Days` | 数値 | アプリが自動更新 |
| `Correct Streak` | 数値 | アプリが自動更新 |
| `Review Count` | 数値 | アプリが自動更新 |
| `Forgotten Count` | 数値 | アプリが自動更新 |

> **Script Sentences DB の Status はオプション名を変更しないでください。** Notionの制約により、アプリは `Not started / In progress / Done` というデフォルト名で動作します。

---

#### 2-4. Review Log DB

復習の記録を1行ずつ追記するDB。**手動操作は不要**。アプリが自動で書き込みます。

| プロパティ名 | 型 | 備考 |
|---|---|---|
| `Log Entry` | **タイトル（デフォルト）** | 自動で作成済み |
| `Reviewed At` | 日付 | アプリが自動設定 |
| `Item Type` | セレクト | アプリが自動設定 |
| `Phrase` | リレーション → Phrase DB | アプリが自動設定 |
| `Script Sentence` | リレーション → Script Sentences DB | アプリが自動設定 |
| `Result` | セレクト | アプリが自動設定 |
| `Direction` | セレクト | アプリが自動設定 |
| `Previous Interval` | 数値 | アプリが自動設定 |
| `Next Interval` | 数値 | アプリが自動設定 |
| `Session ID` | テキスト | アプリが自動設定 |

---

### 3. インテグレーションをDBに接続する

4つのDB **それぞれ**で以下の操作が必要です（1つでも抜けるとAPIエラーになります）。

1. NotionでデータベースページのURLを開く
2. 右上の「**・・・**」（三点メニュー）→「**コネクト**」→「**コネクトを追加する**」
3. 手順1で作成したインテグレーション名を選択して接続する

---

### 4. DB IDを取得する

各DBのIDは **NotionページのURL** から取得します。

```
https://www.notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                       この32文字がDB ID（ハイフンなし）
```

またはハイフン区切りの場合：

```
https://www.notion.so/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx?v=...
```

取得した4つのIDを `.env` の対応する変数に設定します。

---

### 5. Google OAuthを設定する

1. [Google Cloud Console](https://console.cloud.google.com/) を開く
2. プロジェクトを作成（または既存を選択）
3. 左メニュー「**APIとサービス**」→「**OAuth同意画面**」を開いて設定する
   - User Type：**外部**
   - スコープ：`email` と `profile` のみ追加
   - テストユーザー：自分のGmailアドレスを追加
4. 左メニュー「**認証情報**」→「**+ 認証情報を作成**」→「**OAuthクライアントID**」
5. アプリケーションの種類：「**ウェブアプリケーション**」
6. 承認済みリダイレクトURIに以下を追加：
   - ローカル用：`http://localhost:3000/api/auth/callback/google`
   - 本番用（Vercelなど）：`https://your-domain.vercel.app/api/auth/callback/google`
7. 作成後に表示される **クライアントID** と **クライアントシークレット** を控える

---

### 6. ローカルで起動する

```bash
# リポジトリをクローン
git clone <repository-url>
cd notion-phrasebook

# 依存パッケージをインストール
npm ci

# 環境変数を設定
cp .env.example .env
# .env を編集して各変数を入力する

# 開発サーバーを起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

#### 環境変数一覧

| 変数 | 必須 | 説明 |
|---|---|---|
| `NOTION_TOKEN` | ✅ | 手順1で取得したインテグレーションシークレット |
| `NOTION_PHRASE_DB_ID` | ✅ | Phrase DBのID |
| `NOTION_SCRIPT_LIBRARY_DB_ID` | ✅ | Script LibraryのID |
| `NOTION_SCRIPT_SENTENCES_DB_ID` | ✅ | Script Sentences DBのID |
| `NOTION_REVIEW_LOG_DB_ID` | ✅ | Review Log DBのID |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 32` で生成するランダム文字列 |
| `AUTH_ALLOWED_EMAIL` | ✅ | アクセスを許可するGmailアドレス（自分のメール） |
| `AUTH_GOOGLE_ID` | ✅ | 手順5で取得したOAuthクライアントID |
| `AUTH_GOOGLE_SECRET` | ✅ | 手順5で取得したOAuthクライアントシークレット |
| `NEXTAUTH_URL` | ✅ | ローカルは `http://localhost:3000`、本番はデプロイURL |
| `SRS_INITIAL_INTERVAL_DAYS` | — | 初回正解後の復習間隔（デフォルト：1日） |
| `SRS_SECOND_INTERVAL_DAYS` | — | 2回目正解後の復習間隔（デフォルト：3日） |
| `SRS_EASE_FACTOR` | — | 間隔の伸び率（デフォルト：2.5） |
| `SRS_MAX_INTERVAL_DAYS` | — | 最大復習間隔（デフォルト：365日） |
| `SRS_MASTERED_STREAK` | — | Mastered判定に必要な連続正解数（デフォルト：3） |
| `SRS_MASTERED_INTERVAL_DAYS` | — | Mastered判定に必要な最低間隔（デフォルト：7日） |

---

### 7. Vercelにデプロイする（任意）

1. [Vercel](https://vercel.com/) にGitHubアカウントでログイン
2. 「**Add New Project**」→ このリポジトリをインポート
3. 「**Environment Variables**」に `.env` の全変数を入力する
   - `NEXTAUTH_URL` は本番URLに変更（例：`https://your-app.vercel.app`）
4. デプロイ完了後、Google Cloud ConsoleでリダイレクトURIに本番URLを追加する（手順5の続き）

---

## 主要機能

| 機能 | パス |
|---|---|
| フレーズ学習（SRS） | `/phrase` |
| スクリプト一覧 | `/script` |
| スクリプト全文表示 | `/script/[id]` |
| 1文ずつ学習 | `/script/sentence` |

### スクリプトの同期

Script Library のページ本文に英文を書いたあと、スクリプト詳細ページ（`/script/[id]`）の「同期」ボタンを押すと、1文ずつ Script Sentences DB に分割して取り込まれます。

---

## 開発コマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
npm run start        # プロダクションサーバー起動
npm run lint         # ESLintチェック
npm run typecheck    # TypeScriptの型チェック
npm run test         # ユニットテスト実行
```

---

## セキュリティ

- NotionトークンはサーバーAPI Routesでのみ使用し、ブラウザに公開しない
- `.env` はGitにコミットしない（`.gitignore` で除外済み）
- アクセスはGoogleログイン＋メールアドレス制限で本人のみに限定する

---

## ドキュメント

- `docs/notion-schema.md` — NotionのDBスキーマ詳細
- `docs/implementation-plan.md` — 技術構成・実装計画
