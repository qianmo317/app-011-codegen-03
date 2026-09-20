import { useMemo, useRef, useState } from 'react';
import type { LogPhoto, Plan, SiteLog } from '../../types';
import { useStore } from '../../store';
import { genId } from '../../utils/siteLog';
import { todayISO } from '../../utils/date';
import { compressImage } from '../../utils/image';

interface Props {
  plan: Plan;
  /** 传入则为编辑模式（日期锁定），不传为新增 */
  editing?: SiteLog;
  onDone: () => void;
}

interface ItemRow {
  id: string;
  text: string;
  kindId: string | null;
}

export default function LogForm({ plan, editing, onDone }: Props) {
  const { addSiteLog, updateSiteLog } = useStore();
  const { rooms, siteLogs } = plan;

  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [roomSelect, setRoomSelect] = useState(
    editing ? (editing.roomId ? `id:${editing.roomId}` : editing.roomName ? `name:${editing.roomName}` : '__custom__') : '__custom__'
  );
  const [customRoom, setCustomRoom] = useState(editing && !editing.roomId ? editing.roomName : '');
  const [workerIds, setWorkerIds] = useState<string[]>(editing?.workerIds ?? []);
  const [extraWorkers, setExtraWorkers] = useState(editing?.extraWorkers ?? 0);
  const [items, setItems] = useState<ItemRow[]>(
    editing?.workDone.map((it) => ({ id: it.id, text: it.text, kindId: it.kindId })) ?? [
      { id: genId('item_'), text: '', kindId: null },
    ]
  );
  const [issue, setIssue] = useState(editing?.issue ?? '');
  const [photos, setPhotos] = useState<LogPhoto[]>(editing?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // 房间下拉：方案里的房间 + 日志里出现过的手填房间 + 自定义
  const namedRooms = useMemo(() => {
    const names = new Set<string>();
    for (const l of siteLogs.logs) {
      if (!l.roomId && l.roomName) names.add(l.roomName);
    }
    return [...names].sort();
  }, [siteLogs.logs]);

  const roomId = roomSelect.startsWith('id:') ? roomSelect.slice(3) : null;
  const roomName = roomSelect.startsWith('id:')
    ? rooms.find((r) => r.id === roomId)?.name ?? ''
    : roomSelect.startsWith('name:')
      ? roomSelect.slice(5)
      : customRoom.trim();

  const setItem = (id: string, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const toggleWorker = (id: string) =>
    setWorkerIds((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const next: LogPhoto[] = [];
      for (const file of [...files].slice(0, 9 - photos.length)) {
        const dataUrl = await compressImage(file);
        next.push({ id: genId('pho_'), dataUrl, caption: '' });
      }
      setPhotos((prev) => [...prev, ...next]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '照片处理失败');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    setError('');
    if (!date) {
      setError('请选择日期');
      return;
    }
    if (!roomName) {
      setError('请选择或填写房间');
      return;
    }
    const cleanedItems = items
      .map((it) => ({ ...it, text: it.text.trim() }))
      .filter((it) => it.text);
    if (cleanedItems.length === 0) {
      setError('至少写一道今天干完的活');
      return;
    }

    const draft = {
      roomId,
      roomName,
      workerIds,
      extraWorkers: Math.max(0, extraWorkers || 0),
      workDone: cleanedItems,
      issue: issue.trim(),
      photos,
    };

    if (editing) {
      updateSiteLog(plan.id, editing.id, draft);
    } else {
      const created = addSiteLog(plan.id, { date, ...draft });
      if (!created) {
        setError('保存失败');
        return;
      }
    }
    onDone();
  };

  return (
    <div className="card log-form">
      <h3 className="log-form-title">{editing ? `编辑日志 · ${editing.date}（日期不可改）` : '记一条施工日志'}</h3>

      <div className="log-form-grid">
        <div className="form-group">
          <label>日期 *</label>
          <input
            type="date"
            value={date}
            disabled={!!editing}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>房间 *</label>
          <select value={roomSelect} onChange={(e) => setRoomSelect(e.target.value)}>
            <option value="__custom__">—— 手填房间名 ——</option>
            {rooms.length > 0 && (
              <optgroup label="方案房间">
                {rooms.map((r) => (
                  <option key={r.id} value={`id:${r.id}`}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            )}
            {namedRooms.length > 0 && (
              <optgroup label="现场房间">
                {namedRooms.map((n) => (
                  <option key={n} value={`name:${n}`}>
                    {n}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        {roomSelect === '__custom__' && (
          <div className="form-group">
            <label>房间名称 *</label>
            <input
              value={customRoom}
              placeholder="如：主卧、阳台"
              onChange={(e) => setCustomRoom(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="form-group">
        <label>到场人员（点名勾选）</label>
        {siteLogs.workers.length === 0 ? (
          <div className="hint">工人名册为空，可只在下面填到场人数，或先到「设置」里加工人。</div>
        ) : (
          <div className="worker-checks">
            {siteLogs.workers.map((w) => (
              <label key={w.id} className={`chip ${workerIds.includes(w.id) ? 'chip-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={workerIds.includes(w.id)}
                  onChange={() => toggleWorker(w.id)}
                />
                {w.name}
                {w.trade ? <span className="chip-sub">（{w.trade}）</span> : null}
              </label>
            ))}
          </div>
        )}
        <div className="extra-workers">
          另有未入册临时工
          <input
            type="number"
            min={0}
            value={extraWorkers}
            onChange={(e) => setExtraWorkers(parseInt(e.target.value) || 0)}
          />
          人，到场合计 <strong>{workerIds.length + extraWorkers}</strong> 人
        </div>
      </div>

      <div className="form-group">
        <label>今天干完的活 *（每行一道，归到对应工序分类）</label>
        <div className="item-rows">
          {items.map((it, idx) => (
            <div className="item-row" key={it.id}>
              <span className="item-idx">{idx + 1}</span>
              <input
                placeholder="如：主卧墙面刮第二遍腻子"
                value={it.text}
                onChange={(e) => setItem(it.id, { text: e.target.value })}
              />
              <select
                value={it.kindId ?? ''}
                onChange={(e) => setItem(it.id, { kindId: e.target.value || null })}
              >
                <option value="">待认领（不归工序）</option>
                {siteLogs.phases
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((ph) => {
                    const kinds = siteLogs.workKinds.filter((k) => k.phaseId === ph.id);
                    if (kinds.length === 0) return null;
                    return (
                      <optgroup key={ph.id} label={ph.name}>
                        {kinds.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
              </select>
              {items.length > 1 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                >
                  删
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setItems((prev) => [...prev, { id: genId('item_'), text: '', kindId: null }])}
        >
          + 加一道活
        </button>
      </div>

      <div className="form-group">
        <label>碰到的问题</label>
        <textarea
          className="log-textarea"
          rows={2}
          placeholder="如：客厅墙面空鼓两处，约工长明天复查"
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>现场照片（说明拍了什么）</label>
        <div className="photo-grid">
          {photos.map((ph) => (
            <div key={ph.id} className="photo-thumb">
              <img src={ph.dataUrl} alt={ph.caption || '现场照片'} />
              <input
                placeholder="照片说明"
                value={ph.caption}
                onChange={(e) =>
                  setPhotos((prev) =>
                    prev.map((p) => (p.id === ph.id ? { ...p, caption: e.target.value } : p))
                  )
                }
              />
              <button
                type="button"
                className="photo-del"
                onClick={() => setPhotos((prev) => prev.filter((p) => p.id !== ph.id))}
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < 9 && (
            <button
              type="button"
              className="photo-add"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? '压缩中…' : '+ 传照片'}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {error && <div className="log-error">{error}</div>}

      <div className="log-form-actions">
        <button className="btn btn-primary" onClick={handleSubmit} disabled={uploading}>
          {editing ? '保存修改' : '保存日志'}
        </button>
        <button className="btn btn-secondary" onClick={onDone}>
          取消
        </button>
      </div>
    </div>
  );
}
