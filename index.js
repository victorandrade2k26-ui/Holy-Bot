/*
  Star Applications Bot - discord.js v14
  Powered by: @00yvn
  Proprietário(a): @29nsb
  Star Applications: https://discord.gg/starapplications

  Instalação:
  npm init -y
  npm install discord.js @discordjs/voice dotenv

  Variáveis no .env:
  TOKEN=SEU_TOKEN_DO_BOT
  CLIENT_ID=ID_DA_APLICACAO_DO_BOT

  Importante:
  - Convide o bot com os scopes: bot + applications.commands
  - Permissões recomendadas: Administrator, ou pelo menos gerenciar canais, cargos, mensagens e enviar mensagens.
*/

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  ActivityType,
} = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

const TOKEN = process.env.TOKEN || 'COLOQUE_SEU_TOKEN_AQUI';
const CLIENT_ID = process.env.CLIENT_ID || 'COLOQUE_O_CLIENT_ID_AQUI';
// Opcional: coloque o ID do seu servidor para os comandos aparecerem imediatamente nesse servidor.
// Os comandos globais/universais continuam sendo registrados normalmente.
const GUILD_ID = process.env.GUILD_ID || '';
const OWNER_IDS = String(process.env.OWNER_ID || process.env.OWNER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const BRAND = {
  powered: 'Powered by: @00yvn',
  owner: 'Proprietário(a): @29nsb',
  invite: "`Star Applications`: https://discord.gg/starapplications",
  footer: "Star Applications - Total direitos reservados.",
  defaultColor: 0x2b6cff,
  black: 0x0d0d0d,
};

const COLOR_PRESETS = {
  azul: 0x2b6cff,
  preto: 0x0d0d0d,
  roxo: 0x9b59b6,
  ciano: 0x3498db,
  vermelho: 0xe74c3c,
  verde: 0x2ecc71,
  amarelo: 0xf1c40f,
  branco: 0xffffff,
};

const DB_PATH = path.join(__dirname, 'database.json');

const DEFAULT_DB = {
  guilds: {},
};

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

let db = loadDB();

function saveDB() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}


const PLAN_LEVELS = {
  cancelado: 0,
  basic: 1,
  pro: 2,
  ultimate: 3,
};

const PLANOS = {
  cancelado: {
    nome: 'Plano Cancelado',
    emoji: '⛔',
    maxProdutos: 0,
    cupons: false,
    tickets: false,
    verificacao: false,
    mensagens: false,
  },
  basic: {
    nome: 'Plano Basic',
    emoji: '🥉',
    maxProdutos: 10,
    cupons: false,
    tickets: true,
    verificacao: false,
    mensagens: true,
  },
  pro: {
    nome: 'Plano Pro',
    emoji: '🥈',
    maxProdutos: 50,
    cupons: true,
    tickets: true,
    verificacao: true,
    mensagens: true,
  },
  ultimate: {
    nome: 'Plano Ultimate',
    emoji: '🥇',
    maxProdutos: 9999,
    cupons: true,
    tickets: true,
    verificacao: true,
    mensagens: true,
  },
};

