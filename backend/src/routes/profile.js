const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// GET /api/profile/me
router.get('/me', auth, async (req, res) => {
  try {
    const uid = req.user.id;

    const [userRes, betStatsRes, betsRes, forumStatsRes, topicsRes, ratingsRes] = await Promise.all([
      db.query(
        'SELECT id, username, email, coins, bio, created_at FROM users WHERE id = $1',
        [uid]
      ),
      db.query(`
        SELECT
          COUNT(*)::int                                                       AS total,
          SUM(CASE WHEN settled AND won     THEN 1 ELSE 0 END)::int          AS won,
          SUM(CASE WHEN settled AND NOT won THEN 1 ELSE 0 END)::int          AS lost,
          SUM(CASE WHEN NOT settled         THEN 1 ELSE 0 END)::int          AS pending,
          COALESCE(SUM(amount), 0)::int                                       AS wagered,
          COALESCE(SUM(CASE WHEN settled AND won THEN amount * 2 ELSE 0 END), 0)::int AS earned
        FROM bets WHERE user_id = $1
      `, [uid]),
      db.query(
        'SELECT * FROM bets WHERE user_id = $1 ORDER BY placed_at DESC',
        [uid]
      ),
      db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM forum_topics WHERE user_id = $1) AS topics,
          (SELECT COUNT(*)::int FROM forum_posts  WHERE user_id = $1) AS replies
      `, [uid]),
      db.query(
        'SELECT id, title, category, views, created_at FROM forum_topics WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
        [uid]
      ),
      db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM game_ratings   WHERE user_id = $1) AS games,
          (SELECT COUNT(*)::int FROM player_ratings WHERE user_id = $1) AS players,
          (SELECT COUNT(*)::int FROM ref_ratings    WHERE user_id = $1) AS refs
      `, [uid]),
    ]);

    res.json({
      user:       userRes.rows[0],
      betStats:   betStatsRes.rows[0],
      bets:       betsRes.rows,
      forumStats: forumStatsRes.rows[0],
      topics:     topicsRes.rows,
      ratings:    ratingsRes.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/profile/me  — update bio
router.patch('/me', auth, async (req, res) => {
  try {
    const bio = (req.body.bio || '').slice(0, 160);
    await db.query('UPDATE users SET bio = $1 WHERE id = $2', [bio, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
