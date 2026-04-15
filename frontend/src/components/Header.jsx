import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiGetNotifications, apiMarkAllRead, apiMarkRead } from '../lib/api.js';

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

function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await apiGetNotifications();
      setNotifications(data.notifications || []);
      setUnread(data.unread || 0);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  async function handleMarkAll() {
    await apiMarkAllRead().catch(() => {});
    setNotifications(n => n.map(x => ({ ...x, read: true })));
    setUnread(0);
  }

  async function handleClick(notif) {
    if (!notif.read) {
      await apiMarkRead(notif.id).catch(() => {});
      setNotifications(n => n.map(x => x.id === notif.id ? { ...x, read: true } : x));
      setUnread(u => Math.max(0, u - 1));
    }
    setOpen(false);
    if (notif.link) navigate(notif.link);
  }

  return (
    <div className="notif-bell-wrap" ref={dropdownRef}>
      <button className="notif-bell" onClick={() => setOpen(v => !v)} aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown__header">
            <span className="notif-dropdown__title">Notifications</span>
            {unread > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAll}>Mark all read</button>
            )}
          </div>
          <div className="notif-dropdown__list">
            {notifications.length === 0 ? (
              <div className="notif-empty">No notifications yet</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`notif-item${n.read ? '' : ' notif-item--unread'}`}
                  onClick={() => handleClick(n)}
                >
                  {!n.read && <div className="notif-dot" />}
                  <div className="notif-item__content">
                    <div className="notif-item__title">{n.title}</div>
                    {n.body && <div className="notif-item__body">{n.body}</div>}
                    <div className="notif-item__time">{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const [isLight, setIsLight] = useState(() => {
    return localStorage.getItem('gp_theme') === 'light';
  });

  useEffect(() => {
    document.body.classList.toggle('theme-light', isLight);
  }, [isLight]);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    localStorage.setItem('gp_theme', next ? 'light' : 'dark');
  }

  return (
    <button
      onClick={toggle}
      className="theme-toggle-btn"
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      aria-label="Toggle theme"
    >
      {isLight ? (
        // Moon icon for dark mode
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      ) : (
        // Sun icon for light mode
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      )}
    </button>
  );
}

export default function Header({ searchPlaceholder = 'Search players, teams...' }) {
  const { user, logout } = useAuth();
  const { pathname, search } = useLocation();
  const loginHref = `/login?redirect=${encodeURIComponent(`${pathname}${search}`)}`;

  return (
    <header className="top-bar">
      <Link to="/" className="brand" style={{ textDecoration: 'none' }}>
        <div className="logo-mark">S</div>
        <span className="brand-name">GAME <span className="accent-text">PULSE</span></span>
      </Link>

      <div className="search-bar">
        <input type="text" placeholder={searchPlaceholder} readOnly />
      </div>

      <div className="header-right">
        <ThemeToggle />
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <NotificationBell />
            <Link
              to="/profile"
              className="header-notif-text"
              style={{ textDecoration: 'none' }}
            >
              {user.username}
            </Link>
            <button
              onClick={logout}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                padding: '4px 12px',
                cursor: 'pointer',
                fontFamily: 'var(--f-display)',
                fontSize: '12px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <Link to={loginHref} className="header-notif-text" style={{ textDecoration: 'none' }}>Login</Link>
        )}
        <div className="header-avatar"></div>
      </div>
    </header>
  );
}

/* Side navigation component */
export function SideNav({ activePath }) {
  const { pathname } = useLocation();
  const active = activePath || pathname;

  return (
    <nav className="side-nav">
      <Link to="/" className={`nav-item${active === '/' ? ' active' : ''}`} title="Games">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </Link>
      <Link to="/forum" className={`nav-item${active === '/forum' ? ' active' : ''}`} title="Forum">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </Link>
      <Link to="/news" className={`nav-item${active === '/news' ? ' active' : ''}`} title="News">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
          <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>
        </svg>
      </Link>
      <div className="nav-item-divider"></div>
      <Link to="/profile" className={`nav-item${active === '/profile' ? ' active' : ''}`} title="Profile">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </Link>
      <Link to="/shop" className={`nav-item${active === '/shop' ? ' active' : ''}`} title="Shop">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
      </Link>
    </nav>
  );
}