function isBotOwner(userId) {
  return OWNER_IDS.includes(userId);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function formatDateBR(value) {
  if (!value) return 'Não definido';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data inválida';
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function getDaysRemaining(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getPlanoKey(guildId) {
  const g = guildDB(guildId);
  const plano = g.config.plano || 'basic';
  const venceEm = g.config.assinatura?.venceEm;

  if (plano !== 'cancelado' && venceEm) {
    const vencimento = new Date(venceEm);
    if (!Number.isNaN(vencimento.getTime()) && vencimento.getTime() < Date.now()) {
      g.config.plano = 'cancelado';
      g.config.cancelamento = {
        ativo: true,
        motivo: 'Assinatura vencida automaticamente',
        canceladoPor: client?.user?.id || null,
        canceladoEm: new Date().toISOString(),
      };
      g.config.assinatura.status = 'vencida';
      saveDB();
      return 'cancelado';
    }
  }

  return PLANOS[plano] ? plano : 'basic';
}

function getPlano(guildId) {
  return PLANOS[getPlanoKey(guildId)] || PLANOS.basic;
}

function hasPlan(guildId, requiredPlan) {
  const current = PLAN_LEVELS[getPlanoKey(guildId)] ?? 1;
  const required = PLAN_LEVELS[requiredPlan] ?? 1;
  return current >= required;
}

function getRequiredPlanForCommand(commandName) {
  const required = {
    ajuda: 'cancelado',
    verplano: 'cancelado',
    painel: 'basic',
    painelavancado: 'basic',
    addproduto: 'basic',
    produtos: 'basic',
    editarproduto: 'basic',
    painelproduto: 'basic',
    addpainelproduto: 'basic',
    chavepix: 'basic',
    join: 'basic',
    mensagemdm: 'basic',
    mensagemservidor: 'basic',
    limpar: 'basic',
    bloquear: 'basic',
    desbloquear: 'basic',
    painelticket: 'basic',
    addticket: 'basic',
    addcupom: 'pro',
    cupons: 'pro',
    painelverificacao: 'pro',
    painelverificar: 'pro',
  };
  return required[commandName] || 'basic';
}

function setGuildPlan(guildId, plano, duracaoDias = 30, userId = null) {
  if (!['basic', 'pro', 'ultimate'].includes(plano)) throw new Error('Plano inválido. Use basic, pro ou ultimate.');
  const dias = Math.max(1, Math.min(3650, Number(duracaoDias || 30)));
  const g = guildDB(guildId);
  g.config.plano = plano;
  g.config.assinatura = {
    status: 'ativa',
    iniciadoEm: new Date().toISOString(),
    venceEm: addDays(new Date(), dias).toISOString(),
    duracaoDias: dias,
    definidoPor: userId,
    ultimoAvisoDias: null,
  };
  g.config.cancelamento = { ativo: false, motivo: null, canceladoPor: null, canceladoEm: null };
  saveDB();
  return g.config;
}

function cancelGuildPlan(guildId, motivo, userId) {
  const g = guildDB(guildId);
  g.config.plano = 'cancelado';
  g.config.cancelamento = {
    ativo: true,
    motivo: motivo || 'Não informado',
    canceladoPor: userId || null,
    canceladoEm: new Date().toISOString(),
  };
  g.config.assinatura = g.config.assinatura || {};
  g.config.assinatura.status = 'cancelado';
  saveDB();
  return g.config;
}

function planStatusText(guildId) {
  const g = guildDB(guildId);
  const plano = getPlano(guildId);
  const venceEm = g.config.assinatura?.venceEm;
  const dias = getDaysRemaining(venceEm);
  let status = 'Sem vencimento configurado';
  if (getPlanoKey(guildId) === 'cancelado') status = `Cancelado: ${g.config.cancelamento?.motivo || 'sem motivo informado'}`;
  else if (dias !== null) status = dias < 0 ? `Vencido há ${Math.abs(dias)} dia(s)` : dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia(s)`;
  return `${plano.emoji} ${plano.nome}\nStatus: ${status}\nVencimento: ${formatDateBR(venceEm)}`;
}

function guildDB(guildId) {
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = {
      config: {
        adminRoleId: null,
        pixKey: 'Chave Pix não configurada.',
        storeName: "Star Applications",
        mainColor: BRAND.defaultColor,
        inviteLogChannelId: null,
        welcomeChannelId: null,
        inviteMessage: 'Bem-vindo(a) {user}! Você entrou usando um convite do servidor.',
        welcomeMessage: 'Bem-vindo(a) {user} à {server}!',
        restockChannelId: null,
        verifiedRoleId: null,
        plano: 'basic',
        assinatura: { status: 'ativa', iniciadoEm: null, venceEm: null, duracaoDias: null, definidoPor: null, ultimoAvisoDias: null },
        cancelamento: { ativo: false, motivo: null, canceladoPor: null, canceladoEm: null },
        planNoticeChannelId: null,
      },
      products: {},
      coupons: {},
      productPanels: {},
      ticketPanels: {},
      verificationPanels: {},
      purchases: {},
      carts: {},
      tickets: {},
    };
    saveDB();
  }
  return db.guilds[guildId];
}

function isAdmin(member, guildId) {
  const g = guildDB(guildId);
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (g.config.adminRoleId && member.roles.cache.has(g.config.adminRoleId)) return true;
  return false;
}

function requireAdmin(interaction) {
  if (!isAdmin(interaction.member, interaction.guildId)) {
    interaction.reply({ content: '❌ Você precisa do cargo de administrador configurado no `/painel`.', ephemeral: true });
    return false;
  }
  return true;
}

function brandEmbed(guildId, title, description) {
  const g = guildDB(guildId);
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(`${description || ''}\n\n${BRAND.powered}\n${BRAND.owner}\n${BRAND.invite}`)
    .setColor(g.config.mainColor || BRAND.defaultColor)
    .setFooter({ text: BRAND.footer })
    .setTimestamp();
}

function productEmbed(guildId, product) {
  const embed = brandEmbed(
    guildId,
    product.title || product.name || 'Produto',
    product.message || 'Produto disponível para compra.'
  )
    .addFields(
      { name: '📦 Produto', value: product.name || 'Sem nome', inline: true },
      { name: '💸 Preço', value: `R$ ${Number(product.price || 0).toFixed(2)}`, inline: true },
      { name: '📊 Estoque', value: `${product.stock || 0}`, inline: true }
    )
    .setColor(product.color || guildDB(guildId).config.mainColor || BRAND.defaultColor);
  if (product.image) embed.setImage(product.image);
  return embed;
}

function couponEmbed(guildId, coupon) {
  const embed = brandEmbed(guildId, coupon.title || coupon.name || 'Cupom', coupon.message || 'Cupom configurado.')
    .addFields(
      { name: '🏷️ Código', value: coupon.code || 'Sem código', inline: true },
      { name: '🎁 Desconto', value: `${coupon.percent || 0}%`, inline: true }
    )
    .setColor(coupon.color || guildDB(guildId).config.mainColor || BRAND.defaultColor);
  if (coupon.image) embed.setImage(coupon.image);
  return embed;
}

function colorSelect(customId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder('Selecione uma cor padrão')
      .addOptions(Object.keys(COLOR_PRESETS).map((name) => ({
        label: name[0].toUpperCase() + name.slice(1),
        value: name,
        description: `Cor ${name}`,
      })))
  );
}

function chunkRows(components) {
  const rows = [];
  for (let i = 0; i < components.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(...components.slice(i, i + 5)));
  }
  return rows;
}

function configPanelButtons(type, id = 'main') {
  const prefix = `${type}:${id}`;
  const buttons = [
    new ButtonBuilder().setCustomId(`${prefix}:channel`).setLabel('Canal').setStyle(ButtonStyle.Secondary).setEmoji('📺'),
    new ButtonBuilder().setCustomId(`${prefix}:message`).setLabel('Mensagem').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
    new ButtonBuilder().setCustomId(`${prefix}:color`).setLabel('Cor').setStyle(ButtonStyle.Secondary).setEmoji('🎨'),
    new ButtonBuilder().setCustomId(`${prefix}:image`).setLabel('Imagem').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
    new ButtonBuilder().setCustomId(`${prefix}:title`).setLabel('Título').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
    new ButtonBuilder().setCustomId(`${prefix}:publish`).setLabel('Publicar painel').setStyle(ButtonStyle.Success).setEmoji('✅'),
  ];
  return chunkRows(buttons);
}

function productConfigRows(productId) {
  const prefix = `productcfg:${productId}`;
  const buttons = [
    new ButtonBuilder().setCustomId(`${prefix}:channel`).setLabel('Canal').setStyle(ButtonStyle.Secondary).setEmoji('📺'),
    new ButtonBuilder().setCustomId(`${prefix}:message`).setLabel('Mensagem').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
    new ButtonBuilder().setCustomId(`${prefix}:color`).setLabel('Cor').setStyle(ButtonStyle.Secondary).setEmoji('🎨'),
    new ButtonBuilder().setCustomId(`${prefix}:image`).setLabel('Imagem').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
    new ButtonBuilder().setCustomId(`${prefix}:name`).setLabel('Nome do produto').setStyle(ButtonStyle.Secondary).setEmoji('📦'),
    new ButtonBuilder().setCustomId(`${prefix}:title`).setLabel('Título').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
    new ButtonBuilder().setCustomId(`${prefix}:stock`).setLabel('Estoque').setStyle(ButtonStyle.Secondary).setEmoji('📊'),
    new ButtonBuilder().setCustomId(`${prefix}:price`).setLabel('Preço').setStyle(ButtonStyle.Secondary).setEmoji('💸'),
    new ButtonBuilder().setCustomId(`${prefix}:publish`).setLabel('Publicar produto').setStyle(ButtonStyle.Success).setEmoji('✅'),
  ];
  return chunkRows(buttons);
}

function dashboardRows() {
  const buttons = [
    new ButtonBuilder().setCustomId('panel:adminRole').setLabel('Cargo Administrador').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
    new ButtonBuilder().setCustomId('panel:pixKey').setLabel('Chave Pix').setStyle(ButtonStyle.Secondary).setEmoji('💠'),
    new ButtonBuilder().setCustomId('panel:storeName').setLabel('Nome da loja').setStyle(ButtonStyle.Secondary).setEmoji('🏪'),
    new ButtonBuilder().setCustomId('panel:mainColor').setLabel('Cor principal').setStyle(ButtonStyle.Secondary).setEmoji('🎨'),
    new ButtonBuilder().setCustomId('panel:inviteChannel').setLabel('Canal de convites').setStyle(ButtonStyle.Secondary).setEmoji('📨'),
    new ButtonBuilder().setCustomId('panel:welcomeChannel').setLabel('Canal boas-vindas').setStyle(ButtonStyle.Secondary).setEmoji('👋'),
    new ButtonBuilder().setCustomId('panel:inviteMsg').setLabel('Mensagem de convites').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
    new ButtonBuilder().setCustomId('panel:welcomeMsg').setLabel('Mensagem boas-vindas').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
    new ButtonBuilder().setCustomId('panel:pending').setLabel('Compras pendentes').setStyle(ButtonStyle.Primary).setEmoji('🛒'),
    new ButtonBuilder().setCustomId('panel:restockChannel').setLabel('Canal reestoque').setStyle(ButtonStyle.Secondary).setEmoji('📢'),
    new ButtonBuilder().setCustomId('panel:verifiedRole').setLabel('Cargo verificado').setStyle(ButtonStyle.Secondary).setEmoji('✅'),
  ];
  return chunkRows(buttons);
}

function makeModal(customId, title, label, style = TextInputStyle.Short, required = true, placeholder = '') {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('value')
          .setLabel(label)
          .setStyle(style)
          .setRequired(required)
          .setPlaceholder(placeholder)
      )
    );
}

function productSelect(guildId, customId, placeholder = 'Selecione um produto') {
  const products = Object.values(guildDB(guildId).products);
  if (!products.length) return null;
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(products.slice(0, 25).map((p) => ({
        label: (p.name || 'Produto').slice(0, 100),
        value: p.id,
        description: `R$ ${Number(p.price || 0).toFixed(2)} | Estoque: ${p.stock || 0}`.slice(0, 100),
      })))
  );
}

function couponSelect(guildId, customId, placeholder = 'Selecione um cupom') {
  const coupons = Object.values(guildDB(guildId).coupons);
  if (!coupons.length) return null;
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(coupons.slice(0, 25).map((c) => ({
        label: (c.name || c.code || 'Cupom').slice(0, 100),
        value: c.id,
        description: `${c.code || 'sem-codigo'} | ${c.percent || 0}%`.slice(0, 100),
      })))
  );
}

function userPurchasesSelect(guildId, userId) {
  const purchases = Object.values(guildDB(guildId).purchases).filter((p) => p.userId === userId);
  if (!purchases.length) return null;
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket:relatedPurchase')
      .setPlaceholder('Selecione a compra relacionada ao ticket')
      .addOptions(purchases.slice(0, 25).map((p) => ({
        label: `${p.productName || 'Produto'} - R$ ${Number(p.total || 0).toFixed(2)}`.slice(0, 100),
        value: p.id,
        description: `Status: ${p.status || 'pendente'}`.slice(0, 100),
      })))
  );
}

const commands = [
  new SlashCommandBuilder().setName('ajuda').setDescription('Mostra todos os comandos ativos do bot.'),
  new SlashCommandBuilder().setName('addproduto').setDescription('Cria/configura um produto.'),
  new SlashCommandBuilder().setName('painelticket').setDescription('Cria/configura um painel de tickets.'),
  new SlashCommandBuilder().setName('painel').setDescription('Abre o painel principal de configuração do servidor.'),
  new SlashCommandBuilder().setName('painelproduto').setDescription('Cria/configura um painel de produtos.'),
  new SlashCommandBuilder().setName('chavepix').setDescription('Envia manualmente a chave Pix cadastrada.'),
  new SlashCommandBuilder().setName('join').setDescription('Faz o bot entrar em um canal de voz selecionado.'),
  new SlashCommandBuilder().setName('mensagemdm').setDescription('Painel para enviar mensagem por DM.'),
  new SlashCommandBuilder().setName('mensagemservidor').setDescription('Painel para enviar mensagem em canal do servidor.'),
  new SlashCommandBuilder().setName('limpar').setDescription('Apaga mensagens recentes do canal.'),
  new SlashCommandBuilder().setName('bloquear').setDescription('Bloqueia o canal para everyone.'),
  new SlashCommandBuilder().setName('desbloquear').setDescription('Desbloqueia o canal para everyone.'),
  new SlashCommandBuilder().setName('produtos').setDescription('Abre o painel de edição dos produtos.'),
  new SlashCommandBuilder().setName('addcupom').setDescription('Cria/configura um cupom.'),
  new SlashCommandBuilder().setName('cupons').setDescription('Abre o painel de edição dos cupons.'),
  new SlashCommandBuilder().setName('painelverificacao').setDescription('Cria/configura um painel de verificação.'),
  new SlashCommandBuilder().setName('painelavancado').setDescription('Abre o painel avançado da Star Applications.'),
  new SlashCommandBuilder().setName('addpainelproduto').setDescription('Cria/configura um painel de produtos.'),
  new SlashCommandBuilder().setName('editarproduto').setDescription('Edita um produto existente pelo menu.'),
  new SlashCommandBuilder().setName('painelverificar').setDescription('Cria/configura um painel de verificação.'),
  new SlashCommandBuilder().setName('addticket').setDescription('Cria/configura um painel de tickets.'),
  new SlashCommandBuilder().setName('verplano').setDescription('Mostra as informações do plano deste servidor.'),
  new SlashCommandBuilder()
    .setName('setplano')
    .setDescription('Define o plano de um servidor. Apenas o dono do bot pode usar.')
    .addStringOption((option) => option.setName('guild_id').setDescription('ID do servidor que receberá o plano').setRequired(true))
    .addStringOption((option) => option.setName('plano').setDescription('Plano que será aplicado').setRequired(true).addChoices(
      { name: 'Plano Basic', value: 'basic' },
      { name: 'Plano Pro', value: 'pro' },
      { name: 'Plano Ultimate', value: 'ultimate' },
    ))
    .addIntegerOption((option) => option.setName('dias').setDescription('Duração da assinatura em dias').setRequired(false).setMinValue(1).setMaxValue(3650)),
  new SlashCommandBuilder()
    .setName('cancelarplano')
    .setDescription('Cancela o plano de um servidor. Apenas o dono do bot pode usar.')
    .addStringOption((option) => option.setName('guild_id').setDescription('ID do servidor que terá o plano cancelado').setRequired(true))
    .addStringOption((option) => option.setName('motivo').setDescription('Motivo do cancelamento').setRequired(false)),
].map((cmd) => cmd.toJSON());

async function registerCommands() {
  if (!TOKEN || TOKEN.includes('COLOQUE') || !CLIENT_ID || CLIENT_ID.includes('COLOQUE')) {
    console.log('Configure TOKEN e CLIENT_ID no .env antes de iniciar.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  // Registro universal/global: aparece em todos os servidores onde o bot está.
  // Pode demorar para aparecer no Discord.
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log('✅ Comandos globais/universais registrados/atualizados.');

  // Registro opcional no servidor: aparece quase na hora no servidor informado.
  // Isso NÃO remove os comandos universais; serve só para você testar/ver mais rápido.
  if (GUILD_ID && !GUILD_ID.includes('COLOQUE')) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log(`✅ Comandos também registrados no servidor ${GUILD_ID}.`);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

client.once('ready', () => {
  console.log(`Online como ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'Star Applications ⭐', type: ActivityType.Watching }],
    status: 'online',
  });
  checkPlanExpirations().catch(console.error);
  setInterval(() => checkPlanExpirations().catch(console.error), 1000 * 60 * 60 * 6);
});

