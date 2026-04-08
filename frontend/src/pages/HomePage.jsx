import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header, { SideNav } from '../components/Header.jsx';
import { fetchGames, monthCalendarDays, toESPNDate, getTeamColors } from '../lib/espn.js';
import {
  apiSettleBets, apiGetAllBets, apiGetCoins, apiClaimTask, DAILY_TASK_DEFS,
} from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import HoopOfTheDay from '../components/HoopOfTheDay.jsx';

const ALL_DAYS  = monthCalendarDays();
const TODAY_KEY = toESPNDate(new Date());
const TODAY_IDX = ALL_DAYS.findIndex(d => toESPNDate(d) === TODAY_KEY);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function TeamBadge({ abbr, size = '' }) {
  const c = getTeamColors(abbr);
  const cls = size ? `team-badge team-badge--${size}` : 'team-badge';
  return (
    <div
      className={cls}
      style={{ background: c.bg, borderColor: c.border, color: c.text }}
    >
      {abbr || '?'}
    </div>
  );
}

function GameCard({ game, isFuture, allBets, selectedDateKey, onShare, navigate }) {
  const bet = allBets.find(b => b.game_id === game.id) || null;
  const awayWin = game.completed && game.away.winner;
  const homeWin = game.completed && game.home.winner;
  const showScore = game.completed || game.inProgress;

  let statusClass, statusText;
  if (game.inProgress) { statusClass = 'game-card__status--live'; statusText = `Q${game.period} ${game.clock}`; }
  else if (game.completed) { statusClass = 'game-card__status--final'; statusText = 'Final'; }
  else { statusClass = 'game-card__status--sched'; statusText = game.displayTime; }

  return (
    <div
      className={`game-card${game.inProgress ? ' active-game' : ''}${isFuture ? ' future-card' : ''}`}
      onClick={() => navigate(`/game?id=${game.id}&date=${selectedDateKey}`)}
    >
      <div className={`game-card__status ${statusClass}`}>
        {game.inProgress && <span className="live-dot" style={{ marginRight: 4 }} />}
        {statusText}
      </div>
      <div className="game-card__matchup">
        <div className="team-side team-side--away">
          <TeamBadge abbr={game.away.abbr} size="sm" />
          <div>
            <div className={`team-info__abbr${awayWin ? ' winner' : game.inProgress ? ' live' : ''}`}>{game.away.abbr}</div>
            <div className="team-info__record">{game.away.record}</div>
          </div>
        </div>
        <div className="score-col">
          {showScore ? (
            <>
              <span className={`score-col__num${awayWin ? ' score-col__num--winner' : game.inProgress ? ' score-col__num--live' : ''}`}>{game.away.score ?? ''}</span>
              <span className="score-col__sep">-</span>
              <span className={`score-col__num${homeWin ? ' score-col__num--winner' : game.inProgress ? ' score-col__num--live' : ''}`}>{game.home.score ?? ''}</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>vs</span>
          )}
        </div>
        <div className="team-side team-side--home">
          <TeamBadge abbr={game.home.abbr} size="sm" />
          <div>
            <div className={`team-info__abbr${homeWin ? ' winner' : game.inProgress ? ' live' : ''}`}>{game.home.abbr}</div>
            <div className="team-info__record">{game.home.record}</div>
          </div>
        </div>
      </div>
      <div className="game-card__footer">
        {bet ? (
          <span style={{ color: 'var(--accent-2)', fontWeight: 600, fontSize: 10 }}>
            SC {bet.amount} on {bet.pick === 'home' ? bet.home_abbr : bet.away_abbr}
            {bet.settled && bet.won && <span style={{ color: 'var(--success)' }}> · Won</span>}
            {bet.settled && !bet.won && <span style={{ color: 'var(--accent)', opacity: 0.8 }}> · Lost</span>}
            {!bet.settled && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · Pending</span>}
          </span>
        ) : isFuture ? (
          <span className="future-badge">Predict &amp; Discuss</span>
        ) : (
          <span>{game.statusText}</span>
        )}
        <button
          className="share-btn"
          onClick={e => { e.stopPropagation(); onShare(game); }}
        >
          Share
        </button>
      </div>
    </div>
  );
}

/* News Feed */
const ESPN_NEWS_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=20';

function NewsTag({ category }) {
  const map = {
    Breaking: 'news-tag--breaking', Trade: 'news-tag--trade',
    Highlight: 'news-tag--highlight', Thread: 'news-tag--thread',
  };
  const cls = map[category] || 'news-tag--general';
  return <span className={`news-tag ${cls}`}>{category}</span>;
}

