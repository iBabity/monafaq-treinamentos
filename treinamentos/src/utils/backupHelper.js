const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pool, dbConfig } = require('./db');
const { restoreTrainingContentFromBackup } = require('./trainingContentRestore');

const MAX_BACKUP_UPLOAD_BYTES = 100 * 1024 * 1024;
const TRAINING_BACKUP_COPY_RE = /COPY public\.(tracks|categories|lessons|modules|site_settings) \(/;

async function getBackupDir() {
  try {
    const result = await pool.query(
      "SELECT valor FROM site_settings WHERE chave = 'backup_directory'"
    );
    if (result.rowCount > 0 && result.rows[0].valor.trim()) {
      return result.rows[0].valor.trim();
    }
  } catch (e) {
    console.warn('Erro ao ler diretório de backup do banco de dados:', e.message);
  }

  if (process.platform === 'win32') {
    return path.resolve(process.cwd(), 'backup');
  }
  return '/home/site/backup';
}

function getPgDumpPath() {
  if (process.platform !== 'win32') {
    return 'pg_dump';
  }

  const defaultDir = 'C:\\Program Files\\PostgreSQL';
  if (fs.existsSync(defaultDir)) {
    try {
      const versions = fs.readdirSync(defaultDir);
      // Ordena as versões decrescentemente (ex: 15, 14, 12) para pegar a mais recente
      versions.sort((a, b) => parseFloat(b) - parseFloat(a));
      for (const v of versions) {
        const fullPath = path.join(defaultDir, v, 'bin', 'pg_dump.exe');
        if (fs.existsSync(fullPath)) {
          return `"${fullPath}"`;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler diretório de instalação do PostgreSQL:', e.message);
    }
  }

  return 'pg_dump';
}

function backupTimestamp(date = new Date()) {
  return date.toISOString()
    .replace(/T/, '_')
    .replace(/\..+/, '')
    .replace(/:/g, '-');
}

function uploadedBackupFilename(originalName, backupDir) {
  const baseName = path.basename(String(originalName || '')).replace(/\s+/g, '_');
  const validOriginal = /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sql$/.test(baseName);
  let candidate = validOriginal ? baseName : `backup_${backupTimestamp()}.sql`;
  let attempts = 0;

  while (fs.existsSync(path.join(backupDir, candidate))) {
    attempts += 1;
    candidate = `backup_${backupTimestamp(new Date(Date.now() + attempts * 1000))}.sql`;
  }

  return candidate;
}

async function saveUploadedBackup(originalName, buffer) {
  if (!originalName || !String(originalName).toLowerCase().endsWith('.sql')) {
    throw new Error('Envie um arquivo de backup .sql.');
  }
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Arquivo de backup invalido.');
  }
  if (buffer.length === 0) {
    throw new Error('Arquivo de backup vazio.');
  }
  if (buffer.length > MAX_BACKUP_UPLOAD_BYTES) {
    throw new Error('Arquivo de backup excede o limite de 100 MB.');
  }

  const sql = buffer.toString('utf8');
  if (!TRAINING_BACKUP_COPY_RE.test(sql)) {
    throw new Error('O arquivo nao parece ser um backup valido do Treinamentos.');
  }

  const backupDir = await getBackupDir();
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filename = uploadedBackupFilename(originalName, backupDir);
  const filePath = path.join(backupDir, filename);
  fs.writeFileSync(filePath, buffer, { flag: 'wx' });

  return {
    success: true,
    filename,
    filePath,
    sizeBytes: buffer.length,
    originalName: path.basename(String(originalName)),
  };
}

/**
 * Runs a manual pg_dump backup.
 * Returns a promise resolving to { success: true, filePath, filename }
 */
async function runBackup() {
  const backupDir = await getBackupDir();
  return new Promise((resolve, reject) => {
    try {

      // Ensure directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Create timestamped filename
      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/T/, '_')
        .replace(/\..+/, '')
        .replace(/:/g, '-'); // Windows safe filename
      const filename = `backup_${timestamp}.sql`;
      const filePath = path.join(backupDir, filename);

      // Get pg_dump binary command/path
      const pgDumpBin = getPgDumpPath();

      // Construct pg_dump command
      // We pass the host, port, user, format (plain sql), database, and output file
      const cmd = `${pgDumpBin} -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -F p -d ${dbConfig.database} -f "${filePath}"`;

      // Set environment variable PGPASSWORD to authenticate pg_dump without prompting
      const env = {
        ...process.env,
        PGPASSWORD: dbConfig.password
      };


      exec(cmd, { env }, async (error, stdout, stderr) => {
        if (error) {
          console.error('Backup Exec Error:', error);
          console.error('Backup Stderr:', stderr);
          return reject(new Error(`pg_dump failed: ${stderr || error.message}`));
        }

        try {
          // Save backup time in database
          const nowStr = new Date().toISOString();
          await pool.query(
            "INSERT INTO site_settings (chave, valor) VALUES ('last_backup_time', $1) ON CONFLICT (chave) DO UPDATE SET valor = $1",
            [nowStr]
          );

          resolve({
            success: true,
            filePath,
            filename
          });
        } catch (dbErr) {
          console.error('Failed to update last_backup_time in DB:', dbErr);
          // Still resolve because the file was successfully written
          resolve({
            success: true,
            filePath,
            filename,
            dbWarning: 'Backup file saved, but database state was not updated.'
          });
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function getPsqlPath() {
  if (process.platform !== 'win32') {
    return 'psql';
  }

  const defaultDir = 'C:\\Program Files\\PostgreSQL';
  if (fs.existsSync(defaultDir)) {
    try {
      const versions = fs.readdirSync(defaultDir);
      versions.sort((a, b) => parseFloat(b) - parseFloat(a));
      for (const v of versions) {
        const fullPath = path.join(defaultDir, v, 'bin', 'psql.exe');
        if (fs.existsSync(fullPath)) {
          return `"${fullPath}"`;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler diretório de instalação do PostgreSQL para psql:', e.message);
    }
  }

  return 'psql';
}

async function listBackups() {
  const backupDir = await getBackupDir();

  if (!fs.existsSync(backupDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(backupDir);
    const backupFiles = files
      .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
      .map(f => {
        const fullPath = path.join(backupDir, f);
        const stats = fs.statSync(fullPath);
        return {
          filename: f,
          sizeBytes: stats.size,
          sizeFormatted: (stats.size / 1024).toFixed(1) + ' KB',
          createdAt: stats.mtime.toISOString()
        };
      });

    backupFiles.sort((a, b) => {
      const byName = b.filename.localeCompare(a.filename);
      if (byName !== 0) return byName;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return backupFiles;
  } catch (err) {
    console.error('Erro ao listar arquivos de backup:', err);
    return [];
  }
}

async function restoreBackup(filename) {
  const backupDir = await getBackupDir();
  console.log(`[Backup System] Importando somente conteúdo de treinamento do arquivo: ${filename}`);
  return restoreTrainingContentFromBackup(filename, { backupDir });
}

/**
 * Checks if 2 days have passed since the last backup, and runs it if so.
 */
async function checkAndRunScheduledBackup() {
  try {
    const result = await pool.query(
      "SELECT valor FROM site_settings WHERE chave = 'last_backup_time'"
    );

    // Buscar intervalo de backup customizado (padrão 2 dias)
    const intervalResult = await pool.query(
      "SELECT valor FROM site_settings WHERE chave = 'backup_interval_days'"
    );
    let intervalDays = 2;
    if (intervalResult.rowCount > 0) {
      const parsed = parseInt(intervalResult.rows[0].valor, 10);
      if (!isNaN(parsed) && parsed > 0) {
        intervalDays = parsed;
      }
    }

    let shouldBackup = false;
    const now = new Date();

    if (result.rowCount === 0) {
      // No backup has ever been made
      shouldBackup = true;
    } else {
      const lastBackupDate = new Date(result.rows[0].valor);
      const diffMs = now.getTime() - lastBackupDate.getTime();
      const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

      if (diffMs >= intervalMs) {
        shouldBackup = true;
      }
    }

    if (shouldBackup) {
      console.log('[Backup Scheduler] Starting automated backup...');
      const backupResult = await runBackup();
      console.log('[Backup Scheduler] Automated backup completed successfully:', backupResult.filename);
      return backupResult;
    } else {
      return { success: false, reason: 'Backup recently performed. Skipping.' };
    }
  } catch (err) {
    console.error('[Backup Scheduler] Error checking/running scheduled backup:', err);
    throw err;
  }
}

module.exports = {
  runBackup,
  checkAndRunScheduledBackup,
  listBackups,
  restoreBackup,
  getBackupDir,
  saveUploadedBackup,
  MAX_BACKUP_UPLOAD_BYTES
};

