const router = require('express').Router();
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const db     = require('../db');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND  = process.env.BACKEND_URL;
const SECRET   = process.env.JWT_SECRET;

// ── PKCE helpers (required by X/Twitter OAuth 2.0) ────────────────────────
function pkceVerifier() {
  return crypto.randomBytes(40).toString('base64url');
}
function pkceChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ── Provider definitions ───────────────────────────────────────────────────
const PROVIDERS = {
  google: {
    authUrl:   'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl:  'https://oauth2.googleapis.com/token',
    userUrl:   'https://www.googleapis.com/oauth2/v2/userinfo',
    clientId:  process.env.GOOGLE_CLIENT_ID,
    clientSec: process.env.GOOGLE_CLIENT_SECRET,
    scope:     'openid email profile',
  },
  discord: {
    authUrl:   'https://discord.com/api/oauth2/authorize',
    tokenUrl:  'https://discord.com/api/oauth2/token',
    userUrl:   'https://discord.com/api/users/@me',
    clientId:  process.env.DISCORD_CLIENT_ID,
    clientSec: process.env.DISCORD_CLIENT_SECRET,
    scope:     'identify email',
  },
  facebook: {
    authUrl:   'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl:  'https://graph.facebook.com/v19.0/oauth/access_token',
    userUrl:   'https://graph.facebook.com/me?fields=id,name,email',
    clientId:  process.env.FACEBOOK_CLIENT_ID,
    clientSec: process.env.FACEBOOK_CLIENT_SECRET,
    scope:     'email,public_profile',
  },
  // X uses OAuth 2.0 with PKCE — code_verifier is embedded in signed state JWT
  twitter: {
    authUrl:   'https://twitter.com/i/oauth2/authorize',
    tokenUrl:  'https://api.twitter.com/2/oauth2/token',
    userUrl:   'https://api.twitter.com/2/users/me?user.fields=id,name,username',
    clientId:  process.env.TWITTER_CLIENT_ID,
    clientSec: process.env.TWITTER_CLIENT_SECRET,
    scope:     'tweet.read users.read',
    pkce:      true,
  },
};

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    SECRET,
    { expiresIn: '30d' }
  );
}

function backendBaseUrl(req) {
  if (BACKEND) return BACKEND;
  return `${req.protocol}://${req.get('host')}`;
}

function callbackUrl(req, provider) {
  return `${backendBaseUrl(req)}/api/auth/${provider}/callback`;
}

// Normalize profile from each provider into { providerId, username, email }
async function normalizeProfile(providerName, profile, accessToken, p) {
  if (providerName === 'google') {
    return {
      providerId: String(profile.id),
      username:   (profile.name || '').replace(/\s+/g, '').slice(0, 28) || `user${String(profile.id).slice(0, 8)}`,
      email:      profile.email,
    };
  }
  if (providerName === 'discord') {
    return {
      providerId: String(profile.id),
      username:   (profile.username || `dc${profile.id}`).slice(0, 28),
      email:      profile.email || `dc_${profile.id}@noreply.discord.com`,
    };
  }
  if (providerName === 'facebook') {
    return {
      providerId: String(profile.id),
      username:   (profile.name || '').replace(/\s+/g, '').slice(0, 28) || `fb${profile.id}`,
      email:      profile.email || `fb_${profile.id}@noreply.facebook.com`,
    };
  }
  if (providerName === 'twitter') {
    const u = profile.data || profile;
    return {
      providerId: String(u.id),
      username:   (u.username || `tw${u.id}`).slice(0, 28),
      // X basic scope doesn't include email — use placeholder
      email:      `tw_${u.id}@noreply.x.com`,
    };
  }
  throw new Error('Unknown provider');
}

