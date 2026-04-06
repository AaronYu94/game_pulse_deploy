const router  = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../db');
const authMw   = require('../middleware/auth');

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'username, email and password are required' });
  if (username.length < 2 || username.length > 30)
    return res.status(400).json({ error: 'username must be 2-30 characters' });
  if (password.length < 6)
    return res.status(400).json({ error: 'password must be at least 6 characters' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, coins, created_at`,
      [username.trim(), email.trim().toLowerCase(), hash]
    );
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    if (err.code === '23505') {
      const field = err.detail?.includes('username') ? 'username' : 'email';
      return res.status(409).json({ error: `This ${field} is already taken` });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  try {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    if (!user.password_hash)
      return res.status(401).json({ error: 'This account uses social login. Please sign in with Google, GitHub, or Discord.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const { password_hash, ...safe } = user;
    res.json({ token: signToken(user), user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authMw, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, username, email, coins, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
