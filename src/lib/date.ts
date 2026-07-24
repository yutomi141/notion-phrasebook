import 'server-only';

const TZ = 'Asia/Tokyo';

/** Asia/Tokyo 基準の YYYY-MM-DD 文字列を返す */
export function todayJST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** 指定日に days 日加算した Asia/Tokyo 基準の YYYY-MM-DD を返す */
export function addDaysJST(date: Date, days: number): string {
  const next = new Date(date.getTime() + days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(next);
}
