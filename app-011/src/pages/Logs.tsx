import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import type { WorkLog } from '../types';
import { WORK_CATEGORY_LABELS } from '../types';
import { sortLogsDesc, summarizeByWeek, collectWorkers } from '../utils/logs';
import LogForm from '../components/LogForm';
import LogCard from '../components/LogCard';
import WeekSummaryView from '../components/WeekSummaryView';
import StageSummaryView from '../components/StageSummaryView';

type Tab = 'list' | 'week' | 'stage' | 'unclaimed';

export default function Logs() {
  const { id } = useParams<{ id: string }>();
  const {
    getPlan,
    addLog,
    updateLog,
    deleteLog,
    addCorrection,
    claimWorkItem,
    addStage,
    updateStage,
    deleteStage,
  } = useStore();
  const plan = getPlan(id!);

  const [tab, setTab] = useState<Tab>('list');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roomFilter, setRoomFilter] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');

  const logs = plan?.workLogs ?? [];
  const workers = useMemo(() => collectWorkers(logs), [logs]);

  const roomName = (roomId: string) =>
    plan?.rooms.find((r) => r.id === roomId)?.name ?? '（房间已删除）';

  const filtered = useMemo(() => {
    const result = logs.filter((l) => {
      if (roomFilter && l.roomId !== roomFilter) return false;
      if (workerFilter && !l.workerNames.includes(workerFilter)) return false;
      return true;
    });
    return sortLogsDesc(result, roomName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, roomFilter, workerFilter, plan]);

  const weekRows = useMemo(() => summarizeByWeek(filtered), [filtered]);

  const unclaimed = useMemo(
    () =>
      sortLogsDesc(
        logs.filter((l) => l.items.some((it) => it.category === null)),
        roomName
        // eslint-disable-next-line react-hooks/exhaustive-deps
      ),
    [logs, plan]
  );

  if (!plan) {
    return <div className="card">方案不存在</div>;
  }

  const editingLog = editingId ? logs.find((l) => l.id === editingId) : undefined;

  const handleCreate = (
    draft: Omit<WorkLog, 'id' | 'segment' | 'createdAt' | 'updatedAt'>
  ) => {
    addLog(plan.id, draft);
    setCreating(false);
  };

  const handleUpdate = (
    draft: Omit<WorkLog, 'id' | 'segment' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!editingId) return;
    updateLog(plan.id, editingId, {
      roomId: draft.roomId,
      items: draft.items,
      workerCount: draft.workerCount,
      workerNames: draft.workerNames,
      problems: draft.problems,
      photos: draft.photos,
    });
    setEditingId(null);
  };

  const unclaimedCount = logs.reduce(
    (s, l) => s + l.items.filter((it) => it.category === null).length,
    0
  );

  return (
    <div>
      <h2 className="page-title">{plan.name} - 施工日志</h2>

      <div className="tabs">
        <Link to={`/plan/${id}`} className="tab">
          平面绘制
        </Link>
        <Link to={`/plan/${id}/walls`} className="tab">
          墙面点位
        </Link>
        <Link to={`/plan/${id}/bom`} className="tab">
          材料清单
        </Link>
        <Link to={`/plan/${id}/logs`} className="tab active">
          施工日志
        </Link>
        <Link to={`/plan/${id}/print`} className="tab">
          导出打印
        </Link>
      </div>

      <div className="tabs sub-tabs no-print">
        <button className={`tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          日志列表
        </button>
        <button className={`tab ${tab === 'week' ? 'active' : ''}`} onClick={() => setTab('week')}>
          按周汇总
        </button>
        <button className={`tab ${tab === 'stage' ? 'active' : ''}`} onClick={() => setTab('stage')}>
          按阶段汇总
        </button>
        <button
          className={`tab ${tab === 'unclaimed' ? 'active' : ''}`}
          onClick={() => setTab('unclaimed')}
        >
          待认领{unclaimedCount > 0 && <span className="badge-warn">{unclaimedCount}</span>}
        </button>
      </div>

      {(tab === 'list' || tab === 'unclaimed') && (
        <div className="card filter-bar no-print">
          {tab === 'list' && !creating && !editingLog && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + 记一条日志
            </button>
          )}
          <div className="form-group filter-item">
            <label>按房间筛</label>
            <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
              <option value="">全部房间</option>
              {plan.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group filter-item">
            <label>按工人筛</label>
            <select value={workerFilter} onChange={(e) => setWorkerFilter(e.target.value)}>
              <option value="">全部工人</option>
              {workers.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          {(roomFilter || workerFilter) && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setRoomFilter('');
                setWorkerFilter('');
              }}
            >
              清除筛选
            </button>
          )}
        </div>
      )}

      {creating && (
        <LogForm
          plan={plan}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}
      {editingLog && (
        <LogForm
          plan={plan}
          initial={editingLog}
          onSubmit={handleUpdate}
          onCancel={() => setEditingId(null)}
        />
      )}

      {tab === 'list' &&
        !creating &&
        !editingLog &&
        (filtered.length === 0 ? (
          <div className="card empty-hint">
            {logs.length === 0
              ? '还没有日志，点上方「记一条日志」开始。同一天同一个房间可以分几段记。'
              : '当前筛选条件下没有日志。'}
          </div>
        ) : (
          filtered.map((l) => (
            <LogCard
              key={l.id}
              log={l}
              roomName={roomName(l.roomId)}
              onEdit={() => setEditingId(l.id)}
              onDelete={() => {
                if (confirm('确定删除这条日志？删除后不可恢复（更正说明也会一并删除）。')) {
                  deleteLog(plan.id, l.id);
                }
              }}
              onAddCorrection={(text) => addCorrection(plan.id, l.id, text)}
              onClaim={(itemId, category) => claimWorkItem(plan.id, l.id, itemId, category)}
            />
          ))
        ))}

      {tab === 'week' && <WeekSummaryView rows={weekRows} />}

      {tab === 'stage' && (
        <StageSummaryView
          plan={plan}
          onAddStage={(s) => addStage(plan.id, s)}
          onUpdateStage={(sid, patch) => updateStage(plan.id, sid, patch)}
          onDeleteStage={(sid) => deleteStage(plan.id, sid)}
        />
      )}

      {tab === 'unclaimed' &&
        (unclaimed.length === 0 ? (
          <div className="card empty-hint">没有归不上的活，全部日志里的活都已认领工序。</div>
        ) : (
          unclaimed.map((l) => (
            <LogCard
              key={l.id}
              log={l}
              roomName={roomName(l.roomId)}
              onEdit={() => {
                setTab('list');
                setEditingId(l.id);
              }}
              onDelete={() => {
                if (confirm('确定删除这条日志？删除后不可恢复。')) deleteLog(plan.id, l.id);
              }}
              onAddCorrection={(text) => addCorrection(plan.id, l.id, text)}
              onClaim={(itemId, category) => claimWorkItem(plan.id, l.id, itemId, category)}
            />
          ))
        ))}

      {tab === 'unclaimed' && unclaimed.length > 0 && (
        <div className="card hint-line">
          下列日志中带 <span className="cat-badge cat-badge-none">待认领</span> 标记的活还归不到工序，
          用旁边的下拉选一个工序即可认领（{Object.values(WORK_CATEGORY_LABELS).join('、')}）。
        </div>
      )}
    </div>
  );
}
