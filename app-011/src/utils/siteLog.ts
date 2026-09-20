import type {
  Phase,
  SiteLog,
  SiteLogData,
  WorkKind,
  Worker,
} from '../types';
import { addDaysISO, eachDayBetween, weekKey } from './date';

let seq = 0;
/** 稳定可读的 id：前缀 + 时间戳 + 自增序号 */
export function genId(prefix = ''): string {
  seq += 1;
  return prefix + Date.now().toString(36) + seq.toString(36);
}

/** 房间筛选/展示用的键：绑定了方案房间用房间 id，否则用手填名 */
export function roomKey(log: SiteLog): string {
  return log.roomId ? `id:${log.roomId}` : `name:${log.roomName}`;
}

export function roomLabel(log: SiteLog): string {
  return log.roomName || '（未填房间）';
}

export function attendance(log: SiteLog): number {
  return log.workerIds.length + (log.extraWorkers || 0);
}

/** 一条活是否归不上工序（没选，或所选工序已被删除） */
export function isUnclaimed(log: SiteLog, kinds: WorkKind[]): boolean {
  return log.workDone.some((it) => {
    if (!it.kindId) return true;
    return !kinds.some((k) => k.id === it.kindId);
  });
}

const DEFAULT_PHASES: Array<[string, number, number]> = [
  // [名称, 相对偏移基数仅作 id 稳定使用, order]
  ['拆改', 1, 1],
  ['水电', 2, 2],
  ['泥瓦', 3, 3],
  ['木作', 4, 4],
  ['油漆', 5, 5],
  ['安装', 6, 6],
  ['竣工收尾', 7, 7],
];

const DEFAULT_KINDS: Array<[string, number]> = [
  // [名称, 阶段序号（对应 DEFAULT_PHASES 的 order）]
  ['拆墙/铲皮', 1],
  ['砌墙/抹灰基层', 1],
  ['水电定位开槽', 2],
  ['布管穿线', 2],
  ['水路改造打压', 2],
  ['防水闭水试验', 3],
  ['贴砖', 3],
  ['找平', 3],
  ['吊顶/造型基层', 4],
  ['墙面刮腻子打磨', 5],
  ['刷漆/贴壁纸', 5],
  ['橱柜/洁具安装', 6],
  ['灯具/开关面板安装', 6],
  ['五金/收尾修补', 7],
  ['保洁验收', 7],
];

/** 新建方案时的默认施工阶段与工序目录 */
export function createDefaultSiteLogData(): SiteLogData {
  const phases: Phase[] = DEFAULT_PHASES.map(([name, base, order]) => ({
    id: `ph_${base}`,
    name,
    order,
  }));
  const workKinds: WorkKind[] = DEFAULT_KINDS.map(([name, phaseOrder], i) => ({
    id: `wk_${i + 1}`,
    name,
    phaseId: `ph_${phaseOrder}`,
  }));
  return { workers: [], phases, workKinds, logs: [] };
}

/** 兼容旧方案（没有日志字段时补齐） */
export function ensureSiteLogData(data: Partial<SiteLogData> | undefined): SiteLogData {
  const base = createDefaultSiteLogData();
  return {
    workers: data?.workers ?? [],
    phases: data?.phases?.length ? data.phases : base.phases,
    workKinds: data?.workKinds?.length ? data.workKinds : base.workKinds,
    logs: data?.logs ?? [],
  };
}

/* ---------------- 按周汇总 ---------------- */

export interface WeekStats {
  weekStart: string; // 周一
  logs: SiteLog[];
  entries: number; // 日志段数
  workDays: number; // 有施工记录的日期数
  rooms: number; // 涉及房间数
  attendanceTotal: number; // 总到场人次
  itemsTotal: number; // 完成的活条数
  photosTotal: number;
  issues: SiteLog[]; // 记了问题的日志
}

