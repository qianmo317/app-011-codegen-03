export interface Pt {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  polygon: Pt[];
  heightMm: number;
  floorMat: string;
  wallMat: string;
}

export type OpeningType = 'door' | 'window' | 'arch' | 'sliding';

export interface Opening {
  id: string;
  roomId: string;
  wallIndex: number;
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  type: OpeningType;
}

export type OutletKind = 'socket' | 'switch' | 'net' | 'light' | 'water';

export interface Outlet {
  id: string;
  wallKey: string;
  xMm: number;
  heightMm: number;
  kind: OutletKind;
  circuit?: string;
}

export type Unit = 'm2' | 'm' | 'kg' | 'roll' | 'pcs';

export interface MatSpec {
  id: string;
  name: string;
  unit: Unit;
  coverage?: number;
  lossRate: number;
  price: number;
}

export interface Plan {
  id: string;
  name: string;
  createdAt: number;
  rooms: Room[];
  openings: Opening[];
  outlets: Outlet[];
  materials: MatSpec[];
  workLogs?: WorkLog[];
  stages?: Stage[];
}

export interface WallSegment {
  roomId: string;
  index: number;
  p1: Pt;
  p2: Pt;
  lengthMm: number;
  angle: number;
}

export interface MaterialResult {
  matId: string;
  name: string;
  unit: Unit;
  quantity: number;
  totalPrice: number;
  details: string;
}

// ============ 施工日志 ============

/** 工序分类（活归到哪一类工序上） */
export type WorkCategory =
  | 'demolition'   // 拆改
  | 'waterElec'    // 水电
  | 'waterproof'   // 防水
  | 'tile'         // 泥瓦/贴砖
  | 'carpentry'    // 木工
  | 'paint'        // 油漆

  | 'install'      // 安装
  | 'cleanup';     // 收尾保洁

export const WORK_CATEGORY_LABELS: Record<WorkCategory, string> = {
  demolition: '拆改',
  waterElec: '水电',
  waterproof: '防水',
  tile: '泥瓦贴砖',
  carpentry: '木工',
  paint: '油漆墙面',
  install: '安装',
  cleanup: '收尾保洁',
};

export const WORK_CATEGORY_ORDER: WorkCategory[] = [
  'demolition',
  'waterElec',
  'waterproof',
  'tile',
  'carpentry',
  'paint',
  'install',
  'cleanup',
];

/** 日志里干的一道活 */
export interface WorkItem {
  id: string;
  /** 活的描述，如“主卧墙面第二遍腻子打磨” */
  content: string;
  /** 归类到的工序；null 表示归不上，等人认领 */
  category: WorkCategory | null;
}

/** 现场照片：dataURL 内嵌存储（无后端） */
export interface LogPhoto {
  id: string;
  dataUrl: string;
  /** 照片说明什么 */
  caption: string;
}

/** 一条施工日志（同一天同一房间可分几段，每段一条） */
export interface WorkLog {
  id: string;
  /** 本地日期 YYYY-MM-DD；保存后不许再改 */
  date: string;
  roomId: string;
  /** 同一天同一房间的第几段（1 起），创建时定死 */
  segment: number;
  items: WorkItem[];
  /** 到场几个人 */
  workerCount: number;
  /** 到场工人名单（用于按工人筛选） */
  workerNames: string[];
  /** 碰到什么问题 */
  problems: string;
  photos: LogPhoto[];
  /** 更正说明：只能追加，不能改正文历史 */
  corrections: Correction[];
  createdAt: number;
  updatedAt: number;
}

/** 更正说明（另加一条，不改原日志日期/内容） */
export interface Correction {
  id: string;
  text: string;
  createdAt: number;
}

/** 施工阶段（用于按阶段汇总：原定几天 vs 实际几天） */
export interface Stage {
  id: string;
  name: string;
  category: WorkCategory;
  /** 计划开工/收工（含首尾），YYYY-MM-DD */
  startDate: string;
  endDate: string;
}

export interface StageDayDiff {
  /** 计划内但当天没有该阶段工序的日志 */
  plannedIdleDays: string[];
  /** 计划外却有该阶段工序日志的日子 */
  overrunDays: string[];
  /** 实际有干活的日期 */
  actualDays: string[];
}
