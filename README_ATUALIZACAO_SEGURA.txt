STAR SALLERS - ATUALIZAÇÃO SEGURA

Use esta estrutura no GitHub:

index.js
package.json
.env.example
.gitignore
database.example.json
README.md

NÃO envie database.json para o GitHub.
NÃO envie .env para o GitHub.

O database.json guarda as configurações reais dos servidores:
- planos dos servidores
- chave Pix configurada no /painelavancado
- categoria dos carrinhos
- canal de entregas
- produtos
- cupons
- carrinhos
- cancelamentos
- mensagens de entrada e invites

Se você subir database.json vazio no GitHub, pode sobrescrever configurações importantes na hospedagem.

ANTES DE ATUALIZAR:
1. Faça backup do database.json atual da hospedagem.
2. Suba somente index.js e arquivos de código.
3. Reinicie o bot.
4. Teste em um servidor de teste.

O index.js já possui migração segura:
- se surgir um campo novo, ele adiciona sem apagar os antigos;
- se o servidor já tiver configurações, ele mantém as configurações antigas;
- não troca nomes antigos de campos.

Renomeio correto:
index.js fica como index.js mesmo.
.database não deve ser enviado.
Use database.example.json apenas como exemplo.
