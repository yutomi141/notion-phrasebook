import 'server-only';

export const NOTION_DB = {
  PHRASE:           process.env.NOTION_PHRASE_DB_ID!,
  SCRIPT_LIBRARY:   process.env.NOTION_SCRIPT_LIBRARY_DB_ID!,
  SCRIPT_SENTENCES: process.env.NOTION_SCRIPT_SENTENCES_DB_ID!,
  REVIEW_LOG:       process.env.NOTION_REVIEW_LOG_DB_ID!,
} as const;

/**
 * カードソース（Phrase DB / Reading Vocab DB）共通のプロパティ名。
 * 実行時は card-source-schema.ts が Notion のスキーマから実名を自動検出し、
 * 検出できなかった項目だけこの正準名にフォールバックする。
 */
export const PHRASE_PROPS = {
  PHRASE:            'Phrase',
  MEANING:           'Meaning',
  EXAMPLE:           'Example',
  TAGS:              'Tags',
  STATUS:            'ステータス',
  ACTIVITY_LOG:      'English Activity Log',
  DATE:              '日付',
  NORMALIZED_PHRASE: 'Normalized Phrase',
  SOURCE_TYPE:       'Source Type',
  SOURCE_REFERENCE:  'Source Reference',
  LAST_REVIEWED:     'Last Reviewed',
  NEXT_REVIEW:       'Next Review',
  INTERVAL_DAYS:     'Interval Days',
  CORRECT_STREAK:    'Correct Streak',
  REVIEW_COUNT:      'Review Count',
  FORGOTTEN_COUNT:   'Forgotten Count',
  SYNC_VERSION:      'Sync Version',
} as const;

export const SCRIPT_PROPS = {
  NAME:           '名前',
  STATUS:         'ステータス',
  TAGS:           'タグ',
  CREATED_AT:     '作成日時',
  LAST_REVIEWED:  'Last Reviewed',
  NEXT_REVIEW:    'Next Review',
  SENTENCE_COUNT: 'Sentence Count',
  SYNC_VERSION:   'Sync Version',
} as const;

export const SENTENCE_PROPS = {
  SENTENCE:       'Sentence',
  MEANING:        'Meaning',
  SCRIPT:         'Script',
  ORDER:          'Order',
  STATUS:         'Status',
  LAST_REVIEWED:  'Last Reviewed',
  NEXT_REVIEW:    'Next Review',
  INTERVAL_DAYS:  'Interval Days',
  CORRECT_STREAK: 'Correct Streak',
  REVIEW_COUNT:   'Review Count',
  FORGOTTEN_COUNT:'Forgotten Count',
  SYNC_VERSION:   'Sync Version',
} as const;

// Notion DDL の制約でデフォルト名になっているため定数でマッピング
export const SENTENCE_STATUS = {
  NEW:       'Not started',
  REVIEWING: 'In progress',
  MASTERED:  'Done',
} as const;

export const PHRASE_STATUS = {
  NEW:       'New',
  REVIEWING: 'Reviewing',
  MASTERED:  'Mastered',
} as const;

export const REVIEW_LOG_PROPS = {
  LOG_ENTRY:         'Log Entry',
  REVIEWED_AT:       'Reviewed At',
  ITEM_TYPE:         'Item Type',
  PHRASE:            'Phrase',
  READING_VOCAB:     'Reading Vocab',
  SCRIPT_SENTENCE:   'Script Sentence',
  RESULT:            'Result',
  DIRECTION:         'Direction',
  PREVIOUS_INTERVAL: 'Previous Interval',
  NEXT_INTERVAL:     'Next Interval',
  SESSION_ID:        'Session ID',
} as const;
