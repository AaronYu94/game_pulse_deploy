const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

const TASK_DEFS = {
  login:   { reward: 20 },
  share:   { reward: 50 },
  rating:  { reward: 10 },
  comment: { reward: 15 },
};

function todayDate() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// GET /api/coins — get balance + today's task state
router.get('/', auth, async (req, res) => {
  try {
    const [userRes, taskRes] = await Promise.all([
      db.query('SELECT coins FROM users WHERE id = $1', [req.user.id]),
      db.query(
        'SELECT * FROM daily_tasks WHERE user_id = $1 AND task_date = $2',
        [req.user.id, todayDate()]
      ),
    ]);
    const coins = userRes.rows[0]?.coins ?? 0;
    const tasks = taskRes.rows[0] || {
      login_done: false, share_done: false,
      rating_done: false, comment_done: false,
    };
    res.json({ coins, tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch coins' });
  }
});

// POST /api/coins/claim/:key — claim a daily task reward
router.post('/claim/:key', auth, async (req, res) => {
  const { key } = req.params;
  const def = TASK_DEFS[key];
  if (!def) return res.status(400).json({ error: 'Invalid task key' });

  const col = `${key}_done`;
  const today = todayDate();

  try {
    // Upsert today's task row
    await db.query(
      `INSERT INTO daily_tasks (user_id, task_date)
       VALUES ($1, $2)
       ON CONFLICT (user_id, task_date) DO NOTHING`,
      [req.user.id, today]
    );

    // Atomically check + mark done in one query
    const { rows } = await db.query(
      `UPDATE daily_tasks
       SET ${col} = TRUE
       WHERE user_id = $1 AND task_date = $2 AND ${col} = FALSE
       RETURNING id`,
      [req.user.id, today]
    );

    if (!rows.length) {
      return res.status(409).json({ error: 'Task already claimed today' });
    }

    // Add coins
    const { rows: updated } = await db.query(
      `UPDATE users SET coins = coins + $1 WHERE id = $2 RETURNING coins`,
      [def.reward, req.user.id]
    );

    res.json({ ok: true, reward: def.reward, coins: updated[0].coins });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to claim task' });
  }
});

// POST /api/coins/hoop — award hoop of the day coins
router.post('/hoop', auth, async (req, res) => {
  const { amount } = req.body;
  if (![30, 90].includes(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  try {
    const { rows } = await db.query(
      `UPDATE users SET coins = coins + $1 WHERE id = $2 RETURNING coins`,
      [amount, req.user.id]
    );
    res.json({ ok: true, coins: rows[0].coins });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to award coins' });
  }
});

module.exports = router;
