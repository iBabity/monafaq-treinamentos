const { Client } = require('pg');
const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente do .env manualmente se necessário
function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../.env');
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
    console.warn('Aviso ao ler .env:', e.message);
  }
}

async function run() {
  loadEnv();

  const user = process.env.DB_USER || 'postgres';
  const host = process.env.DB_HOST || '127.0.0.1';
  const isProduction = process.env.NODE_ENV === 'production';
  const password = process.env.DB_PASSWORD;
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const database = process.env.DB_NAME || 'monatrainingdatabase';
  const forceReset = process.argv.includes('--reset');
  const allowLocalAdminBootstrap = process.env.TRAINING_ALLOW_LOCAL_ADMIN_BOOTSTRAP === 'true';
  const adminEmail = allowLocalAdminBootstrap
    ? process.env.TRAINING_ADMIN_EMAIL || ''
    : '';
  const adminPassword = allowLocalAdminBootstrap
    ? process.env.TRAINING_ADMIN_PASSWORD || ''
    : '';

  if (isProduction) {
    const missing = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD']
      .filter((key) => !process.env[key]);
    if (missing.length > 0) {
      console.error(`[ERRO]: variáveis obrigatórias ausentes: ${missing.join(', ')}`);
      process.exit(1);
    }
  }

  console.log(`Conectando ao PostgreSQL local em ${host}:${port} como "${user}"...`);

  // 1. Criar banco de dados se não existir
  const defaultClient = new Client({
    user,
    host,
    password,
    port,
    database: 'postgres',
  });

  try {
    await defaultClient.connect();
    console.log('Conectado ao banco padrão "postgres".');
  } catch (err) {
    console.error('\n[ERRO]: Não foi possível conectar ao PostgreSQL local.');
    console.error('Mensagem original:', err.message);
    console.error('\nVerifique se o serviço do PostgreSQL está rodando em sua máquina e se as credenciais no arquivo .env estão corretas.');
    process.exit(1);
  }

  try {
    const dbRes = await defaultClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [database]);
    if (dbRes.rowCount === 0) {
      console.log(`Banco de dados "${database}" não existe. Criando...`);
      await defaultClient.query(`CREATE DATABASE "${database}"`);
      console.log(`Banco de dados "${database}" criado com sucesso.`);
    } else {
      console.log(`Banco de dados "${database}" já existe.`);
    }
  } catch (err) {
    console.error('Erro ao verificar/criar o banco de dados:', err.message);
    await defaultClient.end();
    process.exit(1);
  } finally {
    await defaultClient.end();
  }

  // 2. Conectar ao novo banco de dados e executar o setup SQL
  console.log(`\nConectando ao banco "${database}" para executar a migração...`);
  const dbClient = new Client({
    user,
    host,
    password,
    port,
    database,
  });

  try {
    await dbClient.connect();
    console.log(`Conectado ao banco "${database}".`);
  } catch (err) {
    console.error(`Erro ao conectar ao banco "${database}":`, err.message);
    process.exit(1);
  }

  try {
    const sqlPath = path.resolve(__dirname, 'database_setup.sql');
    console.log(`Lendo script SQL de: ${sqlPath}`);
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    const initializedRes = await dbClient.query(
      "SELECT to_regclass('public.users') AS users_table"
    );
    const shouldInitialize = forceReset || !initializedRes.rows[0]?.users_table;

    if (shouldInitialize) {
      console.log('Executando script de tabelas e sementes...');
      await dbClient.query(sqlContent);
      console.log('Banco de dados estruturado com sucesso!');
    } else {
      console.log('Estrutura existente detectada. Pulando recriação de tabelas.');
    }

    console.log('Garantindo colunas de autenticação do One...');
    await dbClient.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS one_user_id INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS one_business_group_id INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS one_store_id INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS one_context JSONB;

      CREATE UNIQUE INDEX IF NOT EXISTS users_one_user_id_key
      ON users (one_user_id)
      WHERE one_user_id IS NOT NULL;
    `);

    await dbClient.query(fs.readFileSync(path.resolve(__dirname, 'manuals-schema.sql'), 'utf8'));
    await dbClient.query(fs.readFileSync(path.resolve(__dirname, 'learning-schema.sql'), 'utf8'));

    if (adminEmail && adminPassword) {
      console.log(`Garantindo administrador inicial: ${adminEmail}`);
      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPassword = ['scrypt', salt, crypto.scryptSync(adminPassword, salt, 64).toString('hex')].join('$');
      await dbClient.query(
        `INSERT INTO users (id, name, email, password, role, track_id, must_change_password)
         VALUES ($1, $2, $3, $4, 'admin', 'track_padrao', false)
         ON CONFLICT (id) DO NOTHING`,
        ['admin_monalisa', 'Administrador Monalisa', adminEmail.trim().toLowerCase(), hashedPassword]
      );
      await dbClient.query(
        `INSERT INTO user_track_progress (user_id, track_id, progresso_geral)
         VALUES ('admin_monalisa', 'track_padrao', 0)
         ON CONFLICT (user_id, track_id) DO NOTHING`
      );
    }

    const lessonCountRes = await dbClient.query('SELECT COUNT(*)::int AS count FROM lessons');
    if ((lessonCountRes.rows[0]?.count ?? 0) === 0) {
      const seedPath = path.resolve(__dirname, 'training_content_seed.sql');
      console.log(`Banco sem aulas. Aplicando seed de conteúdo: ${seedPath}`);
      await dbClient.query(fs.readFileSync(seedPath, 'utf8'));
    }
  } catch (err) {
    console.error('Erro ao executar o script SQL:', err.message);
    await dbClient.end();
    process.exit(1);
  } finally {
    await dbClient.end();
  }

  console.log('\n=== Configuração local concluída com sucesso! ===');
}

run();
