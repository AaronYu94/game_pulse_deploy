import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../lib/api.js';

/* ---- Constants ---- */
const HOTD_KEY  = 'hotd_v2';
const HOTD_MAX  = 5;
const CW = 520, CH = 300;
const HX = 372, HY = 132;
const RIM_R = 27;
const BB_X  = 416;
const FLOOR_Y  = CH - 52;
const STANDS_H = 98;
const SHOT_POS = { '2pt': { x: 220, y: FLOOR_Y - 5 }, '3pt': { x: 85, y: FLOOR_Y - 5 } };
const SWEET    = { '2pt': [30, 70], '3pt': [41, 59] };

const CROWD_COLORS = ['#e60000','#cc0000','#aa0000','#880000','#3a3a3a','#2a2a2a','#444','#1a1a1a','#ff2222','#b30000'];
const CROWD = (() => {
  const members = [];
  const rows = [
    { baseY: 22, n: 13, sx: 18, sp: 39, sc: 0.62 },
    { baseY: 46, n: 14, sx: 12, sp: 37, sc: 0.78 },
    { baseY: 72, n: 15, sx:  6, sp: 35, sc: 0.96 },
  ];
  let ci = 7;
  rows.forEach(row => {
    for (let i = 0; i < row.n; i++) {
      const jitter = (Math.sin(ci * 13.7) * 0.5 + 0.5);
      members.push({
        x: row.sx + i * row.sp + jitter * 4 - 2,
        y: row.baseY,
        s: row.sc * (0.88 + jitter * 0.22),
        c: CROWD_COLORS[ci % CROWD_COLORS.length],
        delay: jitter * 0.35,
        bob: ci * 1.37,
      });
      ci++;
    }
  });
  return members;
})();

function getState() {
  try {
    const d = JSON.parse(localStorage.getItem(HOTD_KEY));
    if (d && d.date === new Date().toDateString()) return d;
  } catch (_) {}
  return { date: new Date().toDateString(), shotsLeft: HOTD_MAX, earned: 0 };
}
function saveState(s) { localStorage.setItem(HOTD_KEY, JSON.stringify(s)); }

function arc(x0, y0, x1, y1, frames) {
  const cpX = (x0 + x1) / 2;
  const cpY = Math.min(y0, y1) - 115;
  const pts = [];
  for (let i = 0; i <= frames; i++) {
    const t = i / frames, mt = 1 - t;
    pts.push({ x: mt*mt*x0 + 2*mt*t*cpX + t*t*x1, y: mt*mt*y0 + 2*mt*t*cpY + t*t*y1 });
  }
  return pts;
}

function drawBall(ctx, x, y, r, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const grad = ctx.createRadialGradient(-r*.3, -r*.3, r*.1, 0, 0, r);
  grad.addColorStop(0, '#ff9a3c');
  grad.addColorStop(0.5, '#e85d04');
  grad.addColorStop(1, '#9d2c00');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2);
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r*.92, 0); ctx.lineTo(r*.92, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -r*.92);
  ctx.bezierCurveTo(-r*.6, -r*.4, -r*.6, r*.4, 0, r*.92); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -r*.92);
  ctx.bezierCurveTo(r*.6, -r*.4, r*.6, r*.4, 0, r*.92); ctx.stroke();
  const hl = ctx.createRadialGradient(-r*.3, -r*.35, 0, -r*.1, -r*.1, r*.7);
  hl.addColorStop(0, 'rgba(255,255,255,0.35)');
  hl.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  hl.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2);
  ctx.fillStyle = hl; ctx.fill();
  ctx.restore();
}

function drawPerson(ctx, m, crowdState, tick) {
  const rawState = Math.max(0, (crowdState - m.delay) / (1 - m.delay + 0.001));
  const state = Math.min(1, rawState);
  const r = 5.2 * m.s;
  const bobOffset = state > 0 ? Math.sin(tick * 0.09 + m.bob) * 2.5 * state : 0;
  const baseY = m.y - bobOffset;
  const bodyH = (r * 1.2) + (r * 2.8 - r * 1.2) * state;
  const headY = baseY - bodyH - r;
  const bodyTop = baseY - bodyH;
  const bw = r * (1.5 - 0.5 * state);
  ctx.fillStyle = m.c;
  ctx.beginPath();
  ctx.roundRect(m.x - bw, bodyTop, bw * 2, bodyH, r * 0.4);
  ctx.fill();
  ctx.beginPath(); ctx.arc(m.x, headY, r, 0, Math.PI * 2); ctx.fill();
  if (state > 0.05) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state * 1.5);
    ctx.strokeStyle = m.c; ctx.lineWidth = r * 0.75; ctx.lineCap = 'round';
    const armY = bodyTop + bodyH * 0.3;
    const spread = r * 2.8 * state;
    const lift = r * 4.0 * state;
    ctx.beginPath(); ctx.moveTo(m.x, armY); ctx.lineTo(m.x - spread, armY - lift); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(m.x, armY); ctx.lineTo(m.x + spread, armY - lift); ctx.stroke();
    ctx.restore();
  }
}

