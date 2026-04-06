const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// GET /api/ratings/:gameId — aggregate + caller's own rating
router.get('/:gameId', auth, async (req, res) => {
  const { gameId } = req.params;
  try {
    const [aggRes, myRes] = await Promise.all([
      db.query(
        `SELECT ROUND(AVG(score)::numeric, 1) AS avg,
                COUNT(*)                        AS count
         FROM game_ratings WHERE game_id = $1`,
        [gameId]
      ),
      db.query(
        'SELECT score FROM game_ratings WHERE user_id = $1 AND game_id = $2',
        [req.user.id, gameId]
      ),
    ]);
    res.json({
      avg:      parseFloat(aggRes.rows[0].avg) || null,
      count:    parseInt(aggRes.rows[0].count, 10),
      myScore:  myRes.rows[0]?.score || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// POST /api/ratings/:gameId — rate a game (upsert)
router.post('/:gameId', auth, async (req, res) => {
  const { gameId } = req.params;
  const { score }  = req.body;
  const s = parseInt(score, 10);
  if (isNaN(s) || s < 1 || s > 10)
    return res.status(400).json({ error: 'score must be 1-10' });

  try {
    await db.query(
      `INSERT INTO game_ratings (user_id, game_id, score)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, game_id) DO UPDATE SET score = EXCLUDED.score`,
      [req.user.id, gameId, s]
    );
    const [aggRes] = (await db.query(
      `SELECT ROUND(AVG(score)::numeric, 1) AS avg, COUNT(*) AS count
       FROM game_ratings WHERE game_id = $1`,
      [gameId]
    )).rows;

    res.json({
      avg:     parseFloat(aggRes.avg) || null,
      count:   parseInt(aggRes.count, 10),
      myScore: s,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

// GET /api/refratings/:gameId
router.get('/ref/:gameId', auth, async (req, res) => {
  const { gameId } = req.params;
  try {
    const [aggRes, myRes] = await Promise.all([
      db.query(
        `SELECT
           COUNT(*) FILTER (WHERE verdict = 'good') AS good,
           COUNT(*) FILTER (WHERE verdict = 'ok')   AS ok,
           COUNT(*) FILTER (WHERE verdict = 'bad')  AS bad
         FROM ref_ratings WHERE game_id = $1`,
        [gameId]
      ),
      db.query(
        'SELECT verdict FROM ref_ratings WHERE user_id = $1 AND game_id = $2',
        [req.user.id, gameId]
      ),
    ]);
    const r = aggRes.rows[0];
    res.json({
      good: parseInt(r.good, 10),
      ok:   parseInt(r.ok,   10),
      bad:  parseInt(r.bad,  10),
      myVerdict: myRes.rows[0]?.verdict || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ref ratings' });
  }
});

// POST /api/refratings/:gameId
router.post('/ref/:gameId', auth, async (req, res) => {
  const { gameId }  = req.params;
  const { verdict } = req.body;
  if (!['good', 'ok', 'bad'].includes(verdict))
    return res.status(400).json({ error: 'verdict must be good, ok, or bad' });

  try {
    await db.query(
      `INSERT INTO ref_ratings (user_id, game_id, verdict)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, game_id) DO UPDATE SET verdict = EXCLUDED.verdict`,
      [req.user.id, gameId, verdict]
    );
    const aggRes = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE verdict = 'good') AS good,
         COUNT(*) FILTER (WHERE verdict = 'ok')   AS ok,
         COUNT(*) FILTER (WHERE verdict = 'bad')  AS bad
       FROM ref_ratings WHERE game_id = $1`,
      [gameId]
    );
    const r = aggRes.rows[0];
    res.json({
      good: parseInt(r.good, 10),
      ok:   parseInt(r.ok,   10),
      bad:  parseInt(r.bad,  10),
      myVerdict: verdict,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save ref rating' });
  }
});

// GET /api/ratings/player/:gameId/:playerId
router.get('/player/:gameId/:playerId', auth, async (req, res) => {
  const { gameId, playerId } = req.params;
  try {
    const [aggRes, myRes] = await Promise.all([
      db.query(
        `SELECT ROUND(AVG(score)::numeric, 1) AS avg, COUNT(*)::int AS count
         FROM player_ratings WHERE game_id = $1 AND player_id = $2`,
        [gameId, playerId]
      ),
      db.query(
        'SELECT score FROM player_ratings WHERE user_id = $1 AND game_id = $2 AND player_id = $3',
        [req.user.id, gameId, playerId]
      ),
    ]);
    res.json({
      avg:     parseFloat(aggRes.rows[0].avg) || null,
      count:   aggRes.rows[0].count,
      myScore: myRes.rows[0]?.score || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch player rating' });
  }
});

// GET /api/ratings/player/:gameId — all player ratings for a game (bulk)
router.get('/player/:gameId', auth, async (req, res) => {
  const { gameId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT player_id,
              ROUND(AVG(score)::numeric, 1) AS avg,
              COUNT(*)::int                  AS count,
              MAX(score) FILTER (WHERE user_id = $2) AS my_score
       FROM player_ratings WHERE game_id = $1
       GROUP BY player_id`,
      [gameId, req.user.id]
    );
    // Map to { playerId: { avg, count, myScore } }
    const result = {};
    rows.forEach(r => {
      result[r.player_id] = {
        avg:     parseFloat(r.avg) || null,
        count:   r.count,
        myScore: r.my_score || null,
      };
    });
    res.json({ ratings: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch player ratings' });
  }
});

// POST /api/ratings/player/:gameId/:playerId
router.post('/player/:gameId/:playerId', auth, async (req, res) => {
  const { gameId, playerId } = req.params;
  const { score } = req.body;
  const s = parseInt(score, 10);
  if (isNaN(s) || s < 1 || s > 10)
    return res.status(400).json({ error: 'score must be 1-10' });

  try {
    await db.query(
      `INSERT INTO player_ratings (user_id, game_id, player_id, score)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, game_id, player_id) DO UPDATE SET score = EXCLUDED.score`,
      [req.user.id, gameId, playerId, s]
    );
    const aggRes = await db.query(
      `SELECT ROUND(AVG(score)::numeric, 1) AS avg, COUNT(*)::int AS count
       FROM player_ratings WHERE game_id = $1 AND player_id = $2`,
      [gameId, playerId]
    );
    res.json({
      avg:     parseFloat(aggRes.rows[0].avg) || null,
      count:   aggRes.rows[0].count,
      myScore: s,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save player rating' });
  }
});

module.exports = router;
