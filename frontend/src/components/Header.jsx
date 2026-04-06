import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Header({ subtitle = 'NBA' }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <header className="site-header">
      <Link to="/" className="logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <img src="/logo.png" alt="SCORE" style={{ height: 72, width: 72, objectFit: 'contain', flexShrink: 0 }} />
        SCORE<span className="logo__sub">&nbsp;·&nbsp;{subtitle}</span>
      </Link>
      <nav className="site-nav">
        <Link to="/"      className={pathname === '/'      ? 'active' : ''}>Games</Link>
        <Link to="/forum" className={pathname === '/forum' ? 'active' : ''}>Forum</Link>
        <Link to="/shop"  className={pathname === '/shop'  ? 'active' : ''}>Shop</Link>
        {user && (
          <div className="header-user" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginLeft: '.5rem' }}>
            <Link
              to="/profile"
              style={{ fontSize: '.78rem', color: 'var(--text-sub)', fontWeight: 600, textDecoration: 'none' }}
              className={pathname === '/profile' ? 'active' : ''}
            >
              {user.username}
            </Link>
            <button
              onClick={logout}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '.2rem .65rem', fontSize: '.72rem', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Logout
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
