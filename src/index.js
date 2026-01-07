import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const USE_MONGODB = process.env.USE_MONGODB === 'true';
let db;
let MongoClient;

if (USE_MONGODB) {
  const mongodb = await import('mongodb');
  MongoClient = mongodb.MongoClient;
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(mongoUrl);
  await client.connect();
  db = client.db('leveling-bot');
  console.log('📦 Connected to MongoDB');
} else {
  const Database = (await import('better-sqlite3')).default;
  db = new Database(join(__dirname, 'database.sqlite'));
  console.log('📦 Using SQLite database');
}

const log = (type, message) => {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    xp: '\x1b[35m',
    level: '\x1b[33m',
    cmd: '\x1b[34m'
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type] || colors.info}[${timestamp}] ${message}${reset}`);
};

const logXP = (user, amount, source = 'message') => {
  log('xp', `💰 ${user} earned ${amount} XP (${source})`);
};

const logLevel = (user, newLevel, totalXP) => {
  log('level', `🎉 ${user} reached level ${newLevel} (Total: ${totalXP.toLocaleString()} XP)`);
};

const logCommand = (user, command, channel) => {
  log('cmd', `⚡ ${user} used /${command} in #${channel}`);
};

const logError = (error, context = 'Unknown') => {
  log('error', `❌ Error in ${context}: ${error.message}`);
};

const getConfig = async (key) => {
  if (USE_MONGODB) {
    const result = await db.collection('config').findOne({ key });
    return result ? result.value : null;
  }
  const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
  const result = stmt.get(key);
  return result ? JSON.parse(result.value) : null;
};

const setConfig = async (key, value) => {
  if (USE_MONGODB) {
    await db.collection('config').updateOne({ key }, { $set: { key, value } }, { upsert: true });
    return;
  }
  const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
  stmt.run(key, JSON.stringify(value));
};

