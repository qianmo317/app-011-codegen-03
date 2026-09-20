import type { Plan } from '../../types';
import { useStore } from '../../store';
import { formatDateCN } from '../../utils/date';
import { roomLabel } from '../../utils/siteLog';

interface Props {
  plan: Plan;
  /** true：只列没归工序的；false：列出全部日志活，方便人工复查 */
  onlyUnclaimed?: boolean;
}

/**
 * 归不到工序的活单独列出来等人工认领：
 * - 记日志时没选工序
 * - 或选的工序分类后来被删了
 */
export default function UnclaimedQueue({ plan, onlyUnclaimed = true }: Props) {
  const { assignWorkItem } = useStore();
  const { workKinds, phases, logs } = plan.siteLogs;

  const rows = logs
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.segment - b.segment))
    .flatMap((log) =>
      log.workDone.map((item) => {
        const kind = item.kindId ? workKinds.find((k) => k.id === item.kindId) : undefined;
        const unclaimed = !kind;
        return { log, item, kind, unclaimed };
      })
    )
    .filter((r) => (onlyUnclaimed ? r.unclaimed : true));

  return (
    <div className="card">
      <h3 className="queue-title">
        {onlyUnclaimed ? `待认领会工（${rows.length}）` : `全部活（${rows.length}）`}
      </h3>
      {rows.length === 0 ? (
        <p className="empty-hint">
          {onlyUnclaimed ? '所有活都归上工序了，干得漂亮。' : '还没有日志。'}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: 110 }}>日期</th>
              <th style={{ width: 120 }}>房间</th>
              <th>干的活</th>
              <th style={{ width: 260 }}>认领到工序</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ log, item, kind }) => (
              <tr key={item.id} className={kind ? '' : 'row-unclaimed'}>
                <td>{formatDateCN(log.date)}</td>
                <td>
                  {roomLabel(log)} · 第{log.segment}段
                </td>
                <td>{item.text}</td>
                <td>
                  <select
                    value={kind ? kind.id : ''}
                    onChange={(e) => assignWorkItem(plan.id, log.id, item.id, e.target.value || null)}
                  >
                    <option value="">—— 待认领 ——</option>
                    {phases
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((ph) => {
                        const ks = workKinds.filter((k) => k.phaseId === ph.id);
                        if (ks.length === 0) return null;
                        return (
                          <optgroup key={ph.id} label={ph.name}>
                            {ks.map((k) => (
                              <option key={k.id} value={k.id}>
                                {k.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
