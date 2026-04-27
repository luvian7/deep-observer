import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AppPage, DailyNote, EmotionRecord, PainPoint, MainTab } from '../types/observer';
import { dailyNotesApi, emotionRecordsApi, painPointsApi, statsApi } from '../api/observer';
import DailyNoteForm from '../components/observer/DailyNoteForm';
import EmotionForm from '../components/observer/EmotionForm';
import PainPointForm from '../components/observer/PainPointForm';
import SidePanel from '../components/observer/SidePanel';

interface HomePageProps {
  onNavigate: (page: AppPage) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 检测元素内容是否溢出（scrollHeight > clientHeight） */
function useIsOverflow(ref: React.RefObject<HTMLDivElement | null>) {
  const [isOverflow, setIsOverflow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setIsOverflow(el.scrollHeight > el.clientHeight);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return isOverflow;
}
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} 周${WEEKDAYS[d.getDay()]}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return '夜深了，';
  if (h < 12) return '早上好，';
  if (h < 14) return '中午好，';
  if (h < 18) return '下午好，';
  return '晚上好，';
}

function getDateLabel() {
  const d = new Date();
  const months = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  return `${months[d.getMonth()]} ${d.getDate()}日`;
}

/** 更多操作按钮（三点图标 + 气泡弹窗） */
function MoreMenu({ onEdit, onDelete }: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const handleDelete = () => {
    setShowMenu(false);
    setShowConfirm(true);
  };

  return (
    <div className="more-btn-wrap" ref={menuRef}>
      <button className="more-icon-btn" onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="3" r="1.3" fill="#999"/>
          <circle cx="8" cy="8" r="1.3" fill="#999"/>
          <circle cx="8" cy="13" r="1.3" fill="#999"/>
        </svg>
      </button>
      {showMenu && (
        <div className="card-action-bubble">
          <button onClick={e => { e.stopPropagation(); onEdit(); setShowMenu(false); }}>编辑</button>
          <button className="bubble-delete" onClick={e => { e.stopPropagation(); handleDelete(); }}>删除</button>
        </div>
      )}
      {showConfirm && createPortal(
        <div className="confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <p className="confirm-text">确认删除这条记录？</p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setShowConfirm(false)}>取消</button>
              <button className="confirm-ok" onClick={() => { setShowConfirm(false); onDelete(); }}>删除</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/** 情绪梳理卡片（带溢出检测，内容不溢出时隐藏展开按钮） */
function EmotionCard({ record, onEdit, onDelete }: {
  record: EmotionRecord;
  onEdit: (item: EmotionRecord) => void;
  onDelete: (id: string) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const isOverflow = useIsOverflow(bodyRef);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`record-card ${expanded ? 'expanded' : ''}`}>
      <div className="card-header" onClick={() => onEdit(record)} style={{ cursor: 'pointer' }}>
        <span className="card-header-title">{record.mood_emoji} {record.my_feeling || '无感受记录'}</span>
        <MoreMenu onEdit={() => onEdit(record)} onDelete={() => onDelete(record.id)} />
      </div>
      <div className="card-body-collapsible" ref={bodyRef}>
        <div className="card-fields">
          {record.trigger_event && (
            <div className="field-row">
              <span className="field-label bold">触发事件</span>
              <span className="field-value">{record.trigger_event}</span>
            </div>
          )}
          {record.discovery && (
            <div className="field-row">
              <span className="field-label bold">让我发现</span>
              <span className="field-value">{record.discovery}</span>
            </div>
          )}
          {record.next_action && (
            <div className="field-row">
              <span className="field-label bold">下次这样做</span>
              <span className="field-value">{record.next_action}</span>
            </div>
          )}
        </div>
      </div>
      {isOverflow && (
        <button className="card-expand-btn" onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}>
          <svg className="expand-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

/** 人生痛点卡片（带溢出检测，内容不溢出时隐藏展开按钮） */
function PainCard({ record, onEdit, onDelete }: {
  record: PainPoint;
  onEdit: (item: PainPoint) => void;
  onDelete: (id: string) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const isOverflow = useIsOverflow(bodyRef);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`pain-card ${record.priority === 0 ? 'pain-card-top' : ''} ${expanded ? 'expanded' : ''}`} onClick={() => onEdit(record)}>
      <div className="pain-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`priority-badge p${record.priority}`}>P{record.priority}</span>
          <span className="pain-title">{record.title}</span>
        </div>
        <MoreMenu onEdit={() => onEdit(record)} onDelete={() => onDelete(record.id)} />
      </div>
      <div className="card-body-collapsible" ref={bodyRef}>
        <div className="pain-card-body">
          <div style={{ minWidth: 0 }}>
            {record.my_feeling && (
              <>
                <div className="pain-label">主要感受</div>
                <div className="pain-feeling">{record.my_feeling}</div>
              </>
            )}
            {record.change_plan && (
              <div className="pain-plan">计划: {record.change_plan}</div>
            )}
          </div>
          <div>
            <div className="pain-label">生活影响度</div>
            <div className="pain-impact">{record.life_impact}%</div>
          </div>
        </div>
      </div>
      {isOverflow && (
        <button className="card-expand-btn" onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}>
          <svg className="expand-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const [tab, setTab] = useState<MainTab>('daily');
  const [dailyNotes, setDailyNotes] = useState<DailyNote[]>([]);
  const [emotionRecords, setEmotionRecords] = useState<EmotionRecord[]>([]);
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
  const [stats, setStats] = useState({ totalNotes: 0, totalInspirations: 0, streakDays: 0 });
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<DailyNote | EmotionRecord | PainPoint | null>(null);
  const [showSide, setShowSide] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [notes, emotions, pains, s] = await Promise.all([
        dailyNotesApi.list(),
        emotionRecordsApi.list(),
        painPointsApi.list(),
        statsApi.get(),
      ]);
      setDailyNotes(notes);
      setEmotionRecords(emotions);
      setPainPoints(pains);
      setStats(s);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = () => { setEditItem(null); setShowForm(true); };
  const handleEdit = (item: DailyNote | EmotionRecord | PainPoint) => { setEditItem(item); setShowForm(true); };

  const handleFormSave = async () => {
    setShowForm(false);
    setEditItem(null);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    if (tab === 'daily') await dailyNotesApi.delete(id);
    else if (tab === 'emotion') await emotionRecordsApi.delete(id);
    else if (tab === 'pain') await painPointsApi.delete(id);
    await loadData();
  };

  return (
    <div className="figma-page-container">
      {/* 首页 Header */}
      <div className="home-header">
        <div className="header-top">
          <button className="icon-btn" onClick={() => setShowSide(true)}>
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
              <path d="M0 1h20M0 7h14M0 13h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <span></span>
          <div className="header-icons">
            <button className="icon-btn" onClick={() => onNavigate('report')}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="2" y="2" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 7h3M7 11h8M7 15h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="icon-btn" onClick={() => onNavigate('ai')}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 1l2.47 5.01L19 7.12l-4 3.9.94 5.51L11 13.77l-4.94 2.76L7 10.98 3 7.12l5.53-1.11L11 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="greeting-area">
          <div>
            <div className="date-label">{getDateLabel()}</div>
            <div className="greeting-text">
              {getGreeting()}
              <br/>
              <span className="greeting-sub">今天感觉如何？</span>
            </div>
          </div>
          <div className="orb-decoration">
            <div className="orb-rotate">
              <img className="orb" src="/assets/orb-glow.png" alt="orb" />
            </div>
          </div>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="tab-bar">
        {(['daily', 'emotion', 'pain'] as MainTab[]).map((t) => {
          const labels = { daily: '每日速记', emotion: '情绪梳理', pain: '人生痛点' };
          return (
            <button key={t} className={`tab-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* 内容区 */}
      <div className="content-area">
        {tab === 'daily' && (
          <div className="record-list">
            {dailyNotes.length === 0 && (
              <div className="empty-state">
                <span>✨</span>
                <p>还没有速记，<br/>点击 + 开始记录今天的小确幸</p>
              </div>
            )}
            {dailyNotes.map(note => (
              <div key={note.id} className="record-card" onClick={() => handleEdit(note)}>
                <div className="card-header" onClick={() => handleEdit(note)} style={{ cursor: 'pointer' }}>
                  <span className="card-time">{formatDateTime(note.created_at)}</span>
                  <MoreMenu onEdit={() => handleEdit(note)} onDelete={() => handleDelete(note.id)} />
                </div>
                <div className="card-fields">
                  {note.small_joy && (
                    <div className="field-row">
                      <span className="field-label bold">小确幸</span>
                      <span className="field-value">{note.small_joy}</span>
                    </div>
                  )}
                  {note.small_gain && (
                    <div className="field-row">
                      <span className="field-label bold">小收获</span>
                      <span className="field-value">{note.small_gain}</span>
                    </div>
                  )}
                  {note.inspiration && (
                    <div className="field-row">
                      <span className="field-label bold">灵感闪念</span>
                      <span className="field-value">{note.inspiration}</span>
                    </div>
                  )}
                  {note.mood && (
                    <div className="field-row">
                      <span className="field-label bold">心情</span>
                      <span className="field-value">{note.mood_emoji} {note.mood}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'emotion' && (
          <div className="record-list">
            {emotionRecords.length === 0 && (
              <div className="empty-state">
                <span>💭</span>
                <p>还没有情绪记录，<br/>点击 + 开始梳理今天的情绪</p>
              </div>
            )}
            {emotionRecords.map(rec => (
              <EmotionCard key={rec.id} record={rec} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {tab === 'pain' && (
          <div className="record-list">
            {painPoints.length === 0 && (
              <div className="empty-state">
                <span>🌌</span>
                <p>还没有痛点记录，<br/>点击 + 开始梳理你的人生痛点</p>
              </div>
            )}
            {painPoints.map(point => (
              <PainCard key={point.id} record={point} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* 底部导航 */}
      <div className="bottom-nav">
        <button className="nav-item" onClick={() => onNavigate('checkin')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 4V2M16 4V2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span>每日打卡</span>
        </button>

        <button className="fab-btn" onClick={handleAdd}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M0 12h24M12 0v24" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>

        <button className="nav-item" onClick={() => onNavigate('galaxy')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="1.6"/>
            <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.6" transform="rotate(-30 12 12)"/>
          </svg>
          <span>思绪银河</span>
        </button>
      </div>

      {/* 新增/编辑表单弹窗 */}
      {showForm && tab === 'daily' && (
        <DailyNoteForm
          item={editItem as DailyNote | null}
          onSave={handleFormSave}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}
      {showForm && tab === 'emotion' && (
        <EmotionForm
          item={editItem as EmotionRecord | null}
          onSave={handleFormSave}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}
      {showForm && tab === 'pain' && (
        <PainPointForm
          item={editItem as PainPoint | null}
          onSave={handleFormSave}
          onClose={() => { setShowForm(false); setEditItem(null); }}
        />
      )}

      {/* 个人中心侧边栏 */}
      {showSide && (
        <SidePanel stats={stats} onClose={() => setShowSide(false)} onNavigateAI={() => { setShowSide(false); onNavigate('ai'); }} />
      )}
    </div>
  );
}
