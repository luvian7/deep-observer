import { useState, useEffect, useRef, useCallback } from 'react';
import welcomeBg from '../assets/welcome-bg.webp';

interface Props {
  onEnter: () => void;
}

// 压感路径点
interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

// 流星粒子
interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  trail: { x: number; y: number; alpha: number }[];
  color: string;
}

// 尾随星光粒子
interface Sparkle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  life: number;
  maxLife: number;
  size: number;
}

// 自动滑动路径（相对坐标 0~1）
const AUTO_PATH: [number, number][] = [
  [0.15, 0.3],
  [0.35, 0.2],
  [0.55, 0.35],
  [0.75, 0.25],
  [0.85, 0.5],
  [0.7, 0.65],
  [0.45, 0.7],
  [0.25, 0.6],
  [0.1, 0.45],
  [0.3, 0.4],
  [0.5, 0.3],
  [0.7, 0.45],
  [0.6, 0.6],
  [0.4, 0.55],
];

// 流星暖色系
const METEOR_COLORS = [
  '255, 200, 80',
  '255, 170, 60',
  '255, 220, 120',
  '255, 150, 50',
  '255, 190, 100',
  '255, 230, 150',
];

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function createMeteor(w: number, h: number): Meteor {
  const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.3;
  const speed = 1.5 + Math.random() * 2.5;
  const color = METEOR_COLORS[Math.floor(Math.random() * METEOR_COLORS.length)];
  return {
    x: Math.random() * w * 0.8,
    y: -10 - Math.random() * 40,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0,
    maxLife: 80 + Math.random() * 120,
    size: 1.5 + Math.random() * 2,
    trail: [],
    color,
  };
}

