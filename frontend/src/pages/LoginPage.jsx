import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiGetAuthProviders, apiLogin, apiRegister } from '../lib/api.js';

const DEFAULT_PROVIDERS = [
  { key: 'google', label: 'Google', enabled: false, url: null },
  { key: 'twitter', label: 'X', enabled: false, url: null },
  { key: 'discord', label: 'Discord', enabled: false, url: null },
  { key: 'facebook', label: 'Facebook', enabled: false, url: null },
];

function ProviderIcon({ providerKey }) {
  if (providerKey === 'google') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.8 4.8 0 0 1-2.1 3.2v2.5h3.3c1.9-1.8 3-4.3 3-7.5Z" />
        <path fill="#34A853" d="M12 22a9.8 9.8 0 0 0 6.6-2.4l-3.3-2.5c-.9.6-2 .9-3.3.9A6 6 0 0 1 6.3 14H3v2.6A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC04" d="M6 12c0-.7.1-1.3.3-2L3 7.4A10 10 0 0 0 2 12c0 1.6.4 3.2 1 4.6l3.3-2.5A6 6 0 0 1 6 12Z" />
        <path fill="#EA4335" d="M12 6a5.5 5.5 0 0 1 3.9 1.5l2.9-2.9A10 10 0 0 0 3 7.4L6.3 10A6 6 0 0 1 12 6Z" />
      </svg>
    );
  }

  if (providerKey === 'twitter') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M5 4h4.2l3 4.2L16 4h3l-5.3 6.6L19.5 20h-4.2l-3.3-4.6L7.8 20h-3l5.6-7-5.4-9Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (providerKey === 'discord') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M18.5 6.7a13 13 0 0 0-3.2-1l-.2.4a9 9 0 0 1 2.7 1.2A10.7 10.7 0 0 0 12 5.8a10.8 10.8 0 0 0-5.8 1.5A9 9 0 0 1 9 6l-.2-.4c-1.1.2-2.2.6-3.2 1A13 13 0 0 0 3.3 17a13 13 0 0 0 4 2l1-1.5c-.6-.2-1.1-.4-1.6-.7l.4-.3a9.2 9.2 0 0 0 9.8 0l.4.3c-.5.3-1 .5-1.6.7l1 1.5a13.1 13.1 0 0 0 4-2 13 13 0 0 0-2.2-10.3ZM9.5 14.3c-.8 0-1.4-.8-1.4-1.7 0-1 .6-1.7 1.4-1.7.8 0 1.5.8 1.4 1.7 0 1-.6 1.7-1.4 1.7Zm5 0c-.8 0-1.4-.8-1.4-1.7 0-1 .6-1.7 1.4-1.7.8 0 1.5.8 1.4 1.7 0 1-.6 1.7-1.4 1.7Z"
        />
      </svg>
    );
  }

  if (providerKey === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M13.6 20v-7h2.4l.4-2.8h-2.8V8.4c0-.8.2-1.3 1.4-1.3h1.5V4.5c-.3 0-1.1-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2h-2.5V13h2.5v7h3Z"
        />
      </svg>
    );
  }

  return null;
}

function formatAuthError(raw) {
  if (!raw) return '';
  const value = raw.toLowerCase();
  if (value === 'access_denied') return 'The sign-in flow was canceled before it finished.';
  if (value === 'unknown_provider') return 'That sign-in method is not available yet.';
  if (value.includes('no access token')) return 'The provider did not return a usable login token. Please try again.';
  if (value.includes('missing state')) return 'This login session expired. Please start the sign-in flow again.';
  return raw.replace(/\+/g, ' ');
}

