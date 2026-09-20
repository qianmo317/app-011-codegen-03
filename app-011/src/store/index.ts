import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Plan,
  Room,
  Opening,
  Outlet,
  MatSpec,
  SiteLog,
  SiteLogData,
  LogItem,
  LogCorrection,
  Worker,
  Phase,
  WorkKind,
} from '../types';
import { DEFAULT_MATS } from '../utils/materialCalc';
import {
  createDefaultSiteLogData,
  ensureSiteLogData,
  genId,
} from '../utils/siteLog';

export interface LogDraft {
  date: string;
  roomId: string | null;
  roomName: string;
  workerIds: string[];
  extraWorkers: number;
  workDone: LogItem[];
  issue: string;
  photos: SiteLog['photos'];
}

interface AppState {
  plans: Plan[];
  currentPlanId: string | null;
  scale: number;
  setScale: (s: number) => void;
  addPlan: (name: string) => string;
  deletePlan: (id: string) => void;
  getPlan: (id: string) => Plan | undefined;
  updatePlan: (id: string, updater: (plan: Plan) => Plan) => void;
  addRoom: (planId: string, room: Room) => void;
  updateRoom: (planId: string, roomId: string, updater: (room: Room) => Room) => void;
  deleteRoom: (planId: string, roomId: string) => void;
  addOpening: (planId: string, opening: Opening) => void;
  deleteOpening: (planId: string, openingId: string) => void;
  addOutlet: (planId: string, outlet: Outlet) => void;
  deleteOutlet: (planId: string, outletId: string) => void;
  updateMaterials: (planId: string, mats: MatSpec[]) => void;

  // ---- 施工日志 ----
  /** 新增日志；返回新日志 id，同房间同日段数冲突返回 null */
  addSiteLog: (planId: string, draft: LogDraft) => string | null;
  /** 编辑日志：刻意不接收 date，日期保存后不可改 */
  updateSiteLog: (planId: string, logId: string, draft: Omit<LogDraft, 'date'>) => void;
  deleteSiteLog: (planId: string, logId: string) => void;
  addCorrection: (planId: string, logId: string, text: string) => void;
  deleteCorrection: (planId: string, logId: string, correctionId: string) => void;
  assignWorkItem: (planId: string, logId: string, itemId: string, kindId: string | null) => void;

  addWorker: (planId: string, name: string, trade?: string) => string;
  updateWorker: (planId: string, workerId: string, patch: Partial<Worker>) => void;
  deleteWorker: (planId: string, workerId: string) => void;

  addPhase: (planId: string, name: string) => void;
  updatePhase: (planId: string, phaseId: string, patch: Partial<Phase>) => void;
  /** 删除阶段会连带删除其下工序分类（相关活自动变成待认领） */
  deletePhase: (planId: string, phaseId: string) => void;

  addWorkKind: (planId: string, name: string, phaseId: string) => void;
  updateWorkKind: (planId: string, kindId: string, patch: Partial<WorkKind>) => void;
  deleteWorkKind: (planId: string, kindId: string) => void;
}

function mapPlan(plans: Plan[], planId: string, fn: (p: Plan) => Plan): Plan[] {
  return plans.map((p) => (p.id === planId ? fn(p) : p));
}

function mapLog(data: SiteLogData, logId: string, fn: (l: SiteLog) => SiteLog) {
  return { ...data, logs: data.logs.map((l) => (l.id === logId ? fn(l) : l)) };
}

