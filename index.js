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
  cancelado: 0,
  basic: 1,
  pro: 2,
  ultimate: 3
};

const PLANOS = {
  cancelado: {
    nome: "Plano Cancelado",
    emoji: "⛔",
    maxProdutos: 0,
    cupons: false,
    personalizacaoEntrada: false,
    personalizacaoInvites: false,
    logsVendas: false,
    suportePrioritario: false,
    cancelado: true
  },
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
    products: {},
    coupons: {},
    carts: {}
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
    if (!data.coupons) data.coupons = {};
    if (!data.carts) data.carts = {};
    return data;
  } catch (err) {
    console.log("Erro ao ler database.json:", err);
    return defaultDB();
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getDefaultGuildConfig() {
  return {
    plano: "basic",
    lojaNome: "Star Applications",
    corPrincipal: "#2B6CFF",
    canais: {
      entrada: null,
      invites: null,
      logsVendas: null,
      categoriaCarrinho: null,
      entregas: null,
      avisosPlano: null
    },
    assinatura: {
      status: "ativa",
      iniciadoEm: null,
      venceEm: null,
      duracaoDias: null,
      definidoPor: null,
      ultimoAvisoDias: null
    },
    compras: {
      pixKey: null
    },
    cancelamento: {
      ativo: false,
      motivo: null,
      canceladoPor: null,
      canceladoEm: null
    },
    mensagens: {
      entrada: "Bem-vindo(a), {user}, à {server}! Leia os canais de informações e aproveite sua experiência.",
      invites: "{user} entrou no servidor. Convite usado: {invite}. Total de membros: {members}."
    },
    inviteCache: {}
  };
}

function getGuildConfig(guildId) {
  const db = loadDB();
  const defaults = getDefaultGuildConfig();

  if (!db.guilds[guildId]) {
    db.guilds[guildId] = defaults;
    saveDB(db);
  } else {
    const normalized = deepMerge(defaults, db.guilds[guildId]);
    db.guilds[guildId] = normalized;
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

  if (config.plano !== "cancelado" && config.assinatura?.venceEm) {
    const vencimento = new Date(config.assinatura.venceEm);
    if (!Number.isNaN(vencimento.getTime()) && vencimento.getTime() < Date.now()) {
      return "cancelado";
    }
  }

  return PLANOS[config.plano] ? config.plano : "basic";
}

function getPlano(guildId) {
  const planoKey = getPlanoKey(guildId);
  return PLANOS[planoKey] || PLANOS.basic;
}

function setGuildPlan(guildId, plano, duracaoDias = 30, userId = null) {
  if (!["basic", "pro", "ultimate"].includes(plano)) {
    throw new Error("Plano inválido. Use basic, pro ou ultimate.");
  }

  const dias = Math.max(1, Math.min(3650, Number(duracaoDias || 30)));
  const agora = new Date();
  const venceEm = addDays(agora, dias).toISOString();

  return updateGuildConfig(guildId, {
    plano,
    assinatura: {
      status: "ativa",
      iniciadoEm: agora.toISOString(),
      venceEm,
      duracaoDias: dias,
      definidoPor: userId,
      ultimoAvisoDias: null
    },
    cancelamento: {
      ativo: false,
      motivo: null,
      canceladoPor: null,
      canceladoEm: null
    }
  });
}

function cancelGuildPlan(guildId, motivo, userId) {
  return updateGuildConfig(guildId, {
    plano: "cancelado",
    cancelamento: {
      ativo: true,
      motivo: motivo || "Não informado",
      canceladoPor: userId || null,
      canceladoEm: new Date().toISOString()
    },
    assinatura: {
      status: "cancelado"
    }
  });
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
    painelavancado: "basic",
    painelanvacado: "basic",
    verplano: "cancelado",
    painelverificar: "ultimate",
    addproduto: "basic",
    editarproduto: "basic",
    addticket: "pro",
    addcupom: "pro",
    cancelarplano: "ultimate",
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

function getGuildCoupons(guildId) {
  const db = loadDB();
  if (!db.coupons) db.coupons = {};
  if (!db.coupons[guildId]) {
    db.coupons[guildId] = [];
    saveDB(db);
  }
  return db.coupons[guildId];
}

function setGuildCoupons(guildId, coupons) {
  const db = loadDB();
  if (!db.coupons) db.coupons = {};
  db.coupons[guildId] = coupons;
  saveDB(db);
}

function getGuildCarts(guildId) {
  const db = loadDB();
  if (!db.carts) db.carts = {};
  if (!db.carts[guildId]) {
    db.carts[guildId] = {};
    saveDB(db);
  }
  return db.carts[guildId];
}

function setGuildCarts(guildId, carts) {
  const db = loadDB();
  if (!db.carts) db.carts = {};
  db.carts[guildId] = carts;
  saveDB(db);
}

function getCart(guildId, cartId) {
  const carts = getGuildCarts(guildId);
  return carts[cartId] || null;
}

function saveCart(guildId, cart) {
  const carts = getGuildCarts(guildId);
  carts[cart.id] = cart;
  setGuildCarts(guildId, carts);
}

function deleteCart(guildId, cartId) {
  const carts = getGuildCarts(guildId);
  delete carts[cartId];
  setGuildCarts(guildId, carts);
}

function moneyBR(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function formatDateBR(value) {
  if (!value) return "Não definido";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function getDaysRemaining(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getSubscriptionStatusText(config) {
  const assinatura = config.assinatura || {};
  if (config.plano === "cancelado" || assinatura.status === "cancelado") return "Cancelado";
  const dias = getDaysRemaining(assinatura.venceEm);
  if (dias === null) return "Sem vencimento configurado";
  if (dias < 0) return `Vencido há ${Math.abs(dias)} dia(s)`;
  if (dias === 0) return "Vence hoje";
  return `Vence em ${dias} dia(s)`;
}

function calculateCartTotal(cart) {
  const subtotal = Number(cart.productPrice || 0) * Number(cart.quantity || 1);
  const discountPercent = Number(cart.discountPercent || 0);
  const discountValue = subtotal * (discountPercent / 100);
  const total = Math.max(0, subtotal - discountValue);
  return { subtotal, discountPercent, discountValue, total };
}

async function getOrCreateCartCategory(guild) {
  const config = getGuildConfig(guild.id);

  if (config.canais?.categoriaCarrinho) {
    const configured = guild.channels.cache.get(config.canais.categoriaCarrinho);
    if (configured && configured.type === ChannelType.GuildCategory) return configured;
  }

  const existing = guild.channels.cache.find(
    channel => channel.type === ChannelType.GuildCategory && channel.name === "🛒・carrinhos"
  );

  if (existing) return existing;

  return guild.channels.create({
    name: "🛒・carrinhos",
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      }
    ]
  });
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
    .setName("painelavancado")
    .setDescription("Abre o painel avançado da Star Sallers."),

  new SlashCommandBuilder()
    .setName("painelanvacado")
    .setDescription("Abre o painel avançado da Star Sallers."),

  new SlashCommandBuilder()
    .setName("addproduto")
    .setDescription("Adiciona um produto completo à loja.")
    .addStringOption(option =>
      option
        .setName("titulo")
        .setDescription("Título do embed do produto")
        .setRequired(true)
    )
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
    .addIntegerOption(option =>
      option
        .setName("estoque")
        .setDescription("Quantidade em estoque")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("descricao")
        .setDescription("Descrição do produto")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("imagem")
        .setDescription("Link da imagem do produto")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("emoji")
        .setDescription("Emoji do botão do produto")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("cor")
        .setDescription("Cor em HEX. Exemplo: #FFFFFF")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("rodape")
        .setDescription("Texto do rodapé do embed")
        .setRequired(false)
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
        .setName("titulo")
        .setDescription("Novo título do embed")
        .setRequired(false)
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
    .addIntegerOption(option =>
      option
        .setName("estoque")
        .setDescription("Novo estoque do produto")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("descricao")
        .setDescription("Nova descrição do produto")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("imagem")
        .setDescription("Novo link da imagem")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("emoji")
        .setDescription("Novo emoji do botão")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("cor")
        .setDescription("Nova cor HEX. Exemplo: #FFFFFF")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("rodape")
        .setDescription("Novo rodapé")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("painelverificar")
    .setDescription("Cria um painel de verificação que entrega um cargo. Plano Ultimate.")
    .addStringOption(option =>
      option
        .setName("titulo")
        .setDescription("Título do painel de verificação")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("descricao")
        .setDescription("Descrição do painel de verificação")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("cargo_id")
        .setDescription("ID do cargo que será entregue ao clicar")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("botao")
        .setDescription("Texto do botão. Exemplo: Verificar")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("emoji")
        .setDescription("Emoji do botão. Exemplo: ✅")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("imagem")
        .setDescription("Link da imagem ou GIF do painel")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("cor")
        .setDescription("Cor do painel em HEX. Exemplo: #FFFFFF")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("rodape")
        .setDescription("Texto do rodapé do embed")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("addticket")
    .setDescription("Cria um painel de tickets com botões personalizados.")
    .addStringOption(option =>
      option
        .setName("titulo")
        .setDescription("Título do painel de tickets")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("descricao")
        .setDescription("Descrição do painel de tickets")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("botao1")
        .setDescription("Botão 1. Exemplo: 🎫 Suporte")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("botao2")
        .setDescription("Botão 2. Exemplo: 📦 Receber produtos")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("botao3")
        .setDescription("Botão 3. Exemplo: 🚨 Denúncia")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("botao4")
        .setDescription("Botão 4 opcional")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("botao5")
        .setDescription("Botão 5 opcional")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("categoria_id")
        .setDescription("ID da categoria onde os tickets serão criados")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("cor")
        .setDescription("Cor do painel em HEX. Exemplo: #FFFFFF")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("addcupom")
    .setDescription("Adiciona um cupom de desconto à loja. Plano Pro ou Ultimate.")
    .addStringOption(option =>
      option
        .setName("codigo")
        .setDescription("Código do cupom. Exemplo: STAR10")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("desconto")
        .setDescription("Desconto em porcentagem. Exemplo: 10")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName("verplano")
    .setDescription("Mostra as informações do plano e vencimento deste servidor.")
    .addStringOption(option =>
      option
        .setName("guild_id")
        .setDescription("ID do servidor para consulta. Apenas o dono do bot pode usar esta opção")
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
    .addIntegerOption(option =>
      option
        .setName("dias")
        .setDescription("Duração da assinatura em dias. Exemplo: 30 ou 90")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(3650)
    ),

  new SlashCommandBuilder()
    .setName("cancelarplano")
    .setDescription("Cancela o plano de um servidor inadimplente. Apenas o dono do bot pode usar.")
    .addStringOption(option =>
      option
        .setName("guild_id")
        .setDescription("ID do servidor que terá o plano cancelado")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("motivo")
        .setDescription("Motivo do cancelamento. Exemplo: inadimplência")
        .setRequired(false)
    )
].map(command => command.toJSON());

async function registerCommands() {
  if (!CLIENT_ID) {
    console.log("CLIENT_ID não encontrado no .env. Comandos não registrados.");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    console.log("Registrando comandos globais...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands
    });
    console.log("Comandos globais registrados com sucesso.");
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

  await checkPlanExpirations();
  setInterval(checkPlanExpirations, 1000 * 60 * 60 * 6);
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

async function checkPlanExpirations() {
  const db = loadDB();
  const now = Date.now();

  for (const [guildId, config] of Object.entries(db.guilds || {})) {
    if (!config || config.plano === "cancelado") continue;
    if (!config.assinatura?.venceEm) continue;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    const vencimento = new Date(config.assinatura.venceEm);
    if (Number.isNaN(vencimento.getTime())) continue;

    const dias = Math.ceil((vencimento.getTime() - now) / (1000 * 60 * 60 * 24));
    const avisoCanalId = config.canais?.avisosPlano;
    const canalAvisos = avisoCanalId ? guild.channels.cache.get(avisoCanalId) : null;

    if (dias < 0) {
      db.guilds[guildId] = deepMerge(config, {
        plano: "cancelado",
        assinatura: { status: "vencida", ultimoAvisoDias: "vencido" },
        cancelamento: {
          ativo: true,
          motivo: "Assinatura vencida automaticamente",
          canceladoPor: client.user?.id || null,
          canceladoEm: new Date().toISOString()
        }
      });
      saveDB(db);

      if (canalAvisos) {
        canalAvisos.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("⛔ Assinatura vencida")
              .setDescription("A assinatura deste servidor venceu e os recursos do Star Sallers foram bloqueados.\n\nPara reativar, entre em contato com a Star Applications.")
              .setColor("#FFFFFF")
              .setFooter({ text: "Star Applications • Gerenciamento de Plano" })
              .setTimestamp()
          ]
        }).catch(() => {});
      }
      continue;
    }

    if (![7, 3, 1, 0].includes(dias)) continue;
    if (String(config.assinatura?.ultimoAvisoDias) === String(dias)) continue;

    db.guilds[guildId] = deepMerge(config, {
      assinatura: { ultimoAvisoDias: dias }
    });
    saveDB(db);

    if (canalAvisos) {
      const textoDias = dias === 0 ? "vence hoje" : `vence em ${dias} dia(s)`;
      canalAvisos.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("⏰ Aviso de assinatura")
            .setDescription(`A assinatura do Star Sallers neste servidor **${textoDias}**.\n\nPara renovar ou gerenciar seu plano, entre no servidor oficial da Star Applications:\nhttps://discord.gg/RTEvRZYU4`)
            .setColor("#FFFFFF")
            .setFooter({ text: "Star Applications • Gerenciamento de Plano" })
            .setTimestamp()
        ]
      }).catch(() => {});
    }
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
      if (interaction.commandName === "cancelarplano") return handleCancelarPlano(interaction);
      if (interaction.commandName === "verplano") return handleVerPlano(interaction);

      const requiredPlan = getRequiredPlanForCommand(interaction.commandName);
      if (!hasPlan(interaction.guild.id, requiredPlan)) {
        const planoAtual = getPlano(interaction.guild.id);
        const planoNecessario = PLANOS[requiredPlan];

        const configAtual = getGuildConfig(interaction.guild.id);
        const motivoCancelamento = configAtual.cancelamento?.motivo || "assinatura cancelada";
        const mensagemBloqueio = getPlanoKey(interaction.guild.id) === "cancelado"
          ? `❌ A assinatura deste servidor está cancelada.\nMotivo: ${motivoCancelamento}\n\nPara voltar a usar o Star Sallers, entre em contato com a Star Applications e renove seu plano.`
          : `❌ Este comando pertence ao ${planoNecessario.nome}.\nSeu servidor está no ${planoAtual.nome}. Faça upgrade para usar.`;

        return interaction.reply({
          content: mensagemBloqueio,
          ephemeral: true
        });
      }

      if (interaction.commandName === "painel") return handlePainel(interaction);
      if (interaction.commandName === "painelavancado" || interaction.commandName === "painelanvacado") return handlePainelAvancado(interaction);
      if (interaction.commandName === "addproduto") return handleAddProduto(interaction);
      if (interaction.commandName === "editarproduto") return handleEditarProduto(interaction);
      if (interaction.commandName === "painelverificar") return handlePainelVerificar(interaction);
      if (interaction.commandName === "addticket") return handleAddTicket(interaction);
      if (interaction.commandName === "addcupom") return handleAddCupom(interaction);
    }

    if (interaction.isButton()) {
      if (interaction.customId === "painel_personalizacao") return handlePainelPersonalizacao(interaction);
      if (interaction.customId === "painel_planos") return handlePainelPlanos(interaction);
      if (interaction.customId === "adv_cupons") return handleAdvancedCoupons(interaction);
      if (interaction.customId === "adv_produtos") return handleAdvancedProducts(interaction);
      if (interaction.customId === "adv_embed") return openAdvancedEmbedModal(interaction);
      if (interaction.customId === "adv_compras") return handleAdvancedCompras(interaction);
      if (interaction.customId === "adv_status") return handleAdvancedStatus(interaction);
      if (interaction.customId === "adv_assinatura") return handleAdvancedAssinatura(interaction);
      if (interaction.customId === "adv_set_plan_notice") return openAdvancedPlanNoticeModal(interaction);
      if (interaction.customId === "adv_set_pix") return openAdvancedPixModal(interaction);
      if (interaction.customId === "adv_set_cart_category") return openAdvancedCartCategoryModal(interaction);
      if (interaction.customId === "adv_set_deliveries") return openAdvancedDeliveriesModal(interaction);
      if (interaction.customId === "config_canal_entrada") return openCanalEntradaModal(interaction);
      if (interaction.customId === "config_canal_invites") return openCanalInvitesModal(interaction);
      if (interaction.customId === "config_msg_entrada") return openMsgEntradaModal(interaction);
      if (interaction.customId === "config_msg_invites") return openMsgInvitesModal(interaction);
      if (interaction.customId.startsWith("comprar_")) return handleComprarProduto(interaction);
      if (interaction.customId.startsWith("cart_coupon_")) return openCartCouponModal(interaction);
      if (interaction.customId.startsWith("cart_payment_")) return handleCartPayment(interaction);
      if (interaction.customId.startsWith("cart_paid_")) return handleCartPaid(interaction);
      if (interaction.customId.startsWith("cart_confirm_")) return handleCartConfirm(interaction);
      if (interaction.customId.startsWith("cart_delivered_")) return handleCartDelivered(interaction);
      if (interaction.customId.startsWith("cart_close_")) return handleCartClose(interaction);
      if (interaction.customId.startsWith("verify_role_")) return handleVerifyRole(interaction);
      if (interaction.customId.startsWith("ticket_open_")) return handleOpenTicket(interaction);
      if (interaction.customId === "ticket_close") return handleCloseTicket(interaction);
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "select_plano") return handleSelectPlano(interaction);
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "modal_canal_entrada") return saveCanalEntrada(interaction);
      if (interaction.customId === "modal_canal_invites") return saveCanalInvites(interaction);
      if (interaction.customId === "modal_msg_entrada") return saveMsgEntrada(interaction);
      if (interaction.customId === "modal_msg_invites") return saveMsgInvites(interaction);
      if (interaction.customId.startsWith("modal_cart_coupon_")) return saveCartCoupon(interaction);
      if (interaction.customId === "modal_adv_pix") return saveAdvancedPix(interaction);
      if (interaction.customId === "modal_adv_cart_category") return saveAdvancedCartCategory(interaction);
      if (interaction.customId === "modal_adv_deliveries") return saveAdvancedDeliveries(interaction);
      if (interaction.customId === "modal_adv_embed") return sendAdvancedCustomEmbed(interaction);
      if (interaction.customId === "modal_adv_plan_notice") return saveAdvancedPlanNotice(interaction);
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
  setGuildPlan(interaction.guild.id, plano, 30, interaction.user.id);

  const planoInfo = PLANOS[plano];
  return interaction.reply({
    content: `✅ Plano alterado para ${planoInfo.emoji} **${planoInfo.nome}**.`,
    ephemeral: true
  });
}

async function handleVerPlano(interaction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: "❌ Este comando só pode ser usado dentro de um servidor.",
      ephemeral: true
    });
  }

  const requestedGuildId = interaction.options.getString("guild_id")?.trim() || interaction.guild.id;

  if (requestedGuildId !== interaction.guild.id && !isBotOwner(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Apenas o dono do bot pode consultar o plano de outro servidor.",
      ephemeral: true
    });
  }

  if (!isAdmin(interaction) && !isBotOwner(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Apenas administradores podem ver as informações do plano deste servidor.",
      ephemeral: true
    });
  }

  if (!/^\d{17,20}$/.test(requestedGuildId)) {
    return interaction.reply({
      content: "❌ ID do servidor inválido.",
      ephemeral: true
    });
  }

  const config = getGuildConfig(requestedGuildId);
  const planoKey = getPlanoKey(requestedGuildId);
  const plano = PLANOS[planoKey] || PLANOS.basic;
  const assinatura = config.assinatura || {};
  const dias = getDaysRemaining(assinatura.venceEm);
  const targetGuild = client.guilds.cache.get(requestedGuildId);
  const canalAvisos = config.canais?.avisosPlano ? `<#${config.canais.avisosPlano}>` : "Não configurado";
  const canalEntregas = config.canais?.entregas ? `<#${config.canais.entregas}>` : "Não configurado";
  const categoriaCarrinho = config.canais?.categoriaCarrinho ? `<#${config.canais.categoriaCarrinho}>` : "Não configurada";

  const embed = new EmbedBuilder()
    .setTitle("⏰ Informações do Plano")
    .setDescription(
      `Informações da assinatura do servidor.\n\n` +
      `**Servidor:** ${targetGuild ? targetGuild.name : "Não encontrado no cache do bot"}\n` +
      `**ID:** \`${requestedGuildId}\`\n` +
      `**Plano:** ${plano.emoji} **${plano.nome}**\n` +
      `**Status:** ${getSubscriptionStatusText(config)}\n` +
      `**Início:** ${formatDateBR(assinatura.iniciadoEm)}\n` +
      `**Vencimento:** ${formatDateBR(assinatura.venceEm)}\n` +
      `**Duração:** ${assinatura.duracaoDias ? `${assinatura.duracaoDias} dia(s)` : "Não definida"}\n` +
      `**Dias restantes:** ${dias === null ? "Não definido" : `${dias} dia(s)`}\n\n` +
      `**Canal de avisos:** ${canalAvisos}\n` +
      `**Categoria carrinho:** ${categoriaCarrinho}\n` +
      `**Canal de entregas:** ${canalEntregas}`
    )
    .setColor(config.corPrincipal || "#FFFFFF")
    .setFooter({ text: "Star Applications • Ver plano" })
    .setTimestamp();

  if (config.cancelamento?.ativo || planoKey === "cancelado") {
    embed.addFields({
      name: "⛔ Cancelamento",
      value:
        `Motivo: ${config.cancelamento?.motivo || "Não informado"}\n` +
        `Cancelado em: ${formatDateBR(config.cancelamento?.canceladoEm)}\n` +
        `Cancelado por: ${config.cancelamento?.canceladoPor ? `<@${config.cancelamento.canceladoPor}>` : "Não informado"}`,
      inline: false
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Gerenciar Plano")
      .setEmoji("🔗")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.gg/RTEvRZYU4")
  );

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
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
  const dias = interaction.options.getInteger("dias") || 30;

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
  const configAtualizada = setGuildPlan(guildId, plano, dias, interaction.user.id);

  const planoInfo = PLANOS[plano];

  return interaction.reply({
    content:
      `✅ Plano definido com sucesso.\n\n` +
      `Servidor: ${targetGuild ? `**${targetGuild.name}**` : "não encontrado no cache do bot"}\n` +
      `ID: \`${guildId}\`\n` +
      `Plano: ${planoInfo.emoji} **${planoInfo.nome}**\n` +
      `Duração: **${dias} dia(s)**\n` +
      `Vencimento: **${formatDateBR(configAtualizada.assinatura?.venceEm)}**`,
    ephemeral: true
  });
}

async function handleCancelarPlano(interaction) {
  if (!isBotOwner(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Apenas o dono do bot pode usar este comando.",
      ephemeral: true
    });
  }

  const guildId = interaction.options.getString("guild_id").trim();
  const motivo = interaction.options.getString("motivo")?.trim() || "Inadimplência / assinatura não renovada";

  if (!/^\d{17,20}$/.test(guildId)) {
    return interaction.reply({
      content: "❌ ID do servidor inválido. Ative o modo desenvolvedor e copie o ID do servidor.",
      ephemeral: true
    });
  }

  const targetGuild = client.guilds.cache.get(guildId);
  cancelGuildPlan(guildId, motivo, interaction.user.id);

  const config = getGuildConfig(guildId);
  const canceladoEm = config.cancelamento?.canceladoEm
    ? new Date(config.cancelamento.canceladoEm).toLocaleString("pt-BR")
    : "agora";

  return interaction.reply({
    content:
      `✅ Plano cancelado com sucesso.\n\n` +
      `Servidor: ${targetGuild ? `**${targetGuild.name}**` : "não encontrado no cache do bot"}\n` +
      `ID: \`${guildId}\`\n` +
      `Status: ⛔ **Cancelado**\n` +
      `Motivo: ${motivo}\n` +
      `Cancelado em: ${canceladoEm}\n\n` +
      `Os comandos pagos foram bloqueados para este servidor. Para reativar, use \`/setplano\` com basic, pro ou ultimate.`,
    ephemeral: true
  });
}


