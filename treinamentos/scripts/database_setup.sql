-- Script de Configuração Inicial do Banco de Dados Monalisa Treinamentos
-- IMPORTANTE: Este script reconstrói toda a estrutura de tabelas necessária para a aplicação.

-- 1. Limpeza de tabelas existentes (se houver) para evitar conflitos de recriação
DROP TABLE IF EXISTS public.admin_logs CASCADE;
DROP TABLE IF EXISTS public.assigned_videos CASCADE;
DROP TABLE IF EXISTS public.user_track_progress CASCADE;
DROP TABLE IF EXISTS public.user_progress CASCADE;
DROP TABLE IF EXISTS public.progress CASCADE;
DROP TABLE IF EXISTS public.modules CASCADE;
DROP TABLE IF EXISTS public.lessons CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.tracks CASCADE;
DROP TABLE IF EXISTS public.site_settings CASCADE;

-- 2. Criação das Tabelas na ordem correta de dependência

-- Tabela de Trilhas (tracks)
CREATE TABLE public.tracks (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    CONSTRAINT tracks_pkey PRIMARY KEY (id),
    CONSTRAINT tracks_name_key UNIQUE (name)
);

-- Tabela de Usuários (users)
CREATE TABLE public.users (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'student'::character varying NOT NULL,
    progresso_geral integer DEFAULT 0,
    display_name text,
    profile_picture text,
    track_id character varying(255),
    must_change_password boolean DEFAULT false,
    one_user_id integer,
    one_business_group_id integer,
    one_store_id integer,
    one_context jsonb,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id)
);

CREATE UNIQUE INDEX users_one_user_id_key
ON public.users (one_user_id)
WHERE one_user_id IS NOT NULL;

-- Tabela de Categorias (categories)
CREATE TABLE public.categories (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    icon character varying(50),
    sort_order integer DEFAULT 0,
    track_id character varying(255),
    CONSTRAINT categories_pkey PRIMARY KEY (id),
    CONSTRAINT categories_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id)
);

-- Tabela de Aulas / Vídeos (lessons)
CREATE TABLE public.lessons (
    id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    subtitle character varying(255),
    category_id character varying(255),
    video_url text NOT NULL,
    duration character varying(50),
    description text,
    views integer DEFAULT 0,
    sort_order integer DEFAULT 0,
    CONSTRAINT lessons_pkey PRIMARY KEY (id),
    CONSTRAINT lessons_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE
);

-- Tabela de Módulos (modules)
CREATE TABLE public.modules (
    id character varying(255) NOT NULL,
    titulo text NOT NULL,
    nivel character varying(50),
    ordem integer DEFAULT 0,
    CONSTRAINT modules_pkey PRIMARY KEY (id),
    CONSTRAINT modules_nivel_check CHECK (((nivel)::text = ANY (ARRAY[('Básico'::character varying)::text, ('Intermediário'::character varying)::text, ('Avançado'::character varying)::text])))
);

-- Tabela de Progresso Legado/Auxiliar (progress)
CREATE TABLE public.progress (
    user_id character varying(255) NOT NULL,
    lesson_id character varying(255) NOT NULL,
    CONSTRAINT progress_pkey PRIMARY KEY (user_id, lesson_id),
    CONSTRAINT progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE,
    CONSTRAINT progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Tabela de Configurações Gerais do Site (site_settings)
CREATE TABLE public.site_settings (
    id SERIAL,
    chave character varying(100) NOT NULL,
    valor text NOT NULL,
    CONSTRAINT site_settings_pkey PRIMARY KEY (id),
    CONSTRAINT site_settings_chave_key UNIQUE (chave)
);

-- Tabela de Progresso de Vídeos Completados (user_progress)
CREATE TABLE public.user_progress (
    user_id character varying(255) NOT NULL,
    video_id character varying(255) NOT NULL,
    completed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    track_id character varying(255),
    CONSTRAINT user_progress_pkey PRIMARY KEY (user_id, video_id)
);

-- Tabela de Progresso Geral por Trilha (user_track_progress)
CREATE TABLE public.user_track_progress (
    user_id character varying(255) NOT NULL,
    track_id character varying(255) NOT NULL,
    progresso_geral integer DEFAULT 0 NOT NULL,
    CONSTRAINT user_track_progress_pkey PRIMARY KEY (user_id, track_id),
    CONSTRAINT user_track_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Tabela de Vídeos Atribuídos Individualmente (assigned_videos)
CREATE TABLE public.assigned_videos (
    id character varying(255) NOT NULL,
    user_id character varying(255),
    youtube_url text NOT NULL,
    titulo character varying(255) NOT NULL,
    descricao text,
    data_atribuicao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    visto boolean DEFAULT false,
    CONSTRAINT assigned_videos_pkey PRIMARY KEY (id),
    CONSTRAINT assigned_videos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Tabela de Logs Administrativos (admin_logs)
CREATE TABLE public.admin_logs (
    id SERIAL,
    acao character varying(255) NOT NULL,
    admin_id character varying(255),
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT admin_logs_pkey PRIMARY KEY (id),
    CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id)
);

-- 3. Inserção de Dados Básicos (Sementes)

-- Inserindo Trilhas Padrão
INSERT INTO public.tracks (id, name) VALUES
('track_padrao', 'Padrão'),
('track_leo', 'Leo'),
('track_suporte', 'Suporte');

-- Conteúdo de treinamento recuperado do backup_2026-07-31_16-07-49.sql.
-- Nao importar usuarios do backup: identidade e permissao vêm do Monalisa One.
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
('id_1779222352348', 'Monalisa Leo - Apresentação', 'fiscal', 10, 'track_leo');

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
('id_1779901015525', 'Nota de Devolução para Fornecedor', '', 'cat_1778243425847_2', 'https://www.youtube.com/watch?v=YP_nFCTkRx8', '2:20', '', 7, 12);

-- Inserindo Configurações Iniciais
INSERT INTO public.site_settings (chave, valor) VALUES
('featured_video_url', 'https://youtu.be/fn6EjvJklps?si=_ake68VpwITcixIP'),
('backup_interval_days', '2');

-- Usuarios locais nao sao semeados por padrao.
-- A identidade vem do One; STAFF do One e mapeado como admin no Treinamentos.
