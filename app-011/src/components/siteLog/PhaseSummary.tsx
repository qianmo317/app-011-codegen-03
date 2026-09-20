import { useState } from 'react';
import type { Plan } from '../../types';
import { useStore } from '../../store';
import { summarizeByPhase } from '../../utils/siteLog';
import { diffDays, formatDateCN, formatDateFullCN } from '../../utils/date';

interface Props {
  plan: Plan;
}

export default function PhaseSummary({ plan }: Props) {
  const { updatePhase } = useStore();
  const stats = summarizeByPhase(plan.siteLogs);
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div>
      <div className="card hint">
        实际天数按「该阶段工序下出现施工记录的日期」去重统计。给阶段填上原定开工日期和原定天数，就能看出差在哪几天：
        <strong> 空耗日</strong>是计划内但没干活，<strong>计划外施工</strong>是超出原定区间仍在干（提前干或拖期都会列出来）。
      </div>

      {stats.map((s) => {
        const delta = s.planned ? s.actualDays - s.planned.plannedDays : null;
        return (
          <div className="card phase-card" key={s.phase.id}>
            <div className="phase-head">
              <h3>{s.phase.name}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditId(editId === s.phase.id ? null : s.phase.id)}>
                {editId === s.phase.id ? '收起计划' : '编计划'}
              </button>
            </div>

            {editId === s.phase.id && (
              <div className="phase-plan-edit">
                <div className="form-group">
                  <label>原定开始日期</label>
                  <input
                    type="date"
                    value={s.phase.startDate ?? ''}
                    onChange={(e) => updatePhase(plan.id, s.phase.id, { startDate: e.target.value || undefined })}
                  />
                </div>
                <div className="form-group">
                  <label>原定天数（日历天）</label>
                  <input
                    type="number"
                    min={1}
                    value={s.phase.plannedDays ?? ''}
                    placeholder="如 5"
                    onChange={(e) =>
                      updatePhase(plan.id, s.phase.id, { plannedDays: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            )}

            <div className="phase-nums">
              <div className="phase-num">
                <span className="phase-num-label">原定</span>
                <strong>{s.planned ? `${s.planned.plannedDays} 天` : '未设定'}</strong>
                {s.planned && (
                  <span className="phase-num-sub">
                    {formatDateFullCN(s.planned.start)} ~ {formatDateFullCN(s.planned.end)}
                  </span>
                )}
              </div>
              <div className="phase-num">
                <span className="phase-num-label">实际用掉</span>
                <strong>{s.actualDays} 天</strong>
                {s.firstDate && (
                  <span className="phase-num-sub">
                    {formatDateFullCN(s.firstDate)}
                    {s.lastDate && s.lastDate !== s.firstDate ? ` ~ ${formatDateFullCN(s.lastDate)}` : ''}
                  </span>
                )}
              </div>
              <div className={`phase-num ${delta === null ? '' : delta > 0 ? 'num-over' : delta < 0 ? 'num-under' : 'num-equal'}`}>
                <span className="phase-num-label">差值</span>
                <strong>
                  {delta === null
                    ? '—'
                    : delta === 0
                      ? '持平'
                      : delta > 0
                        ? `多用 ${delta} 天`
                        : `少用 ${-delta} 天`}
                </strong>
                {s.planned && s.actualDays > 0 && (
                  <span className="phase-num-sub">
                    首尾跨度 {diffDays(s.planned.start, s.lastDate!) + 1} 天
                  </span>
                )}
              </div>
              <div className="phase-num">
                <span className="phase-num-label">完成活数</span>
                <strong>{s.itemsTotal} 道</strong>
              </div>
            </div>

            {s.planned && (
              <div className="phase-diff">
                <div className={`diff-line ${s.idleDates.length === 0 ? 'diff-ok' : ''}`}>
                  <span className="diff-tag diff-idle">空耗日 {s.idleDates.length}</span>
                  {s.idleDates.length === 0 ? (
                    <span className="diff-dates">计划期内天天有活，没有空档。</span>
                  ) : (
                    <span className="diff-dates">
                      {s.idleDates.map((d) => formatDateCN(d)).join('、')}
                    </span>
                  )}
                </div>
                <div className={`diff-line ${s.overrunDates.length === 0 ? 'diff-ok' : ''}`}>
                  <span className="diff-tag diff-over">计划外施工 {s.overrunDates.length}</span>
                  {s.overrunDates.length === 0 ? (
                    <span className="diff-dates">没超出原定区间。</span>
                  ) : (
                    <span className="diff-dates">
                      {(() => {
                        const early = s.overrunDates.filter((d) => d < s.planned!.start);
                        const late = s.overrunDates.filter((d) => d > s.planned!.end);
                        const parts: string[] = [];
                        if (early.length)
                          parts.push(`提前/穿插：${early.map(formatDateCN).join('、')}`);
                        if (late.length)
                          parts.push(`拖期：${late.map(formatDateCN).join('、')}`);
                        return parts.join('；');
                      })()}
                    </span>
                  )}
                </div>
                <div className="diff-line">
                  <span className="diff-tag diff-actual">实际施工日</span>
                  <span className="diff-dates">
                    {s.actualDates.length ? s.actualDates.map(formatDateCN).join('、') : '暂无记录'}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
