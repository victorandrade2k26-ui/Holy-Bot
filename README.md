# Star Sallers

Bot de vendas semi-automáticas para Discord com planos, produtos, carrinho, Pix, cupons, tickets, verificação, painel avançado e duração de assinatura.

## Arquivos do projeto

- `index.js` — código principal do bot.
- `package.json` — dependências e comando de início.
- `.gitignore` — impede enviar `.env` e banco real para o GitHub.
- `env.example` — exemplo das variáveis de ambiente.
- `database.example.json` — exemplo do banco vazio.
- `data/` — pasta onde o bot salva `database.json` automaticamente.

## Railway

Configure as variáveis em **Variables**:

```env
TOKEN=TOKEN_DO_BOT
CLIENT_ID=ID_DA_APLICACAO
OWNER_ID=SEU_ID_DO_DISCORD
```

Para não perder planos, produtos e configurações ao atualizar o `index.js`, crie um Volume e monte em:

```txt
/app/data
```

O bot vai salvar os dados em:

```txt
/app/data/database.json
```

## Comando de iniciar

```txt
npm start
```
