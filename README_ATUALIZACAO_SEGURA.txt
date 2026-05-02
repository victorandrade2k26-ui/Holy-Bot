STAR SALLERS - ATUALIZAÇÃO SEGURA

Este pacote foi preparado para evitar que os planos e produtos sumam quando você atualizar o index.js.

O que mudou:
- O banco agora fica em ./data/database.json.
- No Railway, você deve montar um Volume em /app/data.
- O bot cria a pasta data automaticamente.
- O database.json real não deve ir para o GitHub.

Estrutura recomendada no GitHub:

index.js
package.json
README.md
README_ATUALIZACAO_SEGURA.txt
.gitignore
env.example
database.example.json
data/.gitkeep

NÃO envie para o GitHub:

.env
database.json
data/database.json
node_modules

No Railway:
1. Suba estes arquivos no GitHub.
2. Vá no projeto do Railway.
3. Crie um Volume.
4. Monte o Volume em /app/data.
5. Confira se as variáveis TOKEN, CLIENT_ID e OWNER_ID estão em Variables.
6. Faça deploy.

Importante:
Se você já tem um database.json com produtos/planos antigos, faça backup antes.
Depois coloque esse arquivo dentro da pasta data como data/database.json.
