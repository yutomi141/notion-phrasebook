import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ExtractedPhrase {
  phrase: string;
  meaning: string;
  example: string | null;
  tags: string[];
}

const SYSTEM_PROMPT = `あなたは英語学習支援アシスタントです。
英会話テキストから学習価値の高いフレーズを抽出し、必ずJSON配列のみを返してください。
説明文・前置き・マークダウンコードブロック記号は一切不要です。`;

const USER_PROMPT_TEMPLATE = (text: string) => `以下の英会話テキストから、学習に値する英語表現・フレーズを抽出してください。

抽出基準：
- ネイティブがよく使う自然な表現・イディオム・口語フレーズ
- 汎用性が高く、他の場面でも使える表現
- 2語以上のフレーズが望ましい

除外：
- 固有名詞（人名・地名）
- 極めて基礎的な表現（how are you, thank you など）
- 文脈に強く依存して単独では意味が伝わらないもの

JSON配列の形式で返してください（余計なテキスト不要）：
[
  {
    "phrase": "英語表現（原形・自然な形）",
    "meaning": "日本語での意味・使い方（1〜2文）",
    "example": "テキスト内の用例（なければnull）",
    "tags": ["Business", "Casual", "Idiom" などから該当するもの。なければ空配列]
  }
]

テキスト：
${text}`;

const MAX_PHRASE_LENGTH = 120;
const MAX_MEANING_LENGTH = 300;
const MAX_EXAMPLE_LENGTH = 500;
const MAX_RESULTS = 50;

export async function extractPhrasesFromText(text: string): Promise<ExtractedPhrase[]> {
  const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: USER_PROMPT_TEMPLATE(text) }],
  });

  const message = await stream.finalMessage();
  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') return [];

  const raw = textBlock.text.trim();
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    const parsed = JSON.parse(jsonStr) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null,
      )
      .filter((item) => {
        const phrase = item.phrase;
        const meaning = item.meaning;
        return (
          typeof phrase === 'string' &&
          phrase.trim().length > 0 &&
          phrase.length <= MAX_PHRASE_LENGTH &&
          typeof meaning === 'string' &&
          meaning.trim().length > 0 &&
          meaning.length <= MAX_MEANING_LENGTH
        );
      })
      .slice(0, MAX_RESULTS)
      .map((item) => ({
        phrase: (item.phrase as string).trim(),
        meaning: (item.meaning as string).trim(),
        example:
          typeof item.example === 'string' && item.example.trim().length > 0
            ? item.example.trim().slice(0, MAX_EXAMPLE_LENGTH)
            : null,
        tags: Array.isArray(item.tags)
          ? (item.tags as unknown[])
              .filter((t): t is string => typeof t === 'string')
              .slice(0, 5)
          : [],
      }));
  } catch {
    return [];
  }
}
