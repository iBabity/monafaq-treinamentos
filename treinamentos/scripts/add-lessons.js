const { pool } = require('../src/utils/db');

async function addLessons() {
  try {
    // 1. Get category ID for 'Cadastro'
    const catRes = await pool.query("SELECT id FROM categories WHERE name = 'Cadastro'");
    if (catRes.rows.length === 0) {
      console.error("Categoria 'Cadastro' não encontrada.");
      return;
    }
    const catId = catRes.rows[0].id;
    console.log(`ID da Categoria 'Cadastro': ${catId}`);

    // 2. Prepare lessons
    const lessons = [
      {
        title: 'Fornecedores',
        subtitle: 'Gestão de parceiros e fornecedores',
        description: 'Aprenda a realizar o cadastro completo de fornecedores, gerenciar contatos e configurar parâmetros fiscais para compras.',
        video_url: 'https://youtu.be/K1KnR7HHA3Y',
        duration: '10:15'
      },
      {
        title: 'Clientes',
        subtitle: 'Cadastro e gestão de clientes',
        description: 'Tutorial sobre como cadastrar novos clientes, definir limites de crédito e organizar informações para faturamento.',
        video_url: 'https://youtu.be/Ke3NVMaaaco',
        duration: '08:45'
      },
      {
        title: 'Produtos',
        subtitle: 'Configuração de itens e estoque',
        description: 'Nesta aula mostramos como cadastrar produtos, definir NCM, tributação básica e controle de estoque inicial.',
        video_url: 'https://youtu.be/uP0OxM7_cQE',
        duration: '12:30'
      }
    ];

    // 3. Insert lessons
    for (const lesson of lessons) {
      const lessonId = `lesson_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await pool.query(
        'INSERT INTO lessons (id, category_id, title, subtitle, description, video_url, duration, sort_order) VALUES ($1, $2::varchar, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE category_id = $2::varchar))',
        [lessonId, catId, lesson.title, lesson.subtitle, lesson.description, lesson.video_url, lesson.duration]
      );
      console.log(`Lição '${lesson.title}' adicionada com sucesso.`);
      // Delay to avoid same timestamp ID
      await new Promise(r => setTimeout(r, 10));
    }

  } catch (err) {
    console.error('Erro ao adicionar lições:', err);
  } finally {
    await pool.end();
  }
}

addLessons();
