import { useState } from 'react';
import type { WorkLog, WorkCategory } from '../types';
import { WORK_CATEGORY_LABELS, WORK_CATEGORY_ORDER } from '../types';

interface Props {
  log: WorkLog;
  roomName: string;
  onEdit: () => void;
  onDelete: () => void;
  onAddCorrection: (text: string) => void;
  onClaim: (itemId: string, category: WorkCategory | null) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LogCard({
  log,
  roomName,
  onEdit,
  onDelete,
  onAddCorrection,
  onClaim,
}: Props) {
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [showPhotos, setShowPhotos] = useState(true);

  const weekday = WEEKDAYS[new Date(log.date + 'T00:00:00').getDay()];

  const submitCorrection = () => {
    if (!correctionText.trim()) return;
    onAddCorrection(correctionText);
    setCorrectionText('');
    setShowCorrection(false);
  };

  return (
    <div className="card log-card">
      <div className="log-head">
        <div className="log-date">
          <span className="log-date-main">{log.date}</span>
          <span className="log-weekday">周{weekday}</span>
          <span className="lock-badge" title="日期保存后锁定">🔒</span>
        </div>
        <div className="log-meta">
          <span className="room-tag">{roomName}</span>
          <span className="segment-tag">第 {log.segment} 段</span>
          <span className="worker-tag">👷 {log.workerCount} 人</span>
          {log.workerNames.length > 0 && (
            <span className="worker-names">{log.workerNames.join('、')}</span>
          )}
        </div>
        <div className="log-actions no-print">
          <button className="btn btn-secondary" onClick={onEdit}>
            编辑
          </button>
          <button className="btn btn-danger" onClick={onDelete}>
            删除
          </button>
        </div>
      </div>

      <ul className="work-item-list">
        {log.items.map((it) => (
          <li key={it.id} className={it.category ? '' : 'unclaimed-item'}>
            <span className="work-content">{it.content}</span>
            <select
              className={
                it.category ? 'cat-badge cat-badge-set' : 'cat-badge cat-badge-none'
              }
              value={it.category ?? ''}
              onChange={(e) =>
                onClaim(it.id, e.target.value === '' ? null : (e.target.value as WorkCategory))
              }
              title="归类到工序"
            >
              <option value="">待认领</option>
              {WORK_CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {WORK_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      {log.problems && (
        <div className="problem-box">
          <strong>问题：</strong>
          {log.problems}
        </div>
      )}

      {log.photos.length > 0 && (
        <div className="photo-section">
          <button className="link-btn no-print" onClick={() => setShowPhotos(!showPhotos)}>
            {showPhotos ? '收起' : '查看'}现场照片（{log.photos.length} 张）
          </button>
          {showPhotos && (
            <div className="photo-grid">
              {log.photos.map((p) => (
                <div key={p.id} className="photo-item">
                  <img src={p.dataUrl} alt={p.caption || '现场照片'} />
                  {p.caption && <p className="photo-caption">{p.caption}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {log.corrections.length > 0 && (
        <div className="correction-list">
          {log.corrections.map((c) => (
            <div key={c.id} className="correction-item">
              <span className="correction-mark">更正</span>
              <span>{c.text}</span>
              <span className="correction-time">{formatTime(c.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="no-print">
        {showCorrection ? (
          <div className="correction-form">
            <textarea
              rows={2}
              placeholder="更正说明：原文保留不改，只追加说明，如「当天到场实为 3 人，原记录 2 人有误」"
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
            />
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button className="btn btn-primary" onClick={submitCorrection}>
                追加更正
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowCorrection(false);
                  setCorrectionText('');
                }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button className="link-btn" onClick={() => setShowCorrection(true)}>
            + 追加更正说明（不改原记录）
          </button>
        )}
      </div>
    </div>
  );
}