// =========================
// PAINEL AVANÇADO
// =========================

function requireAdvancedPlan(interaction, requiredPlan, label) {
  if (hasPlan(interaction.guild.id, requiredPlan)) return null;

  const planoAtual = getPlano(interaction.guild.id);
  const planoNecessario = PLANOS[requiredPlan] || PLANOS.basic;

  return interaction.reply({
    content:
      `❌ ${label} está disponível apenas para ${planoNecessario.nome}+.
` +
      `Seu servidor está no ${planoAtual.nome}.`,
    ephemeral: true
  });
}

async function handlePainelAvancado(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "❌ Apenas administradores podem usar o painel avançado.",
      ephemeral: true
    });
  }

  const config = getGuildConfig(interaction.guild.id);
  const plano = getPlano(interaction.guild.id);

  const embed = new EmbedBuilder()
    .setTitle("⚙️ Painel Avançado Star Sallers")
    .setDescription(
      `Configure e consulte recursos avançados da sua loja.\n\n` +
      `**Plano atual:** ${plano.emoji} ${plano.nome}\n\n` +
      `🥉 **Produtos:** Plano Bronze+\n` +
      `🥈 **Cupons:** Plano VIP+\n` +
      `🥉 **Compras:** Plano Bronze+\n` +
      `🥇 **Mensagem personalizada:** Plano Ultimate\n\n` +
      `Use os botões abaixo para abrir cada área.`
    )
    .setColor(config.corPrincipal || "#FFFFFF")
    .setFooter({ text: "Star Applications • Painel Avançado" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("adv_cupons")
      .setLabel("Cupons")
      .setEmoji("🎁")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("adv_produtos")
      .setLabel("Produtos")
      .setEmoji("📦")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("adv_embed")
      .setLabel("Mensagem Personalizada")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("adv_compras")
      .setLabel("Compras")
      .setEmoji("💳")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("adv_status")
      .setLabel("Status")
      .setEmoji("📊")
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("adv_assinatura")
      .setLabel("Assinatura")
      .setEmoji("⏰")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("Gerenciar Plano")
      .setEmoji("🔗")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.gg/RTEvRZYU4")
  );

  return interaction.reply({ embeds: [embed], components: [row, row2], ephemeral: true });
}