client.on('guildMemberAdd', async (member) => {
  const g = guildDB(member.guild.id);
  try {
    if (g.config.welcomeChannelId) {
      const ch = member.guild.channels.cache.get(g.config.welcomeChannelId);
      if (ch) ch.send(g.config.welcomeMessage.replaceAll('{user}', `${member}`).replaceAll('{server}', member.guild.name));
    }
    if (g.config.inviteLogChannelId) {
      const ch = member.guild.channels.cache.get(g.config.inviteLogChannelId);
      if (ch) ch.send(g.config.inviteMessage.replaceAll('{user}', `${member}`).replaceAll('{server}', member.guild.name));
    }
  } catch (e) {
    console.error('Erro no guildMemberAdd:', e);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guildId) return;
    guildDB(interaction.guildId);

    if (interaction.isChatInputCommand()) return handleCommand(interaction);
    if (interaction.isButton()) return handleButton(interaction);
    if (interaction.isStringSelectMenu()) return handleStringSelect(interaction);
    if (interaction.isChannelSelectMenu()) return handleChannelSelect(interaction);
    if (interaction.isRoleSelectMenu()) return handleRoleSelect(interaction);
    if (interaction.isUserSelectMenu()) return handleUserSelect(interaction);
    if (interaction.isModalSubmit()) return handleModal(interaction);
  } catch (error) {
    console.error('Erro em interactionCreate:', error);
    const msg = { content: '❌ Ocorreu um erro ao executar essa ação.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(msg).catch(() => null);
    else await interaction.reply(msg).catch(() => null);
  }
});