export default function LoginPage() {
  const { isLoggedIn, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('login');
  const [providers, setProviders] = useState(DEFAULT_PROVIDERS);
  const [authNotice, setAuthNotice] = useState('');

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
  const redirectPath = searchParams.get('redirect') || '/';

  useEffect(() => {
    if (isLoggedIn) {
      navigate(redirectPath, { replace: true });
    }
  }, [isLoggedIn, navigate, redirectPath]);

  useEffect(() => {
    let ignore = false;

    apiGetAuthProviders()
      .then((data) => {
        if (ignore) return;
        const remoteProviders = new Map((data.providers || []).map((provider) => [provider.key, provider]));
        setProviders(DEFAULT_PROVIDERS.map((provider) => ({
          ...provider,
          ...(remoteProviders.get(provider.key) || {}),
        })));
      })
      .catch(() => {
        if (!ignore) setProviders(DEFAULT_PROVIDERS);
      });

    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');
    const error = searchParams.get('error');

    if (token && userParam) {
      try {
        login(token, JSON.parse(userParam));
        navigate(redirectPath, { replace: true });
        return;
      } catch {
        setAuthNotice('Social sign-in finished, but we could not restore your account session.');
      }
    }

    if (error) {
      setTab('login');
      setAuthNotice(formatAuthError(error));
    }
  }, [login, navigate, redirectPath, searchParams]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthNotice('');
    setLoginError('');
    if (!loginEmail || !loginPassword) { setLoginError('Please fill in all fields.'); return; }
    setLoginLoading(true);
    try {
      const data = await apiLogin(loginEmail, loginPassword);
      login(data.token, data.user);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setAuthNotice('');
    setRegError('');
    if (!regUsername || !regEmail || !regPassword) { setRegError('Please fill in all fields.'); return; }
    setRegLoading(true);
    try {
      const data = await apiRegister(regUsername, regEmail, regPassword);
      login(data.token, data.user);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  }

  function handleSocialLogin(provider) {
    if (!provider.enabled || !provider.url) {
      setAuthNotice(`${provider.label} sign-in is not configured yet.`);
      return;
    }
    window.location.assign(provider.url);
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
          background:
            radial-gradient(circle at 18% 18%, rgba(230, 0, 0, 0.18), transparent 30%),
            radial-gradient(circle at 82% 24%, rgba(255, 32, 32, 0.14), transparent 28%),
            linear-gradient(135deg, rgba(255,255,255,0.02), transparent 38%),
            var(--bg-deep);
        }
        .auth-stage {
          width: min(1180px, 100%);
          display: grid;
          grid-template-columns: minmax(320px, 1.15fr) minmax(360px, 440px);
          border: 1px solid var(--border);
          background:
            linear-gradient(90deg, rgba(255,255,255,0.01), rgba(255,255,255,0)),
            rgba(7, 7, 7, 0.92);
          box-shadow: var(--shadow-card);
          overflow: hidden;
        }
        .auth-hero {
          position: relative;
          padding: 3rem;
          min-height: 720px;
          border-right: 1px solid var(--border);
          background:
            linear-gradient(160deg, rgba(230,0,0,0.12), rgba(0,0,0,0) 40%),
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)),
            var(--bg-surface);
        }
        .auth-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(125deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 18px);
          opacity: 0.35;
          pointer-events: none;
        }
        .auth-hero > * {
          position: relative;
          z-index: 1;
        }
        .auth-badge-row {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }
        .auth-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.7rem;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.03);
          font-size: 0.78rem;
          color: var(--text-sub);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .auth-badge-dot {
          width: 8px;
          height: 8px;
          background: var(--accent);
          box-shadow: 0 0 14px rgba(230,0,0,0.7);
        }
        .auth-logo {
          font-family: var(--f-display);
          font-size: clamp(3.2rem, 8vw, 5.4rem);
          line-height: 0.88;
          letter-spacing: 0.08em;
          color: var(--text);
          margin-bottom: 1.1rem;
        }
        .auth-logo span {
          display: block;
          color: var(--accent);
          font-style: italic;
        }
        .auth-subtitle {
          max-width: 38rem;
          font-size: 1rem;
          color: var(--text-sub);
          margin-bottom: 2rem;
        }
        .auth-feature-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.9rem;
          margin-bottom: 2rem;
        }
        .auth-feature {
          padding: 1rem;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
        }
        .auth-feature__eyebrow {
          font-size: 0.74rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 0.35rem;
        }
        .auth-feature__title {
          font-weight: 700;
          font-size: 0.98rem;
          margin-bottom: 0.35rem;
        }
        .auth-feature__copy {
          font-size: 0.84rem;
          color: var(--text-sub);
        }
        .auth-card-social {
          display: flex;
          justify-content: center;
          margin-bottom: 1.2rem;
        }
        .auth-provider-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 56px));
          justify-content: center;
          gap: 0.75rem;
        }
        .oauth-card {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          min-height: 56px;
          padding: 0;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.025);
          color: var(--text);
          cursor: pointer;
          transition: transform .16s ease, border-color .16s ease, background .16s ease;
        }
        .oauth-card:hover:not(:disabled) {
          transform: translateY(-2px);
          border-color: rgba(230,0,0,0.55);
          background: rgba(255,255,255,0.05);
        }
        .oauth-card:disabled {
          cursor: not-allowed;
          opacity: 0.38;
        }
        .oauth-card__mark {
          width: 100%;
          height: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          border-radius: 10px;
        }
        .oauth-card__mark svg {
          width: 24px;
          height: 24px;
          display: block;
        }
        .oauth-card__mark--twitter,
        .oauth-card__mark--facebook {
          color: #ffffff;
        }
        .oauth-card__mark--discord {
          color: #5865F2;
        }
        .oauth-card__mark--facebook {
          color: #1877F2;
        }
        .auth-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 1.15rem 0 1.4rem;
          color: var(--text-muted);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .auth-divider::before,
        .auth-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }
        .auth-card {
          width: 100%;
          padding: 2.4rem 2rem;
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)),
            var(--bg-card);
        }
        .auth-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
        }
        .auth-card-logo {
          font-family: var(--f-display);
          font-size: 2.3rem;
          letter-spacing: 0.12em;
          color: var(--accent);
          margin-bottom: 0.25rem;
        }
        .auth-card-logo span { color: var(--text-muted); font-size: 1rem; font-weight: 500; }
        .auth-card-subtitle { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.2rem; }
        .auth-tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          margin-bottom: 1.2rem;
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
        .auth-legal {
          margin-top: 0.9rem;
          font-size: 0.75rem;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.45;
        }
        .auth-loading {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        #root { height: auto; overflow: auto; }
        @media (max-width: 1080px) {
          .auth-stage {
            grid-template-columns: 1fr;
          }
          .auth-hero {
            min-height: auto;
            border-right: none;
            border-bottom: 1px solid var(--border);
          }
        }
        @media (max-width: 720px) {
          .auth-wrap {
            padding: 1rem;
          }
          .auth-hero {
            padding: 1.6rem;
          }
          .auth-card {
            padding: 1.6rem 1.2rem;
          }
          .auth-feature-grid {
            grid-template-columns: 1fr;
          }
          .auth-provider-grid {
            grid-template-columns: repeat(4, minmax(0, 56px));
          }
        }
      `}</style>
      <div className="auth-wrap">
        <div className="auth-stage">
          <section className="auth-hero">
            <div className="auth-badge-row">
              <div className="auth-badge"><span className="auth-badge-dot" /> Live NBA Pulse</div>
              <div className="auth-badge">Unified Access</div>
              <div className="auth-badge">Secure OAuth</div>
            </div>

            <div className="auth-logo">
              GAME
              <span>PULSE</span>
            </div>
            <div className="auth-subtitle">
              Jump into live scores, predictions, and game-night conversation with one account that follows you across the whole app.
            </div>

            <div className="auth-feature-grid">
              <div className="auth-feature">
                <div className="auth-feature__eyebrow">Game Night Ready</div>
                <div className="auth-feature__title">One account across predictions, ratings, chat, and forum.</div>
                <div className="auth-feature__copy">No duplicate sign-up flow when you just want to react to a game and get in.</div>
              </div>
              <div className="auth-feature">
                <div className="auth-feature__eyebrow">Built For Fans</div>
                <div className="auth-feature__title">Start with 200 Score Coins and unlock titles, stickers, and bragging rights.</div>
                <div className="auth-feature__copy">Your profile, rewards, and community activity stay tied to one identity.</div>
              </div>
              <div className="auth-feature">
                <div className="auth-feature__eyebrow">Friction Down</div>
                <div className="auth-feature__title">Social login for quick entry, email login for long-term account control.</div>
                <div className="auth-feature__copy">Use whichever route feels right without losing the sports-first feel of the app.</div>
              </div>
              <div className="auth-feature">
                <div className="auth-feature__eyebrow">Secure Redirects</div>
                <div className="auth-feature__title">Provider callbacks land you right back inside the app already signed in.</div>
                <div className="auth-feature__copy">No copy-paste tokens, no dead-end callback pages, no awkward handoff.</div>
              </div>
            </div>

          </section>

          <div className="auth-card">
            <div className="auth-card-logo">GAME <span>PULSE</span></div>
            <div className="auth-card-subtitle">Use social sign-in for speed, or keep it classic with email and password.</div>

            <div className="auth-card-social">
              <div className="auth-provider-grid">
                {providers.map((provider) => (
                  <button
                    key={provider.key}
                    type="button"
                    className="oauth-card"
                    disabled={!provider.enabled}
                    aria-label={`Continue with ${provider.label}`}
                    title={provider.enabled ? `Continue with ${provider.label}` : `${provider.label} is not configured yet`}
                    onClick={() => handleSocialLogin(provider)}
                  >
                    <span className={`oauth-card__mark oauth-card__mark--${provider.key}`}>
                      <ProviderIcon providerKey={provider.key} />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="auth-divider">Or use email</div>

            <div className="auth-tabs">
              <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>Login</button>
              <button className={`auth-tab${tab === 'register' ? ' active' : ''}`} onClick={() => setTab('register')}>Register</button>
            </div>

            {(authNotice || loginError || regError) && (
              <div className="auth-error">
                {tab === 'login' ? (loginError || authNotice) : (regError || authNotice)}
              </div>
            )}

            {tab === 'login' && (
              <form onSubmit={handleLogin}>
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
              You start with <strong style={{ color: 'var(--accent-2)' }}>200 Score Coins</strong> and keep one identity across the whole fan experience.
            </div>
            <div className="auth-legal">
              By continuing with a social provider, you will be redirected to that platform and returned here automatically after authorization.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
