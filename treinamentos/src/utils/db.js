const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Carrega o arquivo .env manualmente caso seja executado por um script Node.js standalone
if (!process.env.DB_NAME) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          process.env[key] = value.trim();
        }
      });
    }
  } catch (e) {
    // Silencia qualquer erro ao ler o .env
  }
}

const isProduction = process.env.NODE_ENV === 'production';
const missingRequiredEnv = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD'].filter(
  (key) => !process.env[key]
);

if (isProduction && missingRequiredEnv.length > 0) {
  throw new Error(`Missing required database environment variables: ${missingRequiredEnv.join(', ')}`);
}

const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'monatrainingdatabase',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
};

const pool = new Pool(dbConfig);

module.exports = { pool, dbConfig };

// Inicializa o agendador de backup automático (a cada 2 dias) em segundo plano
setTimeout(() => {
  try {
    const { checkAndRunScheduledBackup } = require('./backupHelper');
    // Executa verificação inicial após a subida do servidor
    checkAndRunScheduledBackup().catch(err => console.error('[Backup Startup Error]:', err));

    // Executa verificação periódica a cada 12 horas
    setInterval(() => {
      checkAndRunScheduledBackup().catch(err => console.error('[Backup Periodic Error]:', err));
    }, 12 * 60 * 60 * 1000);
  } catch (err) {
    console.error('Erro ao registrar agendador de backup:', err);
  }
}, 5000);
