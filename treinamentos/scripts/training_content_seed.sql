-- Conteudo de treinamento recuperado do backup_2026-07-31_16-07-49.sql.
-- Nao importar usuarios do backup: identidade e permissao vêm do Monalisa One.

INSERT INTO public.tracks (id, name) VALUES
('track_padrao', 'Padrão'),
('track_leo', 'Leo'),
('track_suporte', 'Suporte')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.categories (id, name, icon, sort_order, track_id) VALUES
('id_1777993100486', 'Apresentação / Cadastros', 'fiscal', 0, 'track_padrao'),
('cat_1778243425847_2', 'Compras / Faturamento', 'fiscal', 2, 'track_padrao'),
('cat_1778243425847_3', 'Financeiro', 'fiscal', 3, 'track_padrao'),
('id_1777985038065', 'Fiscal', 'fiscal', 4, 'track_padrao'),
('cat_1778243425849_5', 'Contabilidade / Caixa', 'fiscal', 5, 'track_padrao'),
('cat_1778243425849_6', 'Operacional / Gerencial', 'fiscal', 6, 'track_padrao'),
('cat_1778243425850_7', 'PDV', 'fiscal', 7, 'track_padrao'),
('cat_1778243425850_8', 'SincData', 'fiscal', 8, 'track_padrao'),
('id_1778605973761', 'Extra', 'fiscal', 9, 'track_padrao'),
('id_1779222352348', 'Monalisa Leo - Apresentação', 'fiscal', 10, 'track_leo')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  track_id = EXCLUDED.track_id;

INSERT INTO public.lessons (id, title, subtitle, category_id, video_url, duration, description, views, sort_order) VALUES
('id_1779827262991', 'Fechamento de Caixa no Retaguarda', '', 'cat_1778243425849_5', 'https://www.youtube.com/watch?v=FG5RjoUVUjQ', '5:58', '', 2, 8),
('id_1777985096785', 'SPED Fiscal', 'Aprenda como gerar o SPED Fiscal!', 'id_1777985038065', 'https://www.youtube.com/embed/vg5MVtT5SV0?si=u9BygmWldhNT2u2k', '3:14', 'SPED Fiscal é importante', 129, 0),
('id_1777992256613', 'IBS e CBS no Gestores', '', 'id_1777985038065', 'https://www.youtube.com/embed/K1msM9H8brg?si=8s-Mqbz5SGjckDDK', '5:03', 'Saiba como criar e vincular os novos tributos nos produtos!', 77, 13),
('id_1779899901857', 'Vendas no Crediário', '', 'cat_1778243425847_2', 'https://www.youtube.com/watch?v=WnHlPTA2y8o', '2:17', '', 6, 11),
('id_1779827758197', 'Dashboard de Vendas', '', 'cat_1778243425847_2', 'https://www.youtube.com/watch?v=4RfGgF6ij-0', '4:28', '', 7, 10),
('id_1779902041874', 'Correção Inventário : SPED', '', 'id_1778605973761', 'https://www.youtube.com/watch?v=093DpfyVBzg', '5:42', '', 5, 1),
('id_1779902878455', 'Backup com ZIPPLUS', '', 'id_1778605973761', 'https://www.youtube.com/watch?v=OIjjLSLR9HM', '9:09', '', 2, 14),
('id_1778606092625', 'Calculadora de Preços', '', 'cat_1778243425847_3', 'https://www.youtube.com/watch?v=5vkLS-TWaC4', '9:09', 'O que é a calculadora de preços e como usá-la!', 25, 6),
('id_1777995736330', 'Cadastro de Usuários', '', 'id_1777993100486', 'https://www.youtube.com/embed/Djpmq4MQ134?si=QxQPRIWBEBVHXPPT', '11:54', 'Aprenda a cadastrar usuários do sistema!', 247, 2),
('lesson_1778241925654_684', 'Fornecedores', 'Gestão de parceiros e fornecedores', 'id_1777993100486', 'https://youtu.be/K1KnR7HHA3Y', '10:15', 'Aprenda a realizar o cadastro completo de fornecedores, gerenciar contatos e configurar parâmetros fiscais para compras.', 115, 3),
('id_1779714215780', 'Monalisa Apresentação', 'Saíba como podemos ajudar!', 'id_1779222352348', 'https://www.youtube.com/watch?v=fn6EjvJklps', '16:33', '', 5, 7),
('lesson_1778241925677_30', 'Clientes', 'Cadastro e gestão de clientes', 'id_1777993100486', 'https://youtu.be/Ke3NVMaaaco', '08:45', 'Tutorial sobre como cadastrar novos clientes, definir limites de crédito e organizar informações para faturamento.', 76, 4),
('lesson_1778241925697_176', 'Produtos', 'Configuração de itens e estoque', 'id_1777993100486', 'https://youtu.be/uP0OxM7_cQE', '12:30', 'Nesta aula mostramos como cadastrar produtos, definir NCM, tributação básica e controle de estoque inicial.', 61, 5),
('id_1779827578846', 'Orçamento de Vendas', '', 'cat_1778243425847_2', 'https://www.youtube.com/watch?v=xIAvqdyE0Ts', '4:00', '', 12, 9),
('id_1779901015525', 'Nota de Devolução para Fornecedor', '', 'cat_1778243425847_2', 'https://www.youtube.com/watch?v=YP_nFCTkRx8', '2:20', '', 7, 12)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  category_id = EXCLUDED.category_id,
  video_url = EXCLUDED.video_url,
  duration = EXCLUDED.duration,
  description = EXCLUDED.description,
  views = EXCLUDED.views,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.site_settings (chave, valor) VALUES
('featured_video_url', 'https://youtu.be/fn6EjvJklps?si=_ake68VpwITcixIP'),
('backup_interval_days', '2')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
