const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// GET /api/comments/:gameId
router.get('/:gameId', auth.optional, async (req, res) => {
  const { gameId } = req.params;
  const viewerId = req.user?.id || null;
  try {
    const { rows } = await db.query(
      `SELECT c.*,
              COUNT(cl.user_id)::int                              AS likes,
              COALESCE(BOOL_OR(cl.user_id = $2), FALSE)          AS liked_by_me
       FROM comments c
       LEFT JOIN comment_likes cl ON cl.comment_id = c.id
       WHERE c.game_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [gameId, viewerId]
    );
    res.json({ comments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/comments/:gameId
router.post('/:gameId', auth, async (req, res) => {
  const { gameId }             = req.params;
  const { content, playerId, pick } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
  if (pick && !['home', 'away'].includes(pick))
    return res.status(400).json({ error: 'pick must be home or away' });

  try {
    const id = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const { rows } = await db.query(
      `INSERT INTO comments (id, user_id, game_id, player_id, author_name, content, pick)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, req.user.id, gameId, playerId || null, req.user.username, content.trim(), pick || null]
    );
    res.status(201).json({ comment: { ...rows[0], likes: 0, liked_by_me: false } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// POST /api/comments/:commentId/like — toggle like
router.post('/:commentId/like', auth, async (req, res) => {
  const { commentId } = req.params;
  try {
    // Try insert; if duplicate, delete (toggle)
    const { rows } = await db.query(
      `INSERT INTO comment_likes (user_id, comment_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING 1`,
      [req.user.id, commentId]
    );
    if (!rows.length) {
      await db.query(
        'DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2',
        [req.user.id, commentId]
      );
    }
    const likeRes = await db.query(
      'SELECT COUNT(*)::int AS likes FROM comment_likes WHERE comment_id = $1',
      [commentId]
    );
    res.json({ likes: likeRes.rows[0].likes, liked: rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

module.exports = router;
