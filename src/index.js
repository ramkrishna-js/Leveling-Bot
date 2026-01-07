import { Client, GatewayIntentBits, EmbedBuilder, ActivityType } from 'discord.js';
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      multiplier REAL NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      active INTEGER DEFAULT 1,
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS level_milestones (
      level INTEGER PRIMARY KEY,
      role_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS channel_first_messages (
      user_id TEXT,
      channel_id TEXT,
      date TEXT,
      PRIMARY KEY (user_id, channel_id, date)
    );

    CREATE TABLE IF NOT EXISTS voice_channel_multipliers (
      channel_id TEXT PRIMARY KEY,
      multiplier REAL DEFAULT 1.0
    );

    CREATE TABLE IF NOT EXISTS user_activity (
      user_id TEXT,
      hour INTEGER,
      day INTEGER,
      messages INTEGER DEFAULT 0,
      xp_earned INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, hour, day)
    );

    CREATE TABLE IF NOT EXISTS birthdays (
      user_id TEXT PRIMARY KEY,
      month INTEGER,
      day INTEGER,
      year INTEGER
    );

    CREATE TABLE IF NOT EXISTS join_anniversaries (
      user_id TEXT PRIMARY KEY,
      join_date TEXT,
      last_celebrated TEXT
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      target INTEGER,
      type TEXT,
      xp_reward INTEGER,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS user_challenges (
      user_id TEXT,
      challenge_id INTEGER,
      progress INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      date TEXT,
      PRIMARY KEY (user_id, challenge_id, date)
    );

    CREATE TABLE IF NOT EXISTS mentors (
      mentor_id TEXT,
      mentee_id TEXT,
      xp_bonus REAL DEFAULT 1.2,
      PRIMARY KEY (mentor_id, mentee_id)
    );

    CREATE TABLE IF NOT EXISTS quiet_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_hour INTEGER,
      end_hour INTEGER,
      multiplier REAL DEFAULT 0.5,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS inactivity_warnings (
      user_id TEXT PRIMARY KEY,
      last_active TEXT,
      warned INTEGER DEFAULT 0
    );
  `);
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
    cmd: '\x1b[34m',
    event: '\x1b[36m'
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
const getXPCap = async () => (await getConfig('xpCap')) || 0;
const getReactionXP = async () => (await getConfig('reactionXP')) || 1;
const getWelcomeBonus = async () => (await getConfig('welcomeBonus')) || 100;
const getWelcomeBonusDays = async () => (await getConfig('welcomeBonusDays')) || 7;
const getMentorBonus = async () => (await getConfig('mentorBonus')) || 0.2;

const getXPGain = () => Math.floor(Math.random() * 16) + 10;

const isWeekend = () => {
  const day = new Date().getDay();
  return day === 0 || day === 6;
};

const getWeekendMultiplier = () => isWeekend() ? 2 : 1;

const isQuietHours = async () => {
  if (USE_MONGODB) {
    const qh = await db.collection('quiet_hours').findOne({ active: 1 });
    if (!qh) return { active: false };
    const now = new Date();
    const currentHour = now.getHours();
    if (qh.start_hour < qh.end_hour) {
      return { active: currentHour >= qh.start_hour && currentHour < qh.end_hour, multiplier: qh.multiplier };
    } else {
      return { active: currentHour >= qh.start_hour || currentHour < qh.end_hour, multiplier: qh.multiplier };
    }
  }
  const stmt = db.prepare('SELECT * FROM quiet_hours WHERE active = 1 LIMIT 1');
  const qh = stmt.get();
  if (!qh) return { active: false };
  const now = new Date();
  const currentHour = now.getHours();
  if (qh.start_hour < qh.end_hour) {
    return { active: currentHour >= qh.start_hour && currentHour < qh.end_hour, multiplier: qh.multiplier };
  } else {
    return { active: currentHour >= qh.start_hour || currentHour < qh.end_hour, multiplier: qh.multiplier };
  }
};

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

  const eventMultiplier = await getActiveEventMultiplier();
  if (eventMultiplier > 1) {
    multiplier *= eventMultiplier;
  }

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

  const quiet = await isQuietHours();
  if (quiet.active) {
    multiplier *= quiet.multiplier;
  }

  const isBirthday = await isUserBirthday(member.id);
  if (isBirthday) {
    multiplier *= 2;
  }

  const welcomeBonus = await isWithinWelcomePeriod(member.id);
  if (welcomeBonus) {
    multiplier *= 1.5;
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

const getLongMessageBonus = (content) => {
  if (content.length >= 100) return 2;
  if (content.length >= 50) return 1.5;
  if (content.length >= 25) return 1.2;
  return 1;
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

const getActivityStreak = async (userId) => {
  const user = await getUser(userId);
  return user?.streak || 0;
};

const addXP = async (userId, username, xpToAdd, isWeekly = false, isMonthly = false, trackActivity = true) => {
  const xpCap = await getXPCap();
  let cappedXP = xpToAdd;
  
  if (xpCap > 0) {
    const user = await getUser(userId);
    const todayXP = (user?.today_xp || 0);
    if (todayXP >= xpCap) {
      return { capped: true, message: 'Daily XP cap reached!' };
    }
    cappedXP = Math.min(xpToAdd, xpCap - todayXP);
  }

  const user = await getUser(userId);

  let newXP = cappedXP;
  let newLevel = 0;
  let leveledUp = false;
  let previousLevel = 0;
  let totalEarned = cappedXP;

  if (user) {
    newXP = user.xp + cappedXP;
    newLevel = user.level;
    totalEarned = (user.total_xp_earned || 0) + cappedXP;

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
    user.today_xp = (user.today_xp || 0) + cappedXP;
    if (isWeekly) user.weekly_xp = (user.weekly_xp || 0) + cappedXP;
    if (isMonthly) user.monthly_xp = (user.monthly_xp || 0) + cappedXP;
    await saveUser(user);
  } else {
    newLevel = 1;
    newXP = cappedXP;
    await saveUser({
      user_id: userId.toString(),
      username,
      xp: newXP,
      level: newLevel,
      last_message_time: 0,
      voice_time: 0,
      streak: 0,
      last_active_date: new Date().toDateString(),
      invites: 0,
      weekly_xp: isWeekly ? cappedXP : 0,
      monthly_xp: isMonthly ? cappedXP : 0,
      last_daily_bonus: null,
      vip_until: null,
      total_xp_earned: cappedXP,
      today_xp: cappedXP
    });
    leveledUp = true;
  }

  return { newXP, newLevel, leveledUp, previousLevel, totalEarned, cappedXP };
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
    await db.collection('users').updateMany({}, { $set: { monthly_xp: 0, today_xp: 0 } });
  } else {
    const stmt = db.prepare('UPDATE users SET monthly_xp = 0, today_xp = 0');
    stmt.run();
  }
};

const lastWeeklyReset = { date: null };
const lastMonthlyReset = { date: null };

const getActiveEvent = async () => {
  const now = Date.now();
  if (USE_MONGODB) {
    return await db.collection('events').findOne({
      end_time: { $gt: now },
      active: true
    });
  }
  const stmt = db.prepare('SELECT * FROM events WHERE end_time > ? AND active = 1 ORDER BY end_time ASC LIMIT 1');
  return stmt.get(now);
};

const getActiveEventMultiplier = async () => {
  const event = await getActiveEvent();
  return event ? event.multiplier : 1;
};

const createEvent = async (name, durationHours, multiplier, createdBy) => {
  const now = Date.now();
  const endTime = now + (durationHours * 60 * 60 * 1000);

  if (USE_MONGODB) {
    await db.collection('events').insertOne({
      name,
      multiplier,
      start_time: now,
      end_time: endTime,
      active: true,
      created_by: createdBy
    });
  } else {
    const stmt = db.prepare('INSERT INTO events (name, multiplier, start_time, end_time, active, created_by) VALUES (?, ?, ?, ?, 1, ?)');
    stmt.run(name, multiplier, now, endTime, createdBy);
  }

  return { name, multiplier, end_time: endTime };
};

const endEvent = async (eventId) => {
  if (USE_MONGODB) {
    await db.collection('events').updateOne({ _id: eventId }, { $set: { active: false } });
  } else {
    const stmt = db.prepare('UPDATE events SET active = 0 WHERE id = ?');
    stmt.run(eventId);
  }
};

const getAllEvents = async () => {
  if (USE_MONGODB) {
    return await db.collection('events').find({}).sort({ start_time: -1 }).toArray();
  }
  const stmt = db.prepare('SELECT * FROM events ORDER BY start_time DESC');
  return stmt.all();
};

const announceEvent = async (client, event, isEnd = false) => {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const announcementChannelId = await getConfig('announcementChannel');
  const channel = announcementChannelId ? guild.channels.cache.get(announcementChannelId) : null;

  if (isEnd) {
    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('🎉 Event Ended!')
      .setDescription(`The **${event.name}** event has ended!\n\nThank you everyone for participating!`)
      .setTimestamp();

    if (channel) {
      await channel.send({ embeds: [embed] });
    } else {
      const defaultChannel = guild.systemChannel;
      if (defaultChannel) {
        await defaultChannel.send({ embeds: [embed] });
      }
    }
    log('success', `🎉 Event "${event.name}" ended`);
  } else {
    const remainingTime = event.end_time - Date.now();
    const hoursLeft = Math.ceil(remainingTime / (1000 * 60 * 60));

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎊 XP Event Started!')
      .setDescription(`**${event.name}** is now active!\n\n📈 **${event.multiplier}x XP** multiplier for everyone!\n\n⏰ Duration: ${hoursLeft} hour(s) remaining`)
      .setImage(await getBanner())
      .setTimestamp();

    if (channel) {
      await channel.send({ embeds: [embed] });
    } else {
      const defaultChannel = guild.systemChannel;
      if (defaultChannel) {
        await defaultChannel.send({ embeds: [embed] });
      }
    }
    log('success', `🎊 Event "${event.name}" started with ${event.multiplier}x multiplier`);
  }
};

const lastEventCheck = { time: 0 };

const isUserBirthday = async (userId) => {
  if (USE_MONGODB) {
    const bd = await db.collection('birthdays').findOne({ user_id: userId.toString() });
    if (!bd) return false;
    const now = new Date();
    return now.getMonth() + 1 === bd.month && now.getDate() === bd.day;
  }
  const stmt = db.prepare('SELECT * FROM birthdays WHERE user_id = ?');
  const bd = stmt.get(userId);
  if (!bd) return false;
  const now = new Date();
  return now.getMonth() + 1 === bd.month && now.getDate() === bd.day;
};

const setBirthday = async (userId, month, day, year) => {
  if (USE_MONGODB) {
    await db.collection('birthdays').updateOne({ user_id: userId.toString() }, { $set: { user_id: userId.toString(), month, day, year } }, { upsert: true });
  } else {
    const stmt = db.prepare('INSERT OR REPLACE INTO birthdays (user_id, month, day, year) VALUES (?, ?, ?, ?)');
    stmt.run(userId, month, day, year);
  }
};

const getBirthday = async (userId) => {
  if (USE_MONGODB) {
    return await db.collection('birthdays').findOne({ user_id: userId.toString() });
  }
  const stmt = db.prepare('SELECT * FROM birthdays WHERE user_id = ?');
  return stmt.get(userId);
};

const isWithinWelcomePeriod = async (userId) => {
  const joinDate = await getJoinDate(userId);
  if (!joinDate) return false;

  const welcomeDays = await getWelcomeBonusDays();
  const join = new Date(joinDate);
  const now = new Date();
  const diffDays = Math.floor((now - join) / (1000 * 60 * 60 * 24));

  return diffDays < welcomeDays;
};

const getJoinDate = async (userId) => {
  if (USE_MONGODB) {
    const ja = await db.collection('join_anniversaries').findOne({ user_id: userId.toString() });
    return ja?.join_date;
  }
  const stmt = db.prepare('SELECT join_date FROM join_anniversaries WHERE user_id = ?');
  const ja = stmt.get(userId);
  return ja?.join_date;
};

const setJoinDate = async (userId, joinDate) => {
  if (USE_MONGODB) {
    await db.collection('join_anniversaries').updateOne({ user_id: userId.toString() }, { $set: { user_id: userId.toString(), join_date: joinDate } }, { upsert: true });
  } else {
    const stmt = db.prepare('INSERT OR REPLACE INTO join_anniversaries (user_id, join_date) VALUES (?, ?)');
    stmt.run(userId, joinDate);
  }
};

const isJoinAnniversary = async (userId) => {
  const joinDate = await getJoinDate(userId);
  if (!joinDate) return false;

  const join = new Date(joinDate);
  const now = new Date();
  const lastCelebrated = await getLastAnniversaryCelebrated(userId);

  return now.getMonth() === join.getMonth() &&
         now.getDate() === join.getDate() &&
         lastCelebrated !== now.toDateString();
};

const getLastAnniversaryCelebrated = async (userId) => {
  if (USE_MONGODB) {
    const ja = await db.collection('join_anniversaries').findOne({ user_id: userId.toString() });
    return ja?.last_celebrated;
  }
  const stmt = db.prepare('SELECT last_celebrated FROM join_anniversaries WHERE user_id = ?');
  const ja = stmt.get(userId);
  return ja?.last_celebrated;
};

const setLastAnniversaryCelebrated = async (userId, date) => {
  if (USE_MONGODB) {
    await db.collection('join_anniversaries').updateOne({ user_id: userId.toString() }, { $set: { last_celebrated: date } });
  } else {
    const stmt = db.prepare('UPDATE join_anniversaries SET last_celebrated = ? WHERE user_id = ?');
    stmt.run(date, userId);
  }
};

const checkAndAwardAnniversary = async (userId, username) => {
  if (await isJoinAnniversary(userId)) {
    const anniversaryBonus = 50;
    await addXP(userId, username, anniversaryBonus, true, true);
    log('success', `🎂 ${username} celebrated join anniversary (+${anniversaryBonus} XP)`);
    await setLastAnniversaryCelebrated(userId, new Date().toDateString());
  }
};

const isFirstMessageInChannelToday = async (userId, channelId) => {
  const today = new Date().toDateString();
  if (USE_MONGODB) {
    const result = await db.collection('channel_first_messages').findOne({
      user_id: userId.toString(),
      channel_id: channelId.toString(),
      date: today
    });
    if (result) return false;
    await db.collection('channel_first_messages').insertOne({
      user_id: userId.toString(),
      channel_id: channelId.toString(),
      date: today
    });
    return true;
  }
  const stmt = db.prepare('SELECT 1 FROM channel_first_messages WHERE user_id = ? AND channel_id = ? AND date = ?');
  const result = stmt.get(userId, channelId, today);
  if (result) return false;
  const insertStmt = db.prepare('INSERT OR IGNORE INTO channel_first_messages (user_id, channel_id, date) VALUES (?, ?, ?)');
  insertStmt.run(userId, channelId, today);
  return true;
};

const setVoiceChannelMultiplier = async (channelId, multiplier) => {
  if (USE_MONGODB) {
    await db.collection('voice_channel_multipliers').updateOne({ channel_id: channelId.toString() }, { $set: { channel_id: channelId.toString(), multiplier } }, { upsert: true });
  } else {
    const stmt = db.prepare('INSERT OR REPLACE INTO voice_channel_multipliers (channel_id, multiplier) VALUES (?, ?)');
    stmt.run(channelId, multiplier);
  }
};

const getVoiceChannelMultiplier = async (channelId) => {
  if (USE_MONGODB) {
    const result = await db.collection('voice_channel_multipliers').findOne({ channel_id: channelId.toString() });
    return result?.multiplier || 1.0;
  }
  const stmt = db.prepare('SELECT multiplier FROM voice_channel_multipliers WHERE channel_id = ?');
  const result = stmt.get(channelId);
  return result?.multiplier || 1.0;
};

const getAllVoiceChannelMultipliers = async () => {
  if (USE_MONGODB) {
    return await db.collection('voice_channel_multipliers').find({}).toArray();
  }
  const stmt = db.prepare('SELECT * FROM voice_channel_multipliers');
  return stmt.all();
};

const setLevelMilestone = async (level, roleId) => {
  if (USE_MONGODB) {
    await db.collection('level_milestones').updateOne({ level }, { $set: { level, role_id: roleId } }, { upsert: true });
  } else {
    const stmt = db.prepare('INSERT OR REPLACE INTO level_milestones (level, role_id) VALUES (?, ?)');
    stmt.run(level, roleId);
  }
};

const getAllLevelMilestones = async () => {
  if (USE_MONGODB) {
    return await db.collection('level_milestones').find({}).sort({ level: 1 }).toArray();
  }
  const stmt = db.prepare('SELECT * FROM level_milestones ORDER BY level');
  return stmt.all();
};

const checkLevelMilestones = async (userId, newLevel, guild) => {
  const milestones = await getAllLevelMilestones();
  for (const milestone of milestones) {
    if (newLevel >= milestone.level) {
      const role = guild.roles.cache.get(milestone.role_id);
      if (role) {
        const member = await guild.members.fetch(userId);
        if (member && !member.roles.has(role.id)) {
          await member.roles.add(role);
          log('success', `🏅 ${member.user.username} earned milestone role: ${role.name} (Level ${milestone.level})`);
        }
      }
    }
  }
};

const setQuietHours = async (startHour, endHour, multiplier) => {
  if (USE_MONGODB) {
    await db.collection('quiet_hours').updateOne({ active: 1 }, { $set: { start_hour: startHour, end_hour: endHour, multiplier, active: 1 } }, { upsert: true });
  } else {
    const stmt = db.prepare('UPDATE quiet_hours SET active = 0');
    stmt.run();
    const insertStmt = db.prepare('INSERT INTO quiet_hours (start_hour, end_hour, multiplier, active) VALUES (?, ?, ?, 1)');
    insertStmt.run(startHour, endHour, multiplier);
  }
};

const getQuietHours = async () => {
  if (USE_MONGODB) {
    return await db.collection('quiet_hours').findOne({ active: 1 });
  }
  const stmt = db.prepare('SELECT * FROM quiet_hours WHERE active = 1 LIMIT 1');
  return stmt.get();
};

const trackActivity = async (userId, xpEarned) => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  if (USE_MONGODB) {
    await db.collection('user_activity').updateOne(
      { user_id: userId.toString(), hour, day },
      { $inc: { messages: 1, xp_earned: xpEarned } },
      { upsert: true }
    );
  } else {
    const stmt = db.prepare('INSERT OR REPLACE INTO user_activity (user_id, hour, day, messages, xp_earned) VALUES (?, ?, ?, COALESCE((SELECT messages FROM user_activity WHERE user_id = ? AND hour = ? AND day = ?) + 1, 1), COALESCE((SELECT xp_earned FROM user_activity WHERE user_id = ? AND hour = ? AND day = ?) + ?, ?))');
    stmt.run(userId, hour, day, userId, hour, day, userId, hour, day, xpEarned, xpEarned);
  }
};

const getUserActivity = async (userId) => {
  if (USE_MONGODB) {
    return await db.collection('user_activity').find({ user_id: userId.toString() }).toArray();
  }
  const stmt = db.prepare('SELECT * FROM user_activity WHERE user_id = ?');
  return stmt.all(userId);
};

const getActivityHeatmap = async () => {
  if (USE_MONGODB) {
    return await db.collection('user_activity').aggregate([
      { $group: { _id: { hour: '$hour', day: '$day' }, totalXP: { $sum: '$xp_earned' }, totalMessages: { $sum: '$messages' } } },
      { $sort: { totalXP: -1 } }
    ]).toArray();
  }
  const stmt = db.prepare('SELECT hour, day, SUM(xp_earned) as totalXP, SUM(messages) as totalMessages FROM user_activity GROUP BY hour, day ORDER BY totalXP DESC');
  return stmt.all();
};

const getServerActivityStats = async () => {
  if (USE_MONGODB) {
    const result = await db.collection('user_activity').aggregate([
      { $group: { _id: null, totalXP: { $sum: '$xp_earned' }, totalMessages: { $sum: '$messages' } } }
    ]).toArray();
    const peakHour = await db.collection('user_activity').aggregate([
      { $group: { _id: '$hour', totalXP: { $sum: '$xp_earned' } } },
      { $sort: { totalXP: -1 } },
      { $limit: 1 }
    ]).toArray();
    const peakDay = await db.collection('user_activity').aggregate([
      { $group: { _id: '$day', totalXP: { $sum: '$xp_earned' } } },
      { $sort: { totalXP: -1 } },
      { $limit: 1 }
    ]).toArray();
    return { totalXP: result[0]?.totalXP || 0, totalMessages: result[0]?.totalMessages || 0, peakHour: peakHour[0]?._id, peakDay: peakDay[0]?._id };
  }
  const totalStmt = db.prepare('SELECT SUM(xp_earned) as totalXP, SUM(messages) as totalMessages FROM user_activity');
  const total = totalStmt.get();
  const peakHourStmt = db.prepare('SELECT hour, SUM(xp_earned) as totalXP FROM user_activity GROUP BY hour ORDER BY totalXP DESC LIMIT 1');
  const peakHour = peakHourStmt.get();
  const peakDayStmt = db.prepare('SELECT day, SUM(xp_earned) as totalXP FROM user_activity GROUP BY day ORDER BY totalXP DESC LIMIT 1');
  const peakDay = peakDayStmt.get();
  return { totalXP: total?.totalXP || 0, totalMessages: total?.totalMessages || 0, peakHour: peakHour?.hour, peakDay: peakDay?.day };
};

const addChallenge = async (name, description, target, type, xpReward) => {
  if (USE_MONGODB) {
    await db.collection('challenges').insertOne({ name, description, target, type, xp_reward: xpReward, active: true });
  } else {
    const stmt = db.prepare('INSERT INTO challenges (name, description, target, type, xp_reward, active) VALUES (?, ?, ?, ?, ?, 1)');
    stmt.run(name, description, target, type, xpReward);
  }
};

const getActiveChallenges = async () => {
  if (USE_MONGODB) {
    return await db.collection('challenges').find({ active: true }).toArray();
  }
  const stmt = db.prepare('SELECT * FROM challenges WHERE active = 1');
  return stmt.all();
};

const getUserChallenges = async (userId) => {
  const today = new Date().toDateString();
  if (USE_MONGODB) {
    return await db.collection('user_challenges').find({ user_id: userId.toString(), date: today }).toArray();
  }
  const stmt = db.prepare('SELECT * FROM user_challenges WHERE user_id = ? AND date = ?');
  return stmt.all(userId, today);
};

const updateChallengeProgress = async (userId, challengeId, increment = 1) => {
  const today = new Date().toDateString();
  if (USE_MONGODB) {
    const result = await db.collection('user_challenges').findOne({ user_id: userId.toString(), challenge_id: challengeId, date: today });
    if (result?.completed) return false;
    await db.collection('user_challenges').updateOne(
      { user_id: userId.toString(), challenge_id: challengeId, date: today },
      { $inc: { progress: increment } },
      { upsert: true }
    );
    const updated = await db.collection('user_challenges').findOne({ user_id: userId.toString(), challenge_id: challengeId, date: today });
    const challenge = await db.collection('challenges').findOne({ id: challengeId });
    if (updated.progress >= challenge.target && !updated.completed) {
      await db.collection('user_challenges').updateOne({ user_id: userId.toString(), challenge_id: challengeId, date: today }, { $set: { completed: 1 } });
      return 'completed';
    }
    return 'updated';
  }
  const stmt = db.prepare('SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ? AND date = ?');
  const result = stmt.get(userId, challengeId, today);
  if (result?.completed) return false;
  if (result) {
    const updateStmt = db.prepare('UPDATE user_challenges SET progress = progress + ? WHERE user_id = ? AND challenge_id = ? AND date = ?');
    updateStmt.run(increment, userId, challengeId, today);
  } else {
    const insertStmt = db.prepare('INSERT INTO user_challenges (user_id, challenge_id, progress, completed, date) VALUES (?, ?, ?, 0, ?)');
    insertStmt.run(userId, challengeId, increment, today);
  }
  const checkStmt = db.prepare('SELECT progress FROM user_challenges WHERE user_id = ? AND challenge_id = ? AND date = ?');
  const updated = checkStmt.get(userId, challengeId, today);
  const challengeStmt = db.prepare('SELECT target FROM challenges WHERE id = ?');
  const challenge = challengeStmt.get(challengeId);
  if (updated.progress >= challenge.target && !result?.completed) {
    const completeStmt = db.prepare('UPDATE user_challenges SET completed = 1 WHERE user_id = ? AND challenge_id = ? AND date = ?');
    completeStmt.run(userId, challengeId, today);
    return 'completed';
  }
  return 'updated';
};

const claimChallengeReward = async (userId, challengeId) => {
  const today = new Date().toDateString();
  if (USE_MONGODB) {
    const result = await db.collection('user_challenges').findOne({ user_id: userId.toString(), challenge_id: challengeId, date: today });
    if (!result?.completed) return { claimed: false, message: 'Challenge not completed' };
    if (result.claimed) return { claimed: false, message: 'Already claimed' };
    const challenge = await db.collection('challenges').findOne({ id: challengeId });
    await db.collection('user_challenges').updateOne({ user_id: userId.toString(), challenge_id: challengeId, date: today }, { $set: { claimed: 1 } });
    return { claimed: true, xp: challenge.xp_reward };
  }
  const stmt = db.prepare('SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ? AND date = ?');
  const result = stmt.get(userId, challengeId, today);
  if (!result?.completed) return { claimed: false, message: 'Challenge not completed' };
  if (result.claimed) return { claimed: false, message: 'Already claimed' };
  const challengeStmt = db.prepare('SELECT xp_reward FROM challenges WHERE id = ?');
  const challenge = challengeStmt.get(challengeId);
  const claimStmt = db.prepare('UPDATE user_challenges SET claimed = 1 WHERE user_id = ? AND challenge_id = ? AND date = ?');
  claimStmt.run(userId, challengeId, today);
  return { claimed: true, xp: challenge.xp_reward };
};

const setMentor = async (mentorId, menteeId, bonus = 0.2) => {
  if (USE_MONGODB) {
    await db.collection('mentors').updateOne({ mentor_id: mentorId.toString(), mentee_id: menteeId.toString() }, { $set: { mentor_id: mentorId.toString(), mentee_id: menteeId.toString(), xp_bonus: bonus } }, { upsert: true });
  } else {
    const stmt = db.prepare('INSERT OR REPLACE INTO mentors (mentor_id, mentee_id, xp_bonus) VALUES (?, ?, ?)');
    stmt.run(mentorId, menteeId, bonus);
  }
};

const getMentor = async (userId) => {
  if (USE_MONGODB) {
    return await db.collection('mentors').findOne({ mentee_id: userId.toString() });
  }
  const stmt = db.prepare('SELECT * FROM mentors WHERE mentee_id = ?');
  return stmt.get(userId);
};

const getMentees = async (mentorId) => {
  if (USE_MONGODB) {
    return await db.collection('mentors').find({ mentor_id: mentorId.toString() }).toArray();
  }
  const stmt = db.prepare('SELECT * FROM mentors WHERE mentor_id = ?');
  return stmt.all(mentorId);
};

const getMentorBonusXP = async (userId) => {
  const mentor = await getMentor(userId);
  if (!mentor) return 0;
  return mentor.xp_bonus || (await getMentorBonus());
};

const removeMentor = async (mentorId, menteeId) => {
  if (USE_MONGODB) {
    await db.collection('mentors').deleteOne({ mentor_id: mentorId.toString(), mentee_id: menteeId.toString() });
  } else {
    const stmt = db.prepare('DELETE FROM mentors WHERE mentor_id = ? AND mentee_id = ?');
    stmt.run(mentorId, menteeId);
  }
};

const lastEventCheck = { time: 0 };
const lastDailyReset = { date: null };

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions
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
      log('success', '📅 Monthly XP and daily XP reset!');
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

setInterval(async () => {
  try {
    const now = Date.now();
    if (now - lastEventCheck.time < 60000) return;
    lastEventCheck.time = now;

    const activeEvent = await getActiveEvent();
    if (activeEvent && now >= activeEvent.end_time) {
      await endEvent(activeEvent._id || activeEvent.id);
      await announceEvent(client, activeEvent, true);
    }
  } catch (error) {
    logError(error, 'event timer');
  }
}, 30000);

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (oldState.channelId === newState.channelId) return;

  if (oldState.channelId && !newState.channelId) {
    const member = oldState.member;
    if (member.bot) return;

    const user = await getUser(member.id);
    const voiceMinutes = user?.voice_time || 0;
    const baseVoiceXP = Math.floor(voiceMinutes / 5);

    if (baseVoiceXP > 0) {
      const channelMultiplier = await getVoiceChannelMultiplier(oldState.channelId);
      const voiceXP = Math.floor(baseVoiceXP * channelMultiplier);

      const member = newState.guild.members.cache.get(member.id) || await newState.guild.members.fetch(member.id);
      const userMultiplier = await getUserMultiplier(member);
      const totalVoiceXP = Math.floor(voiceXP * userMultiplier);

      await addXP(member.id, member.user.username, totalVoiceXP, true, true);
      logXP(member.user.username, totalVoiceXP, 'voice');
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

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.message.channel.type === 1) return;

  const reactionXP = await getReactionXP();
  if (reactionXP <= 0) return;

  if (reaction.emoji.name === '⭐' || reaction.emoji.name === '👍' || reaction.emoji.name === '❤️') {
    const messageAuthor = reaction.message.author;
    if (messageAuthor && messageAuthor.id !== user.id) {
      const result = await addXP(messageAuthor.id, messageAuthor.username, reactionXP, true, true);
      if (!result.capped) {
        logXP(messageAuthor.username, reactionXP, 'reaction');
      }
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    if (await isChannelBlacklisted(message.channel.id)) return;

    await checkAndAwardAnniversary(message.author.id, message.author.username);

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
    const longMessageBonus = getLongMessageBonus(message.content);

    let totalXP = xpGain + bonusXP + streakBonus + dailyBonus;
    totalXP = Math.floor(totalXP * longMessageBonus);

    const member = message.guild.members.cache.get(message.author.id);
    if (member) {
      const userMultiplier = await getUserMultiplier(member);
      totalXP = Math.floor(totalXP * userMultiplier);
    }

    const isFirstMsg = await isFirstMessageInChannelToday(message.author.id, message.channel.id);
    if (isFirstMsg) {
      totalXP += 5;
      logXP(message.author.username, 5, 'first-in-channel');
    }

    const result = await addXP(message.author.id, message.author.username, totalXP, true, true);

    await trackActivity(message.author.id, result.cappedXP || totalXP);

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

    if (totalXP > 0 && !result.capped) {
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

      await checkLevelMilestones(message.author.id, result.newLevel, guild);

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

client.on('guildMemberAdd', async (member) => {
  if (member.bot) return;

  const joinDate = member.joinedAt.toISOString();
  await setJoinDate(member.id, joinDate);

  const welcomeBonus = await getWelcomeBonus();
  const result = await addXP(member.id, member.user.username, welcomeBonus, true, true);
  log('success', `👋 ${member.user.username} joined (+${welcomeBonus} XP welcome bonus)`);
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
      const activeEvent = await getActiveEvent();
      const eventStatus = activeEvent ? `🎉 ${activeEvent.name} (${activeEvent.multiplier}x)` : '';
      const quiet = await isQuietHours();
      const quietStatus = quiet.active ? `😴 Quiet Hours (${quiet.multiplier}x)` : '';
      const birthdayStatus = await isUserBirthday(user.id) ? '🎂 Birthday!' : '';
      const activityStreak = await getActivityStreak(user.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${user.username}'s Rank`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '📊 Level', value: userData.level.toString(), inline: true },
          { name: '💰 XP', value: `${userData.xp.toLocaleString()} / ${requiredXP.toLocaleString()}`, inline: true },
          { name: '📈 Progress', value: `${progress}%`, inline: true },
          { name: '🔥 Streak', value: `${activityStreak} days`, inline: true },
          { name: '🎯 Total Earned', value: (userData.total_xp_earned || 0).toLocaleString(), inline: true },
          { name: '⭐ VIP', value: vipStatus || 'None', inline: true },
          { name: '🎂 Birthday', value: birthdayStatus || 'Not set', inline: true },
          { name: '🎊 Event', value: eventStatus || 'None', inline: true },
          { name: '🗓️ Multipliers', value: `${weekendStatus || 'Normal'}\n${quietStatus || ''}`, inline: true }
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
      const activityStreak = await getActivityStreak(user.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${user.username}'s Level`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '📊 Current Level', value: userData.level.toString(), inline: true },
          { name: '💰 Current XP', value: userData.xp.toLocaleString(), inline: true },
          { name: '📈 XP to Next', value: xpToNext.toLocaleString(), inline: true },
          { name: '🔥 Streak', value: `${activityStreak} days`, inline: true },
          { name: '🎯 Total Earned', value: (userData.total_xp_earned || 0).toLocaleString(), inline: true }
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

    if (commandName === 'activity') {
      const user = interaction.options.getUser('user') || interaction.user;
      const activity = await getUserActivity(user.id);

      const heatmap = await getServerActivityStats();

      const hourlyData = {};
      const dayData = {};
      for (let i = 0; i < 24; i++) hourlyData[i] = 0;
      for (let i = 0; i < 7; i++) dayData[i] = 0;

      activity.forEach(a => {
        hourlyData[a.hour] = (hourlyData[a.hour] || 0) + (a.xp_earned || 0);
        dayData[a.day] = (dayData[a.day] || 0) + (a.xp_earned || 0);
      });

      const peakHour = Object.keys(hourlyData).reduce((a, b) => hourlyData[a] > hourlyData[b] ? a : b);
      const peakDay = Object.keys(dayData).reduce((a, b) => dayData[a] > dayData[b] ? a : b);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${user.username}'s Activity`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '⏰ Peak Hour', value: `${peakHour}:00`, inline: true },
          { name: '📅 Peak Day', value: days[peakDay], inline: true },
          { name: '💪 Most Active', value: `${days[peakDay]} at ${peakHour}:00`, inline: false }
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

    if (commandName === 'setxpcap') {
      const amount = interaction.options.getInteger('amount');
      await setConfig('xpCap', amount);
      log('success', `🎯 Daily XP cap set to ${amount} by ${interaction.user.username}`);
      interaction.reply({ content: `Daily XP cap set to ${amount} XP!`, ephemeral: true });
    }

    if (commandName === 'setreactionxp') {
      const amount = interaction.options.getInteger('amount');
      await setConfig('reactionXP', amount);
      log('success', `⭐ Reaction XP set to ${amount} by ${interaction.user.username}`);
      interaction.reply({ content: `Reaction XP set to ${amount}!`, ephemeral: true });
    }

    if (commandName === 'setwelcomebonus') {
      const amount = interaction.options.getInteger('amount');
      const days = interaction.options.getInteger('days');
      await setConfig('welcomeBonus', amount);
      await setConfig('welcomeBonusDays', days);
      log('success', `👋 Welcome bonus set to ${amount} XP for ${days} days by ${interaction.user.username}`);
      interaction.reply({ content: `Welcome bonus set to ${amount} XP for ${days} days!`, ephemeral: true });
    }

    if (commandName === 'setvoicemultiplier') {
      const channel = interaction.options.getChannel('channel');
      const multiplier = interaction.options.getNumber('multiplier');
      await setVoiceChannelMultiplier(channel.id, multiplier);
      log('success', `🎤 #${channel.name} voice multiplier set to ${multiplier}x by ${interaction.user.username}`);
      interaction.reply({ content: `#${channel.name} voice multiplier set to ${multiplier}x!`, ephemeral: true });
    }

    if (commandName === 'voicemultipliers') {
      const multipliers = await getAllVoiceChannelMultipliers();

      if (multipliers.length === 0) {
        return interaction.reply({ content: 'No voice channel multipliers configured!', ephemeral: true });
      }

      let description = '';
      for (const m of multipliers) {
        const channel = interaction.guild.channels.cache.get(m.channel_id);
        description += `#${channel?.name || 'Unknown'}: ${m.multiplier}x\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎤 Voice Channel Multipliers')
        .setDescription(description)
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'setquiethours') {
      const start = interaction.options.getInteger('start');
      const end = interaction.options.getInteger('end');
      const multiplier = interaction.options.getNumber('multiplier') || 0.5;
      await setQuietHours(start, end, multiplier);
      log('success', `😴 Quiet hours set: ${start}:00 - ${end}:00 (${multiplier}x) by ${interaction.user.username}`);
      interaction.reply({ content: `Quiet hours set: ${start}:00 - ${end}:00 (${multiplier}x multiplier)!`, ephemeral: true });
    }

    if (commandName === 'quiethours') {
      const qh = await getQuietHours();
      if (!qh) {
        return interaction.reply({ content: 'No quiet hours configured!', ephemeral: true });
      }
      interaction.reply({ content: `😴 Quiet hours: ${qh.start_hour}:00 - ${qh.end_hour}:00 (${qh.multiplier}x multiplier)` });
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

      const activityStats = await getServerActivityStats();

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Server XP Statistics')
        .addFields(
          { name: '👥 Total Users', value: totalUsers.toLocaleString(), inline: true },
          { name: '💰 Current XP', value: totalXP.toLocaleString(), inline: true },
          { name: '🎯 Total Earned', value: totalEarned.toLocaleString(), inline: true },
          { name: '🏆 Highest Level', value: maxLevel.toString(), inline: true },
          { name: '📅 Weekly XP', value: weeklyXP.toLocaleString(), inline: true },
          { name: '📆 Monthly XP', value: monthlyXP.toLocaleString(), inline: true },
          { name: '💬 Total Messages', value: (activityStats.totalMessages || 0).toLocaleString(), inline: true },
          { name: '⏰ Peak Hour', value: `${activityStats.peakHour || 0}:00`, inline: true },
          { name: '📅 Peak Day', value: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][activityStats.peakDay || 0], inline: true }
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

    if (commandName === 'birthday') {
      const month = interaction.options.getInteger('month');
      const day = interaction.options.getInteger('day');
      const year = interaction.options.getInteger('year') || new Date().getFullYear();
      await setBirthday(interaction.user.id, month, day, year);
      log('success', `🎂 ${interaction.user.username} set birthday to ${month}/${day}/${year}`);
      interaction.reply({ content: `Your birthday set to ${month}/${day}/${year}! You'll get 2x XP on your special day! 🎉`, ephemeral: true });
    }

    if (commandName === 'setmilestone') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');
      await setLevelMilestone(level, role.id);
      log('success', `🏅 Level ${level} milestone: ${role.name} (by ${interaction.user.username})`);
      interaction.reply({ content: `Level ${level} will auto-assign ${role.name} role!`, ephemeral: true });
    }

    if (commandName === 'milestones') {
      const milestones = await getAllLevelMilestones();

      if (milestones.length === 0) {
        return interaction.reply({ content: 'No level milestones configured!', ephemeral: true });
      }

      let description = '';
      for (const m of milestones) {
        const role = interaction.guild.roles.cache.get(m.role_id);
        description += `Level ${m.level}: ${role?.name || 'Unknown'}\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🏅 Level Milestones')
        .setDescription(description)
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'event') {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'create') {
        const name = interaction.options.getString('name');
        const hours = interaction.options.getInteger('hours');
        const multiplier = interaction.options.getNumber('multiplier') || 2;

        const existingEvent = await getActiveEvent();
        if (existingEvent) {
          return interaction.reply({ content: `There is already an active event: **${existingEvent.name}** (${existingEvent.multiplier}x). End it first or wait for it to expire.`, ephemeral: true });
        }

        const event = await createEvent(name, hours, multiplier, interaction.user.username);
        await announceEvent(client, event, false);
        interaction.reply({ content: `🎊 Event **${name}** created with **${multiplier}x XP** multiplier for ${hours} hour(s)!`, ephemeral: true });
      }

      if (subcommand === 'end') {
        const event = await getActiveEvent();
        if (!event) {
          return interaction.reply({ content: 'No active event to end!', ephemeral: true });
        }

        await endEvent(event._id || event.id);
        await announceEvent(client, event, true);
        interaction.reply({ content: `Event **${event.name}** has been ended!`, ephemeral: true });
      }

      if (subcommand === 'list') {
        const events = await getAllEvents();

        if (events.length === 0) {
          return interaction.reply({ content: 'No events have been created yet!', ephemeral: true });
        }

        let description = '';
        for (const e of events.slice(0, 10)) {
          const isActive = e.active && e.end_time > Date.now();
          const startDate = new Date(e.start_time).toLocaleDateString();
          const endDate = new Date(e.end_time).toLocaleDateString();
          description += `${isActive ? '🟢' : '🔴'} **${e.name}**\n`;
          description += `   Multiplier: ${e.multiplier}x | Created by: ${e.created_by}\n`;
          description += `   ${startDate} - ${endDate}\n\n`;
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📋 Event History')
          .setDescription(description)
          .setTimestamp();

        interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'status') {
        const event = await getActiveEvent();

        if (!event) {
          return interaction.reply({ content: 'No active event right now!', ephemeral: true });
        }

        const remainingTime = event.end_time - Date.now();
        const hoursLeft = Math.max(0, Math.ceil(remainingTime / (1000 * 60 * 60)));
        const minutesLeft = Math.max(0, Math.ceil(remainingTime / (1000 * 60)));

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🎊 Active Event')
          .setDescription(`**${event.name}**`)
          .addFields(
            { name: '📈 Multiplier', value: `${event.multiplier}x XP`, inline: true },
            { name: '⏰ Time Left', value: hoursLeft > 0 ? `${hoursLeft} hour(s)` : `${minutesLeft} minute(s)`, inline: true },
            { name: '👤 Created By', value: event.created_by, inline: true }
          )
          .setTimestamp();

        interaction.reply({ embeds: [embed] });
      }
    }

    if (commandName === 'setmentor') {
      const mentor = interaction.options.getUser('mentor');
      const mentee = interaction.options.getUser('mentee');
      const bonus = interaction.options.getNumber('bonus') || 0.2;
      await setMentor(mentor.id, mentee.id, bonus);
      log('success', `👨‍🏫 ${mentor.username} is now mentor of ${mentee.username} (+${bonus}x bonus)`);
      interaction.reply({ content: `${mentor.username} is now mentor of ${mentee.username}! They get ${bonus}x bonus XP when helping.`, ephemeral: true });
    }

    if (commandName === 'removementor') {
      const mentor = interaction.options.getUser('mentor');
      const mentee = interaction.options.getUser('mentee');
      await removeMentor(mentor.id, mentee.id);
      interaction.reply({ content: `Removed mentor relationship between ${mentor.username} and ${mentee.username}!`, ephemeral: true });
    }

    if (commandName === 'mentors') {
      const mentees = await getMentees(interaction.user.id);

      if (mentees.length === 0) {
        return interaction.reply({ content: 'You are not a mentor for anyone!', ephemeral: true });
      }

      let description = '';
      for (const m of mentees) {
        const mentee = interaction.guild.members.cache.get(m.mentee_id);
        description += `${mentee?.user.username || 'Unknown'}: ${m.xp_bonus}x bonus\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('👨‍🏫 Your Mentees')
        .setDescription(description)
        .setTimestamp();

      interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'challenge') {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'list') {
        const challenges = await getActiveChallenges();

        if (challenges.length === 0) {
          return interaction.reply({ content: 'No active challenges!', ephemeral: true });
        }

        let description = '';
        for (const c of challenges) {
          description += `**${c.name}**\n${c.description}\nReward: ${c.xp_reward} XP\n\n`;
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🎯 Daily Challenges')
          .setDescription(description)
          .setTimestamp();

        interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'progress') {
        const userChallenges = await getUserChallenges(interaction.user.id);
        const challenges = await getActiveChallenges();

        let description = '';
        for (const c of challenges) {
          const uc = userChallenges.find(uc => uc.challenge_id === c.id);
          const progress = uc?.progress || 0;
          const completed = uc?.completed || false;
          const status = completed ? '✅' : `📝 ${progress}/${c.target}`;
          description += `**${c.name}**: ${status}\n`;
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📊 Your Challenge Progress')
          .setDescription(description || 'No challenges started yet!')
          .setTimestamp();

        interaction.reply({ embeds: [embed] });
      }
    }

    if (commandName === 'help') {
      const activeEvent = await getActiveEvent();
      let eventStatus = '';
      if (activeEvent) {
        const remainingTime = activeEvent.end_time - Date.now();
        const hoursLeft = Math.ceil(remainingTime / (1000 * 60 * 60));
        eventStatus = `\n\n🎊 **Active Event:** ${activeEvent.name} (${activeEvent.multiplier}x) - ${hoursLeft} hour(s) remaining`;
      }

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
• \`/compare <user1> <user2>\` - Compare XP
• \`/invites [user]\` - Check invites
• \`/checkvip [user]\` - Check VIP status
• \`/activity [user]\` - View activity stats
• \`/birthday <month> <day> [year]\` - Set birthday

**Configuration:**
• \`/setcooldown <seconds>\` - Set XP cooldown
• \`/setbanner <url>\` - Set banner image
• \`/setmessage <message>\` - Set level-up message
• \`/setchannel <channel>\` - Set announcement channel
• \`/setdailybonus <amount>\` - Set daily bonus XP
• \`/setmultiplier <x>\` - Set server multiplier
• \`/setxpcap <amount>\` - Set daily XP cap
• \`/setreactionxp <amount>\` - Set reaction XP
• \`/setwelcomebonus <amount> <days>\` - Set welcome bonus
• \`/setquiethours <start> <end> [multiplier]\` - Set quiet hours
• \`/dmnotifications <enable|disable>\` - DM level-ups

**Role Multipliers:**
• \`/setrolemultiplier <role> <x>\` - Add role multiplier
• \`/rolemultipliers\` - View all multipliers

**Level Milestones:**
• \`/setmilestone <level> <role>\` - Set milestone role
• \`/milestones\` - View all milestones

**Voice Channels:**
• \`/setvoicemultiplier <channel> <x>\` - Set VC multiplier
• \`/voicemultipliers\` - View all VC multipliers

**Rewards:**
• \`/setreward <level> <role>\` - Add role reward
• \`/rewards\` - View all rewards

**Events:**
• \`/event create <name> <hours> [multiplier]\` - Create XP event
• \`/event end\` - End active event
• \`/event list\` - View event history
• \`/event status\` - Check active event

**Challenges:**
• \`/challenge list\` - View daily challenges
• \`/challenge progress\` - Your progress

**Mentors:**
• \`/setmentor <mentor> <mentee> [bonus]\` - Set mentor
• \`/removementor <mentor> <mentee>\` - Remove mentor
• \`/mentors\` - View your mentees

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
• \`/quiethours\` - View quiet hours
• \`/help\` - Show this message
        ${eventStatus}`)
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
  client.user.setActivity('XP System | /help', { type: ActivityType.Watching });
});

const { DeployCommands } = await import('./utils/deployCommands.js');
await DeployCommands(process.env.CLIENT_ID, process.env.GUILD_ID, process.env.BOT_TOKEN);

log('info', '🚀 Deploying slash commands...');

client.login(process.env.BOT_TOKEN);
