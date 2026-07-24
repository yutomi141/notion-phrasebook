import { describe, it, expect } from 'vitest';
import { parseBlock, normalizeForDedup } from '@/lib/notion/script-parser';

describe('parseBlock — 正常系', () => {
  it('通常の 英文 (日本語訳)', () => {
    const r = parseBlock('I am a student. (私は学生です。)');
    expect(r.sentence).toBe('I am a student.');
    expect(r.meaning).toBe('私は学生です。');
  });

  it('全角括弧 英文 （日本語訳）', () => {
    const r = parseBlock('I love fencing. （フェンシングが大好きです。）');
    expect(r.sentence).toBe('I love fencing.');
    expect(r.meaning).toBe('フェンシングが大好きです。');
  });

  it('日本語訳内に全角括弧がある剣道文 — 内側括弧が保持される', () => {
    const r = parseBlock(
      'In Kendo, we call this "striking after the thought." ' +
        'You induce the opponent to move, create a gap in their defense, ' +
        'and strike at the exact moment they lose their balance. ' +
        '(剣道ではこれを「あとの先（相手を動かして打つ）」のように捉えます。' +
        '相手を誘い、防御の隙を作り、相手のバランスが崩れた瞬間に正確に打ち込みます。)',
    );
    expect(r.sentence).toContain('lose their balance.');
    expect(r.meaning).toContain('（相手を動かして打つ）');
    expect(r.meaning).not.toContain('(剣道では');
  });

  it('英文内に (LLMs) がある Self-Intro 文 — 英文側に保持される', () => {
    const r = parseBlock(
      'I work in AI at a start-up, with a focus on (LLMs). ' +
        '(スタートアップでAIの仕事をしており、主にLLMを扱っています。)',
    );
    expect(r.sentence).toContain('(LLMs)');
    expect(r.meaning).toBe('スタートアップでAIの仕事をしており、主にLLMを扱っています。');
  });

  it('対訳なし英文は meaning が空文字', () => {
    const r = parseBlock('Just an English sentence without translation.');
    expect(r.sentence).toBe('Just an English sentence without translation.');
    expect(r.meaning).toBe('');
  });

  it('空文字列は sentence・meaning ともに空', () => {
    const r = parseBlock('');
    expect(r.sentence).toBe('');
    expect(r.meaning).toBe('');
  });
});

describe('parseBlock — 見出し・スキップ対象', () => {
  it('見出し文字列はそのまま sentence として返す（型判定はDB側で行う）', () => {
    const r = parseBlock('フェンシングとの比較');
    expect(r.sentence).toBe('フェンシングとの比較');
    expect(r.meaning).toBe('');
  });
});

describe('normalizeForDedup', () => {
  it("opponent's と opponent’s（カーリークォート）が同一", () => {
    expect(normalizeForDedup("opponent's")).toBe(normalizeForDedup('opponent’s'));
  });

  it("it's と it’s が同一", () => {
    expect(normalizeForDedup("it's")).toBe(normalizeForDedup('it’s'));
  });

  it('太字由来の NBSP・余分空白を含む文が正規化される', () => {
    expect(normalizeForDedup('Hello world  test')).toBe('hello world test');
  });

  it('大文字小文字を統一', () => {
    expect(normalizeForDedup('Hello World')).toBe('hello world');
  });
});