// ── GET /api/auth/:provider ────────────────────────────────────────────────
router.get('/:provider', (req, res) => {
  const providerName = req.params.provider;
  const p = PROVIDERS[providerName];
  if (!p || !p.clientId) {
    return res.status(404).json({ error: `Provider "${providerName}" is not configured` });
  }

  const params = new URLSearchParams({
    client_id:     p.clientId,
    redirect_uri:  callbackUrl(req, providerName),
    response_type: 'code',
    scope:         p.scope,
  });

  if (p.pkce) {
    // Generate PKCE pair; store verifier in signed state so we're stateless
    const verifier   = pkceVerifier();
    const challenge  = pkceChallenge(verifier);
    const state      = jwt.sign({ verifier }, SECRET, { expiresIn: '10m' });
    params.set('code_challenge',        challenge);
    params.set('code_challenge_method', 'S256');
    params.set('state',                 state);
  }

  res.redirect(`${p.authUrl}?${params}`);
});

// ── GET /api/auth/:provider/callback ──────────────────────────────────────
router.get('/:provider/callback', async (req, res) => {
  const providerName = req.params.provider;
  const p = PROVIDERS[providerName];
  if (!p) return res.redirect(`${FRONTEND}/login?error=unknown_provider`);

  const { code, state, error } = req.query;
  if (error || !code) return res.redirect(`${FRONTEND}/login?error=access_denied`);

  try {
    // For PKCE providers, recover the code_verifier from the signed state
    let codeVerifier;
    if (p.pkce) {
      if (!state) throw new Error('Missing state parameter');
      const decoded = jwt.verify(state, SECRET);
      codeVerifier = decoded.verifier;
    }

    // Build token exchange body
    const tokenBody = new URLSearchParams({
      client_id:    p.clientId,
      code,
      redirect_uri: callbackUrl(req, providerName),
      grant_type:   'authorization_code',
    });
    if (codeVerifier) tokenBody.set('code_verifier', codeVerifier);

    // X requires HTTP Basic auth instead of client_secret in body
    const tokenHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };
    if (providerName === 'twitter') {
      const creds = Buffer.from(`${p.clientId}:${p.clientSec}`).toString('base64');
      tokenHeaders.Authorization = `Basic ${creds}`;
    } else {
      tokenBody.set('client_secret', p.clientSec);
    }

    const tokenRes = await fetch(p.tokenUrl, { method: 'POST', headers: tokenHeaders, body: tokenBody });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error('No access token received');

    // Fetch user profile
    const profileRes = await fetch(p.userUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'SCORE-NBA-App/1.0',
        Accept: 'application/json',
      },
    });
    const profile = await profileRes.json();

    const { providerId, username, email } = await normalizeProfile(providerName, profile, accessToken, p);
    if (!providerId) throw new Error('Could not read user ID from provider');

    // Find or create user
    const client = await db.connect();
    try {
      const linked = await client.query(
        'SELECT user_id FROM user_oauth WHERE provider = $1 AND provider_id = $2',
        [providerName, providerId]
      );

      let userId;
      if (linked.rows.length) {
        userId = linked.rows[0].user_id;
      } else {
        const byEmail = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (byEmail.rows.length) {
          userId = byEmail.rows[0].id;
        } else {
          let finalUsername = username;
          const taken = await client.query('SELECT id FROM users WHERE username = $1', [finalUsername]);
          if (taken.rows.length) {
            finalUsername = `${username.slice(0, 24)}_${Math.floor(Math.random() * 9000 + 1000)}`;
          }
          const newUser = await client.query(
            'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id',
            [finalUsername, email]
          );
          userId = newUser.rows[0].id;
        }
        await client.query(
          'INSERT INTO user_oauth (user_id, provider, provider_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [userId, providerName, providerId]
        );
      }

      const { rows } = await client.query(
        'SELECT id, username, email, coins FROM users WHERE id = $1',
        [userId]
      );
      const user = rows[0];
      const token = signToken(user);
      const userParam = encodeURIComponent(JSON.stringify({
        id: user.id, username: user.username, email: user.email,
      }));

      res.redirect(`${FRONTEND}/login?token=${token}&user=${userParam}`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`OAuth ${providerName} error:`, err.message);
    res.redirect(`${FRONTEND}/login?error=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
