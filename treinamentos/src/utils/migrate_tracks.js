const { pool } = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Criando tabela tracks...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracks (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE
      )
    `);

    console.log('Inserindo trilhas padrões...');
    // Inserir as trilhas ignorando se já existem
    await client.query(`
      INSERT INTO tracks (id, name) VALUES 
      ('track_padrao', 'Padrão'),
      ('track_leo', 'Leo'),
      ('track_suporte', 'Suporte')
      ON CONFLICT (name) DO NOTHING
    `);

    console.log('Adicionando coluna track_id na tabela users...');
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS track_id VARCHAR(255) REFERENCES tracks(id)
    `);

    console.log('Adicionando coluna track_id na tabela categories...');
    await client.query(`
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS track_id VARCHAR(255) REFERENCES tracks(id)
    `);

    console.log('Definindo trilha Padrão para os registros existentes...');
    // Definir track_id='track_padrao' para usuários existentes que não têm track_id
    await client.query(`
      UPDATE users SET track_id = 'track_padrao' WHERE track_id IS NULL
    `);

    // Definir track_id='track_padrao' para categories existentes que não têm track_id
    await client.query(`
      UPDATE categories SET track_id = 'track_padrao' WHERE track_id IS NULL
    `);

    await client.query('COMMIT');
    console.log('Migração concluída com sucesso!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro na migração:', error);
  } finally {
    client.release();
  }
}

migrate().then(() => process.exit(0)).catch(() => process.exit(1));
