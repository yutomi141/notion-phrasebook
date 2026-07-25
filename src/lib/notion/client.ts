import 'server-only';
import { Client } from '@notionhq/client';

const REQUIRED_ENV_VARS = [
  'NOTION_TOKEN',
  'NOTION_PHRASE_DB_ID',
  'NOTION_SCRIPT_LIBRARY_DB_ID',
  'NOTION_SCRIPT_SENTENCES_DB_ID',
  'NOTION_REVIEW_LOG_DB_ID',
] as const;

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  timeoutMs: 30_000,
});
