import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { apiGetProfile, apiUpdateProfile } from '../lib/api.js';

const AVATAR_COLORS = ['#ff6b2b','#f59500','#22c55e','#3b82f6','#a855f7','#ec4899','#14b8a6'];

function avatarColor(username) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatCard({ label, value, highlight }) {
  return (
    <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.6rem', lineHeight: 1, color: highlight ? 'var(--accent-2)' : 'var(--text)', marginBottom: '0.2rem' }}>{value}</div>
      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('bets');
  const [editBio, setEditBio] = useState(false);
  const [bio, setBio]         = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    apiGetProfile()
      .then(d => { setData(d); setBio(d.user.bio || ''); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function saveBio() {
    setSaving(true);
    try {
      await apiUpdateProfile({ bio });
      setData(prev => ({ ...prev, user: { ...prev.user, bio } }));
      setEditBio(false);
    } catch (_) {}
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="page">
        <Header />
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'inline-block', width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <Header />
        <div className="empty">Failed to load profile.</div>
      </div>
    );
  }

  const { user, betStats, bets, forumStats, topics, ratings } = data;
  const color = avatarColor(user.username);
  const settled = (betStats.won || 0) + (betStats.lost || 0);
  const winRate = settled > 0 ? Math.round(((betStats.won || 0) / settled) * 100) : null;

  const TABS = [
    { key: 'bets',  label: `Bets (${betStats.total || 0})` },
    { key: 'forum', label: `Forum (${(forumStats.topics || 0) + (forumStats.replies || 0)})` },
  ];

  return (
    <div className="page">
      <Header />

      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: '0.5rem 0', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        >
          ← Back
        </button>
      </div>

      {/* ── Profile hero ── */}
      <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, var(--accent-2))` }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: '2.2rem', color: '#fff', flexShrink: 0, boxShadow: `0 0 0 4px ${color}22` }}>
            {user.username[0].toUpperCase()}
          </div>

          {/* Name + bio */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.8rem', letterSpacing: '0.06em', lineHeight: 1, marginBottom: '0.25rem' }}>
              {user.username}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
              Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>

            {editBio ? (
              <div>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  maxLength={160}
                  rows={2}
                  placeholder="Write something about yourself…"
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.88rem', padding: '0.5rem 0.75rem', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={saveBio} disabled={saving} className="btn btn--primary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.9rem' }}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditBio(false); setBio(data.user.bio || ''); }}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '0.3rem 0.9rem', fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.88rem', color: user.bio ? 'var(--text-sub)' : 'var(--text-muted)', fontStyle: user.bio ? 'normal' : 'italic', lineHeight: 1.5 }}>
                  {user.bio || 'No bio yet.'}
                </span>
                <button
                  onClick={() => setEditBio(true)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '0.15rem 0.55rem', fontSize: '0.68rem', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, marginTop: 2 }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Coins */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '2.2rem', lineHeight: 1, color: 'var(--accent-2)' }}>
              {user.coins}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Score Coin</div>
          </div>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.7rem', marginBottom: '2rem' }}>
        <StatCard label="Bets Placed"    value={betStats.total   || 0} />
        <StatCard label="Win / Loss"     value={betStats.total > 0 ? `${betStats.won || 0} / ${betStats.lost || 0}` : '—'} />
        <StatCard label="Win Rate"       value={winRate !== null ? `${winRate}%` : '—'} highlight={winRate >= 50} />
        <StatCard label="Pending Bets"   value={betStats.pending || 0} />
        <StatCard label="Game Ratings"   value={ratings.games   || 0} />
        <StatCard label="Player Ratings" value={ratings.players || 0} />
        <StatCard label="Ref Ratings"    value={ratings.refs    || 0} />
        <StatCard label="Forum Topics"   value={forumStats.topics  || 0} />
        <StatCard label="Forum Replies"  value={forumStats.replies || 0} />
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ padding: '0.7rem 1.2rem', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`, fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700, color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', marginBottom: -1, transition: 'color .15s' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Bet history ── */}
      {tab === 'bets' && (
        bets.length === 0 ? (
          <div className="empty">No bets placed yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {bets.map(b => {
              const pickedTeam = b.pick === 'home' ? b.home_abbr : b.away_abbr;
              return (
                <div
                  key={b.id}
                  className="card"
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
                    borderColor: b.settled ? (b.won ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.25)') : undefined,
                  }}
                >
                  <div>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.05rem', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                      {b.away_abbr} vs {b.home_abbr}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                      <span>Picked <strong style={{ color: 'var(--accent-2)' }}>{pickedTeam}</strong></span>
                      <span style={{ opacity: 0.35 }}>·</span>
                      <span>SC {b.amount}</span>
                      <span style={{ opacity: 0.35 }}>·</span>
                      <span>{timeAgo(b.placed_at)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {!b.settled ? (
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--blue)' }}>Pending</div>
                    ) : b.won ? (
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.15rem', color: 'var(--success)', lineHeight: 1 }}>Won</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--success)', opacity: 0.85 }}>+SC {b.amount}</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.15rem', color: 'var(--heat)', lineHeight: 1 }}>Lost</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--heat)', opacity: 0.75 }}>-SC {b.amount}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Forum activity ── */}
      {tab === 'forum' && (
        topics.length === 0 ? (
          <div className="empty">No forum topics yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {topics.map(t => (
              <Link key={t.id} to={`/forum?topic=${t.id}`} style={{ textDecoration: 'none' }}>
                <div className="card card--interactive" style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', background: 'var(--accent-glow)', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-pill)' }}>
                      {t.category}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.25rem' }}>{t.title}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {t.views} views · {timeAgo(t.created_at)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}

      <footer className="site-footer" style={{ marginTop: '3rem' }}>
        SCORE · NBA · Powered by ESPN · Data for reference only · Score Coin is virtual currency with no real-world value
      </footer>
    </div>
  );
}