const defaultCooldown = 60;
const getCooldown = async () => (await getConfig('cooldown')) || defaultCooldown;
const getDailyBonus = async () => (await getConfig('dailyBonus')) || 25;
const getServerMultiplier = async () => (await getConfig('serverMultiplier')) || 1.0;
const getDMNotifications = async () => (await getConfig('dmNotifications')) || false;

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
  multiplier *= await getServerMultiplier();
  multiplier *= getWeekendMultiplier();

  const vipStatus = await isVIP(member.id);
  if (vipStatus) {
    multiplier *= 1.5;
  }

  if (USE_MONGODB) {
    const roleMultipliers = await db.collection('role_multipliers').find({}).toArray();
    for (const rm of roleMultipliers) {
      if (member.roles.cache.has(rm.role_id)) {
        multiplier *= rm.multiplier;
      }
    }
  } else {
    const roleStmt = db.prepare('SELECT multiplier FROM role_multipliers WHERE role_id = ?');
    for (const role of member.roles.cache.values()) {
      const roleMulti = roleStmt.get(role.id);
      if (roleMulti) {
        multiplier *= roleMulti.multiplier;
      }
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

const getUser = async (userId) => {
  if (USE_MONGODB) {
    return await db.collection('users').findOne({ user_id: userId.toString() });
  }
  const stmt = db.prepare('SELECT * FROM users WHERE user_id = ?');
  return stmt.get(userId);
};

const saveUser = async (userData) => {
  if (USE_MONGODB) {
    await db.collection('users').updateOne(
      { user_id: userData.user_id },
      { $set: userData },
      { upsert: true }
    );
    return;
  }
  const stmt = db.prepare('INSERT OR REPLACE INTO users (user_id, username, xp, level, last_message_time, voice_time, streak, last_active_date, invites, weekly_xp, monthly_xp, last_daily_bonus, vip_until, total_xp_earned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(
    userData.user_id, userData.username, userData.xp, userData.level,
    userData.last_message_time, userData.voice_time, userData.streak,
    userData.last_active_date, userData.invites, userData.weekly_xp,
    userData.monthly_xp, userData.last_daily_bonus, userData.vip_until,
    userData.total_xp_earned
  );
};

const updateStreak = async (userId) => {
  const today = new Date().toDateString();
  const user = await getUser(userId);

  if (!user) {
    await saveUser({
      user_id: userId.toString(),
      streak: 1,
      last_active_date: today,
      xp: 0, level: 0, last_message_time: 0, voice_time: 0,
      invites: 0, weekly_xp: 0, monthly_xp: 0,
      last_daily_bonus: null, vip_until: null, total_xp_earned: 0
    });
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

  user.streak = newStreak;
  user.last_active_date = today;
  await saveUser(user);
  return newStreak;
};

const addXP = async (userId, username, xpToAdd, isWeekly = false, isMonthly = false) => {
  const user = await getUser(userId);

  let newXP = xpToAdd;
  let newLevel = 0;
  let leveledUp = false;
  let previousLevel = 0;
  let totalEarned = xpToAdd;

  if (user) {
    newXP = user.xp + xpToAdd;
    newLevel = user.level;
    totalEarned = (user.total_xp_earned || 0) + xpToAdd;

    const requiredXP = getRequiredXP(newLevel);
    if (newXP >= requiredXP) {
      newXP -= requiredXP;
      newLevel++;
      leveledUp = true;
      previousLevel = user.level;
    }

    user.xp = newXP;
    user.level = newLevel;
    user.username = username;
    user.total_xp_earned = totalEarned;
    if (isWeekly) user.weekly_xp = (user.weekly_xp || 0) + xpToAdd;
    if (isMonthly) user.monthly_xp = (user.monthly_xp || 0) + xpToAdd;
    await saveUser(user);
  } else {
    newLevel = 1;
    newXP = xpToAdd;
    await saveUser({
      user_id: userId.toString(),
      username,
      xp: newXP,
      level: newLevel,
      last_message_time: 0,
      voice_time: 0,
      streak: 0,
      last_active_date: null,
      invites: 0,
      weekly_xp: isWeekly ? xpToAdd : 0,
      monthly_xp: isMonthly ? xpToAdd : 0,
      last_daily_bonus: null,
      vip_until: null,
      total_xp_earned: xpToAdd
    });
    leveledUp = true;
  }

  return { newXP, newLevel, leveledUp, previousLevel, totalEarned };
};

const getLeaderboard = async (limit = 10, type = 'all') => {
  if (USE_MONGODB) {
    const sortField = type === 'weekly' ? 'weekly_xp' : type === 'monthly' ? 'monthly_xp' : 'xp';
    return await db.collection('users').find({}).sort({ [sortField]: -1 }).limit(limit).toArray();
  }
  const stmt = db.prepare(`SELECT * FROM users ORDER BY ${type === 'weekly' ? 'weekly_xp' : type === 'monthly' ? 'monthly_xp' : 'xp'} DESC LIMIT ?`);
  return stmt.all(limit);
};

const getAllRewards = async () => {
  if (USE_MONGODB) {
    return await db.collection('rewards').find({}).sort({ level: 1 }).toArray();
  }
  const stmt = db.prepare('SELECT * FROM rewards ORDER BY level');
  return stmt.all();
};

const getReward = async (level) => {
  if (USE_MONGODB) {
    const result = await db.collection('rewards').findOne({ level });
    return result?.role_id;
  }
  const stmt = db.prepare('SELECT role_id FROM rewards WHERE level = ?');
  const result = stmt.get(level);
  return result?.role_id;
};

const setReward = async (level, roleId) => {
  if (USE_MONGODB) {
    await db.collection('rewards').updateOne({ level }, { $set: { level, role_id: roleId } }, { upsert: true });
    return;
  }
  const stmt = db.prepare('INSERT OR REPLACE INTO rewards (level, role_id) VALUES (?, ?)');
  stmt.run(level, roleId);
};

const getBanner = async () => (await getConfig('banner')) || 'https://i.imgur.com/8K3v5tW.png';

const getLevelUpMessage = async () => (await getConfig('levelUpMessage')) || '{user} has reached level {level}!';

const formatLevelUpMessage = (message, user, level) => {
  return message
    .replace('{user}', user.username)
    .replace('{level}', level)
    .replace('{mention}', `<@${user.user_id}>`);
};

const isChannelBlacklisted = async (channelId) => {
  if (USE_MONGODB) {
    const result = await db.collection('blacklisted_channels').findOne({ channel_id: channelId.toString() });
    return !!result;
  }
  const stmt = db.prepare('SELECT 1 FROM blacklisted_channels WHERE channel_id = ?');
  return !!stmt.get(channelId);
};

const addBlacklistedChannel = async (channelId) => {
  if (USE_MONGODB) {
    await db.collection('blacklisted_channels').insertOne({ channel_id: channelId.toString() });
    return;
  }
  const stmt = db.prepare('INSERT OR IGNORE INTO blacklisted_channels (channel_id) VALUES (?)');
  stmt.run(channelId);
};

const removeBlacklistedChannel = async (channelId) => {
  if (USE_MONGODB) {
    await db.collection('blacklisted_channels').deleteOne({ channel_id: channelId.toString() });
    return;
  }
  const stmt = db.prepare('DELETE FROM blacklisted_channels WHERE channel_id = ?');
  stmt.run(channelId);
};

const getBlacklistedChannels = async () => {
  if (USE_MONGODB) {
    return await db.collection('blacklisted_channels').find({}).toArray();
  }
  const stmt = db.prepare('SELECT * FROM blacklisted_channels');
  return stmt.all();
};

const setRoleMultiplier = async (roleId, multiplier) => {
  if (USE_MONGODB) {
    await db.collection('role_multipliers').updateOne({ role_id: roleId }, { $set: { role_id: roleId, multiplier } }, { upsert: true });
    return;
  }
  const stmt = db.prepare('INSERT OR REPLACE INTO role_multipliers (role_id, multiplier) VALUES (?, ?)');
  stmt.run(roleId, multiplier);
};

const getAllRoleMultipliers = async () => {
  if (USE_MONGODB) {
    return await db.collection('role_multipliers').find({}).toArray();
  }
  const stmt = db.prepare('SELECT * FROM role_multipliers');
  return stmt.all();
};

const isVIP = async (userId) => {
  const user = await getUser(userId);
  if (!user || !user.vip_until) return false;
  return new Date(user.vip_until) > new Date();
};

const setVIP = async (userId, days) => {
  const vipUntil = new Date();
  vipUntil.setDate(vipUntil.getDate() + days);
  const user = await getUser(userId);
  if (user) {
    user.vip_until = vipUntil.toISOString();
    await saveUser(user);
  }
};

const isNewDay = (lastDate) => {
  if (!lastDate) return true;
  const today = new Date().toDateString();
  return lastDate !== today;
};

const resetWeeklyXP = async () => {
  if (USE_MONGODB) {
    await db.collection('users').updateMany({}, { $set: { weekly_xp: 0 } });
  } else {
    const stmt = db.prepare('UPDATE users SET weekly_xp = 0');
    stmt.run();
  }
};

const resetMonthlyXP = async () => {
  if (USE_MONGODB) {
    await db.collection('users').updateMany({}, { $set: { monthly_xp: 0 } });
  } else {
    const stmt = db.prepare('UPDATE users SET monthly_xp = 0');
    stmt.run();
  }
};

const lastWeeklyReset = { date: null };
const lastMonthlyReset = { date: null };

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

setInterval(async () => {
  try {
    const now = new Date();
    const today = now.toDateString();

    if (now.getDay() === 1 && lastWeeklyReset.date !== today) {
      await resetWeeklyXP();
      lastWeeklyReset.date = today;
      log('success', '📅 Weekly XP reset!');
    }

    if (now.getDate() === 1 && lastMonthlyReset.date !== today) {
      await resetMonthlyXP();
      lastMonthlyReset.date = today;
      log('success', '📅 Monthly XP reset!');
    }
  } catch (error) {
    logError(error, 'reset timer');
  }
}, 60000);

setInterval(async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (USE_MONGODB) {
      const result = await db.collection('users').updateMany(
        { last_active_date: { $lt: thirtyDaysAgo.toDateString() }, xp: { $gt: 0 } },
        [ { $set: { xp: { $multiply: ['$xp', 0.95] } } } ]
      );
      if (result.modifiedCount > 0) {
        log('warn', `📉 XP decay applied to ${result.modifiedCount} inactive users`);
      }
    } else {
      const stmt = db.prepare("SELECT user_id FROM users WHERE last_active_date < date('now', '-30 days') AND xp > 0");
      const inactiveUsers = stmt.all();
      for (const user of inactiveUsers) {
        const decayStmt = db.prepare('UPDATE users SET xp = CAST(xp * 0.95 AS INTEGER) WHERE user_id = ?');
        decayStmt.run(user.user_id);
      }
      if (inactiveUsers.length > 0) {
        log('warn', `📉 XP decay applied to ${inactiveUsers.length} inactive users`);
      }
    }
  } catch (error) {
    logError(error, 'XP decay');
  }
}, 86400000);

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (oldState.channelId === newState.channelId) return;

  if (oldState.channelId && !newState.channelId) {
    const member = oldState.member;
    if (member.bot) return;

    const user = await getUser(member.id);
    const voiceMinutes = user?.voice_time || 0;
    const xpFromVoice = Math.floor(voiceMinutes / 5);

    if (xpFromVoice > 0) {
      await addXP(member.id, member.user.username, xpFromVoice, true, true);
      logXP(member.user.username, xpFromVoice, 'voice');
    }
  }

  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    if (member.bot) return;

    const user = await getUser(member.id);
    if (user) {
      user.voice_time = 0;
      await saveUser(user);
    }
  }
});

