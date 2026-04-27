import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { GalaxyThought } from '../types/observer';
import { galaxyApi } from '../api/observer';

interface Props {
  onBack: () => void;
}

// 星空背景 Canvas 动画
function StarryBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.003 + 0.001,
      phase: Math.random() * Math.PI * 2,
    }));

    let animId: number;
    let t = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        const o = s.opacity * (0.6 + 0.4 * Math.sin(t * s.speed * 60 + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${o})`;
        ctx.fill();
      });
      t++;
      animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} className="starry-canvas" />;
}

// 灵感 emoji 映射
const INSPIRATION_EMOJIS = ['✨', '💡', '🌟', '🔥', '💫', '⚡', '🦋', '🌈', '🎯', '💫', '💭', '🌊'];

function getEmoji(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return INSPIRATION_EMOJIS[Math.abs(hash) % INSPIRATION_EMOJIS.length];
}

// 根据文字长度动态计算字号
function getTextSize(content: string): number {
  const len = content.length;
  if (len <= 20) return 16;
  if (len <= 40) return 14.5;
  if (len <= 80) return 13;
  return 12;
}

// 卡片轮播组件
function CardSwiper({
  thoughts,
  onToggle,
  onDelete,
  onAdd,
}: {
  thoughts: GalaxyThought[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('left');
  const [swiping, setSwiping] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  // 点击外部关闭操作弹窗
  useEffect(() => {
    if (!showActions) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showActions]);

  const goNext = useCallback(() => {
    if (thoughts.length <= 1) return;
    setDirection('left');
    setExpanded(false);
    setSwiping(true);
    setTimeout(() => {
      setCurrent(prev => (prev + 1) % thoughts.length);
      setSwiping(false);
    }, 280);
  }, [thoughts.length]);

  const goPrev = useCallback(() => {
    if (thoughts.length <= 1) return;
    setDirection('right');
    setExpanded(false);
    setSwiping(true);
    setTimeout(() => {
      setCurrent(prev => (prev - 1 + thoughts.length) % thoughts.length);
      setSwiping(false);
    }, 280);
  }, [thoughts.length]);

  // 触摸事件
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    longPressTimer.current = setTimeout(() => {
      setShowActions(true);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (Math.abs(touchDeltaX.current) > 50) {
      if (touchDeltaX.current < 0) goNext();
      else goPrev();
    }
    touchDeltaX.current = 0;
  };

  // 键盘事件
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (expanded) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, expanded]);

  if (thoughts.length === 0) {
    return (
      <div className="galaxy-empty">
        <div className="galaxy-empty-icon">🌌</div>
        <p>银河里还没有灵感碎片</p>
        <p>在速记中写下灵感，它们会自动来到这里</p>
        <button className="galaxy-add-btn" onClick={onAdd}>
          <span>+ 记录第一个灵感</span>
        </button>
      </div>
    );
  }

  const thought = thoughts[current];
  const emoji = getEmoji(thought.id);
  const textSize = getTextSize(thought.content);

  // 左右邻居卡片
  const prevIdx = (current - 1 + thoughts.length) % thoughts.length;
  const nextIdx = (current + 1) % thoughts.length;
  const prevThought = thoughts[prevIdx];
  const nextThought = thoughts[nextIdx];
  const prevEmoji = getEmoji(prevThought.id);
  const nextEmoji = getEmoji(nextThought.id);

  return (
    <div className="card-swiper-container">
      {/* 左右切换热区 */}
      <div className="swiper-nav-area swiper-nav-left" onClick={goPrev} />
      <div className="swiper-nav-area swiper-nav-right" onClick={goNext} />

      {/* 卡片展示区域 */}
      <div
        className="card-stack-area"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 左侧卡片 */}
        <div className={`swiper-side-card swiper-side-left ${swiping ? 'swiper-side-left-out' : ''}`}>
          <div className="side-card-emoji">{prevEmoji}</div>
          <div className="side-card-text">{prevThought.content}</div>
        </div>

        {/* 右侧卡片 */}
        <div className={`swiper-side-card swiper-side-right ${swiping ? 'swiper-side-right-out' : ''}`}>
          <div className="side-card-emoji">{nextEmoji}</div>
          <div className="side-card-text">{nextThought.content}</div>
        </div>

        {/* 主卡片 */}
        <div
          className={`main-card ${swiping ? (direction === 'left' ? 'swipe-out-left' : 'swipe-out-right') : 'swipe-in'} ${expanded ? 'main-card-expanded' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowActions(prev => !prev);
          }}
        >
          <div className="main-card-emoji">{emoji}</div>
          <div className="main-card-content">
            <p className="main-card-text" style={{ fontSize: `${textSize}px` }}>{thought.content}</p>
          </div>
          <div className="main-card-footer">
            <span className="main-card-source">
              {thought.is_done ? '✅ 已落地' : thought.source === 'daily_note' ? '📝 来自速记' : '💫 灵感'}
            </span>
            <span className="main-card-index">{current + 1} / {thoughts.length}</span>
          </div>
        </div>

        {/* 长按/点击操作弹窗 */}
        {showActions && (
          <div className="card-action-popup" ref={popupRef} onClick={e => e.stopPropagation()}>
            <button
              className={`card-action-btn ${thought.is_done ? 'action-undone' : 'action-done'}`}
              onClick={(e) => { e.stopPropagation(); onToggle(thought.id); setShowActions(false); }}
            >
              {thought.is_done ? '↩ 重新落地' : '✓ 已落地'}
            </button>
            <button className="card-action-btn action-delete" onClick={(e) => { e.stopPropagation(); setShowActions(false); setShowConfirm(true); }}>
              删除
            </button>
          </div>
        )}

        {/* 删除确认弹窗 - Portal 到 body 避免被父容器影响定位 */}
        {showConfirm && createPortal(
          <div className="confirm-overlay" onClick={() => setShowConfirm(false)}>
            <div className="confirm-dialog confirm-dialog-dark" onClick={e => e.stopPropagation()}>
              <p className="confirm-text">确认删除这条灵感？</p>
              <div className="confirm-actions">
                <button className="confirm-cancel confirm-cancel-dark" onClick={() => setShowConfirm(false)}>取消</button>
                <button className="confirm-ok" onClick={() => { setShowConfirm(false); onDelete(thought.id); }}>删除</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* 底部指示器 */}
      <div className="swiper-dots" onClick={() => setShowActions(false)}>
        {thoughts.map((_, i) => (
          <div
            key={i}
            className={`swiper-dot ${i === current ? 'active' : ''}`}
            onClick={() => {
              setDirection(i > current ? 'left' : 'right');
              setExpanded(false);
              setSwiping(true);
              setTimeout(() => {
                setCurrent(i);
                setSwiping(false);
              }, 280);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function GalaxyPage({ onBack }: Props) {
  const [thoughts, setThoughts] = useState<GalaxyThought[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');

  const loadData = async () => {
    const data = await galaxyApi.list();
    setThoughts(data);
  };

  useEffect(() => { loadData(); }, []);

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    await galaxyApi.create({ content: newContent.trim(), tags: '灵感' });
    setNewContent('');
    setShowAdd(false);
    await loadData();
  };

  const handleToggle = async (id: string) => {
    await galaxyApi.toggle(id);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    await galaxyApi.delete(id);
    await loadData();
  };

  const filtered = thoughts.filter(t => {
    if (filter === 'todo') return !t.is_done;
    if (filter === 'done') return t.is_done;
    return true;
  });

  return (
    <div className="galaxy-page">
      <StarryBackground />

      {/* Header */}
      <div className="galaxy-header">
        <button className="close-circle-btn light" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4l8 8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="galaxy-header-center">
          <div className="galaxy-title">思绪银河</div>
          <div className="galaxy-subtitle">灵感像碎片在银河里流淌</div>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* 筛选器 */}
      <div className="galaxy-filter">
        {(['all', 'todo', 'done'] as const).map(f => (
          <button key={f} className={`galaxy-filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {{ all: '全部', todo: '待落地', done: '已落地' }[f]}
          </button>
        ))}
      </div>

      {/* 卡片轮播 */}
      <CardSwiper
        thoughts={filtered}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onAdd={() => setShowAdd(true)}
      />

      {/* 底部操作栏 */}
      <div className="galaxy-bottom">
        <button className="galaxy-bottom-btn" onClick={() => setShowAdd(true)}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="2" y="2" width="8" height="8" rx="2" fill="rgba(255,255,255,0.3)"/>
            <rect x="12" y="2" width="8" height="8" rx="2" fill="rgba(255,255,255,0.3)"/>
            <rect x="2" y="12" width="8" height="8" rx="2" fill="rgba(255,255,255,0.3)"/>
            <path d="M16 12v8M12 16h8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* 添加灵感弹窗 */}
      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal-sheet">
            <div className="modal-handle"></div>
            <div className="modal-header">
              <h3>✨ 记录灵感</h3>
            </div>
            <div className="form-fields">
              <div className="form-field">
                <textarea
                  placeholder="脑中闪过的想法，快记下来！"
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  rows={4}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>取消</button>
              <button className="btn-primary" onClick={handleAdd}>记录</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