function NewsFeed() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [src, setSrc] = useState('hot');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(ESPN_NEWS_URL);
        if (!res.ok) throw new Error('Failed to load news');
        const json = await res.json();
        setArticles(json.articles || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div id="newsFeed">
        <div className="skel-featured" />
        <div className="skel-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skel-card">
              <div className="skel-card__img" />
              <div className="skel-card__body">
                <div className="skel-line" style={{ width: '90%' }} />
                <div className="skel-line" style={{ width: '70%' }} />
                <div className="skel-line" style={{ width: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error) return <div className="news-error">{error}</div>;
  if (!articles.length) return <div className="empty">No news available.</div>;

  const sorted = [...articles];
  if (src === 'top') sorted.sort((a, b) => (b.premium ? 1 : 0) - (a.premium ? 1 : 0));

  const featured = sorted[0];
  const grid = sorted.slice(1, 7);

  const getCategory = (a) => {
    const cats = a.categories || [];
    if (cats.some(c => (c.description || '').toLowerCase().includes('trade'))) return 'Trade';
    if (cats.some(c => (c.description || '').toLowerCase().includes('breaking'))) return 'Breaking';
    return 'General';
  };
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = Math.floor((now - d) / 60000);
      if (diff < 60) return `${diff}m ago`;
      if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  return (
    <div id="newsFeed">
      {/* Featured */}
      {featured && (
        <a
          href={featured.links?.web?.href || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="nc-featured"
        >
          {featured.images?.[0]?.url ? (
            <div className="nc-featured__img" style={{ backgroundImage: `url(${featured.images[0].url})` }} />
          ) : (
            <div className="nc-no-img-placeholder">NBA</div>
          )}
          <div className="nc-featured__overlay">
            <NewsTag category={getCategory(featured)} />
            <div className="nc-featured__title">{featured.headline}</div>
            <div className="nc-featured__meta">{featured.source || 'ESPN'} · {formatTime(featured.published)}</div>
          </div>
        </a>
      )}
      {/* Grid */}
      <div className="nc-grid">
        {grid.map((a, i) => (
          <a key={i} href={a.links?.web?.href || '#'} target="_blank" rel="noopener noreferrer" className="nc-card">
            {a.images?.[0]?.url ? (
              <div className="nc-card__img" style={{ backgroundImage: `url(${a.images[0].url})` }}>
                <NewsTag category={getCategory(a)} />
              </div>
            ) : (
              <div className="nc-card__no-img">
                NBA
                <NewsTag category={getCategory(a)} />
              </div>
            )}
            <div className="nc-card__body">
              <div className="nc-card__title">{a.headline}</div>
              <div className="nc-card__meta">
                <span>{a.source || 'ESPN'}</span>
                <span>·</span>
                <span>{formatTime(a.published)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

/* Right panel tasks */
function TasksPanel({ coins, tasks }) {
  return (
    <>
      <div className="section-title" style={{ marginTop: 8 }}>
        <div className="slash-accent"></div>
        DAILY TASKS
      </div>
      <div id="rightPanelTasks">
        {DAILY_TASK_DEFS.map(t => {
          const done = tasks[t.key + '_done'];
          return (
            <div key={t.key} className={`rp-task-row${done ? ' done' : ''}`}>
              <span className="rp-task-icon">{t.icon}</span>
              <span className="rp-task-label">{t.label}</span>
              <span className={`rp-task-reward${done ? ' done' : ''}`}>
                {done ? '✓' : `+${t.reward}`}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function GuestPanel() {
  return (
    <div
      className="form-panel"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        padding: '1.4rem',
      }}
    >
      <div className="section-title" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="slash-accent"></div>
        GUEST MODE
      </div>
      <div style={{ color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 14 }}>
        Browse games, standings, news, and forum threads right away. Sign in whenever you want to start earning Score Coins, post comments, and make predictions.
      </div>
      <Link to="/login?redirect=%2F" className="btn btn--primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
        Sign In To Join
      </Link>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
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
  const hasLive = games.some(g => g.inProgress);

  const showToast = useCallback((msg) => {
    setToast(msg); setTimeout(() => setToast(null), 2250);
  }, []);

  const loadGames = useCallback(async (dateKey) => {
    setLoading(true); setError('');
    try {
      let g = gameCache.current[dateKey];
      if (!g) {
        g = await fetchGames(dateKey);
        gameCache.current[dateKey] = g;
        if (isLoggedIn && dateKey <= TODAY_KEY && g.length) apiSettleBets(g).catch(() => {});
      }
      setGames(g);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [isLoggedIn]);

  useEffect(() => {
    loadGames(TODAY_KEY);
    // Prefetch adjacent days
    const yIdx = TODAY_IDX - 1;
    if (yIdx >= 0) {
      const yKey = toESPNDate(ALL_DAYS[yIdx]);
      fetchGames(yKey).then(g => {
        gameCache.current[yKey] = g;
        if (isLoggedIn && g.length) apiSettleBets(g).catch(() => {});
      }).catch(() => {});
    }
    const tIdx = TODAY_IDX + 1;
    if (tIdx < ALL_DAYS.length) {
      const tKey = toESPNDate(ALL_DAYS[tIdx]);
      fetchGames(tKey).then(g => { gameCache.current[tKey] = g; }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLoggedIn) {
      setCoins(null);
      setAllBets([]);
      setTaskState({});
      return;
    }

    apiGetCoins().then(d => { setCoins(d.coins ?? 0); setTaskState(d.tasks || {}); }).catch(() => {});
    apiGetAllBets().then(setAllBets).catch(() => {});
    apiClaimTask('login').then(res => {
      if (res?.ok) { setCoins(res.coins); setTaskState(s => ({ ...s, login_done: true })); showToast('+20 coins · Daily login!'); }
    }).catch(() => {});
  }, [isLoggedIn, showToast]);

  useEffect(() => {
    if (calRef.current) {
      const el = calRef.current.querySelector(`[data-date="${TODAY_KEY}"]`);
      if (el) el.scrollIntoView({ inline: 'center', behavior: 'auto' });
    }
  }, []);

  function handleDayClick(day) {
    setSelectedDate(day); loadGames(toESPNDate(day));
  }

  async function handleShare(game) {
    const url = `${location.origin}/game?id=${game.id}&date=${selectedDateKey}`;
    if (navigator.share) navigator.share({ title: `SCORE · ${game.away.abbr} vs ${game.home.abbr}`, url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => showToast('Link copied!')).catch(() => {});
    if (!isLoggedIn) return;
    try {
      const res = await apiClaimTask('share');
      if (res?.ok) { setTaskState(s => ({ ...s, share_done: true })); setCoins(res.coins); showToast('+50 coins · Shared a game!'); }
    } catch (_) {}
  }

  const sectionLabel = selectedDateKey === TODAY_KEY ? 'NBA GAMES' : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

  return (
    <div className="app-container app-container--home">
      <Header searchPlaceholder="Search players, teams, stats..." />

      <SideNav />

      {/* Panel Matches: Calendar + Game List */}
      <aside className="panel-matches">
        <div className="panel-top">
          <div className="panel-header">
            <h3 id="sectionDateLabel">{sectionLabel}</h3>
            {hasLive && <div className="live-tag"><span>• LIVE</span></div>}
          </div>
          {/* Calendar Strip */}
          <div className="cal-strip" ref={calRef}>
            {ALL_DAYS.map((day, i) => {
              const key = toESPNDate(day);
              const isToday = key === TODAY_KEY;
              const isDayFuture = key > TODAY_KEY;
              const isActive = key === selectedDateKey;
              const hasBet = (gameCache.current[key] || []).some(g => allBets.some(b => b.game_id === g.id));
              const hasGames = (gameCache.current[key] || []).length > 0;

              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center' }}>
                  {i === TODAY_IDX && i > 0 && (
                    <div className="cal-divider"><div className="cal-divider__line" /></div>
                  )}
                  <div
                    data-date={key}
                    className={`cal-day${isActive ? ' active' : ''}${isDayFuture ? ' future' : ''}${hasBet ? ' has-bet' : ''}${hasGames ? ' has-games' : ''}`}
                    onClick={() => handleDayClick(day)}
                  >
                    <div className="cal-day__dow">{isToday ? 'TOD' : DOW[day.getDay()].slice(0,3)}</div>
                    <div className="cal-day__num">{day.getDate()}</div>
                    <div className="cal-day__dot" />
                    <div className="cal-day__bet-dot" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Games list */}
        <div className="panel-games-scroll">
          <div id="gamesContainer">
            {loading ? (
              <div className="loading"><div className="loading__spinner" /><br />Loading games…</div>
            ) : error ? (
              <div className="empty">Failed to load. {error}</div>
            ) : games.length === 0 ? (
              <div className="empty">No games scheduled.</div>
            ) : (
              games.map(g => (
                <GameCard
                  key={g.id}
                  game={g}
                  isFuture={isFuture}
                  allBets={allBets}
                  selectedDateKey={selectedDateKey}
                  onShare={handleShare}
                  navigate={navigate}
                />
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Stage: News Feed */}
      <main className="main-stage">
        <div className="news-header">
          <div className="news-header__title">
            <div className="slash-accent"></div>
            <span className="news-header__label">NBA NEWS</span>
            <div className="news-live-dot"></div>
          </div>
          <div className="news-source-tabs">
            <Link to="/news" className="news-source-tab active" style={{ textDecoration: 'none' }}>MORE →</Link>
          </div>
        </div>
        <NewsFeed />
      </main>

      {/* Panel Social: Coins + Tasks */}
      <aside className="panel-social">
        <div className="section-title">
          <div className="slash-accent"></div>
          SCORE COIN
        </div>
        {isLoggedIn ? (
          <>
            <div className="coin-widget">
              <div className="coin-widget__dots"></div>
              <div className="coin-widget__amount">
                <span className="coin-widget__symbol">SC</span>
                <span className="coin-widget__num" id="coinBalance">{coins !== null ? coins.toLocaleString() : '—'}</span>
              </div>
              <div className="coin-widget__sub">Predict &amp; win coins</div>
            </div>

            <HoopOfTheDay onCoinsUpdate={setCoins} />
            <TasksPanel coins={coins} tasks={taskState} />
          </>
        ) : (
          <GuestPanel />
        )}
      </aside>

      {toast && <div className="coin-toast">{toast}</div>}
    </div>
  );
}
