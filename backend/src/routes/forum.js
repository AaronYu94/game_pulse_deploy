const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// GET /api/forum/topics?cat=&sort=&q=
router.get('/topics', auth.optional, async (req, res) => {
  const { cat, sort, q } = req.query;

  const conditions = [];
  const params = [];

  if (cat && cat !== 'all') {
    params.push(cat);
    conditions.push(`t.category = $${params.length}`);
  }
  if (q && q.trim()) {
    params.push(`%${q.trim().toLowerCase()}%`);
    conditions.push(`(LOWER(t.title) LIKE $${params.length} OR LOWER(t.body) LIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderBy;
  if (sort === 'hot') {
    orderBy = 'reply_count DESC, last_activity DESC';
  } else if (sort === 'new') {
    orderBy = 't.created_at DESC';
  } else if (sort === 'views') {
    orderBy = 't.views DESC';
  } else {
    // default: latest activity
    orderBy = 'last_activity DESC';
  }

  try {
    const { rows } = await db.query(
      `SELECT t.*,
              COUNT(DISTINCT p.id)::int                  AS reply_count,
              MAX(p.created_at)                          AS last_reply_at,
              COALESCE(MAX(p.created_at), t.created_at)  AS last_activity
       FROM forum_topics t
       LEFT JOIN forum_posts p ON p.topic_id = t.id
       ${where}
       GROUP BY t.id
       ORDER BY ${orderBy}`,
      params
    );
    res.json({ topics: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// POST /api/forum/topics
router.post('/topics', auth, async (req, res) => {
  const { title, body, gameId, category } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  if (!body?.trim())  return res.status(400).json({ error: 'body is required' });
  if (title.length > 80) return res.status(400).json({ error: 'title max 80 characters' });

  try {
    const VALID_CATS = ['game', 'player', 'trade', 'chat', 'totd'];
    const cat = VALID_CATS.includes(category) ? category : 'chat';
    const id = 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const { rows } = await db.query(
      `INSERT INTO forum_topics (id, user_id, title, body, author_name, game_id, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, req.user.id, title.trim(), body.trim(), req.user.username, gameId || null, cat]
    );
    res.status(201).json({ topic: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

// GET /api/forum/topics/:id — topic + replies
router.get('/topics/:id', auth.optional, async (req, res) => {
  const { id } = req.params;
  const viewerId = req.user?.id || null;
  try {
    // increment view count (fire-and-forget)
    db.query('UPDATE forum_topics SET views = views + 1 WHERE id = $1', [id]).catch(() => {});

    const [topicRes, postsRes] = await Promise.all([
      db.query('SELECT * FROM forum_topics WHERE id = $1', [id]),
      db.query(
        `SELECT p.*,
                COUNT(DISTINCT pl.user_id)::int   AS likes,
                COALESCE(BOOL_OR(pl.user_id = $2), FALSE) AS liked_by_me,
                COUNT(DISTINCT pd.user_id)::int   AS dislikes,
                COALESCE(BOOL_OR(pd.user_id = $2), FALSE) AS disliked_by_me
         FROM forum_posts p
         LEFT JOIN forum_post_likes    pl ON pl.post_id = p.id
         LEFT JOIN forum_post_dislikes pd ON pd.post_id = p.id
         WHERE p.topic_id = $1
         GROUP BY p.id
         ORDER BY p.created_at ASC`,
        [id, viewerId]
      ),
    ]);
    if (!topicRes.rows[0]) return res.status(404).json({ error: 'Topic not found' });
    res.json({ topic: topicRes.rows[0], posts: postsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch topic' });
  }
});

// POST /api/forum/topics/:id/replies
router.post('/topics/:id/replies', auth, async (req, res) => {
  const { id }                          = req.params;
  const { content, quoteAuthor, quoteText } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

  try {
    const topicCheck = await db.query('SELECT id FROM forum_topics WHERE id = $1', [id]);
    if (!topicCheck.rows.length) return res.status(404).json({ error: 'Topic not found' });

    const postId = 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const { rows } = await db.query(
      `INSERT INTO forum_posts (id, user_id, topic_id, author_name, content, quote_author, quote_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        postId, req.user.id, id, req.user.username, content.trim(),
        quoteAuthor?.trim() || null,
        quoteText?.trim()   || null,
      ]
    );
    res.status(201).json({ post: { ...rows[0], likes: 0, liked_by_me: false } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post reply' });
  }
});

// POST /api/forum/replies/:id/like — toggle like (removes dislike if exists)
router.post('/replies/:id/like', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      `INSERT INTO forum_post_likes (user_id, post_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING 1`,
      [req.user.id, id]
    );
    if (!rows.length) {
      await db.query('DELETE FROM forum_post_likes WHERE user_id = $1 AND post_id = $2', [req.user.id, id]);
    } else {
      await db.query('DELETE FROM forum_post_dislikes WHERE user_id = $1 AND post_id = $2', [req.user.id, id]);
    }
    const [likeRes, dislikeRes] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS cnt FROM forum_post_likes WHERE post_id = $1', [id]),
      db.query('SELECT COUNT(*)::int AS cnt FROM forum_post_dislikes WHERE post_id = $1', [id]),
    ]);
    res.json({ likes: likeRes.rows[0].cnt, liked: rows.length > 0, dislikes: dislikeRes.rows[0].cnt, disliked: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// POST /api/forum/replies/:id/dislike — toggle dislike (removes like if exists)
router.post('/replies/:id/dislike', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      `INSERT INTO forum_post_dislikes (user_id, post_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING 1`,
      [req.user.id, id]
    );
    if (!rows.length) {
      await db.query('DELETE FROM forum_post_dislikes WHERE user_id = $1 AND post_id = $2', [req.user.id, id]);
    } else {
      await db.query('DELETE FROM forum_post_likes WHERE user_id = $1 AND post_id = $2', [req.user.id, id]);
    }
    const [likeRes, dislikeRes] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS cnt FROM forum_post_likes WHERE post_id = $1', [id]),
      db.query('SELECT COUNT(*)::int AS cnt FROM forum_post_dislikes WHERE post_id = $1', [id]),
    ]);
    res.json({ dislikes: dislikeRes.rows[0].cnt, disliked: rows.length > 0, likes: likeRes.rows[0].cnt, liked: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle dislike' });
  }
});

module.exports = router;
