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
  { key: 'totd', label: '🔥 TOTD' },
  { key: 'game', label: 'Games' },
  { key: 'player', label: 'Players' },
  { key: 'trade', label: 'Trade' },
  { key: 'chat', label: 'Chat' },
];

const CAT_LABELS = { game: 'GAMES', player: 'PLAYERS', trade: 'TRADE', chat: 'CHAT', totd: 'TOTD' };
const CAT_COLORS = {
  game:   { bg: 'rgba(230,0,0,.18)',    color: '#ff4444' },
  player: { bg: 'rgba(255,180,0,.18)',  color: '#ffb400' },
  trade:  { bg: 'rgba(0,140,255,.18)',  color: '#3b9eff' },
  chat:   { bg: 'rgba(100,200,100,.15)', color: '#6dc36d' },
  totd:   { bg: 'rgba(255,180,0,.22)',  color: '#ffb400' },
};

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
  const c = CAT_COLORS[cat] || { bg: 'rgba(255,255,255,.1)', color: 'var(--text-muted)' };
  return (
    <span className="forum-cat-badge" style={{ background: c.bg, color: c.color }}>
      {CAT_LABELS[cat] || cat}
    </span>
  );
}

function AuthorAvatar({ name, frame }) {
  const initials = (name || 'AN').slice(0, 2).toUpperCase();
  return (
    <div
      className="forum-avatar"
      style={frame ? { background: frame.bg, color: frame.text } : {}}
    >
      {initials}
    </div>
  );
}