async function handleCommand(interaction) {
  const g = guildDB(interaction.guildId);
  const originalName = interaction.commandName;
  let name = originalName;

  if (name === 'setplano') return handleSetPlano(interaction);
  if (name === 'cancelarplano') return handleCancelarPlano(interaction);
  if (name === 'verplano') return handleVerPlano(interaction);

  const aliasMap = {
    addpainelproduto: 'painelproduto',
    editarproduto: 'produtos',
    painelverificar: 'painelverificacao',
    addticket: 'painelticket',
  };
  name = aliasMap[name] || name;

  const requiredPlan = getRequiredPlanForCommand(originalName);
  if (!hasPlan(interaction.guildId, requiredPlan)) {
    const atual = getPlano(interaction.guildId);
    const necessario = PLANOS[requiredPlan];
    const cancelado = getPlanoKey(interaction.guildId) === 'cancelado';
    return interaction.reply({
      content: cancelado
        ? `❌ A assinatura deste servidor está cancelada.\nMotivo: ${g.config.cancelamento?.motivo || 'não informado'}\n\nEntre em contato com a Star Applications para reativar.`
        : `❌ Este comando pertence ao ${necessario.nome}.\nSeu servidor está no ${atual.nome}. Faça upgrade para usar.`,
      ephemeral: true,
    });
  }

  if (['addproduto', 'painelticket', 'painel', 'painelproduto', 'chavepix', 'produtos', 'addcupom', 'cupons', 'painelverificacao', 'painelavancado'].includes(name)) {
    if (!requireAdmin(interaction)) return;
  }

  if (name === 'ajuda') {
    const embed = brandEmbed(interaction.guildId, '📘 Ajuda - Comandos ativos', [
      '`/ajuda` Mostra todos os comandos.',
      '`/painel` Configura o servidor.',
      '`/addproduto` Cria produto.',
      '`/produtos` Edita produtos.',
      '`/painelproduto` Cria painel com produtos.',
      '`/addcupom` Cria cupom.',
      '`/cupons` Edita cupons.',
      '`/painelticket` Cria painel de tickets.',
      '`/painelverificacao` Cria painel de verificação.',
      '`/chavepix` Mostra chave Pix.',
      '`/join` Entra em canal de voz.',
      '`/mensagemdm` Envia DM personalizada.',
      '`/mensagemservidor` Envia embed em canal.',
      '`/limpar` Limpa mensagens recentes.',
      '`/bloquear` Bloqueia o canal.',
      '`/desbloquear` Desbloqueia o canal.',
    ].join('\n'));
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }


  if (name === 'painelavancado') {
    const plano = getPlano(interaction.guildId);
    const productsCount = Object.keys(g.products || {}).length;
    const couponsCount = Object.keys(g.coupons || {}).length;
    const pendingCount = Object.values(g.carts || {}).filter((c) => ['pagamento_enviado', 'pagamento_confirmado'].includes(c.status)).length;

    const embed = brandEmbed(interaction.guildId, '⭐ Painel Avançado Star Applications',
      `**Plano atual:** ${plano.emoji} ${plano.nome}
` +
      `**Status:** ${planStatusText(interaction.guildId)}

` +
      `**Produtos:** ${productsCount}/${plano.maxProdutos}
` +
      `**Cupons:** ${couponsCount}
` +
      `**Compras pendentes:** ${pendingCount}

` +
      `Use os comandos /painel, /produtos, /cupons, /painelticket e /painelverificacao para gerenciar a loja.`
    );

    return interaction.reply({ embeds: [embed], components: dashboardRows(), ephemeral: true });
  }

  if (name === 'painel') {
    const embed = brandEmbed(interaction.guildId, '⚙️ Painel Star Applications', 'Configure o servidor usando os botões abaixo.');
    embed.addFields(
      { name: '🛡️ Cargo admin', value: g.config.adminRoleId ? `<@&${g.config.adminRoleId}>` : 'Não configurado', inline: true },
      { name: '🏪 Loja', value: g.config.storeName || "Star Applications", inline: true },
      { name: '💠 Pix', value: g.config.pixKey || 'Não configurado', inline: false }
    );
    return interaction.reply({ embeds: [embed], components: dashboardRows(), ephemeral: true });
  }

  if (name === 'addproduto') {
    const plano = getPlano(interaction.guildId);
    if (Object.keys(g.products || {}).length >= plano.maxProdutos) {
      return interaction.reply({ content: `❌ Seu plano permite até ${plano.maxProdutos} produto(s). Faça upgrade para adicionar mais.`, ephemeral: true });
    }
    const id = uid('prod');
    g.products[id] = {
      id,
      channelId: null,
      message: 'Clique no botão abaixo para comprar este produto.',
      color: g.config.mainColor || BRAND.defaultColor,
      image: null,
      name: 'Novo Produto',
      title: 'Produto Star Applications',
      stock: 0,
      price: 0,
      createdAt: Date.now(),
    };
    saveDB();
    return interaction.reply({
      embeds: [productEmbed(interaction.guildId, g.products[id]).setTitle('📦 Configurar Produto')],
      components: productConfigRows(id),
      ephemeral: true,
    });
  }

  if (name === 'painelticket') {
    const id = uid('ticketpanel');
    g.ticketPanels[id] = {
      id,
      channelId: null,
      title: 'Atendimento Star Applications',
      message: 'Abra um ticket para falar com nossa equipe.',
      color: g.config.mainColor || BRAND.defaultColor,
      image: null,
      buttons: ['Abrir Ticket'],
    };
    saveDB();
    const embed = brandEmbed(interaction.guildId, '🎫 Configurar Painel de Tickets', 'Configure e publique o painel de tickets.').setColor(g.ticketPanels[id].color);
    return interaction.reply({
      embeds: [embed],
      components: [
        ...configPanelButtons('ticketcfg', id),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticketcfg:${id}:buttons`).setLabel('Botões do painel').setStyle(ButtonStyle.Primary).setEmoji('🔘')),
      ],
      ephemeral: true,
    });
  }

  if (name === 'painelproduto') {
    const id = uid('prodpanel');
    g.productPanels[id] = {
      id,
      channelId: null,
      title: 'Produtos Star Applications',
      message: 'Selecione um produto para comprar.',
      color: g.config.mainColor || BRAND.defaultColor,
      image: null,
      productIds: [],
    };
    saveDB();
    const extra = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`prodpanelcfg:${id}:products`).setLabel('Produtos do painel').setStyle(ButtonStyle.Primary).setEmoji('📦')
    );
    return interaction.reply({
      embeds: [brandEmbed(interaction.guildId, '🛍️ Configurar Painel de Produtos', 'Configure o painel e escolha os produtos que aparecerão.')],
      components: [...configPanelButtons('prodpanelcfg', id), extra],
      ephemeral: true,
    });
  }

  if (name === 'chavepix') {
    return interaction.reply({ embeds: [brandEmbed(interaction.guildId, '💠 Chave Pix', `Chave Pix cadastrada:\n\n\`${g.config.pixKey || 'Não configurada'}\``)] });
  }

  if (name === 'join') {
    const voiceChannels = interaction.guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice);
    if (!voiceChannels.size) return interaction.reply({ content: '❌ Nenhum canal de voz encontrado.', ephemeral: true });
    return interaction.reply({
      content: 'Selecione o canal de voz para o bot entrar:',
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('voice:join')
          .setPlaceholder('Canal de voz')
          .addOptions(voiceChannels.first(25).map((c) => ({ label: c.name, value: c.id })))
      )],
      ephemeral: true,
    });
  }

  if (name === 'mensagemdm') {
    return interaction.reply({
      embeds: [brandEmbed(interaction.guildId, '📩 Mensagem DM', 'Configure a DM personalizada.')],
      components: chunkRows([
        new ButtonBuilder().setCustomId('dm:user').setLabel('Membro/Todos').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
        new ButtonBuilder().setCustomId('dm:message').setLabel('Mensagem').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
        new ButtonBuilder().setCustomId('dm:color').setLabel('Cor').setStyle(ButtonStyle.Secondary).setEmoji('🎨'),
        new ButtonBuilder().setCustomId('dm:image').setLabel('Imagem').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
        new ButtonBuilder().setCustomId('dm:title').setLabel('Título').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
        new ButtonBuilder().setCustomId('dm:send').setLabel('Enviar DM').setStyle(ButtonStyle.Success).setEmoji('✅'),
      ]),
      ephemeral: true,
    });
  }

  if (name === 'mensagemservidor') {
    return interaction.reply({
      embeds: [brandEmbed(interaction.guildId, '📢 Mensagem no Servidor', 'Configure a embed que será enviada em um canal.')],
      components: chunkRows([
        new ButtonBuilder().setCustomId('srvmsg:channel').setLabel('Canal').setStyle(ButtonStyle.Secondary).setEmoji('📺'),
        new ButtonBuilder().setCustomId('srvmsg:message').setLabel('Mensagem').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
        new ButtonBuilder().setCustomId('srvmsg:color').setLabel('Cor').setStyle(ButtonStyle.Secondary).setEmoji('🎨'),
        new ButtonBuilder().setCustomId('srvmsg:image').setLabel('Imagem').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
        new ButtonBuilder().setCustomId('srvmsg:title').setLabel('Título').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
        new ButtonBuilder().setCustomId('srvmsg:send').setLabel('Enviar').setStyle(ButtonStyle.Success).setEmoji('✅'),
      ]),
      ephemeral: true,
    });
  }

  if (name === 'limpar') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: '❌ Você precisa da permissão Gerenciar Mensagens.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const deleted = await interaction.channel.bulkDelete(messages, true);
    return interaction.editReply(`✅ Foram apagadas ${deleted.size} mensagens recentes.`);
  }

  if (name === 'bloquear' || name === 'desbloquear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: '❌ Você precisa da permissão Gerenciar Canais.', ephemeral: true });
    const everyone = interaction.guild.roles.everyone;
    const allow = name === 'desbloquear';
    await interaction.channel.permissionOverwrites.edit(everyone, {
      SendMessages: allow ? null : false,
      CreatePublicThreads: allow ? null : false,
      CreatePrivateThreads: allow ? null : false,
      SendMessagesInThreads: allow ? null : false,
    });
    return interaction.reply({ content: allow ? '✅ Canal desbloqueado.' : '🔒 Canal bloqueado.', ephemeral: true });
  }

  if (name === 'produtos') {
    const row = productSelect(interaction.guildId, 'products:edit', 'Selecione um produto para editar');
    if (!row) return interaction.reply({ content: '❌ Nenhum produto cadastrado.', ephemeral: true });
    return interaction.reply({ embeds: [brandEmbed(interaction.guildId, '📦 Produtos', 'Selecione um produto para editar.')], components: [row], ephemeral: true });
  }

  if (name === 'addcupom') {
    const id = uid('cupom');
    g.coupons[id] = { id, code: 'STAR10', name: 'Cupom Star Applications', percent: 10, color: g.config.mainColor || BRAND.defaultColor, image: null, title: 'Cupom de desconto', message: 'Use este cupom na sua compra.' };
    saveDB();
    return interaction.reply({ embeds: [couponEmbed(interaction.guildId, g.coupons[id])], components: couponConfigRows(id), ephemeral: true });
  }

  if (name === 'cupons') {
    const row = couponSelect(interaction.guildId, 'coupons:edit', 'Selecione um cupom para editar');
    if (!row) return interaction.reply({ content: '❌ Nenhum cupom cadastrado.', ephemeral: true });
    return interaction.reply({ embeds: [brandEmbed(interaction.guildId, '🏷️ Cupons', 'Selecione um cupom para editar.')], components: [row], ephemeral: true });
  }

  if (name === 'painelverificacao') {
    const id = uid('verifpanel');
    g.verificationPanels[id] = { id, channelId: null, title: 'Verificação Star Applications', message: 'Clique no botão abaixo para se verificar.', color: g.config.mainColor || BRAND.defaultColor, image: null };
    saveDB();
    return interaction.reply({
      embeds: [brandEmbed(interaction.guildId, '✅ Configurar Painel de Verificação', 'Configure e publique o painel de verificação.')],
      components: configPanelButtons('verifcfg', id),
      ephemeral: true,
    });
  }
}

function couponConfigRows(couponId) {
  const prefix = `couponcfg:${couponId}`;
  return chunkRows([
    new ButtonBuilder().setCustomId(`${prefix}:code`).setLabel('Código do cupom').setStyle(ButtonStyle.Secondary).setEmoji('🏷️'),
    new ButtonBuilder().setCustomId(`${prefix}:color`).setLabel('Cor do cupom').setStyle(ButtonStyle.Secondary).setEmoji('🎨'),
    new ButtonBuilder().setCustomId(`${prefix}:image`).setLabel('Imagem do cupom').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
    new ButtonBuilder().setCustomId(`${prefix}:name`).setLabel('Nome do cupom').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
    new ButtonBuilder().setCustomId(`${prefix}:percent`).setLabel('Porcentagem').setStyle(ButtonStyle.Secondary).setEmoji('🎁'),
  ]);
}

