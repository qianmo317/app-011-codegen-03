import { create } from 'zustand';
import type { Plan, Room, Opening, Outlet, MatSpec, WorkLog, Stage, WorkCategory } from '../types';
import { DEFAULT_MATS } from '../utils/materialCalc';

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
  // 施工日志
  addLog: (planId: string, draft: Omit<WorkLog, 'id' | 'segment' | 'createdAt' | 'updatedAt'>) => string;
  updateLog: (planId: string, logId: string, patch: Partial<Omit<WorkLog, 'id' | 'date' | 'segment' | 'createdAt'>>) => void;
  deleteLog: (planId: string, logId: string) => void;
  addCorrection: (planId: string, logId: string, text: string) => void;
  claimWorkItem: (planId: string, logId: string, itemId: string, category: WorkCategory | null) => void;
  // 施工阶段
  addStage: (planId: string, stage: Omit<Stage, 'id'>) => string;
  updateStage: (planId: string, stageId: string, patch: Partial<Omit<Stage, 'id'>>) => void;
  deleteStage: (planId: string, stageId: string) => void;
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useStore = create<AppState>((set, get) => ({
  plans: [],
  currentPlanId: null,
  scale: 1,

  setScale: (s) => set({ scale: s }),

  addPlan: (name) => {
    const id = genId();
    const plan: Plan = {
      id,
      name,
      createdAt: Date.now(),
      rooms: [],
      openings: [],
      outlets: [],
      materials: [...DEFAULT_MATS],
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
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, rooms: [...p.rooms, room] } : p
      ),
    })),

  updateRoom: (planId, roomId, updater) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, rooms: p.rooms.map((r) => (r.id === roomId ? updater(r) : r)) }
          : p
      ),
    })),

  deleteRoom: (planId, roomId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              rooms: p.rooms.filter((r) => r.id !== roomId),
              openings: p.openings.filter((o) => o.roomId !== roomId),
            }
          : p
      ),
    })),

  addOpening: (planId, opening) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, openings: [...p.openings, opening] } : p
      ),
    })),

  deleteOpening: (planId, openingId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, openings: p.openings.filter((o) => o.id !== openingId) }
          : p
      ),
    })),

  addOutlet: (planId, outlet) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, outlets: [...p.outlets, outlet] } : p
      ),
    })),

  deleteOutlet: (planId, outletId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, outlets: p.outlets.filter((o) => o.id !== outletId) }
          : p
      ),
    })),

  updateMaterials: (planId, mats) =>
    set((state) => ({
      plans: state.plans.map((p) => (p.id === planId ? { ...p, materials: mats } : p)),
    })),

  addLog: (planId, draft) => {
    const id = genId();
    let newId = id;
    set((state) => ({
      plans: state.plans.map((p) => {
        if (p.id !== planId) return p;
        // 同一天同一房间的段号顺延
        const segment =
          (p.workLogs ?? []).filter(
            (l) => l.date === draft.date && l.roomId === draft.roomId
          ).length + 1;
        const now = Date.now();
        const log: WorkLog = { ...draft, id, segment, createdAt: now, updatedAt: now };
        return { ...p, workLogs: [...(p.workLogs ?? []), log] };
      }),
    }));
    return newId;
  },

  updateLog: (planId, logId, patch) =>
    set((state) => ({
      plans: state.plans.map((p) => {
        if (p.id !== planId) return p;
        return {
          ...p,
          workLogs: (p.workLogs ?? []).map((l) => {
            if (l.id !== logId) return l;
            // 换到别的房间后，按「新房间 + 原日期」重新排段号；日期永远不许改
            const nextRoomId = patch.roomId ?? l.roomId;
            let segment = l.segment;
            if (patch.roomId && patch.roomId !== l.roomId) {
              segment =
                (p.workLogs ?? []).filter(
                  (x) =>
                    x.id !== l.id && x.date === l.date && x.roomId === nextRoomId
                ).length + 1;
            }
            return {
              ...l,
              ...{ ...patch, date: l.date },
              segment,
              updatedAt: Date.now(),
            };
          }),
        };
      }),
    })),

  deleteLog: (planId, logId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, workLogs: (p.workLogs ?? []).filter((l) => l.id !== logId) }
          : p
      ),
    })),

  addCorrection: (planId, logId, text) =>
    set((state) => ({
      plans: state.plans.map((p) => {
        if (p.id !== planId) return p;
        return {
          ...p,
          workLogs: (p.workLogs ?? []).map((l) =>
            l.id === logId
              ? {
                  ...l,
                  corrections: [
                    ...l.corrections,
                    { id: genId(), text: text.trim(), createdAt: Date.now() },
                  ],
                }
              : l
          ),
        };
      }),
    })),

  claimWorkItem: (planId, logId, itemId, category) =>
    set((state) => ({
      plans: state.plans.map((p) => {
        if (p.id !== planId) return p;
        return {
          ...p,
          workLogs: (p.workLogs ?? []).map((l) =>
            l.id === logId
              ? {
                  ...l,
                  items: l.items.map((it) =>
                    it.id === itemId ? { ...it, category } : it
                  ),
                  updatedAt: Date.now(),
                }
              : l
          ),
        };
      }),
    })),

  addStage: (planId, stage) => {
    const id = genId();
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, stages: [...(p.stages ?? []), { ...stage, id }] } : p
      ),
    }));
    return id;
  },

  updateStage: (planId, stageId, patch) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              stages: (p.stages ?? []).map((s) =>
                s.id === stageId ? { ...s, ...patch } : s
              ),
            }
          : p
      ),
    })),

  deleteStage: (planId, stageId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, stages: (p.stages ?? []).filter((s) => s.id !== stageId) }
          : p
      ),
    })),
}));
