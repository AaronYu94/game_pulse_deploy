import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Header from '../components/Header.jsx';
import {
  apiGetCoins, apiGetBet, apiPlaceBet, apiGetGameRating, apiRateGame,
  apiGetRefRating, apiRateRef, apiGetAllPlayerRatings, apiRatePlayer,
  apiGetComments, apiPostComment, apiLikeComment, apiClaimTask,
} from '../lib/api.js';
import { fetchGames, fetchGameDetail, toESPNDate, scoreColor } from '../lib/espn.js';
import TeamLogo from '../components/TeamLogo.jsx';

const TODAY_KEY = toESPNDate(new Date());
const BET_AMOUNTS = [25, 50, 100, 200];
const AVATAR_COLORS = ['#ff6b2b','#f59500','#22c55e','#3b82f6','#a855f7','#ec4899','#14b8a6'];

// ── helpers ──────────────────────────────────────────────────────────────
function scoreClass(v) {
  const s = parseFloat(v);
  if (isNaN(s)) return '';
  if (s >= 9) return 'score--elite';
  if (s >= 8) return 'score--great';
  if (s >= 7) return 'score--good';
  if (s >= 6) return 'score--avg';
  return 'score--low';
}

function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

// ── sub-components ────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
      <div style={{ display: 'inline-block', width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite', marginBottom: '0.75rem' }} />
      <br />Loading…
    </div>
  );
}