export default function WelcomePage({ onEnter }: Props) {
  const [fadeIn, setFadeIn] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [btnVisible, setBtnVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<TouchPoint[]>([]);
  const meteorsRef = useRef<Meteor[]>([]);
  const sparklesRef = useRef<Sparkle[]>([]);
  const rafRef = useRef<number>(0);
  const pathIndexRef = useRef(0);
  const isManualTouchRef = useRef(false);
  const frameCountRef = useRef(0);

  // 主动画循环
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    frameCountRef.current++;
    const now = Date.now();
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // === 1. 压感涟漪 ===
    pointsRef.current = pointsRef.current.filter(p => now - p.time < 3000);

    for (const point of pointsRef.current) {
      const age = (now - point.time) / 1000;
      const progress = age / 3;
      const radius = 30 + progress * 120;
      const alpha = (1 - progress) * 0.12;

      // 夕阳色涟漪
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.25, `rgba(255, 160, 60, ${alpha * 0.12})`);
      gradient.addColorStop(0.5, `rgba(255, 120, 50, ${alpha * 0.18})`);
      gradient.addColorStop(0.75, `rgba(230, 90, 70, ${alpha * 0.1})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      if (progress < 0.4) {
        const ca = (1 - progress / 0.4) * 0.2;
        const cGrad = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 20);
        cGrad.addColorStop(0, `rgba(255, 180, 80, ${ca})`);
        cGrad.addColorStop(0.6, `rgba(255, 140, 60, ${ca * 0.4})`);
        cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(point.x, point.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = cGrad;
        ctx.fill();
      }
    }

    // === 2. 流星 ===
    // 偶尔生成新流星
    if (Math.random() < 0.015 && meteorsRef.current.length < 5) {
      meteorsRef.current.push(createMeteor(w, h));
    }

    const aliveMeteors: Meteor[] = [];
    for (const m of meteorsRef.current) {
      m.x += m.vx;
      m.y += m.vy;
      m.life++;

      // 记录尾迹
      m.trail.push({ x: m.x, y: m.y, alpha: 1 });
      if (m.trail.length > 25) m.trail.shift();

      // 绘制尾迹
      for (let i = 0; i < m.trail.length; i++) {
        const t = m.trail[i];
        const trailProgress = i / m.trail.length;
        const lifeProgress = m.life / m.maxLife;
        const fadeAlpha = (1 - lifeProgress) * trailProgress * 0.7;
        const trailSize = m.size * trailProgress;

        ctx.beginPath();
        ctx.arc(t.x, t.y, trailSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${m.color}, ${fadeAlpha})`;
        ctx.fill();
      }

      // 绘制流星头部光点
      const headAlpha = 1 - m.life / m.maxLife;
      const headGlow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * 3);
      headGlow.addColorStop(0, `rgba(255, 255, 220, ${headAlpha * 0.9})`);
      headGlow.addColorStop(0.3, `rgba(${m.color}, ${headAlpha * 0.5})`);
      headGlow.addColorStop(1, `rgba(${m.color}, 0)`);
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size * 3, 0, Math.PI * 2);
      ctx.fillStyle = headGlow;
      ctx.fill();

      // 头部核心
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 240, ${headAlpha})`;
      ctx.fill();

      if (m.life < m.maxLife && m.x < w + 50 && m.y < h + 50) {
        aliveMeteors.push(m);
      }
    }
    meteorsRef.current = aliveMeteors;

    // === 3. 尾随星光粒子 ===
    // 跟随最新的压感点生成星光
    if (pointsRef.current.length > 0 && frameCountRef.current % 3 === 0) {
      const latest = pointsRef.current[pointsRef.current.length - 1];
      if (sparklesRef.current.length < 60) {
        sparklesRef.current.push({
          x: latest.x + (Math.random() - 0.5) * 40,
          y: latest.y + (Math.random() - 0.5) * 40,
          targetX: latest.x + (Math.random() - 0.5) * 20,
          targetY: latest.y + (Math.random() - 0.5) * 20,
          life: 0,
          maxLife: 40 + Math.random() * 40,
          size: 1 + Math.random() * 2.5,
        });
      }
    }

    // 偶尔随机产生零散星光
    if (Math.random() < 0.06 && sparklesRef.current.length < 80) {
      sparklesRef.current.push({
        x: Math.random() * w,
        y: Math.random() * h,
        targetX: Math.random() * w,
        targetY: Math.random() * h,
        life: 0,
        maxLife: 60 + Math.random() * 80,
        size: 0.8 + Math.random() * 2,
      });
    }

    const aliveSparkles: Sparkle[] = [];
    for (const s of sparklesRef.current) {
      s.life++;
      s.x += (s.targetX - s.x) * 0.03;
      s.y += (s.targetY - s.y) * 0.03;

      const lifeProgress = s.life / s.maxLife;
      // 呼吸闪烁
      const twinkle = Math.sin(s.life * 0.15) * 0.3 + 0.7;
      const fade = lifeProgress < 0.2
        ? lifeProgress / 0.2
        : lifeProgress > 0.7
          ? (1 - lifeProgress) / 0.3
          : 1;
      const alpha = fade * twinkle;

      // 星光光晕
      const sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 4);
      sg.addColorStop(0, `rgba(255, 220, 130, ${alpha * 0.4})`);
      sg.addColorStop(1, 'rgba(255, 200, 80, 0)');
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 4, 0, Math.PI * 2);
      ctx.fillStyle = sg;
      ctx.fill();

      // 星光核心
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 245, 200, ${alpha})`;
      ctx.fill();

      // 十字星芒
      if (s.size > 1.5) {
        const armLen = s.size * 3 * fade;
        ctx.strokeStyle = `rgba(255, 230, 150, ${alpha * 0.5})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(s.x - armLen, s.y);
        ctx.lineTo(s.x + armLen, s.y);
        ctx.moveTo(s.x, s.y - armLen);
        ctx.lineTo(s.x, s.y + armLen);
        ctx.stroke();
      }

      if (s.life < s.maxLife) {
        aliveSparkles.push(s);
      }
    }
    sparklesRef.current = aliveSparkles;

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  // 自动路径生成
  const autoPathStep = useCallback(() => {
    if (isManualTouchRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    const idx = pathIndexRef.current;
    const path = AUTO_PATH;
    const len = path.length;

    const i0 = (idx + len - 1) % len;
    const i1 = idx % len;
    const i2 = (idx + 1) % len;
    const i3 = (idx + 2) % len;

    const steps = 8;
    const step = pathIndexRef.current % 1;

    for (let s = 0; s <= steps; s++) {
      const t = (step + s / steps) / 1;
      if (t > 1) break;
      const px = catmullRom(path[i0][0], path[i1][0], path[i2][0], path[i3][0], t);
      const py = catmullRom(path[i0][1], path[i1][1], path[i2][1], path[i3][1], t);
      pointsRef.current.push({ x: px * w, y: py * h, time: Date.now() });
    }

    pathIndexRef.current += 0.015;
  }, []);

  // Canvas 尺寸
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => setFadeIn(true));
    const t1 = setTimeout(() => setContentVisible(true), 600);
    const t2 = setTimeout(() => setBtnVisible(true), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    setupCanvas();
    rafRef.current = requestAnimationFrame(animate);
    const autoTimer = setInterval(autoPathStep, 50);
    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(autoTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [animate, autoPathStep, setupCanvas]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    pointsRef.current.push({ x, y, time: Date.now() });
  }, []);

  return (
    <div className={`welcome-page ${fadeIn ? 'welcome-visible' : ''}`}>
      <div className="welcome-bg" style={{ backgroundImage: `url(${welcomeBg})` }} />
      <canvas
        ref={canvasRef}
        className="welcome-touch-canvas"
        onPointerMove={handlePointerMove}
        onPointerDown={() => { isManualTouchRef.current = true; }}
        onPointerUp={() => { isManualTouchRef.current = false; }}
        onPointerLeave={() => { isManualTouchRef.current = false; }}
      />

      <div className="welcome-content">
        <div className={`welcome-title-area ${contentVisible ? 'welcome-slide-up' : ''}`}>
          <h1 className="welcome-title">
            深观者，你好
            <span className="welcome-beta">Beta</span>
          </h1>
        </div>

        <div className={`welcome-body ${contentVisible ? 'welcome-slide-up-delay' : ''}`}>
          <p className="welcome-en">
            Together, we'll uncover limiting beliefs, reshape your
            perspective, and reconnect with your inner strength.
          </p>
          <p className="welcome-zh">
            我在这里倾听你的故事，帮助你探索潜藏在表面之下的情绪。我们将一同识别那些限制自我的信念，重塑你的认知视角，并重新与你内在的力量建立连接。
          </p>
        </div>

        <div className={`welcome-action ${btnVisible ? 'welcome-slide-up-delay2' : ''}`}>
          <button className="welcome-btn" onClick={onEnter}>
            开始深观 <span className="welcome-btn-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