export default function HoopOfTheDay({ onCoinsUpdate }) {
  const [open, setOpen] = useState(false);
  const [shotsLeft, setShotsLeft] = useState(() => getState().shotsLeft);
  const [earned, setEarned] = useState(() => getState().earned);

  // Game state refs (for canvas loop)
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const gameRef     = useRef({
    phase: 'choose', type: '2pt',
    meter: 0, dir: 1, speed: 1.9,
    ball: { x: 0, y: 0 }, ballAngle: 0,
    traj: [], trajIdx: 0,
    made: false, earned: 0,
    tick: 0, crowdState: 0,
    netWobble: 0, confetti: [],
    flyDone: false,
  });

  const [phase, setPhase] = useState('choose');
  const [type, setType]   = useState('2pt');
  const [result, setResult] = useState(null); // { made, earned }
  const [meterPct, setMeterPct] = useState(0);

  function hotdGet() { return getState(); }

  function openModal() {
    const s = hotdGet();
    setShotsLeft(s.shotsLeft);
    setEarned(s.earned);
    const g = gameRef.current;
    g.phase = 'choose'; g.type = '2pt'; g.meter = 0;
    g.crowdState = 0; g.netWobble = 0; g.confetti = [];
    g.ballAngle = 0; g.tick = 0; g.flyDone = false;
    setPhase('choose'); setType('2pt'); setResult(null); setMeterPct(0);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }

  function resetGame() {
    localStorage.removeItem(HOTD_KEY);
    const s = hotdGet();
    setShotsLeft(s.shotsLeft); setEarned(s.earned);
    const g = gameRef.current;
    g.phase = 'choose'; g.type = '2pt'; g.crowdState = 0;
    g.netWobble = 0; g.confetti = []; g.flyDone = false;
    setPhase('choose'); setType('2pt'); setResult(null); setMeterPct(0);
  }

  function nextShot() {
    const g = gameRef.current;
    g.phase = 'choose'; g.type = '2pt'; g.crowdState = 0;
    g.netWobble = 0; g.confetti = []; g.flyDone = false;
    setPhase('choose'); setType('2pt'); setResult(null); setMeterPct(0);
  }

  function selectType(t) {
    gameRef.current.type = t;
    setType(t);
  }

  function startAim() {
    const g = gameRef.current;
    g.phase = 'aim';
    g.meter = 0; g.dir = 1;
    g.speed = g.type === '3pt' ? 2.3 : 1.8;
    setPhase('aim');
  }

  function shoot() {
    const g = gameRef.current;
    const [lo, hi] = SWEET[g.type];
    g.made = g.meter >= lo && g.meter <= hi;
    const start = SHOT_POS[g.type];
    let tx = HX, ty = HY + 4;
    if (!g.made) {
      const dist = g.meter < lo ? lo - g.meter : g.meter - hi;
      const sev = Math.min(dist / 22, 1);
      if (g.meter < lo) { tx = HX - 50 - sev * 70; ty = HY + 35 + sev * 25; }
      else              { tx = HX + 55 + sev * 80; ty = HY - 15 - sev * 20; }
    }
    g.traj = arc(start.x, start.y, tx, ty, 54);
    g.ball = { x: start.x, y: start.y };
    g.trajIdx = 0;
    g.phase = 'fly';
    g.flyDone = false;
    setPhase('fly');
  }

  const finish = useCallback(async () => {
    const g = gameRef.current;
    let coinsEarned = 0;
    if (g.made) {
      coinsEarned = g.type === '3pt' ? 90 : 30;
      g.netWobble = 1.0;
      spawnConfetti(g);
      try {
        const r = await apiFetch('/api/coins/hoop', { method: 'POST', body: { amount: coinsEarned } });
        if (r?.coins !== undefined && onCoinsUpdate) onCoinsUpdate(r.coins);
      } catch (_) {}
    }
    const s = hotdGet();
    s.earned += coinsEarned;
    s.shotsLeft--;
    saveState(s);
    setShotsLeft(s.shotsLeft);
    setEarned(s.earned);
    g.phase = 'result';
    setPhase('result');
    setResult({ made: g.made, earned: coinsEarned });
  }, [onCoinsUpdate]);

  function spawnConfetti(g) {
    for (let i = 0; i < 55; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 3.5;
      g.confetti.push({
        x: HX + (Math.random() - 0.5) * 20, y: HY,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 2,
        life: 0.7 + Math.random() * 0.5,
        color: ['#e60000','#cc0000','#ff3333','#ff6666','#fff','#aaaaaa'][Math.floor(Math.random()*6)],
        size: 3 + Math.random() * 4,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.2,
      });
    }
  }

  // Canvas draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const g = gameRef.current;
    const W = CW, H = CH;

    // BG
    const bgGrad = ctx.createLinearGradient(0, 0, 0, STANDS_H);
    bgGrad.addColorStop(0, '#0a0a0a'); bgGrad.addColorStop(1, '#111111');
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, STANDS_H + 4);

    // Stands
    for (let row = 0; row < 3; row++) {
      const ry = 18 + row * 26;
      const rowGrad = ctx.createLinearGradient(0, ry, 0, ry + 22);
      rowGrad.addColorStop(0, '#181818'); rowGrad.addColorStop(1, '#111111');
      ctx.fillStyle = rowGrad; ctx.fillRect(0, ry, W, 22);
      ctx.fillStyle = 'rgba(230,0,0,0.08)'; ctx.fillRect(0, ry, W, 2);
    }

    // Crowd
    CROWD.forEach(m => drawPerson(ctx, m, g.crowdState, g.tick));
    if (g.crowdState > 0.1) {
      const glow = ctx.createLinearGradient(0, 0, 0, STANDS_H);
      glow.addColorStop(0, `rgba(230,0,0,${g.crowdState * 0.1})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, STANDS_H);
    }

    // Divider
    const divGrad = ctx.createLinearGradient(0, STANDS_H, 0, STANDS_H + 10);
    divGrad.addColorStop(0, '#0a0a0a'); divGrad.addColorStop(1, '#111');
    ctx.fillStyle = divGrad; ctx.fillRect(0, STANDS_H, W, 10);

    // Court
    const floorGrad = ctx.createLinearGradient(0, STANDS_H + 10, 0, H);
    floorGrad.addColorStop(0, '#141414'); floorGrad.addColorStop(0.4, '#111111'); floorGrad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = floorGrad; ctx.fillRect(0, STANDS_H + 10, W, H - STANDS_H - 10);

    ctx.strokeStyle = 'rgba(230,0,0,0.05)'; ctx.lineWidth = 1;
    for (let px = 0; px < W; px += 28) {
      ctx.beginPath(); ctx.moveTo(px, STANDS_H + 10); ctx.lineTo(px, H); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(230,0,0,0.2)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, FLOOR_Y + 8); ctx.lineTo(W, FLOOR_Y + 8); ctx.stroke();

    ctx.strokeStyle = 'rgba(230,0,0,0.15)'; ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.arc(HX - 6, FLOOR_Y + 8, 235, Math.PI * 1.07, Math.PI * 1.93); ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(230,0,0,0.12)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(BB_X - 112, FLOOR_Y + 8 - 82, 112, 82);
    ctx.beginPath(); ctx.arc(BB_X - 112, FLOOR_Y + 8, 28, Math.PI, Math.PI * 2, false); ctx.stroke();

    // Pole
    const poleGrad = ctx.createLinearGradient(BB_X + 2, 0, BB_X + 7, 0);
    poleGrad.addColorStop(0, 'rgba(180,180,180,0.15)');
    poleGrad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    poleGrad.addColorStop(1, 'rgba(100,100,100,0.06)');
    ctx.fillStyle = poleGrad; ctx.fillRect(BB_X + 2, HY + 52, 5, FLOOR_Y + 8 - HY - 52);

    // Backboard
    ctx.save(); ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#b8d4f0'; ctx.fillRect(BB_X, HY - 22, 7, 72); ctx.restore();
    ctx.strokeStyle = 'rgba(200,230,255,0.3)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(BB_X, HY - 22, 7, 72);
    ctx.strokeStyle = 'rgba(230,0,0,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(BB_X - 0.5, HY - 2, 7, 22);

    // Back rim
    ctx.strokeStyle = '#7a1500'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(HX, HY + 5, RIM_R, 7, 0, Math.PI, Math.PI * 2); ctx.stroke();

    // Net
    const wobble = Math.sin(g.netWobble * 8) * g.netWobble * 5;
    const netSegs = 9;
    ctx.strokeStyle = 'rgba(240,240,240,0.55)'; ctx.lineWidth = 0.9;
    for (let i = 0; i <= netSegs; i++) {
      const a = (i / netSegs) * Math.PI;
      const nx1 = HX + Math.cos(Math.PI - a) * RIM_R;
      const ny1 = HY + 5 + Math.sin(a) * 7;
      const nx2 = HX + Math.cos(Math.PI - a) * (RIM_R * 0.38) + wobble * Math.cos(Math.PI - a);
      const ny2 = HY + 5 + 30;
      ctx.beginPath(); ctx.moveTo(nx1, ny1); ctx.lineTo(nx2, ny2); ctx.stroke();
    }
    for (let j = 1; j <= 4; j++) {
      const tr = j / 5;
      const nr = RIM_R * (1 - tr * 0.62);
      const wy = HY + 5 + 30 * tr;
      const wx = wobble * tr;
      ctx.beginPath(); ctx.ellipse(HX + wx, wy, nr, 4 - tr * 2.5, 0, 0, Math.PI); ctx.stroke();
    }

    // Front rim
    ctx.strokeStyle = '#e83300'; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.ellipse(HX, HY + 5, RIM_R, 7, 0, 0, Math.PI); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,160,100,0.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(HX, HY + 3, RIM_R - 1, 5, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();

    // Shot markers
    const sp = SHOT_POS[g.type];
    ctx.fillStyle = 'rgba(255,100,0,0.15)';
    ctx.beginPath(); ctx.ellipse(sp.x, FLOOR_Y + 7, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(230,0,0,0.35)';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('2PT', 250, FLOOR_Y + 20);
    ctx.fillText('3PT', 90, FLOOR_Y + 20);

    // Ghost arc
    if (g.phase === 'choose') {
      const pa = arc(sp.x, FLOOR_Y, HX, HY + 5, 20);
      ctx.strokeStyle = 'rgba(230,60,0,0.18)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      pa.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke(); ctx.setLineDash([]);
    }

    // Ball
    const bx = g.phase === 'fly' ? g.ball.x : sp.x;
    const by = g.phase === 'fly' ? g.ball.y : FLOOR_Y;
    if (by > FLOOR_Y - 40) {
      const shadowAlpha = Math.max(0, 0.3 - (FLOOR_Y - by) * 0.008);
      ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
      ctx.beginPath(); ctx.ellipse(bx, FLOOR_Y + 7, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    drawBall(ctx, bx, by, 12, g.ballAngle);

    // Confetti
    g.confetti.forEach(p => {
      ctx.save(); ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });

    // Make glow
    if (g.phase === 'result' && g.made) {
      const glow2 = ctx.createRadialGradient(HX, HY, 0, HX, HY, 130);
      glow2.addColorStop(0, 'rgba(230,0,0,0.18)');
      glow2.addColorStop(1, 'transparent');
      ctx.fillStyle = glow2; ctx.fillRect(0, 0, W, H);
    }
  }, []);

  // Animation loop
  useEffect(() => {
    if (!open) return;
    let flyDone = false;
    function tick() {
      const g = gameRef.current;
      g.tick++;

      if (g.phase === 'aim') {
        g.meter += g.speed * g.dir;
        if (g.meter >= 100) { g.meter = 100; g.dir = -1; }
        if (g.meter <= 0)   { g.meter = 0;   g.dir =  1; }
        setMeterPct(g.meter);
      }
      if (g.phase === 'fly') {
        g.ballAngle += 0.18;
        if (g.trajIdx < g.traj.length) {
          g.ball = g.traj[g.trajIdx++];
        } else if (!flyDone) {
          flyDone = true;
          finish();
        }
      } else { flyDone = false; }
      if (g.made && (g.phase === 'fly' || g.phase === 'result')) {
        if (g.crowdState < 1) g.crowdState = Math.min(1, g.crowdState + 0.022);
      }
      if (g.netWobble > 0) g.netWobble -= 0.04;
      g.confetti.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.99;
        p.life -= 0.018; p.angle += p.spin;
      });
      g.confetti = g.confetti.filter(p => p.life > 0);
      draw();
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [open, draw, finish]);

  const doneForDay = shotsLeft <= 0;

  return (
    <>
      {/* Widget */}
      <div className="hotd-widget" onClick={openModal}>
        <div className="hotd-widget__icon">🏀</div>
        <div className="hotd-widget__info">
          <div className="hotd-widget__title">Hoop of the Day</div>
          <div className="hotd-widget__sub">
            {doneForDay ? `Done · ${earned} SC earned today` : `${shotsLeft} shot${shotsLeft !== 1 ? 's' : ''} left · ${earned} SC earned`}
          </div>
        </div>
        <button
          className="hotd-widget__play"
          disabled={doneForDay}
          onClick={e => { e.stopPropagation(); openModal(); }}
        >
          {doneForDay ? 'DONE' : 'PLAY'}
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div className="hotd-modal open">
          <div className="hotd-backdrop" onClick={closeModal} />
          <div className="hotd-box">
            <div className="hotd-header">
              <div className="hotd-header__title">🏀 HOOP OF THE DAY</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="hotd-header__shots">{shotsLeft} shot{shotsLeft !== 1 ? 's' : ''} left</span>
                <button className="hotd-widget__play" style={{ fontSize: 9, padding: '3px 8px' }} onClick={resetGame} title="Reset">↺</button>
                <button className="hotd-close" onClick={closeModal}>✕</button>
              </div>
            </div>

            <canvas ref={canvasRef} width={CW} height={CH} style={{ display: 'block', width: '100%', height: 'auto' }} />

            <div className="hotd-controls">
              {shotsLeft <= 0 && phase === 'choose' ? (
                <>
                  <div className="hotd-result">
                    <div className="hotd-result__label miss" style={{ fontSize: 18 }}>今日已投完</div>
                    <div className="hotd-result__coins">今日共赚 <strong>{earned} SC</strong></div>
                  </div>
                  <button className="hotd-main-btn secondary" onClick={closeModal}>关闭</button>
                </>
              ) : phase === 'choose' ? (
                <>
                  <div className="hotd-choose">
                    <button className={`hotd-shot-btn two${type === '2pt' ? ' selected' : ''}`} onClick={() => selectType('2pt')}>
                      <div className="hotd-shot-btn__pts">2PT</div>
                      <div className="hotd-shot-btn__reward">MAKE = +30 SC</div>
                    </button>
                    <button className={`hotd-shot-btn three${type === '3pt' ? ' selected' : ''}`} onClick={() => selectType('3pt')}>
                      <div className="hotd-shot-btn__pts">3PT</div>
                      <div className="hotd-shot-btn__reward">MAKE = +90 SC</div>
                    </button>
                  </div>
                  <button className="hotd-main-btn" onClick={startAim}>AIM →</button>
                </>
              ) : phase === 'aim' ? (
                <>
                  <div className="hotd-meter-wrap">
                    <div className="hotd-meter-label">TIME YOUR RELEASE — CLICK WHEN INDICATOR HITS THE ZONE</div>
                    <div className="hotd-meter-track">
                      <div className={`hotd-meter-zone${type === '3pt' ? ' tight' : ''}`} style={{ left: `${SWEET[type][0]}%`, width: `${SWEET[type][1] - SWEET[type][0]}%` }} />
                      <div className="hotd-meter-indicator" style={{ left: `${meterPct.toFixed(1)}%` }} />
                    </div>
                  </div>
                  <button className="hotd-main-btn" onClick={shoot}>SHOOT 🏀</button>
                </>
              ) : phase === 'fly' ? (
                <div className="hotd-result">
                  <div className="hotd-result__label" style={{ color: 'var(--text-muted)', fontSize: 15, letterSpacing: '.08em' }}>IN THE AIR…</div>
                </div>
              ) : phase === 'result' && result ? (
                <>
                  <div className="hotd-result">
                    <div className={`hotd-result__label ${result.made ? 'make' : 'miss'}`}>{result.made ? 'SWISH! 🔥' : 'MISS'}</div>
                    <div className="hotd-result__coins">
                      {result.made ? <>You earned <strong>+{result.earned} SC</strong>!</> : 'Better luck next time.'}
                    </div>
                  </div>
                  {shotsLeft > 0
                    ? <button className="hotd-main-btn" style={{ marginTop: 4 }} onClick={nextShot}>NEXT SHOT</button>
                    : <button className="hotd-main-btn secondary" style={{ marginTop: 4 }} onClick={closeModal}>DONE FOR TODAY</button>
                  }
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
