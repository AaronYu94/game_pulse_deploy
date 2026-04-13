import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import Header, { SideNav } from '../components/Header.jsx';
import {
  apiGetCoins, apiGetBet, apiPlaceBet,
  apiGetAllPlayerRatings, apiRatePlayer,
  apiGetComments, apiPostComment, apiLikeComment, apiClaimTask,
  apiGetChat,
} from '../lib/api.js';
import { fetchGames, fetchGameDetail, toESPNDate, scoreColor, getTeamColors } from '../lib/espn.js';
import { useAuth } from '../contexts/AuthContext.jsx';

function TeamBadge({ abbr, size = '' }) {
  const c = getTeamColors(abbr);
  const cls = size ? `team-badge team-badge--${size}` : 'team-badge';
  return <div className={cls} style={{ background: c.bg, borderColor: c.border, color: c.text }}>{abbr || '?'}</div>;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const BET_CHIPS = [10, 25, 50, 100, 250];

function parseRecord(record) {
  if (!record) return 0.5;
  const parts = record.split('-').map(Number);
  const w = parts[0] || 0, l = parts[1] || 0;
  return w + l === 0 ? 0.5 : w / (w + l);
}

// Log5 formula + home court boost (~4%)
function computeOdds(homeRecord, awayRecord) {
  const hwp = parseRecord(homeRecord);
  const awp = parseRecord(awayRecord);
  const denom = hwp + awp - 2 * hwp * awp;
  let homeProb = denom > 0 ? (hwp - hwp * awp) / denom : 0.5;
  homeProb = Math.max(0.05, Math.min(0.95, homeProb + 0.04));
  return {
    homeProb: Math.round(homeProb * 100),
    awayProb: Math.round((1 - homeProb) * 100),
  };
}

function toMoneyline(prob) {
  if (prob >= 50) return `-${Math.round((prob / (100 - prob)) * 100)}`;
  return `+${Math.round(((100 - prob) / prob) * 100)}`;
}

function WinOddsBar({ home, away }) {
  if (!home?.record && !away?.record) return null;
  const { homeProb, awayProb } = computeOdds(home?.record, away?.record);
  const awayFav = awayProb > homeProb;
  const homeFav = homeProb > awayProb;
  return (
    <div className="win-odds-bar">
      <div className="win-odds-bar__row">
        <div className="win-odds-bar__team">
          <span className="win-odds-bar__abbr">{away?.abbr}</span>
          {awayFav && <span className="win-odds-bar__fav">FAV</span>}
        </div>
        <div className="win-odds-bar__team win-odds-bar__team--right">
          {homeFav && <span className="win-odds-bar__fav">FAV</span>}
          <span className="win-odds-bar__abbr">{home?.abbr}</span>
        </div>
      </div>
      <div className="win-odds-bar__track">
        <div
          className="win-odds-bar__fill win-odds-bar__fill--away"
          style={{ width: `${awayProb}%` }}
        />
        <div
          className="win-odds-bar__fill win-odds-bar__fill--home"
          style={{ width: `${homeProb}%` }}
        />
      </div>
      <div className="win-odds-bar__row">
        <div>
          <span className="win-odds-bar__pct">{awayProb}%</span>
          <span className="win-odds-bar__ml">{toMoneyline(awayProb)}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="win-odds-bar__pct">{homeProb}%</span>
          <span className="win-odds-bar__ml">{toMoneyline(homeProb)}</span>
        </div>
      </div>
    </div>
  );
}

function BetSection({ gameInfo, coins, existingBet, onBetPlaced, canBet, loginHref }) {
  const [pick, setPick] = useState('');
  const [amount, setAmount] = useState(25);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('');

  if (!gameInfo) return null;

  if (!canBet) {
    return (
      <div className="bet-section">
        <div className="bet-section__header">
          <div className="bet-section__title">Predictions</div>
          <div className="bet-section__balance"><span>Guest</span></div>
        </div>
        <div className="bet-placed-card">
          <div>
            <div className="bet-placed-card__pick">Sign in to make your pick</div>
            <div className="bet-placed-card__amount">Save predictions, track results, and earn Score Coins.</div>
          </div>
        </div>
        <Link to={loginHref} className="btn btn--primary" style={{ display: 'inline-flex', marginTop: 12, textDecoration: 'none' }}>
          Sign In To Predict
        </Link>
      </div>
    );
  }

  async function handleBet() {
    if (!pick || !amount) { setMsg('Select a team and amount.'); setMsgType('err'); return; }
    setLoading(true); setMsg('');
    try {
      await apiPlaceBet(gameInfo.id, pick, amount, gameInfo.home.abbr, gameInfo.away.abbr);
      setMsg('Bet placed!'); setMsgType('ok');
      onBetPlaced && onBetPlaced();
    } catch (err) { setMsg(err.message); setMsgType('err'); }
    finally { setLoading(false); }
  }

  const { homeProb, awayProb } = computeOdds(gameInfo.home?.record, gameInfo.away?.record);

  if (existingBet) {
    const resultClass = existingBet.settled ? (existingBet.won ? 'bet-placed-card--won' : 'bet-placed-card--lost') : '';
    const pickLabel = existingBet.pick === 'home' ? existingBet.home_abbr : existingBet.away_abbr;
    return (
      <div className="bet-section">
        <div className="bet-section__header">
          <div className="bet-section__title">Your Prediction</div>
          <div className="bet-section__balance"><span>SC</span><span>{coins ?? '—'}</span></div>
        </div>
        <WinOddsBar home={gameInfo.home} away={gameInfo.away} />
        <div className={`bet-placed-card ${resultClass}`} style={{ marginTop: 8 }}>
          <div>
            <div className="bet-placed-card__pick">{pickLabel} to win</div>
            <div className="bet-placed-card__amount"><strong>{existingBet.amount} SC</strong> wagered</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {existingBet.settled ? (existingBet.won ? <span style={{ color: 'var(--success)', fontWeight: 700 }}>WON</span> : <span style={{ color: 'var(--heat)', fontWeight: 700 }}>LOST</span>) : 'Pending'}
          </div>
        </div>
      </div>
    );
  }

  if (gameInfo.completed) return null;

  return (
    <div className="bet-section">
      <div className="bet-section__header">
        <div className="bet-section__title">Place Prediction</div>
        <div className="bet-section__balance"><span>SC</span><span>{coins ?? '—'}</span></div>
      </div>
      <WinOddsBar home={gameInfo.home} away={gameInfo.away} />
      <div className="bet-picks" style={{ marginTop: 8 }}>
        <div className={`bet-pick-card${pick === 'away' ? ' selected' : ''}`} onClick={() => setPick('away')}>
          <div className="bet-pick-card__team">{gameInfo.away.abbr}</div>
          <div className="bet-pick-card__pct">{awayProb}%</div>
          <div className="bet-pick-card__label">Away · {toMoneyline(awayProb)}</div>
        </div>
        <div className="bet-vs-sep">vs</div>
        <div className={`bet-pick-card${pick === 'home' ? ' selected' : ''}`} onClick={() => setPick('home')}>
          <div className="bet-pick-card__team">{gameInfo.home.abbr}</div>
          <div className="bet-pick-card__pct">{homeProb}%</div>
          <div className="bet-pick-card__label">Home · {toMoneyline(homeProb)}</div>
        </div>
      </div>
      <div className="bet-amount-row">
        <span className="bet-amount-label">Amount:</span>
        {BET_CHIPS.map(v => (
          <span key={v} className={`bet-amount-chip${amount === v ? ' selected' : ''}`} onClick={() => setAmount(v)}>{v}</span>
        ))}
      </div>
      <button
        className="bet-confirm-btn"
        disabled={loading || !pick}
        onClick={handleBet}
        style={{ padding: '0.5rem 1.4rem', border: 'none', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
      >
        {loading ? 'Placing…' : 'Place Bet'}
      </button>
      {msg && <div className={`bet-msg${msgType === 'err' ? ' bet-msg--err' : ' bet-msg--ok'}`}>{msg}</div>}
    </div>
  );
}

function BoxscoreTable({ team, playerRatings, onRatePlayer, canRate, onRequireAuth }) {
  const [openPlayerId, setOpenPlayerId] = useState(null);
  const [rateVal, setRateVal] = useState(null);

  function handleRowClick(p) {
    if (p.dnp) return;
    if (!canRate) {
      onRequireAuth && onRequireAuth();
      return;
    }
    setOpenPlayerId(openPlayerId === p.id ? null : p.id);
    setRateVal(null);
  }

  async function submitRating(gameId, playerId) {
    if (!rateVal) return;
    await onRatePlayer(playerId, rateVal);
    setOpenPlayerId(null);
  }

  return (
    <div className="boxscore-section">
      <div className="boxscore-team-header">
        <TeamBadge abbr={team.abbr} size="sm" />
        <div className="boxscore-team-name">{team.name}</div>
      </div>
      <div className="bs-table-wrap">
        <table className="bs-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>MIN</th><th>PTS</th><th>REB</th><th>AST</th>
              <th>STL</th><th>BLK</th><th>TO</th><th>FG</th>
              <th>3PT</th><th>FT</th><th>+/-</th>
              <th className="rating-th">Rating</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map(p => {
              const rating = playerRatings[String(p.id)];
              const ratingScore = rating ? (rating.avg || 0).toFixed(1) : null;
              const isOpen = openPlayerId === p.id;
              return [
                <tr
                  key={p.id}
                  className={`${p.starter ? 'starter' : ''}${p.dnp ? ' dnp-row' : ''}`}
                  onClick={() => handleRowClick(p)}
                  style={{ cursor: p.dnp ? 'default' : canRate ? 'pointer' : 'not-allowed' }}
                >
                  <td>
                    <div className="player-cell">
                      <div className="player-headshot-fallback" style={{ fontSize: '0.65rem' }}>
                        {p.name.split(' ').map(w => w[0]).slice(0,2).join('')}
                      </div>
                      <div className="player-cell__info">
                        <div className="player-cell__name">{p.name}</div>
                        <div className="player-cell__pos">{p.position} {p.jersey ? `#${p.jersey}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.min}</td>
                  <td className="pts-col">{p.pts}</td>
                  <td>{p.reb}</td><td>{p.ast}</td>
                  <td>{p.stl}</td><td>{p.blk}</td><td>{p.to}</td>
                  <td>{p.fg}</td><td>{p.fg3}</td><td>{p.ft}</td>
                  <td>{p.pm}</td>
                  <td className="rating-td">
                    {p.dnp ? (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DNP</span>
                    ) : ratingScore ? (
                      <div className="player-rating-badge">
                        <span className={`player-rating-badge__score ${scoreColor(ratingScore)}`}>{ratingScore}</span>
                        <span className="player-rating-badge__votes">{rating.count} votes</span>
                      </div>
                    ) : (
                      <span className="player-rating-badge__empty">{canRate ? 'Rate' : 'Sign in'}</span>
                    )}
                  </td>
                </tr>,
                isOpen && (
                  <tr key={`rate-${p.id}`} className="rating-picker-row">
                    <td colSpan={13}>
                      <div className="rating-picker">
                        <span className="rating-picker__label">Rate {p.name.split(' ')[1] || p.name}:</span>
                        {[1,2,3,4,5,6,7,8,9,10].map(v => (
                          <button
                            key={v}
                            className={`rpick-btn${rateVal === v ? ' active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setRateVal(v); }}
                          >{v}</button>
                        ))}
                        {rateVal && (
                          <button
                            className="btn btn--primary"
                            style={{ fontSize: 12, padding: '4px 12px', marginLeft: 8 }}
                            onClick={(e) => { e.stopPropagation(); submitRating(null, p.id); }}
                          >Submit</button>
                        )}
                        <span className="rpick-cancel" onClick={(e) => { e.stopPropagation(); setOpenPlayerId(null); }}>✕</span>
                      </div>
                    </td>
                  </tr>
                ),
              ].filter(Boolean);
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatChatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function LiveChat({ gameId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!gameId) return;

    apiGetChat(gameId).then(setMessages).catch(() => {});

    const token = localStorage.getItem('score_token');
    const socket = io({ auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_game', gameId);
    });

    socket.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [gameId]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || !socketRef.current) return;
    setSending(true);
    socketRef.current.emit('send_message', { gameId, content: text.trim() });
    setText('');
    setSending(false);
  }

  return (
    <div className="live-chat">
      <div className="live-chat__header">
        <span className="live-dot" style={{ marginRight: 6 }} />
        Live Chat
      </div>
      <div className="live-chat__messages">
        {messages.length === 0 ? (
          <div className="live-chat__empty">Be first to say something!</div>
        ) : (
          messages.map(m => (
            <div key={m.id} className="chat-msg">
              <span className="chat-msg__user">
                {m.title_emoji && <span className="chat-msg__title">{m.title_emoji}</span>}
                {m.username}
              </span>
              {m.title_name && <span className="chat-msg__title-name">{m.title_name}</span>}
              <span className="chat-msg__text">{m.content}</span>
              <span className="chat-msg__time">{formatChatTime(m.created_at)}</span>
            </div>
          ))
        )}
      </div>
      <form className="live-chat__form" onSubmit={handleSend}>
        <input
          className="live-chat__input"
          placeholder="Say something…"
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={200}
        />
        <button className="live-chat__send" type="submit" disabled={sending || !text.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
}

/* ── 3D Game Tracker (iframe) ───────────────────────────── */
function GameTracker({ gameId, inProgress }) {
  const src = `/tracker.html?gameId=${gameId}`;
  return (
    <div className="section" style={{ marginBottom: '2rem' }}>
      <div className="sub-label" style={{ marginBottom: 8 }}>
        Game Tracker{inProgress && <span className="live-dot" style={{ marginLeft: 6 }} />}
      </div>
      <iframe
        src={src}
        style={{
          width: '100%',
          height: 520,
          border: 'none',
          borderRadius: 10,
          display: 'block',
        }}
        allow="accelerometer"
        title="Game Tracker 3D"
      />
    </div>
  );
}

export default function GamePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn } = useAuth();
  const gameId = searchParams.get('id');
  const dateKey = searchParams.get('date') || toESPNDate(new Date());
  const loginHref = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  const [gameInfo, setGameInfo] = useState(null);
  const [teams, setTeams] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [coins, setCoins] = useState(null);
  const [bet, setBet] = useState(null);
  const [playerRatings, setPlayerRatings] = useState({});

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  const [gamesList, setGamesList] = useState([]);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg); setTimeout(() => setToast(''), 2200);
  }, []);

  useEffect(() => {
    if (!gameId) { navigate('/'); return; }
    setPlayerRatings({});
    setComments([]);
    setBet(null);
    if (!isLoggedIn) setCoins(null);

    async function load() {
      setLoading(true); setError('');
      try {
        const [detail, gamesArr] = await Promise.all([
          fetchGameDetail(gameId),
          fetchGames(dateKey),
        ]);
        setTeams(detail.teams);
        setLeaders(detail.leaders);
        setGameInfo(detail.gameInfo);
        setGamesList(gamesArr);
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    }
    load();

    if (isLoggedIn) {
      apiGetCoins().then(d => setCoins(d.coins ?? 0)).catch(() => {});
      apiGetBet(gameId).then(setBet).catch(() => {});
    }
    apiGetAllPlayerRatings(gameId).then(setPlayerRatings).catch(() => {});
    apiGetComments(gameId).then(setComments).catch(() => {});
  }, [gameId, dateKey, isLoggedIn, navigate]);

  async function handleRatePlayer(playerId, score) {
    if (!isLoggedIn) {
      showToast('Sign in to rate players.');
      return;
    }
    try {
      const res = await apiRatePlayer(gameId, playerId, score);
      setPlayerRatings(prev => ({ ...prev, [String(playerId)]: { avg: res.avg, count: res.count, myRating: score } }));
      showToast(`Rated player ${score}/10!`);
      // Claim rating task
      apiClaimTask('rating').then(r => { if (r?.ok) { setCoins(r.coins); showToast('+10 coins · Player rated!'); } }).catch(() => {});
    } catch (err) { showToast(err.message); }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!isLoggedIn) {
      showToast('Sign in to join the discussion.');
      return;
    }
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      const res = await apiPostComment(gameId, commentText);
      setComments(prev => [...prev, res.comment]);
      setCommentText('');
      showToast('Comment posted!');
      apiClaimTask('comment').then(r => { if (r?.ok) { setCoins(r.coins); showToast('+15 coins · Comment posted!'); } }).catch(() => {});
    } catch (err) { showToast(err.message); }
    finally { setCommentLoading(false); }
  }

  async function handleLikeComment(id) {
    if (!isLoggedIn) {
      showToast('Sign in to like comments.');
      return;
    }
    try {
      const res = await apiLikeComment(id);
      setComments(prev => prev.map(c => c.id === id ? { ...c, likes: res.likes, liked_by_me: res.liked } : c));
    } catch (err) {
      showToast(err.message);
    }
  }

  const home = gameInfo?.home;
  const away = gameInfo?.away;
  const completed = gameInfo?.completed;
  const inProgress = gameInfo?.inProgress;

  let heroStatusClass = 'hero-status--sched', heroStatusText = 'Scheduled';
  if (inProgress) { heroStatusClass = 'hero-status--live'; heroStatusText = gameInfo?.statusText || 'Live'; }
  else if (completed) { heroStatusClass = 'hero-status--final'; heroStatusText = 'Final'; }

  return (
    <div className="app-container app-container--game">
      <Header />
      <SideNav />

      {/* Left panel: game list */}
      <aside className="panel-matches">
        <div className="panel-header">
          <Link to="/" className="back-link" style={{ textDecoration: 'none', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>← Back</Link>
        </div>
        <div className="panel-games-scroll">
          {gamesList.map(g => {
            const isActive = g.id === gameId;
            return (
              <div
                key={g.id}
                className={`game-card${isActive ? ' active-game' : ''}`}
                onClick={() => navigate(`/game?id=${g.id}&date=${dateKey}`)}
              >
                <div className={`game-card__status ${g.inProgress ? 'game-card__status--live' : g.completed ? 'game-card__status--final' : 'game-card__status--sched'}`}>
                  {g.inProgress && <span className="live-dot" style={{ marginRight: 4 }} />}
                  {g.inProgress ? `Q${g.period} ${g.clock}` : g.completed ? 'Final' : g.displayTime}
                </div>
                <div className="game-card__matchup">
                  <div className="team-side team-side--away">
                    <TeamBadge abbr={g.away.abbr} size="xs" />
                    <div className={`team-info__abbr${g.away.winner ? ' winner' : ''}`}>{g.away.abbr}</div>
                  </div>
                  <div className="score-col">
                    {(g.completed || g.inProgress) ? (
                      <>
                        <span className={`score-col__num${g.away.winner ? ' score-col__num--winner' : ''}`}>{g.away.score}</span>
                        <span className="score-col__sep">-</span>
                        <span className={`score-col__num${g.home.winner ? ' score-col__num--winner' : ''}`}>{g.home.score}</span>
                      </>
                    ) : <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>vs</span>}
                  </div>
                  <div className="team-side team-side--home">
                    <TeamBadge abbr={g.home.abbr} size="xs" />
                    <div className={`team-info__abbr${g.home.winner ? ' winner' : ''}`}>{g.home.abbr}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Stage */}
      <main className="main-stage">
        {loading ? (
          <div className="loading"><div className="loading__spinner" /><br />Loading game…</div>
        ) : error ? (
          <div className="empty">{error}</div>
        ) : (
          <>
            {/* Game Hero */}
            <div className="game-hero">
              <div className="hero-matchup">
                <div className="hero-team">
                  <TeamBadge abbr={away?.abbr} size="lg" />
                  <div className="hero-team__name">{away?.abbr}</div>
                  <div className="hero-team__record">{away?.record}</div>
                </div>
                <div className="hero-score-center">
                  {(completed || inProgress) ? (
                    <div className="hero-score">
                      <span className={`hero-score__num${away?.score > home?.score ? ' hero-score__num--winner' : ''}`}>{away?.score ?? '-'}</span>
                      <span className="hero-score__sep">-</span>
                      <span className={`hero-score__num${home?.score > away?.score ? ' hero-score__num--winner' : ''}`}>{home?.score ?? '-'}</span>
                    </div>
                  ) : (
                    <div className="hero-score"><span className="hero-score__vs">vs</span></div>
                  )}
                  <div className={`hero-status ${heroStatusClass}`}>
                    {inProgress && <span className="live-dot" style={{ marginRight: 4 }} />}
                    {heroStatusText}
                  </div>
                </div>
                <div className="hero-team">
                  <TeamBadge abbr={home?.abbr} size="lg" />
                  <div className="hero-team__name">{home?.abbr}</div>
                  <div className="hero-team__record">{home?.record}</div>
                </div>
              </div>
            </div>

            {/* Game Tracker */}
            <GameTracker gameId={gameId} inProgress={inProgress} />

            {/* Leaders */}
            {leaders.length > 0 && (
              <div className="section" style={{ marginBottom: '2rem' }}>
                <div className="sub-label">Game Leaders</div>
                <div className="leaders-grid">
                  {leaders.slice(0, 6).map((cat, i) => (
                    <div key={i} className="leader-card">
                      <div className="leader-card__cat">{cat.displayName}</div>
                      {cat.entries.map((e, j) => (
                        <div key={j}>
                          <div className="leader-card__val">{e.displayValue}</div>
                          <div className="leader-card__name">{e.athlete}</div>
                          <div className="leader-card__team">{e.team}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Boxscore */}
            {teams.map(team => (
              <BoxscoreTable
                key={team.id}
                team={team}
                playerRatings={playerRatings}
                onRatePlayer={handleRatePlayer}
                canRate={isLoggedIn}
                onRequireAuth={() => showToast('Sign in to rate players.')}
              />
            ))}

            {/* Comments */}
            <div className="section" style={{ marginBottom: '2rem' }}>
              <div className="sub-label">Discussion ({comments.length})</div>
              {comments.length === 0 ? (
                <div className="empty">No comments yet. Start the conversation!</div>
              ) : (
                <ul className="comments-list">
                  {comments.map(c => (
                    <li key={c.id} className="comment-item">
                      <div className="comment-item__avatar" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-display)', fontSize: '0.85rem', color: 'var(--text-sub)', flexShrink: 0, width: 34, height: 34 }}>
                        {(c.author_name || 'A').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="comment-item__body">
                        <div className="comment-item__header">
                          <span className="comment-item__author">@{c.author_name || 'Anonymous'}</span>
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{timeAgo(c.created_at)}</span>
                        </div>
                        <div className="comment-item__text" style={{ whiteSpace: 'pre-wrap' }}>{c.content}</div>
                        <div className="comment-item__actions">
                          <button
                            className="comment-item__likes"
                            style={{ background: 'none', border: 'none', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', padding: 0, color: c.liked_by_me ? 'var(--accent)' : 'var(--text-muted)' }}
                            onClick={() => handleLikeComment(c.id)}
                          >
                            ♥ {c.likes || 0}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Comment form */}
              <div style={{ marginTop: 16 }}>
                {isLoggedIn ? (
                  <form onSubmit={handleComment} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Add a comment…"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      style={{ flex: '1 1 240px' }}
                    />
                    <button type="submit" className="btn-send" disabled={commentLoading || !commentText.trim()}>
                      {commentLoading ? '…' : 'Send'}
                    </button>
                  </form>
                ) : (
                  <div className="form-panel" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1rem 1.1rem' }}>
                    <div style={{ color: 'var(--text-sub)', marginBottom: 10 }}>
                      Sign in to add your take, like comments, and rate the players in this game.
                    </div>
                    <Link to={loginHref} className="btn btn--primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
                      Sign In To Comment
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Right panel */}
      <aside className="panel-social">
        <div className="rp-section">
          <div className="rp-head">Score Coin</div>
          <div className="rp-coin">
            <div className="rp-coin__amount">
              <span className="rp-coin__symbol">{isLoggedIn ? 'SC' : 'Guest'}</span>
              <span className="rp-coin__num">{isLoggedIn ? (coins ?? '—') : 'Mode'}</span>
            </div>
            <div className="rp-coin__sub">{isLoggedIn ? 'Your balance' : 'Sign in to unlock predictions'}</div>
          </div>
          {!isLoggedIn && (
            <Link to={loginHref} className="btn btn--primary" style={{ display: 'inline-flex', marginTop: 12, textDecoration: 'none' }}>
              Sign In
            </Link>
          )}
        </div>

        <div className="rp-section" style={{ padding: 16 }}>
          <BetSection
            gameInfo={gameInfo}
            coins={coins}
            existingBet={bet}
            canBet={isLoggedIn}
            loginHref={loginHref}
            onBetPlaced={() => {
              apiGetBet(gameId).then(setBet).catch(() => {});
              apiGetCoins().then(d => setCoins(d.coins ?? 0)).catch(() => {});
            }}
          />
        </div>

        {gameId && inProgress && <LiveChat gameId={gameId} />}
      </aside>

      {toast && <div className="coin-toast">{toast}</div>}
    </div>
  );
}
