import { useState, useEffect, useMemo, useRef } from 'react';
import { weeklyReportApi, type WeeklyReport } from '../api/observer';

interface ReportPageProps {
  onBack: () => void;
}

const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function getWeekDates(startStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startStr + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// 将 emoji 映射为情绪分数 (1-5, 5最积极)
function moodToScore(emoji: string): number {
  const map: Record<string, number> = {
    '🤩': 5, '😊': 4.5, '😄': 4, '😌': 3.5, '🙂': 3,
    '😐': 2.5, '😔': 2, '😟': 1.8, '😤': 1.5, '😰': 1.3,
    '😢': 1, '😞': 1.2,
  };
  return map[emoji] || 3;
}

// 获取每日平均情绪分
function getDailyMoodScores(report: WeeklyReport): { day: string; label: string; score: number; count: number }[] {
  const dates = getWeekDates(report.weekRange.start);
  return dates.map((date, idx) => {
    const dayEmotions = report.emotions.items.filter(e => e.created_at.startsWith(date));
    const dayNotes = report.dailyNotes.items.filter(n => n.created_at.startsWith(date) && n.mood_emoji);

    const allMoods = [
      ...dayEmotions.filter(e => e.mood_emoji).map(e => moodToScore(e.mood_emoji!)),
      ...dayNotes.filter(n => n.mood_emoji).map(n => moodToScore(n.mood_emoji!)),
    ];

    return {
      day: date,
      label: WEEK_DAYS[idx],
      score: allMoods.length > 0 ? allMoods.reduce((a, b) => a + b, 0) / allMoods.length : 0,
      count: allMoods.length,
    };
  });
}

function generateAnalysisItems(r: WeeklyReport): { icon: string; title: string; text: string }[] {
  const items: { icon: string; title: string; text: string }[] = [];
  const totalRecords = r.dailyNotes.count + r.emotions.count + r.painPoints.count;

  if (totalRecords === 0) {
    items.push({
      icon: '📝',
      title: '开始你的记录之旅',
      text: '本周还没有记录，每天花几分钟回顾，能帮助你更好地了解自己。试试从一条速记开始！',
    });
    return items;
  }

  // 记录活跃度
  const activeDays = Object.values(r.dailyCounts).filter(c => c.notes + c.emotions + c.pains > 0).length;
  if (activeDays >= 5) {
    items.push({
      icon: '🔥',
      title: '记录习惯非常好',
      text: `本周有 ${activeDays} 天在记录，继续保持这个好习惯！持续的自我观察是成长的基石。`,
    });
  } else if (activeDays >= 3) {
    items.push({
      icon: '📈',
      title: '保持记录节奏',
      text: `本周有 ${activeDays} 天在记录，还不错！试着增加到每天一条，效果会更明显。`,
    });
  } else {
    items.push({
      icon: '💡',
      title: '增加记录频率',
      text: `本周只记录了 ${activeDays} 天，试着每天留几分钟给自己，记录能帮你觉察情绪变化。`,
    });
  }

  // 情绪分析
  const positiveEmojis = ['😊', '😌', '🤩', '😄', '🙂'];
  const negativeEmojis = ['😢', '😤', '😰', '😔', '😞'];
  let positiveCount = 0, negativeCount = 0;
  for (const [emoji, count] of Object.entries(r.moodDistribution)) {
    if (positiveEmojis.includes(emoji)) positiveCount += count;
    if (negativeEmojis.includes(emoji)) negativeCount += count;
  }

  if (positiveCount > negativeCount * 2 && positiveCount > 0) {
    items.push({
      icon: '😊',
      title: '情绪状态良好',
      text: `正面情绪(${positiveCount}次)远超负面情绪(${negativeCount}次)，本周心理状态很不错，继续做自己喜欢的事！`,
    });
  } else if (negativeCount > positiveCount && negativeCount > 0) {
    items.push({
      icon: '🫂',
      title: '关注情绪波动',
      text: `负面情绪(${negativeCount}次)多于正面(${positiveCount}次)，记得给自己一些温柔，可以尝试运动或冥想来调节。`,
    });
  } else if (positiveCount > 0 || negativeCount > 0) {
    items.push({
      icon: '🌊',
      title: '情绪有起伏',
      text: `正面${positiveCount}次 vs 负面${negativeCount}次，情绪起伏是正常的，觉察就是改变的第一步。`,
    });
  }

  // 痛点分析
  if (r.painPoints.count > 0) {
    if (r.avgImpact >= 70) {
      items.push({
        icon: '🎯',
        title: '重点解决高影响痛点',
        text: `有 ${r.painPoints.count} 个痛点，平均影响度 ${r.avgImpact}/100，建议优先关注高优先级痛点并制定具体改善计划。`,
      });
    } else {
      items.push({
        icon: '🌱',
        title: '逐步改善痛点',
        text: `记录了 ${r.painPoints.count} 个痛点，平均影响度 ${r.avgImpact}/100，在可控范围内，按计划逐步改善就好。`,
      });
    }
  }

  // 灵感
  if (r.weekInspirationCount > 0) {
    items.push({
      icon: '✨',
      title: '灵感闪念',
      text: `本周有 ${r.weekInspirationCount} 条灵感闪念，很有创造力！建议定期回顾这些灵感，也许能带来新的启发。`,
    });
  }

  return items;
}

// SVG 情绪趋势曲线
function MoodChart({ scores }: { scores: { label: string; score: number; count: number }[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 320;
  const height = 160;
  const padX = 30;
  const padY = 20;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  // 找到有效数据点
  const validPoints = scores.filter(s => s.count > 0);

  if (validPoints.length === 0) {
    return (
      <div className="report-chart-empty">
        <span>暂无情绪数据</span>
      </div>
    );
  }

  // 计算坐标
  const allScores = scores.map(s => s.score || 0);
  const minScore = Math.max(0.5, Math.min(...allScores) - 0.3);
  const maxScore = Math.min(5.5, Math.max(...allScores) + 0.3);

  const points = scores.map((s, i) => {
    const x = padX + (i / (scores.length - 1)) * chartW;
    const y = s.count > 0
      ? padY + chartH - ((s.score - minScore) / (maxScore - minScore)) * chartH
      : null;
    return { x, y, ...s };
  });

  // 生成平滑曲线
  const linePoints: string[] = [];
  const dotPoints: { cx: number; cy: number; score: number; label: string }[] = [];

  points.forEach((p, i) => {
    if (p.y !== null) {
      if (linePoints.length === 0) {
        linePoints.push(`M ${p.x} ${p.y}`);
      } else {
        // 用二次贝塞尔曲线平滑
        const prev = points.slice(0, i).reverse().find(pp => pp.y !== null);
        if (prev && prev.y !== null) {
          const cpx = (prev.x + p.x) / 2;
          linePoints.push(`C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`);
        } else {
          linePoints.push(`L ${p.x} ${p.y}`);
        }
      }
      dotPoints.push({ cx: p.x, cy: p.y, score: p.score, label: p.label });
    }
  });

  const pathD = linePoints.join(' ');

  // 生成渐变填充区域
  const areaD = pathD +
    ` L ${dotPoints[dotPoints.length - 1].cx} ${padY + chartH}` +
    ` L ${dotPoints[0].cx} ${padY + chartH} Z`;

  return (
    <div className="report-chart-container">
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="report-chart-svg">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(45, 156, 219, 0.3)" />
            <stop offset="100%" stopColor="rgba(45, 156, 219, 0.02)" />
          </linearGradient>
        </defs>

        {/* 网格线 */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = padY + chartH * ratio;
          return (
            <line key={i} x1={padX} y1={y} x2={width - padX} y2={y}
              stroke="#E8ECF0" strokeWidth="0.5" strokeDasharray="4 4" />
          );
        })}

        {/* X轴标签 */}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={height - 2} textAnchor="middle"
            fontSize="10" fill="#999" fontFamily="PingFang SC, sans-serif">
            {p.label}
          </text>
        ))}

        {/* 渐变填充区域 */}
        {dotPoints.length > 0 && (
          <path d={areaD} fill="url(#chartGradient)" />
        )}

        {/* 曲线 */}
        <path d={pathD} fill="none" stroke="#2D9CDB" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* 数据点 */}
        {dotPoints.map((p, i) => (
          <g key={i}>
            <circle cx={p.cx} cy={p.cy} r="6" fill="white" stroke="#2D9CDB" strokeWidth="2" />
            <circle cx={p.cx} cy={p.cy} r="2.5" fill="#2D9CDB" />
            <text x={p.cx} y={p.cy - 12} textAnchor="middle"
              fontSize="10" fill="#2D9CDB" fontWeight="600" fontFamily="PingFang SC, sans-serif">
              {p.score.toFixed(1)}
            </text>
          </g>
        ))}
      </svg>

      {/* Y轴标签 */}
      <div className="report-chart-ylabels">
        <span>😊</span>
        <span>😐</span>
        <span>😟</span>
      </div>
    </div>
  );
}

