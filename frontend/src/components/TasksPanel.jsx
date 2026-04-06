import { useState, useEffect, useCallback } from 'react';
import { apiGetCoins, apiClaimTask, apiGetAllBets, DAILY_TASK_DEFS } from '../lib/api.js';

// Coin toast shown briefly after claiming a task
function CoinToast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2250);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position: 'fixed', bottom: '6.5rem', right: '1.5rem', zIndex: 300,
      background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
      color: '#fff', fontWeight: 700, fontSize: '0.88rem',
      padding: '0.5rem 1rem', borderRadius: 'var(--radius-pill)',
      boxShadow: '0 4px 16px rgba(255,107,43,.4)', pointerEvents: 'none',
    }}>
      {msg}
    </div>
  );
}

export default function TasksPanel({ onCoinsUpdate, onBetsUpdate }) {
  const [open, setOpen] = useState(false);
  const [coins, setCoins] = useState(null);
  const [taskState, setTaskState] = useState({});
  const [toast, setToast] = useState(null);

  const refresh = useCallback(async () => {
    const [coinData, bets] = await Promise.all([
      apiGetCoins().catch(() => null),
      apiGetAllBets().catch(() => []),
    ]);
    if (coinData) {
      setCoins(coinData.coins);
      setTaskState(coinData.tasks || {});
      onCoinsUpdate?.(coinData.coins);
    }
    onBetsUpdate?.(bets);
    return coinData;
  }, [onCoinsUpdate, onBetsUpdate]);

  // On mount: load data and claim login bonus
  useEffect(() => {
    refresh().then(coinData => {
      if (!coinData?.tasks?.login_done) {
        apiClaimTask('login').then(res => {
          if (res?.ok) {
            setCoins(res.coins);
            setTaskState(s => ({ ...s, login_done: true }));
            onCoinsUpdate?.(res.coins);
            setToast('+20 coins · Daily Login!');
          }
        }).catch(() => {});
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unclaimed = DAILY_TASK_DEFS.filter(d => !taskState[d.key + '_done']).length;

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        title="Daily Tasks"
        style={{
          position: 'fixed', bottom: '2rem', right: '1.5rem', zIndex: 200,
          width: 54, height: 54, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.35rem', boxShadow: '0 4px 20px rgba(255,107,43,.45)',
          transition: 'transform .18s, box-shadow .18s', userSelect: 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        ★
        {unclaimed > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 18, height: 18, borderRadius: 9,
            background: 'var(--heat)', border: '2px solid var(--bg-deep)',
            color: '#fff', fontSize: '0.65rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1,
          }}>
            {unclaimed}
          </span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 198,
            background: 'rgba(6,10,18,.55)', backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 199,
        width: 340, maxWidth: '92vw',
        background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
        boxShadow: '-8px 0 32px rgba(0,0,0,.45)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.06em' }}>Daily Tasks</div>
          <button onClick={() => setOpen(false)} style={{
            width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-surface)',
            border: '1px solid var(--border)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.9rem', color: 'var(--text-muted)',
          }}>✕</button>
        </div>

        <div style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, rgba(255,107,43,.1), rgba(255,149,0,.07))', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Score Coin Balance</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', lineHeight: 1, color: 'var(--accent-2)' }}>
            SC {coins ?? '—'}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {DAILY_TASK_DEFS.map(def => {
            const done = !!taskState[def.key + '_done'];
            return (
              <div key={def.key} style={{
                display: 'flex', alignItems: 'center', gap: '0.85rem',
                padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                opacity: done ? 0.55 : 1,
              }}>
                <div style={{ fontSize: '1.35rem', flexShrink: 0, width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {def.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.2 }}>{def.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-2)', fontWeight: 700, marginTop: 1 }}>+{def.reward} coins</div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {done ? (
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--success)' }}>✓</div>
                  ) : (
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '0.65rem 1.25rem', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', textAlign: 'center', flexShrink: 0 }}>
          Tasks reset daily at midnight
        </div>
      </div>

      {toast && <CoinToast msg={toast} onDone={() => setToast(null)} />}
    </>
  );
}

// Export a hook-like helper so pages can show the toast and update task state externally
export { CoinToast };
