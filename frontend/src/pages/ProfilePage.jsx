import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header, { SideNav } from '../components/Header.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  apiGetProfile, apiUpdateProfile, apiGetCoins,
} from '../lib/api.js';

export default function ProfilePage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [coins, setCoins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [profileData, coinData] = await Promise.all([
          apiGetProfile(),
          apiGetCoins(),
        ]);
        setProfile(profileData);
        setCoins(coinData.coins ?? 0);
        setBio(profileData.user?.bio || '');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSaveBio() {
    setBioSaving(true);
    try {
      await apiUpdateProfile({ bio });
      showToast('Bio saved!');
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      setBioSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const user = profile?.user;
  const betStats = profile?.betStats || {};
  const bets = profile?.bets || [];
  const forumStats = profile?.forumStats || {};
  const topics = profile?.topics || [];
  const ratings = profile?.ratings || {};
  const winRate = betStats.total > 0 ? Math.round((betStats.won / betStats.total) * 100) : 0;
  const initials = (user?.username || '?').slice(0, 2).toUpperCase();
  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : '';

  return (
    <div className="app-container">
      <style>{`
        .profile-hero {
          background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
          border: 1px solid var(--border);
          padding: 28px 32px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .profile-hero::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--accent), var(--blue));
        }
        .profile-avatar {
          width: 72px; height: 72px;
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          background: var(--accent);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--f-display);
          font-size: 28px;
          color: #fff;
          flex-shrink: 0;
        }
        .profile-hero__info { flex: 1; min-width: 0; }
        .profile-hero__name {
          font-family: var(--f-display);
          font-size: 38px;
          line-height: 1;
          color: var(--text);
        }
        .profile-hero__joined {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 6px;
        }
        .profile-hero__coins {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        .profile-hero__coins-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
        }
        .profile-hero__coins-num {
          font-family: var(--f-display);
          font-size: 36px;
          color: var(--accent);
          line-height: 1;
        }
        .profile-hero__coins-sym {
          font-family: var(--f-display);
          font-size: 16px;
          color: var(--accent);
        }
        .stat-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 24px;
        }
        .stat-card {
          border: 1px solid var(--border);
          background: var(--bg-card);
          padding: 14px 16px;
        }
        .stat-card__label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        .stat-card__value {
          font-family: var(--f-display);
          font-size: 30px;
          color: var(--text);
          line-height: 1;
        }
        .stat-card__value.accent { color: var(--accent); }
        .stat-card__value.green { color: #22c55e; }
        .stat-card__value.blue { color: var(--blue); }
        .section-head {
          font-family: var(--f-display);
          font-size: 20px;
          letter-spacing: .04em;
          color: var(--text);
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 10px;
        }
        .section-head::before {
          content: '';
          width: 4px; height: 20px;
          background: var(--accent);
          display: block;
          flex-shrink: 0;
        }
        .bio-section { margin-bottom: 24px; }
        .bio-text {
          font-size: 14px;
          color: var(--text-sub);
          line-height: 1.6;
          margin-bottom: 8px;
          min-height: 40px;
        }
        .bio-edit-row {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }
        .bio-edit-row textarea {
          flex: 1;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 8px 10px;
          font-size: 13px;
          font-family: var(--f-body);
          resize: vertical;
          min-height: 60px;
        }
        .bio-edit-row textarea:focus { outline: none; border-color: var(--accent); }
        .bio-save-btn {
          padding: 8px 18px;
          background: var(--accent);
          border: none;
          color: #fff;
          font-family: var(--f-display);
          font-size: 14px;
          cursor: pointer;
          transition: opacity .15s;
          flex-shrink: 0;
        }
        .bio-save-btn:hover { opacity: .85; }
        .bio-save-btn:disabled { opacity: .4; cursor: not-allowed; }
        .bet-table-wrap { overflow-x: auto; border: 1px solid var(--border); margin-bottom: 24px; }
        .bet-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .bet-table th {
          padding: 8px 12px;
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .08em; color: var(--text-muted);
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border);
          text-align: left;
        }
        .bet-table td {
          padding: 8px 12px;
          border-top: 1px solid var(--border);
          color: var(--text-sub);
        }
        .bet-table tr:hover td { background: var(--bg-card-hover); }
        .bet-status { font-size: 11px; font-weight: 700; padding: 2px 7px; border: 1px solid; }
        .bet-status--won { color: #22c55e; border-color: rgba(34,197,94,.3); background: rgba(34,197,94,.08); }
        .bet-status--lost { color: var(--heat); border-color: rgba(239,68,68,.3); background: rgba(239,68,68,.08); }
        .bet-status--pending { color: var(--blue); border-color: rgba(59,130,246,.3); background: rgba(59,130,246,.08); }
        .topic-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
        }
        .topic-row:last-child { border-bottom: none; }
        .topic-row__title {
          flex: 1;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          text-decoration: none;
        }
        .topic-row__title:hover { color: var(--accent); }
        .topic-row__cat {
          font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
          padding: 2px 7px; border: 1px solid var(--border); color: var(--text-muted);
          flex-shrink: 0;
        }
        .topic-row__date { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
        .rp-section { padding: 16px; border-bottom: 1px solid var(--border); }
        .rp-head {
          font-family: var(--f-display); font-size: 14px; text-transform: uppercase;
          letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 12px;
          display: flex; align-items: center; gap: 8px;
        }
        .rp-head::before { content: ''; width: 3px; height: 14px; background: var(--accent); display: block; }
        .rp-stat-row {
          display: flex; justify-content: space-between;
          padding: 6px 0; border-bottom: 1px solid var(--border);
          font-size: 12px;
        }
        .rp-stat-row:last-child { border-bottom: none; }
        .rp-stat-label { color: var(--text-muted); }
        .rp-stat-val { font-weight: 700; color: var(--text); font-family: var(--f-display); font-size: 15px; }
        .logout-btn {
          padding: 8px 20px; border: 1px solid var(--border);
          background: none; color: var(--text-muted);
          font-family: var(--f-display); font-size: 14px; letter-spacing: .04em;
          cursor: pointer; transition: all .15s; margin-top: 16px;
        }
        .logout-btn:hover { border-color: var(--heat); color: var(--heat); }
        .coin-toast {
          position: fixed; bottom: 2rem; right: 1.5rem; z-index: 300;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: #fff; font-weight: 700; font-size: .88rem;
          padding: .5rem 1rem; box-shadow: 0 4px 16px rgba(230,0,0,.4);
          pointer-events: none;
        }
      `}</style>

      <Header searchPlaceholder="Search players, teams..." />
      <SideNav activePath="/profile" />

      {/* Left panel */}
      <aside className="panel-matches">
        <div className="panel-header"><h3>MY STATS</h3></div>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Loading…</div>
        ) : (
          <div>
            {[
              ['Bets Total', betStats.total || 0],
              ['Bets Won', betStats.won || 0],
              ['Win Rate', `${winRate}%`],
              ['Topics', forumStats.topics || 0],
              ['Replies', forumStats.replies || 0],
              ['Players Rated', ratings.players || 0],
            ].map(([label, val]) => (
              <div key={label} className="rp-stat-row" style={{ padding: '6px 16px' }}>
                <span className="rp-stat-label">{label}</span>
                <span className="rp-stat-val">{val}</span>
              </div>
            ))}
          </div>
        )}

        <div className="panel-header" style={{ marginTop: 8 }}><h3>SCORE COIN</h3></div>
        <div className="coin-widget">
          <div className="coin-widget__dots"></div>
          <div className="coin-widget__amount">
            <span className="coin-widget__symbol">SC</span>
            <span className="coin-widget__num">{coins !== null ? coins.toLocaleString() : '—'}</span>
          </div>
          <div className="coin-widget__sub">Your balance</div>
        </div>
        <Link to="/shop" className="btn btn--primary" style={{ display: 'block', textAlign: 'center', marginTop: 10, textDecoration: 'none', fontFamily: 'var(--f-display)', fontSize: 14, letterSpacing: '.04em' }}>
          Visit Shop →
        </Link>
      </aside>

      {/* Main stage */}
      <main className="main-stage">
        {loading ? (
          <div className="loading"><div className="loading__spinner" /><br />Loading profile…</div>
        ) : !user ? (
          <div className="loading">Failed to load profile.</div>
        ) : (
          <>
            {/* Profile Hero */}
            <div className="profile-hero">
              <div className="profile-avatar">{initials}</div>
              <div className="profile-hero__info">
                <div className="profile-hero__name">{user.username}</div>
                <div className="profile-hero__joined">
                  Member since {joinDate} · {user.email || ''}
                </div>
              </div>
              <div className="profile-hero__coins">
                <span className="profile-hero__coins-label">Score Coin</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span className="profile-hero__coins-sym">SC</span>
                  <span className="profile-hero__coins-num">{(user.coins || 0).toLocaleString()}</span>
                </div>
                <Link to="/shop" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginTop: 4, textDecoration: 'none' }}>
                  Visit Shop →
                </Link>
              </div>
            </div>

            {/* Stat cards */}
            <div className="stat-row">
              <div className="stat-card">
                <div className="stat-card__label">Bets Won</div>
                <div className="stat-card__value green">{betStats.won || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Win Rate</div>
                <div className="stat-card__value accent">{winRate}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Coins Earned</div>
                <div className="stat-card__value">{(betStats.earned || 0).toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Players Rated</div>
                <div className="stat-card__value blue">{ratings.players || 0}</div>
              </div>
            </div>

            {/* Bio */}
            <div className="bio-section">
              <div className="section-head">About Me</div>
              <div className="bio-text">{bio || 'No bio yet.'}</div>
              <div className="bio-edit-row">
                <textarea
                  maxLength={160}
                  placeholder="Write something about yourself…"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                />
                <button className="bio-save-btn" onClick={handleSaveBio} disabled={bioSaving}>
                  {bioSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {/* Bet History */}
            <div style={{ marginBottom: 24 }}>
              <div className="section-head">Bet History</div>
              <div className="bet-table-wrap">
                <table className="bet-table">
                  <thead>
                    <tr>
                      <th>Game</th>
                      <th>Pick</th>
                      <th>Amount</th>
                      <th>Result</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bets.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                          No bets yet.
                        </td>
                      </tr>
                    ) : bets.slice(0, 20).map(b => {
                      const date = new Date(b.placed_at || Date.now()).toLocaleDateString();
                      let statusClass = 'bet-status--pending', statusLabel = 'Pending';
                      if (b.settled && b.won)       { statusClass = 'bet-status--won';  statusLabel = 'Won'; }
                      else if (b.settled && !b.won) { statusClass = 'bet-status--lost'; statusLabel = 'Lost'; }
                      return (
                        <tr key={b.id || b.game_id}>
                          <td>{b.away_abbr || '?'} vs {b.home_abbr || '?'}</td>
                          <td><strong>{b.pick || '—'}</strong></td>
                          <td>{b.amount} SC</td>
                          <td><span className={`bet-status ${statusClass}`}>{statusLabel}</span></td>
                          <td>{date}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Forum Topics */}
            <div style={{ marginBottom: 24 }}>
              <div className="section-head">My Topics</div>
              {topics.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '.85rem', padding: '.5rem 0' }}>No topics yet.</div>
              ) : topics.map(t => (
                <div key={t.id} className="topic-row">
                  <Link to={`/forum`} className="topic-row__title">{t.title}</Link>
                  <span className="topic-row__cat">{t.category || 'General'}</span>
                  <span className="topic-row__date">{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>

            {/* Logout */}
            <button className="logout-btn" onClick={handleLogout}>Sign Out</button>

            <footer style={{ marginTop: '2rem', padding: '1rem 0', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '.72rem', fontFamily: 'var(--f-display)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Game Pulse · Powered by ESPN · Data for reference only
            </footer>
          </>
        )}
      </main>

      {/* Right panel */}
      <aside className="panel-social">
        <div className="rp-section">
          <div className="rp-head">Bet Stats</div>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            [
              ['Total', betStats.total || 0],
              ['Won', betStats.won || 0],
              ['Lost', betStats.lost || 0],
              ['Pending', betStats.pending || 0],
              ['Wagered', `${(betStats.wagered || 0).toLocaleString()} SC`],
              ['Earned', `${(betStats.earned || 0).toLocaleString()} SC`],
            ].map(([l, v]) => (
              <div key={l} className="rp-stat-row">
                <span className="rp-stat-label">{l}</span>
                <span className="rp-stat-val">{v}</span>
              </div>
            ))
          )}
        </div>

        <div className="rp-section">
          <div className="rp-head">Ratings</div>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            [
              ['Games Rated', ratings.games || 0],
              ['Players Rated', ratings.players || 0],
              ['Refs Rated', ratings.refs || 0],
            ].map(([l, v]) => (
              <div key={l} className="rp-stat-row">
                <span className="rp-stat-label">{l}</span>
                <span className="rp-stat-val">{v}</span>
              </div>
            ))
          )}
        </div>

        <div className="rp-section">
          <div className="rp-head">Forum</div>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            [
              ['Topics', forumStats.topics || 0],
              ['Replies', forumStats.replies || 0],
            ].map(([l, v]) => (
              <div key={l} className="rp-stat-row">
                <span className="rp-stat-label">{l}</span>
                <span className="rp-stat-val">{v}</span>
              </div>
            ))
          )}
        </div>
      </aside>

      {toast && <div className="coin-toast">{toast}</div>}
    </div>
  );
}
