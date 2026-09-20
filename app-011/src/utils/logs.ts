import type { WorkLog, Stage, WorkCategory, StageDayDiff } from '../types';
import { WORK_CATEGORY_ORDER } from '../types';

/** 取本地时区的 YYYY-MM-DD（避免 UTC toISOString 差一天） */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 区间（含首尾）的日期字符串 */
export function enumerateDays(start: string, end: string): string[] {
  if (!start || !end || start > end) return [];
  const out: string[] = [];
  const a = new Date(start + 'T00:00:00');
  const b = new Date(end + 'T00:00:00');
  for (let t = a.getTime(); t <= b.getTime(); t += DAY_MS) {
    out.push(toDateStr(new Date(t)));
  }
  return out;
}

/** 原定天数（含首尾） */
export function plannedDays(stage: Stage): number {
  if (!stage.startDate || !stage.endDate || stage.startDate > stage.endDate) return 0;
  return enumerateDays(stage.startDate, stage.endDate).length;
}

export function diffDays(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / DAY_MS
  );
}

/** ISO 周编号：返回该日期所在周的周一日期（作为周键） */
export function weekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7; // 周一=0
  d.setDate(d.getDate() - dow);
  return toDateStr(d);
}

/** 周日（周末） */
export function weekEndKey(monday: string): string {
  const d = new Date(monday + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return toDateStr(d);
}

export function formatWeek(monday: string): string {
  return `${monday} ~ ${weekEndKey(monday)}`;
}

/** 某天的日志里是否有归到某工序的活 */
function dayHasCategory(logs: WorkLog[], date: string, category: WorkCategory): boolean {
  return logs.some(
    (l) => l.date === date && l.items.some((it) => it.category === category)
  );
}

/**
 * 按施工阶段汇总：
 * - 实际用掉几天 = 有该阶段工序日志的不同日期数
 * - 差在哪几天 = 计划内没干活的日子 + 计划外却干活的日子
 */
export function summarizeStage(logs: WorkLog[], stage: Stage): StageDayDiff {
  const actualDays = Array.from(
    new Set(
      logs
        .filter((l) => l.items.some((it) => it.category === stage.category))
        .map((l) => l.date)
    )
  ).sort();

  const plannedRange = enumerateDays(stage.startDate, stage.endDate);
  const plannedSet = new Set(plannedRange);

  const plannedIdleDays = plannedRange.filter((d) => !dayHasCategory(logs, d, stage.category));
  const overrunDays = actualDays.filter((d) => !plannedSet.has(d));

  return { plannedIdleDays, overrunDays, actualDays };
}

export interface WeekSummary {
  week: string;
  monday: string;
  days: number;             // 有日志的天数
  logs: number;             // 日志条数（段数）
  workerCount: number;      // 合计到场人次
  categories: WorkCategory[]; // 本周涉及工序
  problems: number;         // 记了问题的条数
}

/** 按周汇总（按周一倒序） */
export function summarizeByWeek(logs: WorkLog[]): WeekSummary[] {
  const map = new Map<string, WorkLog[]>();
  for (const l of logs) {
    const w = weekKey(l.date);
    const arr = map.get(w) ?? [];
    arr.push(l);
    map.set(w, arr);
  }
  return Array.from(map.entries())
    .map(([monday, ls]) => {
      const cats = new Set<WorkCategory>();
      let problems = 0;
      for (const l of ls) {
        for (const it of l.items) if (it.category) cats.add(it.category);
        if (l.problems.trim()) problems += 1;
      }
      return {
        week: formatWeek(monday),
        monday,
        days: new Set(ls.map((l) => l.date)).size,
        logs: ls.length,
        workerCount: ls.reduce((s, l) => s + (l.workerCount || 0), 0),
        categories: WORK_CATEGORY_ORDER.filter((c) => cats.has(c)),
        problems,
      };
    })
    .sort((a, b) => (a.monday < b.monday ? 1 : -1));
}

/** 从全部日志里提取工人名单（按首次出现排序） */
export function collectWorkers(logs: WorkLog[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of logs) {
    for (const n of l.workerNames) {
      const name = n.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    }
  }
  return out;
}

/**
 * 日志排序：日期倒序；同一天先按房间名再按段号倒序。
 * roomName 由调用方传入（房间可能已被删除）。
 */
export function sortLogsDesc(
  logs: WorkLog[],
  roomNameOf: (id: string) => string
): WorkLog[] {
  return [...logs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const ra = roomNameOf(a.roomId);
    const rb = roomNameOf(b.roomId);
    if (ra !== rb) return ra < rb ? 1 : -1;
    return b.segment - a.segment;
  });
}
