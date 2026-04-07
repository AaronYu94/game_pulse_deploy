import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { SideNav } from '../components/Header.jsx';

/* ---- helpers ---- */
function relTime(utcSecs) {
  const diff = Math.floor(Date.now() / 1000) - utcSecs;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtNum(n) {
  if (!n) return '0';
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

function classifyPost(post) {
  const t = (post.title || '').toLowerCase();
  const f = (post.link_flair_text || '').toLowerCase();
  if (f.includes('highlight') || t.includes('highlight')) return { label: 'Highlight', cls: 'news-tag--highlight' };
  if (f.includes('breaking')  || t.includes('breaking'))  return { label: 'Breaking',  cls: 'news-tag--breaking' };
  if (f.includes('trade')     || t.includes('trade'))     return { label: 'Trade',      cls: 'news-tag--trade' };
  if (f.includes('game thread') || t.includes('game thread')) return { label: 'Game Thread', cls: 'news-tag--thread' };
  if (f.includes('injury')    || t.includes('injured') || t.includes('out tonight')) return { label: 'Injury', cls: 'news-tag--breaking' };
  return { label: f ? f.charAt(0).toUpperCase() + f.slice(1) : 'NBA', cls: 'news-tag--general' };
}

function mdToHtml(text) {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm,  '<h3>$1</h3>')
    .replace(/^#\s+(.+)$/gm,   '<h3>$1</h3>')
    .replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s])(https?:\/\/\S+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
    .split(/\n{2,}/)
    .map(p => p.trim() ? `<p>${p.replace(/\n/g, '<br>')}</p>` : '')
    .join('');
}

function getPostImage(post) {
  try {
    const imgs = post.preview?.images;
    if (imgs && imgs[0]) {
      const src = imgs[0].source?.url || '';
      if (src) return src.replace(/&amp;/g, '&');
    }
  } catch (e) {}
  const th = post.thumbnail || '';
  if (th.startsWith('http')) return th;
  return null;
}

const LS_LIKE_PREFIX = 'newslike_';
const LS_CMT_PREFIX  = 'newscomments_';

function getLikeData(postId) {
  try { return JSON.parse(localStorage.getItem(LS_LIKE_PREFIX + postId)) || { count: 0, mine: false }; }
  catch (e) { return { count: 0, mine: false }; }
}
function saveLikeData(postId, d) { localStorage.setItem(LS_LIKE_PREFIX + postId, JSON.stringify(d)); }

function getLocalComments(postId) {
  try { return JSON.parse(localStorage.getItem(LS_CMT_PREFIX + postId)) || []; }
  catch (e) { return []; }
}
function saveLocalComments(postId, arr) { localStorage.setItem(LS_CMT_PREFIX + postId, JSON.stringify(arr)); }

export default function NewsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const postId = searchParams.get('id') || '';
  const postPl = searchParams.get('pl') || '';

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likeData, setLikeData] = useState({ count: 0, mine: false });
  const [comments, setComments] = useState([]);
  const [cmtName, setCmtName] = useState('');
  const [cmtText, setCmtText] = useState('');
  const [cmtSubmitting, setCmtSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  useEffect(() => {
    if (!postId && !postPl) {
      setError('No article specified.');
      setLoading(false);
      return;
    }
    async function loadPost() {
      setLoading(true);
      try {
        // Try to fetch from Reddit API via CORS proxy or direct
        let url = '';
        if (postPl) {
          const pl = decodeURIComponent(postPl);
          url = `https://www.reddit.com${pl.endsWith('.json') ? pl : pl + '.json'}?raw_json=1&limit=1`;
        } else if (postId) {
          url = `https://www.reddit.com/r/nba/comments/${postId}.json?raw_json=1&limit=1`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch post');
        const data = await res.json();
        const postData = data[0]?.data?.children?.[0]?.data;
        if (!postData) throw new Error('Post not found');
        setPost(postData);
        setLikeData(getLikeData(postData.id || postId));
        setComments(getLocalComments(postData.id || postId));
      } catch (err) {
        setError(err.message || 'Failed to load article.');
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [postId, postPl]);

  function toggleLike() {
    if (!post) return;
    const id = post.id || postId;
    const current = getLikeData(id);
    const next = current.mine
      ? { count: Math.max(0, current.count - 1), mine: false }
      : { count: current.count + 1, mine: true };
    saveLikeData(id, next);
    setLikeData(next);
  }

  function handleSubmitComment(e) {
    e.preventDefault();
    if (!cmtName.trim() || !cmtText.trim()) {
      showToast('Please fill in both fields.');
      return;
    }
    setCmtSubmitting(true);
    const id = post?.id || postId;
    const existing = getLocalComments(id);
    const newComment = {
      id: Date.now(),
      author: cmtName.trim(),
      text: cmtText.trim(),
      created_utc: Math.floor(Date.now() / 1000),
      likes: 0,
      liked: false,
    };
    const updated = [newComment, ...existing];
    saveLocalComments(id, updated);
    setComments(updated);
    setCmtText('');
    showToast('Comment posted!');
    setCmtSubmitting(false);
  }

  function toggleCommentLike(commentId) {
    const id = post?.id || postId;
    const updated = comments.map(c => {
      if (c.id !== commentId) return c;
      return { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 };
    });
    saveLocalComments(id, updated);
    setComments(updated);
  }

  const tag = post ? classifyPost(post) : null;
  const img = post ? getPostImage(post) : null;
  const redditUrl = post ? `https://www.reddit.com${post.permalink}` : '';

  return (
    <>
      <style>{`
        body { overflow: auto; height: auto; }
        #root { height: auto; overflow: auto; }
        .news-page {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          padding-left: 56px;
        }
        .news-topbar {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(5,5,5,.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 0 24px;
          height: 52px;
          flex-shrink: 0;
        }
        .news-topbar__brand {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
        }
        .news-topbar .logo-mark {
          width: 28px; height: 28px;
          background: var(--accent);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--f-display);
          font-size: 16px;
          font-weight: 700;
          color: #fff;
        }
        .news-topbar .brand-name {
          font-family: var(--f-display);
          font-size: 17px;
          font-weight: 600;
          letter-spacing: .04em;
          color: var(--text);
          text-transform: uppercase;
        }
        .news-topbar .accent-text { color: var(--accent); }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: var(--text-muted);
          background: none;
          border: 1px solid var(--border);
          padding: 4px 12px;
          cursor: pointer;
          transition: all .15s;
          font-family: var(--f-body);
          text-decoration: none;
        }
        .back-btn:hover { border-color: var(--text-muted); color: var(--text); }
        .topbar-sep { width: 1px; height: 20px; background: var(--border); }
        .topbar-crumb {
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--f-body);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 320px;
        }
        .article-wrap {
          max-width: 740px;
          margin: 0 auto;
          padding: 32px 24px 80px;
          width: 100%;
        }
        .article-hero {
          position: relative;
          width: 100%;
          aspect-ratio: 16/7;
          background: var(--bg-card);
          border: 1px solid var(--border);
          overflow: hidden;
          margin-bottom: 24px;
        }
        .article-hero__img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .article-hero__placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--f-display);
          font-size: 80px;
          color: rgba(255,255,255,.04);
          background: linear-gradient(135deg, var(--bg-card) 0%, #101010 100%);
        }
        .article-hero__overlay {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 50%;
          background: linear-gradient(transparent, rgba(0,0,0,.7));
        }
        .news-tag {
          display: inline-block;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
          padding: 3px 8px;
          font-family: var(--f-body);
          margin-bottom: 10px;
        }
        .news-tag--breaking { background: var(--accent); color: #fff; }
        .news-tag--highlight { background: #f59e0b; color: #000; }
        .news-tag--trade { background: #6366f1; color: #fff; }
        .news-tag--thread { background: #10b981; color: #fff; }
        .news-tag--general { background: var(--bg-card); color: var(--text-muted); border: 1px solid var(--border); }
        .article-title {
          font-family: var(--f-display);
          font-size: 34px;
          font-weight: 600;
          line-height: 1.1;
          color: var(--text);
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        .article-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .article-meta__author { font-size: 12px; font-weight: 600; color: var(--text); font-family: var(--f-body); }
        .article-meta__dot { color: var(--border); font-size: 10px; }
        .article-meta__item { font-size: 11px; color: var(--text-muted); font-family: var(--f-body); }
        .article-meta__reddit {
          margin-left: auto;
          font-size: 10px; font-weight: 700; letter-spacing: .05em;
          color: var(--text-muted);
          text-decoration: none;
          border: 1px solid var(--border);
          padding: 3px 10px;
          font-family: var(--f-body);
          text-transform: uppercase;
          transition: all .15s;
        }
        .article-meta__reddit:hover { color: var(--accent); border-color: var(--accent); }
        .article-body {
          font-family: var(--f-body);
          font-size: 14px;
          line-height: 1.75;
          color: rgba(255,255,255,.82);
          margin-bottom: 28px;
        }
        .article-body p { margin-bottom: 14px; }
        .article-body p:last-child { margin-bottom: 0; }
        .article-body a { color: var(--accent); text-decoration: none; }
        .article-body a:hover { text-decoration: underline; }
        .article-body strong { color: #fff; font-weight: 700; }
        .article-body em { font-style: italic; opacity: .85; }
        .article-body blockquote { border-left: 3px solid var(--accent); padding-left: 14px; color: var(--text-muted); margin: 14px 0; font-style: italic; }
        .article-body h3 { font-family: var(--f-display); font-size: 20px; color: var(--text); text-transform: uppercase; margin: 20px 0 8px; }
        .article-body code { background: var(--bg-card); border: 1px solid var(--border); padding: 1px 5px; font-size: 12px; border-radius: 2px; }
        .link-card {
          display: flex; gap: 14px;
          background: var(--bg-card); border: 1px solid var(--border);
          padding: 14px; margin-bottom: 28px;
          cursor: pointer; transition: border-color .15s;
          text-decoration: none;
        }
        .link-card:hover { border-color: var(--accent); }
        .link-card__thumb { width: 80px; height: 60px; object-fit: cover; flex-shrink: 0; background: var(--bg-surface); }
        .link-card__info { flex: 1; min-width: 0; }
        .link-card__domain { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); font-family: var(--f-body); margin-bottom: 4px; }
        .link-card__title { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.4; font-family: var(--f-body); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .link-card__arrow { display: flex; align-items: center; color: var(--text-muted); flex-shrink: 0; }
        .article-actions {
          display: flex; align-items: center; gap: 10px;
          padding: 16px 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          margin-bottom: 32px;
        }
        .like-btn {
          display: flex; align-items: center; gap: 7px;
          background: var(--bg-card); border: 1px solid var(--border);
          color: var(--text-muted); padding: 7px 16px; cursor: pointer;
          font-family: var(--f-body); font-size: 12px; font-weight: 700;
          letter-spacing: .04em; text-transform: uppercase; transition: all .15s;
        }
        .like-btn:hover { border-color: var(--accent); color: var(--accent); }
        .like-btn.liked { background: rgba(230,0,0,.12); border-color: var(--accent); color: var(--accent); }
        .upvote-chip {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; color: var(--text-muted); font-family: var(--f-body);
          background: var(--bg-card); border: 1px solid var(--border); padding: 7px 14px;
        }
        .upvote-chip__num { color: var(--text); font-weight: 700; }
        .share-action-btn {
          display: flex; align-items: center; gap: 6px;
          background: none; border: 1px solid var(--border); color: var(--text-muted);
          padding: 7px 14px; cursor: pointer; font-family: var(--f-body);
          font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
          transition: all .15s; margin-left: auto;
        }
        .share-action-btn:hover { border-color: var(--text-muted); color: var(--text); }
        .comments-section {}
        .comments-title {
          font-family: var(--f-display); font-size: 18px; font-weight: 600;
          letter-spacing: .04em; text-transform: uppercase; color: var(--text);
          display: flex; align-items: center; gap: 10px; margin-bottom: 18px;
        }
        .comments-count { font-size: 11px; color: var(--text-muted); font-family: var(--f-body); font-weight: 500; background: var(--bg-card); border: 1px solid var(--border); padding: 2px 8px; }
        .comment-form { background: var(--bg-card); border: 1px solid var(--border); padding: 16px; margin-bottom: 24px; }
        .comment-form__row { display: flex; gap: 10px; margin-bottom: 10px; }
        .comment-form input,
        .comment-form textarea {
          background: var(--bg-surface); border: 1px solid var(--border);
          color: var(--text); font-family: var(--f-body); font-size: 13px;
          padding: 8px 12px; width: 100%; outline: none; resize: vertical;
          transition: border-color .15s;
        }
        .comment-form input { height: 36px; }
        .comment-form textarea { min-height: 80px; }
        .comment-form input:focus,
        .comment-form textarea:focus { border-color: var(--accent); }
        .comment-form input::placeholder,
        .comment-form textarea::placeholder { color: var(--text-muted); }
        .comment-form__submit {
          background: var(--accent); border: none; color: #fff;
          font-family: var(--f-display); font-size: 14px; font-weight: 600;
          letter-spacing: .06em; text-transform: uppercase; padding: 8px 22px;
          cursor: pointer; transition: opacity .15s;
        }
        .comment-form__submit:hover { opacity: .85; }
        .comment-form__submit:disabled { opacity: .4; cursor: not-allowed; }
        .comments-list { display: flex; flex-direction: column; gap: 0; }
        .comment-item { display: flex; gap: 12px; padding: 16px 0; border-bottom: 1px solid var(--border); }
        .comment-item:last-child { border-bottom: none; }
        .comment-item__avatar {
          width: 34px; height: 34px;
          background: var(--bg-card); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--f-display); font-size: 13px; color: var(--text-muted);
          flex-shrink: 0;
        }
        .comment-item__body { flex: 1; min-width: 0; }
        .comment-item__header { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .comment-item__author { font-size: 12px; font-weight: 700; color: var(--text); font-family: var(--f-body); }
        .comment-item__time { font-size: 10px; color: var(--text-muted); font-family: var(--f-body); }
        .comment-item__text { font-size: 13px; color: rgba(255,255,255,.8); line-height: 1.55; font-family: var(--f-body); margin-bottom: 8px; word-break: break-word; }
        .comment-item__actions { display: flex; gap: 8px; }
        .cmt-like-btn {
          display: flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 700; color: var(--text-muted);
          background: none; border: none; cursor: pointer; font-family: var(--f-body);
          padding: 0; transition: color .15s;
        }
        .cmt-like-btn:hover { color: var(--accent); }
        .cmt-like-btn.liked { color: var(--accent); }
        .skel-line {
          height: 12px;
          background: linear-gradient(90deg, var(--bg-surface) 25%, rgba(255,255,255,.05) 50%, var(--bg-surface) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 2px;
        }
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        .skel-hero { aspect-ratio: 16/7; background: var(--bg-card); margin-bottom: 24px; animation: shimmer 1.4s infinite; background-size: 200% 100%; background-image: linear-gradient(90deg, var(--bg-card) 25%, rgba(255,255,255,.04) 50%, var(--bg-card) 75%); }
        .skel-block { display: flex; flex-direction: column; gap: 10px; }
        .article-error { text-align: center; padding: 60px 24px; color: var(--text-muted); font-family: var(--f-body); }
        .article-error h2 { font-family: var(--f-display); font-size: 28px; color: var(--text); margin-bottom: 10px; }
        .coin-toast {
          position: fixed; bottom: 2rem; right: 1.5rem; z-index: 300;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: #fff; font-weight: 700; font-size: .88rem;
          padding: .5rem 1rem; box-shadow: 0 4px 16px rgba(230,0,0,.4);
          pointer-events: none;
        }
      `}</style>

      <SideNav activePath="/" />

      <div className="news-page">
        {/* Top bar */}
        <header className="news-topbar">
          <Link to="/" className="news-topbar__brand">
            <div className="logo-mark">S</div>
            <span className="brand-name">GAME <span className="accent-text">PULSE</span></span>
          </Link>
          <div className="topbar-sep" />
          <Link to="/" className="back-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            NBA News
          </Link>
          <div className="topbar-sep" />
          <span className="topbar-crumb">
            {loading ? 'Loading…' : post ? post.title : 'Article'}
          </span>
        </header>

        {/* Article */}
        <main className="article-wrap">
          {loading ? (
            <div>
              <div className="skel-hero" />
              <div className="skel-block">
                <div className="skel-line" style={{ width: '50px', height: '18px' }} />
                <div className="skel-line" style={{ width: '95%', height: '32px' }} />
                <div className="skel-line" style={{ width: '75%', height: '32px' }} />
                <div className="skel-line" style={{ width: '40%', height: '14px', marginTop: '4px' }} />
                <div className="skel-line" style={{ width: '100%', height: '14px', marginTop: '12px' }} />
                <div className="skel-line" style={{ width: '90%', height: '14px' }} />
                <div className="skel-line" style={{ width: '80%', height: '14px' }} />
              </div>
            </div>
          ) : error ? (
            <div className="article-error">
              <h2>Article Not Found</h2>
              <p>{error}</p>
              <Link to="/" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>← Back to Games</Link>
            </div>
          ) : post ? (
            <>
              {/* Hero image */}
              <div className="article-hero">
                {img ? (
                  <>
                    <img
                      className="article-hero__img"
                      src={img}
                      alt=""
                      onError={e => { e.currentTarget.parentElement.innerHTML = '<div class="article-hero__placeholder">NBA</div>'; }}
                    />
                    <div className="article-hero__overlay" />
                  </>
                ) : (
                  <div className="article-hero__placeholder">NBA</div>
                )}
              </div>

              {/* Tag + title */}
              <span className={`news-tag ${tag.cls}`}>{tag.label}</span>
              <h1 className="article-title">{post.title}</h1>

              {/* Meta */}
              <div className="article-meta">
                <span className="article-meta__author">u/{post.author || 'nba_fan'}</span>
                <span className="article-meta__dot">·</span>
                <span className="article-meta__item">{relTime(post.created_utc)}</span>
                <span className="article-meta__dot">·</span>
                <span className="article-meta__item">r/{post.subreddit || 'nba'}</span>
                {redditUrl && (
                  <a className="article-meta__reddit" href={redditUrl} target="_blank" rel="noopener noreferrer">
                    View on Reddit ↗
                  </a>
                )}
              </div>

              {/* Body */}
              {post.is_self && post.selftext?.trim() ? (
                <div
                  className="article-body"
                  dangerouslySetInnerHTML={{ __html: mdToHtml(post.selftext) }}
                />
              ) : !post.is_self ? (
                <a
                  className="link-card"
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {(post.thumbnail || '').startsWith('http') && (
                    <img
                      className="link-card__thumb"
                      src={post.thumbnail}
                      alt=""
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <div className="link-card__info">
                    <div className="link-card__domain">{post.domain || 'link'}</div>
                    <div className="link-card__title">{post.title}</div>
                  </div>
                  <div className="link-card__arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                </a>
              ) : null}

              {/* Actions */}
              <div className="article-actions">
                <button
                  className={`like-btn${likeData.mine ? ' liked' : ''}`}
                  onClick={toggleLike}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={likeData.mine ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  {likeData.count > 0 ? likeData.count : 'Like'}
                </button>

                <div className="upvote-chip">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                  <span className="upvote-chip__num">{fmtNum(post.score)}</span>
                  <span>upvotes</span>
                </div>

                <button
                  className="share-action-btn"
                  onClick={() => { navigator.clipboard?.writeText(window.location.href); showToast('Link copied!'); }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Share
                </button>
              </div>

              {/* Comments */}
              <div className="comments-section">
                <div className="comments-title">
                  Comments
                  <span className="comments-count">{comments.length}</span>
                </div>

                <form className="comment-form" onSubmit={handleSubmitComment}>
                  <div className="comment-form__row">
                    <input
                      type="text"
                      placeholder="Your name"
                      value={cmtName}
                      onChange={e => setCmtName(e.target.value)}
                      maxLength={30}
                    />
                  </div>
                  <textarea
                    placeholder="Share your thoughts…"
                    value={cmtText}
                    onChange={e => setCmtText(e.target.value)}
                    maxLength={500}
                    style={{ marginBottom: 10 }}
                  />
                  <button type="submit" className="comment-form__submit" disabled={cmtSubmitting}>
                    Post Comment
                  </button>
                </form>

                <div className="comments-list">
                  {comments.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>
                      No comments yet. Be the first!
                    </div>
                  ) : comments.map(c => (
                    <div key={c.id} className="comment-item">
                      <div className="comment-item__avatar">
                        {(c.author || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="comment-item__body">
                        <div className="comment-item__header">
                          <span className="comment-item__author">{c.author}</span>
                          <span className="comment-item__time">{relTime(c.created_utc)}</span>
                        </div>
                        <div className="comment-item__text">{c.text}</div>
                        <div className="comment-item__actions">
                          <button
                            className={`cmt-like-btn${c.liked ? ' liked' : ''}`}
                            onClick={() => toggleCommentLike(c.id)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill={c.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                            {c.likes || 0}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </main>
      </div>

      {toast && <div className="coin-toast">{toast}</div>}
    </>
  );
}
