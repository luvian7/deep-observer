import { useState } from 'react';
import type { EmotionRecord } from '../../types/observer';
import { MOOD_OPTIONS } from '../../types/observer';
import { emotionRecordsApi } from '../../api/observer';

interface Props {
  item: EmotionRecord | null;
  onSave: () => void;
  onClose: () => void;
}

export default function EmotionForm({ item, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    trigger_event: item?.trigger_event || '',
    my_feeling: item?.my_feeling || '',
    discovery: item?.discovery || '',
    next_action: item?.next_action || '',
    mood_emoji: item?.mood_emoji || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.trigger_event && !form.my_feeling) {
      alert('请至少填写触发事件或感受');
      return;
    }
    setSaving(true);
    try {
      if (item) {
        await emotionRecordsApi.update(item.id, form);
      } else {
        await emotionRecordsApi.create(form);
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
          <h3>情绪梳理</h3>
          <p className="modal-subtitle">复盘你的情绪波动，找到规律</p>
        </div>

        <div className="form-fields">
          <div className="form-field">
            <label>触发事件</label>
            <textarea placeholder="什么事情触发了这个情绪？" value={form.trigger_event} onChange={set('trigger_event')} rows={2} />
          </div>

          <div className="form-field">
            <label>我的感受</label>
            <div className="mood-selector" style={{ marginBottom: 8 }}>
              {MOOD_OPTIONS.map(m => (
                <button
                  key={m.emoji}
                  className={`mood-btn ${form.mood_emoji === m.emoji ? 'selected' : ''}`}
                  onClick={() => setForm(f => ({ ...f, mood_emoji: m.emoji, my_feeling: f.my_feeling || m.label }))}
                >
                  <span className="mood-emoji">{m.emoji}</span>
                  <span className="mood-label">{m.label}</span>
                </button>
              ))}
            </div>
            <textarea placeholder="更详细地描述你的感受..." value={form.my_feeling} onChange={set('my_feeling')} rows={2} />
          </div>

          <div className="form-field">
            <label>让我发现</label>
            <textarea placeholder="从这个情绪中，你发现了什么关于自己的信息？" value={form.discovery} onChange={set('discovery')} rows={2} />
          </div>

          <div className="form-field">
            <label>下次这样做</label>
            <textarea placeholder="下次遇到类似情况，你会怎么做？" value={form.next_action} onChange={set('next_action')} rows={2} />
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