async function handleButton(interaction) {
  const [scope, idOrAction, action] = interaction.customId.split(':');
  const g = guildDB(interaction.guildId);

  if (scope === 'panel') {
    if (!requireAdmin(interaction)) return;
    const actionName = idOrAction;
    if (['pixKey', 'storeName', 'inviteMsg', 'welcomeMsg'].includes(actionName)) {
      const labels = { pixKey: 'Nova chave Pix', storeName: 'Nome da loja', inviteMsg: 'Mensagem de convites', welcomeMsg: 'Mensagem de boas-vindas' };
      return interaction.showModal(makeModal(`modal:panel:${actionName}`, 'Configurar painel', labels[actionName], TextInputStyle.Paragraph));
    }
    if (actionName === 'mainColor') return interaction.reply({ content: 'Selecione a cor principal:', components: [colorSelect('select:panel:mainColor')], ephemeral: true });
    if (actionName === 'adminRole') return interaction.reply({ content: 'Selecione o cargo administrador:', components: [new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('roleselect:panel:adminRole').setPlaceholder('Cargo administrador'))], ephemeral: true });
    if (actionName === 'verifiedRole') return interaction.reply({ content: 'Selecione o cargo de verificado:', components: [new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('roleselect:panel:verifiedRole').setPlaceholder('Cargo verificado'))], ephemeral: true });
    if (['inviteChannel', 'welcomeChannel', 'restockChannel'].includes(actionName)) {
      return interaction.reply({ content: 'Selecione o canal:', components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId(`channelselect:panel:${actionName}`).setPlaceholder('Canal').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))], ephemeral: true });
    }
    if (actionName === 'pending') return showPending(interaction);
  }

  if (scope === 'productcfg') {
    if (!requireAdmin(interaction)) return;
    const product = g.products[idOrAction];
    if (!product) return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
    if (action === 'channel') return interaction.reply({ content: 'Selecione o canal do produto:', components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId(`channelselect:product:${product.id}`).setPlaceholder('Canal').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))], ephemeral: true });
    if (action === 'color') return interaction.reply({ content: 'Selecione a cor do produto:', components: [colorSelect(`select:product:${product.id}`)], ephemeral: true });
    if (['message', 'image', 'name', 'title', 'stock', 'price'].includes(action)) {
      const label = { message: 'Mensagem', image: 'URL da imagem', name: 'Nome do produto', title: 'Título', stock: 'Estoque', price: 'Preço' }[action];
      return interaction.showModal(makeModal(`modal:product:${product.id}:${action}`, 'Configurar produto', label, action === 'message' ? TextInputStyle.Paragraph : TextInputStyle.Short, action !== 'image'));
    }
    if (action === 'publish') return publishProduct(interaction, product);
  }

  if (scope === 'couponcfg') {
    if (!requireAdmin(interaction)) return;
    const coupon = g.coupons[idOrAction];
    if (!coupon) return interaction.reply({ content: '❌ Cupom não encontrado.', ephemeral: true });
    if (action === 'color') return interaction.reply({ content: 'Selecione a cor do cupom:', components: [colorSelect(`select:coupon:${coupon.id}`)], ephemeral: true });
    if (['code', 'image', 'name', 'percent'].includes(action)) {
      const label = { code: 'Código do cupom', image: 'URL da imagem', name: 'Nome do cupom', percent: 'Porcentagem de desconto' }[action];
      return interaction.showModal(makeModal(`modal:coupon:${coupon.id}:${action}`, 'Configurar cupom', label, TextInputStyle.Short, action !== 'image'));
    }
  }

  if (['ticketcfg', 'prodpanelcfg', 'verifcfg'].includes(scope)) {
    if (!requireAdmin(interaction)) return;
    return handleGenericPanelButton(interaction, scope, idOrAction, action);
  }

  if (scope === 'buy') return startPurchase(interaction, idOrAction);
  if (scope === 'cart') return handleCartButton(interaction, idOrAction, action);
  if (scope === 'ticketopen') return openTicket(interaction, idOrAction);
  if (scope === 'ticket') return handleTicketButton(interaction, idOrAction, action);
  if (scope === 'verify') return verifyMember(interaction);
  if (scope === 'dm') return handleMessageBuilderButton(interaction, 'dm', idOrAction);
  if (scope === 'srvmsg') return handleMessageBuilderButton(interaction, 'srvmsg', idOrAction);
}

async function handleGenericPanelButton(interaction, scope, panelId, action) {
  const g = guildDB(interaction.guildId);
  const collection = scope === 'ticketcfg' ? g.ticketPanels : scope === 'prodpanelcfg' ? g.productPanels : g.verificationPanels;
  const panel = collection[panelId];
  if (!panel) return interaction.reply({ content: '❌ Painel não encontrado.', ephemeral: true });

  if (action === 'channel') return interaction.reply({ content: 'Selecione o canal do painel:', components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId(`channelselect:${scope}:${panelId}`).setPlaceholder('Canal').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))], ephemeral: true });
  if (action === 'color') return interaction.reply({ content: 'Selecione uma cor:', components: [colorSelect(`select:${scope}:${panelId}`)], ephemeral: true });
  if (['message', 'image', 'title', 'buttons'].includes(action)) {
    const label = { message: 'Mensagem', image: 'URL da imagem', title: 'Título', buttons: 'Nomes dos botões separados por vírgula' }[action];
    return interaction.showModal(makeModal(`modal:${scope}:${panelId}:${action}`, 'Configurar painel', label, action === 'message' || action === 'buttons' ? TextInputStyle.Paragraph : TextInputStyle.Short, action !== 'image'));
  }
  if (action === 'products') {
    const row = productSelect(interaction.guildId, `select:prodpanelproducts:${panelId}`, 'Selecione produtos para o painel');
    if (!row) return interaction.reply({ content: '❌ Nenhum produto cadastrado.', ephemeral: true });
    row.components[0].setMinValues(1).setMaxValues(Math.min(25, Object.keys(g.products).length));
    return interaction.reply({ content: 'Selecione os produtos que aparecerão no painel:', components: [row], ephemeral: true });
  }
  if (action === 'publish') {
    if (scope === 'ticketcfg') return publishTicketPanel(interaction, panel);
    if (scope === 'prodpanelcfg') return publishProductPanel(interaction, panel);
    if (scope === 'verifcfg') return publishVerificationPanel(interaction, panel);
  }
}

async function handleStringSelect(interaction) {
  const [scope, type, id] = interaction.customId.split(':');
  const g = guildDB(interaction.guildId);

  if (scope === 'select') {
    const value = interaction.values[0];
    if (type === 'panel' && id === 'mainColor') {
      g.config.mainColor = COLOR_PRESETS[value];
      saveDB();
      return interaction.update({ content: `✅ Cor principal alterada para ${value}.`, components: [] });
    }
    if (type === 'product') {
      g.products[id].color = COLOR_PRESETS[value];
      saveDB();
      return interaction.update({ content: `✅ Cor do produto alterada para ${value}.`, components: [] });
    }
    if (type === 'coupon') {
      g.coupons[id].color = COLOR_PRESETS[value];
      saveDB();
      return interaction.update({ content: `✅ Cor do cupom alterada para ${value}.`, components: [] });
    }
    if (['ticketcfg', 'prodpanelcfg', 'verifcfg'].includes(type)) {
      const col = type === 'ticketcfg' ? g.ticketPanels : type === 'prodpanelcfg' ? g.productPanels : g.verificationPanels;
      col[id].color = COLOR_PRESETS[value];
      saveDB();
      return interaction.update({ content: `✅ Cor do painel alterada para ${value}.`, components: [] });
    }
    if (type === 'prodpanelproducts') {
      g.productPanels[id].productIds = interaction.values;
      saveDB();
      return interaction.update({ content: `✅ ${interaction.values.length} produto(s) selecionado(s) para o painel.`, components: [] });
    }
  }

  if (interaction.customId === 'voice:join') {
    const channelId = interaction.values[0];
    const channel = interaction.guild.channels.cache.get(channelId);
    joinVoiceChannel({ channelId, guildId: interaction.guildId, adapterCreator: interaction.guild.voiceAdapterCreator });
    return interaction.update({ content: `✅ Entrei no canal de voz **${channel.name}**.`, components: [] });
  }

  if (interaction.customId === 'products:edit') {
    const product = g.products[interaction.values[0]];
    return interaction.update({ embeds: [productEmbed(interaction.guildId, product).setTitle('📦 Editar Produto')], components: productConfigRows(product.id) });
  }

  if (interaction.customId === 'coupons:edit') {
    const coupon = g.coupons[interaction.values[0]];
    return interaction.update({ embeds: [couponEmbed(interaction.guildId, coupon).setTitle('🏷️ Editar Cupom')], components: couponConfigRows(coupon.id) });
  }

  if (interaction.customId === 'ticket:relatedPurchase') {
    const ticket = Object.values(g.tickets).find((t) => t.channelId === interaction.channelId);
    if (ticket) {
      ticket.relatedPurchaseId = interaction.values[0];
      saveDB();
    }
    return interaction.update({ content: '✅ Compra relacionada ao ticket.', components: [] });
  }

  if (interaction.customId.startsWith('cart:coupon:')) {
    const cartId = interaction.customId.split(':')[2];
    const cart = g.carts[cartId];
    const coupon = g.coupons[interaction.values[0]];
    if (!cart || !coupon) return interaction.update({ content: '❌ Carrinho ou cupom não encontrado.', components: [] });
    cart.couponId = coupon.id;
    cart.discountPercent = Number(coupon.percent || 0);
    saveDB();
    return interaction.update({ content: `✅ Cupom **${coupon.code}** aplicado com ${coupon.percent}% de desconto.`, components: [] });
  }
}

