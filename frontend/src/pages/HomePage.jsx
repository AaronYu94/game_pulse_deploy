import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import TasksPanel from '../components/TasksPanel.jsx';
import TeamLogo from '../components/TeamLogo.jsx';
import { fetchGames, monthCalendarDays, toESPNDate } from '../lib/espn.js';
import { apiSettleBets, apiClaimTask, DAILY_TASK_DEFS } from '../lib/api.js';

const ALL_DAYS  = monthCalendarDays();
const TODAY_KEY = toESPNDate(new Date());
const TODAY_IDX = ALL_DAYS.findIndex(d => toESPNDate(d) === TODAY_KEY);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function LiveDot() {
  return (
    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--heat)', marginRight: 4, verticalAlign: 'middle', animation: 'pulse 1.4s ease-in-out infinite' }} />
  );
}

function TeamSide({ team, side, showScore, isWinner }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, flexDirection: side === 'home' ? 'row-reverse' : 'row', textAlign: side === 'home' ? 'right' : 'left' }}>
      <TeamLogo teamId={team.id} abbr={team.abbr} size={36} />
      <div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.06em', lineHeight: 1, color: isWinner ? 'var(--text)' : 'var(--text-sub)' }}>
          {team.abbr}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>{team.record}</div>
      </div>
    </div>
  );
}