function GameHero({ game }) {
  if (!game) return null;
  const awayWin = game.completed && game.away.winner;
  const homeWin = game.completed && game.home.winner;
  const showScore = game.completed || game.inProgress;

  let statusText, statusCls;
  if (game.inProgress) { statusText = `Q${game.period} ${game.clock}`; statusCls = 'hero-status--live'; }
  else if (game.completed) { statusText = 'Final'; statusCls = 'hero-status--final'; }
  else { statusText = game.displayTime; statusCls = 'hero-status--sched'; }

  return (
    <div style={{ position: 'relative', padding: '2rem', marginBottom: '2rem', borderRadius: 'var(--radius-xl)', background: 'var(--bg-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent-2), var(--blue))' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        {/* Away team */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
          <TeamLogo teamId={game.away.id} abbr={game.away.abbr} size={72} />
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.4rem', letterSpacing: '0.06em', lineHeight: 1 }}>{game.away.abbr}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{game.away.record}</div>
        </div>
        {/* Center scores */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', minWidth: 130 }}>
          {showScore ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2.8rem,7vw,4.5rem)', lineHeight: 1 }}>
              <span style={{ color: awayWin ? 'var(--text)' : 'var(--text-sub)' }}>{game.away.score}</span>
              <span style={{ color: 'var(--border-mid)', fontSize: '2rem' }}>-</span>
              <span style={{ color: homeWin ? 'var(--text)' : 'var(--text-sub)' }}>{game.home.score}</span>
            </div>
          ) : (
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '2rem', color: 'var(--text-muted)' }}>VS</div>
          )}
          <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: game.inProgress ? 'var(--heat)' : game.completed ? 'var(--text-muted)' : 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {game.inProgress && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--heat)', animation: 'pulse 1.4s ease-in-out infinite' }} />}
            {statusText}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{game.displayDate}</div>
        </div>
        {/* Home team */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
          <TeamLogo teamId={game.home.id} abbr={game.home.abbr} size={72} />
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.4rem', letterSpacing: '0.06em', lineHeight: 1 }}>{game.home.abbr}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{game.home.record}</div>
        </div>
      </div>
    </div>
  );
}

function BetSection({ game, gameId }) {
  const [bet, setBet] = useState(null);
  const [coins, setCoins] = useState(null);
  const [pick, setPick] = useState(null);
  const [amount, setAmount] = useState(50);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    Promise.all([apiGetBet(gameId).catch(() => null), apiGetCoins().catch(() => null)]).then(([b, c]) => {
      setBet(b);
      if (c) setCoins(c.coins);
      setLoading(false);
    });
  }, [gameId]);

  async function placeBet() {
    if (!pick || !amount) return;
    setPlacing(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await apiPlaceBet(gameId, pick, amount, game.home.abbr, game.away.abbr);
      setBet(res.bet);
      setCoins(res.coins);
      setMsg({ text: `Bet placed! Remaining: SC ${res.coins}`, type: 'ok' });
    } catch (err) {
      setMsg({ text: err.message, type: 'err' });
    } finally {
      setPlacing(false);
    }
  }

  if (loading) return null;

  return (
    <div className="card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden', marginBottom: '2rem', borderRadius: 'var(--radius-xl)' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--accent-2), var(--accent))' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>Score Coin Prediction</div>
        {coins !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.2rem', color: 'var(--accent-2)' }}>
            SC {coins}
          </div>
        )}
      </div>

      {bet ? (
        <div style={{ padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.3rem', letterSpacing: '0.06em', color: bet.settled ? (bet.won ? 'var(--success)' : 'var(--heat)') : 'var(--blue)' }}>
              {bet.pick === 'home' ? bet.home_abbr : bet.away_abbr}
              {bet.settled && (bet.won ? ' ✓ Won' : ' ✗ Lost')}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>
              Wagered <strong style={{ color: 'var(--accent-2)' }}>SC {bet.amount}</strong>
              {bet.settled && bet.won && <span style={{ color: 'var(--success)' }}> · Won SC {bet.amount * 2}</span>}
            </div>
          </div>
          {!bet.settled && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Awaiting result…</div>}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
            <div onClick={() => setPick('away')} style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', border: `2px solid ${pick === 'away' ? 'var(--blue)' : 'var(--border)'}`, background: pick === 'away' ? 'var(--blue-glow)' : 'var(--bg-surface)', cursor: 'pointer', textAlign: 'center', userSelect: 'none', transition: 'all .16s' }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.4rem', color: pick === 'away' ? 'var(--blue)' : 'var(--text)', lineHeight: 1, marginBottom: '0.2rem' }}>{game.away.abbr}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase' }}>Away</div>
            </div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.1rem', color: 'var(--text-muted)', textAlign: 'center' }}>VS</div>
            <div onClick={() => setPick('home')} style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', border: `2px solid ${pick === 'home' ? 'var(--blue)' : 'var(--border)'}`, background: pick === 'home' ? 'var(--blue-glow)' : 'var(--bg-surface)', cursor: 'pointer', textAlign: 'center', userSelect: 'none', transition: 'all .16s' }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.4rem', color: pick === 'home' ? 'var(--blue)' : 'var(--text)', lineHeight: 1, marginBottom: '0.2rem' }}>{game.home.abbr}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase' }}>Home</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '0.1rem', whiteSpace: 'nowrap' }}>Amount:</span>
            {BET_AMOUNTS.map(a => (
              <div key={a} onClick={() => setAmount(a)} style={{ padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-pill)', border: `1px solid ${amount === a ? 'var(--accent-2)' : 'var(--border)'}`, background: amount === a ? 'rgba(255,149,0,.12)' : 'var(--bg-surface)', fontSize: '0.78rem', fontWeight: 700, color: amount === a ? 'var(--accent-2)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all .13s', userSelect: 'none' }}>
                {a}
              </div>
            ))}
            <button onClick={placeBet} disabled={!pick || placing} style={{ padding: '0.5rem 1.4rem', borderRadius: 'var(--radius-pill)', border: 'none', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', opacity: (!pick || placing) ? 0.35 : 1, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {placing ? 'Placing…' : 'Confirm Bet'}
            </button>
          </div>
          {msg.text && <div style={{ fontSize: '0.8rem', color: msg.type === 'err' ? 'var(--heat)' : 'var(--success)' }}>{msg.text}</div>}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>1:1 payout · Win 2× your wager</div>
        </>
      )}
    </div>
  );
}

