const { pool } = require('./db');

let schemaReady = null;

async function ensureTrackProgressSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await pool.query(`
      ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS track_id VARCHAR(255)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_track_progress (
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id VARCHAR(255) NOT NULL,
        progresso_geral INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, track_id)
      )
    `);

    await pool.query(`
      UPDATE user_progress up
      SET track_id = COALESCE(c.track_id, 'track_padrao')
      FROM lessons l
      JOIN categories c ON c.id = l.category_id
      WHERE up.video_id = l.id AND (up.track_id IS NULL OR up.track_id = '')
    `);

    await pool.query(`
      UPDATE user_progress up
      SET track_id = COALESCE(u.track_id, 'track_padrao')
      FROM users u
      WHERE u.id = up.user_id AND (up.track_id IS NULL OR up.track_id = '')
    `);
  })();
  return schemaReady;
}

async function getLessonTrackId(lessonId) {
  const res = await pool.query(
    `SELECT COALESCE(c.track_id, 'track_padrao') AS track_id
     FROM lessons l
     JOIN categories c ON c.id = l.category_id
     WHERE l.id = $1`,
    [lessonId]
  );
  return res.rows[0]?.track_id || 'track_padrao';
}

async function computeTrackProgressPct(userId, trackId) {
  const res = await pool.query(
    `SELECT
       COUNT(up.video_id)::int AS done,
       (SELECT COUNT(*)::int FROM lessons l
        JOIN categories c ON c.id = l.category_id
        WHERE COALESCE(c.track_id, 'track_padrao') = $2) AS total
     FROM user_progress up
     WHERE up.user_id = $1 AND up.track_id = $2`,
    [userId, trackId]
  );
  const { done, total } = res.rows[0];
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

async function syncTrackProgressSummary(userId, trackId) {
  const pct = await computeTrackProgressPct(userId, trackId);
  await pool.query(
    `INSERT INTO user_track_progress (user_id, track_id, progresso_geral)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, track_id) DO UPDATE SET progresso_geral = $3`,
    [userId, trackId, pct]
  );
  const userRes = await pool.query('SELECT track_id FROM users WHERE id = $1', [userId]);
  if (userRes.rows[0]?.track_id === trackId) {
    await pool.query('UPDATE users SET progresso_geral = $1 WHERE id = $2', [pct, userId]);
  }
  return pct;
}

async function setTrackProgressSummary(userId, trackId, progressoGeral) {
  const pct = Math.min(100, Math.max(0, Number(progressoGeral) || 0));
  await pool.query(
    `INSERT INTO user_track_progress (user_id, track_id, progresso_geral)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, track_id) DO UPDATE SET progresso_geral = $3`,
    [userId, trackId, pct]
  );
  const userRes = await pool.query('SELECT track_id FROM users WHERE id = $1', [userId]);
  if (userRes.rows[0]?.track_id === trackId) {
    await pool.query('UPDATE users SET progresso_geral = $1 WHERE id = $2', [pct, userId]);
  }
  return pct;
}

async function getTrackProgressSummary(userId, trackId) {
  const cached = await pool.query(
    'SELECT progresso_geral FROM user_track_progress WHERE user_id = $1 AND track_id = $2',
    [userId, trackId]
  );
  if (cached.rowCount > 0) {
    return cached.rows[0].progresso_geral;
  }
  return computeTrackProgressPct(userId, trackId);
}

module.exports = {
  ensureTrackProgressSchema,
  getLessonTrackId,
  computeTrackProgressPct,
  syncTrackProgressSummary,
  setTrackProgressSummary,
  getTrackProgressSummary,
};
