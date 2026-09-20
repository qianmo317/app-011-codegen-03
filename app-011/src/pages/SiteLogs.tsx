import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import {
  roomKey,
  roomLabel,
  summarizeByWeek,
} from '../utils/siteLog';
import { formatDateCN } from '../utils/date';
import LogForm from '../components/siteLog/LogForm';
import LogCard from '../components/siteLog/LogCard';
import WeekSummary from '../components/siteLog/WeekSummary';
import PhaseSummary from '../components/siteLog/PhaseSummary';
import UnclaimedQueue from '../components/siteLog/UnclaimedQueue';
import LogSettings from '../components/siteLog/LogSettings';

type Tab = 'logs' | 'week' | 'phase' | 'unclaimed' | 'settings';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'logs', label: '日志时间线' },
  { key: 'week', label: '按周汇总' },
  { key: 'phase', label: '按施工阶段' },
  { key: 'unclaimed', label: '待认领' },
  { key: 'settings', label: '设置' },
];

export default function SiteLogs() {
  const { id } = useParams<{ id: string }>();
  const { getPlan } = useStore();
  const plan = getPlan(id!);

  const [tab, setTab] = useState<Tab>('logs');
  const [creating, setCreating] = useState(false);
  const [roomFilter, setRoomFilter] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');

  const data = plan?.siteLogs;

  // 房间筛选项：方案房间 + 日志里出现过的手填房间
  const roomOptions = useMemo(() => {
    if (!plan) return [];
    const map = new Map<string, string>();
    for (const r of plan.rooms) map.set(`id:${r.id}`, r.name);
    for (const l of plan.siteLogs.logs) {
      const k = roomKey(l);
      if (!map.has(k)) map.set(k, roomLabel(l));
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'));
  }, [plan]);

  const filteredLogs = useMemo(() => {
    if (!data) return [];
    return data.logs
      .filter((l) => {
        if (roomFilter && roomKey(l) !== roomFilter) return false;
        if (workerFilter && !l.workerIds.includes(workerFilter)) return false;
        return true;
      })
      .sort((a, b) => {
        // 日期倒序；同房间同一天的几段放在一起，按段次正序
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        if (roomKey(a) === roomKey(b)) return a.segment - b.segment;
        return b.createdAt - a.createdAt;
      });
  }, [data, roomFilter, workerFilter]);

  const unclaimedCount = useMemo(() => {
    if (!data) return 0;
    const kindIds = new Set(data.workKinds.map((k) => k.id));
    return data.logs.reduce(
      (n, l) => n + l.workDone.filter((it) => !it.kindId || !kindIds.has(it.kindId)).length,
      0
    );
  }, [data]);

  if (!plan || !data) {
    return (
      <div className="card">
        方案不存在，<Link to="/">回方案列表</Link>
      </div>
    );
  }

  const weeks = summarizeByWeek(filteredLogs);

  return (
    <div>
      <h2 className="page-title">{plan.name} - 施工日志</h2>

      <div className="tabs">
        <Link to={`/plan/${id}`} className="tab">平面绘制</Link>
        <Link to={`/plan/${id}/walls`} className="tab">墙面点位</Link>
        <Link to={`/plan/${id}/bom`} className="tab">材料清单</Link>
        <Link to={`/plan/${id}/logs`} className="tab active">
          施工日志{unclaimedCount > 0 ? `（${unclaimedCount} 待认领）` : ''}
        </Link>
        <Link to={`/plan/${id}/print`} className="tab">导出打印</Link>
      </div>

      <div className="toolbar log-toolbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setTab(t.key);
              setCreating(false);
            }}
          >
            {t.key === 'unclaimed' && unclaimedCount > 0 ? `${t.label}（${unclaimedCount}）` : t.label}
          </button>
        ))}
        {(tab === 'logs' || tab === 'week') && (
          <button
            className="btn btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={() => setCreating((v) => !v)}
          >
            {creating ? '收起' : '+ 记一条'}
          </button>
        )}
      </div>

      {(tab === 'logs' || tab === 'week') && (
        <div className="card log-filters">
          <div className="filter-item">
            <label>按房间</label>
            <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
              <option value="">全部房间</option>
              {roomOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>按工人</label>
            <select value={workerFilter} onChange={(e) => setWorkerFilter(e.target.value)}>
              <option value="">全部工人</option>
              {data.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.trade ? `（${w.trade}）` : ''}
                </option>
              ))}
            </select>
          </div>
          {(roomFilter || workerFilter) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setRoomFilter('');
                setWorkerFilter('');
              }}
            >
              清除筛选
            </button>
          )}
          <span className="filter-count">筛出 {filteredLogs.length} 段日志</span>
        </div>
      )}

      {creating && (
        <LogForm
          plan={plan}
          onDone={() => {
            setCreating(false);
            setTab('logs');
          }}
        />
      )}

      {tab === 'logs' &&
        (filteredLogs.length === 0 ? (
          <div className="card empty-hint">
            还没有日志。点右上角「+ 记一条」，写下哪天、哪个房间、干了哪道活、到场几个人。
            同一房间同一天分几段干就记几条，段次自动排。
          </div>
        ) : (
          <div>
            {filteredLogs.map((l, idx) => {
              const prev = filteredLogs[idx - 1];
              const showDate = !prev || prev.date !== l.date;
              return (
                <div key={l.id}>
                  {showDate && (
                    <div className="timeline-date">
                      {formatDateCN(l.date)}
                    </div>
                  )}
                  <LogCard plan={plan} log={l} />
                </div>
              );
            })}
          </div>
        ))}

      {tab === 'week' && <WeekSummary plan={plan} weeks={weeks} />}
      {tab === 'phase' && <PhaseSummary plan={plan} />}
      {tab === 'unclaimed' && <UnclaimedQueue plan={plan} />}
      {tab === 'settings' && <LogSettings plan={plan} />}
    </div>
  );
}
