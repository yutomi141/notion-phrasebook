# notion-phrasebook

## Project Overview

Notionをデータ正本とする自分専用の英語フラッシュカードPWA。
英会話から抽出したフレーズと紹介スクリプトをスマートフォンで反復学習する。

---

## Source of Truth

**要件の正本はNotionの以下のページ。**
実装を開始する前に必ずNotion MCPで読み込み、最新状態を確認する。

- **要件定義**：English Flashcards App｜要件定義（IDは `.env` の `NOTION_REQUIREMENTS_PAGE_ID` を参照）
- **Phrase DB**（IDは `NOTION_PHRASE_DB_ID`）
- **Script Library**（IDは `NOTION_SCRIPT_LIBRARY_DB_ID`）
- **Script Sentences DB**（IDは `NOTION_SCRIPT_SENTENCES_DB_ID`）
- **Review Log DB**（IDは `NOTION_REVIEW_LOG_DB_ID`）

コード上の仮定とNotionの要件が矛盾する場合は、Notionの要件を優先する。

---

## Working Principles

- **人間の必須操作は「英会話」「学習開始」「覚えた／忘れた」の3つだけ。**
  分類・DB登録・同期・復習計算・ステータス変更はシステムが担当する。
- 技術設定やDB手編集を日常的に要求しない
- 安全な推奨デフォルトを採用し、細かな技術選定の質問はしない
- 不可逆操作・履歴消失・権限付与が発生する場合だけ確認する
- 実装前の技術選定は要件に適した構成を自律的に選択する

---

## Notion Rules

- 実装前に `notion-fetch` でPhrase DBとScript LibraryのスキーマをNotion MCPで取得する
- Notion DBを学習データの正本とする
- 既存DBのスキーマ拡張・編集は許可されている
- 既存の行データと学習履歴は保持する（変更前に安全な移行手順を確認する）
- プロパティ名やDB IDをコード中に直書きせず、`src/lib/schema/notion-ids.ts` に集約する
- 同じ処理を複数回実行しても重複しない（冪等性を保つ）
- 不可逆な削除・履歴消失の可能性があるときだけ確認を求める

---

## Security

- **NotionのAPIトークンはNext.js API Routesのサーバー側のみで使用する。ブラウザへ公開しない。**
- シークレット（`.env`）をGitリポジトリにコミットしない
- 会話全文・アクセストークンをログへ出力しない
- Notionへの書き込みはすべてAPIルート（`/api/`）経由で行う
- クライアントコードで `process.env.NOTION_TOKEN` を参照しない

---

## UI Principles

**ビジュアルコンセプト：calm / editorial / focused / warm / trustworthy**

### 禁止表現
- 紫〜青のグラデーション、ネオン、発光、Glassmorphism、スパークル
- ロボット・脳・魔法の杖などAIを連想させる装飾
- 過剰な角丸・影・アニメーション

### カラーパレット（厳守）

| 役割 | ライト | ダーク |
|---|---|---|
| Canvas | `#FFFFFF` | `#191919` |
| Surface | `#F9F8F7` | `#202020` |
| Secondary Surface | `#F0EFED` | `#383836` |
| Primary Text | `#2C2C2B` | `#FFFFFF` |
| Secondary Text | `#7D7A75` | `rgba(255,255,255,.65)` |
| Border | `#E6E5E3` | `rgba(255,255,255,.20)` |
| Primary Blue | `#2783DE` | `#5E9FE8` |
| Remembered (緑) | `#46A171` | `#72BC8F` |
| Attention (橙) | `#D5803B` | `#DE9255` |
| Forgotten/Error (赤) | `#E56458` | `#E97366` |

### タイポグラフィ
- UI本文：`Inter, "Noto Sans JP", system-ui, sans-serif`
- カード英語：`"Source Serif 4", Georgia, serif`
- フォントファミリーは最大2種類。装飾フォント禁止
- 本文16px/1.5以上、補助テキスト14px未満禁止
- カードの英語表現28〜36px

### レイアウト
- 基準幅：スマートフォン390px。横スクロール禁止
- 余白スケール：4, 8, 12, 16, 24, 32, 48, 64px
- 左右余白：16〜24px
- タップ領域：最低44×44px
- 主要操作は画面下部へ配置（親指が届く範囲）
- `prefers-color-scheme` に追従（手動切替は任意）

### アクセシビリティ
- WCAG AA コントラスト比4.5:1以上（通常テキスト）
- キーボード操作・明確なフォーカス表示・スクリーンリーダーラベルを提供
- `prefers-reduced-motion` を尊重
- 状態は色だけで表さず、ラベル・アイコン・形状を併用

---

## Development Workflow

1. Notion MCPで要件定義ページとDBスキーマを確認する（`notion-fetch`）
2. `docs/implementation-plan.md` に実装計画を記録する
3. 小さな単位で実装し、各フェーズの完了条件を満たしてから次へ進む
4. 変更後は品質チェックを実行する（下記）
5. 意味のある単位でGit commitする

---

## Quality Requirements

実装・変更後は必ず以下をすべて通過させる。失敗を無視して完了扱いにしない。

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

加えて、主要画面を390px幅で目視確認する。
- 重なり・はみ出し・狭すぎる余白・読めないコントラストがないこと
- ライト・ダーク両モードで確認する

---

## Confirmation Criteria

以下の場合のみユーザーに確認を求める。それ以外は自律的に進める。

- Notionの再認証・権限付与が必要
- 同一Phraseで意味が明確に衝突する
- Script本文を安全に解析できない
- 自動移行では既存学習履歴が失われる可能性がある
- データの物理削除など不可逆操作を実行する

---

## Directory Overview

```
src/
├── app/
│   ├── api/           # サーバー側のみ。Notionトークンはここで使う
│   ├── (study)/       # 学習画面群
│   ├── list/          # 一覧・検索
│   └── settings/      # 設定
├── components/        # UIコンポーネント
├── lib/
│   ├── notion/        # Notion SDK wrapper（server-only）
│   ├── srs/           # 間隔反復アルゴリズム
│   ├── sync/          # 同期ロジック
│   └── schema/        # DB ID・プロパティ名の定数（1ファイルに集約）
├── hooks/             # React hooks
└── types/             # TypeScript型定義
docs/
├── implementation-plan.md
└── notion-schema.md
```
