import { useState, useEffect } from 'react';
import type { Stats } from '../../types/observer';

interface Props {
  stats: Stats;
  onClose: () => void;
  onNavigateAI: () => void;
}

function ActivityHeatmap() {
  const [activityData, setActivityData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/activity-calendar?days=84')
      .then(r => r.json())
      .then(res => {
        setActivityData(res.data || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // 最近12周 (84天)，按 GitHub 贡献图排列：7行(周一~周日) x N列(周)
  const totalDays = 84;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 获取当天的星期几 (0=日, 1=一, ..., 6=六)
  const todayDayOfWeek = today.getDay();
  // 转为 0=一, 1=二, ..., 6=日
  const todayIndex = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;

  // 生成所有格子：从今天往前推
  const cells: Array<{ date: string; dayIndex: number; weekIndex: number; count: number }> = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0=一 ... 6=日
    const count = activityData[dateStr] || 0;
    cells.push({ date: dateStr, dayIndex: dayIdx, weekIndex: 0, count });
  }
  cells.reverse(); // 按时间正序

  // 计算周数和排列
  // 找到第一天的星期索引
  const firstDayIndex = cells[0]?.dayIndex ?? 0;
  // 总共需要多少列（周）
  const totalWeeks = Math.ceil((totalDays + firstDayIndex) / 7);

  // 建立 grid[row][col] 映射
  const grid: (typeof cells[number] | null)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: totalWeeks }, () => null)
  );
  let colOffset = 0;
  cells.forEach((cell, i) => {
    if (i === 0) {
      colOffset = cell.dayIndex; // 第一天所在的行偏移
    }
    const col = Math.floor((i + colOffset) / 7);
    const row = (i + colOffset) % 7;
    if (col < totalWeeks && row < 7) {
      grid[row][col] = cell;
    }
  });

  const weekLabels: string[] = [];
  // 月份标签
  const monthLabels: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  for (let c = 0; c < totalWeeks; c++) {
    // 取这列第一行有数据的格子
    const cell = grid[0][c] || grid[1]?.[c] || grid[2]?.[c];
    if (cell) {
      const month = parseInt(cell.date.split('-')[1]);
      if (month !== lastMonth) {
        monthLabels.push({ col: c, label: `${month}月` });
        lastMonth = month;
      }
    }
  }

  const getLevel = (count: number) => {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    return 3;
  };

  if (loading) {
    return <div className="heatmap-container"><div style={{ textAlign: 'center', color: '#999', fontSize: 13, padding: '20px 0' }}>加载中...</div></div>;
  }

  const totalActive = Object.values(activityData).reduce((a, b) => a + b, 0);

  return (
    <div className="heatmap-container">
      {/* 月份标签 */}
      <div className="heatmap-months" style={{ display: 'flex', paddingLeft: 0, marginBottom: 2 }}>
        {monthLabels.map((m, i) => (
          <span key={i} style={{
            position: 'relative',
            left: m.col * 15,
            fontSize: 10,
            color: '#999',
            width: 0,
            whiteSpace: 'nowrap'
          }}>
            {m.label}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex' }}>
        {/* 热力格子 */}
        <div className="heatmap-grid">
          {grid.map((row, rowIdx) =>
            row.map((cell, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={`heatmap-cell level-${cell ? getLevel(cell.count) : 0}`}
                title={cell ? `${cell.date}：${cell.count} 条记录` : ''}
              />
            ))
          )}
        </div>
      </div>

      {/* 底部说明 */}
      <div className="heatmap-footer">
        <span className="heatmap-total">共 {totalActive} 次记录</span>
        <div className="heatmap-legend">
          <span className="heatmap-legend-label">少</span>
          <div className="heatmap-cell level-0" style={{ width: 10, height: 10 }} />
          <div className="heatmap-cell level-1" style={{ width: 10, height: 10 }} />
          <div className="heatmap-cell level-2" style={{ width: 10, height: 10 }} />
          <div className="heatmap-cell level-3" style={{ width: 10, height: 10 }} />
          <span className="heatmap-legend-label">多</span>
        </div>
      </div>
    </div>
  );
}

export default function SidePanel({ stats, onClose, onNavigateAI }: Props) {
  return (
    <div className="side-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="side-panel">
        {/* 用户信息 */}
        <div className="side-user">
          <div className="side-level">
            <span className="level-label" style={{ fontWeight: 600, fontSize: 18, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>深观者<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1 9s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke="var(--color-text)" strokeWidth="1.4"/><circle cx="9" cy="9" r="2.5" stroke="var(--color-text)" strokeWidth="1.4"/></svg></span>
          </div>
        </div>

        {/* 统计数字 */}
        <div className="side-stats">
          <div className="stat-item">
            <div className="stat-num">{stats.totalNotes}</div>
            <div className="stat-name">记录</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">{stats.totalInspirations}</div>
            <div className="stat-name">灵感</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">{stats.streakDays}</div>
            <div className="stat-name">天</div>
          </div>
        </div>

        {/* 活跃热力图 */}
        <ActivityHeatmap />

        {/* 功能菜单 */}
        <div className="side-menu">
          <button className="side-menu-item" onClick={() => {
            alert('数据导出功能开发中...');
          }}>
            <span className="menu-icon">💬</span>
            <span>数据导出</span>
          </button>
          <button className="side-menu-item" onClick={onNavigateAI}>
            <span className="menu-icon">✨</span>
            <span>AI情感师沟通</span>
          </button>
        </div>

        <div className="side-footer">你和我灵魂的出口</div>
      </div>
    </div>
  );
}
