import { useState } from 'react';
import type { PainPoint } from '../../types/observer';
import { PAIN_TYPES } from '../../types/observer';
import { painPointsApi } from '../../api/observer';

interface Props {
  item: PainPoint | null;
  onSave: () => void;
  onClose: () => void;
}

export default function PainPointForm({ item, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    title: item?.title || '',
    type: item?.type || '',
    my_feeling: item?.my_feeling || '',
    life_impact: item?.life_impact || 50,
    urgency: item?.urgency || 2,
    change_plan: item?.change_plan || '',
    priority: item?.priority || 0,
  });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.title) { alert('请填写痛点标题'); return; }
    setSaving(true);
    try {
      if (item) {
        await painPointsApi.update(item.id, form);
      } else {
        await painPointsApi.create(form);
      }
      onSave();
    } catch (e: any) {
      alert('保存失败：' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle"></div>
        <div className="modal-header">
          <h3>人生痛点</h3>
          <p className="modal-subtitle">梳理情绪银河，托举自己前行</p>
        </div>

        <div className="form-fields">
          <div className="form-field">
            <label>痛点标题 *</label>
            <input type="text" placeholder="给这个痛点起个名字" value={form.title} onChange={set('title') as any} />
          </div>

          <div className="form-field">
            <label>类型</label>
            <div className="type-selector">
              {PAIN_TYPES.map(t => (
                <button key={t} className={`type-btn ${form.type === t ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, type: t }))}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label>我的感受</label>
            <textarea placeholder="这个痛点让你有什么感受？" value={form.my_feeling} onChange={set('my_feeling')} rows={2} />
          </div>

          <div className="form-field">
            <label>影响生活的占比：<span className="impact-value">{form.life_impact}%</span></label>
            <input
              type="range" min="0" max="100" step="5"
              value={form.life_impact}
              onChange={e => setForm(f => ({ ...f, life_impact: Number(e.target.value) }))}
              className="impact-slider"
            />
            <div className="slider-labels"><span>0%</span><span>100%</span></div>
          </div>

          <div className="form-field">
            <label>改变的紧急程度</label>
            <div className="urgency-selector">
              {[
                { v: 1, label: '可以等等' },
                { v: 2, label: '需要关注' },
                { v: 3, label: '紧急处理' },
              ].map(u => (
                <button key={u.v} className={`urgency-btn ${form.urgency === u.v ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, urgency: u.v }))}>
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label>优先级</label>
            <div className="priority-selector">
              {[0, 1, 2, 3].map(p => (
                <button key={p} className={`priority-sel-btn p${p} ${form.priority === p ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, priority: p }))}>
                  P{p}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label>改变计划</label>
            <textarea placeholder="你打算怎么改变这个情况？" value={form.change_plan} onChange={set('change_plan')} rows={3} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '完成'}
          </button>
        </div>
      </div>
    </div>
  );
}