/** localStorage 写满（照片太多）时给用户提示，而不是静默丢数据 */
const safeLocalStorage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      // 配额超限（照片太多）或隐私模式禁用存储：提示但不打断操作，
      // 本次会话的内存状态照常更新，只是没能落盘。
      const quota =
        e instanceof DOMException &&
        (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      if (quota && typeof window !== 'undefined') {
        console.error('本地存储已满，未能落盘', e);
        window.alert('浏览器本地存储空间不足，本次改动未能保存到本地。请减少日志中的照片数量。');
      }
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
}));

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      plans: [],
      currentPlanId: null,
      scale: 1,

      setScale: (s) => set({ scale: s }),

      addPlan: (name) => {
        const id = genId('plan_');
        const plan: Plan = {
          id,
          name,
          createdAt: Date.now(),
          rooms: [],
          openings: [],
          outlets: [],
          materials: [...DEFAULT_MATS],
          siteLogs: createDefaultSiteLogData(),
        };
        set((state) => ({ plans: [...state.plans, plan], currentPlanId: id }));
        return id;
      },

      deletePlan: (id) =>
        set((state) => ({
          plans: state.plans.filter((p) => p.id !== id),
          currentPlanId: state.currentPlanId === id ? null : state.currentPlanId,
        })),

      getPlan: (id) => get().plans.find((p) => p.id === id),

      updatePlan: (id, updater) =>
        set((state) => ({
          plans: state.plans.map((p) => (p.id === id ? updater(p) : p)),
        })),

      addRoom: (planId, room) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({ ...p, rooms: [...p.rooms, room] })),
        })),

      updateRoom: (planId, roomId, updater) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            rooms: p.rooms.map((r) => (r.id === roomId ? updater(r) : r)),
          })),
        })),

      deleteRoom: (planId, roomId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => {
            const removed = p.rooms.find((r) => r.id === roomId);
            return {
              ...p,
              rooms: p.rooms.filter((r) => r.id !== roomId),
              openings: p.openings.filter((o) => o.roomId !== roomId),
              // 历史日志保留房间名快照，避免房间删除后日志丢失房间信息
              siteLogs: removed
                ? {
                    ...p.siteLogs,
                    logs: p.siteLogs.logs.map((l) =>
                      l.roomId === roomId
                        ? { ...l, roomId: null, roomName: removed.name }
                        : l
                    ),
                  }
                : p.siteLogs,
            };
          }),
        })),

      addOpening: (planId, opening) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            openings: [...p.openings, opening],
          })),
        })),

      deleteOpening: (planId, openingId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            openings: p.openings.filter((o) => o.id !== openingId),
          })),
        })),

      addOutlet: (planId, outlet) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({ ...p, outlets: [...p.outlets, outlet] })),
        })),

      deleteOutlet: (planId, outletId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            outlets: p.outlets.filter((o) => o.id !== outletId),
          })),
        })),

      updateMaterials: (planId, mats) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({ ...p, materials: mats })),
        })),

      // ---------------- 施工日志 ----------------

      addSiteLog: (planId, draft) => {
        const plan = get().plans.find((p) => p.id === planId);
        if (!plan) return null;
        const sameRoom = (l: SiteLog) =>
          l.date === draft.date &&
          ((l.roomId && l.roomId === draft.roomId) ||
            (!l.roomId && l.roomName.trim() === draft.roomName.trim()));
        // 同房间同一天可以分几段：段号取现有最大段号 +1，删掉中间一段再补也不重号
        const segment =
          plan.siteLogs.logs.filter(sameRoom).reduce((m, l) => Math.max(m, l.segment), 0) + 1;
        const now = Date.now();
        const log: SiteLog = {
          id: genId('log_'),
          date: draft.date,
          roomId: draft.roomId,
          roomName: draft.roomName.trim(),
          segment,
          workerIds: draft.workerIds,
          extraWorkers: draft.extraWorkers,
          workDone: draft.workDone
            .map((it) => ({ ...it, id: it.id || genId('item_') }))
            .filter((it) => it.text.trim()),
          issue: draft.issue,
          photos: draft.photos,
          corrections: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            siteLogs: { ...p.siteLogs, logs: [...p.siteLogs.logs, log] },
          })),
        }));
        return log.id;
      },

      updateSiteLog: (planId, logId, draft) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            siteLogs: mapLog(p.siteLogs, logId, (l) => ({
              ...l,
              roomId: draft.roomId,
              roomName: draft.roomName.trim(),
              workerIds: draft.workerIds,
              extraWorkers: draft.extraWorkers,
              workDone: draft.workDone
                .map((it) => ({ ...it, id: it.id || genId('item_') }))
                .filter((it) => it.text.trim()),
              issue: draft.issue,
              photos: draft.photos,
              updatedAt: Date.now(),
            })),
          })),
        })),

      deleteSiteLog: (planId, logId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            siteLogs: { ...p.siteLogs, logs: p.siteLogs.logs.filter((l) => l.id !== logId) },
          })),
        })),

      addCorrection: (planId, logId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const correction: LogCorrection = {
          id: genId('cor_'),
          createdAt: Date.now(),
          text: trimmed,
        };
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            siteLogs: mapLog(p.siteLogs, logId, (l) => ({
              ...l,
              corrections: [...l.corrections, correction],
              updatedAt: Date.now(),
            })),
          })),
        }));
      },

      deleteCorrection: (planId, logId, correctionId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            siteLogs: mapLog(p.siteLogs, logId, (l) => ({
              ...l,
              corrections: l.corrections.filter((c) => c.id !== correctionId),
            })),
          })),
        })),

      assignWorkItem: (planId, logId, itemId, kindId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            siteLogs: mapLog(p.siteLogs, logId, (l) => ({
              ...l,
              workDone: l.workDone.map((it) =>
                it.id === itemId ? { ...it, kindId } : it
              ),
            })),
          })),
        })),

      addWorker: (planId, name, trade) => {
        const id = genId('w_');
        const worker: Worker = { id, name: name.trim(), trade: trade?.trim() || undefined };
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            siteLogs: { ...p.siteLogs, workers: [...p.siteLogs.workers, worker] },
          })),
        }));
        return id;
      },

      updateWorker: (planId, workerId, patch) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            siteLogs: {
              ...p.siteLogs,
              workers: p.siteLogs.workers.map((w) =>
                w.id === workerId ? { ...w, ...patch, name: patch.name?.trim() ?? w.name } : w
              ),
            },
          })),
        })),

      deleteWorker: (planId, workerId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            siteLogs: {
              ...p.siteLogs,
              workers: p.siteLogs.workers.filter((w) => w.id !== workerId),
              logs: p.siteLogs.logs.map((l) => ({
                ...l,
                workerIds: l.workerIds.filter((id) => id !== workerId),
              })),
            },
          })),
        })),

      addPhase: (planId, name) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => {
            const order = p.siteLogs.phases.reduce((m, ph) => Math.max(m, ph.order), 0) + 1;
            const phase: Phase = { id: genId('ph_'), name: name.trim(), order };
            return { ...p, siteLogs: { ...p.siteLogs, phases: [...p.siteLogs.phases, phase] } };
          }),
        })),

      updatePhase: (planId, phaseId, patch) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            siteLogs: {
              ...p.siteLogs,
              phases: p.siteLogs.phases.map((ph) =>
                ph.id === phaseId
                  ? {
                      ...ph,
                      ...patch,
                      plannedDays:
                        patch.plannedDays === undefined
                          ? ph.plannedDays
                          : patch.plannedDays > 0
                            ? patch.plannedDays
                            : undefined,
                    }
                  : ph
              ),
            },
          })),
        })),

      deletePhase: (planId, phaseId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            siteLogs: {
              ...p.siteLogs,
              phases: p.siteLogs.phases.filter((ph) => ph.id !== phaseId),
              workKinds: p.siteLogs.workKinds.filter((k) => k.phaseId !== phaseId),
            },
          })),
        })),

      addWorkKind: (planId, name, phaseId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => {
            const kind: WorkKind = { id: genId('wk_'), name: name.trim(), phaseId };
            return {
              ...p,
              siteLogs: { ...p.siteLogs, workKinds: [...p.siteLogs.workKinds, kind] },
            };
          }),
        })),

      updateWorkKind: (planId, kindId, patch) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({
            ...p,
            siteLogs: {
              ...p.siteLogs,
              workKinds: p.siteLogs.workKinds.map((k) =>
                k.id === kindId
                  ? { ...k, ...patch, name: patch.name?.trim() ?? k.name }
                  : k
              ),
            },
          })),
        })),

      deleteWorkKind: (planId, kindId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, p => ({
            ...p,
            siteLogs: {
              ...p.siteLogs,
              workKinds: p.siteLogs.workKinds.filter((k) => k.id !== kindId),
            },
          })),
        })),
    }),
    {
      name: 'app-011-store',
      storage: safeLocalStorage,
      // 旧版本数据没有 siteLogs，rehydrate 后统一补齐
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<AppState>) };
        merged.plans = (merged.plans ?? []).map((p) => ({
          ...p,
          siteLogs: ensureSiteLogData(p.siteLogs),
        }));
        return merged;
      },
    }
  )
);