function BoxscoreTab({ gameId, detail, onPlayerRate }) {
  const [playerRatings, setPlayerRatings] = useState({});
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  useEffect(() => {
    if (!gameId) return;
    apiGetAllPlayerRatings(gameId).then(setPlayerRatings).catch(() => {});
  }, [gameId]);

  async function ratePlayer(playerId, score) {
    try {
      const res = await apiRatePlayer(gameId, playerId, score);
      setPlayerRatings(prev => ({
        ...prev,
        [playerId]: { avg: res.avg, count: res.count, myScore: score },
      }));
      onPlayerRate?.();
      setExpandedPlayer(null);
    } catch (_) {}
  }

  if (!detail) return <LoadingSpinner />;
  if (!detail.teams?.length) return <div className="empty">Boxscore not available.</div>;

  return (
    <div>
      {/* Leaders */}
      {detail.leaders?.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '0.85rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border)' }}>Game Leaders</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.7rem' }}>
            {detail.leaders.map((cat, i) => {
              const top = cat.leaders?.[0];
              if (!top) return null;
              return (
                <div key={i} className="card" style={{ padding: '1rem 1.1rem' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>{cat.displayName}</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.8rem', color: 'var(--accent)', lineHeight: 1, marginBottom: '0.2rem' }}>{top.displayValue}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{top.athlete}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{top.team}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team tables */}
      {detail.teams.map(team => (
        <div key={team.id} style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.65rem' }}>
            <TeamLogo teamId={team.id} abbr={team.abbr} size={28} />
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.1rem', letterSpacing: '0.06em' }}>{team.name}</div>
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.55rem 1rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' }}>Player</th>
                  {['MIN','PTS','REB','AST','STL','BLK','TO','FG','3PT','FT','+/-'].map(h => (
                    <th key={h} style={{ padding: '0.55rem 0.65rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                  <th style={{ padding: '0.55rem 0.65rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', textAlign: 'center', whiteSpace: 'nowrap' }}>Rating</th>
                </tr>
              </thead>
              <tbody>
                {team.players.map(p => {
                  const rat = playerRatings[p.id];
                  const isExpanded = expandedPlayer === p.id;
                  return (
                    <>
                      <tr key={p.id} style={{ opacity: p.dnp ? 0.42 : 1, fontStyle: p.dnp ? 'italic' : 'normal' }}>
                        <td style={{ padding: '0.55rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text)', borderTop: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                            {p.starter && <span style={{ display: 'inline-block', width: 3, height: 3, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{p.jersey || '#'}</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>{p.name}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{p.position}</div>
                            </div>
                          </div>
                        </td>
                        {[p.min, p.pts, p.reb, p.ast, p.stl, p.blk, p.to, p.fg, p.fg3, p.ft, p.pm].map((v, i) => (
                          <td key={i} style={{ padding: '0.55rem 0.65rem', textAlign: 'center', color: i === 1 ? 'var(--text)' : 'var(--text-sub)', fontWeight: i === 1 ? 700 : 400, borderTop: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{v ?? '--'}</td>
                        ))}
                        <td style={{ padding: '0.55rem 0.65rem', textAlign: 'center', borderTop: '1px solid var(--border)', minWidth: 72 }}>
                          {!p.dnp && (
                            <div onClick={() => setExpandedPlayer(isExpanded ? null : p.id)} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: 1, padding: '0.2rem 0.35rem', borderRadius: 'var(--radius-sm)', transition: 'background .15s', userSelect: 'none' }}>
                              {rat ? (
                                <>
                                  <span className={scoreClass(rat.avg)} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.15rem', lineHeight: 1 }}>{parseFloat(rat.avg).toFixed(1)}</span>
                                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{rat.count} ratings{rat.myScore ? ` · You: ${rat.myScore}` : ''}</span>
                                </>
                              ) : (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rate</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {isExpanded && !p.dnp && (
                        <tr key={`picker-${p.id}`}>
                          <td colSpan={13} style={{ padding: '0 1rem 0.65rem', borderTop: 'none', background: 'var(--bg-card-hover)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '0.25rem', whiteSpace: 'nowrap' }}>Rate {p.name}:</span>
                              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                <button key={n} onClick={() => ratePlayer(p.id, n)} style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', border: `1px solid ${rat?.myScore === n ? 'var(--accent)' : 'var(--border)'}`, background: rat?.myScore === n ? 'var(--accent-glow)' : 'var(--bg-surface)', color: rat?.myScore === n ? 'var(--accent)' : 'var(--text-muted)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .13s', flexShrink: 0 }}>
                                  {n}
                                </button>
                              ))}
                              <span onClick={() => setExpandedPlayer(null)} style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentsTab({ gameId, onCommentPost }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGetComments(gameId).then(c => { setComments(c); setLoading(false); }).catch(() => setLoading(false));
  }, [gameId]);

  async function submit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiPostComment(gameId, content.trim());
      setComments(prev => [res.comment, ...prev]);
      setContent('');
      onCommentPost?.();
    } catch (_) {}
    setSubmitting(false);
  }

  async function likeComment(id) {
    try {
      await apiLikeComment(id);
      setComments(prev => prev.map(c => c.id === id ? { ...c, likes_count: c.liked_by_me ? c.likes_count - 1 : c.likes_count + 1, liked_by_me: !c.liked_by_me } : c));
    } catch (_) {}
  }

  return (
    <div>
      <form onSubmit={submit} style={{ marginBottom: '1.5rem' }}>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Share your thoughts…" rows={3} style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.9rem', padding: '0.75rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button type="submit" className="btn btn--primary" disabled={submitting || !content.trim()}>{submitting ? 'Posting…' : 'Post'}</button>
        </div>
      </form>

      {loading ? <LoadingSpinner /> : comments.length === 0 ? (
        <div className="empty">No comments yet. Be the first!</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {comments.map(c => (
            <div key={c.id} className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.45rem', lineHeight: 1.55 }}>{c.content}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--text-sub)' }}>{c.username}</strong>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>{timeAgo(c.created_at)}</span>
                <span onClick={() => likeComment(c.id)} style={{ marginLeft: 'auto', color: c.liked_by_me ? 'var(--heat)' : 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
                  ♥ {c.likes_count || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PredictTab({ gameId, game }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [pick, setPick] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGetComments(gameId).then(all => {
      setItems(all.filter(c => c.pick));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [gameId]);

  async function submit(e) {
    e.preventDefault();
    if (!content.trim() || !pick) return;
    setSubmitting(true);
    try {
      const res = await apiPostComment(gameId, content.trim(), null, pick);
      setItems(prev => [res.comment, ...prev]);
      setContent('');
      setPick(null);
    } catch (_) {}
    setSubmitting(false);
  }

  async function like(id) {
    try {
      await apiLikeComment(id);
      setItems(prev => prev.map(c => c.id === id ? { ...c, likes_count: c.liked_by_me ? c.likes_count - 1 : c.likes_count + 1, liked_by_me: !c.liked_by_me } : c));
    } catch (_) {}
  }

  return (
    <div>
      <div className="card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--blue), #60a5fa)' }} />
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem' }}>Your Prediction</div>
        <form onSubmit={submit}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {game && (
              <>
                <div onClick={() => setPick('away')} style={{ flex: 1, padding: '0.65rem', borderRadius: 'var(--radius-md)', border: `2px solid ${pick === 'away' ? 'var(--blue)' : 'var(--border)'}`, background: pick === 'away' ? 'var(--blue-glow)' : 'var(--bg-surface)', cursor: 'pointer', textAlign: 'center', transition: 'all .15s', userSelect: 'none' }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.1rem', color: pick === 'away' ? 'var(--blue)' : 'var(--text)' }}>{game.away.abbr}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Away wins</div>
                </div>
                <div onClick={() => setPick('home')} style={{ flex: 1, padding: '0.65rem', borderRadius: 'var(--radius-md)', border: `2px solid ${pick === 'home' ? 'var(--blue)' : 'var(--border)'}`, background: pick === 'home' ? 'var(--blue-glow)' : 'var(--bg-surface)', cursor: 'pointer', textAlign: 'center', transition: 'all .15s', userSelect: 'none' }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.1rem', color: pick === 'home' ? 'var(--blue)' : 'var(--text)' }}>{game.home.abbr}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Home wins</div>
                </div>
              </>
            )}
          </div>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Explain your prediction…" rows={2} style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.9rem', padding: '0.65rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn--primary" disabled={submitting || !content.trim() || !pick}>{submitting ? 'Posting…' : 'Post Prediction'}</button>
          </div>
        </form>
      </div>

      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <div className="empty">No predictions yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {items.map(c => (
            <div key={c.id} className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.45rem', lineHeight: 1.55 }}>{c.content}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--text-sub)' }}>{c.username}</strong>
                {c.pick && game && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: 'var(--blue-glow)', border: '1px solid rgba(59,130,246,.25)', color: 'var(--blue)', fontSize: '0.72rem', fontWeight: 700, padding: '0.12rem 0.5rem', borderRadius: 'var(--radius-pill)' }}>
                    {c.pick === 'home' ? game.home.abbr : game.away.abbr} wins
                  </span>
                )}
                <span style={{ opacity: 0.4 }}>·</span>
                <span>{timeAgo(c.created_at)}</span>
                <span onClick={() => like(c.id)} style={{ marginLeft: 'auto', color: c.liked_by_me ? 'var(--heat)' : 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
                  ♥ {c.likes_count || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RatingsSection({ gameId }) {
  const [gameRating, setGameRating] = useState(null);
  const [refRating, setRefRating] = useState(null);
  const [myGameScore, setMyGameScore] = useState(null);
  const [myRefVerdict, setMyRefVerdict] = useState(null);

  useEffect(() => {
    apiGetGameRating(gameId).then(d => { setGameRating(d); setMyGameScore(d.myScore); }).catch(() => {});
    apiGetRefRating(gameId).then(d => { setRefRating(d); setMyRefVerdict(d.myVerdict); }).catch(() => {});
  }, [gameId]);

  async function rateGame(score) {
    const res = await apiRateGame(gameId, score).catch(() => null);
    if (res) { setGameRating(res); setMyGameScore(score); }
  }
  async function rateRef(verdict) {
    const res = await apiRateRef(gameId, verdict).catch(() => null);
    if (res) { setRefRating(res); setMyRefVerdict(verdict); }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
      {/* Game rating */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Rate this Game</div>
        {gameRating && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span className={scoreClass(gameRating.avg)} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '2rem', lineHeight: 1 }}>{gameRating.avg ? parseFloat(gameRating.avg).toFixed(1) : '—'}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{gameRating.count} ratings</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} onClick={() => rateGame(n)} style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', border: `1px solid ${myGameScore === n ? 'var(--accent)' : 'var(--border)'}`, background: myGameScore === n ? 'var(--accent-glow)' : 'var(--bg-surface)', color: myGameScore === n ? 'var(--accent)' : 'var(--text-muted)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '0.95rem', cursor: 'pointer', transition: 'all .13s' }}>
              {n}
            </button>
          ))}
        </div>
      </div>
      {/* Ref rating */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Rate the Refs</div>
        {refRating && refRating.counts && (
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
            {['good','ok','bad'].map(v => (
              <div key={v} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.4rem', lineHeight: 1, color: v === 'good' ? 'var(--success)' : v === 'bad' ? 'var(--heat)' : 'var(--text-sub)' }}>{refRating.counts[v] || 0}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[['good','👍 Good'],['ok','😐 OK'],['bad','👎 Bad']].map(([v, label]) => (
            <button key={v} onClick={() => rateRef(v)} style={{ flex: 1, padding: '0.4rem', borderRadius: 'var(--radius-md)', border: `1px solid ${myRefVerdict === v ? 'var(--accent)' : 'var(--border)'}`, background: myRefVerdict === v ? 'var(--accent-glow)' : 'var(--bg-surface)', color: myRefVerdict === v ? 'var(--accent)' : 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', transition: 'all .13s', fontFamily: 'inherit' }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PlayerRatingsTab ──────────────────────────────────────────────────────

function PlayerRatingsTab({ gameId, detail }) {
  const [ratings,  setRatings]  = useState({});
  const [expanded, setExpanded] = useState(null); // playerId

  useEffect(() => {
    if (!gameId) return;
    apiGetAllPlayerRatings(gameId).then(setRatings).catch(() => {});
  }, [gameId]);

  async function rate(playerId, score) {
    try {
      const res = await apiRatePlayer(gameId, playerId, score);
      setRatings(prev => ({ ...prev, [playerId]: { avg: res.avg, count: res.count, myScore: score } }));
      setExpanded(null);
    } catch (_) {}
  }

  if (!detail) return <LoadingSpinner />;
  if (!detail.teams?.length) return <div className="empty">Player data not available.</div>;

  return (
    <div>
      {detail.teams.map(team => (
        <div key={team.id} style={{ marginBottom: '2.5rem' }}>
          {/* Team header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border)' }}>
            <TeamLogo teamId={team.id} abbr={team.abbr} size={28} />
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.15rem', letterSpacing: '0.06em' }}>{team.name}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {team.players.filter(p => !p.dnp && p.active).map(p => {
              const rat = ratings[p.id];
              const isOpen = expanded === p.id;
              const avg = rat?.avg ? parseFloat(rat.avg) : null;

              return (
                <div key={p.id} className="card" style={{ padding: '1rem 1.1rem', position: 'relative', overflow: 'hidden', transition: 'border-color .15s', borderColor: isOpen ? 'var(--accent)' : undefined }}>
                  {/* Accent top bar if rated */}
                  {rat?.myScore && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
                  )}

                  {/* Player identity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {p.jersey || '#'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.position}{p.starter ? ' · Starter' : ''}</div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.85rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                    {[['PTS', p.pts], ['REB', p.reb], ['AST', p.ast]].map(([label, val]) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.3rem', lineHeight: 1, color: label === 'PTS' ? 'var(--text)' : 'var(--text-sub)' }}>{val ?? '--'}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                      </div>
                    ))}
                    <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.3rem', lineHeight: 1, color: 'var(--text-sub)' }}>{p.min ?? '--'}</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>MIN</div>
                    </div>
                  </div>

                  {/* Community rating + your score */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                    <div>
                      {avg !== null ? (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                          <span className={scoreClass(avg)} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.8rem', lineHeight: 1 }}>{avg.toFixed(1)}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{rat.count} ratings</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No ratings yet</span>
                      )}
                    </div>
                    {rat?.myScore && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.1rem' }}>Your rating</div>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.4rem', lineHeight: 1, color: 'var(--accent)' }}>{rat.myScore}</div>
                      </div>
                    )}
                  </div>

                  {/* Rate / picker toggle */}
                  {!isOpen ? (
                    <button
                      onClick={() => setExpanded(p.id)}
                      className="btn btn--primary"
                      style={{ width: '100%', fontSize: '0.8rem', padding: '0.45rem' }}
                    >
                      {rat?.myScore ? 'Change Rating' : 'Rate Player'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                        {[10,9,8,7,6,5,4,3,2,1].map(n => (
                          <button
                            key={n}
                            onClick={() => rate(p.id, n)}
                            style={{
                              padding: '0.3rem 0', borderRadius: 'var(--radius-sm)',
                              border: `1px solid ${rat?.myScore === n ? 'var(--accent)' : 'var(--border)'}`,
                              background: rat?.myScore === n ? 'var(--accent-glow)' : 'var(--bg-surface)',
                              color: rat?.myScore === n ? 'var(--accent)' : 'var(--text-muted)',
                              fontFamily: "'Bebas Neue',sans-serif", fontSize: '0.95rem',
                              cursor: 'pointer', transition: 'all .13s', lineHeight: 1,
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setExpanded(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer', padding: '0 0.2rem', fontFamily: 'inherit', alignSelf: 'center' }}>✕</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── LiveChatTab ───────────────────────────────────────────────────────────

function LiveChatTab({ gameId }) {
  const [messages, setMessages]     = useState([]);
  const [text, setText]             = useState('');
  const [connected, setConnected]   = useState(false);
  const [inventory, setInventory]   = useState([]);
  const [showStickers, setShowStickers] = useState(false);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const token = localStorage.getItem('score_token');

  // Load history then connect socket
  useEffect(() => {
    if (!gameId || !token) return;

    // Fetch history + inventory in parallel
    fetch(`/api/chat/${gameId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setMessages(d.messages || [])).catch(() => {});
    fetch('/api/shop/inventory', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setInventory(d.items || [])).catch(() => {});

    // Connect socket
    const socket = io({ auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_game', gameId);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [gameId, token]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send(e) {
    e.preventDefault();
    if (!text.trim() || !socketRef.current) return;
    socketRef.current.emit('send_message', { gameId, content: text.trim() });
    setText('');
  }

  function sendSticker(item) {
    if (!socketRef.current) return;
    socketRef.current.emit('send_sticker', { gameId, itemId: item.id });
    // Deduct locally so UI reflects immediately
    setInventory(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0));
    setShowStickers(false);
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 680, background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? 'var(--success)' : 'var(--border-mid)', animation: connected ? 'pulse 1.4s ease-in-out infinite' : 'none' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Live Chat
          </span>
        </div>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          {connected ? 'Connected' : 'Connecting…'}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '0.5rem', scrollbarWidth: 'thin' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map((m, i) => {
          const myUsername = JSON.parse(localStorage.getItem('score_user') || '{}')?.username;
          const mine = m.username === myUsername;
          const showAvatar = i === messages.length - 1 || messages[i + 1].username !== m.username;
          const showName = i === 0 || messages[i - 1].username !== m.username;
          const color = AVATAR_COLORS[Math.abs([...m.username].reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)) % AVATAR_COLORS.length];
          const isSticker = !!m.sticker_id;
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'flex-end', gap: '0.55rem' }}>
              {/* Avatar column */}
              <div style={{ width: 30, flexShrink: 0 }}>
                {showAvatar && (
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '0.85rem', color: '#fff', userSelect: 'none' }}>
                    {m.username[0].toUpperCase()}
                  </div>
                )}
              </div>
              {/* Bubble */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: 'calc(100% - 80px)' }}>
                {showName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem', paddingLeft: '0.1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.63rem', fontWeight: 700, color: mine ? 'var(--accent-2)' : 'var(--accent)' }}>
                      {mine ? 'You' : m.username}
                    </span>
                    {m.title_name && (
                      <span style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '0.05rem 0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', lineHeight: 1.4 }}>
                        {m.title_emoji} {m.title_name}
                      </span>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem' }}>
                  {isSticker ? (
                    <div style={{ fontSize: '3rem', lineHeight: 1, padding: '0.3rem', animation: 'stickerPop .3s cubic-bezier(.34,1.56,.64,1)' }}>
                      {m.content}
                    </div>
                  ) : (
                    <div style={{
                      padding: '0.45rem 0.75rem', borderRadius: '14px 14px 14px 4px',
                      background: mine ? 'var(--accent-glow)' : 'var(--bg-surface)',
                      border: `1px solid ${mine ? 'rgba(255,107,43,.3)' : 'var(--border)'}`,
                      color: 'var(--text)', fontSize: '0.88rem', lineHeight: 1.45, wordBreak: 'break-word',
                    }}>
                      {m.content}
                    </div>
                  )}
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', flexShrink: 0, marginBottom: '0.1rem', whiteSpace: 'nowrap' }}>
                    {formatTime(m.created_at)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Sticker picker */}
      {showStickers && (
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flexShrink: 0 }}>
          {inventory.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.25rem 0' }}>
              No stickers — visit the <a href="/shop" style={{ color: 'var(--accent)' }}>Shop</a> to buy some!
            </div>
          ) : inventory.map(item => (
            <button
              key={item.id}
              onClick={() => sendSticker(item)}
              title={`${item.name} × ${item.quantity}`}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, position: 'relative', transition: 'border-color .13s' }}
            >
              {item.emoji}
              <span style={{ position: 'absolute', top: 1, right: 3, fontSize: '0.55rem', fontWeight: 700, color: 'var(--accent-2)' }}>{item.quantity}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={send} style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexShrink: 0, background: 'var(--bg-surface)' }}>
        <button
          type="button"
          onClick={() => setShowStickers(s => !s)}
          title="Stickers"
          style={{ background: showStickers ? 'var(--accent-glow)' : 'none', border: `1px solid ${showStickers ? 'rgba(255,107,43,.3)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', padding: '0.4rem 0.55rem', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, flexShrink: 0, transition: 'all .13s' }}
        >
          🎁
        </button>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={connected ? 'Send a message…' : 'Connecting…'}
          disabled={!connected}
          maxLength={300}
          style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.88rem', padding: '0.45rem 1rem', outline: 'none' }}
        />
        <button
          type="submit"
          disabled={!connected || !text.trim()}
          style={{ padding: '0.45rem 1.1rem', borderRadius: 'var(--radius-pill)', border: 'none', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', opacity: (!connected || !text.trim()) ? 0.4 : 1, flexShrink: 0, fontFamily: 'inherit' }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

// ── main GamePage ─────────────────────────────────────────────────────────
export default function GamePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const gameId = params.get('id');
  const dateKey = params.get('date') || TODAY_KEY;

  const [game, setGame] = useState(null);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('boxscore');
  // A game is "upcoming" (bettable) if it hasn't started or finished
  const canBet    = game && !game.completed && !game.inProgress;
  const hasScores = game && (game.completed || game.inProgress);

  useEffect(() => {
    if (!gameId) return;
    fetchGames(dateKey).then(games => {
      const g = games.find(g => g.id === gameId);
      if (g) setGame(g);
    }).catch(() => {});
    // Only fetch boxscore for live/finished games
    fetchGameDetail(gameId).then(setDetail).catch(() => {});
  }, [gameId, dateKey]);

  const tabs = hasScores
    ? [
        { key: 'boxscore', label: 'Boxscore' },
        { key: 'players',  label: 'Rate Players' },
        { key: 'chat',     label: 'Live Chat' },
        { key: 'comments', label: 'Comments' },
        { key: 'predict',  label: 'Predictions' },
      ]
    : [
        { key: 'chat',     label: 'Live Chat' },
        { key: 'predict',  label: 'Predictions' },
        { key: 'comments', label: 'Comments' },
      ];

  const activeTab = (!hasScores && (tab === 'boxscore' || tab === 'players')) ? 'chat' : tab;

  return (
    <div className="page">
      <Header />

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0', fontFamily: 'inherit' }}>
          ← Back to Games
        </button>
      </div>

      <GameHero game={game} />

      {canBet && <BetSection game={game} gameId={gameId} />}

      {hasScores && gameId && <RatingsSection gameId={gameId} />}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '0.7rem 1.2rem', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t.key ? 'var(--accent)' : 'transparent'}`, fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700, color: activeTab === t.key ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', marginBottom: -1, transition: 'color .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'boxscore' && <BoxscoreTab gameId={gameId} detail={detail} onPlayerRate={() => {}} />}
      {activeTab === 'players'  && <PlayerRatingsTab gameId={gameId} detail={detail} />}
      {activeTab === 'chat'     && gameId && <LiveChatTab gameId={gameId} />}
      {activeTab === 'comments' && gameId && <CommentsTab gameId={gameId} onCommentPost={() => {}} />}
      {activeTab === 'predict'  && gameId && <PredictTab gameId={gameId} game={game} />}

      <footer className="site-footer" style={{ marginTop: '3rem' }}>SCORE · NBA · Powered by ESPN · Data for reference only</footer>
    </div>
  );
}
