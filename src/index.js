import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const db = new Database(join(__dirname, 'database.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    last_message_time INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS rewards (
    level INTEGER PRIMARY KEY,
    role_id TEXT NOT NULL
  );
`);

const getConfig = (key) => {
  const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
  const result = stmt.get(key);
  return result ? JSON.parse(result.value) : null;
};

const setConfig = (key, value) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  stmt.run(key, JSON.stringify(value));
};

const defaultCooldown = 60;
const getCooldown = () => getConfig('cooldown') || defaultCooldown;

const getXPGain = () => Math.floor(Math.random() * 16) + 10;

const getBonusXP = (content) => {
  let bonus = 0;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const imageRegex = /\.(jpg|jpeg|png|gif|webp|avif)$/i;

  const urls = content.match(urlRegex) || [];
  urls.forEach(url => {
    if (imageRegex.test(url)) bonus += 5;
    else bonus += 3;
  });

  return bonus;
};

const getRequiredXP = (level) => level * 100;

const addXP = (userId, username, xpToAdd) => {
  const stmt = db.prepare('SELECT * FROM users WHERE user_id = ?');
  const user = stmt.get(userId);

  let newXP = xpToAdd;
  let newLevel = 0;
  let leveledUp = false;
  let previousLevel = 0;

  if (user) {
    newXP = user.xp + xpToAdd;
    newLevel = user.level;

    const requiredXP = getRequiredXP(newLevel);
    if (newXP >= requiredXP) {
      newLevel++;
      newXP = newXP - requiredXP;
      leveledUp = true;
      previousLevel = user.level;
    }

    const updateStmt = db.prepare('UPDATE users SET xp = ?, level = ? WHERE user_id = ?');
    updateStmt.run(newXP, newLevel, userId);
  } else {
    newLevel = 1;
    newXP = xpToAdd;
    const insertStmt = db.prepare('INSERT INTO users (user_id, username, xp, level) VALUES (?, ?, ?, ?)');
    insertStmt.run(userId, username, newXP, newLevel);
    leveledUp = true;
  }

  return { newXP, newLevel, leveledUp, previousLevel };
};

const getLeaderboard = (limit = 10) => {
  const stmt = db.prepare('SELECT * FROM users ORDER BY xp DESC LIMIT ?');
  return stmt.all(limit);
};

const setReward = (level, roleId) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO rewards (level, role_id) VALUES (?, ?)');
  stmt.run(level, roleId);
};

const getReward = (level) => {
  const stmt = db.prepare('SELECT role_id FROM rewards WHERE level = ?');
  const result = stmt.get(level);
  return result?.role_id;
};

const getAllRewards = () => {
  const stmt = db.prepare('SELECT * FROM rewards ORDER BY level');
  return stmt.all();
};

const getBanner = () => getConfig('banner') || 'https://i.imgur.com/8K3v5tW.png';

const getLevelUpMessage = () => getConfig('levelUpMessage') || '{user} has reached level {level}!';

const formatLevelUpMessage = (message, user, level) => {
  return message
    .replace('{user}', user.username)
    .replace('{level}', level)
    .replace('{mention}', `<@${user.user_id}>`);
};

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const now = Date.now();
  const cooldown = getCooldown() * 1000;

  const stmt = db.prepare('SELECT last_message_time FROM users WHERE user_id = ?');
  const user = stmt.get(message.author.id);

  if (user && now - user.last_message_time < cooldown) return;

  const xpGain = getXPGain();
  const bonusXP = getBonusXP(message.content);
  const totalXP = xpGain + bonusXP;

  const updateTimeStmt = db.prepare('UPDATE users SET last_message_time = ? WHERE user_id = ?');
  updateTimeStmt.run(now, message.author.id);

  const result = addXP(message.author.id, message.author.username, totalXP);

  if (result.leveledUp) {
    const guild = message.guild;
    const member = await guild.members.fetch(message.author.id);

    const roleId = getReward(result.newLevel);
    if (roleId) {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        await member.roles.add(role);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Level Up!')
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setDescription(formatLevelUpMessage(getLevelUpMessage(), { user_id: message.author.id, username: message.author.username }, result.newLevel))
      .setImage(getBanner())
      .setTimestamp();

    const channelId = getConfig('announcementChannel');
    if (channelId) {
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        channel.send({ embeds: [embed] });
      } else {
        message.channel.send({ embeds: [embed] });
      }
    } else {
      message.channel.send({ embeds: [embed] });
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'rank') {
    const user = interaction.options.getUser('user') || interaction.user;
    const stmt = db.prepare('SELECT * FROM users WHERE user_id = ?');
    const userData = stmt.get(user.id);

    if (!userData) {
      return interaction.reply({ content: `${user.username} has not earned any XP yet!`, ephemeral: true });
    }

    const requiredXP = getRequiredXP(userData.level);
    const progress = Math.floor((userData.xp / requiredXP) * 100);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${user.username}'s Rank`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Level', value: userData.level.toString(), inline: true },
        { name: 'XP', value: `${userData.xp} / ${requiredXP}`, inline: true },
        { name: 'Progress', value: `${progress}%`, inline: true }
      )
      .setImage(getBanner())
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'leaderboard') {
    const leaderboard = getLeaderboard(10);

    if (leaderboard.length === 0) {
      return interaction.reply({ content: 'No users on the leaderboard yet!', ephemeral: true });
    }

    let description = '';
    leaderboard.forEach((user, index) => {
      const medals = ['', '', ''];
      const medal = medals[index] || `${index + 1}. `;
      description += `${medal}<@${user.user_id}> - Level ${user.level} (${user.xp} XP)\n`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Leaderboard')
      .setDescription(description)
      .setImage(getBanner())
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'level') {
    const user = interaction.options.getUser('user') || interaction.user;
    const stmt = db.prepare('SELECT * FROM users WHERE user_id = ?');
    const userData = stmt.get(user.id);

    if (!userData) {
      return interaction.reply({ content: `${user.username} has not earned any XP yet!`, ephemeral: true });
    }

    interaction.reply({ content: `${user.username} is at Level ${userData.level} with ${userData.xp} XP!` });
  }

  if (commandName === 'setcooldown') {
    const seconds = interaction.options.getInteger('seconds');
    setConfig('cooldown', seconds);
    interaction.reply({ content: `Cooldown set to ${seconds} seconds!`, ephemeral: true });
  }

  if (commandName === 'setbanner') {
    const url = interaction.options.getString('url');
    setConfig('banner', url);
    interaction.reply({ content: `Banner image updated!`, ephemeral: true });
  }

  if (commandName === 'setreward') {
    const level = interaction.options.getInteger('level');
    const role = interaction.options.getRole('role');
    setReward(level, role.id);
    interaction.reply({ content: `Level ${level} will now grant the ${role.name} role!`, ephemeral: true });
  }

  if (commandName === 'rewards') {
    const rewards = getAllRewards();

    if (rewards.length === 0) {
      return interaction.reply({ content: 'No level rewards configured yet!', ephemeral: true });
    }

    let description = '';
    for (const reward of rewards) {
      description += `Level ${reward.level}: <@&${reward.role_id}>\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Level Rewards')
      .setDescription(description)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'setmessage') {
    const message = interaction.options.getString('message');
    setConfig('levelUpMessage', message);
    interaction.reply({ content: `Level-up message updated!`, ephemeral: true });
  }

  if (commandName === 'setchannel') {
    const channel = interaction.options.getChannel('channel');
    setConfig('announcementChannel', channel.id);
    interaction.reply({ content: `Level-up announcements will be sent to ${channel}!`, ephemeral: true });
  }
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('XP System', { type: 2 });
});

const { DeployCommands } = await import('./utils/deployCommands.js');
await DeployCommands(process.env.CLIENT_ID, process.env.GUILD_ID, process.env.BOT_TOKEN);

client.login(process.env.BOT_TOKEN);