/** 按周一分组汇总，返回顺序按周倒序 */
export function summarizeByWeek(logs: SiteLog[]): WeekStats[] {
  const groups = new Map<string, SiteLog[]>();
  for (const log of logs) {
    const key = weekKey(log.date);
    const arr = groups.get(key);
    if (arr) arr.push(log);
    else groups.set(key, [log]);
  }
  return [...groups.entries()]
    .map(([weekStart, groupLogs]) => {
      const sorted = [...groupLogs].sort(sortLogs);
      return {
        weekStart,
        logs: sorted,
        entries: sorted.length,
        workDays: new Set(sorted.map((l) => l.date)).size,
        rooms: new Set(sorted.map(roomKey)).size,
        attendanceTotal: sorted.reduce((s, l) => s + attendance(l), 0),
        itemsTotal: sorted.reduce((s, l) => s + l.workDone.length, 0),
        photosTotal: sorted.reduce((s, l) => s + l.photos.length, 0),
        issues: sorted.filter((l) => l.issue.trim()),
      };
    })
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

/* ---------------- 按施工阶段汇总 ---------------- */

export interface PhaseStats {
  phase: Phase;
  /** 计划区间（含起止）；没设计划时为 null */
  planned: { start: string; end: string; plannedDays: number } | null;
  actualDates: string[]; // 实际有该阶段施工记录的日期（升序、去重）
  actualDays: number; // 实际用掉天数（有记录的日历天）
  firstDate?: string;
  lastDate?: string;
  idleDates: string[]; // 计划内但没干活的天（差在「空」上）
  overrunDates: string[]; // 计划区间外仍在干活的天（差在「拖/提前」上）
  itemsTotal: number;
}

function sortLogs(a: SiteLog, b: SiteLog): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.segment !== b.segment) return a.segment - b.segment;
  return a.createdAt - b.createdAt;
}

/**
 * 阶段实际天数 = 该阶段工序下出现施工记录的去重日历天。
 * 一条日志里多类工序混着干时，这些天会同时计入各自阶段。
 */
export function summarizeByPhase(data: SiteLogData): PhaseStats[] {
  const { phases, workKinds, logs } = data;

  return phases
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((phase) => {
      const dateSet = new Set<string>();
      let itemsTotal = 0;
      for (const log of logs) {
        const belongs = log.workDone.some((it) => {
          if (!it.kindId) return false;
          const kind = workKinds.find((k) => k.id === it.kindId);
          return kind?.phaseId === phase.id;
        });
        if (belongs) {
          dateSet.add(log.date);
          itemsTotal += log.workDone.filter((it) => {
            const kind = it.kindId ? workKinds.find((k) => k.id === it.kindId) : undefined;
            return kind?.phaseId === phase.id;
          }).length;
        }
      }
      const actualDates = [...dateSet].sort();

      const planned =
        phase.startDate && phase.plannedDays && phase.plannedDays > 0
          ? {
              start: phase.startDate,
              end: addDaysISO(phase.startDate, phase.plannedDays - 1),
              plannedDays: phase.plannedDays,
            }
          : null;

      let idleDates: string[] = [];
      let overrunDates: string[] = [];
      if (planned) {
        const plannedSet = new Set(eachDayBetween(planned.start, planned.end));
        idleDates = [...plannedSet].filter((d) => !dateSet.has(d)).sort();
        overrunDates = actualDates.filter((d) => !plannedSet.has(d));
      }

      return {
        phase,
        planned,
        actualDates,
        actualDays: actualDates.length,
        firstDate: actualDates[0],
        lastDate: actualDates[actualDates.length - 1],
        idleDates,
        overrunDates,
        itemsTotal,
      };
    });
}

/* ---------------- 工人选项辅助 ---------------- */

export function workerName(workerId: string, workers: Worker[]): string {
  return workers.find((w) => w.id === workerId)?.name ?? '已删除工人';
}

/** 某工人到场的日志段数 */
export function workerLogCount(workerId: string, logs: SiteLog[]): number {
  return logs.filter((l) => l.workerIds.includes(workerId)).length;
}
