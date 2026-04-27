import { useState, useRef, useEffect } from 'react';
import type { DailyNote } from '../../types/observer';
import { MOOD_OPTIONS } from '../../types/observer';
import { dailyNotesApi } from '../../api/observer';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function formatDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日 周${WEEKDAYS[date.getDay()]}`;
}

function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// 移动端三列日期选择器
function DatePickerModal({
  value,
  onChange,
  onClose,
}: {
  value: Date;
  onChange: (d: Date) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(value.getFullYear());
  const [month, setMonth] = useState(value.getMonth() + 1);
  const [day, setDay] = useState(value.getDate());

  // 生成可选年份（最近5年）
  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);

  // 生成月份
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // 生成天数（根据年月）
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // 确保选择的日不超过当月最大天数
  useEffect(() => {
    if (day > daysInMonth) setDay(daysInMonth);
  }, [daysInMonth, day]);

  // 不能超过今天
  const isFutureDate = (y: number, m: number, d: number) => {
    const selected = new Date(y, m - 1, d);
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return selected > t;
  };

  // 滚动到当前选中项
  const colRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  useEffect(() => {
    // 延迟滚动确保 DOM 已渲染
    const timer = setTimeout(() => {
      colRefs[0].current?.children[years.indexOf(year)]?.scrollIntoView({ block: 'center' });
      colRefs[1].current?.children[month - 1]?.scrollIntoView({ block: 'center' });
      colRefs[2].current?.children[day - 1]?.scrollIntoView({ block: 'center' });
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleConfirm = () => {
    const d = new Date(year, month - 1, day);
    onChange(d);
    onClose();
  };

  const itemClass = (active: boolean, disabled: boolean) =>
    `picker-item ${active ? 'picker-item-active' : ''} ${disabled ? 'picker-item-disabled' : ''}`;

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-sheet" onClick={e => e.stopPropagation()}>
        <div className="picker-header">
          <button className="picker-cancel" onClick={onClose}>取消</button>
          <span className="picker-title">选择日期</span>
          <button className="picker-confirm" onClick={handleConfirm}>确定</button>
        </div>

        <div className="picker-highlight" />

        <div className="picker-columns">
          <div className="picker-column" ref={colRefs[0]}>
            {years.map(y => {
              const disabled = false;
              const active = y === year;
              return (
                <div key={y} className={itemClass(active, disabled)} onClick={() => !disabled && setYear(y)}>
                  {y}年
                </div>
              );
            })}
          </div>
          <div className="picker-column" ref={colRefs[1]}>
            {months.map(m => {
              const disabled = isFutureDate(year, m, 1);
              const active = m === month;
              return (
                <div key={m} className={itemClass(active, disabled)} onClick={() => !disabled && setMonth(m)}>
                  {m}月
                </div>
              );
            })}
          </div>
          <div className="picker-column" ref={colRefs[2]}>
            {days.map(d => {
              const disabled = isFutureDate(year, month, d);
              const active = d === day;
              return (
                <div key={d} className={itemClass(active, disabled)} onClick={() => !disabled && setDay(d)}>
                  {d}日
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface Props {
  item: DailyNote | null;
  onSave: () => void;
  onClose: () => void;
}

export default function DailyNoteForm({ item, onSave, onClose }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(
    item?.created_at ? new Date(item.created_at) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [form, setForm] = useState({
    small_joy: item?.small_joy || '',
    small_gain: item?.small_gain || '',
    inspiration: item?.inspiration || '',
    mood: item?.mood || '',
    mood_emoji: item?.mood_emoji || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const selectMood = (emoji: string, label: string) => setForm(f => ({ ...f, mood: label, mood_emoji: emoji }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (item) {
        await dailyNotesApi.update(item.id, form);
      } else {
        const dateStr = toDateStr(selectedDate);
        await dailyNotesApi.create({ ...form, date: dateStr });
      }
      onSave();
    } catch (e: any) {
      alert('保存失败：' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const isToday = toDateStr(selectedDate) === toDateStr(new Date());

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle"></div>
        <div className="modal-header">
          <h3>每日速记</h3>
          <p className="modal-subtitle">记录片刻的治愈与灵感</p>
        </div>

        <div className="form-fields">
          <div className="date-picker-row" onClick={() => setShowDatePicker(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="3" width="14" height="12" rx="2" stroke="#64748B" strokeWidth="1.4"/>
              <path d="M5 1v3M11 1v3" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M1 7h14" stroke="#64748B" strokeWidth="1.4"/>
            </svg>
            <span className="date-picker-text">{formatDate(selectedDate)}</span>
            {!isToday && <span className="date-picker-backfill">（补记）</span>}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 'auto', opacity: 0.4 }}>
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div className="form-field">
            <label>小确幸</label>
            <textarea placeholder="今天有什么小小的幸福瞬间？" value={form.small_joy} onChange={set('small_joy')} rows={2} />
          </div>
          <div className="form-field">
            <label>小收获</label>
            <textarea placeholder="今天学到了什么，有什么新发现？" value={form.small_gain} onChange={set('small_gain')} rows={2} />
          </div>
          <div className="form-field">
            <label>灵感闪念 ✨</label>
            <textarea placeholder="脑中闪过的想法，记下来！（会自动同步到思绪银河）" value={form.inspiration} onChange={set('inspiration')} rows={2} />
          </div>
          <div className="form-field">
            <label>心情</label>
            <div className="mood-selector">
              {MOOD_OPTIONS.map(m => (
                <button
                  key={m.emoji}
                  className={`mood-btn ${form.mood_emoji === m.emoji ? 'selected' : ''}`}
                  onClick={() => selectMood(m.emoji, m.label)}
                >
                  <span className="mood-emoji">{m.emoji}</span>
                  <span className="mood-label">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '完成'}
          </button>
        </div>
      </div>

      {/* 日期选择器弹窗 */}
      {showDatePicker && (
        <DatePickerModal
          value={selectedDate}
          onChange={setSelectedDate}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </div>
  );
}
