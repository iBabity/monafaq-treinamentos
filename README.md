# MonaFAQ e Treinamentos

Código do FAQ de suporte e do protótipo local de Treinamentos da Monalisa. O repositório reúne os dois projetos desenvolvidos localmente e serve como ponto de partida para integração e hospedagem próprias.

**Estado do projeto:** protótipo de desenvolvimento. A integração entre os dois serviços usa endereços locais, login de teste e componentes Cloudflare; ainda é necessário revisar autenticação, autorização, integração, migrações e configuração antes de publicar uma instalação em produção. Este repositório não hospeda o site.

- `faq/`: interface e APIs do MonaFAQ, material do manual Gestores e estrutura do calendário de plantões.
- `treinamentos/`: aplicação Next.js, protótipo de login, aulas, permissões e scripts de banco PostgreSQL.

Os bancos de dados, anexos de usuários, credenciais, históricos e responsáveis pelos plantões existentes não acompanham este código. As listas de responsáveis nos exemplos estão vazias. A migração dos dados reais deve ser planejada separadamente e feita com os responsáveis.

## Desenvolvimento

São necessários Node.js 22 ou superior, PostgreSQL e as dependências de cada projeto (instaladas com `npm ci` em cada pasta). Configure as variáveis no ambiente local sem incluí-las no Git: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `TRAINING_SESSION_SECRET`, `FAQ_MASTER_EMAILS` e `FAQ_LOCAL_IDENTITY_SECRET`. O FAQ usa bindings Cloudflare D1/R2 e segredos locais próprios; crie-os e configure-os para o ambiente desejado.

O protótipo de Treinamentos inclui `scripts/run_setup_node.js` para iniciar a estrutura e `scripts/assuntos-compartilhados-local.sql` e `scripts/video-requests-schema.sql` para as funcionalidades locais. Revise cada migração antes de aplicá-la. A criação da primeira conta depende de `TRAINING_ALLOW_LOCAL_ADMIN_BOOTSTRAP`, `TRAINING_ADMIN_EMAIL` e `TRAINING_ADMIN_PASSWORD`; configure o e-mail master também em `FAQ_MASTER_EMAILS`.

O FAQ local usa `treinamentos/teste-interno.cjs` como passagem de autenticação e um serviço local do FAQ. Esses caminhos e suas permissões são específicos do protótipo e precisam ser substituídos ou adaptados para um servidor próprio. Não reutilize credenciais de teste.
