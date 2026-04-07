const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// GET /api/shop  — all items + how many the user owns + equipped title
router.get('/', auth, async (req, res) => {
  try {
    const [itemsRes, userRes] = await Promise.all([
      db.query(
        `SELECT si.*, COALESCE(ui.quantity, 0)::int AS owned
         FROM shop_items si
         LEFT JOIN user_items ui ON ui.item_id = si.id AND ui.user_id = $1
         ORDER BY si.type ASC, si.price ASC`,
        [req.user.id]
      ),
      db.query('SELECT coins, equipped_title_id FROM users WHERE id = $1', [req.user.id]),
    ]);
    res.json({
      items:             itemsRes.rows,
      coins:             userRes.rows[0]?.coins ?? 0,
      equippedTitleId:   userRes.rows[0]?.equipped_title_id ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shop/inventory  — all owned items
router.get('/inventory', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT si.*, ui.quantity,
              (u.equipped_title_id = si.id) AS equipped
       FROM user_items ui
       JOIN shop_items si ON si.id = ui.item_id
       JOIN users u ON u.id = ui.user_id
       WHERE ui.user_id = $1 AND ui.quantity > 0
       ORDER BY si.type ASC, si.price ASC`,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shop/buy/:itemId
router.post('/buy/:itemId', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const item = (await client.query('SELECT * FROM shop_items WHERE id = $1', [req.params.itemId])).rows[0];
    if (!item) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item not found' }); }

    const user = (await client.query('SELECT coins FROM users WHERE id = $1 FOR UPDATE', [req.user.id])).rows[0];
    if (user.coins < item.price) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Not enough coins' }); }

    await client.query('UPDATE users SET coins = coins - $1 WHERE id = $2', [item.price, req.user.id]);
    await client.query(
      `INSERT INTO user_items (user_id, item_id, quantity) VALUES ($1, $2, 1)
       ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = user_items.quantity + 1`,
      [req.user.id, item.id]
    );

    const coins = (await client.query('SELECT coins FROM users WHERE id = $1', [req.user.id])).rows[0].coins;
    await client.query('COMMIT');
    res.json({ ok: true, coins, item });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/shop/equip/:itemId  — equip a title (must own it)
router.post('/equip/:itemId', auth, async (req, res) => {
  try {
    const item = (await db.query(
      `SELECT si.* FROM shop_items si
       JOIN user_items ui ON ui.item_id = si.id AND ui.user_id = $1
       WHERE si.id = $2 AND si.type = 'title' AND ui.quantity > 0`,
      [req.user.id, req.params.itemId]
    )).rows[0];
    if (!item) return res.status(400).json({ error: 'Title not owned' });

    await db.query('UPDATE users SET equipped_title_id = $1 WHERE id = $2', [item.id, req.user.id]);
    res.json({ ok: true, title: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shop/unequip  — remove equipped title
router.post('/unequip', auth, async (req, res) => {
  try {
    await db.query('UPDATE users SET equipped_title_id = NULL WHERE id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
