import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header.jsx';
import { apiGetTopics, apiCreateTopic, apiGetTopic, apiPostReply, apiLikeReply } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

// ── constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all',       label: 'All'       },
  { key: 'general',   label: 'General'   },
  { key: 'hot-takes', label: 'Hot Takes' },
  { key: 'analysis',  label: 'Analysis'  },
  { key: 'trades',    label: 'Trade Talk'},
  { key: 'fantasy',   label: 'Fantasy'   },
];

const SORTS = [
  { key: 'latest', label: 'Latest' },
  { key: 'hot',    label: 'Most Active' },
  { key: 'new',    label: 'Newest' },
  { key: 'views',  label: 'Most Viewed' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

// ── helpers ────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (d < 60)          return 'just now';
  if (d < 3600)        return `${Math.floor(d / 60)}m ago`;
  if (d < 86400)       return `${Math.floor(d / 3600)}h ago`;
  if (d < 86400 * 7)   return `${Math.floor(d / 86400)}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtViews(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const AVATAR_COLORS = [
  '#e05c2e','#e0922e','#c4b02a','#3a9e5f','#2e8fc4',
  '#5c6bc0','#8e44ad','#c0392b','#16a085','#2980b9',
];
function avatarColor(username = '') {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Avatar({ username, size = 36 }) {
  const initial = (username || '?')[0].toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatarColor(username),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bebas Neue', sans-serif", fontSize: size * 0.44,
      color: '#fff', flexShrink: 0, userSelect: 'none',
    }}>
      {initial}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
      <div style={{ display: 'inline-block', width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite', marginBottom: '0.75rem' }} />
      <br />Loading…
    </div>
  );
}

function CategoryBadge({ catKey, small }) {
  const cat = CAT_MAP[catKey] || CAT_MAP['general'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      fontSize: small ? '0.6rem' : '0.65rem', fontWeight: 700,
      padding: small ? '0.08rem 0.35rem' : '0.12rem 0.45rem',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      color: 'var(--text-sub)', whiteSpace: 'nowrap', letterSpacing: '0.02em',
    }}>
      {cat.label}
    </span>
  );
}

// ── Topic list ─────────────────────────────────────────────────────────────

function TopicList({ cat, sort, q, onSelect }) {
  const [topics,     setTopics]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showNew,    setShowNew]    = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGetTopics({ cat, sort, q })
      .then(t  => { if (!cancelled) { setTopics(t); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cat, sort, q, reloadTick]);

  function onCreated(id) {
    setShowNew(false);
    setReloadTick(n => n + 1);
    onSelect(id);
  }

  return (
    <div>
      {/* Column headers */}
      {!loading && topics.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 56px 56px', gap: '0 0.75rem', padding: '0 1rem 0.5rem', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: '0.25rem' }}>
          <span>Topic</span>
          <span style={{ textAlign: 'center' }}>Views</span>
          <span style={{ textAlign: 'center' }}>Replies</span>
          <span style={{ textAlign: 'center' }}>Activity</span>
        </div>
      )}

      {loading ? <Spinner /> : topics.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {q ? `No topics matching "${q}"` : 'No topics yet — start the conversation!'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {topics.map(t => {
            const isHot  = (t.reply_count ?? 0) >= 8;
            const isNew  = (Date.now() - new Date(t.created_at).getTime()) < 1000 * 60 * 60 * 6;
            const preview = (t.body || '').replace(/\s+/g, ' ').slice(0, 90) + (t.body?.length > 90 ? '…' : '');
            return (
              <div
                key={t.id}
                onClick={() => onSelect(t.id)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 56px 56px 56px', gap: '0 0.75rem',
                  padding: '0.85rem 1rem', alignItems: 'center', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: 'transparent', transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Left: avatar + title + meta */}
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', minWidth: 0 }}>
                  <Avatar username={t.author_name || t.username} size={38} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.18rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.3 }}>{t.title}</span>
                      {isHot && <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.08rem 0.4rem', borderRadius: 'var(--radius-pill)', background: 'rgba(255,107,43,.15)', color: 'var(--accent)', border: '1px solid rgba(255,107,43,.25)', whiteSpace: 'nowrap' }}>HOT</span>}
                      {isNew && <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.08rem 0.4rem', borderRadius: 'var(--radius-pill)', background: 'var(--blue-glow)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,.25)', whiteSpace: 'nowrap' }}>NEW</span>}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {preview}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <CategoryBadge catKey={t.category} small />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: 600 }}>{t.author_name || t.username}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.5 }}>·</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{timeAgo(t.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Views */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtViews(t.views)}</div>
                </div>

                {/* Replies */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.2rem', lineHeight: 1, color: (t.reply_count ?? 0) > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{t.reply_count ?? 0}</div>
                </div>

                {/* Activity */}
                <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {t.last_reply_at ? timeAgo(t.last_reply_at) : timeAgo(t.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New topic FAB */}
      {showNew && (
        <NewTopicModal onClose={() => setShowNew(false)} onCreated={onCreated} />
      )}
      <button
        onClick={() => setShowNew(true)}
        style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
          color: '#fff', border: 'none', borderRadius: '50px',
          padding: '0.75rem 1.4rem', fontFamily: "'Bebas Neue',sans-serif",
          fontSize: '1rem', letterSpacing: '0.08em', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(255,107,43,.4)', transition: 'transform .15s, box-shadow .15s',
          zIndex: 100,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(255,107,43,.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,107,43,.4)'; }}
      >
        + New Topic
      </button>
    </div>
  );
}

// ── New topic modal ─────────────────────────────────────────────────────────

function NewTopicModal({ onClose, onCreated }) {
  const [title,    setTitle]    = useState('');
  const [body,     setBody]     = useState('');
  const [category, setCategory] = useState('general');
  const [creating, setCreating] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setCreating(true);
    try {
      const res = await apiCreateTopic(title.trim(), body.trim(), category);
      onCreated(res.topic.id);
    } catch (_) {}
    setCreating(false);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={ref} className="card" style={{ width: '100%', maxWidth: 560, padding: '2rem', position: 'relative', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.4rem', letterSpacing: '0.06em' }}>Start a Discussion</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.25rem 0.5rem' }}>✕</button>
        </div>
        <form onSubmit={handleCreate}>
          {/* Category picker */}
          <div className="form-group">
            <label className="form-label">Category</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                <button
                  key={c.key} type="button"
                  onClick={() => setCategory(c.key)}
                  style={{
                    padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-pill)',
                    border: `1px solid ${category === c.key ? 'var(--accent)' : 'var(--border)'}`,
                    background: category === c.key ? 'var(--accent-glow)' : 'var(--bg-surface)',
                    color: category === c.key ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit',
                    transition: 'all .15s',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="What do you want to talk about?" maxLength={80} autoFocus />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem', textAlign: 'right' }}>{title.length}/80</div>
          </div>
          <div className="form-group">
            <label className="form-label">Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Share your thoughts in detail…" rows={6} style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.9rem', padding: '0.75rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, transition: 'border-color .15s' }} onFocus={e => e.target.style.borderColor = 'var(--accent)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={creating || !title.trim() || !body.trim()}>
              {creating ? 'Posting…' : 'Post Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Thread view ────────────────────────────────────────────────────────────

function PostCard({ post, index, isOP, onLike, onQuote }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '1.25rem 0', borderBottom: '1px solid var(--border)' }}>
      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: 64, flexShrink: 0 }}>
        <Avatar username={post.author_name || post.username} size={44} />
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-sub)', textAlign: 'center', wordBreak: 'break-word' }}>{post.author_name || post.username}</div>
        {isOP && (
          <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', background: 'var(--accent-glow)', border: '1px solid rgba(255,107,43,.25)', borderRadius: 'var(--radius-pill)', padding: '0.1rem 0.4rem', whiteSpace: 'nowrap' }}>OP</div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{timeAgo(post.created_at)}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--border-mid)', fontFamily: 'monospace' }}>#{index + 1}</span>
        </div>

        {/* Quoted content (persisted in DB) */}
        {post.quote_author && post.quote_text && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', padding: '0.6rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {post.quote_author} wrote:
            </div>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{post.quote_text}</div>
          </div>
        )}

        <div style={{ fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.7, marginBottom: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {post.content}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onQuote(post)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '0.25rem 0.65rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ↩ Quote
          </button>
          <button
            onClick={() => onLike(post.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: post.liked_by_me ? 'rgba(239,68,68,.1)' : 'none', border: `1px solid ${post.liked_by_me ? 'rgba(239,68,68,.3)' : 'var(--border)'}`, borderRadius: 'var(--radius-pill)', padding: '0.25rem 0.65rem', cursor: 'pointer', color: post.liked_by_me ? 'var(--heat)' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all .15s' }}
          >
            ♥ {post.likes ?? 0}
          </button>
        </div>
      </div>
    </div>
  );
}

function ThreadView({ topicId, onBack }) {
  const { user } = useAuth();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [content,    setContent]    = useState('');
  const [quote,      setQuote]      = useState(null); // { author, text }
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef();

  useEffect(() => {
    apiGetTopic(topicId)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [topicId]);

  function handleQuote(post) {
    const author  = post.author_name || post.username || '';
    const full    = post.content || '';
    const text    = full.length > 200 ? full.slice(0, 200) + '…' : full;
    setQuote({ author, text });
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  async function reply(e) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiPostReply(
        topicId,
        content.trim(),
        quote?.author || null,
        quote?.text   || null,
      );
      setData(prev => ({ ...prev, posts: [...(prev.posts || []), res.post] }));
      setContent('');
      setQuote(null);
    } catch (_) {}
    setSubmitting(false);
  }

  async function likePost(postId) {
    try {
      await apiLikeReply(postId);
      setData(prev => ({
        ...prev,
        posts: prev.posts.map(p => {
          if (p.id !== postId) return p;
          const wasLiked = !!p.liked_by_me;
          return { ...p, likes: wasLiked ? (p.likes ?? 0) - 1 : (p.likes ?? 0) + 1, liked_by_me: !wasLiked };
        }),
      }));
    } catch (_) {}
  }

  if (loading) return <Spinner />;

  const topic    = data?.topic;
  const posts    = data?.posts || [];
  const opUsername = topic?.author_name || topic?.username;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}>Forum</button>
        <span>/</span>
        {topic?.category && <CategoryBadge catKey={topic.category} small />}
        <span style={{ color: 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic?.title}</span>
      </div>

      {/* Topic title + stats bar */}
      {topic && (
        <div style={{ marginBottom: '0.5rem' }}>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(1.4rem,4vw,2.2rem)', letterSpacing: '0.06em', lineHeight: 1.2, marginBottom: '0.6rem' }}>{topic.title}</h1>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>by <strong style={{ color: 'var(--text-sub)' }}>{opUsername}</strong></span>
            <span>{timeAgo(topic.created_at)}</span>
            <span>{posts.length} repl{posts.length !== 1 ? 'ies' : 'y'}</span>
            <span>{fmtViews(topic.views)} views</span>
          </div>
        </div>
      )}

      {/* OP post */}
      {topic && (
        <div style={{ display: 'flex', gap: '1rem', padding: '1.25rem 0', borderBottom: '1px solid var(--border)', background: 'rgba(255,107,43,.03)', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: 64, flexShrink: 0 }}>
            <Avatar username={opUsername} size={44} />
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-sub)', textAlign: 'center', wordBreak: 'break-word' }}>{opUsername}</div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', background: 'var(--accent-glow)', border: '1px solid rgba(255,107,43,.25)', borderRadius: 'var(--radius-pill)', padding: '0.1rem 0.4rem' }}>OP</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{timeAgo(topic.created_at)}</span>
              <button
                onClick={() => handleQuote({ author_name: opUsername, content: topic.body })}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '0.2rem 0.55rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                ↩ Quote
              </button>
            </div>
            <div style={{ fontSize: '0.97rem', color: 'var(--text)', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{topic.body}</div>
          </div>
        </div>
      )}

      {/* Replies */}
      {posts.length === 0 ? (
        <div style={{ padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No replies yet — be the first.</div>
      ) : (
        posts.map((p, i) => (
          <PostCard key={p.id} post={p} index={i} isOP={(p.author_name || p.username) === opUsername} onLike={likePost} onQuote={handleQuote} />
        ))
      )}

      {/* Reply form */}
      <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <Avatar username={user?.username} size={44} />
          <form onSubmit={reply} style={{ flex: 1 }}>
            {/* Quote preview */}
            {quote && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', padding: '0.6rem 0.85rem', marginBottom: '0.6rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.2rem', textTransform: 'uppercase' }}>{quote.author} wrote:</div>
                  <div style={{ lineHeight: 1.5, wordBreak: 'break-word' }}>{quote.text}</div>
                </div>
                <button type="button" onClick={() => setQuote(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', padding: '0 0.25rem', flexShrink: 0 }}>✕</button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={quote ? `Replying to ${quote.author}…` : 'Write a reply…'}
              rows={4}
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.9rem', padding: '0.85rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, transition: 'border-color .15s' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{content.length > 0 ? `${content.length} chars` : ''}</span>
              <button type="submit" className="btn btn--primary" disabled={submitting || !content.trim()}>
                {submitting ? 'Posting…' : 'Post Reply'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ForumPage() {
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [activeCat,  setActiveCat]  = useState('all');
  const [activeSort, setActiveSort] = useState('latest');
  const [searchQ,    setSearchQ]    = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimer = useRef(null);

  function handleSearchInput(val) {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQ(val.trim()), 350);
  }

  return (
    <div className="page">
      <Header subtitle="Forum" />
      <div style={{ paddingTop: '1.5rem', maxWidth: 860, margin: '0 auto' }}>

        {selectedTopicId ? (
          <ThreadView
            topicId={selectedTopicId}
            onBack={() => setSelectedTopicId(null)}
          />
        ) : (
          <>
            {/* Page heading */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.35rem' }}>Fan Discussion</div>
              <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(2rem,5vw,3.2rem)', letterSpacing: '0.06em', lineHeight: 1, margin: 0 }}>
                Fan <span style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Forum</span>
              </h1>
            </div>

            {/* Controls row: search + sort */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search */}
              <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
                <svg style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => handleSearchInput(e.target.value)}
                  placeholder="Search topics…"
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.87rem', padding: '0.5rem 0.75rem 0.5rem 2.1rem', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                {searchInput && (
                  <button onClick={() => { setSearchInput(''); setSearchQ(''); }} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: '0.1rem 0.3rem' }}>✕</button>
                )}
              </div>

              {/* Sort */}
              <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                {SORTS.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setActiveSort(s.key)}
                    style={{
                      padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-pill)',
                      border: `1px solid ${activeSort === s.key ? 'var(--accent)' : 'var(--border)'}`,
                      background: activeSort === s.key ? 'var(--accent-glow)' : 'var(--bg-surface)',
                      color: activeSort === s.key ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit',
                      transition: 'all .15s', whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)', marginBottom: '0', overflowX: 'auto', paddingBottom: '0' }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setActiveCat(c.key)}
                  style={{
                    padding: '0.55rem 0.9rem', background: 'none', border: 'none',
                    borderBottom: activeCat === c.key ? '2px solid var(--accent)' : '2px solid transparent',
                    fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 700,
                    color: activeCat === c.key ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1,
                    transition: 'color .15s, border-color .15s',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <TopicList
              cat={activeCat}
              sort={activeSort}
              q={searchQ}
              onSelect={setSelectedTopicId}
            />
          </>
        )}
      </div>
      <footer className="site-footer">SCORE · NBA · Fan Forum</footer>
    </div>
  );
}
