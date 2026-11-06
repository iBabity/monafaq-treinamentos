const { pool } = require('../src/utils/db');

async function init() {
  try {
    console.log('Criando tabela site_settings...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        chave VARCHAR(100) UNIQUE NOT NULL,
        valor TEXT NOT NULL
      );
    `);

    console.log('Inserindo valor padrão para featured_video_url...');
    await pool.query(`
      INSERT INTO site_settings (chave, valor)
      VALUES ('featured_video_url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      ON CONFLICT (chave) DO NOTHING;
    `);

    console.log('Tabela inicializada com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao inicializar tabela:', err);
    process.exit(1);
  }
}

init();
