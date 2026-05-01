STAR SALLERS - COMO USAR OS ARQUIVOS

1. Crie uma pasta para o bot.

2. Renomeie os arquivos:
   index.txt       -> index.js
   package.txt     -> package.json
   env.txt         -> .env
   database.txt    -> database.json

3. Preencha o .env:
   TOKEN      = token do bot
   CLIENT_ID  = ID da aplicação/bot
   GUILD_ID   = ID do servidor onde os comandos serão registrados para teste
   OWNER_ID   = seu ID do Discord, ou seja, o dono que poderá usar /setplano

   Exemplo:
   OWNER_ID=123456789012345678

   Se tiver mais de um dono, você pode usar:
   OWNER_IDS=123456789012345678,987654321098765432

4. Abra o terminal na pasta e instale as dependências:
   npm install

5. Inicie o bot:
   npm start

6. Comandos principais mantidos:
   /addproduto
   /editarproduto
   /painel
   /setplano

7. Como dar plano para cada servidor:
   Apenas o ID colocado em OWNER_ID/OWNER_IDS pode usar.

   Exemplos:
   /setplano guild_id:ID_DO_SERVIDOR plano:basic
   /setplano guild_id:ID_DO_SERVIDOR plano:pro
   /setplano guild_id:ID_DO_SERVIDOR plano:ultimate

8. Como funciona a trava dos planos:

   Plano Basic:
   - /addproduto
   - /editarproduto
   - até 10 produtos
   - mensagem de entrada editável
   - logs de vendas preparado

   Plano Pro:
   - tudo do Basic
   - até 50 produtos
   - mensagem de entrada editável
   - mensagem de invites editável
   - cupons preparado
   - suporte prioritário

   Plano Ultimate:
   - tudo do Pro
   - produtos praticamente ilimitados
   - personalização avançada preparada
   - recursos exclusivos conforme atualização

9. No /painel:
   - Abra Personalização
   - Configure Canal Entrada
   - Configure Mensagem Entrada
   - Configure Canal Invites
   - Configure Mensagem Invites

   Observação:
   - Basic pode editar entrada.
   - Pro e Ultimate podem editar entrada e invites.
   - Admin do servidor não consegue mudar o plano pelo painel.
   - O plano só muda pelo comando /setplano usado pelo dono do bot.

10. Variáveis para mensagens:
   {user}      = menciona o usuário
   {user_id}   = ID do usuário
   {server}    = nome do servidor
   {members}   = total de membros
   {invite}    = código do convite usado
   {inviter}   = quem criou o convite
   {uses}      = total de usos do convite

11. Permissões necessárias do bot no Discord:
   Administrator recomendado para evitar erro.

   Ou pelo menos:
   - Ver Canais
   - Enviar Mensagens
   - Gerenciar Servidor, para ler invites
   - Usar Comandos de Aplicativo
   - Ler Histórico de Mensagens

12. Importante:
   Para o sistema de invites funcionar, o bot precisa da permissão Gerenciar Servidor.
