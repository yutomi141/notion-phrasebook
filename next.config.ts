import type { NextConfig } from "next";

const REQUIRED_ENV_VARS = [
  'NOTION_TOKEN',
  'NOTION_PHRASE_DB_ID',
  'NOTION_SCRIPT_LIBRARY_DB_ID',
  'NOTION_SCRIPT_SENTENCES_DB_ID',
  'NOTION_REVIEW_LOG_DB_ID',
  'AUTH_SECRET',
  'AUTH_ALLOWED_EMAIL',
  'AUTH_GOOGLE_ID',
  'AUTH_GOOGLE_SECRET',
] as const;

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
