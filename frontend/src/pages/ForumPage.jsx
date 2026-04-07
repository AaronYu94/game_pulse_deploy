import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Header, { SideNav } from '../components/Header.jsx';
import {
  apiGetTopics, apiCreateTopic, apiGetTopic, apiPostReply,
  apiLikeReply, apiDislikeReply,
} from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { getEquippedFrame, getFrameById } from '../lib/espn.js';

const CAT_TABS = [
  { key: 'all', label: 'All' },
  { key: 'totd', label: 'Topic of the Day' },
  { key: 'game', label: 'Games' },
  { key: 'player', label: 'Players' },
  { key: 'trade', label: 'Trade' },
  { key: 'chat', label: 'Chat' },
];

const CAT_LABELS = { game: 'Games', player: 'Players', trade: 'Trade', chat: 'Chat', totd: 'TOTD' };

const DAILY_TOPICS = [
  { q: "Who is the best point guard in the league right now?", sub: "Stats, impact, leadership — make your case." },
  { q: "Which team has the best shot at the championship this year?", sub: "Break down the matchups, rosters, and health." },
  { q: "Is load management ruining the NBA fan experience?", sub: "Stars sitting out big games — smart strategy or disrespect to fans?" },
  { q: "Prime MJ vs. prime LeBron, 1-on-1 — who wins?", sub: "The eternal debate. Pick your side and defend it." },
  { q: "Which young star will be the face of the NBA in 5 years?", sub: "Name your pick and tell us why." },
  { q: "Best NBA Finals of the last decade — which one?", sub: "Pick the series that had you glued to the screen." },
  { q: "Should the NBA expand, and if so, where?", sub: "New cities, new markets — make your case." },
  { q: "Who deserves a Hall of Fame spot but hasn't gotten one?", sub: "Overlooked legends — give them their flowers." },
  { q: "Which NBA team has the best fans?", sub: "Atmosphere, loyalty, passion — who tops the list?" },
  { q: "Best shooter in NBA history: Curry or someone else?", sub: "Redefining the three-point game — is it Steph?" },
  { q: "What's the most overhyped rivalry in NBA history?", sub: "More media narrative than real beef — which one?" },
  { q: "Biggest draft bust of all time — who takes the crown?", sub: "Expectations vs. reality. Who disappointed the most?" },
  { q: "Which coach has had the biggest impact on the modern NBA?", sub: "Systems, development, culture — who changed basketball?" },
  { q: "Clutch shot, down by 1, 5 seconds left — who do you want?", sub: "Kobe, LeBron, Curry, or someone else entirely?" },
  { q: "Which current team is the biggest disappointment this season?", sub: "Expected more — who has let you down the most?" },
];

function getTodayTopic() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return DAILY_TOPICS[dayOfYear % DAILY_TOPICS.length];
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

function CatBadge({ cat }) {
  const map = { game: 'cat-badge--game', player: 'cat-badge--player', trade: 'cat-badge--trade', chat: 'cat-badge--chat', totd: 'cat-badge--totd' };
  return <span className={`cat-badge ${map[cat] || ''}`}>{CAT_LABELS[cat] || cat}</span>;
}

