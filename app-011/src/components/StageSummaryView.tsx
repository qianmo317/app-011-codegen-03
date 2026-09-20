import { useState } from 'react';
import type { Plan, Stage, WorkCategory } from '../types';
import { WORK_CATEGORY_LABELS, WORK_CATEGORY_ORDER } from '../types';
import { plannedDays, summarizeStage } from '../utils/logs';

interface Props {
  plan: Plan;
  onAddStage: (stage: Omit<Stage, 'id'>) => void;
  onUpdateStage: (id: string, patch: Partial<Omit<Stage, 'id'>>) => void;
  onDeleteStage: (id: string) => void;
}

const STATUS_TIPS: Record<number, string> = {
  [-1]: '提前完成',
  0: '与计划持平',
  1: '超期',
};

export default function StageSummaryView({ plan, onAddStage, onUpdateStage, onDeleteStage }: Props) {
  const logs = plan.workLogs ?? [];
  const stages = plan.stages ?? [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WorkCategory>('waterElec');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [err, setErr] = useState('');

  const submit = () => {
    if (!name.trim()) return setErr('请填阶段名称');
    if (!startDate || !endDate) return setErr('请选计划起止日期');
    if (startDate > endDate) return setErr('开工日期不能晚于收工日期');
    onAddStage({ name: name.trim(), category, startDate, endDate });
    setName('');
    setStartDate('');
    setEndDate('');
    setErr('');
    setAdding(false);
  };

  return (
    <div className="card">
      <div className="section-head">
        <h3 className="section-title">按施工阶段汇总</h3>
        {!adding && (
          <button className="btn btn-primary no-print" onClick={() => setAdding(true)}>
            + 登记阶段计划
          </button>
        )}
      </div>

      {adding && (
        <div className="stage-form no-print">
          <div className="form-row">
            <div className="form-group">
              <label>阶段名称</label>
              <input
                type="text"
                placeholder="如：水电改造"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>对应工序</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as WorkCategory)}>
                {WORK_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {WORK_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>计划开工</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>计划收工</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {err && <p className="form-error">{err}</p>}
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="btn btn-primary" onClick={submit}>
              保存阶段
            </button>
            <button className="btn btn-secondary" onClick={() => setAdding(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      {stages.length === 0 ? (
        <p className="empty-hint">
          还没有阶段计划。登记后自动按日志里的工序归类，对比「原定几天 / 实际用了几天」，
          并列出差在哪几天上。
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>阶段</th>
              <th>工序</th>
              <th>计划区间</th>
              <th>原定天数</th>
              <th>实际天数</th>
              <th>差异</th>
              <th>差在哪几天</th>
              <th className="no-print">操作</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => {
              const planned = plannedDays(s);
              const diff = summarizeStage(logs, s);
              const actual = diff.actualDays.length;
              const delta = actual - planned;
              return (
                <tr key={s.id} className={delta > 0 ? 'row-overrun' : delta < 0 ? 'row-ahead' : ''}>
                  <td>
                    <input
                      className="inline-input"
                      value={s.name}
                      onChange={(e) => onUpdateStage(s.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      className="inline-input"
                      value={s.category}
                      onChange={(e) =>
                        onUpdateStage(s.id, { category: e.target.value as WorkCategory })
                      }
                    >
                      {WORK_CATEGORY_ORDER.map((c) => (
                        <option key={c} value={c}>
                          {WORK_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="date-range-cell">
                    <input
                      type="date"
                      className="inline-input"
                      value={s.startDate}
                      onChange={(e) => onUpdateStage(s.id, { startDate: e.target.value })}
                    />
                    <span>~</span>
                    <input
                      type="date"
                      className="inline-input"
                      value={s.endDate}
                      onChange={(e) => onUpdateStage(s.id, { endDate: e.target.value })}
                    />
                  </td>
                  <td>{planned || '—'}</td>
                  <td>{actual || '0'}</td>
                  <td>
                    {planned > 0 && (
                      <span className={delta > 0 ? 'delta-bad' : delta < 0 ? 'delta-good' : 'delta-ok'}>
                        {delta > 0 ? `+${delta} 天` : `${delta} 天`}（{STATUS_TIPS[delta === 0 ? 0 : delta > 0 ? 1 : -1]}）
                      </span>
                    )}
                  </td>
                  <td className="day-diff-cell">
                    {diff.plannedIdleDays.length === 0 && diff.overrunDays.length === 0 ? (
                      <span className="muted">无差异</span>
                    ) : (
                      <>
                        {diff.plannedIdleDays.length > 0 && (
                          <div className="diff-line">
                            <span className="diff-tag diff-idle">计划内停工</span>
                            {diff.plannedIdleDays.join('、')}
                          </div>
                        )}
                        {diff.overrunDays.length > 0 && (
                          <div className="diff-line">
                            <span className="diff-tag diff-over">计划外施工</span>
                            {diff.overrunDays.join('、')}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="no-print">
                    <button className="btn btn-danger" onClick={() => onDeleteStage(s.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
        实际天数按日志中归到该工序的不同日期统计；「计划内停工」是原定该干活却没有对应日志的日子，
        「计划外施工」是超出计划区间仍在干该工序的日子。
      </p>
    </div>
  );
}
