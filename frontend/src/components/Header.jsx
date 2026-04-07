import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

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
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
