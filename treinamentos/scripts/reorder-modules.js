const { pool } = require('../src/utils/db');

async function setupModules() {
  const modules = [
    'Apresentação / Cadastros',
    'Cadastro de Produtos',
    'Compras / Faturamento',
    'Financeiro',
    'Fiscal',
    'Contabilidade / Caixa',
    'Operacional / Gerencial',
    'PDV',
    'SincData'
  ];

  try {
    console.log('--- Iniciando reestruturação de módulos ---');

    // 1. Get existing categories to map old data if needed
    // But since we want a fresh list in specific order, we'll just upsert or replace.
    
    // For simplicity, we'll delete and re-insert, but that would break lesson references.
    // Better: Update existing ones if they match by name, or create new ones.
    
    for (let i = 0; i < modules.length; i++) {
      const name = modules[i];
      const id = `cat_${Date.now()}_${i}`;
      
      // Check if a category with similar name exists to preserve lessons
      // (Simplified: we'll just insert if not exists, user can move lessons later or we can do it manually)
      
      // Actually, let's try to find if 'Fiscal' or 'Cadastro' exists and update them
      let existingId = null;
      if (name === 'Fiscal') {
         const res = await pool.query("SELECT id FROM categories WHERE name = 'Fiscal'");
         if (res.rows.length > 0) existingId = res.rows[0].id;
      } else if (name === 'Apresentação / Cadastros') {
         const res = await pool.query("SELECT id FROM categories WHERE name = 'Cadastro'");
         if (res.rows.length > 0) existingId = res.rows[0].id;
      }

      if (existingId) {
        await pool.query(
          "UPDATE categories SET name = $1, sort_order = $2 WHERE id = $3",
          [name, i + 1, existingId]
        );
        console.log(`[ATUALIZADO] ${name} (Ordem: ${i+1})`);
      } else {
        // Check if name already exists exactly
        const exact = await pool.query("SELECT id FROM categories WHERE name = $1", [name]);
        if (exact.rows.length > 0) {
          await pool.query("UPDATE categories SET sort_order = $1 WHERE id = $2", [i + 1, exact.rows[0].id]);
          console.log(`[ORDENADO] ${name} (Ordem: ${i+1})`);
        } else {
          await pool.query(
            "INSERT INTO categories (id, name, sort_order) VALUES ($1, $2, $3)",
            [id, name, i + 1]
          );
          console.log(`[CRIADO] ${name} (Ordem: ${i+1})`);
        }
      }
    }

    console.log('\n--- Reestruturação concluída ---');
  } catch (err) {
    console.error('Erro na migração:', err);
  } finally {
    await pool.end();
  }
}

setupModules();
