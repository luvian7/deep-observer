import { useState, useEffect } from 'react';
import type { CheckinType, CheckinRecord } from '../types/observer';
import { CHECKIN_ICONS, CHECKIN_COLORS } from '../types/observer';
import { checkinTypesApi, checkinRecordsApi } from '../api/observer';

interface Props {
  onBack: () => void;
}

const today = new Date().toISOString().split('T')[0];
const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

function getWeekDates() {
  const now = new Date();
  const day = now.getDay(); // 0=日
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() + mondayOffset + i);
    return d.toISOString().split('T')[0];
  });
}

function AddTypeModal({ onSave, onClose }: { onSave: () => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📚');
  const [target, setTarget] = useState('');
  const [color, setColor] = useState(CHECKIN_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name) { alert('请输入打卡名称'); return; }
    setSaving(true);
    try {
      await checkinTypesApi.create({ name, icon, target, color });
      onSave();
    } catch (e: any) { alert('保存失败：' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle"></div>
        <div className="modal-header">
          <h3>添加打卡类型</h3>
        </div>
        <div className="form-fields">
          <div className="form-field">
            <label>名称 *</label>
            <input type="text" placeholder="如：专注阅读" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label>图标</label>
            <div className="icon-selector">
              {CHECKIN_ICONS.map(ic => (
                <button key={ic} className={`icon-sel-btn ${icon === ic ? 'selected' : ''}`} onClick={() => setIcon(ic)}>{ic}</button>
              ))}
            </div>
          </div>
          <div className="form-field">
            <label>目标（可选）</label>
            <input type="text" placeholder="如：30分钟/日" value={target} onChange={e => setTarget(e.target.value)} />
          </div>
          <div className="form-field">
            <label>颜色</label>
            <div className="color-selector">
              {CHECKIN_COLORS.map(c => (
                <button key={c} className={`color-sel-btn ${color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '添加'}</button>
        </div>
      </div>
    </div>
  );
}

export default function CheckinPage({ onBack }: Props) {
  const [types, setTypes] = useState<CheckinType[]>([]);
  const [records, setRecords] = useState<Record<string, boolean>>({});
  const [weekRecords, setWeekRecords] = useState<Record<string, Record<string, boolean>>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [managing, setManaging] = useState(false);

  const weekDates = getWeekDates();
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  const loadData = async () => {
    try {
      const [typeList, recs] = await Promise.all([
        checkinTypesApi.list(),
        checkinRecordsApi.listByDate(today),
      ]);
      setTypes(typeList);
      const recMap: Record<string, boolean> = {};
      recs.forEach(r => { recMap[r.type_id] = r.checked === 1; });
      setRecords(recMap);

      // 加载本周记录用于进度展示
      if (typeList.length > 0) {
        const weekMap: Record<string, Record<string, boolean>> = {};
        for (const t of typeList) {
          const weekRecs = await checkinRecordsApi.range(t.id, weekDates[0], weekDates[6]);
          weekMap[t.id] = {};
          weekRecs.forEach(r => { weekMap[t.id][r.date] = r.checked === 1; });
        }
        setWeekRecords(weekMap);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadData(); }, []);

  const handleToggle = async (typeId: string) => {
    try {
      const result = await checkinRecordsApi.toggle(typeId, today);
      setRecords(r => ({ ...r, [typeId]: result.checked }));
      // 更新本周记录
      setWeekRecords(wr => ({
        ...wr,
        [typeId]: { ...(wr[typeId] || {}), [today]: result.checked }
      }));
    } catch (e: any) { alert('操作失败：' + e.message); }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm('删除此打卡类型及其所有记录？')) return;
    await checkinTypesApi.delete(id);
    await loadData();
  };

  // 计算本周完成天数
  const getWeekCount = (typeId: string) => {
    const wr = weekRecords[typeId] || {};
    return Object.values(wr).filter(Boolean).length;
  };

  return (
    <div className="page-container checkin-page">
      {/* Header */}
      <div className="modal-header-bar">
        <button className="close-circle-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4l8 8" stroke="#333" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="modal-header-center">
          <div className="modal-header-title">每日打卡</div>
          <div className="modal-header-sub">养成好习惯</div>
        </div>
        <button className="manage-btn" onClick={() => setManaging(m => !m)}>
          {managing ? '完成' : '管理'}
        </button>
      </div>

      <div className="checkin-content">
        {/* 打卡列表 */}
        <div className="checkin-list">
          {types.length === 0 && (
            <div className="empty-state">
              <span>📋</span>
              <p>还没有打卡类型，<br/>点击下方按钮添加</p>
            </div>
          )}
          {types.map(type => (
            <div key={type.id} className="checkin-item">
              <div className="checkin-icon-wrap" style={{ background: type.color + '22' }}>
                <span style={{ fontSize: 22 }}>{type.icon || '📌'}</span>
              </div>
              <div className="checkin-info">
                <div className="checkin-name">{type.name}</div>
                {type.target && <div className="checkin-target">{type.target}</div>}
              </div>
              {managing ? (
                <button className="delete-type-btn" onClick={() => handleDeleteType(type.id)}>删除</button>
              ) : (
                <button
                  className={`checkin-checkbox ${records[type.id] ? 'checked' : ''}`}
                  onClick={() => handleToggle(type.id)}
                  style={{ borderColor: records[type.id] ? type.color : '#ddd', background: records[type.id] ? type.color : 'transparent' }}
                >
                  {records[type.id] && (
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                      <path d="M1 5l4 4 8-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 添加按钮 */}
        <button className="add-type-btn" onClick={() => setShowAdd(true)}>
          <span>+</span> 添加打卡类型
        </button>

        {/* 习惯达成统计 */}
        {types.length > 0 && (
          <div className="habit-stats-card">
            <div className="habit-stats-header">
              <span className="habit-stats-title">习惯达成</span>
              <span className="habit-stats-sub">本周 ✓✓</span>
            </div>
            {types.map(type => {
              const count = getWeekCount(type.id);
              const wr = weekRecords[type.id] || {};
              return (
                <div key={type.id} className="habit-row">
                  <div className="habit-row-header">
                    <span className="habit-name">{type.name}</span>
                    <span className="habit-count">{count}天</span>
                  </div>
                  <div className="habit-bar-track">
                    {weekDates.map(d => (
                      <div key={d} className={`habit-bar-seg ${wr[d] ? 'done' : ''}`} style={{ background: wr[d] ? type.color : undefined }} />
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="weekday-labels">
              {weekDays.map((d, i) => (
                <span key={d} className={i === todayIdx ? 'today-label' : ''}>{d}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {showAdd && <AddTypeModal onSave={() => { setShowAdd(false); loadData(); }} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
