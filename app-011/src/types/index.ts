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
  siteLogs: SiteLogData;
}

/* ============ 施工日志 ============ */

/** 工序分类（一道活归到哪一类工序上） */
export interface WorkKind {
  id: string;
  name: string;
  /** 所属施工阶段 id */
  phaseId: string;
}

/** 施工阶段 */
export interface Phase {
  id: string;
  name: string;
  order: number;
  /** 原定开始日期 YYYY-MM-DD */
  startDate?: string;
  /** 原定天数（日历天） */
  plannedDays?: number;
}

/** 工人 */
export interface Worker {
  id: string;
  name: string;
  /** 工种，可选 */
  trade?: string;
}

/** 日志里干的一道活；kindId 为 null（或对应工序已删除）表示待认领 */
export interface LogItem {
  id: string;
  text: string;
  kindId: string | null;
}

export interface LogPhoto {
  id: string;
  /** 压缩后的 dataURL，直接存本地 */
  dataUrl: string;
  caption: string;
}

/** 更正说明：日志日期不可改，要补/要改只能追加一条 */
export interface LogCorrection {
  id: string;
  createdAt: number;
  text: string;
}

/** 一条施工日志 = 某个房间某天的一段施工记录 */
export interface SiteLog {
  id: string;
  /** YYYY-MM-DD，保存后不可修改 */
  date: string;
  roomId: string | null;
  /** 房间手填名（现场叫法/房间还没画进方案时使用） */
  roomName: string;
  /** 同房间同一天的第几段 */
  segment: number;
  workerIds: string[];
  /** 到场但不在名册里的临时工人数 */
  extraWorkers: number;
  workDone: LogItem[];
  /** 碰到的问题 */
  issue: string;
  photos: LogPhoto[];
  corrections: LogCorrection[];
  createdAt: number;
  updatedAt: number;
}

export interface SiteLogData {
  workers: Worker[];
  phases: Phase[];
  workKinds: WorkKind[];
  logs: SiteLog[];
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