async function handleChannelSelect(interaction) {
  const [scope, type, id] = interaction.customId.split(':');
  const g = guildDB(interaction.guildId);
  const channelId = interaction.values[0];

  if (scope !== 'channelselect') return;
  if (type === 'panel') {
    const map = { inviteChannel: 'inviteLogChannelId', welcomeChannel: 'welcomeChannelId', restockChannel: 'restockChannelId' };
    g.config[map[id]] = channelId;
  } else if (type === 'product') {
    g.products[id].channelId = channelId;
  } else if (['ticketcfg', 'prodpanelcfg', 'verifcfg'].includes(type)) {
    const col = type === 'ticketcfg' ? g.ticketPanels : type === 'prodpanelcfg' ? g.productPanels : g.verificationPanels;
    col[id].channelId = channelId;
  } else if (type === 'srvmsg') {
    g.tempServerMsgChannelId = channelId;
  }
  saveDB();
  return interaction.update({ content: `✅ Canal configurado: <#${channelId}>`, components: [] });
}

async function handleRoleSelect(interaction) {
  const [scope, type, id] = interaction.customId.split(':');
  if (scope !== 'roleselect' || type !== 'panel') return;
  const g = guildDB(interaction.guildId);
  const roleId = interaction.values[0];
  if (id === 'adminRole') g.config.adminRoleId = roleId;
  if (id === 'verifiedRole') g.config.verifiedRoleId = roleId;
  saveDB();
  return interaction.update({ content: `✅ Cargo configurado: <@&${roleId}>`, components: [] });
}

async function handleUserSelect(interaction) {
  const [scope, type] = interaction.customId.split(':');
  const g = guildDB(interaction.guildId);
  if (scope === 'userselect' && type === 'dm') {
    g.tempDmUserId = interaction.values[0];
    saveDB();
    return interaction.update({ content: `✅ Membro configurado: <@${interaction.values[0]}>`, components: [] });
  }
}

async function handleModal(interaction) {
  const parts = interaction.customId.split(':');
  const [, type, id, action] = parts;
  const value = interaction.fields.getTextInputValue('value');
  const g = guildDB(interaction.guildId);

  if (type === 'panel') {
    if (id === 'pixKey') g.config.pixKey = value;
    if (id === 'storeName') g.config.storeName = value;
    if (id === 'inviteMsg') g.config.inviteMessage = value;
    if (id === 'welcomeMsg') g.config.welcomeMessage = value;
    saveDB();
    return interaction.reply({ content: '✅ Configuração salva.', ephemeral: true });
  }

  if (type === 'product') {
    const product = g.products[id];
    if (!product) return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
    if (action === 'stock') {
      const oldStock = Number(product.stock || 0);
      product.stock = Math.max(0, Number(value) || 0);
      if (product.stock > oldStock && g.config.restockChannelId) {
        const ch = interaction.guild.channels.cache.get(g.config.restockChannelId);
        if (ch) ch.send({ embeds: [productEmbed(interaction.guildId, product).setTitle('📢 Reestoque disponível!')] }).catch(() => null);
      }
    } else if (action === 'price') product.price = Math.max(0, Number(String(value).replace(',', '.')) || 0);
    else product[action] = value || null;
    saveDB();
    return interaction.reply({ content: '✅ Produto atualizado.', embeds: [productEmbed(interaction.guildId, product)], ephemeral: true });
  }

  if (type === 'coupon') {
    const coupon = g.coupons[id];
    if (!coupon) return interaction.reply({ content: '❌ Cupom não encontrado.', ephemeral: true });
    if (action === 'percent') coupon.percent = Math.min(100, Math.max(0, Number(value) || 0));
    else coupon[action] = value || null;
    saveDB();
    return interaction.reply({ content: '✅ Cupom atualizado.', embeds: [couponEmbed(interaction.guildId, coupon)], ephemeral: true });
  }

  if (['ticketcfg', 'prodpanelcfg', 'verifcfg'].includes(type)) {
    const col = type === 'ticketcfg' ? g.ticketPanels : type === 'prodpanelcfg' ? g.productPanels : g.verificationPanels;
    const panel = col[id];
    if (!panel) return interaction.reply({ content: '❌ Painel não encontrado.', ephemeral: true });
    if (action === 'buttons') panel.buttons = value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5);
    else panel[action] = value || null;
    saveDB();
    return interaction.reply({ content: '✅ Painel atualizado.', ephemeral: true });
  }

  if (type === 'dm' || type === 'srvmsg') {
    g[type] = g[type] || { title: 'Mensagem Star Applications', message: 'Mensagem personalizada.', color: g.config.mainColor, image: null };
    g[type][id] = value || null;
    saveDB();
    return interaction.reply({ content: '✅ Mensagem configurada.', ephemeral: true });
  }
}

async function publishProduct(interaction, product) {
  if (!product.channelId) return interaction.reply({ content: '❌ Configure o canal primeiro.', ephemeral: true });
  const ch = interaction.guild.channels.cache.get(product.channelId);
  if (!ch) return interaction.reply({ content: '❌ Canal não encontrado.', ephemeral: true });
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`buy:${product.id}:start`).setLabel('Comprar').setStyle(ButtonStyle.Success).setEmoji('🛒'));
  await ch.send({ embeds: [productEmbed(interaction.guildId, product)], components: [row] });
  return interaction.reply({ content: `✅ Produto publicado em ${ch}.`, ephemeral: true });
}

async function publishTicketPanel(interaction, panel) {
  if (!panel.channelId) return interaction.reply({ content: '❌ Configure o canal primeiro.', ephemeral: true });
  const ch = interaction.guild.channels.cache.get(panel.channelId);
  if (!ch) return interaction.reply({ content: '❌ Canal não encontrado.', ephemeral: true });
  const embed = brandEmbed(interaction.guildId, panel.title, panel.message).setColor(panel.color || BRAND.defaultColor);
  if (panel.image) embed.setImage(panel.image);
  const buttons = (panel.buttons?.length ? panel.buttons : ['Abrir Ticket']).map((label, index) => new ButtonBuilder().setCustomId(`ticketopen:${panel.id}:${index}`).setLabel(label.slice(0, 80)).setStyle(ButtonStyle.Primary).setEmoji('🎫'));
  await ch.send({ embeds: [embed], components: chunkRows(buttons) });
  return interaction.reply({ content: `✅ Painel de ticket publicado em ${ch}.`, ephemeral: true });
}

async function publishProductPanel(interaction, panel) {
  if (!panel.channelId) return interaction.reply({ content: '❌ Configure o canal primeiro.', ephemeral: true });
  if (!panel.productIds?.length) return interaction.reply({ content: '❌ Configure os produtos do painel primeiro.', ephemeral: true });
  const ch = interaction.guild.channels.cache.get(panel.channelId);
  if (!ch) return interaction.reply({ content: '❌ Canal não encontrado.', ephemeral: true });
  const embed = brandEmbed(interaction.guildId, panel.title, panel.message).setColor(panel.color || BRAND.defaultColor);
  if (panel.image) embed.setImage(panel.image);
  const menu = new StringSelectMenuBuilder()
    .setCustomId('shop:selectproduct')
    .setPlaceholder('Selecione um produto')
    .addOptions(panel.productIds.slice(0, 25).map((id) => {
      const p = guildDB(interaction.guildId).products[id];
      return {
        label: (p?.name || 'Produto').slice(0, 100),
        value: id,
        description: `R$ ${Number(p?.price || 0).toFixed(2)} | Estoque: ${p?.stock || 0}`.slice(0, 100),
      };
    }));
  await ch.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
  return interaction.reply({ content: `✅ Painel de produtos publicado em ${ch}.`, ephemeral: true });
}

async function publishVerificationPanel(interaction, panel) {
  if (!panel.channelId) return interaction.reply({ content: '❌ Configure o canal primeiro.', ephemeral: true });
  const ch = interaction.guild.channels.cache.get(panel.channelId);
  if (!ch) return interaction.reply({ content: '❌ Canal não encontrado.', ephemeral: true });

  const embed = brandEmbed(interaction.guildId, panel.title, panel.message).setColor(panel.color || BRAND.defaultColor);
  if (panel.image) embed.setImage(panel.image);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`verify:${panel.id}:click`)
      .setLabel('Verificar')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  );

  await ch.send({ embeds: [embed], components: [row] });
  return interaction.reply({ content: `✅ Painel de verificação publicado em ${ch}.`, ephemeral: true });
}

