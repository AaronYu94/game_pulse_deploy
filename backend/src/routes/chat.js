const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// GET /api/chat/:gameId  — fetch last 80 messages (newest last)
router.get('/:gameId', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM (
         SELECT id, game_id, user_id, username, content, sticker_id, title_name, title_emoji, created_at
         FROM game_chats WHERE game_id = $1
         ORDER BY created_at DESC LIMIT 80
       ) sub ORDER BY created_at ASC`,
      [req.params.gameId]
    );
    res.json({ messages: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
