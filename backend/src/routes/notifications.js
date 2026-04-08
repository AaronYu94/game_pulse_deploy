const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  try {
    const [notifRes, countRes] = await Promise.all([
      db.query(
        `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [req.user.id]
      ),
      db.query(
        `SELECT COUNT(*)::int AS cnt FROM notifications WHERE user_id = $1 AND read = FALSE`,
        [req.user.id]
      ),
    ]);
    res.json({ notifications: notifRes.rows, unread: countRes.rows[0].cnt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all
router.post('/read-all', auth, async (req, res) => {
  try {
    await db.query(`UPDATE notifications SET read = TRUE WHERE user_id = $1`, [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', auth, async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
