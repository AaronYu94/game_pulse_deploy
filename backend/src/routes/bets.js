const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const notify = require('../notify');

// GET /api/bets — all bets for current user
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM bets WHERE user_id = $1 ORDER BY placed_at DESC',
      [req.user.id]
    );
    res.json({ bets: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// GET /api/bets/:gameId — bet for a specific game
router.get('/:gameId', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM bets WHERE user_id = $1 AND game_id = $2',
      [req.user.id, req.params.gameId]
    );
    res.json({ bet: rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bet' });
  }
});

// POST /api/bets — place a bet
router.post('/', auth, async (req, res) => {
  const { gameId, pick, amount, homeAbbr, awayAbbr } = req.body;
  if (!gameId || !pick || !amount)
    return res.status(400).json({ error: 'gameId, pick, and amount are required' });
  if (!['home', 'away'].includes(pick))
    return res.status(400).json({ error: 'pick must be "home" or "away"' });

  const amt = Math.max(1, Math.round(Number(amount)));
  if (isNaN(amt)) return res.status(400).json({ error: 'Invalid amount' });

  try {
    // Check balance
    const { rows: userRows } = await db.query(
      'SELECT coins FROM users WHERE id = $1',
      [req.user.id]
    );
    const coins = userRows[0]?.coins ?? 0;
    if (amt > coins)
      return res.status(400).json({ error: `Not enough coins (balance: ${coins})` });

    // Check for existing bet
    const { rows: existing } = await db.query(
      'SELECT id FROM bets WHERE user_id = $1 AND game_id = $2',
      [req.user.id, gameId]
    );
    if (existing.length)
      return res.status(409).json({ error: 'You already placed a bet on this game' });

    // Deduct coins + insert bet atomically-ish
    await db.query('UPDATE users SET coins = coins - $1 WHERE id = $2', [amt, req.user.id]);
    const { rows } = await db.query(
      `INSERT INTO bets (user_id, game_id, pick, amount, home_abbr, away_abbr)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, gameId, pick, amt, homeAbbr || null, awayAbbr || null]
    );

    const { rows: updated } = await db.query(
      'SELECT coins FROM users WHERE id = $1', [req.user.id]
    );

    res.status(201).json({ bet: rows[0], coins: updated[0].coins });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'You already placed a bet on this game' });
    console.error(err);
    res.status(500).json({ error: 'Failed to place bet' });
  }
});

// POST /api/bets/settle — settle bets given completed game results
// Body: { games: [{ id, home: { winner }, away: { winner }, completed }] }
router.post('/settle', auth, async (req, res) => {
  const { games } = req.body;
  if (!Array.isArray(games)) return res.status(400).json({ error: 'games array required' });

  try {
    let settled = 0;
    for (const g of games) {
      if (!g.completed) continue;
      const winnerSide = g.home?.winner ? 'home' : 'away';

      const { rows } = await db.query(
        `UPDATE bets SET settled = TRUE, won = (pick = $1)
         WHERE game_id = $2 AND settled = FALSE
         RETURNING id, user_id, amount, pick, (pick = $1) AS won`,
        [winnerSide, g.id]
      );

      // Pay out winners (2x their wager)
      for (const bet of rows) {
        if (bet.won) {
          await db.query(
            'UPDATE users SET coins = coins + $1 WHERE id = $2',
            [bet.amount * 2, bet.user_id]
          );
        }
        await notify(bet.user_id, {
          type: bet.won ? 'bet_won' : 'bet_lost',
          title: bet.won ? '🏆 Prediction Correct!' : '❌ Prediction Wrong',
          body: bet.won
            ? `Your ${bet.pick} pick won you ${bet.amount * 2} SC!`
            : `Your ${bet.pick} pick lost. Better luck next time.`,
          link: `/game?id=${g.id}`,
        });
        settled++;
      }
    }
    res.json({ settled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to settle bets' });
  }
});

module.exports = router;
