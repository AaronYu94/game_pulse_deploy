const db = require('./db');

async function notify(userId, { type, title, body = null, link = null }) {
  try {
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, body, link]
    );
  } catch (_) {}
}

module.exports = notify;