export default function ReportPage({ onBack }: ReportPageProps) {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    weeklyReportApi.get().then(r => { setReport(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const moodScores = useMemo(() => report ? getDailyMoodScores(report) : [], [report]);
  const analysisItems = useMemo(() => report ? generateAnalysisItems(report) : [], [report]);

  const totalDays = useMemo(() => {
    if (!report) return 0;
    return Object.values(report.dailyCounts).filter(c => c.notes + c.emotions + c.pains > 0).length;
  }, [report]);

  const weekRange = report
    ? `${report.weekRange.start.slice(5).replace('-', '/')} - ${report.weekRange.end.slice(5).replace('-', '/')}`
    : '';

  return (
    <div className="report-page-fullscreen">
      {/* 导航栏 */}
      <div className="report-nav">
        <button className="report-nav-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="#5C5C74" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="report-nav-center">
          <div className="report-nav-title">情绪分析报告</div>
          {weekRange && (
            <div className="report-nav-subtitle">{weekRange} · {totalDays}天记录</div>
          )}
        </div>
        <div className="report-nav-spacer" />
      </div>

      {/* 主内容 */}
      <div className="report-scroll">
        {loading ? (
          <div className="report-loading">加载中...</div>
        ) : !report ? (
          <div className="report-loading">暂无数据</div>
        ) : (
          <>
            {/* 数据汇总卡片 */}
            <div className="report-summary-cards">
              <div className="report-summary-card">
                <div className="report-summary-icon">📝</div>
                <div className="report-summary-info">
                  <div className="report-summary-num">{report.dailyNotes.count}</div>
                  <div className="report-summary-label">每日速记</div>
                </div>
                {report.dailyNotes.change !== 0 && (
                  <div className={`report-summary-change ${report.dailyNotes.change > 0 ? 'up' : 'down'}`}>
                    {report.dailyNotes.change > 0 ? '↑' : '↓'} {Math.abs(report.dailyNotes.change)}
                  </div>
                )}
              </div>
              <div className="report-summary-card">
                <div className="report-summary-icon">💫</div>
                <div className="report-summary-info">
                  <div className="report-summary-num">{report.emotions.count}</div>
                  <div className="report-summary-label">情绪梳理</div>
                </div>
                {report.emotions.change !== 0 && (
                  <div className={`report-summary-change ${report.emotions.change > 0 ? 'up' : 'down'}`}>
                    {report.emotions.change > 0 ? '↑' : '↓'} {Math.abs(report.emotions.change)}
                  </div>
                )}
              </div>
              <div className="report-summary-card">
                <div className="report-summary-icon">🔥</div>
                <div className="report-summary-info">
                  <div className="report-summary-num">{report.painPoints.count}</div>
                  <div className="report-summary-label">人生痛点</div>
                </div>
                {report.painPoints.change > 0 && (
                  <div className={`report-summary-change up`}>
                    +{report.painPoints.change}
                  </div>
                )}
              </div>
            </div>

            {/* 情绪起伏趋势 */}
            <div className="report-section">
              <div className="report-section-title">
                <span className="report-section-icon">📊</span>
                情绪起伏趋势
              </div>
              <div className="report-chart-card">
                <MoodChart scores={moodScores} />
              </div>
            </div>

            {/* 分析与建议 */}
            <div className="report-section">
              <div className="report-section-title">
                <span className="report-section-icon">💡</span>
                分析与建议
              </div>
              <div className="report-advice-list">
                {analysisItems.map((item, idx) => (
                  <div key={idx} className="report-advice-item">
                    <div className="report-advice-icon">{item.icon}</div>
                    <div className="report-advice-content">
                      <div className="report-advice-title">{item.title}</div>
                      <div className="report-advice-text">{item.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部 */}
            <div className="report-footer">
              当一个旁观者理性深观自己
            </div>
          </>
        )}
      </div>
    </div>
  );
}