function GameCard({ game, isFuture, allBets, selectedDateKey, onShare, navigate }) {
  const bet = allBets.find(b => b.game_id === game.id) || null;
  const awayWin = game.completed && game.away.winner;
  const homeWin = game.completed && game.home.winner;
  const showScore = game.completed || game.inProgress;

  let statusText, statusColor;
  if (game.inProgress) {
    statusText = `Q${game.period} ${game.clock}`;
    statusColor = 'var(--heat)';
  } else if (game.completed) {
    statusText = 'Final';
    statusColor = 'var(--text-muted)';
  } else {
    statusText = game.displayTime;
    statusColor = 'var(--blue)';
  }

  const betPick = bet ? (bet.pick === 'home' ? bet.home_abbr : bet.away_abbr) : null;

  return (
    <div
      className="card card--interactive"
      onClick={() => navigate(`/game?id=${game.id}&date=${selectedDateKey}`)}
      style={{
        padding: '1.1rem 1.25rem', cursor: 'pointer', position: 'relative', overflow: 'hidden',
        ...(bet ? {
          border: '1px solid rgba(251,191,36,.35)',
          background: 'linear-gradient(135deg, rgba(251,191,36,.06) 0%, var(--bg-card) 60%)',
          boxShadow: '0 0 0 1px rgba(251,191,36,.15), 0 4px 16px rgba(251,191,36,.08)',
        } : {}),
      }}
    >
      {bet ? (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--accent-2), #fcd34d)', opacity: 0.8 }} />
      ) : isFuture ? (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--blue), #60a5fa)', opacity: 0.5 }} />
      ) : null}

      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem', color: statusColor, display: 'flex', alignItems: 'center' }}>
        {game.inProgress && <LiveDot />}
        {statusText}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <TeamSide team={game.away} side="away" showScore={showScore} isWinner={awayWin} />
        {showScore ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: "'Bebas Neue', sans-serif" }}>
            <div style={{ fontSize: '1.8rem', color: awayWin ? 'var(--text)' : 'var(--text-sub)', lineHeight: 1, minWidth: 32, textAlign: 'center' }}>{game.away.score ?? ''}</div>
            <div style={{ fontSize: '1rem', color: 'var(--border-mid)' }}>-</div>
            <div style={{ fontSize: '1.8rem', color: homeWin ? 'var(--text)' : 'var(--text-sub)', lineHeight: 1, minWidth: 32, textAlign: 'center' }}>{game.home.score ?? ''}</div>
          </div>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 0.5rem' }}>vs</div>
        )}
        <TeamSide team={game.home} side="home" showScore={showScore} isWinner={homeWin} />
      </div>

      <div style={{ marginTop: '0.65rem', fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {bet ? (
          <span style={{ color: 'var(--accent-2)', fontWeight: 600 }}>
            SC {bet.amount} on <strong>{betPick}</strong>
            {bet.settled && bet.won && <span style={{ color: 'var(--success)' }}> · Won</span>}
            {bet.settled && !bet.won && <span style={{ color: 'var(--heat)', opacity: 0.8 }}> · Lost</span>}
            {!bet.settled && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · Pending</span>}
          </span>
        ) : isFuture ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-glow)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 'var(--radius-pill)', padding: '0.18rem 0.55rem' }}>
            Predict &amp; Discuss
          </span>
        ) : (
          <span>{game.statusText}</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); onShare(game); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.2rem', lineHeight: 1, flexShrink: 0 }}
        >
          Share
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(ALL_DAYS[TODAY_IDX]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [coins, setCoins] = useState(null);
  const [allBets, setAllBets] = useState([]);
  const [taskState, setTaskState] = useState({});
  const [toast, setToast] = useState(null);
  const gameCache = useRef({});
  const calRef = useRef(null);

  const selectedDateKey = toESPNDate(selectedDate);
  const isFuture = selectedDateKey > TODAY_KEY;

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2250);
  }, []);

  const loadGames = useCallback(async (dateKey) => {
    setLoading(true);
    setError('');
    try {
      let g = gameCache.current[dateKey];
      if (!g) {
        g = await fetchGames(dateKey);
        gameCache.current[dateKey] = g;
        if (dateKey <= TODAY_KEY && g.length) {
          apiSettleBets(g).catch(() => {});
        }
      }
      setGames(g);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadGames(TODAY_KEY);
    // Prefetch adjacent days
    const yIdx = TODAY_IDX - 1;
    if (yIdx >= 0) {
      const yKey = toESPNDate(ALL_DAYS[yIdx]);
      fetchGames(yKey).then(g => {
        gameCache.current[yKey] = g;
        if (g.length) apiSettleBets(g).catch(() => {});
      }).catch(() => {});
    }
    const tIdx = TODAY_IDX + 1;
    if (tIdx < ALL_DAYS.length) {
      const tKey = toESPNDate(ALL_DAYS[tIdx]);
      fetchGames(tKey).then(g => { gameCache.current[tKey] = g; }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll today into view
  useEffect(() => {
    if (calRef.current) {
      const todayEl = calRef.current.querySelector(`[data-date="${TODAY_KEY}"]`);
      if (todayEl) todayEl.scrollIntoView({ inline: 'center', behavior: 'auto' });
    }
  }, []);

  function handleDayClick(day) {
    setSelectedDate(day);
    loadGames(toESPNDate(day));
  }

  async function handleShare(game) {
    const url = `${location.origin}/game?id=${game.id}&date=${selectedDateKey}`;
    if (navigator.share) {
      navigator.share({ title: `SCORE · ${game.away.abbr} vs ${game.home.abbr}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => showToast('Link copied!')).catch(() => {});
    }
    try {
      const res = await apiClaimTask('share');
      if (res?.ok) {
        setTaskState(s => ({ ...s, share_done: true }));
        setCoins(res.coins);
        showToast('+50 coins · Shared a game!');
      }
    } catch (_) {}
  }

  const sectionLabel = (() => {
    if (selectedDateKey === TODAY_KEY) return "Today's Games";
    return selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  })();

  return (
    <div className="page">
      <Header />

      <div style={{ padding: '2.5rem 0 1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: 'var(--accent)', borderRadius: 1 }} />
            Real-time NBA Data
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.6rem, 6vw, 4.5rem)', letterSpacing: '0.06em', lineHeight: 1, marginBottom: '0.4rem' }}>
            NBA<br />
            <span style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Games</span>
          </h1>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>Live scores · Boxscores · Fan ratings · Score Coin predictions</p>
        </div>
        {coins !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', flexShrink: 0 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Score Coin</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', lineHeight: 1, color: 'var(--accent-2)' }}>
              <span>SC</span>
              <span>{coins}</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Predict &amp; win coins</div>
          </div>
        )}
      </div>

      {/* Calendar strip */}
      <div ref={calRef} style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '2rem', scrollbarWidth: 'none' }}>
        {ALL_DAYS.map((day, i) => {
          const key = toESPNDate(day);
          const isToday = key === TODAY_KEY;
          const isDayFuture = key > TODAY_KEY;
          const isActive = key === selectedDateKey;
          const hasBet = (gameCache.current[key] || []).some(g => allBets.some(b => b.game_id === g.id));

          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center' }}>
              {i === TODAY_IDX && i > 0 && (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 0.2rem' }}>
                  <div style={{ width: 1, height: 36, background: 'var(--border-mid)', opacity: 0.5 }} />
                </div>
              )}
              <div
                data-date={key}
                onClick={() => handleDayClick(day)}
                style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-md)', minWidth: 54,
                  cursor: 'pointer', userSelect: 'none', position: 'relative',
                  background: isActive ? (isDayFuture ? 'var(--blue-glow)' : 'var(--accent-glow)') : (isDayFuture ? 'rgba(59,130,246,.04)' : 'var(--bg-card)'),
                  border: `1px solid ${isActive ? (isDayFuture ? 'rgba(59,130,246,.5)' : 'rgba(255,107,43,.4)') : (isDayFuture ? 'rgba(59,130,246,.2)' : 'var(--border)')}`,
                  transition: 'all .18s',
                }}
              >
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem', color: isActive ? (isDayFuture ? 'var(--blue)' : 'var(--accent)') : 'var(--text-muted)' }}>
                  {isToday ? 'Today' : DOW[day.getDay()]}
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', lineHeight: 1, color: isActive ? (isDayFuture ? 'var(--blue)' : 'var(--accent)') : 'var(--text)' }}>
                  {day.getDate()}
                </div>
                {hasBet && (
                  <div style={{ position: 'absolute', top: 4, right: 6, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-2)' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Games section */}
      <section style={{ marginBottom: '3rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            {sectionLabel}
            {isFuture && <span style={{ color: 'var(--blue)' }}> · Upcoming</span>}
          </span>
          {!loading && <span>{games.length} game{games.length !== 1 ? 's' : ''}</span>}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'inline-block', width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite', marginBottom: '0.75rem' }} />
            <br />Loading games…
          </div>
        ) : error ? (
          <div className="empty">Failed to load games.<br /><small>{error}</small></div>
        ) : games.length === 0 ? (
          <div className="empty">No games scheduled for this date.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.85rem' }}>
            {games.map(g => (
              <GameCard
                key={g.id}
                game={g}
                isFuture={isFuture}
                allBets={allBets}
                selectedDateKey={selectedDateKey}
                onShare={handleShare}
                navigate={navigate}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="site-footer">SCORE · NBA · Powered by ESPN · Data for reference only · Score Coin is virtual currency with no real-world value</footer>

      <TasksPanel
        onCoinsUpdate={setCoins}
        onBetsUpdate={setAllBets}
      />

      {toast && (
        <div style={{ position: 'fixed', bottom: '6.5rem', right: '1.5rem', zIndex: 300, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: '#fff', fontWeight: 700, fontSize: '0.88rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-pill)', boxShadow: '0 4px 16px rgba(255,107,43,.4)', pointerEvents: 'none' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
