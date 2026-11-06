const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const CONTENT_TABLES = new Set(['tracks', 'categories', 'lessons', 'modules', 'site_settings']);
const SAFE_SITE_SETTINGS = new Set(['featured_video_url', 'backup_interval_days']);

function validateBackupFilename(filename) {
  if (!filename || !/^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sql$/.test(filename)) {
    throw new Error('Nome de arquivo de backup invalido.');
  }
}

function latestBackupFilename(backupDir) {
  const files = fs.readdirSync(backupDir)
    .filter((file) => /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sql$/.test(file))
    .sort()
    .reverse();
  return files[0] || null;
}

function pgValue(value) {
  if (value === '\\N') return null;
  return value
    .replace(/\\t/g, '\t')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
}

function parseCopyRows(sql) {
  const result = {};
  let active = null;

  for (const line of sql.split(/\r?\n/)) {
    if (active) {
      if (line === '\\.') {
        active = null;
        continue;
      }
      if (!line) continue;
      if (CONTENT_TABLES.has(active.table)) {
        const values = line.split('\t').map(pgValue);
        result[active.table].push(
          Object.fromEntries(active.columns.map((column, index) => [column, values[index] ?? null]))
        );
      }
      continue;
    }

    const header = line.match(/^COPY public\.([a-z_]+) \(([^)]+)\) FROM stdin;$/);
    if (!header) continue;

    const table = header[1];
    const columns = header[2].split(',').map((column) => column.trim().replace(/^"|"$/g, ''));
    if (CONTENT_TABLES.has(table)) {
      result[table] = [];
    }
    active = { table, columns };
  }

  return result;
}

async function ensureContentSchema(client) {
  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS one_user_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS one_business_group_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS one_store_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS one_context JSONB;

    CREATE UNIQUE INDEX IF NOT EXISTS users_one_user_id_key
    ON users (one_user_id)
    WHERE one_user_id IS NOT NULL;
  `);
}

async function restoreTrainingContentFromBackup(filename, options = {}) {
  validateBackupFilename(filename);
  const backupDir = options.backupDir || path.resolve(process.cwd(), 'backup');
  const filePath = path.join(backupDir, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error('Arquivo de backup nao encontrado.');
  }

  const data = parseCopyRows(fs.readFileSync(filePath, 'utf8'));
  const client = await pool.connect();
  const counts = { tracks: 0, categories: 0, lessons: 0, modules: 0, site_settings: 0 };

  try {
    await client.query('BEGIN');
    await ensureContentSchema(client);
    await client.query(fs.readFileSync(path.resolve(process.cwd(), 'scripts/learning-schema.sql'), 'utf8'));
    await client.query('LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE');

    for (const row of data.tracks || []) {
      await client.query(
        `INSERT INTO tracks (id, name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [row.id, row.name]
      );
      counts.tracks += 1;
    }

    for (const row of data.categories || []) {
      await client.query(
        `INSERT INTO categories (id, name, icon, sort_order, track_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           icon = EXCLUDED.icon,
           sort_order = EXCLUDED.sort_order,
           track_id = EXCLUDED.track_id`,
        [row.id, row.name, row.icon || 'fiscal', Number(row.sort_order || 0), row.track_id || 'track_padrao']
      );
      counts.categories += 1;
    }

    // Apply parents only after all categories exist; old backups keep existing parents.
    for (const row of data.categories || []) {
      if (Object.hasOwn(row, 'parent_id')) await client.query('UPDATE categories SET parent_id=$2 WHERE id=$1',[row.id,row.parent_id || null]);
    }
    const categoryRows = (await client.query('SELECT id,parent_id,track_id FROM categories')).rows;
    const categoryMap = new Map(categoryRows.map(row => [row.id,row]));
    for (const category of categoryRows) {
      const seen = new Set([category.id]);
      let parent = categoryMap.get(category.parent_id);
      while (parent) {
        if (seen.has(parent.id) || (parent.track_id || 'track_padrao') !== (category.track_id || 'track_padrao')) throw new Error('Backup contém hierarquia de categorias inválida.');
        seen.add(parent.id); parent = categoryMap.get(parent.parent_id);
      }
    }

    for (const row of data.lessons || []) {
      await client.query(
        `INSERT INTO lessons (id, title, subtitle, category_id, video_url, duration, description, views, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           subtitle = EXCLUDED.subtitle,
           category_id = EXCLUDED.category_id,
           video_url = EXCLUDED.video_url,
           duration = EXCLUDED.duration,
           description = EXCLUDED.description,
           views = EXCLUDED.views,
           sort_order = EXCLUDED.sort_order,
           created_at = COALESCE(EXCLUDED.created_at, lessons.created_at)`,
        [
          row.id,
          row.title,
          row.subtitle || '',
          row.category_id,
          row.video_url,
          row.duration || '',
          row.description || '',
          Number(row.views || 0),
          Number(row.sort_order || 0),
          row.created_at || null,
        ]
      );
      // Legacy backups have no review information; do not invent or erase it.
      if (Object.hasOwn(row, 'reviewed_by_name')) {
        await client.query('UPDATE lessons SET updated_by=$2,reviewed_by_name=$3,updated_at=$4 WHERE id=$1',
          [row.id,row.updated_by || null,row.reviewed_by_name || null,row.updated_at || null]);
      }
      counts.lessons += 1;
    }

    for (const row of data.modules || []) {
      await client.query(
        `INSERT INTO modules (id, titulo, nivel, ordem)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           titulo = EXCLUDED.titulo,
           nivel = EXCLUDED.nivel,
           ordem = EXCLUDED.ordem`,
        [row.id, row.titulo, row.nivel, Number(row.ordem || 0)]
      );
      counts.modules += 1;
    }

    for (const row of data.site_settings || []) {
      if (!SAFE_SITE_SETTINGS.has(row.chave)) continue;
      await client.query(
        `INSERT INTO site_settings (chave, valor)
         VALUES ($1, $2)
         ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
        [row.chave, row.valor]
      );
      counts.site_settings += 1;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    success: true,
    filename,
    contentOnly: true,
    skippedTables: ['users', 'progress', 'user_progress', 'user_track_progress', 'assigned_videos', 'admin_logs'],
    counts,
  };
}

module.exports = {
  latestBackupFilename,
  restoreTrainingContentFromBackup,
};