async function handleAdvancedAssinatura(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const config = getGuildConfig(interaction.guild.id);
  const plano = getPlano(interaction.guild.id);
  const assinatura = config.assinatura || {};
  const avisos = config.canais?.avisosPlano ? `<#${config.canais.avisosPlano}>` : "Não configurado";
  const dias = getDaysRemaining(assinatura.venceEm);

  const embed = new EmbedBuilder()
    .setTitle("⏰ Gerenciamento de Plano")
    .setDescription(
      `Veja as informações da assinatura deste servidor.

` +
      `**Plano atual:** ${plano.emoji} ${plano.nome}
` +
      `**Status:** ${getSubscriptionStatusText(config)}
` +
      `**Início:** ${formatDateBR(assinatura.iniciadoEm)}
` +
      `**Vencimento:** ${formatDateBR(assinatura.venceEm)}
` +
      `**Duração:** ${assinatura.duracaoDias ? `${assinatura.duracaoDias} dia(s)` : "Não definida"}
` +
      `**Dias restantes:** ${dias === null ? "Não definido" : `${dias} dia(s)`}
` +
      `**Canal de avisos:** ${avisos}

` +
      `Para renovar ou alterar seu plano, entre no servidor oficial da Star Applications.`
    )
    .setColor(config.corPrincipal || "#FFFFFF")
    .setFooter({ text: "Star Applications • Assinatura" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("adv_set_plan_notice")
      .setLabel("Canal de Avisos")
      .setEmoji("📢")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("Gerenciar Plano")
      .setEmoji("🔗")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.gg/RTEvRZYU4")
  );

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function openAdvancedPlanNoticeModal(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const config = getGuildConfig(interaction.guild.id);
  const modal = new ModalBuilder()
    .setCustomId("modal_adv_plan_notice")
    .setTitle("Canal de Avisos do Plano");

  const input = new TextInputBuilder()
    .setCustomId("canal_avisos_plano")
    .setLabel("ID do canal de avisos do plano")
    .setPlaceholder("Exemplo: 123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(config.canais?.avisosPlano || "").slice(0, 100));

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function saveAdvancedPlanNotice(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const channelId = interaction.fields.getTextInputValue("canal_avisos_plano").trim();
  const channel = interaction.guild.channels.cache.get(channelId);

  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.reply({
      content: "❌ Canal inválido. Copie o ID de um canal de texto.",
      ephemeral: true
    });
  }

  updateGuildConfig(interaction.guild.id, {
    canais: { avisosPlano: channelId }
  });

  return interaction.reply({
    content: `✅ Canal de avisos do plano configurado para ${channel}.`,
    ephemeral: true
  });
}

async function handleAdvancedCoupons(interaction) {
  const block = requireAdvancedPlan(interaction, "pro", "Cupons");
  if (block) return block;

  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const coupons = getGuildCoupons(interaction.guild.id);
  const config = getGuildConfig(interaction.guild.id);

  const lista = coupons.length
    ? coupons.map((c, i) => `**${i + 1}.** \`${c.codigo}\` — **${c.desconto}% OFF**`).join("\n")
    : "Nenhum cupom registrado ainda.";

  const embed = new EmbedBuilder()
    .setTitle("🎁 Cupons registrados")
    .setDescription(lista.slice(0, 3900))
    .setColor(config.corPrincipal || "#FFFFFF")
    .setFooter({ text: "Plano VIP+ • Star Applications" })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAdvancedProducts(interaction) {
  const block = requireAdvancedPlan(interaction, "basic", "Produtos");
  if (block) return block;

  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const products = getGuildProducts(interaction.guild.id);
  const config = getGuildConfig(interaction.guild.id);

  const lista = products.length
    ? products.map((p, i) => {
        const estoque = p.estoque ?? 0;
        return `**${i + 1}.** ${p.nome || "Sem nome"}\n` +
          `ID: \`${p.id}\` • Preço: **${moneyBR(p.preco)}** • Estoque: **${estoque}**`;
      }).join("\n\n")
    : "Nenhum produto registrado ainda.";

  const embed = new EmbedBuilder()
    .setTitle("📦 Produtos registrados")
    .setDescription(lista.slice(0, 3900))
    .setColor(config.corPrincipal || "#FFFFFF")
    .setFooter({ text: "Plano Bronze+ • Star Applications" })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAdvancedCompras(interaction) {
  const block = requireAdvancedPlan(interaction, "basic", "Compras");
  if (block) return block;

  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const config = getGuildConfig(interaction.guild.id);
  const pix = config.compras?.pixKey ? "Configurada" : "Não configurada";
  const categoria = config.canais?.categoriaCarrinho ? `<#${config.canais.categoriaCarrinho}>` : "Não configurada";
  const entregas = config.canais?.entregas ? `<#${config.canais.entregas}>` : "Não configurado";

  const embed = new EmbedBuilder()
    .setTitle("💳 Configurações de Compras")
    .setDescription(
      `Configure os dados usados no sistema de carrinho semi-automático.\n\n` +
      `**Chave Pix:** ${pix}\n` +
      `**Categoria dos carrinhos:** ${categoria}\n` +
      `**Canal de entregas:** ${entregas}`
    )
    .setColor(config.corPrincipal || "#FFFFFF")
    .setFooter({ text: "Plano Bronze+ • Star Applications" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("adv_set_pix")
      .setLabel("Chave Pix")
      .setEmoji("🔑")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("adv_set_cart_category")
      .setLabel("Categoria Carrinho")
      .setEmoji("🛒")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("adv_set_deliveries")
      .setLabel("Canal Entregas")
      .setEmoji("📦")
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleAdvancedStatus(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const config = getGuildConfig(interaction.guild.id);
  const plano = getPlano(interaction.guild.id);
  const products = getGuildProducts(interaction.guild.id);
  const coupons = getGuildCoupons(interaction.guild.id);
  const carts = Object.values(getGuildCarts(interaction.guild.id));

  const embed = new EmbedBuilder()
    .setTitle("📊 Status do sistema")
    .setColor(config.corPrincipal || "#FFFFFF")
    .addFields(
      { name: "Plano", value: `${plano.emoji} ${plano.nome}`, inline: true },
      { name: "Produtos", value: `${products.length}/${plano.maxProdutos}`, inline: true },
      { name: "Cupons", value: `${coupons.length}`, inline: true },
      { name: "Carrinhos salvos", value: `${carts.length}`, inline: true },
      { name: "Pix", value: config.compras?.pixKey ? "Configurado" : "Não configurado", inline: true },
      { name: "Canal entregas", value: config.canais?.entregas ? `<#${config.canais.entregas}>` : "Não configurado", inline: true },
      { name: "Assinatura", value: getSubscriptionStatusText(config), inline: true },
      { name: "Avisos do plano", value: config.canais?.avisosPlano ? `<#${config.canais.avisosPlano}>` : "Não configurado", inline: true }
    )
    .setFooter({ text: "Star Applications • Status" })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function openAdvancedPixModal(interaction) {
  const block = requireAdvancedPlan(interaction, "basic", "Compras");
  if (block) return block;

  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const config = getGuildConfig(interaction.guild.id);
  const modal = new ModalBuilder()
    .setCustomId("modal_adv_pix")
    .setTitle("Configurar Chave Pix");

  const input = new TextInputBuilder()
    .setCustomId("pix_key")
    .setLabel("Chave Pix")
    .setPlaceholder("E-mail, telefone, CPF/CNPJ ou chave aleatória")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(config.compras?.pixKey || "").slice(0, 100));

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function saveAdvancedPix(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const pixKey = interaction.fields.getTextInputValue("pix_key").trim();

  if (pixKey.length < 3 || pixKey.length > 120) {
    return interaction.reply({
      content: "❌ Chave Pix inválida. Use entre 3 e 120 caracteres.",
      ephemeral: true
    });
  }

  updateGuildConfig(interaction.guild.id, {
    compras: { pixKey }
  });

  return interaction.reply({
    content: "✅ Chave Pix configurada com sucesso. Ela será usada no botão **Ir para pagamento**.",
    ephemeral: true
  });
}

async function openAdvancedCartCategoryModal(interaction) {
  const block = requireAdvancedPlan(interaction, "basic", "Compras");
  if (block) return block;

  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const config = getGuildConfig(interaction.guild.id);
  const modal = new ModalBuilder()
    .setCustomId("modal_adv_cart_category")
    .setTitle("Categoria dos Carrinhos");

  const input = new TextInputBuilder()
    .setCustomId("categoria_carrinho")
    .setLabel("ID da categoria de carrinhos")
    .setPlaceholder("Exemplo: 123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(config.canais?.categoriaCarrinho || "").slice(0, 100));

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function saveAdvancedCartCategory(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const categoryId = interaction.fields.getTextInputValue("categoria_carrinho").trim();
  const category = interaction.guild.channels.cache.get(categoryId);

  if (!category || category.type !== ChannelType.GuildCategory) {
    return interaction.reply({
      content: "❌ Categoria inválida. Copie o ID de uma categoria do servidor.",
      ephemeral: true
    });
  }

  updateGuildConfig(interaction.guild.id, {
    canais: { categoriaCarrinho: categoryId }
  });

  return interaction.reply({
    content: `✅ Categoria dos carrinhos configurada para **${category.name}**.`,
    ephemeral: true
  });
}

async function openAdvancedDeliveriesModal(interaction) {
  const block = requireAdvancedPlan(interaction, "basic", "Compras");
  if (block) return block;

  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const config = getGuildConfig(interaction.guild.id);
  const modal = new ModalBuilder()
    .setCustomId("modal_adv_deliveries")
    .setTitle("Canal de Entregas");

  const input = new TextInputBuilder()
    .setCustomId("canal_entregas")
    .setLabel("ID do canal de entregas")
    .setPlaceholder("Exemplo: 123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(config.canais?.entregas || "").slice(0, 100));

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function saveAdvancedDeliveries(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const channelId = interaction.fields.getTextInputValue("canal_entregas").trim();
  const channel = interaction.guild.channels.cache.get(channelId);

  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.reply({
      content: "❌ Canal inválido. Copie o ID de um canal de texto.",
      ephemeral: true
    });
  }

  updateGuildConfig(interaction.guild.id, {
    canais: { entregas: channelId }
  });

  return interaction.reply({
    content: `✅ Canal de entregas configurado para ${channel}.`,
    ephemeral: true
  });
}

async function openAdvancedEmbedModal(interaction) {
  const block = requireAdvancedPlan(interaction, "ultimate", "Mensagem Personalizada");
  if (block) return block;

  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId("modal_adv_embed")
    .setTitle("Enviar Embed Personalizada");

  const channelInput = new TextInputBuilder()
    .setCustomId("canal_id")
    .setLabel("ID do canal onde será enviada")
    .setPlaceholder("Exemplo: 123456789012345678")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const titleInput = new TextInputBuilder()
    .setCustomId("titulo")
    .setLabel("Título da embed")
    .setPlaceholder("Exemplo: Star Applications")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("descricao")
    .setLabel("Descrição da embed")
    .setPlaceholder("Escreva a mensagem principal aqui")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const colorInput = new TextInputBuilder()
    .setCustomId("cor")
    .setLabel("Cor HEX")
    .setPlaceholder("#FFFFFF")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const imageInput = new TextInputBuilder()
    .setCustomId("imagem")
    .setLabel("Link de imagem opcional")
    .setPlaceholder("https://...")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(channelInput),
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descriptionInput),
    new ActionRowBuilder().addComponents(colorInput),
    new ActionRowBuilder().addComponents(imageInput)
  );

  return interaction.showModal(modal);
}

async function sendAdvancedCustomEmbed(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Sem permissão.", ephemeral: true });
  }

  if (!hasPlan(interaction.guild.id, "ultimate")) {
    return interaction.reply({
      content: "❌ Mensagem personalizada está disponível apenas no Plano Ultimate.",
      ephemeral: true
    });
  }

  const channelId = interaction.fields.getTextInputValue("canal_id").trim();
  const titulo = interaction.fields.getTextInputValue("titulo").trim();
  const descricao = interaction.fields.getTextInputValue("descricao").trim();
  const cor = interaction.fields.getTextInputValue("cor").trim() || "#FFFFFF";
  const imagem = interaction.fields.getTextInputValue("imagem").trim();

  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.reply({
      content: "❌ Canal inválido. Copie o ID de um canal de texto.",
      ephemeral: true
    });
  }

  if (!/^#[0-9A-Fa-f]{6}$/.test(cor)) {
    return interaction.reply({
      content: "❌ Cor inválida. Use formato HEX. Exemplo: #FFFFFF",
      ephemeral: true
    });
  }

  if (imagem && !/^https?:\/\//i.test(imagem)) {
    return interaction.reply({
      content: "❌ Link de imagem inválido. Use um link começando com http ou https.",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(titulo.slice(0, 256))
    .setDescription(descricao.slice(0, 4000))
    .setColor(cor)
    .setFooter({ text: "Star Applications" })
    .setTimestamp();

  if (imagem) embed.setImage(imagem);

  await channel.send({ embeds: [embed] });

  return interaction.reply({
    content: `✅ Embed personalizada enviada em ${channel}.`,
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
    return interaction.reply({
      content: "❌ Apenas administradores podem adicionar produtos.",
      ephemeral: true
    });
  }

  const plano = getPlano(interaction.guild.id);
  const products = getGuildProducts(interaction.guild.id);

  if (products.length >= plano.maxProdutos) {
    return interaction.reply({
      content: `❌ Seu plano atual permite até ${plano.maxProdutos} produtos. Faça upgrade para adicionar mais.`,
      ephemeral: true
    });
  }

  const titulo = interaction.options.getString("titulo");
  const nome = interaction.options.getString("nome");
  const preco = interaction.options.getNumber("preco");
  const estoque = interaction.options.getInteger("estoque");
  const descricao = interaction.options.getString("descricao");
  const imagem = interaction.options.getString("imagem") || null;
  const emoji = interaction.options.getString("emoji") || "🛒";
  const cor = interaction.options.getString("cor") || "#FFFFFF";
  const rodape = interaction.options.getString("rodape") || "Star Applications • Star Sallers";

  if (!/^#[0-9A-Fa-f]{6}$/.test(cor)) {
    return interaction.reply({
      content: "❌ Cor inválida. Use formato HEX. Exemplo: #FFFFFF",
      ephemeral: true
    });
  }

  if (imagem && !/^https?:\/\//i.test(imagem)) {
    return interaction.reply({
      content: "❌ Link de imagem inválido. Use um link começando com http ou https.",
      ephemeral: true
    });
  }

  if (preco <= 0) {
    return interaction.reply({
      content: "❌ O preço precisa ser maior que zero.",
      ephemeral: true
    });
  }

  if (estoque < 0) {
    return interaction.reply({
      content: "❌ O estoque não pode ser negativo.",
      ephemeral: true
    });
  }

  const produto = {
    id: Date.now().toString(),
    titulo,
    nome,
    preco,
    estoque,
    descricao,
    imagem,
    emoji,
    cor,
    rodape,
    criadoPor: interaction.user.id,
    criadoEm: new Date().toISOString()
  };

  products.push(produto);
  setGuildProducts(interaction.guild.id, products);

  const embed = new EmbedBuilder()
    .setTitle(titulo)
    .setDescription(descricao)
    .setColor(cor)
    .addFields(
      { name: "🆔 ID do Produto", value: `\`${produto.id}\``, inline: false },
      { name: "📦 Produto", value: nome, inline: true },
      { name: "💰 Preço", value: `R$ ${preco.toFixed(2).replace(".", ",")}`, inline: true },
      { name: "📊 Estoque", value: `${estoque}`, inline: true }
    )
    .setFooter({ text: rodape })
    .setTimestamp();

  if (imagem) embed.setImage(imagem);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`comprar_${produto.id}`)
      .setLabel("Comprar")
      .setEmoji(emoji)
      .setStyle(ButtonStyle.Success)
  );

  return interaction.reply({
    content: "✅ Produto adicionado com sucesso.",
    embeds: [embed],
    components: [row],
    ephemeral: false
  });
}

async function handleEditarProduto(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "❌ Apenas administradores podem editar produtos.",
      ephemeral: true
    });
  }

  const id = interaction.options.getString("id");
  const titulo = interaction.options.getString("titulo");
  const nome = interaction.options.getString("nome");
  const preco = interaction.options.getNumber("preco");
  const estoque = interaction.options.getInteger("estoque");
  const descricao = interaction.options.getString("descricao");
  const imagem = interaction.options.getString("imagem");
  const emoji = interaction.options.getString("emoji");
  const cor = interaction.options.getString("cor");
  const rodape = interaction.options.getString("rodape");

  const products = getGuildProducts(interaction.guild.id);
  const index = products.findIndex(p => p.id === id);

  if (index === -1) {
    return interaction.reply({
      content: "❌ Produto não encontrado. Confira o ID e tente novamente.",
      ephemeral: true
    });
  }

  if (!titulo && !nome && preco === null && estoque === null && !descricao && !imagem && !emoji && !cor && !rodape) {
    return interaction.reply({
      content: "❌ Informe pelo menos uma opção para editar.",
      ephemeral: true
    });
  }

  if (cor && !/^#[0-9A-Fa-f]{6}$/.test(cor)) {
    return interaction.reply({
      content: "❌ Cor inválida. Use formato HEX. Exemplo: #FFFFFF",
      ephemeral: true
    });
  }

  if (imagem && !/^https?:\/\//i.test(imagem)) {
    return interaction.reply({
      content: "❌ Link de imagem inválido. Use um link começando com http ou https.",
      ephemeral: true
    });
  }

  if (preco !== null && preco <= 0) {
    return interaction.reply({
      content: "❌ O preço precisa ser maior que zero.",
      ephemeral: true
    });
  }

  if (estoque !== null && estoque < 0) {
    return interaction.reply({
      content: "❌ O estoque não pode ser negativo.",
      ephemeral: true
    });
  }

  if (titulo) products[index].titulo = titulo;
  if (nome) products[index].nome = nome;
  if (preco !== null) products[index].preco = preco;
  if (estoque !== null) products[index].estoque = estoque;
  if (descricao) products[index].descricao = descricao;
  if (imagem) products[index].imagem = imagem;
  if (emoji) products[index].emoji = emoji;
  if (cor) products[index].cor = cor;
  if (rodape) products[index].rodape = rodape;

  products[index].editadoPor = interaction.user.id;
  products[index].editadoEm = new Date().toISOString();

  setGuildProducts(interaction.guild.id, products);

  const produto = products[index];
  const embed = new EmbedBuilder()
    .setTitle(produto.titulo || produto.nome)
    .setDescription(produto.descricao || "Sem descrição.")
    .setColor(produto.cor || "#FFFFFF")
    .addFields(
      { name: "🆔 ID do Produto", value: `\`${produto.id}\``, inline: false },
      { name: "📦 Produto", value: produto.nome || "Sem nome", inline: true },
      { name: "💰 Preço", value: `R$ ${Number(produto.preco || 0).toFixed(2).replace(".", ",")}`, inline: true },
      { name: "📊 Estoque", value: `${produto.estoque ?? 0}`, inline: true }
    )
    .setFooter({ text: produto.rodape || "Star Applications • Star Sallers" })
    .setTimestamp();

  if (produto.imagem) embed.setImage(produto.imagem);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`comprar_${produto.id}`)
      .setLabel("Comprar")
      .setEmoji(produto.emoji || "🛒")
      .setStyle(ButtonStyle.Success)
  );

  return interaction.reply({
    content: "✅ Produto editado com sucesso.",
    embeds: [embed],
    components: [row],
    ephemeral: false
  });
}


async function handleComprarProduto(interaction) {
  const productId = interaction.customId.replace("comprar_", "");
  const products = getGuildProducts(interaction.guild.id);
  const produto = products.find(p => p.id === productId);

  if (!produto) {
    return interaction.reply({
      content: "❌ Produto não encontrado ou foi removido.",
      ephemeral: true
    });
  }

  if (Number(produto.estoque ?? 0) <= 0) {
    return interaction.reply({
      content: "❌ Este produto está sem estoque no momento.",
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const category = await getOrCreateCartCategory(interaction.guild);
  const cartId = `${Date.now()}`;
  const safeUser = interaction.user.username
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase()
    .slice(0, 18);

  const channel = await interaction.guild.channels.create({
    name: `carrinho-${safeUser}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        id: client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ]
  });

  const cart = {
    id: cartId,
    guildId: interaction.guild.id,
    channelId: channel.id,
    userId: interaction.user.id,
    productId: produto.id,
    productName: produto.nome,
    productPrice: Number(produto.preco || 0),
    quantity: 1,
    couponCode: null,
    discountPercent: 0,
    status: "aberto",
    createdAt: new Date().toISOString()
  };

  saveCart(interaction.guild.id, cart);

  await sendOrUpdateCartMessage(channel, cart, interaction.user);

  return interaction.editReply({
    content: `✅ Carrinho criado com sucesso: ${channel}`
  });
}

async function sendOrUpdateCartMessage(channel, cart, user) {
  const totals = calculateCartTotal(cart);
  const config = getGuildConfig(cart.guildId);

  const embed = new EmbedBuilder()
    .setTitle("🛒 Carrinho de compra")
    .setDescription(
      `Olá, ${user}. Confira o resumo do seu pedido abaixo.\n\n` +
      `Quando estiver tudo certo, clique em **Ir para pagamento**.`
    )
    .setColor(config.corPrincipal || "#FFFFFF")
    .addFields(
      { name: "📦 Produto", value: cart.productName || "Produto", inline: false },
      { name: "🔢 Quantidade", value: `${cart.quantity || 1}`, inline: true },
      { name: "💰 Subtotal", value: moneyBR(totals.subtotal), inline: true },
      { name: "🎁 Cupom", value: cart.couponCode ? `\`${cart.couponCode}\` - ${totals.discountPercent}% OFF` : "Nenhum", inline: true },
      { name: "💸 Desconto", value: moneyBR(totals.discountValue), inline: true },
      { name: "✅ Total", value: `**${moneyBR(totals.total)}**`, inline: true },
      { name: "📌 Status", value: cart.status || "aberto", inline: true }
    )
    .setFooter({ text: "Star Applications • Compra semi-automática" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cart_coupon_${cart.id}`)
      .setLabel("Aplicar cupom")
      .setEmoji("🎁")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`cart_payment_${cart.id}`)
      .setLabel("Ir para pagamento")
      .setEmoji("💳")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`cart_close_${cart.id}`)
      .setLabel("Cancelar")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );

  return channel.send({
    content: `<@${cart.userId}>`,
    embeds: [embed],
    components: [row]
  });
}

async function openCartCouponModal(interaction) {
  const cartId = interaction.customId.replace("cart_coupon_", "");
  const cart = getCart(interaction.guild.id, cartId);

  if (!cart) {
    return interaction.reply({ content: "❌ Carrinho não encontrado.", ephemeral: true });
  }

  if (interaction.user.id !== cart.userId && !isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Apenas o dono do carrinho pode aplicar cupom.", ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`modal_cart_coupon_${cart.id}`)
    .setTitle("Aplicar cupom");

  const input = new TextInputBuilder()
    .setCustomId("codigo_cupom")
    .setLabel("Código do cupom")
    .setPlaceholder("Exemplo: STAR10")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

async function saveCartCoupon(interaction) {
  const cartId = interaction.customId.replace("modal_cart_coupon_", "");
  const cart = getCart(interaction.guild.id, cartId);

  if (!cart) {
    return interaction.reply({ content: "❌ Carrinho não encontrado.", ephemeral: true });
  }

  if (interaction.user.id !== cart.userId && !isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Apenas o dono do carrinho pode aplicar cupom.", ephemeral: true });
  }

  const codigo = interaction.fields.getTextInputValue("codigo_cupom").trim().toUpperCase();
  const coupons = getGuildCoupons(interaction.guild.id);
  const cupom = coupons.find(c => c.codigo === codigo);

  if (!cupom) {
    return interaction.reply({ content: "❌ Cupom inválido ou inexistente.", ephemeral: true });
  }

  cart.couponCode = cupom.codigo;
  cart.discountPercent = Number(cupom.desconto || 0);
  cart.status = "cupom aplicado";
  saveCart(interaction.guild.id, cart);

  await interaction.reply({
    content: `✅ Cupom aplicado: \`${cupom.codigo}\` com ${cupom.desconto}% OFF.`,
    ephemeral: true
  });

  const channel = interaction.guild.channels.cache.get(cart.channelId);
  if (channel) {
    const user = await interaction.guild.members.fetch(cart.userId).catch(() => null);
    await sendOrUpdateCartMessage(channel, cart, user?.user || interaction.user);
  }
}

async function handleCartPayment(interaction) {
  const cartId = interaction.customId.replace("cart_payment_", "");
  const cart = getCart(interaction.guild.id, cartId);

  if (!cart) {
    return interaction.reply({ content: "❌ Carrinho não encontrado.", ephemeral: true });
  }

  if (interaction.user.id !== cart.userId && !isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Apenas o dono do carrinho pode ir para o pagamento.", ephemeral: true });
  }

  const totals = calculateCartTotal(cart);
  const config = getGuildConfig(interaction.guild.id);
  const pixKey = config.compras?.pixKey || process.env.PIX_KEY || process.env.PIX_CHAVE || "Configure a chave Pix em /painelavancado > Compras";

  cart.status = "aguardando pagamento";
  saveCart(interaction.guild.id, cart);

  const embed = new EmbedBuilder()
    .setTitle("💳 Pagamento semi-automático")
    .setDescription(
      `Realize o pagamento e depois clique em **Já paguei**.\n\n` +
      `**Produto:** ${cart.productName}\n` +
      `**Total:** ${moneyBR(totals.total)}\n\n` +
      `**Chave Pix:**\n\`${pixKey}\`\n\n` +
      `Após enviar o comprovante neste carrinho, a equipe irá confirmar manualmente.`
    )
    .setColor("#FFFFFF")
    .setFooter({ text: "Star Applications • Aguardando pagamento" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cart_paid_${cart.id}`)
      .setLabel("Já paguei")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`cart_close_${cart.id}`)
      .setLabel("Cancelar")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({ embeds: [embed], components: [row] });
}

async function handleCartPaid(interaction) {
  const cartId = interaction.customId.replace("cart_paid_", "");
  const cart = getCart(interaction.guild.id, cartId);

  if (!cart) {
    return interaction.reply({ content: "❌ Carrinho não encontrado.", ephemeral: true });
  }

  if (interaction.user.id !== cart.userId && !isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Apenas o dono do carrinho pode marcar como pago.", ephemeral: true });
  }

  cart.status = "pagamento enviado";
  cart.paidAt = new Date().toISOString();
  saveCart(interaction.guild.id, cart);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cart_confirm_${cart.id}`)
      .setLabel("Confirmar pagamento")
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`cart_close_${cart.id}`)
      .setLabel("Fechar carrinho")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({
    content:
      `✅ <@${cart.userId}> marcou o pedido como pago.\n` +
      `🛡️ Equipe, confira o comprovante e clique em **Confirmar pagamento**.`,
    components: [row]
  });
}

async function handleCartConfirm(interaction) {
  const cartId = interaction.customId.replace("cart_confirm_", "");
  const cart = getCart(interaction.guild.id, cartId);

  if (!cart) {
    return interaction.reply({ content: "❌ Carrinho não encontrado.", ephemeral: true });
  }

  if (!isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Apenas administradores podem confirmar pagamento.", ephemeral: true });
  }

  const products = getGuildProducts(interaction.guild.id);
  const index = products.findIndex(p => p.id === cart.productId);

  if (index >= 0 && Number(products[index].estoque ?? 0) > 0) {
    products[index].estoque = Number(products[index].estoque || 0) - Number(cart.quantity || 1);
    setGuildProducts(interaction.guild.id, products);
  }

  cart.status = "pagamento confirmado";
  cart.confirmedBy = interaction.user.id;
  cart.confirmedAt = new Date().toISOString();
  saveCart(interaction.guild.id, cart);

  const totals = calculateCartTotal(cart);
  const config = getGuildConfig(interaction.guild.id);

  if (config.canais.logsVendas) {
    const logs = interaction.guild.channels.cache.get(config.canais.logsVendas);
    if (logs) {
      logs.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("💰 Venda confirmada")
            .setColor("#FFFFFF")
            .addFields(
              { name: "Cliente", value: `<@${cart.userId}>`, inline: true },
              { name: "Produto", value: cart.productName, inline: true },
              { name: "Total", value: moneyBR(totals.total), inline: true },
              { name: "Cupom", value: cart.couponCode || "Nenhum", inline: true },
              { name: "Confirmado por", value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp()
        ]
      }).catch(() => {});
    }
  }

  if (config.canais.entregas) {
    const canalEntregas = interaction.guild.channels.cache.get(config.canais.entregas);
    if (canalEntregas) {
      canalEntregas.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("📦 Entrega pendente")
            .setDescription("Uma compra foi confirmada e está pronta para entrega ou ativação.")
            .setColor("#FFFFFF")
            .addFields(
              { name: "Cliente", value: `<@${cart.userId}>`, inline: true },
              { name: "Produto", value: cart.productName, inline: true },
              { name: "Total", value: moneyBR(totals.total), inline: true },
              { name: "Carrinho", value: `<#${cart.channelId}>`, inline: true }
            )
            .setFooter({ text: "Star Applications • Entregas" })
            .setTimestamp()
        ]
      }).catch(() => {});
    }
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cart_delivered_${cart.id}`)
      .setLabel("Produto Entregue!")
      .setEmoji("📦")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`cart_close_${cart.id}`)
      .setLabel("Fechar carrinho")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({
    content:
      `✅ Pagamento confirmado com sucesso.\n\n` +
      `Cliente: <@${cart.userId}>\n` +
      `Produto: **${cart.productName}**\n` +
      `Total: **${moneyBR(totals.total)}**\n\n` +
      `Após entregar o pedido, clique em **Produto Entregue!** para registrar no canal de entregas.`,
    components: [row],
    ephemeral: false
  });
}

async function handleCartDelivered(interaction) {
  const cartId = interaction.customId.replace("cart_delivered_", "");
  const cart = getCart(interaction.guild.id, cartId);

  if (!cart) {
    return interaction.reply({
      content: "❌ Carrinho não encontrado.",
      ephemeral: true
    });
  }

  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "❌ Apenas administradores podem marcar o produto como entregue.",
      ephemeral: true
    });
  }

  if (cart.status === "produto entregue") {
    return interaction.reply({
      content: "⚠️ Este pedido já foi marcado como entregue.",
      ephemeral: true
    });
  }

  const config = getGuildConfig(interaction.guild.id);
  const totals = calculateCartTotal(cart);

  cart.status = "produto entregue";
  cart.deliveredBy = interaction.user.id;
  cart.deliveredAt = new Date().toISOString();
  saveCart(interaction.guild.id, cart);

  let entregaEnviada = false;

  if (config.canais.entregas) {
    const canalEntregas = interaction.guild.channels.cache.get(config.canais.entregas);

    if (canalEntregas) {
      await canalEntregas.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("📦 Produto entregue")
            .setDescription("Um pedido foi marcado como entregue pela equipe.")
            .setColor("#FFFFFF")
            .addFields(
              { name: "Cliente", value: `<@${cart.userId}>`, inline: true },
              { name: "Produto", value: cart.productName || "Produto", inline: true },
              { name: "Total", value: moneyBR(totals.total), inline: true },
              { name: "Entregue por", value: `<@${interaction.user.id}>`, inline: true },
              { name: "Carrinho", value: `<#${cart.channelId}>`, inline: true }
            )
            .setFooter({ text: "Star Applications • Pedido entregue" })
            .setTimestamp()
        ]
      }).catch(() => null);

      entregaEnviada = true;
    }
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cart_close_${cart.id}`)
      .setLabel("Fechar carrinho")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.reply({
    content:
      `✅ Produto marcado como entregue.\n\n` +
      `Cliente: <@${cart.userId}>\n` +
      `Produto: **${cart.productName}**\n` +
      `Canal de entregas: ${entregaEnviada ? "mensagem enviada com sucesso." : "não configurado ou não encontrado."}`,
    components: [row],
    ephemeral: false
  });
}

async function handleCartClose(interaction) {
  const cartId = interaction.customId.replace("cart_close_", "");
  const cart = getCart(interaction.guild.id, cartId);

  if (cart && interaction.user.id !== cart.userId && !isAdmin(interaction)) {
    return interaction.reply({ content: "❌ Apenas o dono do carrinho ou um administrador pode fechar.", ephemeral: true });
  }

  if (cart) deleteCart(interaction.guild.id, cartId);

  await interaction.reply({ content: "🗑️ Carrinho será fechado em 5 segundos.", ephemeral: true }).catch(() => {});
  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);
}


// =========================
// PAINEL DE VERIFICAÇÃO
// =========================

async function handlePainelVerificar(interaction) {
  if (!hasPlan(interaction.guild.id, "ultimate")) {
    return interaction.reply({
      content: "❌ O comando /painelverificar está disponível apenas no Plano Ultimate.",
      ephemeral: true
    });
  }

  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "❌ Apenas administradores podem criar painel de verificação.",
      ephemeral: true
    });
  }

  const titulo = interaction.options.getString("titulo");
  const descricao = interaction.options.getString("descricao");
  const cargoId = interaction.options.getString("cargo_id").trim();
  const botao = interaction.options.getString("botao").trim().slice(0, 80);
  const emoji = interaction.options.getString("emoji")?.trim() || "✅";
  const imagem = interaction.options.getString("imagem")?.trim() || null;
  const cor = interaction.options.getString("cor") || "#FFFFFF";
  const rodape = interaction.options.getString("rodape") || "Star Applications • Verificação";

  if (!/^#[0-9A-Fa-f]{6}$/.test(cor)) {
    return interaction.reply({
      content: "❌ Cor inválida. Use formato HEX. Exemplo: #FFFFFF",
      ephemeral: true
    });
  }

  if (!/^\d{17,20}$/.test(cargoId)) {
    return interaction.reply({
      content: "❌ ID do cargo inválido. Ative o modo desenvolvedor e copie o ID do cargo.",
      ephemeral: true
    });
  }

  if (imagem && !/^https?:\/\//i.test(imagem)) {
    return interaction.reply({
      content: "❌ Link de imagem inválido. Use um link começando com http ou https.",
      ephemeral: true
    });
  }

  const role = interaction.guild.roles.cache.get(cargoId);
  if (!role || role.managed || role.id === interaction.guild.roles.everyone.id) {
    return interaction.reply({
      content: "❌ Cargo inválido. Confira se o ID é de um cargo normal do servidor.",
      ephemeral: true
    });
  }

  const me = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
  if (!me || !me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return interaction.reply({
      content: "❌ O bot precisa da permissão **Gerenciar Cargos** para entregar esse cargo.",
      ephemeral: true
    });
  }

  if (role.position >= me.roles.highest.position) {
    return interaction.reply({
      content: "❌ O cargo escolhido está acima ou no mesmo nível do cargo do bot. Coloque o cargo do bot acima do cargo de verificação.",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(titulo)
    .setDescription(descricao)
    .setColor(cor)
    .setFooter({ text: rodape })
    .setTimestamp();

  if (imagem) embed.setImage(imagem);

  const button = new ButtonBuilder()
    .setCustomId(`verify_role_${cargoId}`)
    .setLabel(botao)
    .setStyle(ButtonStyle.Success);

  if (emoji) {
    try {
      button.setEmoji(emoji);
    } catch (_) {}
  }

  const row = new ActionRowBuilder().addComponents(button);

  await interaction.channel.send({
    embeds: [embed],
    components: [row]
  });

  return interaction.reply({
    content: `✅ Painel de verificação criado com sucesso.\nCargo configurado: ${role}`,
    ephemeral: true
  });
}

async function handleVerifyRole(interaction) {
  if (!hasPlan(interaction.guild.id, "ultimate")) {
    return interaction.reply({
      content: "❌ A verificação por botão está disponível apenas enquanto o servidor estiver no Plano Ultimate.",
      ephemeral: true
    });
  }

  const roleId = interaction.customId.replace("verify_role_", "");
  const role = interaction.guild.roles.cache.get(roleId);

  if (!role || role.managed || role.id === interaction.guild.roles.everyone.id) {
    return interaction.reply({
      content: "❌ Cargo de verificação não encontrado ou inválido.",
      ephemeral: true
    });
  }

  const member = interaction.member;
  if (member.roles.cache.has(role.id)) {
    return interaction.reply({
      content: `✅ Você já está verificado e já possui o cargo ${role}.`,
      ephemeral: true
    });
  }

  const me = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
  if (!me || !me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return interaction.reply({
      content: "❌ O bot está sem permissão de Gerenciar Cargos.",
      ephemeral: true
    });
  }

  if (role.position >= me.roles.highest.position) {
    return interaction.reply({
      content: "❌ Não consigo entregar esse cargo porque ele está acima ou no mesmo nível do meu cargo.",
      ephemeral: true
    });
  }

  await member.roles.add(role, "Verificação pelo painel Star Sallers");

  return interaction.reply({
    content: `✅ Verificação concluída. Você recebeu o cargo ${role}.`,
    ephemeral: true
  });
}

// =========================
// TICKETS
// =========================

function sanitizeTicketName(text) {
  return String(text || "ticket")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 24) || "ticket";
}

function parseTicketButton(raw, index) {
  const text = String(raw || "").trim();
  if (!text) return null;

  const parts = text.split("|").map(part => part.trim()).filter(Boolean);

  if (parts.length >= 2) {
    return {
      emoji: parts[0],
      label: parts.slice(1).join(" ").slice(0, 80),
      id: sanitizeTicketName(parts.slice(1).join(" ")) || `opcao-${index}`
    };
  }

  const emojiMatch = text.match(/^([^\w\s]{1,4})\s+(.+)/u);
  if (emojiMatch) {
    return {
      emoji: emojiMatch[1],
      label: emojiMatch[2].slice(0, 80),
      id: sanitizeTicketName(emojiMatch[2]) || `opcao-${index}`
    };
  }

  return {
    emoji: "🎫",
    label: text.slice(0, 80),
    id: sanitizeTicketName(text) || `opcao-${index}`
  };
}

async function handleAddTicket(interaction) {
  if (!hasPlan(interaction.guild.id, "pro")) {
    return interaction.reply({
      content: "❌ O comando /addticket está disponível apenas no Plano Pro ou Ultimate.",
      ephemeral: true
    });
  }

  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "❌ Apenas administradores podem criar painel de tickets.",
      ephemeral: true
    });
  }

  const titulo = interaction.options.getString("titulo");
  const descricao = interaction.options.getString("descricao");
  const categoriaId = interaction.options.getString("categoria_id")?.trim() || null;
  const cor = interaction.options.getString("cor") || "#FFFFFF";

  if (!/^#[0-9A-Fa-f]{6}$/.test(cor)) {
    return interaction.reply({
      content: "❌ Cor inválida. Use formato HEX. Exemplo: #FFFFFF",
      ephemeral: true
    });
  }

  let parentId = null;
  if (categoriaId) {
    const categoria = interaction.guild.channels.cache.get(categoriaId);
    if (!categoria || categoria.type !== ChannelType.GuildCategory) {
      return interaction.reply({
        content: "❌ Categoria inválida. Envie o ID de uma categoria do servidor.",
        ephemeral: true
      });
    }
    parentId = categoriaId;
  }

  const buttons = [];
  for (let i = 1; i <= 5; i++) {
    const raw = interaction.options.getString(`botao${i}`);
    const parsed = parseTicketButton(raw, i);
    if (parsed) buttons.push(parsed);
  }

  if (!buttons.length) {
    return interaction.reply({
      content: "❌ Adicione pelo menos um botão ao painel.",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(titulo)
    .setDescription(descricao)
    .setColor(cor)
    .setFooter({ text: "Star Applications • Sistema de Tickets" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    buttons.map(btn => {
      const button = new ButtonBuilder()
        .setCustomId(`ticket_open_${btn.id}__${parentId || "none"}`)
        .setLabel(btn.label)
        .setStyle(ButtonStyle.Secondary);

      if (btn.emoji) button.setEmoji(btn.emoji);
      return button;
    })
  );

  await interaction.channel.send({
    embeds: [embed],
    components: [row]
  });

  return interaction.reply({
    content: `✅ Painel de tickets criado com ${buttons.length} botão(ões).${parentId ? `\nCategoria dos tickets: <#${parentId}>` : ""}`,
    ephemeral: true
  });
}

async function handleOpenTicket(interaction) {
  const rawTicketData = interaction.customId.replace("ticket_open_", "");
  const [rawTicketType, rawParentId] = rawTicketData.split("__");
  const ticketType = rawTicketType || "ticket";
  const configuredParentId = rawParentId && rawParentId !== "none" ? rawParentId : null;
  const cleanUser = sanitizeTicketName(interaction.user.username).slice(0, 18);
  const channelName = `ticket-${ticketType}-${cleanUser}`.slice(0, 90);

  const existing = interaction.guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildText &&
    channel.name === channelName &&
    channel.topic &&
    channel.topic.includes(`USER_ID:${interaction.user.id}`)
  );

  if (existing) {
    return interaction.reply({
      content: `❌ Você já possui um ticket aberto: ${existing}`,
      ephemeral: true
    });
  }

  let parentId = configuredParentId || interaction.channel.parentId || null;

  if (parentId) {
    const categoria = interaction.guild.channels.cache.get(parentId);
    if (!categoria || categoria.type !== ChannelType.GuildCategory) parentId = null;
  }

  const ticketChannel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parentId,
    topic: `Ticket ${ticketType} | USER_ID:${interaction.user.id}`,
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles
        ]
      },
      {
        id: interaction.client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ]
  });

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Fechar ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  const embed = new EmbedBuilder()
    .setTitle("🎫 Ticket aberto")
    .setDescription(
      `Olá, ${interaction.user}.\n\n` +
      `Tipo do atendimento: **${ticketType.replaceAll("-", " ")}**\n` +
      `Explique seu pedido com detalhes para a equipe conseguir ajudar melhor.\n\n` +
      `Para fechar este atendimento, clique no botão abaixo.`
    )
    .setColor("#FFFFFF")
    .setFooter({ text: "Star Applications • Ticket" })
    .setTimestamp();

  await ticketChannel.send({
    content: `${interaction.user}`,
    embeds: [embed],
    components: [closeRow]
  });

  return interaction.reply({
    content: `✅ Ticket criado: ${ticketChannel}`,
    ephemeral: true
  });
}

async function handleCloseTicket(interaction) {
  const topic = interaction.channel?.topic || "";
  const isTicket = interaction.channel?.name?.startsWith("ticket-") || topic.includes("USER_ID:");

  if (!isTicket) {
    return interaction.reply({
      content: "❌ Este botão só pode ser usado dentro de um ticket.",
      ephemeral: true
    });
  }

  const ownerId = topic.match(/USER_ID:(\d{17,20})/)?.[1];
  const canClose = isAdmin(interaction) || interaction.user.id === ownerId;

  if (!canClose) {
    return interaction.reply({
      content: "❌ Apenas o dono do ticket ou um administrador pode fechar este ticket.",
      ephemeral: true
    });
  }

  await interaction.reply({
    content: "🔒 Ticket será fechado em 5 segundos.",
    ephemeral: true
  });

  setTimeout(() => {
    interaction.channel.delete("Ticket fechado").catch(() => {});
  }, 5000);
}

// =========================
// CUPONS
// =========================

async function handleAddCupom(interaction) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "❌ Apenas administradores podem adicionar cupons.",
      ephemeral: true
    });
  }

  if (!hasPlan(interaction.guild.id, "pro")) {
    return interaction.reply({
      content: "❌ O sistema de cupons está disponível apenas no Plano Pro ou Ultimate.",
      ephemeral: true
    });
  }

  const codigo = interaction.options.getString("codigo").trim().toUpperCase();
  const desconto = interaction.options.getInteger("desconto");

  if (!/^[A-Z0-9_-]{3,20}$/.test(codigo)) {
    return interaction.reply({
      content: "❌ Código inválido. Use de 3 a 20 caracteres, apenas letras, números, `_` ou `-`.",
      ephemeral: true
    });
  }

  if (desconto < 1 || desconto > 100) {
    return interaction.reply({
      content: "❌ O desconto precisa ser entre 1% e 100%.",
      ephemeral: true
    });
  }

  const coupons = getGuildCoupons(interaction.guild.id);
  const existingIndex = coupons.findIndex(c => c.codigo === codigo);

  const cupom = {
    codigo,
    desconto,
    criadoPor: interaction.user.id,
    criadoEm: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    coupons[existingIndex] = {
      ...coupons[existingIndex],
      ...cupom,
      editadoEm: new Date().toISOString()
    };
  } else {
    coupons.push(cupom);
  }

  setGuildCoupons(interaction.guild.id, coupons);

  return interaction.reply({
    content:
      `✅ Cupom ${existingIndex >= 0 ? "atualizado" : "criado"} com sucesso!

` +
      `Cupom: \`${codigo}\`
` +
      `Desconto: \`${desconto}%\``,
    ephemeral: true
  });
}

// =========================
// LOGIN
// =========================

registerCommands();
client.login(TOKEN);
