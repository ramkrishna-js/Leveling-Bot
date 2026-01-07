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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
  ]
});

const db = new Database(join(__dirname, 'database.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    last_message_time INTEGER DEFAULT 0,
    voice_time INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    last_active_date TEXT,
    invites INTEGER DEFAULT 0,
    weekly_xp INTEGER DEFAULT 0,
    monthly_xp INTEGER DEFAULT 0,
    last_daily_bonus TEXT,
    vip_until TEXT DEFAULT NULL,
    total_xp_earned INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS rewards (
    level INTEGER PRIMARY KEY,
    role_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS role_multipliers (
    role_id TEXT PRIMARY KEY,
    multiplier REAL DEFAULT 1.0
  );

  CREATE TABLE IF NOT EXISTS blacklisted_channels (
    channel_id TEXT PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS weekly_leaderboard (
    user_id TEXT PRIMARY KEY,
    xp INTEGER DEFAULT 0,
    username TEXT
  );

  CREATE TABLE IF NOT EXISTS monthly_leaderboard (
    user_id TEXT PRIMARY KEY,
    xp INTEGER DEFAULT 0,
    username TEXT
  );

  CREATE TABLE IF NOT EXISTS xp_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user TEXT,
    to_user TEXT,
    amount INTEGER,
    reason TEXT,
    timestamp INTEGER
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
const getDailyBonus = () => getConfig('dailyBonus') || 25;
const getServerMultiplier = () => getConfig('serverMultiplier') || 1.0;

const getXPGain = () => Math.floor(Math.random() * 16) + 10;

const isWeekend = () => {
  const day = new Date().getDay();
  return day === 0 || day === 6;
};

const getWeekendMultiplier = () => isWeekend() ? 2 : 1;

const getStreakBonus = (streak) => {
  if (streak >= 30) return 5;
  if (streak >= 14) return 3;
  if (streak >= 7) return 2;
  return 0;
};

const getUserMultiplier = async (member) => {
  let multiplier = 1.0;
  multiplier *= getServerMultiplier();
  multiplier *= getWeekendMultiplier();

  const vipStmt = db.prepare('SELECT vip_until FROM users WHERE user_id = ?');
  const userData = vipStmt.get(member.id);
  if (userData && userData.vip_until) {
    const vipEnd = new Date(userData.vip_until);
    if (vipEnd > new Date()) {
      multiplier *= 1.5;
    }
  }

  const roleStmt = db.prepare('SELECT multiplier FROM role_multipliers WHERE role_id = ?');
  for (const role of member.roles.cache.values()) {
    const roleMulti = roleStmt.get(role.id);
    if (roleMulti) {
      multiplier *= roleMulti.multiplier;
    }
  }

  return multiplier;
};

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

const getRequiredXP = (level) => Math.floor(level * 100 * Math.pow(1.1, level - 1));

const updateStreak = (userId) => {
  const today = new Date().toDateString();
  const stmt = db.prepare('SELECT last_active_date, streak FROM users WHERE user_id = ?');
  const user = stmt.get(userId);

  if (!user) {
    const insertStmt = db.prepare('INSERT INTO users (user_id, streak, last_active_date) VALUES (?, 1, ?)');
    insertStmt.run(userId, today);
    return 1;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  let newStreak = user.streak;

  if (user.last_active_date === today) {
    return user.streak;
  } else if (user.last_active_date === yesterdayStr) {
    newStreak = user.streak + 1;
  } else {
    newStreak = 1;
  }

  const updateStmt = db.prepare('UPDATE users SET streak = ?, last_active_date = ? WHERE user_id = ?');
  updateStmt.run(newStreak, today, userId);
  return newStreak;
};

const addXP = (userId, username, xpToAdd, isWeekly = false, isMonthly = false) => {
  const stmt = db.prepare('SELECT * FROM users WHERE user_id = ?');
  const user = stmt.get(userId);

  let newXP = xpToAdd;
  let newLevel = 0;
  let leveledUp = false;
  let previousLevel = 0;
  let totalEarned = xpToAdd;

  if (user) {
    newXP = user.xp + xpToAdd;
    newLevel = user.level;
    totalEarned = user.total_xp_earned + xpToAdd;

    const requiredXP = getRequiredXP(newLevel);
    while (newXP >= requiredXP) {
      newXP -= requiredXP;
      newLevel++;
      leveledUp = true;
      previousLevel = user.level;
      break;
    }

    let weeklyXP = user.weekly_xp;
    let monthlyXP = user.monthly_xp;
    if (isWeekly) weeklyXP += xpToAdd;
    if (isMonthly) monthlyXP += xpToAdd;

    const updateStmt = db.prepare('UPDATE users SET xp = ?, level = ?, username = ?, weekly_xp = ?, monthly_xp = ?, total_xp_earned = ? WHERE user_id = ?');
    updateStmt.run(newXP, newLevel, username, weeklyXP, monthlyXP, totalEarned, userId);
  } else {
    newLevel = 1;
    newXP = xpToAdd;
    const insertStmt = db.prepare('INSERT INTO users (user_id, username, xp, level, weekly_xp, monthly_xp, total_xp_earned) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertStmt.run(userId, username, newXP, newLevel, isWeekly ? xpToAdd : 0, isMonthly ? xpToAdd : 0, xpToAdd);
    leveledUp = true;
  }

  return { newXP, newLevel, leveledUp, previousLevel, totalEarned };
};

const getLeaderboard = (limit = 10, type = 'all') => {
  let stmt;
  if (type === 'weekly') {
    stmt = db.prepare('SELECT * FROM users ORDER BY weekly_xp DESC LIMIT ?');
  } else if (type === 'monthly') {
    stmt = db.prepare('SELECT * FROM users ORDER BY monthly_xp DESC LIMIT ?');
  } else {
    stmt = db.prepare('SELECT * FROM users ORDER BY xp DESC LIMIT ?');
  }
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

const isChannelBlacklisted = (channelId) => {
  const stmt = db.prepare('SELECT 1 FROM blacklisted_channels WHERE channel_id = ?');
  return !!stmt.get(channelId);
};

const addBlacklistedChannel = (channelId) => {
  const stmt = db.prepare('INSERT OR IGNORE INTO blacklisted_channels (channel_id) VALUES (?)');
  stmt.run(channelId);
};

const removeBlacklistedChannel = (channelId) => {
  const stmt = db.prepare('DELETE FROM blacklisted_channels WHERE channel_id = ?');
  stmt.run(channelId);
};

const getBlacklistedChannels = () => {
  const stmt = db.prepare('SELECT * FROM blacklisted_channels');
  return stmt.all();
};

const setRoleMultiplier = (roleId, multiplier) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO role_multipliers (role_id, multiplier) VALUES (?, ?)');
  stmt.run(roleId, multiplier);
};

const getRoleMultiplier = (roleId) => {
  const stmt = db.prepare('SELECT multiplier FROM role_multipliers WHERE role_id = ?');
  const result = stmt.get(roleId);
  return result?.multiplier || 1.0;
};

const getAllRoleMultipliers = () => {
  const stmt = db.prepare('SELECT * FROM role_multipliers');
  return stmt.all();
};

const transferXP = (fromId, toId, amount, reason = 'Transfer') => {
  const fromStmt = db.prepare('SELECT xp FROM users WHERE user_id = ?');
  const fromUser = fromStmt.get(fromId);

  if (!fromUser || fromUser.xp < amount) {
    return false;
  }

  const updateFrom = db.prepare('UPDATE users SET xp = xp - ? WHERE user_id = ?');
  updateFrom.run(amount, fromId);

  const toStmt = db.prepare('SELECT xp, username FROM users WHERE user_id = ?');
  const toUser = toStmt.get(toId);

  if (toUser) {
    const updateTo = db.prepare('UPDATE users SET xp = xp + ? WHERE user_id = ?');
    updateTo.run(amount, toId);
  } else {
    const insertTo = db.prepare('INSERT INTO users (user_id, username, xp, level) VALUES (?, ?, ?, 1)');
    insertTo.run(toId, 'Unknown', amount);
  }

  const transStmt = db.prepare('INSERT INTO xp_transactions (from_user, to_user, amount, reason, timestamp) VALUES (?, ?, ?, ?, ?)');
  transStmt.run(fromId, toId, amount, reason, Date.now());

  return true;
};

const giveXP = (userId, amount, reason = 'Bonus') => {
  const stmt = db.prepare('SELECT username FROM users WHERE user_id = ?');
  const user = stmt.get(userId);
  addXP(userId, user?.username || 'Unknown', amount, true, true);
};

const takeXP = (userId, amount) => {
  const stmt = db.prepare('UPDATE users SET xp = CASE WHEN xp >= ? THEN xp - ? ELSE 0 END WHERE user_id = ?');
  stmt.run(amount, amount, userId);
};

const setVIP = (userId, days) => {
  const vipUntil = new Date();
  vipUntil.setDate(vipUntil.getDate() + days);
  const stmt = db.prepare('UPDATE users SET vip_until = ? WHERE user_id = ?');
  stmt.run(vipUntil.toISOString(), userId);
};

const isVIP = (userId) => {
  const stmt = db.prepare('SELECT vip_until FROM users WHERE user_id = ?');
  const user = stmt.get(userId);
  if (!user || !user.vip_until) return false;
  return new Date(user.vip_until) > new Date();
};

const getXPTransactions = (limit = 10) => {
  const stmt = db.prepare('SELECT * FROM xp_transactions ORDER BY timestamp DESC LIMIT ?');
  return stmt.all(limit);
};

const isNewDay = (lastDate) => {
  if (!lastDate) return true;
  const today = new Date().toDateString();
  return lastDate !== today;
};

const resetWeeklyXP = () => {
  const stmt = db.prepare('UPDATE users SET weekly_xp = 0');
  stmt.run();
};

const resetMonthlyXP = () => {
  const stmt = db.prepare('UPDATE users SET monthly_xp = 0');
  stmt.run();
};

const lastWeeklyReset = { date: null };
const lastMonthlyReset = { date: null };

setInterval(() => {
  const now = new Date();
  const today = now.toDateString();

  if (now.getDay() === 1 && lastWeeklyReset.date !== today) {
    resetWeeklyXP();
    lastWeeklyReset.date = today;
    console.log('Weekly XP reset!');
  }

  if (now.getDate() === 1 && lastMonthlyReset.date !== today) {
    resetMonthlyXP();
    lastMonthlyReset.date = today;
    console.log('Monthly XP reset!');
  }
}, 60000);

setInterval(() => {
  const stmt = db.prepare('SELECT user_id FROM users WHERE last_active_date < date("now", "-30 days") AND xp > 0');
  const inactiveUsers = stmt.all();

  for (const user of inactiveUsers) {
    const decayStmt = db.prepare('UPDATE users SET xp = CAST(xp * 0.95 AS INTEGER) WHERE user_id = ?');
    decayStmt.run(user.user_id);
  }
}, 86400000);

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (oldState.channelId === newState.channelId) return;

  if (oldState.channelId && !newState.channelId) {
    const member = oldState.member;
    if (member.bot) return;

    const stmt = db.prepare('SELECT voice_time FROM users WHERE user_id = ?');
    const user = stmt.get(member.id);

    const voiceMinutes = user ? user.voice_time : 0;
    const xpFromVoice = Math.floor(voiceMinutes / 5);

    if (xpFromVoice > 0) {
      addXP(member.id, member.user.username, xpFromVoice, true, true);
    }
  }

  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    if (member.bot) return;

    const stmt = db.prepare('UPDATE users SET voice_time = 0 WHERE user_id = ?');
    stmt.run(member.id);
  }
});

setInterval(() => {
  client.guilds.cache.forEach(guild => {
    guild.members.cache.forEach(member => {
      if (member.voice.channel && !member.bot) {
        const stmt = db.prepare('UPDATE users SET voice_time = voice_time + 1 WHERE user_id = ?');
        stmt.run(member.id);
      }
    });
  });
}, 60000);

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (isChannelBlacklisted(message.channel.id)) return;

  const now = Date.now();
  const cooldown = getCooldown() * 1000;

  const stmt = db.prepare('SELECT last_message_time, last_daily_bonus, username FROM users WHERE user_id = ?');
  const user = stmt.get(message.author.id);

  let dailyBonus = 0;
  if (user && isNewDay(user.last_daily_bonus)) {
    dailyBonus = getDailyBonus();
  }

  if (user && now - user.last_message_time < cooldown) return;

  const xpGain = getXPGain();
  const bonusXP = getBonusXP(message.content);
  const streakBonus = getStreakBonus(updateStreak(message.author.id));

  let totalXP = xpGain + bonusXP + streakBonus + dailyBonus;
  totalXP = Math.floor(totalXP);

  const updateTimeStmt = db.prepare('UPDATE users SET last_message_time = ?, last_daily_bonus = ? WHERE user_id = ?');
  updateTimeStmt.run(now, new Date().toDateString(), message.author.id);

  const member = message.guild.members.cache.get(message.author.id);
  if (member) {
    const userMultiplier = await getUserMultiplier(member);
    totalXP = Math.floor(totalXP * userMultiplier);
  }

  const result = addXP(message.author.id, message.author.username, totalXP, true, true);

  if (dailyBonus > 0) {
    try {
      await message.author.send(`🎁 Daily bonus: +${dailyBonus} XP! Keep chatting to earn more!`);
    } catch (e) {}
  }

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
      .addFields(
        { name: 'Total XP Earned', value: result.totalEarned.toLocaleString(), inline: true },
        { name: 'Current Level', value: result.newLevel.toString(), inline: true }
      )
      .setImage(getBanner())
      .setTimestamp();

    const dmNotifications = getConfig('dmNotifications');
    if (dmNotifications) {
      try {
        await message.author.send({ embeds: [embed] });
      } catch (e) {
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
    } else {
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
    const weekendStatus = isWeekend() ? '🎉 Weekend 2x XP Active!' : '';
    const vipStatus = isVIP(user.id) ? '⭐ VIP Member' : '';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${user.username}'s Rank`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Level', value: userData.level.toString(), inline: true },
        { name: 'XP', value: `${userData.xp.toLocaleString()} / ${requiredXP.toLocaleString()}`, inline: true },
        { name: 'Progress', value: `${progress}%`, inline: true },
        { name: 'Streak', value: `${userData.streak} days`, inline: true },
        { name: 'Total Earned', value: userData.total_xp_earned.toLocaleString(), inline: true },
        { name: 'Weekend', value: weekendStatus || 'Normal', inline: true },
        { name: 'VIP', value: vipStatus || 'None', inline: true }
      )
      .setImage(getBanner())
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'leaderboard' || commandName === 'weekly' || commandName === 'monthly') {
    const type = commandName === 'weekly' ? 'weekly' : commandName === 'monthly' ? 'monthly' : 'all';
    const leaderboard = getLeaderboard(10, type);

    if (leaderboard.length === 0) {
      return interaction.reply({ content: 'No users on the leaderboard yet!', ephemeral: true });
    }

    const title = type === 'weekly' ? 'Weekly Leaderboard' : type === 'monthly' ? 'Monthly Leaderboard' : 'Leaderboard';

    let description = '';
    leaderboard.forEach((user, index) => {
      const medals = ['', '', ''];
      const medal = medals[index] || `${index + 1}. `;
      const xp = type === 'all' ? user.xp : type === 'weekly' ? user.weekly_xp : user.monthly_xp;
      description += `${medal}<@${user.user_id}> - Level ${user.level} (${xp.toLocaleString()} XP)\n`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(title)
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

    const requiredXP = getRequiredXP(userData.level);
    const xpToNext = requiredXP - userData.xp;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${user.username}'s Level`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Current Level', value: userData.level.toString(), inline: true },
        { name: 'Current XP', value: userData.xp.toLocaleString(), inline: true },
        { name: 'XP to Next Level', value: xpToNext.toLocaleString(), inline: true }
      )
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
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

  if (commandName === 'setdailybonus') {
    const amount = interaction.options.getInteger('amount');
    setConfig('dailyBonus', amount);
    interaction.reply({ content: `Daily bonus set to ${amount} XP!`, ephemeral: true });
  }

  if (commandName === 'setmultiplier') {
    const multiplier = interaction.options.getNumber('multiplier');
    setConfig('serverMultiplier', multiplier);
    interaction.reply({ content: `Server multiplier set to ${multiplier}x!`, ephemeral: true });
  }

  if (commandName === 'setrolemultiplier') {
    const role = interaction.options.getRole('role');
    const multiplier = interaction.options.getNumber('multiplier');
    setRoleMultiplier(role.id, multiplier);
    interaction.reply({ content: `${role.name} now has ${multiplier}x XP multiplier!`, ephemeral: true });
  }

  if (commandName === 'rolemultipliers') {
    const multipliers = getAllRoleMultipliers();

    if (multipliers.length === 0) {
      return interaction.reply({ content: 'No role multipliers configured!', ephemeral: true });
    }

    let description = '';
    for (const m of multipliers) {
      const role = interaction.guild.roles.cache.get(m.role_id);
      description += `${role?.name || 'Unknown'}: ${m.multiplier}x\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Role Multipliers')
      .setDescription(description)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'addinvite') {
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount') || 1;

    const stmt = db.prepare('SELECT invites FROM invites WHERE user_id = ?');
    const inviteData = stmt.get(user.id);

    if (inviteData) {
      const updateStmt = db.prepare('UPDATE invites SET invites = invites + ? WHERE user_id = ?');
      updateStmt.run(amount, user.id);
    } else {
      const insertStmt = db.prepare('INSERT INTO invites (user_id, invites) VALUES (?, ?)');
      insertStmt.run(user.id, amount);
    }

    const xpFromInvite = amount * 5;
    addXP(user.id, user.username, xpFromInvite, true, true);

    interaction.reply({ content: `Added ${amount} invite(s) to ${user.username} (+${xpFromInvite} XP)!`, ephemeral: true });
  }

  if (commandName === 'invites') {
    const user = interaction.options.getUser('user') || interaction.user;
    const stmt = db.prepare('SELECT invites FROM invites WHERE user_id = ?');
    const inviteData = stmt.get(user.id);
    const invites = inviteData ? inviteData.invites : 0;

    interaction.reply({ content: `${user.username} has ${invites} invite(s)!` });
  }

  if (commandName === 'blacklist') {
    const channel = interaction.options.getChannel('channel');
    const action = interaction.options.getString('action');

    if (action === 'add') {
      addBlacklistedChannel(channel.id);
      interaction.reply({ content: `${channel} is now blacklisted from XP gain!`, ephemeral: true });
    } else if (action === 'remove') {
      removeBlacklistedChannel(channel.id);
      interaction.reply({ content: `${channel} removed from blacklist!`, ephemeral: true });
    }
  }

  if (commandName === 'blacklistchannels') {
    const channels = getBlacklistedChannels();

    if (channels.length === 0) {
      return interaction.reply({ content: 'No blacklisted channels!', ephemeral: true });
    }

    let description = '';
    for (const ch of channels) {
      const channel = interaction.guild.channels.cache.get(ch.channel_id);
      description += `${channel || 'Unknown Channel'}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Blacklisted Channels')
      .setDescription(description)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'resetuser') {
    const user = interaction.options.getUser('user');
    const stmt = db.prepare('DELETE FROM users WHERE user_id = ?');
    stmt.run(user.id);
    interaction.reply({ content: `Reset XP and level for ${user.username}!`, ephemeral: true });
  }

  if (commandName === 'resetall') {
    const stmt = db.prepare('DELETE FROM users');
    stmt.run();
    interaction.reply({ content: `Reset all user XP and levels!`, ephemeral: true });
  }

  if (commandName === 'stats') {
    const stmt = db.prepare('SELECT COUNT(*) as total FROM users');
    const result = stmt.get();
    const totalUsers = result.total;

    const stmt2 = db.prepare('SELECT SUM(xp) as totalXP, SUM(total_xp_earned) as totalEarned FROM users');
    const result2 = stmt2.get();
    const totalXP = result2.totalXP || 0;
    const totalEarned = result2.totalEarned || 0;

    const stmt3 = db.prepare('SELECT MAX(level) as maxLevel FROM users');
    const result3 = stmt3.get();
    const maxLevel = result3.maxLevel || 0;

    const stmt4 = db.prepare('SELECT SUM(weekly_xp) as weeklyXP, SUM(monthly_xp) as monthlyXP FROM users');
    const result4 = stmt4.get();

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Server XP Stats')
      .addFields(
        { name: 'Total Users', value: totalUsers.toString(), inline: true },
        { name: 'Current XP', value: totalXP.toLocaleString(), inline: true },
        { name: 'Total Earned', value: totalEarned.toLocaleString(), inline: true },
        { name: 'Highest Level', value: maxLevel.toString(), inline: true },
        { name: 'Weekly XP', value: (result4.weeklyXP || 0).toLocaleString(), inline: true },
        { name: 'Monthly XP', value: (result4.monthlyXP || 0).toLocaleString(), inline: true }
      )
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'transfer') {
    const fromUser = interaction.options.getUser('from');
    const toUser = interaction.options.getUser('to');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'Transfer';

    const success = transferXP(fromUser.id, toUser.id, amount, reason);

    if (success) {
      interaction.reply({ content: `Transferred ${amount} XP from ${fromUser.username} to ${toUser.username}!`, ephemeral: true });
    } else {
      interaction.reply({ content: `Failed to transfer XP. User may not have enough XP.`, ephemeral: true });
    }
  }

  if (commandName === 'givexp') {
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'Bonus';

    giveXP(user.id, amount, reason);
    interaction.reply({ content: `Gave ${amount} XP to ${user.username}!`, ephemeral: true });
  }

  if (commandName === 'takexp') {
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    takeXP(user.id, amount);
    interaction.reply({ content: `Took ${amount} XP from ${user.username}!`, ephemeral: true });
  }

  if (commandName === 'setvip') {
    const user = interaction.options.getUser('user');
    const days = interaction.options.getInteger('days');

    setVIP(user.id, days);
    interaction.reply({ content: `${user.username} is now VIP for ${days} days!`, ephemeral: true });
  }

  if (commandName === 'checkvip') {
    const user = interaction.options.getUser('user') || interaction.user;
    const vip = isVIP(user.id);

    if (vip) {
      const stmt = db.prepare('SELECT vip_until FROM users WHERE user_id = ?');
      const result = stmt.get(user.id);
      const vipDate = new Date(result.vip_until).toLocaleDateString();
      interaction.reply({ content: `${user.username} is VIP until ${vipDate}!` });
    } else {
      interaction.reply({ content: `${user.username} is not a VIP member.` });
    }
  }

  if (commandName === 'compare') {
    const user1 = interaction.options.getUser('user1') || interaction.user;
    const user2 = interaction.options.getUser('user2');

    if (!user2) {
      return interaction.reply({ content: 'Please specify a second user to compare!', ephemeral: true });
    }

    const stmt = db.prepare('SELECT * FROM users WHERE user_id = ?');
    const data1 = stmt.get(user1.id);
    const data2 = stmt.get(user2.id);

    if (!data1 || !data2) {
      return interaction.reply({ content: 'Both users must have XP to compare!', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('XP Comparison')
      .setThumbnail(user1.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: user1.username, value: `Level: ${data1.level}\nXP: ${data1.xp.toLocaleString()}\nTotal: ${data1.total_xp_earned.toLocaleString()}`, inline: true },
        { name: user2.username, value: `Level: ${data2.level}\nXP: ${data2.xp.toLocaleString()}\nTotal: ${data2.total_xp_earned.toLocaleString()}`, inline: true }
      )
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'setstreak') {
    const user = interaction.options.getUser('user');
    const days = interaction.options.getInteger('days');

    const stmt = db.prepare('UPDATE users SET streak = ? WHERE user_id = ?');
    stmt.run(days, user.id);
    interaction.reply({ content: `Set ${user.username}'s streak to ${days} days!`, ephemeral: true });
  }

  if (commandName === 'transactions') {
    const transactions = getXPTransactions(10);

    if (transactions.length === 0) {
      return interaction.reply({ content: 'No XP transactions yet!', ephemeral: true });
    }

    let description = '';
    for (const t of transactions) {
      const from = interaction.guild.members.cache.get(t.from_user);
      const to = interaction.guild.members.cache.get(t.to_user);
      description += `**${t.amount} XP** from ${from?.user.username || 'Unknown'} to ${to?.user.username || 'Unknown'}\nReason: ${t.reason}\n\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Recent XP Transactions')
      .setDescription(description)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'dmnotifications') {
    const enabled = interaction.options.getString('action') === 'enable';
    setConfig('dmNotifications', enabled);
    interaction.reply({ content: `DM notifications ${enabled ? 'enabled' : 'disabled'}!`, ephemeral: true });
  }

  if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Leveling Bot Commands')
      .setDescription(`
**User Commands:**
• \`/rank [user]\` - View rank and XP
• \`/level [user]\` - View current level
• \`/leaderboard\` - Top 10 all-time
• \`/weekly\` - Weekly top 10
• \`/monthly\` - Monthly top 10
• \`/invites [user]\` - Check invites
• \`/compare <user1> <user2>\` - Compare XP
• \`/checkvip [user]\` - Check VIP status

**Configuration:**
• \`/setcooldown <seconds>\` - Set XP cooldown
• \`/setbanner <url>\` - Set banner image
• \`/setmessage <message>\` - Set level-up message
• \`/setchannel <channel>\` - Set announcement channel
• \`/setdailybonus <amount>\` - Set daily bonus XP
• \`/setmultiplier <x>\` - Set server multiplier
• \`/dmnotifications <enable|disable>\` - DM level-ups

**Role Multipliers:**
• \`/setrolemultiplier <role> <x>\` - Add role multiplier
• \`/rolemultipliers\` - View all multipliers

**Rewards:**
• \`/setreward <level> <role>\` - Add role reward
• \`/rewards\` - View all rewards

**Moderation:**
• \`/addinvite <user> [amount]\` - Add invites
• \`/blacklist <channel> <add|remove>\` - Toggle XP blacklist
• \`/blacklistchannels\` - View blacklisted channels
• \`/givexp <user> <amount> [reason]\` - Give XP
• \`/takexp <user> <amount>\` - Take XP
• \`/transfer <from> <to> <amount> [reason]\` - Transfer XP
• \`/setvip <user> <days>\` - Set VIP status
• \`/setstreak <user> <days>\` - Set streak
• \`/resetuser <user>\` - Reset user XP
• \`/resetall\` - Reset all XP

**Other:**
• \`/stats\` - Server XP statistics
• \`/transactions\` - View XP transactions
• \`/help\` - Show this message
      `)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  }
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('XP System | /help', { type: 3 });
});

const { DeployCommands } = await import('./utils/deployCommands.js');
await DeployCommands(process.env.CLIENT_ID, process.env.GUILD_ID, process.env.BOT_TOKEN);

client.login(process.env.BOT_TOKEN);
