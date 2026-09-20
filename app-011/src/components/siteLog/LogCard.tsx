import { useState } from 'react';
import type { Plan, SiteLog } from '../../types';
import { useStore } from '../../store';
import { attendance, roomLabel } from '../../utils/siteLog';
import { formatDateCN } from '../../utils/date';
import LogForm from './LogForm';

interface Props {
  plan: Plan;
  log: SiteLog;
}

export default function LogCard({ plan, log }: Props) {
  const { deleteSiteLog, addCorrection, deleteCorrection, assignWorkItem } = useStore();
  const [editing, setEditing] = useState(false);
  const [showCorrectionBox, setShowCorrectionBox] = useState(false);
  const [correctionText, setCorrectionText] = useState('');

  if (editing) {
    return <LogForm plan={plan} editing={log} onDone={() => setEditing(false)} />;
  }

  const kindName = (id: string | null) =>
    id ? plan.siteLogs.workKinds.find((k) => k.id === id)?.name ?? null : null;

  const workerNames = log.workerIds.map(
    (id) => plan.siteLogs.workers.find((w) => w.id === id)?.name ?? '已删除工人'
  );

  const submitCorrection = () => {
    if (!correctionText.trim()) return;
    addCorrection(plan.id, log.id, correctionText);
    setCorrectionText('');
    setShowCorrectionBox(false);
  };

  return (
    <div className="card log-card">
      <div className="log-card-head">
        <div className="log-card-title">
          <span className="log-date">{formatDateCN(log.date)}</span>
          <span className="log-room">{roomLabel(log)}</span>
          <span className="log-segment">第 {log.segment} 段</span>
        </div>
        <div className="log-card-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowCorrectionBox((v) => !v)}>
            追加更正
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            编辑
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm(`删除 ${log.date} ${roomLabel(log)} 第${log.segment}段日志？更正说明也会一并删除。`)) {
                deleteSiteLog(plan.id, log.id);
              }
            }}
          >
            删除
          </button>
        </div>
      </div>

      <div className="log-meta">
        <span>到场 <strong>{attendance(log)}</strong> 人</span>
        {workerNames.length > 0 && <span className="log-workers">{workerNames.join('、')}</span>}
        {log.extraWorkers > 0 && <span className="log-extra">临时工 {log.extraWorkers} 人</span>}
      </div>

      <div className="log-section">
        <div className="log-section-title">干完的活</div>
        <ul className="work-list">
          {log.workDone.map((it) => {
            const name = kindName(it.kindId);
            return (
              <li key={it.id}>
                <span className="work-text">{it.text}</span>
                {name ? (
                  <span className="tag tag-kind">{name}</span>
                ) : (
                  <span className="tag tag-unclaimed" title="这道活还没归到任何工序分类">
                    待认领
                  </span>
                )}
                <select
                  className="work-assign"
                  value={it.kindId ?? ''}
                  onChange={(e) => assignWorkItem(plan.id, log.id, it.id, e.target.value || null)}
                >
                  <option value="">待认领…</option>
                  {plan.siteLogs.phases
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((ph) => {
                      const kinds = plan.siteLogs.workKinds.filter((k) => k.phaseId === ph.id);
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
              </li>
            );
          })}
        </ul>
      </div>

      {log.issue.trim() && (
        <div className="log-section">
          <div className="log-section-title">问题</div>
          <p className="log-issue">{log.issue}</p>
        </div>
      )}

      {log.photos.length > 0 && (
        <div className="log-section">
          <div className="log-section-title">现场照片（{log.photos.length}）</div>
          <div className="photo-grid">
            {log.photos.map((ph) => (
              <figure key={ph.id} className="photo-figure">
                <a href={ph.dataUrl} target="_blank" rel="noreferrer">
                  <img src={ph.dataUrl} alt={ph.caption || '现场照片'} />
                </a>
                {ph.caption && <figcaption>{ph.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </div>
      )}

      {showCorrectionBox && (
        <div className="correction-box">
          <div className="hint">
            日志日期保存后不可修改。记错、漏记的内容请写成更正说明附在本条后面（只追加，不改正文）。
          </div>
          <textarea
            rows={2}
            className="log-textarea"
            placeholder="更正内容，如：到场人数应为 3 人，王师傅下午到场"
            value={correctionText}
            onChange={(e) => setCorrectionText(e.target.value)}
          />
          <div className="log-form-actions">
            <button className="btn btn-primary btn-sm" onClick={submitCorrection}>
              追加
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setShowCorrectionBox(false);
                setCorrectionText('');
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {log.corrections.length > 0 && (
        <div className="log-section corrections">
          <div className="log-section-title">更正说明（{log.corrections.length}）</div>
          {log.corrections.map((c) => (
            <div key={c.id} className="correction-item">
              <span className="correction-time">{new Date(c.createdAt).toLocaleString('zh-CN')}</span>
              <span>{c.text}</span>
              <button
                className="correction-del"
                title="删除这条更正"
                onClick={() => deleteCorrection(plan.id, log.id, c.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
