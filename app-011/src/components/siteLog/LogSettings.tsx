import { useState } from 'react';
import type { Plan } from '../../types';
import { useStore } from '../../store';
import { workerLogCount } from '../../utils/siteLog';

interface Props {
  plan: Plan;
}

export default function LogSettings({ plan }: Props) {
  const {
    addWorker, updateWorker, deleteWorker,
    addPhase, updatePhase, deletePhase,
    addWorkKind, updateWorkKind, deleteWorkKind,
  } = useStore();
  const { workers, phases, workKinds, logs } = plan.siteLogs;

  const [workerName, setWorkerName] = useState('');
  const [workerTrade, setWorkerTrade] = useState('');
  const [phaseName, setPhaseName] = useState('');
  const [newKindName, setNewKindName] = useState<Record<string, string>>({});

  const sortedPhases = phases.slice().sort((a, b) => a.order - b.order);

  return (
    <div>
      {/* 工人名册 */}
      <div className="card">
        <h3 className="settings-title">工人名册</h3>
        <div className="toolbar">
          <input
            placeholder="工人姓名"
            value={workerName}
            onChange={(e) => setWorkerName(e.target.value)}
          />
          <input
            placeholder="工种（可选，如：水电工）"
            value={workerTrade}
            onChange={(e) => setWorkerTrade(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!workerName.trim()) return;
              addWorker(plan.id, workerName, workerTrade);
              setWorkerName('');
              setWorkerTrade('');
            }}
          >
            加工人
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>姓名</th>
              <th>工种</th>
              <th>出场次数</th>
              <th style={{ width: 90 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id}>
                <td>
                  <input
                    value={w.name}
                    onChange={(e) => updateWorker(plan.id, w.id, { name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={w.trade ?? ''}
                    placeholder="工种"
                    onChange={(e) => updateWorker(plan.id, w.id, { trade: e.target.value })}
                  />
                </td>
                <td>{workerLogCount(w.id, logs)}</td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (window.confirm(`删除工人「${w.name}」？历史日志里的点名会自动去掉，但到场总人数（含临时工）不受影响。`)) {
                        deleteWorker(plan.id, w.id);
                      }
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {workers.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-hint">
                  还没加工人。记日志时也可以只填到场总人数。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 施工阶段 + 工序分类 */}
      <div className="card">
        <h3 className="settings-title">施工阶段与工序分类</h3>
        <div className="hint">
          阶段用来按阶段汇总工期；工序分类用来归日志里的一道道活。删除阶段会一并删掉其下工序分类，已经记在日志里的活会自动变成「待认领」，不会丢。
        </div>
        <div className="toolbar">
          <input
            placeholder="新阶段名称，如：地暖"
            value={phaseName}
            onChange={(e) => setPhaseName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && phaseName.trim()) {
                addPhase(plan.id, phaseName);
                setPhaseName('');
              }
            }}
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!phaseName.trim()) return;
              addPhase(plan.id, phaseName);
              setPhaseName('');
            }}
          >
            加阶段
          </button>
        </div>

        <div className="phase-settings">
          {sortedPhases.map((ph) => {
            const kinds = workKinds.filter((k) => k.phaseId === ph.id);
            return (
              <div className="phase-setting-block" key={ph.id}>
                <div className="phase-setting-head">
                  <input
                    className="phase-name-input"
                    value={ph.name}
                    onChange={(e) => updatePhase(plan.id, ph.id, { name: e.target.value })}
                  />
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (window.confirm(`删除阶段「${ph.name}」？其下 ${kinds.length} 个工序分类一起删除，相关日志活变为待认领。`)) {
                        deletePhase(plan.id, ph.id);
                      }
                    }}
                  >
                    删阶段
                  </button>
                </div>
                <ul className="kind-list">
                  {kinds.map((k) => (
                    <li key={k.id}>
                      <input
                        value={k.name}
                        onChange={(e) => updateWorkKind(plan.id, k.id, { name: e.target.value })}
                      />
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => deleteWorkKind(plan.id, k.id)}
                      >
                        删
                      </button>
                    </li>
                  ))}
                  <li className="kind-add">
                    <input
                      placeholder="加一道工序分类，如：美缝"
                      value={newKindName[ph.id] ?? ''}
                      onChange={(e) =>
                        setNewKindName((prev) => ({ ...prev, [ph.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        const v = (newKindName[ph.id] ?? '').trim();
                        if (e.key === 'Enter' && v) {
                          addWorkKind(plan.id, v, ph.id);
                          setNewKindName((prev) => ({ ...prev, [ph.id]: '' }));
                        }
                      }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        const v = (newKindName[ph.id] ?? '').trim();
                        if (!v) return;
                        addWorkKind(plan.id, v, ph.id);
                        setNewKindName((prev) => ({ ...prev, [ph.id]: '' }));
                      }}
                    >
                      加分类
                    </button>
                  </li>
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
