import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiLogin, apiRegister } from '../lib/api.js';

export default function LoginPage() {
  const { isLoggedIn, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('login');

  // login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // register form
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      const redirect = searchParams.get('redirect') || '/';
      navigate(redirect, { replace: true });
    }
  }, [isLoggedIn, navigate, searchParams]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail || !loginPassword) { setLoginError('Please fill in all fields.'); return; }
    setLoginLoading(true);
    try {
      const data = await apiLogin(loginEmail, loginPassword);
      login(data.token, data.user);
      const redirect = searchParams.get('redirect') || '/';
      navigate(redirect, { replace: true });
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
      const redirect = searchParams.get('redirect') || '/';
      navigate(redirect, { replace: true });
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <>
      <style>{`
        .auth-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          overflow: auto;
        }
        .auth-card {
          width: 100%;
          max-width: 420px;
          padding: 2.5rem 2rem;
          position: relative;
          overflow: hidden;
          background: var(--bg-card);
          border: 1px solid var(--border);
        }
        .auth-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
        }
        .auth-logo {
          font-family: var(--f-display);
          font-size: 2.2rem;
          letter-spacing: 0.12em;
          color: var(--accent);
          margin-bottom: 0.25rem;
        }
        .auth-logo span { color: var(--text-muted); font-size: 1rem; font-weight: 500; }
        .auth-subtitle { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 2rem; }
        .auth-tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          margin-bottom: 1.75rem;
        }
        .auth-tab {
          flex: 1;
          padding: 0.6rem;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
          cursor: pointer;
          margin-bottom: -1px;
          transition: color .15s, border-color .15s;
        }
        .auth-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
        .auth-error {
          background: var(--heat-bg);
          border: 1px solid rgba(239,68,68,.25);
          color: var(--heat);
          font-size: 0.85rem;
          padding: 0.65rem 0.9rem;
          margin-bottom: 1rem;
        }
        .auth-footer {
          margin-top: 1.5rem;
          font-size: 0.78rem;
          color: var(--text-muted);
          text-align: center;
        }
        #root { height: auto; overflow: auto; }
      `}</style>
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">GAME <span>PULSE</span></div>
          <div className="auth-subtitle">Sign in to rate games, place predictions, and earn Score Coins.</div>

          <div className="auth-tabs">
            <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>Login</button>
            <button className={`auth-tab${tab === 'register' ? ' active' : ''}`} onClick={() => setTab('register')}>Register</button>
          </div>

          {tab === 'login' && (
            <form onSubmit={handleLogin}>
              {loginError && <div className="auth-error">{loginError}</div>}
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" placeholder="you@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" className="form-input" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <button type="submit" className="btn btn--primary" style={{ width: '100%', marginTop: '.25rem' }} disabled={loginLoading}>
                {loginLoading ? 'Logging in…' : 'Login'}
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister}>
              {regError && <div className="auth-error">{regError}</div>}
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
              <button type="submit" className="btn btn--primary" style={{ width: '100%', marginTop: '.25rem' }} disabled={regLoading}>
                {regLoading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}

          <div className="auth-footer">
            You start with <strong style={{ color: 'var(--accent-2)' }}>200 Score Coins</strong> — predict games &amp; earn more.
          </div>
        </div>
      </div>
    </>
  );
}
