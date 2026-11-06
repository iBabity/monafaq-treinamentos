const { Client } = require('pg');

const CONFIG = {
  user: 'postgres',
  host: '127.0.0.1',
  password: process.env.DB_PASSWORD,
  port: 5432,
  database: process.env.DB_NAME || 'monatrainingdatabase'
};

async function migrate() {
  const client = new Client(CONFIG);
  await client.connect();
  console.log('Migrando tabela lessons...');
  await client.query('ALTER TABLE lessons ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;');
  console.log('Coluna sort_order adicionada com sucesso!');
  await client.end();
}

migrate().catch(console.error);