async function startPurchase(interaction, productId) {
  const g = guildDB(interaction.guildId);
  const product = g.products[productId];

  if (!product) return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
  if (Number(product.stock || 0) <= 0) return interaction.reply({ content: '❌ Produto sem estoque.', ephemeral: true });

  const cartId = uid('cart');
  g.carts[cartId] = {
    id: cartId,
    userId: interaction.user.id,
    productId,
    quantity: 1,
    status: 'aguardando_pagamento',
    couponId: null,
    discountPercent: 0,
    createdAt: Date.now(),
  };
  saveDB();

  const total = Number(product.price || 0);
  const embed = brandEmbed(
    interaction.guildId,
    '🛒 Carrinho criado',
    `Produto: **${product.name}**\nQuantidade: **1**\nTotal: **R$ ${total.toFixed(2)}**\n\nChave Pix:\n\`${g.config.pixKey}\`\n\nApós pagar, clique em **Enviei o pagamento** e aguarde a equipe confirmar.`
  );

  const components = chunkRows([
    new ButtonBuilder().setCustomId(`cart:${cartId}:coupon`).setLabel('Aplicar cupom').setStyle(ButtonStyle.Secondary).setEmoji('🏷️'),
    new ButtonBuilder().setCustomId(`cart:${cartId}:paid`).setLabel('Enviei o pagamento').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`cart:${cartId}:cancel`).setLabel('Cancelar').setStyle(ButtonStyle.Danger).setEmoji('❌'),
  ]);

  return interaction.reply({ embeds: [embed], components, ephemeral: true });
}

async function handleCartButton(interaction, cartId, action) {
  const g = guildDB(interaction.guildId);
  const cart = g.carts[cartId];
  if (!cart) return interaction.reply({ content: '❌ Carrinho não encontrado.', ephemeral: true });

  const product = g.products[cart.productId];
  if (!product) return interaction.reply({ content: '❌ Produto do carrinho não encontrado.', ephemeral: true });

  if (cart.userId !== interaction.user.id && !isAdmin(interaction.member, interaction.guildId)) {
    return interaction.reply({ content: '❌ Esse carrinho não é seu.', ephemeral: true });
  }

  if (action === 'coupon') {
    const row = couponSelect(interaction.guildId, `cart:coupon:${cartId}`, 'Selecione um cupom');
    if (!row) return interaction.reply({ content: '❌ Nenhum cupom disponível.', ephemeral: true });
    return interaction.reply({ content: 'Selecione o cupom:', components: [row], ephemeral: true });
  }

  if (action === 'cancel') {
    cart.status = 'cancelado';
    saveDB();
    return interaction.reply({ content: '✅ Carrinho cancelado.', ephemeral: true });
  }

  if (action === 'paid') {
    cart.status = 'pagamento_enviado';
    saveDB();

    const total = Number(product.price || 0) * cart.quantity * (1 - Number(cart.discountPercent || 0) / 100);
    const admins = g.config.adminRoleId ? `<@&${g.config.adminRoleId}>` : 'Equipe';

    await interaction.reply({ content: '✅ Pagamento marcado como enviado. A equipe irá confirmar.', ephemeral: true });
    return interaction.channel.send({
      content: g.config.adminRoleId ? `<@&${g.config.adminRoleId}>` : undefined,
      embeds: [brandEmbed(
        interaction.guildId,
        '💸 Pagamento enviado',
        `${admins}\nCliente: ${interaction.user}\nProduto: **${product.name}**\nTotal: **R$ ${total.toFixed(2)}**\n\nUse o painel de compras pendentes em /painel para confirmar e entregar.`
      )],
    }).catch(() => null);
  }

  if (action === 'confirm' || action === 'deliver') {
    if (!requireAdmin(interaction)) return;

    if (action === 'confirm') {
      cart.status = 'pagamento_confirmado';
      saveDB();
      return interaction.reply({ content: '✅ Pagamento confirmado. Agora entregue o produto.', ephemeral: true });
    }

    if (action === 'deliver') {
      if (Number(product.stock || 0) <= 0) return interaction.reply({ content: '❌ Produto sem estoque.', ephemeral: true });

      product.stock = Number(product.stock || 0) - cart.quantity;
      cart.status = 'entregue';

      const purchaseId = uid('purchase');
      const total = Number(product.price || 0) * cart.quantity * (1 - Number(cart.discountPercent || 0) / 100);
      g.purchases[purchaseId] = {
        id: purchaseId,
        userId: cart.userId,
        productId: product.id,
        productName: product.name,
        total,
        status: 'entregue',
        createdAt: Date.now(),
      };
      saveDB();

      const user = await client.users.fetch(cart.userId).catch(() => null);
      if (user) {
        user.send({
          embeds: [brandEmbed(interaction.guildId, '✅ Compra entregue', `Sua compra de **${product.name}** foi marcada como entregue.`)],
        }).catch(() => null);
      }

      return interaction.reply({ content: '✅ Compra marcada como entregue e registrada no histórico do cliente.', ephemeral: true });
    }
  }
}

async function showPending(interaction) {
  const g = guildDB(interaction.guildId);
  const pending = Object.values(g.carts).filter((c) => ['pagamento_enviado', 'pagamento_confirmado'].includes(c.status));

  if (!pending.length) return interaction.reply({ content: '✅ Não há compras pendentes.', ephemeral: true });

  const embeds = pending.slice(0, 10).map((cart) => {
    const p = g.products[cart.productId] || {};
    const total = Number(p.price || 0) * cart.quantity * (1 - Number(cart.discountPercent || 0) / 100);
    return brandEmbed(
      interaction.guildId,
      `🛒 Carrinho ${cart.id}`,
      `Cliente: <@${cart.userId}>\nProduto: **${p.name || 'Produto'}**\nStatus: **${cart.status}**\nTotal: **R$ ${total.toFixed(2)}**`
    );
  });

  const buttons = [];
  for (const cart of pending.slice(0, 5)) {
    buttons.push(
      new ButtonBuilder().setCustomId(`cart:${cart.id}:confirm`).setLabel(`Confirmar ${cart.id.slice(-4)}`).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`cart:${cart.id}:deliver`).setLabel(`Entregar ${cart.id.slice(-4)}`).setStyle(ButtonStyle.Primary)
    );
  }

  return interaction.reply({ embeds, components: chunkRows(buttons), ephemeral: true });
}

async function openTicket(interaction, panelId) {
  const g = guildDB(interaction.guildId);
  const existing = Object.values(g.tickets).find((t) => t.userId === interaction.user.id && t.status === 'open');

  if (existing) return interaction.reply({ content: `❌ Você já tem um ticket aberto: <#${existing.channelId}>`, ephemeral: true });

  const channel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90),
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ...(g.config.adminRoleId
        ? [{ id: g.config.adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }]
        : []),
    ],
  });

  const ticketId = uid('ticket');
  g.tickets[ticketId] = {
    id: ticketId,
    channelId: channel.id,
    userId: interaction.user.id,
    panelId,
    status: 'open',
    claimedBy: null,
    relatedPurchaseId: null,
    createdAt: Date.now(),
  };
  saveDB();

  const embed = brandEmbed(
    interaction.guildId,
    '🎫 Bem-vindo(a) ao ticket',
    `Olá ${interaction.user}! A equipe irá te atender em breve.\n\nEsse atendimento é relacionado a alguma compra? Se sim, selecione abaixo.`
  );

  const buttons = chunkRows([
    new ButtonBuilder().setCustomId(`ticket:${ticketId}:close`).setLabel('Fechar ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId(`ticket:${ticketId}:claim`).setLabel('Assumir ticket').setStyle(ButtonStyle.Primary).setEmoji('🙋'),
    new ButtonBuilder().setCustomId(`ticket:${ticketId}:team`).setLabel('Marcar equipe').setStyle(ButtonStyle.Secondary).setEmoji('📣'),
    new ButtonBuilder().setCustomId(`ticket:${ticketId}:member`).setLabel('Marcar membro').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
    new ButtonBuilder().setCustomId(`ticket:${ticketId}:noproduct`).setLabel('Não é sobre produto adquirido').setStyle(ButtonStyle.Secondary).setEmoji('❌'),
  ]);

  const purchaseRow = userPurchasesSelect(interaction.guildId, interaction.user.id);
  await channel.send({
    content: `${interaction.user}${g.config.adminRoleId ? ` <@&${g.config.adminRoleId}>` : ''}`,
    embeds: [embed],
    components: purchaseRow ? [purchaseRow, ...buttons] : buttons,
  });

  return interaction.reply({ content: `✅ Ticket aberto: ${channel}`, ephemeral: true });
}