function PostItem({ post, currentUser, onLike, onDislike }) {
  const author = post.author_name || 'Anonymous';
  const initials = author.slice(0, 2).toUpperCase();
  const equippedId = getEquippedFrame();
  const frame = (currentUser && currentUser.username === author && equippedId) ? getFrameById(equippedId) : null;

  return (
    <div
      className="post-item"
      style={frame ? { borderLeft: `3px solid ${frame.bg}`, background: `${frame.bg}14`, position: 'relative' } : { position: 'relative' }}
    >
      {frame && (
        <div style={{
          position: 'absolute', top: 8, right: 10, width: 22, height: 22, borderRadius: '50%',
          background: frame.bg, color: frame.text, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 8, fontWeight: 900, fontFamily: 'var(--f-display)',
        }}>{frame.abbr}</div>
      )}
      <div
        className="post-avatar"
        style={frame ? { background: frame.bg, color: frame.text } : {}}
      >{initials}</div>
      <div className="post-item__body">
        <div className="post-item__header">
          <span className="post-item__author" style={frame ? { color: frame.bg } : {}}>@{author}</span>
          <span className="dot">·</span>
          <span className="post-item__time">{timeAgo(post.created_at)}</span>
        </div>
        <div className="post-item__content" style={{ whiteSpace: 'pre-wrap' }}>{post.content}</div>
        <div className="post-item__actions">
          <button
            className={`vote-btn vote-btn--up${post.liked_by_me ? ' active' : ''}`}
            onClick={() => onLike(post.id)}
            title="Upvote"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            <span>{post.likes || 0}</span>
          </button>
          <button
            className={`vote-btn vote-btn--down${post.disliked_by_me ? ' active' : ''}`}
            onClick={() => onDislike(post.id)}
            title="Downvote"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ForumPage() {
  const location = useLocation();
  const { user, isLoggedIn } = useAuth();
  const loginHref = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  const [cat, setCat] = useState('all');
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [activeTopic, setActiveTopic] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCat, setNewCat] = useState('chat');
  const [submitting, setSubmitting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const todayTopic = getTodayTopic();

  const showToast = useCallback((msg) => {
    setToast(msg); setTimeout(() => setToast(''), 2200);
  }, []);

  const loadTopics = useCallback(async (category) => {
    setTopicsLoading(true);
    try {
      const list = await apiGetTopics({ cat: category });
      setTopics(list);
    } catch (err) { console.error(err); }
    finally { setTopicsLoading(false); }
  }, []);

  useEffect(() => { loadTopics(cat); }, [cat, loadTopics]);

  async function openTopic(topic) {
    setActiveTopic(topic);
    setThreadLoading(true);
    setPosts([]);
    try {
      const data = await apiGetTopic(topic.id);
      setPosts(data.posts || []);
    } catch (err) { console.error(err); }
    finally { setThreadLoading(false); }
  }

  async function handleCreateTopic(e) {
    e.preventDefault();
    if (!isLoggedIn) {
      showToast('Sign in to start a discussion.');
      return;
    }
    if (newTitle.length < 5 || newBody.length < 10) {
      showToast('Title needs 5+ chars, body needs 10+ chars'); return;
    }
    setSubmitting(true);
    try {
      await apiCreateTopic(newTitle, newBody, newCat);
      setNewTitle(''); setNewBody(''); setShowNewForm(false);
      showToast('Topic posted!');
      loadTopics(cat);
    } catch (err) { showToast(err.message); }
    finally { setSubmitting(false); }
  }

  async function handleReply(e) {
    e.preventDefault();
    if (!isLoggedIn) {
      showToast('Sign in to reply to this topic.');
      return;
    }
    if (!replyText.trim()) return;
    setReplySubmitting(true);
    try {
      const data = await apiPostReply(activeTopic.id, replyText);
      setPosts(p => [...p, data.post]);
      setReplyText('');
      // Refresh topic reply count
      setTopics(ts => ts.map(t => t.id === activeTopic.id ? { ...t, reply_count: (t.reply_count || 0) + 1 } : t));
    } catch (err) { showToast(err.message); }
    finally { setReplySubmitting(false); }
  }

  async function handleLike(postId) {
    if (!isLoggedIn) {
      showToast('Sign in to vote on replies.');
      return;
    }
    try {
      const res = await apiLikeReply(postId);
      setPosts(ps => ps.map(p => p.id === postId ? { ...p, likes: res.likes, liked_by_me: res.liked, disliked_by_me: false } : p));
    } catch (err) { showToast(err.message); }
  }

  async function handleDislike(postId) {
    if (!isLoggedIn) {
      showToast('Sign in to vote on replies.');
      return;
    }
    try {
      const res = await apiDislikeReply(postId);
      setPosts(ps => ps.map(p => p.id === postId ? { ...p, likes: res.likes, liked_by_me: false, disliked_by_me: res.disliked } : p));
    } catch (err) { showToast(err.message); }
  }

  return (
    <div className="app-container">
      <Header searchPlaceholder="Search forum topics..." />
      <SideNav />

      {/* Panel Matches: Topic List */}
      <aside className="panel-matches">
        <div className="panel-header">
          <h3>Fan Forum</h3>
          <div className="live-tag"><span>TOPICS</span></div>
        </div>
        {/* Category tabs */}
        <div className="cat-tabs" style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {CAT_TABS.map(t => (
            <button
              key={t.key}
              className={`cat-tab${cat === t.key ? ' active' : ''}`}
              style={{ padding: '10px 13px', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: cat === t.key ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', border: 'none', background: 'none', borderBottom: cat === t.key ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1, whiteSpace: 'nowrap', fontFamily: 'var(--f-display)' }}
              onClick={() => { setCat(t.key); setActiveTopic(null); }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div id="topicList" className="panel-games-scroll">
          {topicsLoading ? (
            <div className="loading" style={{ padding: 24 }}><div className="loading__spinner" /></div>
          ) : topics.length === 0 ? (
            <div className="empty">No topics yet.</div>
          ) : (
            topics.map(t => (
              <div
                key={t.id}
                className={`topic-card${activeTopic?.id === t.id ? ' active' : ''}`}
                onClick={() => openTopic(t)}
              >
                <div className="topic-card__top">
                  <CatBadge cat={t.category} />
                </div>
                <div className="topic-card__title">{t.title}</div>
                <div className="topic-card__preview">{t.body}</div>
                <div className="topic-card__meta">
                  <span>@{t.author_name || 'Anonymous'}</span>
                  <span className="dot">·</span>
                  <span>{timeAgo(t.created_at)}</span>
                  <span className="reply-badge">{t.reply_count || 0} replies</span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Stage */}
      <main className="main-stage">
        {/* New topic form toggle */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          {isLoggedIn ? (
            <button
              className="btn btn--primary"
              style={{ fontSize: 12, padding: '6px 14px', fontFamily: 'var(--f-display)', letterSpacing: '0.05em' }}
              onClick={() => setShowNewForm(v => !v)}
            >
              {showNewForm ? 'Cancel' : '+ New Topic'}
            </button>
          ) : (
            <Link
              to={loginHref}
              className="btn btn--primary"
              style={{ fontSize: 12, padding: '6px 14px', fontFamily: 'var(--f-display)', letterSpacing: '0.05em', textDecoration: 'none' }}
            >
              Sign In To Post
            </Link>
          )}
        </div>

        {showNewForm && isLoggedIn && (
          <div className="form-panel" style={{ marginBottom: '1.25rem' }}>
            <h2>Start a Discussion</h2>
            <form onSubmit={handleCreateTopic}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={newCat} onChange={e => setNewCat(e.target.value)} style={{ cursor: 'pointer', maxWidth: '100%' }}>
                  <option value="game">Games</option>
                  <option value="player">Players</option>
                  <option value="trade">Trade</option>
                  <option value="chat">Chat</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Title <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(min. 5 chars)</span></label>
                <input type="text" className="form-input" placeholder="What's on your mind?" maxLength={80} value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                <div className="char-counter" style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 3 }}>{newTitle.length} / 80</div>
              </div>
              <div className="form-group">
                <label className="form-label">Body <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(min. 10 chars)</span></label>
                <textarea className="form-textarea" placeholder="Share your thoughts…" value={newBody} onChange={e => setNewBody(e.target.value)} />
                <div className="char-counter" style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 3 }}>{newBody.length} chars</div>
              </div>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button type="submit" className="btn btn--primary" disabled={submitting}>{submitting ? 'Posting…' : 'Post Topic'}</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowNewForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {activeTopic ? (
          <>
            {/* Thread hero */}
            <div className="thread-hero" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.6rem', marginBottom: '1.25rem', position: 'relative', overflow: 'hidden' }}>
              <div className="thread-hero__title">{activeTopic.title}</div>
              <div className="thread-hero__meta">
                <CatBadge cat={activeTopic.category} />
                <span>·</span>
                <span>@{activeTopic.author_name || 'Anonymous'}</span>
                <span>·</span>
                <span>{timeAgo(activeTopic.created_at)}</span>
                <span>·</span>
                <span>{activeTopic.reply_count || 0} replies</span>
              </div>
              <div className="thread-hero__body" style={{ whiteSpace: 'pre-wrap' }}>{activeTopic.body}</div>
            </div>

            {/* Replies */}
            <div style={{ marginBottom: 16 }}>
              {threadLoading ? (
                <div className="loading"><div className="loading__spinner" /></div>
              ) : posts.length === 0 ? (
                <div className="empty">No replies yet. Be first!</div>
              ) : (
                posts.map(p => (
                  <PostItem
                    key={p.id}
                    post={p}
                    currentUser={user}
                    onLike={handleLike}
                    onDislike={handleDislike}
                  />
                ))
              )}
            </div>

            {/* Reply form */}
            <div className="form-panel form-panel--blue" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.4rem', position: 'relative', overflow: 'hidden' }}>
              {isLoggedIn ? (
                <>
                  <h3>Add Reply</h3>
                  <form onSubmit={handleReply}>
                    <div className="form-group">
                      <textarea
                        className="form-textarea"
                        placeholder="Share your thoughts…"
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <button type="submit" className="btn btn--primary" disabled={replySubmitting || !replyText.trim()}>
                      {replySubmitting ? 'Posting…' : 'Post Reply'}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <h3>Join The Conversation</h3>
                  <div style={{ color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 12 }}>
                    Sign in to reply, upvote strong takes, and start your own discussion threads.
                  </div>
                  <Link to={loginHref} className="btn btn--primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
                    Sign In To Reply
                  </Link>
                </>
              )}
            </div>
          </>
        ) : (
          /* Welcome + TOTD */
          <>
            {/* Topic of the Day */}
            <div className="totd-card" style={{ position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.8rem 1.6rem 1.4rem', marginBottom: '1.25rem', overflow: 'hidden' }}>
              <div className="totd-eyebrow">TOPIC OF THE DAY</div>
              <div className="totd-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div className="totd-question">{todayTopic.q}</div>
              <div className="totd-sub">{todayTopic.sub}</div>
              <div className="totd-stats">
                <div className="totd-stat"><strong>{topics.filter(t => t.category === 'totd').length || 0}</strong> TOTD posts today</div>
                <div className="totd-stat"><strong>{topics.length}</strong> total topics</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>💬</div>
              <div style={{ fontFamily: 'var(--f-display)', fontSize: 24, marginBottom: 8 }}>Fan Forum</div>
              <div style={{ fontSize: 14 }}>Select a topic from the left to read and reply</div>
            </div>
          </>
        )}

        <footer style={{ marginTop: '2rem', padding: '1rem 0', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '.72rem', fontFamily: 'var(--f-display)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Game Pulse · Data for reference only
        </footer>
      </main>

      {/* Panel Social */}
      <aside className="panel-social">
        <div className="rp-section">
          <div className="rp-head">Topic of the Day</div>
          <div
            className="totd-rp"
            style={{ background: 'linear-gradient(135deg, rgba(255,180,0,.06), rgba(230,0,0,.04))', border: '1px solid rgba(255,180,0,.2)', padding: 12, cursor: 'pointer' }}
            onClick={() => setActiveTopic(null)}
          >
            <div className="totd-rp__label">Today's Discussion</div>
            <div className="totd-rp__q">{todayTopic.q}</div>
            <div className="totd-rp__cta">Join Discussion →</div>
          </div>
        </div>
        <div className="rp-section">
          <div className="rp-head">Quick Links</div>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 12, color: 'var(--text-sub)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/></svg>
            Today's Games
          </Link>
          {!isLoggedIn && (
            <Link to={loginHref} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 12, color: 'var(--text-sub)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v7H3V3h7"/></svg>
              Sign In To Participate
            </Link>
          )}
        </div>
        <div className="rp-section">
          <div className="rp-head">Forum Rules</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>· Be respectful to all fans</div>
            <div>· No spam or self-promotion</div>
            <div>· Keep it basketball related</div>
            <div>· Have fun and enjoy!</div>
          </div>
        </div>
      </aside>

      {toast && <div className="coin-toast">{toast}</div>}
    </div>
  );
}
