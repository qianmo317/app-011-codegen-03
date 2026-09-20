import { WORK_CATEGORY_LABELS } from '../types';
import type { WeekSummary as WeekSummaryType } from '../utils/logs';

interface Props {
  rows: WeekSummaryType[];
}

export default function WeekSummaryView({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="card empty-hint">还没有日志，先记一条再看周报。</div>
    );
  }
  return (
    <div className="card">
      <h3 className="section-title">按周汇总（按周一倒序）</h3>
      <table>
        <thead>
          <tr>
            <th>周（周一 ~ 周日）</th>
            <th>出勤天数</th>
            <th>日志段数</th>
            <th>到场合计（人次）</th>
            <th>涉及工序</th>
            <th>问题条数</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.monday}>
              <td>{r.week}</td>
              <td>{r.days}</td>
              <td>{r.logs}</td>
              <td>{r.workerCount}</td>
              <td>
                {r.categories.length === 0
                  ? '—'
                  : r.categories.map((c) => (
                      <span key={c} className="cat-badge cat-badge-set">
                        {WORK_CATEGORY_LABELS[c]}
                      </span>
                    ))}
              </td>
              <td className={r.problems > 0 ? 'problem-count' : ''}>{r.problems}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
