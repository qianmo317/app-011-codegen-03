/** YYYY-MM-DD 转 Date（按当地时区的零点） */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Date 转 YYYY-MM-DD（按当地时区） */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 今天的 YYYY-MM-DD */
export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(iso: string, delta: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

/**
 * 两个 ISO 日期相差几天：b - a。
 * 统一走 UTC 年月日换算，避免本地时区/夏令时把天数算偏。
 */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ua = Date.UTC(ay, am - 1, ad);
  const ub = Date.UTC(by, bm - 1, bd);
  return Math.round((ub - ua) / 86400000);
}

export const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'];

export function weekdayCN(iso: string): string {
  return '周' + WEEKDAY_CN[parseDate(iso).getDay()];
}

/** 2026-09-20 -> 9月20日 周一 */
export function formatDateCN(iso: string): string {
  const d = parseDate(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdayCN(iso)}`;
}

/** 2026-09-20 -> 2026年9月20日 */
export function formatDateFullCN(iso: string): string {
  const d = parseDate(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 该日期所在 ISO 周（周一为一周开始）的周一日期，YYYY-MM-DD */
export function weekKey(iso: string): string {
  const d = parseDate(iso);
  const dow = (d.getDay() + 6) % 7; // 周一=0 ... 周日=6
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

/** ISO 周序号（年内第几周，ISO-8601） */
export function isoWeekNumber(iso: string): number {
  const d = parseDate(iso);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 4 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  return 1 + Math.round((thursday.getTime() - yearStart.getTime()) / 86400000 / 7);
}

/** 周标签：2026 第38周（9/14 - 9/20） */
export function weekLabel(mondayISO: string): string {
  const sundayISO = addDaysISO(mondayISO, 6);
  const s = parseDate(mondayISO);
  const e = parseDate(sundayISO);
  const range =
    s.getMonth() === e.getMonth()
      ? `${s.getMonth() + 1}/${s.getDate()} - ${e.getMonth() + 1}/${e.getDate()}`
      : `${s.getMonth() + 1}/${s.getDate()} - ${e.getMonth() + 1}/${e.getDate()}`;
  return `${s.getFullYear()} 第${isoWeekNumber(mondayISO)}周（${range}）`;
}

/** 两个 ISO 日期之间（含两端）的日期列表 */
export function eachDayBetween(startISO: string, endISO: string): string[] {
  const n = diffDays(startISO, endISO);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDaysISO(startISO, i));
}
