import { useState } from 'react';
import type { Plan } from '../../types';
import type { WeekStats } from '../../utils/siteLog';
import { attendance, roomLabel } from '../../utils/siteLog';
import { formatDateCN, weekLabel } from '../../utils/date';
import LogCard from './LogCard';

interface Props {
  plan: Plan;
  weeks: WeekStats[];
}

export default function WeekSummary({ plan, weeks }: Props) {
  const [open, setOpen] = useState<string | null>(weeks[0]?.weekStart ?? null);

  if (weeks.length === 0) {
    return <div className="card empty-hint">当前筛选下没有日志，无法汇总。</div>;
  }

  return (
    <div>
      {weeks.map((w) => {
        const expanded = open === w.weekStart;
        return (
          <div className="card week-card" key={w.weekStart}>
            <button className="week-head" onClick={() => setOpen(expanded ? null : w.weekStart)}>
              <span className="week-label">{weekLabel(w.weekStart)}</span>
              <span className="week-nums">
                <span>施工 <strong>{w.workDays}</strong> 天</span>
                <span>日志 <strong>{w.entries}</strong> 段</span>
                <span>房间 <strong>{w.rooms}</strong> 个</span>
                <span>到场 <strong>{w.attendanceTotal}</strong> 人次</span>
                <span>完成 <strong>{w.itemsTotal}</strong> 道活</span>
                <span>照片 <strong>{w.photosTotal}</strong> 张</span>
                {w.issues.length > 0 && <span className="week-issue">问题 {w.issues.length} 条</span>}
              </span>
              <span className="week-caret">{expanded ? '收起 ▲' : '展开 ▼'}</span>
            </button>

            {expanded && (
              <div className="week-body">
                {w.issues.length > 0 && (
                  <div className="week-issues">
                    <div className="log-section-title">本周碰到的问题</div>
                    <ul>
                      {w.issues.map((l) => (
                        <li key={l.id}>
                          <span className="week-issue-date">
                            {formatDateCN(l.date)} · {roomLabel(l)}（第{l.segment}段）
                          </span>
                          {l.issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <table className="week-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>房间/段</th>
                      <th>到场</th>
                      <th>干的活</th>
                      <th>照片</th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.logs.map((l) => (
                      <tr key={l.id}>
                        <td>{formatDateCN(l.date)}</td>
                        <td>
                          {roomLabel(l)} · 第{l.segment}段
                        </td>
                        <td>{attendance(l)} 人</td>
                        <td>{l.workDone.map((it) => it.text).join('；') || '—'}</td>
                        <td>{l.photos.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="week-logs">
                  {w.logs.map((l) => (
                    <LogCard key={l.id} plan={plan} log={l} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
