// =====================================================
// STAR SALLERS - BOT DE VENDAS COM PLANOS E PERSONALIZAÇÃO
// Arquivo original recomendado: index.js
// Salve este conteúdo como index.js para rodar o bot.
// =====================================================

require("dotenv").config();
const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

// =========================
// CONFIGURAÇÕES INICIAIS
// =========================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const OWNER_IDS = String(process.env.OWNER_ID || process.env.OWNER_IDS || "")
  .split(",")
  .map(id => id.trim())
  .filter(Boolean);

if (!TOKEN) {
  console.log("ERRO: coloque o TOKEN no arquivo .env");
  process.exit(1);
}

const DB_FILE = path.join(__dirname, "database.json");

const PLAN_LEVELS = {
  basic: 1,
  pro: 2,
  ultimate: 3
};

const PLANOS = {
  basic: {
    nome: "Plano Basic",
    emoji: "🥉",
    maxProdutos: 10,
    cupons: false,
    personalizacaoEntrada: true,
    personalizacaoInvites: false,
    logsVendas: true,
    suportePrioritario: false
  },
  pro: {
    nome: "Plano Pro",
    emoji: "🥈",
    maxProdutos: 50,
    cupons: true,
    personalizacaoEntrada: true,
    personalizacaoInvites: true,
    logsVendas: true,
    suportePrioritario: true
  },
  ultimate: {
    nome: "Plano Ultimate",
    emoji: "🥇",
    maxProdutos: 9999,
    cupons: true,
    personalizacaoEntrada: true,
    personalizacaoInvites: true,
    logsVendas: true,
    suportePrioritario: true,
    personalizacaoAvancada: true
  }
};