setInterval(async () => {
  try {
    client.guilds.cache.forEach(guild => {
      guild.members.cache.forEach(async member => {
        if (member.voice.channel && !member.bot) {
          const user = await getUser(member.id);
          if (user) {
            user.voice_time = (user.voice_time || 0) + 1;
            await saveUser(user);
          }
        }
      });
    });
  } catch (error) {
    logError(error, 'voice tracking');
  }
}, 60000);

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    if (await isChannelBlacklisted(message.channel.id)) return;

    const now = Date.now();
    const cooldown = await getCooldown() * 1000;

    const user = await getUser(message.author.id);
    let dailyBonus = 0;

    if (user && isNewDay(user.last_daily_bonus)) {
      dailyBonus = await getDailyBonus();
    }

    if (user && now - (user.last_message_time || 0) < cooldown) return;

    const xpGain = getXPGain();
    const bonusXP = getBonusXP(message.content);
    const streakBonus = getStreakBonus(await updateStreak(message.author.id));

    let totalXP = xpGain + bonusXP + streakBonus + dailyBonus;
    totalXP = Math.floor(totalXP);

    const member = message.guild.members.cache.get(message.author.id);
    if (member) {
      const userMultiplier = await getUserMultiplier(member);
      totalXP = Math.floor(totalXP * userMultiplier);
    }

    const result = await addXP(message.author.id, message.author.username, totalXP, true, true);

    if (user) {
      user.last_message_time = now;
      user.last_daily_bonus = new Date().toDateString();
      await saveUser(user);
    } else {
      const newUser = await getUser(message.author.id);
      if (newUser) {
        newUser.last_message_time = now;
        newUser.last_daily_bonus = new Date().toDateString();
        await saveUser(newUser);
      }
    }

    if (totalXP > 0) {
      logXP(message.author.username, totalXP, 'message');
    }

    if (dailyBonus > 0) {
      try {
        await message.author.send(`🎁 Daily bonus: +${dailyBonus} XP! Keep chatting to earn more!`);
      } catch (e) {}
    }

    if (result.leveledUp) {
      const guild = message.guild;
      const member = await guild.members.fetch(message.author.id);

      const roleId = await getReward(result.newLevel);
      if (roleId) {
        const role = guild.roles.cache.get(roleId);
        if (role) {
          await member.roles.add(role);
          log('success', `🏅 ${message.author.username} earned role: ${role.name}`);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎉 Level Up!')
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setDescription(formatLevelUpMessage(await getLevelUpMessage(), { user_id: message.author.id, username: message.author.username }, result.newLevel))
        .addFields(
          { name: '✨ Total XP Earned', value: result.totalEarned.toLocaleString(), inline: true },
          { name: '📊 Current Level', value: result.newLevel.toString(), inline: true }
        )
        .setImage(await getBanner())
        .setTimestamp();

      const dmEnabled = await getDMNotifications();
      if (dmEnabled) {
        try {
          await message.author.send({ embeds: [embed] });
        } catch (e) {
          const channelId = await getConfig('announcementChannel');
          if (channelId) {
            const channel = guild.channels.cache.get(channelId);
            if (channel) {
              await channel.send({ embeds: [embed] });
            } else {
              await message.channel.send({ embeds: [embed] });
            }
          } else {
            await message.channel.send({ embeds: [embed] });
          }
        }
      } else {
        const channelId = await getConfig('announcementChannel');
        if (channelId) {
          const channel = guild.channels.cache.get(channelId);
          if (channel) {
            await channel.send({ embeds: [embed] });
          } else {
            await message.channel.send({ embeds: [embed] });
          }
        } else {
          await message.channel.send({ embeds: [embed] });
        }
      }

      logLevel(message.author.username, result.newLevel, result.totalEarned);
    }
  } catch (error) {
    logError(error, 'messageCreate');
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    logCommand(interaction.user.username, interaction.commandName, interaction.channel?.name || 'DM');

    const { commandName } = interaction;

    if (commandName === 'rank') {
      const user = interaction.options.getUser('user') || interaction.user;
      const userData = await getUser(user.id);

      if (!userData) {
        return interaction.reply({ content: `${user.username} has not earned any XP yet!`, ephemeral: true });
      }

      const requiredXP = getRequiredXP(userData.level);
      const progress = Math.floor((userData.xp / requiredXP) * 100);
      const weekendStatus = isWeekend() ? '🎉 Weekend 2x Active!' : '';
      const vipStatus = await isVIP(user.id) ? '⭐ VIP Member' : '';

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${user.username}'s Rank`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '📊 Level', value: userData.level.toString(), inline: true },
          { name: '💰 XP', value: `${userData.xp.toLocaleString()} / ${requiredXP.toLocaleString()}`, inline: true },
          { name: '📈 Progress', value: `${progress}%`, inline: true },
          { name: '🔥 Streak', value: `${userData.streak || 0} days`, inline: true },
          { name: '🎯 Total Earned', value: (userData.total_xp_earned || 0).toLocaleString(), inline: true },
          { name: '🗓️ Weekend', value: weekendStatus || 'Normal', inline: true },
          { name: '⭐ VIP', value: vipStatus || 'None', inline: true }
        )
        .setImage(await getBanner())
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'leaderboard' || commandName === 'weekly' || commandName === 'monthly') {
      const type = commandName === 'weekly' ? 'weekly' : commandName === 'monthly' ? 'monthly' : 'all';
      const leaderboard = await getLeaderboard(10, type);

      if (leaderboard.length === 0) {
        return interaction.reply({ content: 'No users on the leaderboard yet!', ephemeral: true });
      }

      const title = type === 'weekly' ? '📅 Weekly Leaderboard' : type === 'monthly' ? '📆 Monthly Leaderboard' : '🏆 Leaderboard';

      let description = '';
      leaderboard.forEach((user, index) => {
        const medals = ['🥇', '🥈', '🥉'];
        const medal = medals[index] || `${index + 1}. `;
        const xp = type === 'all' ? user.xp : type === 'weekly' ? (user.weekly_xp || 0) : (user.monthly_xp || 0);
        description += `${medal} <@${user.user_id}> - Level ${user.level} (${(xp || 0).toLocaleString()} XP)\n`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(title)
        .setDescription(description)
        .setImage(await getBanner())
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'level') {
      const user = interaction.options.getUser('user') || interaction.user;
      const userData = await getUser(user.id);

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
          { name: '📊 Current Level', value: userData.level.toString(), inline: true },
          { name: '💰 Current XP', value: userData.xp.toLocaleString(), inline: true },
          { name: '📈 XP to Next', value: xpToNext.toLocaleString(), inline: true }
        )
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'compare') {
      const user1 = interaction.options.getUser('user1') || interaction.user;
      const user2 = interaction.options.getUser('user2');

      if (!user2) {
        return interaction.reply({ content: 'Please specify a second user to compare!', ephemeral: true });
      }

      const data1 = await getUser(user1.id);
      const data2 = await getUser(user2.id);

      if (!data1 || !data2) {
        return interaction.reply({ content: 'Both users must have XP to compare!', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚖️ XP Comparison')
        .setThumbnail(user1.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: user1.username, value: `Level: ${data1.level}\nXP: ${data1.xp.toLocaleString()}\nTotal: ${(data1.total_xp_earned || 0).toLocaleString()}`, inline: true },
          { name: user2.username, value: `Level: ${data2.level}\nXP: ${data2.xp.toLocaleString()}\nTotal: ${(data2.total_xp_earned || 0).toLocaleString()}`, inline: true }
        )
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'setcooldown') {
      const seconds = interaction.options.getInteger('seconds');
      await setConfig('cooldown', seconds);
      log('success', `⏱️ Cooldown set to ${seconds}s by ${interaction.user.username}`);
      interaction.reply({ content: `Cooldown set to ${seconds} seconds!`, ephemeral: true });
    }

    if (commandName === 'setbanner') {
      const url = interaction.options.getString('url');
      await setConfig('banner', url);
      log('success', `🖼️ Banner updated by ${interaction.user.username}`);
      interaction.reply({ content: `Banner image updated!`, ephemeral: true });
    }

    if (commandName === 'setreward') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');
      await setReward(level, role.id);
      log('success', `🏅 Level ${level} reward: ${role.name} (by ${interaction.user.username})`);
      interaction.reply({ content: `Level ${level} will now grant the ${role.name} role!`, ephemeral: true });
    }

    if (commandName === 'rewards') {
      const rewards = await getAllRewards();

      if (rewards.length === 0) {
        return interaction.reply({ content: 'No level rewards configured yet!', ephemeral: true });
      }

      let description = '';
      for (const reward of rewards) {
        description += `Level ${reward.level}: <@&${reward.role_id}>\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎁 Level Rewards')
        .setDescription(description)
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'setmessage') {
      const message = interaction.options.getString('message');
      await setConfig('levelUpMessage', message);
      log('success', `📝 Level-up message updated by ${interaction.user.username}`);
      interaction.reply({ content: `Level-up message updated!`, ephemeral: true });
    }

    if (commandName === 'setchannel') {
      const channel = interaction.options.getChannel('channel');
      await setConfig('announcementChannel', channel.id);
      log('success', `📢 Announcements channel set to #${channel.name} by ${interaction.user.username}`);
      interaction.reply({ content: `Level-up announcements will be sent to ${channel}!`, ephemeral: true });
    }

    if (commandName === 'setdailybonus') {
      const amount = interaction.options.getInteger('amount');
      await setConfig('dailyBonus', amount);
      log('success', `🎁 Daily bonus set to ${amount} XP by ${interaction.user.username}`);
      interaction.reply({ content: `Daily bonus set to ${amount} XP!`, ephemeral: true });
    }

    if (commandName === 'setmultiplier') {
      const multiplier = interaction.options.getNumber('multiplier');
      await setConfig('serverMultiplier', multiplier);
      log('success', `⚡ Server multiplier set to ${multiplier}x by ${interaction.user.username}`);
      interaction.reply({ content: `Server multiplier set to ${multiplier}x!`, ephemeral: true });
    }

    if (commandName === 'setrolemultiplier') {
      const role = interaction.options.getRole('role');
      const multiplier = interaction.options.getNumber('multiplier');
      await setRoleMultiplier(role.id, multiplier);
      log('success', `⚡ ${role.name} multiplier set to ${multiplier}x by ${interaction.user.username}`);
      interaction.reply({ content: `${role.name} now has ${multiplier}x XP multiplier!`, ephemeral: true });
    }

    if (commandName === 'rolemultipliers') {
      const multipliers = await getAllRoleMultipliers();

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
        .setTitle('⚡ Role Multipliers')
        .setDescription(description)
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'addinvite') {
      const user = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount') || 1;
      const xpFromInvite = amount * 5;
      await addXP(user.id, user.username, xpFromInvite, true, true);
      log('success', `📨 ${amount} invites added to ${user.username} (+${xpFromInvite} XP) by ${interaction.user.username}`);
      interaction.reply({ content: `Added ${amount} invite(s) to ${user.username} (+${xpFromInvite} XP)!`, ephemeral: true });
    }

    if (commandName === 'invites') {
      const user = interaction.options.getUser('user') || interaction.user;
      const userData = await getUser(user.id);
      const invites = userData?.invites || 0;
      interaction.reply({ content: `${user.username} has ${invites} invite(s)!` });
    }

    if (commandName === 'blacklist') {
      const channel = interaction.options.getChannel('channel');
      const action = interaction.options.getString('action');

      if (action === 'add') {
        await addBlacklistedChannel(channel.id);
        log('warn', `🚫 ${channel.name} blacklisted by ${interaction.user.username}`);
        interaction.reply({ content: `${channel} is now blacklisted from XP gain!`, ephemeral: true });
      } else if (action === 'remove') {
        await removeBlacklistedChannel(channel.id);
        log('success', `✅ ${channel.name} removed from blacklist by ${interaction.user.username}`);
        interaction.reply({ content: `${channel} removed from blacklist!`, ephemeral: true });
      }
    }

    if (commandName === 'blacklistchannels') {
      const channels = await getBlacklistedChannels();

      if (channels.length === 0) {
        return interaction.reply({ content: 'No blacklisted channels!', ephemeral: true });
      }

      let description = '';
      for (const ch of channels) {
        const channel = interaction.guild.channels.cache.get(ch.channel_id);
        description += `${channel || 'Unknown Channel'}\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🚫 Blacklisted Channels')
        .setDescription(description)
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'resetuser') {
      const user = interaction.options.getUser('user');
      if (USE_MONGODB) {
        await db.collection('users').deleteOne({ user_id: user.id.toString() });
      } else {
        const stmt = db.prepare('DELETE FROM users WHERE user_id = ?');
        stmt.run(user.id);
      }
      log('warn', `🗑️ ${user.username} reset by ${interaction.user.username}`);
      interaction.reply({ content: `Reset XP and level for ${user.username}!`, ephemeral: true });
    }

    if (commandName === 'resetall') {
      if (USE_MONGODB) {
        await db.collection('users').deleteMany({});
      } else {
        const stmt = db.prepare('DELETE FROM users');
        stmt.run();
      }
      log('warn', `🗑️ All users reset by ${interaction.user.username}`);
      interaction.reply({ content: `Reset all user XP and levels!`, ephemeral: true });
    }

    if (commandName === 'stats') {
      const allUsers = await getLeaderboard(100000, 'all');
      const totalUsers = allUsers.length;
      const totalXP = allUsers.reduce((sum, u) => sum + (u.xp || 0), 0);
      const totalEarned = allUsers.reduce((sum, u) => sum + (u.total_xp_earned || 0), 0);
      const maxLevel = Math.max(...allUsers.map(u => u.level || 0), 0);

      const weeklyUsers = await getLeaderboard(100000, 'weekly');
      const weeklyXP = weeklyUsers.reduce((sum, u) => sum + (u.weekly_xp || 0), 0);

      const monthlyUsers = await getLeaderboard(100000, 'monthly');
      const monthlyXP = monthlyUsers.reduce((sum, u) => sum + (u.monthly_xp || 0), 0);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Server XP Statistics')
        .addFields(
          { name: '👥 Total Users', value: totalUsers.toLocaleString(), inline: true },
          { name: '💰 Current XP', value: totalXP.toLocaleString(), inline: true },
          { name: '🎯 Total Earned', value: totalEarned.toLocaleString(), inline: true },
          { name: '🏆 Highest Level', value: maxLevel.toString(), inline: true },
          { name: '📅 Weekly XP', value: weeklyXP.toLocaleString(), inline: true },
          { name: '📆 Monthly XP', value: monthlyXP.toLocaleString(), inline: true }
        )
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'setvip') {
      const user = interaction.options.getUser('user');
      const days = interaction.options.getInteger('days');
      await setVIP(user.id, days);
      log('success', `⭐ ${user.username} is now VIP for ${days} days (by ${interaction.user.username})`);
      interaction.reply({ content: `${user.username} is now VIP for ${days} days!`, ephemeral: true });
    }

    if (commandName === 'checkvip') {
      const user = interaction.options.getUser('user') || interaction.user;
      const vip = await isVIP(user.id);

      if (vip) {
        const userData = await getUser(user.id);
        const vipDate = new Date(userData.vip_until).toLocaleDateString();
        interaction.reply({ content: `⭐ ${user.username} is VIP until ${vipDate}!` });
      } else {
        interaction.reply({ content: `${user.username} is not a VIP member.` });
      }
    }

    if (commandName === 'setstreak') {
      const user = interaction.options.getUser('user');
      const days = interaction.options.getInteger('days');
      const userData = await getUser(user.id);
      if (userData) {
        userData.streak = days;
        await saveUser(userData);
        log('success', `🔥 ${user.username}'s streak set to ${days} days by ${interaction.user.username}`);
      }
      interaction.reply({ content: `Set ${user.username}'s streak to ${days} days!`, ephemeral: true });
    }

    if (commandName === 'dmnotifications') {
      const enabled = interaction.options.getString('action') === 'enable';
      await setConfig('dmNotifications', enabled);
      log('success', `📬 DM notifications ${enabled ? 'enabled' : 'disabled'} by ${interaction.user.username}`);
      interaction.reply({ content: `DM notifications ${enabled ? 'enabled' : 'disabled'}!`, ephemeral: true });
    }

    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🤖 Leveling Bot Commands')
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
• \`/setvip <user> <days>\` - Set VIP status
• \`/setstreak <user> <days>\` - Set streak
• \`/resetuser <user>\` - Reset user XP
• \`/resetall\` - Reset all XP

**Other:**
• \`/stats\` - Server XP statistics
• \`/help\` - Show this message
        `)
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    }
  } catch (error) {
    logError(error, `command: ${interaction.commandName}`);
    interaction.reply({ content: 'An error occurred!', ephemeral: true });
  }
});

client.on('ready', () => {
  log('success', `✅ Logged in as ${client.user.tag}`);
  log('info', `🏠 Serving ${client.guilds.cache.size} server(s)`);
  client.user.setActivity('XP System | /help', { type: 3 });
});

const { DeployCommands } = await import('./utils/deployCommands.js');
await DeployCommands(process.env.CLIENT_ID, process.env.GUILD_ID, process.env.BOT_TOKEN);

log('info', '🚀 Deploying slash commands...');

client.login(process.env.BOT_TOKEN);
