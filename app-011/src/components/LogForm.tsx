import { useState } from 'react';
import type { Plan, WorkLog, WorkItem, LogPhoto, WorkCategory } from '../types';
import { WORK_CATEGORY_LABELS, WORK_CATEGORY_ORDER } from '../types';
import { todayStr } from '../utils/logs';
import PhotoUpload from './PhotoUpload';

interface Props {
  plan: Plan;
  initial?: WorkLog;
  onSubmit: (draft: Omit<WorkLog, 'id' | 'segment' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface ItemDraft {
  id: string;
  content: string;
  category: WorkCategory | null;
}

export default function LogForm({ plan, initial, onSubmit, onCancel }: Props) {
  const editing = !!initial;
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [roomId, setRoomId] = useState(initial?.roomId ?? plan.rooms[0]?.id ?? '');
  const [workerCount, setWorkerCount] = useState(String(initial?.workerCount ?? ''));
  const [workerInput, setWorkerInput] = useState('');
  const [workerNames, setWorkerNames] = useState<string[]>(initial?.workerNames ?? []);
  const [problems, setProblems] = useState(initial?.problems ?? '');
  const [photos, setPhotos] = useState<LogPhoto[]>(initial?.photos ?? []);
  const [items, setItems] = useState<ItemDraft[]>(
    initial?.items.map((it) => ({ ...it })) ?? [{ id: genId(), content: '', category: null }]
  );
  const [error, setError] = useState('');

  const addWorker = () => {
    const name = workerInput.trim();
    if (name && !workerNames.includes(name)) setWorkerNames([...workerNames, name]);
    setWorkerInput('');
  };

  const updateItem = (id: string, patch: Partial<ItemDraft>) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const handleSubmit = () => {
    if (!date) return setError('请选择日期');
    if (!roomId) return setError('请选择房间');
    const filled = items.filter((it) => it.content.trim());
    if (filled.length === 0) return setError('至少写一道干了的活');
    const count = parseInt(workerCount, 10);
    if (workerCount.trim() !== '' && (isNaN(count) || count < 0))
      return setError('到场人数需为非负整数');

    const finalItems: WorkItem[] = filled.map((it) => ({
      id: it.id,
      content: it.content.trim(),
      category: it.category,
    }));
    onSubmit({
      date,
      roomId,
      items: finalItems,
      workerCount: workerCount.trim() === '' ? 0 : count,
      workerNames,
      problems: problems.trim(),
      photos,
      corrections: initial?.corrections ?? [],
    });
  };

  return (
    <div className="card log-form">
      <h3 style={{ marginBottom: 12, fontSize: 16 }}>
        {editing ? `更正日志（${initial!.date} 第 ${initial!.segment} 段）` : '记一条施工日志'}
      </h3>

      {editing && (
        <p className="lock-note">
          🔒 日期保存后已锁定，不可修改；如需更正请在保存后另加一条「更正说明」。
        </p>
      )}

      <div className="form-row">
        <div className="form-group">
          <label>日期</label>
          <input
            type="date"
            value={date}
            disabled={editing}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>房间</label>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {plan.rooms.length === 0 && <option value="">（请先在平面绘制里建房间）</option>}
            {plan.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ maxWidth: 140 }}>
          <label>到场人数</label>
          <input
            type="number"
            min={0}
            placeholder="0"
            value={workerCount}
            onChange={(e) => setWorkerCount(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label>到场工人（回车加入名单，用于按工人筛选）</label>
        <div className="chips-input">
          {workerNames.map((n) => (
            <span key={n} className="chip">
              {n}
              <button type="button" onClick={() => setWorkerNames(workerNames.filter((x) => x !== n))}>
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={workerInput}
            placeholder="工人姓名"
            onChange={(e) => setWorkerInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addWorker();
              }
            }}
            onBlur={addWorker}
          />
        </div>
      </div>

      <div className="form-group">
        <label>干了哪些活（每道活归一个工序，归不上选「待认领」）</label>
        <div className="work-items">
          {items.map((it, idx) => (
            <div key={it.id} className="work-item-row">
              <span className="work-idx">{idx + 1}</span>
              <input
                type="text"
                placeholder="如：主卧墙面第二遍腻子打磨"
                value={it.content}
                onChange={(e) => updateItem(it.id, { content: e.target.value })}
              />
              <select
                value={it.category ?? ''}
                onChange={(e) =>
                  updateItem(it.id, {
                    category: e.target.value === '' ? null : (e.target.value as WorkCategory),
                  })
                }
                className={it.category ? '' : 'unclaimed-select'}
              >
                <option value="">待认领（归不上）</option>
                {WORK_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {WORK_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              {items.length > 1 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setItems(items.filter((x) => x.id !== it.id))}
                >
                  删
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setItems([...items, { id: genId(), content: '', category: null }])}
          >
            + 再加一道活
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>碰到什么问题</label>
        <textarea
          rows={3}
          placeholder="如：阳台下水管周边有渗水痕迹，已联系物业排查"
          value={problems}
          onChange={(e) => setProblems(e.target.value)}
        />
      </div>

      <PhotoUpload photos={photos} onChange={setPhotos} />

      {error && <p className="form-error">{error}</p>}

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <button type="button" className="btn btn-primary" onClick={handleSubmit}>
          {editing ? '保存修改' : '保存日志'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