async function handleTicketButton(interaction, ticketId, action) {
  const g = guildDB(interaction.guildId);
  const ticket = g.tickets[ticketId];

  if (!ticket) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });

  if (['claim', 'team', 'member'].includes(action) && !isAdmin(interaction.member, interaction.guildId)) {
    return interaction.reply({ content: '❌ Apenas administradores configurados podem usar este botão.', ephemeral: true });
  }

  if (action === 'close') {
    ticket.status = 'closed';
    saveDB();
    await interaction.reply({ content: '🔒 Ticket será fechado.', ephemeral: true });
    return setTimeout(() => interaction.channel.delete().catch(() => null), 3000);
  }

  if (action === 'claim') {
    ticket.claimedBy = interaction.user.id;
    saveDB();
    return interaction.reply({ content: `✅ Ticket assumido por ${interaction.user}.` });
  }

  if (action === 'team') {
    return interaction.reply({ content: g.config.adminRoleId ? `<@&${g.config.adminRoleId}> equipe chamada por ${interaction.user}.` : `Equipe chamada por ${interaction.user}.` });
  }

  if (action === 'member') {
    return interaction.reply({ content: `<@${ticket.userId}> você foi chamado pela equipe.` });
  }

  if (action === 'noproduct') {
    ticket.relatedPurchaseId = null;
    saveDB();
    return interaction.reply({ content: '✅ Ticket marcado como não relacionado a produto adquirido.' });
  }
}

async function verifyMember(interaction) {
  const g = guildDB(interaction.guildId);
  if (!g.config.verifiedRoleId) return interaction.reply({ content: '❌ Cargo de verificado não configurado no `/painel`.', ephemeral: true });

  await interaction.member.roles.add(g.config.verifiedRoleId);
  return interaction.reply({ content: `✅ Você recebeu o cargo <@&${g.config.verifiedRoleId}>.`, ephemeral: true });
}

async function handleMessageBuilderButton(interaction, type, action) {
  const g = guildDB(interaction.guildId);
  g[type] = g[type] || {
    title: 'Mensagem Star Applications',
    message: 'Mensagem personalizada.',
    color: g.config.mainColor,
    image: null,
  };

  if (type === 'dm' && action === 'user') {
    const row1 = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId('userselect:dm:user').setPlaceholder('Selecione um membro')
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('dm:all').setLabel('Todos os membros').setStyle(ButtonStyle.Primary).setEmoji('👥')
    );
    return interaction.reply({ content: 'Selecione um membro ou todos:', components: [row1, row2], ephemeral: true });
  }

  if (type === 'dm' && action === 'all') {
    g.tempDmUserId = 'all';
    saveDB();
    return interaction.reply({ content: '✅ Destinatário configurado para todos os membros.', ephemeral: true });
  }

  if (type === 'srvmsg' && action === 'channel') {
    return interaction.reply({
      content: 'Selecione o canal:',
      components: [new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('channelselect:srvmsg:channel')
          .setPlaceholder('Canal')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )],
      ephemeral: true,
    });
  }

  if (action === 'color') return interaction.reply({ content: 'Selecione uma cor:', components: [colorSelect(`selectmsg:${type}:color`)], ephemeral: true });

  if (['message', 'image', 'title'].includes(action)) {
    return interaction.showModal(makeModal(
      `modal:${type}:${action}`,
      'Configurar mensagem',
      action === 'message' ? 'Mensagem' : action === 'image' ? 'URL da imagem' : 'Título',
      action === 'message' ? TextInputStyle.Paragraph : TextInputStyle.Short,
      action !== 'image'
    ));
  }

  if (action === 'send') return sendBuiltMessage(interaction, type);
}

async function sendBuiltMessage(interaction, type) {
  const g = guildDB(interaction.guildId);
  const data = g[type] || {
    title: 'Mensagem Star Applications',
    message: 'Mensagem personalizada.',
    color: g.config.mainColor,
    image: null,
  };

  const embed = brandEmbed(interaction.guildId, data.title, data.message).setColor(data.color || g.config.mainColor || BRAND.defaultColor);
  if (data.image) embed.setImage(data.image);

  if (type === 'srvmsg') {
    const ch = interaction.guild.channels.cache.get(g.tempServerMsgChannelId);
    if (!ch) return interaction.reply({ content: '❌ Configure o canal primeiro.', ephemeral: true });

    await ch.send({ embeds: [embed] });
    return interaction.reply({ content: `✅ Mensagem enviada em ${ch}.`, ephemeral: true });
  }

  if (type === 'dm') {
    if (!g.tempDmUserId) return interaction.reply({ content: '❌ Configure o membro primeiro.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    if (g.tempDmUserId === 'all') {
      const members = await interaction.guild.members.fetch();
      let sent = 0;

      for (const member of members.values()) {
        if (member.user.bot) continue;
        await member.send({ embeds: [embed] }).then(() => sent++).catch(() => null);
      }

      return interaction.editReply(`✅ DM enviada para ${sent} membros.`);
    }

    const user = await client.users.fetch(g.tempDmUserId).catch(() => null);
    if (!user) return interaction.editReply('❌ Usuário não encontrado.');

    await user.send({ embeds: [embed] });
    return interaction.editReply('✅ DM enviada.');
  }
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guildId) return;
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'shop:selectproduct') return;
    return startPurchase(interaction, interaction.values[0]);
  } catch (error) {
    console.error('Erro em shop:selectproduct:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guildId) return;
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('selectmsg:')) return;

    const [, type] = interaction.customId.split(':');
    const g = guildDB(interaction.guildId);
    g[type] = g[type] || {};
    g[type].color = COLOR_PRESETS[interaction.values[0]];
    saveDB();

    return interaction.update({ content: `✅ Cor alterada para ${interaction.values[0]}.`, components: [] });
  } catch (error) {
    console.error('Erro em selectmsg:', error);
  }
});


async function handleVerPlano(interaction) {
  const guildId = interaction.options?.getString('guild_id') || interaction.guildId;
  if (guildId !== interaction.guildId && !isBotOwner(interaction.user.id)) {
    return interaction.reply({ content: '❌ Apenas o dono do bot pode consultar outro servidor.', ephemeral: true });
  }

  const g = guildDB(guildId);
  const plano = getPlano(guildId);
  const embed = new EmbedBuilder()
    .setTitle('💎 Plano Star Applications')
    .setDescription(planStatusText(guildId))
    .addFields(
      { name: '📦 Limite de produtos', value: `${plano.maxProdutos}`, inline: true },
      { name: '🏷️ Cupons', value: plano.cupons ? 'Liberado' : 'Bloqueado', inline: true },
      { name: '🎫 Tickets', value: plano.tickets ? 'Liberado' : 'Bloqueado', inline: true },
      { name: '✅ Verificação', value: plano.verificacao ? 'Liberado' : 'Bloqueado', inline: true },
      { name: '🛑 Cancelamento', value: g.config.cancelamento?.ativo ? (g.config.cancelamento?.motivo || 'Ativo') : 'Não cancelado', inline: false },
    )
    .setColor(g.config.mainColor || BRAND.defaultColor)
    .setFooter({ text: BRAND.footer })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSetPlano(interaction) {
  if (!isBotOwner(interaction.user.id)) {
    return interaction.reply({ content: '❌ Apenas o dono do bot pode usar este comando.', ephemeral: true });
  }

  const guildId = interaction.options.getString('guild_id');
  const plano = interaction.options.getString('plano');
  const dias = interaction.options.getInteger('dias') || 30;

  setGuildPlan(guildId, plano, dias, interaction.user.id);
  return interaction.reply({ content: `✅ Plano **${PLANOS[plano].nome}** definido para o servidor \`${guildId}\` por **${dias} dia(s)**.`, ephemeral: true });
}

async function handleCancelarPlano(interaction) {
  if (!isBotOwner(interaction.user.id)) {
    return interaction.reply({ content: '❌ Apenas o dono do bot pode usar este comando.', ephemeral: true });
  }

  const guildId = interaction.options.getString('guild_id');
  const motivo = interaction.options.getString('motivo') || 'Cancelado manualmente';
  cancelGuildPlan(guildId, motivo, interaction.user.id);
  return interaction.reply({ content: `⛔ Plano do servidor \`${guildId}\` cancelado. Motivo: **${motivo}**.`, ephemeral: true });
}

async function checkPlanExpirations() {
  for (const guildId of Object.keys(db.guilds || {})) {
    const g = guildDB(guildId);
    if (!g.config?.assinatura?.venceEm || g.config.plano === 'cancelado') continue;
    const dias = getDaysRemaining(g.config.assinatura.venceEm);
    if (dias === null) continue;

    if (dias < 0) {
      cancelGuildPlan(guildId, 'Assinatura vencida automaticamente', client.user?.id || null);
      const guild = client.guilds.cache.get(guildId);
      const ch = guild && g.config.planNoticeChannelId ? guild.channels.cache.get(g.config.planNoticeChannelId) : null;
      if (ch) ch.send({ embeds: [brandEmbed(guildId, '⛔ Assinatura vencida', 'A assinatura deste servidor venceu e os recursos foram bloqueados. Entre em contato com a Star Applications para renovar.')] }).catch(() => null);
    }
  }
}

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

(async () => {
  await registerCommands();
  await client.login(TOKEN);
})();
