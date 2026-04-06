require('dotenv').config();
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const jwt      = require('jsonwebtoken');
const db       = require('./db');

const app    = express();
const server = http.createServer(app);

// ── CORS origins ────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

function isAllowed(origin) {
  if (!origin) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return allowedOrigins.some(o => origin.startsWith(o));
}

app.use(cors({ origin: (origin, cb) => isAllowed(origin) ? cb(null, true) : cb(new Error(`CORS blocked: ${origin}`)), credentials: true }));
app.use(express.json());

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: (origin, cb) => isAllowed(origin) ? cb(null, true) : cb(new Error('CORS')), credentials: true },
});

io.on('connection', (socket) => {
  // Authenticate via token in handshake
  let user;
  try {
    user = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
  } catch {
    socket.disconnect();
    return;
  }

  socket.on('join_game', (gameId) => {
    socket.join(`game:${gameId}`);
  });

  socket.on('send_message', async ({ gameId, content }) => {
    if (!gameId || !content?.trim()) return;
    const text = content.trim().slice(0, 300);
    try {
      // Snapshot equipped title
      const titleRes = await db.query(
        `SELECT si.name AS title_name, si.emoji AS title_emoji
         FROM users u LEFT JOIN shop_items si ON si.id = u.equipped_title_id
         WHERE u.id = $1`, [user.id]
      );
      const { title_name, title_emoji } = titleRes.rows[0] || {};
      const { rows } = await db.query(
        'INSERT INTO game_chats (game_id, user_id, username, content, title_name, title_emoji) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [gameId, user.id, user.username, text, title_name || null, title_emoji || null]
      );
      io.to(`game:${gameId}`).emit('new_message', rows[0]);
    } catch (err) {
      console.error('chat insert error:', err.message);
    }
  });

  socket.on('send_sticker', async ({ gameId, itemId }) => {
    if (!gameId || !itemId) return;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      // Check ownership
      const inv = (await client.query(
        'SELECT quantity FROM user_items WHERE user_id = $1 AND item_id = $2 FOR UPDATE',
        [user.id, itemId]
      )).rows[0];
      if (!inv || inv.quantity < 1) { await client.query('ROLLBACK'); return; }

      const item = (await client.query('SELECT * FROM shop_items WHERE id = $1', [itemId])).rows[0];
      if (!item) { await client.query('ROLLBACK'); return; }

      // Deduct one from inventory
      await client.query(
        'UPDATE user_items SET quantity = quantity - 1 WHERE user_id = $1 AND item_id = $2',
        [user.id, itemId]
      );
      // Save as chat message
      const titleRes = await client.query(
        `SELECT si.name AS title_name, si.emoji AS title_emoji
         FROM users u LEFT JOIN shop_items si ON si.id = u.equipped_title_id
         WHERE u.id = $1`, [user.id]
      );
      const { title_name, title_emoji } = titleRes.rows[0] || {};
      const { rows } = await client.query(
        'INSERT INTO game_chats (game_id, user_id, username, content, sticker_id, title_name, title_emoji) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [gameId, user.id, user.username, item.emoji, itemId, title_name || null, title_emoji || null]
      );
      await client.query('COMMIT');

      const msg = { ...rows[0], sticker: item };
      io.to(`game:${gameId}`).emit('new_message', msg);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('sticker send error:', err.message);
    } finally {
      client.release();
    }
  });
});

// ── REST routes ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/auth',     require('./routes/oauth'));
app.use('/api/coins',    require('./routes/coins'));
app.use('/api/bets',     require('./routes/bets'));
app.use('/api/ratings',  require('./routes/ratings'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/forum',    require('./routes/forum'));
app.use('/api/profile',  require('./routes/profile'));
app.use('/api/chat',     require('./routes/chat'));
app.use('/api/shop',     require('./routes/shop'));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