function defaultDB() {
  return {
    guilds: {},
    products: {}
  };
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB(), null, 2));
  }

  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    if (!data.guilds) data.guilds = {};
    if (!data.products) data.products = {};
    return data;
  } catch (err) {
    console.log("Erro ao ler database.json:", err);
    return defaultDB();
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getGuildConfig(guildId) {
  const db = loadDB();

  if (!db.guilds[guildId]) {
    db.guilds[guildId] = {
      plano: "basic",
      lojaNome: "Star Applications",
      corPrincipal: "#2B6CFF",
      canais: {
        entrada: null,
        invites: null,
        logsVendas: null
      },
      mensagens: {
        entrada: "Bem-vindo(a), {user}, à {server}! Leia os canais de informações e aproveite sua experiência.",
        invites: "{user} entrou no servidor. Convite usado: {invite}. Total de membros: {members}."
      },
      inviteCache: {}
    };
    saveDB(db);
  }

  return db.guilds[guildId];
}

function updateGuildConfig(guildId, patch) {
  const db = loadDB();
  const atual = getGuildConfig(guildId);
  db.guilds[guildId] = deepMerge(atual, patch);
  saveDB(db);
  return db.guilds[guildId];
}

function deepMerge(target, source) {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      output[key] = deepMerge(output[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

function getPlanoKey(guildId) {
  const config = getGuildConfig(guildId);
  return PLANOS[config.plano] ? config.plano : "basic";
}

function getPlano(guildId) {
  const planoKey = getPlanoKey(guildId);
  return PLANOS[planoKey] || PLANOS.basic;
}

function setGuildPlan(guildId, plano) {
  if (!PLANOS[plano]) {
    throw new Error("Plano inválido. Use basic, pro ou ultimate.");
  }

  return updateGuildConfig(guildId, { plano });
}

function hasPlan(guildId, requiredPlan) {
  const currentPlan = getPlanoKey(guildId);
  const currentLevel = PLAN_LEVELS[currentPlan] || PLAN_LEVELS.basic;
  const requiredLevel = PLAN_LEVELS[requiredPlan] || PLAN_LEVELS.basic;

  return currentLevel >= requiredLevel;
}

function getRequiredPlanForCommand(commandName) {
  const requiredPlans = {
    painel: "basic",
    addproduto: "basic",
    editarproduto: "basic",
    setplano: "ultimate"
  };

  return requiredPlans[commandName] || "basic";
}

function isBotOwner(userId) {
  return OWNER_IDS.includes(userId);
}

function isAdmin(interaction) {
  return interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function formatMessage(template, data) {
  return String(template || "")
    .replaceAll("{user}", data.user || "")
    .replaceAll("{user_id}", data.user_id || "")
    .replaceAll("{server}", data.server || "")
    .replaceAll("{members}", data.members || "")
    .replaceAll("{invite}", data.invite || "Desconhecido")
    .replaceAll("{inviter}", data.inviter || "Desconhecido")
    .replaceAll("{uses}", data.uses || "0");
}

function getGuildProducts(guildId) {
  const db = loadDB();
  if (!db.products[guildId]) {
    db.products[guildId] = [];
    saveDB(db);
  }
  return db.products[guildId];
}

function setGuildProducts(guildId, products) {
  const db = loadDB();
  db.products[guildId] = products;
  saveDB(db);
}

// =========================
// CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// =========================
// COMANDOS SLASH
// =========================

const commands = [
  new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Abre o painel de configuração da Star Sallers."),

  new SlashCommandBuilder()
    .setName("addproduto")
    .setDescription("Adiciona um produto à loja.")
    .addStringOption(option =>
      option
        .setName("nome")
        .setDescription("Nome do produto")
        .setRequired(true)
    )
    .addNumberOption(option =>
      option
        .setName("preco")
        .setDescription("Preço do produto")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("descricao")
        .setDescription("Descrição do produto")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("editarproduto")
    .setDescription("Edita um produto existente.")
    .addStringOption(option =>
      option
        .setName("id")
        .setDescription("ID do produto")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("nome")
        .setDescription("Novo nome do produto")
        .setRequired(false)
    )
    .addNumberOption(option =>
      option
        .setName("preco")
        .setDescription("Novo preço do produto")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("descricao")
        .setDescription("Nova descrição do produto")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("setplano")
    .setDescription("Define o plano de um servidor. Apenas o dono do bot pode usar.")
    .addStringOption(option =>
      option
        .setName("guild_id")
        .setDescription("ID do servidor que receberá o plano")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("plano")
        .setDescription("Plano que será aplicado")
        .setRequired(true)
        .addChoices(
          { name: "Plano Basic", value: "basic" },
          { name: "Plano Pro", value: "pro" },
          { name: "Plano Ultimate", value: "ultimate" }
        )
    )
].map(command => command.toJSON());

async function registerCommands() {
  if (!CLIENT_ID || !GUILD_ID) {
    console.log("CLIENT_ID ou GUILD_ID não encontrado no .env. Comandos não registrados automaticamente.");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("Registrando comandos...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands
    });
    console.log("Comandos registrados com sucesso.");
  } catch (err) {
    console.log("Erro ao registrar comandos:", err);
  }
}

// =========================
// READY E CACHE DE INVITES
// =========================

client.once("ready", async () => {
  console.log(`Star Sallers online como ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await cacheGuildInvites(guild);
    getGuildConfig(guild.id);
  }
});

async function cacheGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const inviteCache = {};

    invites.forEach(invite => {
      inviteCache[invite.code] = {
        code: invite.code,
        uses: invite.uses || 0,
        inviter: invite.inviter ? invite.inviter.tag : "Desconhecido"
      };
    });

    updateGuildConfig(guild.id, { inviteCache });
  } catch (err) {
    console.log(`Não consegui carregar invites de ${guild.name}. Verifique permissão Gerenciar Servidor.`);
  }
}

client.on("inviteCreate", async invite => {
  await cacheGuildInvites(invite.guild);
});

client.on("inviteDelete", async invite => {
  await cacheGuildInvites(invite.guild);
});

// =========================
// ENTRADA + DETECTOR DE INVITE
// =========================

client.on("guildMemberAdd", async member => {
  const config = getGuildConfig(member.guild.id);
  const plano = getPlano(member.guild.id);

  let usedInvite = null;

  if (plano.personalizacaoInvites) {
    try {
      const newInvites = await member.guild.invites.fetch();
      const oldCache = config.inviteCache || {};

      for (const invite of newInvites.values()) {
        const oldUses = oldCache[invite.code]?.uses || 0;
        const newUses = invite.uses || 0;

        if (newUses > oldUses) {
          usedInvite = invite;
          break;
        }
      }

      await cacheGuildInvites(member.guild);
    } catch (err) {
      console.log("Erro ao detectar invite usado:", err.message);
    }
  }

  const data = {
    user: `${member}`,
    user_id: member.id,
    server: member.guild.name,
    members: `${member.guild.memberCount}`,
    invite: usedInvite ? usedInvite.code : "Desconhecido",
    inviter: usedInvite?.inviter ? `${usedInvite.inviter}` : "Desconhecido",
    uses: usedInvite ? `${usedInvite.uses}` : "0"
  };

  // Mensagem de entrada
  if (config.canais.entrada && plano.personalizacaoEntrada) {
    const canalEntrada = member.guild.channels.cache.get(config.canais.entrada);
    if (canalEntrada) {
      canalEntrada.send({
        content: formatMessage(config.mensagens.entrada, data)
      }).catch(() => {});
    }
  }

  // Mensagem de invites
  if (config.canais.invites && plano.personalizacaoInvites) {
    const canalInvites = member.guild.channels.cache.get(config.canais.invites);
    if (canalInvites) {
      canalInvites.send({
        content: formatMessage(config.mensagens.invites, data)
      }).catch(() => {});
    }
  }
});

// =========================
// INTERAÇÕES
// =========================

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setplano") return handleSetPlano(interaction);

      const requiredPlan = getRequiredPlanForCommand(interaction.commandName);
      if (!hasPlan(interaction.guild.id, requiredPlan)) {
        const planoAtual = getPlano(interaction.guild.id);
        const planoNecessario = PLANOS[requiredPlan];

        return interaction.reply({
          content:
            `❌ Este comando pertence ao ${planoNecessario.nome}.\n` +
            `Seu servidor está no ${planoAtual.nome}. Faça upgrade para usar.`,
          ephemeral: true
        });
      }

      if (interaction.commandName === "painel") return handlePainel(interaction);
      if (interaction.commandName === "addproduto") return handleAddProduto(interaction);
      if (interaction.commandName === "editarproduto") return handleEditarProduto(interaction);
    }

    if (interaction.isButton()) {
      if (interaction.customId === "painel_personalizacao") return handlePainelPersonalizacao(interaction);
      if (interaction.customId === "painel_planos") return handlePainelPlanos(interaction);
      if (interaction.customId === "config_canal_entrada") return openCanalEntradaModal(interaction);
      if (interaction.customId === "config_canal_invites") return openCanalInvitesModal(interaction);
      if (interaction.customId === "config_msg_entrada") return openMsgEntradaModal(interaction);
      if (interaction.customId === "config_msg_invites") return openMsgInvitesModal(interaction);
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "select_plano") return handleSelectPlano(interaction);
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "modal_canal_entrada") return saveCanalEntrada(interaction);
      if (interaction.customId === "modal_canal_invites") return saveCanalInvites(interaction);
      if (interaction.customId === "modal_msg_entrada") return saveMsgEntrada(interaction);
      if (interaction.customId === "modal_msg_invites") return saveMsgInvites(interaction);
    }
  } catch (err) {
    console.log("Erro em interactionCreate:", err);

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: "❌ Ocorreu um erro ao executar essa ação.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// =========================
// PAINEL
// =========================

async function handlePainel(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "❌ Apenas administradores podem usar este painel.",
      ephemeral: true
    });
  }

  const config = getGuildConfig(interaction.guild.id);
  const plano = getPlano(interaction.guild.id);

  const embed = new EmbedBuilder()
    .setTitle("⭐ Painel Star Sallers")
    .setDescription(
      `Configure o sistema da sua loja.\n\n` +
      `**Plano atual:** ${plano.emoji} ${plano.nome}\n` +
      `**Loja:** ${config.lojaNome}\n\n` +
      `Use os botões abaixo para configurar o servidor.`
    )
    .setColor(config.corPrincipal || "#2B6CFF");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("painel_personalizacao")
      .setLabel("Personalização")
      .setEmoji("🎨")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("painel_planos")
      .setLabel("Planos")
      .setEmoji("💎")
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handlePainelPersonalizacao(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const config = getGuildConfig(interaction.guild.id);
  const plano = getPlano(interaction.guild.id);

  const canalEntrada = config.canais.entrada ? `<#${config.canais.entrada}>` : "Não configurado";
  const canalInvites = config.canais.invites ? `<#${config.canais.invites}>` : "Não configurado";

  const embed = new EmbedBuilder()
    .setTitle("🎨 Personalização")
    .setDescription(
      `Aqui você configura canais e mensagens automáticas.\n\n` +
      `**Canal de entrada:** ${canalEntrada}\n` +
      `**Canal de invites:** ${canalInvites}\n\n` +
      `**Mensagem de entrada:**\n\`${config.mensagens.entrada}\`\n\n` +
      `**Mensagem de invites:**\n\`${config.mensagens.invites}\`\n\n` +
      `**Variáveis disponíveis:**\n` +
      `\`{user}\`, \`{user_id}\`, \`{server}\`, \`{members}\`, \`{invite}\`, \`{inviter}\`, \`{uses}\`\n\n` +
      `**Aviso:** mensagem de invites personalizada só fica ativa no Plano Pro ou Ultimate.`
    )
    .setColor(config.corPrincipal || "#2B6CFF");

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("config_canal_entrada")
      .setLabel("Canal Entrada")
      .setEmoji("📥")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("config_msg_entrada")
      .setLabel("Mensagem Entrada")
      .setEmoji("✏️")
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("config_canal_invites")
      .setLabel("Canal Invites")
      .setEmoji("🔗")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!plano.personalizacaoInvites),

    new ButtonBuilder()
      .setCustomId("config_msg_invites")
      .setLabel("Mensagem Invites")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!plano.personalizacaoInvites)
  );

  return interaction.update({ embeds: [embed], components: [row1, row2] });
}

async function handlePainelPlanos(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const config = getGuildConfig(interaction.guild.id);
  const planoAtual = getPlano(interaction.guild.id);

  const embed = new EmbedBuilder()
    .setTitle("💎 Planos Star Sallers")
    .setDescription(
      `**Plano atual:** ${planoAtual.emoji} ${planoAtual.nome}\n\n` +
      `🥉 **Plano Basic**\n` +
      `• /addproduto e /editarproduto\n` +
      `• Até 10 produtos\n` +
      `• Mensagem de entrada editável\n` +
      `• Logs de vendas\n\n` +
      `🥈 **Plano Pro**\n` +
      `• Tudo do Basic\n` +
      `• Até 50 produtos\n` +
      `• Cupons\n` +
      `• Mensagem de entrada editável\n` +
      `• Mensagem de invites editável\n` +
      `• Suporte prioritário\n\n` +
      `🥇 **Plano Ultimate**\n` +
      `• Tudo do Pro\n` +
      `• Produtos praticamente ilimitados\n` +
      `• Personalização avançada\n` +
      `• Recursos exclusivos conforme atualização\n\n` +
      `🔒 **Alteração de plano:** apenas o dono do bot pode alterar usando:\n` +
      `\`/setplano guild_id:${interaction.guild.id} plano:basic/pro/ultimate\``
    )
    .setColor(config.corPrincipal || "#2B6CFF");

  return interaction.update({ embeds: [embed], components: [] });
}

async function handleSelectPlano(interaction) {
  if (!isBotOwner(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Apenas o dono do bot pode alterar planos.",
      ephemeral: true
    });
  }

  const plano = interaction.values[0];
  setGuildPlan(interaction.guild.id, plano);

  const planoInfo = PLANOS[plano];
  return interaction.reply({
    content: `✅ Plano alterado para ${planoInfo.emoji} **${planoInfo.nome}**.`,
    ephemeral: true
  });
}

async function handleSetPlano(interaction) {
  if (!isBotOwner(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Apenas o dono do bot pode usar este comando.",
      ephemeral: true
    });
  }

  const guildId = interaction.options.getString("guild_id").trim();
  const plano = interaction.options.getString("plano");

  if (!/^\d{17,20}$/.test(guildId)) {
    return interaction.reply({
      content: "❌ ID do servidor inválido. Ative o modo desenvolvedor e copie o ID do servidor.",
      ephemeral: true
    });
  }

  if (!PLANOS[plano]) {
    return interaction.reply({
      content: "❌ Plano inválido. Use basic, pro ou ultimate.",
      ephemeral: true
    });
  }

  const targetGuild = client.guilds.cache.get(guildId);
  setGuildPlan(guildId, plano);

  const planoInfo = PLANOS[plano];

  return interaction.reply({
    content:
      `✅ Plano definido com sucesso.\n\n` +
      `Servidor: ${targetGuild ? `**${targetGuild.name}**` : "não encontrado no cache do bot"}\n` +
      `ID: \`${guildId}\`\n` +
      `Plano: ${planoInfo.emoji} **${planoInfo.nome}**`,
    ephemeral: true
  });
}

// =========================
// MODAIS DE PERSONALIZAÇÃO
// =========================

async function openCanalEntradaModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("modal_canal_entrada")
    .setTitle("Configurar Canal de Entrada");

  const input = new TextInputBuilder()
    .setCustomId("canal_entrada")
    .setLabel("ID do canal de entrada")
    .setPlaceholder("Exemplo: 123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function openCanalInvitesModal(interaction) {
  if (!hasPlan(interaction.guild.id, "pro")) {
    return interaction.reply({
      content: "❌ O canal de invites personalizado está disponível apenas no Plano Pro ou Ultimate.",
      ephemeral: true
    });
  }

  const modal = new ModalBuilder()
    .setCustomId("modal_canal_invites")
    .setTitle("Configurar Canal de Invites");

  const input = new TextInputBuilder()
    .setCustomId("canal_invites")
    .setLabel("ID do canal de invites")
    .setPlaceholder("Exemplo: 123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function openMsgEntradaModal(interaction) {
  const config = getGuildConfig(interaction.guild.id);

  const modal = new ModalBuilder()
    .setCustomId("modal_msg_entrada")
    .setTitle("Editar Mensagem de Entrada");

  const input = new TextInputBuilder()
    .setCustomId("msg_entrada")
    .setLabel("Mensagem de entrada")
    .setPlaceholder("Use {user}, {server}, {members}")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(config.mensagens.entrada?.slice(0, 3900) || "");

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function openMsgInvitesModal(interaction) {
  if (!hasPlan(interaction.guild.id, "pro")) {
    return interaction.reply({
      content: "❌ A mensagem de invites personalizada está disponível apenas no Plano Pro ou Ultimate.",
      ephemeral: true
    });
  }

  const config = getGuildConfig(interaction.guild.id);

  const modal = new ModalBuilder()
    .setCustomId("modal_msg_invites")
    .setTitle("Editar Mensagem de Invites");

  const input = new TextInputBuilder()
    .setCustomId("msg_invites")
    .setLabel("Mensagem de invites")
    .setPlaceholder("Use {user}, {invite}, {inviter}, {uses}")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(config.mensagens.invites?.slice(0, 3900) || "");

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function saveCanalEntrada(interaction) {
  const channelId = interaction.fields.getTextInputValue("canal_entrada").trim();
  const channel = interaction.guild.channels.cache.get(channelId);

  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.reply({
      content: "❌ Canal inválido. Copie o ID de um canal de texto.",
      ephemeral: true
    });
  }

  updateGuildConfig(interaction.guild.id, {
    canais: { entrada: channelId }
  });

  return interaction.reply({
    content: `✅ Canal de entrada configurado para ${channel}.`,
    ephemeral: true
  });
}

async function saveCanalInvites(interaction) {
  const plano = getPlano(interaction.guild.id);

  if (!plano.personalizacaoInvites) {
    return interaction.reply({
      content: "❌ O canal de invites personalizado está disponível apenas no Plano Pro ou Ultimate.",
      ephemeral: true
    });
  }

  const channelId = interaction.fields.getTextInputValue("canal_invites").trim();
  const channel = interaction.guild.channels.cache.get(channelId);

  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.reply({
      content: "❌ Canal inválido. Copie o ID de um canal de texto.",
      ephemeral: true
    });
  }

  updateGuildConfig(interaction.guild.id, {
    canais: { invites: channelId }
  });

  await cacheGuildInvites(interaction.guild);

  return interaction.reply({
    content: `✅ Canal de invites configurado para ${channel}.`,
    ephemeral: true
  });
}

async function saveMsgEntrada(interaction) {
  const msg = interaction.fields.getTextInputValue("msg_entrada").trim();

  if (msg.length > 1900) {
    return interaction.reply({
      content: "❌ A mensagem ficou muito grande. Use até 1900 caracteres.",
      ephemeral: true
    });
  }

  updateGuildConfig(interaction.guild.id, {
    mensagens: { entrada: msg }
  });

  return interaction.reply({
    content: "✅ Mensagem de entrada atualizada com sucesso.",
    ephemeral: true
  });
}

async function saveMsgInvites(interaction) {
  const plano = getPlano(interaction.guild.id);

  if (!plano.personalizacaoInvites) {
    return interaction.reply({
      content: "❌ A mensagem de invites personalizada está disponível apenas no Plano Pro ou Ultimate.",
      ephemeral: true
    });
  }

  const msg = interaction.fields.getTextInputValue("msg_invites").trim();

  if (msg.length > 1900) {
    return interaction.reply({
      content: "❌ A mensagem ficou muito grande. Use até 1900 caracteres.",
      ephemeral: true
    });
  }

  updateGuildConfig(interaction.guild.id, {
    mensagens: { invites: msg }
  });

  return interaction.reply({
    content: "✅ Mensagem de invites atualizada com sucesso.",
    ephemeral: true
  });
}

// =========================
// PRODUTOS
// =========================

async function handleAddProduto(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Apenas administradores podem adicionar produtos.", ephemeral: true });
  }

  const plano = getPlano(interaction.guild.id);
  const products = getGuildProducts(interaction.guild.id);

  if (products.length >= plano.maxProdutos) {
    return interaction.reply({
      content: `❌ Seu plano atual permite até ${plano.maxProdutos} produtos. Faça upgrade para adicionar mais.`,
      ephemeral: true
    });
  }

  const nome = interaction.options.getString("nome");
  const preco = interaction.options.getNumber("preco");
  const descricao = interaction.options.getString("descricao");

  const produto = {
    id: Date.now().toString(),
    nome,
    preco,
    descricao,
    criadoEm: new Date().toISOString()
  };

  products.push(produto);
  setGuildProducts(interaction.guild.id, products);

  const embed = new EmbedBuilder()
    .setTitle("✅ Produto adicionado")
    .setColor("#2B6CFF")
    .addFields(
      { name: "ID", value: produto.id, inline: false },
      { name: "Nome", value: produto.nome, inline: true },
      { name: "Preço", value: `R$ ${produto.preco.toFixed(2).replace(".", ",")}`, inline: true },
      { name: "Descrição", value: produto.descricao, inline: false }
    );

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleEditarProduto(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Apenas administradores podem editar produtos.", ephemeral: true });
  }

  const id = interaction.options.getString("id");
  const nome = interaction.options.getString("nome");
  const preco = interaction.options.getNumber("preco");
  const descricao = interaction.options.getString("descricao");

  const products = getGuildProducts(interaction.guild.id);
  const index = products.findIndex(p => p.id === id);

  if (index === -1) {
    return interaction.reply({
      content: "❌ Produto não encontrado. Confira o ID e tente novamente.",
      ephemeral: true
    });
  }

  if (!nome && preco === null && !descricao) {
    return interaction.reply({
      content: "❌ Informe pelo menos um campo para editar: nome, preço ou descrição.",
      ephemeral: true
    });
  }

  if (nome) products[index].nome = nome;
  if (preco !== null) products[index].preco = preco;
  if (descricao) products[index].descricao = descricao;
  products[index].editadoEm = new Date().toISOString();

  setGuildProducts(interaction.guild.id, products);

  const produto = products[index];

  const embed = new EmbedBuilder()
    .setTitle("✅ Produto editado")
    .setColor("#2B6CFF")
    .addFields(
      { name: "ID", value: produto.id, inline: false },
      { name: "Nome", value: produto.nome, inline: true },
      { name: "Preço", value: `R$ ${produto.preco.toFixed(2).replace(".", ",")}`, inline: true },
      { name: "Descrição", value: produto.descricao, inline: false }
    );

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

// =========================
// LOGIN
// =========================

registerCommands();
client.login(TOKEN);
