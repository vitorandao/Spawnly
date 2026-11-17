# Spawnly na Vercel

## Estado
- Frontend: \`frontend/dist\` publicado como site estatico.
- Mapa Java: \`/api/mapa\` (Cubiomes nativo empacotado na funcao).
- CRUD/recomendacoes: \`/api/usuarios\`, \`/api/seeds\`, \`/api/preferencias\`, \`/api/recomendar\` e \`/api/catalogos\` usam o Express existente em Vercel Functions.
- Persistencia: exige banco MySQL/MariaDB **remoto**. A Vercel nao acessa \`127.0.0.1\` do seu computador. O projeto nao inclui um banco embutido persistente na Vercel.

## Banco de dados

Provisione um banco MySQL/MariaDB com acesso de rede para a Vercel. Nao use um servidor local sem configurar rede segura.

Variaveis de ambiente **server-side** no projeto Vercel:
- \`DB_HOST\`: hostname do banco remoto
- \`DB_PORT\`: geralmente 3306
- \`DB_USER\`: usuario com permissoes necessarias
- \`DB_PASSWORD\`: segredo configurado como variavel cifrada
- \`DB_NAME\`: \`spawnly_integracao\`
- \`DB_SSL\`: \`1\` se o fornecedor exigir TLS

Nunca publique os valores reais em GitHub ou no JavaScript do navegador. Para importar os dados iniciais, rode o script de inicializacao **fora da Vercel**, somente em banco vazio, com \`DB_SETUP_CONFIRM=spawnly_integracao\`:

\`node backend/scripts/setup-cloud-database.js\`

O script importa \`database/spawnly_mariadb.sql\` e completa o catalogo de biomas. Ele nao recria/limpa um banco existente.

## Validação
- \`GET /api/mapa?seed=12345&versao=1.21.11&x=0&z=0\` deve retornar 200, 9.216 ids de bioma.
- \`GET /api/status\` deve retornar 200 e \`banco: conectado\` se o banco existir; 503 caso contrario.
- \`GET /api/catalogos\` e \`GET /api/seeds\` devem retornar os dados do banco.
- Fluxo: criar usuario > salvar preferencias > gerar recomendacoes > cadastrar/editar/excluir seed.

## Aviso sobre producao
O backend original e um MVP academico, sem autenticacao ou autorizacao para alteracoes no CRUD. **Nao conecte um banco com dados importantes a um site publico** antes de implementar autenticacao, autorizacao e limitacao de requisicoes. A implantacao inicial deve permanecer em preview e com dados de teste.