function PostItem({ post, currentUser, onLike, onDislike, isOP }) {
  const author = post.author_name || 'Anonymous';
  const equippedId = getEquippedFrame();
  const frame = (currentUser?.username === author && equippedId) ? getFrameById(equippedId) : null;

  return (
    <div className={`forum-post${isOP ? ' forum-post--op' : ''}${post.liked_by_me ? ' forum-post--liked' : ''}`}
      style={frame ? { borderLeftColor: frame.bg } : {}}>
      <div className="forum-post__vote">
        <button
          className={`forum-vote-btn forum-vote-btn--up${post.liked_by_me ? ' active' : ''}`}
          onClick={() => onLike(post.id)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
        <span className="forum-vote-count">{post.likes || 0}</span>
        <button
          className={`forum-vote-btn forum-vote-btn--down${post.disliked_by_me ? ' active' : ''}`}
          onClick={() => onDislike(post.id)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      <div className="forum-post__main">
        <div className="forum-post__header">
          <AuthorAvatar name={author} frame={frame} />
          <span className="forum-post__author" style={frame ? { color: frame.bg } : {}}>
            @{author}
          </span>
          {isOP && <span className="forum-op-badge">OP</span>}
          {frame && (
            <span className="forum-frame-badge" style={{ background: frame.bg, color: frame.text }}>
              {frame.abbr}
            </span>
          )}
          <span className="forum-post__time">{timeAgo(post.created_at)}</span>
        </div>
        <div className="forum-post__content">{post.content}</div>
      </div>
    </div>
  );
}

function TopicCard({ topic, isActive, onClick }) {
  const c = CAT_COLORS[topic.category] || CAT_COLORS.chat;
  return (
    <div
      className={`forum-topic-card${isActive ? ' forum-topic-card--active' : ''}`}
      onClick={onClick}
      style={isActive ? { borderLeftColor: c.color } : {}}
    >
      <div className="forum-topic-card__top">
        <CatBadge cat={topic.category} />
        <span className="forum-topic-card__time">{timeAgo(topic.created_at)}</span>
      </div>
      <div className="forum-topic-card__title">{topic.title}</div>
      <div className="forum-topic-card__preview">{topic.body}</div>
      <div className="forum-topic-card__footer">
        <span className="forum-topic-card__author">@{topic.author_name || 'Anonymous'}</span>
        <span className="forum-topic-card__replies">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {topic.reply_count || 0}
        </span>
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
  const threadRef = useRef(null);

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
    setShowNewForm(false);
    try {
      const data = await apiGetTopic(topic.id);
      setPosts(data.posts || []);
    } catch (err) { console.error(err); }
    finally { setThreadLoading(false); }
    setTimeout(() => threadRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  async function handleCreateTopic(e) {
    e.preventDefault();
    if (!isLoggedIn) { showToast('Sign in to start a discussion.'); return; }
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
    if (!isLoggedIn) { showToast('Sign in to reply.'); return; }
    if (!replyText.trim()) return;
    setReplySubmitting(true);
    try {
      const data = await apiPostReply(activeTopic.id, replyText);
      setPosts(p => [...p, data.post]);
      setReplyText('');
      setTopics(ts => ts.map(t => t.id === activeTopic.id ? { ...t, reply_count: (t.reply_count || 0) + 1 } : t));
    } catch (err) { showToast(err.message); }
    finally { setReplySubmitting(false); }
  }

  async function handleLike(postId) {
    if (!isLoggedIn) { showToast('Sign in to vote.'); return; }
    try {
      const res = await apiLikeReply(postId);
      setPosts(ps => ps.map(p => p.id === postId ? { ...p, likes: res.likes, liked_by_me: res.liked, disliked_by_me: false } : p));
    } catch (err) { showToast(err.message); }
  }

  async function handleDislike(postId) {
    if (!isLoggedIn) { showToast('Sign in to vote.'); return; }
    try {
      const res = await apiDislikeReply(postId);
      setPosts(ps => ps.map(p => p.id === postId ? { ...p, likes: res.likes, liked_by_me: false, disliked_by_me: res.disliked } : p));
    } catch (err) { showToast(err.message); }
  }

  const hotTopics = topics.slice(0, 4);

  return (
    <div className="app-container app-container--forum">
      <Header searchPlaceholder="Search forum topics..." />
      <SideNav />

      {/* ── Left Panel: Topic List ── */}
      <aside className="panel-matches">
        {/* Header */}
        <div className="forum-panel-header">
          <div className="forum-panel-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            FAN FORUM
          </div>
          <span className="forum-topic-count">{topics.length} topics</span>
        </div>

        {/* Category Pills */}
        <div className="forum-cat-pills">
          {CAT_TABS.map(t => (
            <button
              key={t.key}
              className={`forum-cat-pill${cat === t.key ? ' active' : ''}`}
              onClick={() => { setCat(t.key); setActiveTopic(null); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Topic List */}
        <div className="panel-games-scroll">
          {topicsLoading ? (
            <div className="loading" style={{ padding: 32 }}><div className="loading__spinner" /></div>
          ) : topics.length === 0 ? (
            <div className="forum-empty-list">
              <div style={{ fontSize: 32, opacity: 0.3 }}>💬</div>
              <div>No topics yet.</div>
              {isLoggedIn && (
                <button className="forum-new-btn-sm" onClick={() => { setActiveTopic(null); setShowNewForm(true); }}>
                  Start one
                </button>
              )}
            </div>
          ) : (
            topics.map(t => (
              <TopicCard
                key={t.id}
                topic={t}
                isActive={activeTopic?.id === t.id}
                onClick={() => openTopic(t)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Main Stage ── */}
      <main className="main-stage" ref={threadRef}>

        {/* Action Bar */}
        <div className="forum-action-bar">
          {activeTopic && (
            <button className="forum-back-btn" onClick={() => { setActiveTopic(null); setShowNewForm(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              All Topics
            </button>
          )}
          <div style={{ flex: 1 }} />
          {isLoggedIn ? (
            <button
              className={`forum-new-btn${showNewForm ? ' forum-new-btn--cancel' : ''}`}
              onClick={() => { setShowNewForm(v => !v); setActiveTopic(null); }}
            >
              {showNewForm ? '✕ Cancel' : '+ New Topic'}
            </button>
          ) : (
            <Link to={loginHref} className="forum-new-btn" style={{ textDecoration: 'none' }}>
              Sign In To Post
            </Link>
          )}
        </div>

        {/* New Topic Form */}
        {showNewForm && isLoggedIn && (
          <div className="forum-form-card">
            <div className="forum-form-card__title">Start a Discussion</div>
            <form onSubmit={handleCreateTopic}>
              <div className="forum-form-row">
                <label className="forum-form-label">Category</label>
                <div className="forum-cat-select-row">
                  {[
                    { value: 'game', label: 'Games' },
                    { value: 'player', label: 'Players' },
                    { value: 'trade', label: 'Trade' },
                    { value: 'chat', label: 'Chat' },
                  ].map(opt => (
                    <button
                      type="button"
                      key={opt.value}
                      className={`forum-cat-pick${newCat === opt.value ? ' active' : ''}`}
                      style={newCat === opt.value ? { background: CAT_COLORS[opt.value]?.bg, color: CAT_COLORS[opt.value]?.color, borderColor: CAT_COLORS[opt.value]?.color } : {}}
                      onClick={() => setNewCat(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="forum-form-row">
                <label className="forum-form-label">
                  Title
                  <span className="forum-form-hint">{newTitle.length}/80</span>
                </label>
                <input
                  className="forum-form-input"
                  placeholder="What's on your mind?"
                  maxLength={80}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                />
              </div>
              <div className="forum-form-row">
                <label className="forum-form-label">
                  Body
                  <span className="forum-form-hint">{newBody.length} chars</span>
                </label>
                <textarea
                  className="forum-form-textarea"
                  placeholder="Share your thoughts in detail…"
                  value={newBody}
                  onChange={e => setNewBody(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="forum-form-actions">
                <button type="submit" className="forum-submit-btn" disabled={submitting}>
                  {submitting ? 'Posting…' : 'Post Topic'}
                </button>
                <button type="button" className="forum-cancel-btn" onClick={() => setShowNewForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTopic ? (
          /* ── Thread View ── */
          <div className="forum-thread">
            {/* Thread OP */}
            <div className="forum-thread-op">
              <div className="forum-thread-op__meta">
                <CatBadge cat={activeTopic.category} />
                <span className="forum-thread-op__author">@{activeTopic.author_name || 'Anonymous'}</span>
                <span className="forum-dot">·</span>
                <span className="forum-thread-op__time">{timeAgo(activeTopic.created_at)}</span>
                <span className="forum-dot">·</span>
                <span className="forum-thread-op__count">{activeTopic.reply_count || 0} replies</span>
              </div>
              <h2 className="forum-thread-op__title">{activeTopic.title}</h2>
              <div className="forum-thread-op__body">{activeTopic.body}</div>
            </div>

            {/* Replies */}
            <div className="forum-replies-header">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {posts.length} {posts.length === 1 ? 'REPLY' : 'REPLIES'}
            </div>

            {threadLoading ? (
              <div className="loading" style={{ padding: 32 }}><div className="loading__spinner" /></div>
            ) : posts.length === 0 ? (
              <div className="forum-no-replies">
                No replies yet — be the first to respond.
              </div>
            ) : (
              <div className="forum-posts-list">
                {posts.map((p, i) => (
                  <PostItem
                    key={p.id}
                    post={p}
                    currentUser={user}
                    onLike={handleLike}
                    onDislike={handleDislike}
                    isOP={i === 0}
                  />
                ))}
              </div>
            )}

            {/* Reply Box */}
            <div className="forum-reply-box">
              {isLoggedIn ? (
                <>
                  <div className="forum-reply-box__header">
                    <AuthorAvatar name={user?.username} />
                    <span className="forum-reply-box__name">@{user?.username}</span>
                  </div>
                  <form onSubmit={handleReply}>
                    <textarea
                      className="forum-reply-textarea"
                      placeholder="Write your reply…"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      rows={3}
                    />
                    <div className="forum-reply-actions">
                      <span className="forum-reply-hint">{replyText.length} chars</span>
                      <button
                        type="submit"
                        className="forum-submit-btn"
                        disabled={replySubmitting || !replyText.trim()}
                      >
                        {replySubmitting ? 'Posting…' : 'Post Reply'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="forum-reply-cta">
                  <div className="forum-reply-cta__text">
                    Join the conversation — sign in to reply and upvote.
                  </div>
                  <Link to={loginHref} className="forum-submit-btn" style={{ textDecoration: 'none' }}>
                    Sign In To Reply
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Empty / Home State ── */
          <div className="forum-home">
            {/* TOTD Banner */}
            <div className="forum-totd-banner">
              <div className="forum-totd-banner__eyebrow">
                <span className="forum-totd-fire">🔥</span>
                TOPIC OF THE DAY
              </div>
              <div className="forum-totd-banner__date">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className="forum-totd-banner__question">{todayTopic.q}</div>
              <div className="forum-totd-banner__sub">{todayTopic.sub}</div>
              <div className="forum-totd-banner__footer">
                <div className="forum-totd-stat">
                  <strong>{topics.filter(t => t.category === 'totd').length}</strong>
                  <span>TOTD posts</span>
                </div>
                <div className="forum-totd-stat">
                  <strong>{topics.length}</strong>
                  <span>total topics</span>
                </div>
                <button
                  className="forum-totd-join-btn"
                  onClick={() => { setNewCat('totd'); setShowNewForm(true); }}
                >
                  {isLoggedIn ? 'Add Your Take →' : 'View Discussion →'}
                </button>
              </div>
            </div>

            {/* Hot Topics Grid */}
            {hotTopics.length > 0 && (
              <div className="forum-hot-section">
                <div className="forum-section-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                    <polyline points="17 6 23 6 23 12"/>
                  </svg>
                  TRENDING
                </div>
                <div className="forum-hot-grid">
                  {hotTopics.map(t => (
                    <div key={t.id} className="forum-hot-card" onClick={() => openTopic(t)}>
                      <CatBadge cat={t.category} />
                      <div className="forum-hot-card__title">{t.title}</div>
                      <div className="forum-hot-card__meta">
                        <span>@{t.author_name || 'Anonymous'}</span>
                        <span className="forum-hot-card__replies">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                          {t.reply_count || 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hotTopics.length === 0 && !topicsLoading && (
              <div className="forum-welcome">
                <div className="forum-welcome__icon">💬</div>
                <div className="forum-welcome__title">Fan Forum</div>
                <div className="forum-welcome__sub">Select a topic from the left to read and reply</div>
                {isLoggedIn && (
                  <button className="forum-new-btn" style={{ marginTop: 16 }} onClick={() => setShowNewForm(true)}>
                    + Start a Discussion
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <footer className="forum-footer">
          Game Pulse · Fan Forum · Data for reference only
        </footer>
      </main>

      {/* ── Right Panel ── */}
      <aside className="panel-social">
        {/* TOTD Widget */}
        <div className="rp-section">
          <div className="rp-head">Topic of the Day</div>
          <div className="forum-totd-widget" onClick={() => setActiveTopic(null)}>
            <div className="forum-totd-widget__q">{todayTopic.q}</div>
            <div className="forum-totd-widget__cta">Join Discussion →</div>
          </div>
        </div>

        {/* Community Stats */}
        <div className="rp-section">
          <div className="rp-head">Community</div>
          <div className="forum-stats-grid">
            <div className="forum-stat-box">
              <div className="forum-stat-box__num">{topics.length}</div>
              <div className="forum-stat-box__label">Topics</div>
            </div>
            <div className="forum-stat-box">
              <div className="forum-stat-box__num">{topics.reduce((a, t) => a + (t.reply_count || 0), 0)}</div>
              <div className="forum-stat-box__label">Replies</div>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="rp-section">
          <div className="rp-head">Browse by Category</div>
          <div className="forum-cat-list">
            {CAT_TABS.filter(t => t.key !== 'all').map(t => {
              const count = topics.filter(tp => tp.category === t.key).length;
              const c = CAT_COLORS[t.key];
              return (
                <button
                  key={t.key}
                  className="forum-cat-list-item"
                  onClick={() => { setCat(t.key); setActiveTopic(null); }}
                  style={cat === t.key ? { borderLeftColor: c?.color, background: c?.bg } : {}}
                >
                  <span style={{ color: c?.color }}>{t.label}</span>
                  <span className="forum-cat-list-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rules */}
        <div className="rp-section">
          <div className="rp-head">Community Rules</div>
          <div className="forum-rules">
            {['Be respectful to all fans', 'No spam or self-promotion', 'Stay on topic', 'Have fun and enjoy!'].map((r, i) => (
              <div key={i} className="forum-rule">
                <span className="forum-rule__num">{i + 1}</span>
                {r}
              </div>
            ))}
          </div>
        </div>

        {/* Quick link */}
        <div className="rp-section">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 12, color: 'var(--text-sub)', textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
            </svg>
            Today's Games
          </Link>
        </div>
      </aside>

      {toast && <div className="coin-toast">{toast}</div>}
    </div>
  );
}
