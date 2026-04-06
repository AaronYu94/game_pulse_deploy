import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiLogin, apiRegister } from '../lib/api.js';

// OAuth button styles per provider
const OAUTH_PROVIDERS = [
  {
    key: 'google',
    label: 'Continue with Google',
    bg: '#fff',
    color: '#1f1f1f',
    border: '#dadce0',
    icon: (
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
    ),
  },
  {
    key: 'facebook',
    label: 'Continue with Facebook',
    bg: '#1877F2',
    color: '#fff',
    border: '#1877F2',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
      </svg>
    ),
  },
  {
    key: 'twitter',
    label: 'Continue with X',
    bg: '#000',
    color: '#fff',
    border: '#000',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
      </svg>
    ),
  },
  {
    key: 'discord',
    label: 'Continue with Discord',
    bg: '#5865F2',
    color: '#fff',
    border: '#5865F2',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
  },
];

// Which providers actually have credentials configured — checked at runtime via a 404 from the backend.
// We show all three buttons and let the backend return an error if not configured.

function OAuthButton({ provider }) {
  const base = import.meta.env.VITE_API_URL || '';
  return (
    <a
      href={`${base}/api/auth/${provider.key}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem',
        width: '100%', padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)',
        background: provider.bg, color: provider.color,
        border: `1px solid ${provider.border}`,
        fontSize: '0.88rem', fontWeight: 600, textDecoration: 'none',
        transition: 'opacity .15s', cursor: 'pointer', boxSizing: 'border-box',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {provider.icon}
      {provider.label}
    </a>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [oauthError, setOauthError] = useState('');

  // Handle redirect back from OAuth provider
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userParam = params.get('user');
    const error = params.get('error');

    if (error) {
      setOauthError(decodeURIComponent(error));
      window.history.replaceState({}, '', '/login');
      return;
    }
    if (token && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam));
        login(token, user);
        navigate('/');
      } catch {
        setOauthError('Login failed, please try again.');
        window.history.replaceState({}, '', '/login');
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail || !loginPassword) { setLoginError('Please fill in all fields.'); return; }
    setLoginLoading(true);
    try {
      const data = await apiLogin(loginEmail, loginPassword);
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setRegError('');
    if (!regUsername || !regEmail || !regPassword) { setRegError('Please fill in all fields.'); return; }
    setRegLoading(true);
    try {
      const data = await apiRegister(regUsername, regEmail, regPassword);
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '2.5rem 2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <img src="/logo.png" alt="SCORE" style={{ height: 72, width: 72, objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.2rem', letterSpacing: '0.12em', color: 'var(--accent)', textShadow: '0 0 30px rgba(255,107,43,.35)', lineHeight: 1 }}>
            SCORE <span style={{ color: 'var(--text-muted)', fontSize: '1rem', fontFamily: 'inherit', fontWeight: 500 }}>· NBA</span>
          </div>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Sign in to rate games, place predictions, and earn Score Coins.
        </div>

        {oauthError && (
          <div style={{ background: 'var(--heat-bg)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 'var(--radius-md)', color: 'var(--heat)', fontSize: '0.85rem', padding: '0.65rem 0.9rem', marginBottom: '1rem' }}>
            {oauthError}
          </div>
        )}

        {/* Social login */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1.5rem' }}>
          {OAUTH_PROVIDERS.map(p => <OAuthButton key={p.key} provider={p} />)}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>or sign in with email</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.75rem' }}>
          {['login', 'register'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '0.6rem', background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)', marginBottom: -1,
              transition: 'color .15s, border-color .15s',
            }}>
              {t === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            {loginError && (
              <div style={{ background: 'var(--heat-bg)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 'var(--radius-md)', color: 'var(--heat)', fontSize: '0.85rem', padding: '0.65rem 0.9rem', marginBottom: '1rem' }}>
                {loginError}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="you@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <button type="submit" className="btn btn--primary" style={{ width: '100%', marginTop: '0.25rem' }} disabled={loginLoading}>
              {loginLoading ? 'Logging in…' : 'Login'}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            {regError && (
              <div style={{ background: 'var(--heat-bg)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 'var(--radius-md)', color: 'var(--heat)', fontSize: '0.85rem', padding: '0.65rem 0.9rem', marginBottom: '1rem' }}>
                {regError}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" className="form-input" placeholder="e.g. BallIsLife" maxLength={30} value={regUsername} onChange={e => setRegUsername(e.target.value)} autoComplete="username" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="you@example.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="form-group">
              <label className="form-label">Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(min. 6 chars)</span></label>
              <input type="password" className="form-input" placeholder="••••••••" value={regPassword} onChange={e => setRegPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn btn--primary" style={{ width: '100%', marginTop: '0.25rem' }} disabled={regLoading}>
              {regLoading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '1.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          You start with <strong style={{ color: 'var(--accent-2)' }}>200 Score Coins</strong> — predict games & earn more.
        </div>
      </div>
    </div>
  );
}
