# 🎮 Leveling-Bot

<div align="center">

![Discord](https://img.shields.io/badge/Discord-JS-5865F2?style=for-the-badge&logo=discord)
![Node](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge)

A powerful, feature-rich Discord leveling bot with XP tracking, role rewards, voice XP, streaks, VIP system, and XP events. Built with Discord.js with support for both SQLite and MongoDB.

![Leveling Bot Preview](https://i.imgur.com/8K3v5tW.png)

</div>

---

## 📋 Table of Contents

- [✨ Features](#features)
- [🚀 Quick Start](#quick-start)
- [📖 Commands](#commands)
- [🎯 XP System](#xp-system)
- [⚙️ Installation](#installation)
- [📚 Configuration Guide](#configuration-guide)
- [🎪 Event System](#event-system)
- [🗃️ Database Setup](#database-setup)
- [💻 Console Logging](#console-logging)
- [📁 Project Structure](#project-structure)
- [🤝 Contributing](#contributing)
- [📄 License](#license)

---

## ✨ Features

### Core XP System

| Feature | Description |
|---------|-------------|
| 💬 **Message XP** | Users earn 10-25 XP per message (random) |
| ⏱️ **Cooldown** | Configurable cooldown between XP gains (default: 60s) |
| 📈 **Leveling** | Automatic level-up system with increasing requirements |
| 🏆 **Role Rewards** | Auto-assign roles when users reach specific levels |
| 📊 **Leaderboards** | All-time, weekly, and monthly top 10 rankings |
| 🎤 **Voice XP** | Earn XP for time spent in voice channels (1 XP per 5 min) |

### Bonus XP System

| Bonus | Amount |
|-------|--------|
| 🖼️ Images | +5 XP |
| 🔗 Links | +3 XP |
| 🎁 Daily Bonus | +25 XP (first message of day, configurable) |
| 🔥 Streak (7 days) | +2 XP |
| 🔥 Streak (14 days) | +3 XP |
| 🔥 Streak (30 days) | +5 XP |
| 🎉 Weekend | 2x XP multiplier (Sat-Sun) |

### Advanced Features

| Feature | Description |
|---------|-------------|
| 👥 **Invite Tracking** | Track and reward server invites |
| 🚫 **Channel Blacklist** | Disable XP in specific channels |
| 📊 **Server Statistics** | View overall XP statistics |
| 📉 **XP Decay** | Inactive users lose 5% XP after 30 days |
| 📅 **Auto Resets** | Weekly (Monday) and monthly (1st) XP resets |

### Multipliers (Stackable!)

| Multiplier | Effect |
|------------|--------|
| 🌟 **VIP** | 1.5x XP multiplier |
| 🎭 **Role Multipliers** | Custom multipliers per role |
| 🌍 **Server Multiplier** | Server-wide XP boost |
| 🎪 **Events** | Custom event multipliers (2x, 3x, etc.) |

### Customization

- 🎨 Custom level-up announcement banners
- 💬 Customizable level-up messages with variables
- 📢 Configurable announcement channel
- 🔔 Optional DM notifications for level-ups
- ⚡ Configurable server-wide multipliers

---

## 🚀 Quick Start

```bash
# Clone and enter directory
git clone https://github.com/ramkrishna-js/Leveling-Bot.git
cd Leveling-Bot

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your bot credentials
nano .env

# Start the bot
npm start
```

---

## 📖 Commands

### 👤 User Commands

| Command | Description |
|---------|-------------|
| `/rank [user]` | View rank, XP progress, streak, and multipliers |
| `/level [user]` | Check current level and XP progress |
| `/leaderboard` | Top 10 users (all-time) |
| `/weekly` | Weekly top 10 leaderboard |
| `/monthly` | Monthly top 10 leaderboard |
| `/compare <user1> <user2>` | Compare XP between two users |
| `/invites [user]` | Check invite count |
| `/checkvip [user]` | Check VIP status |
| `/stats` | Server XP statistics |

### ⚙️ Configuration Commands

| Command | Description |
|---------|-------------|
| `/setcooldown <seconds>` | Set XP cooldown (0-300s) |
| `/setbanner <url>` | Set level-up banner image URL |
| `/setmessage <message>` | Set custom level-up message |
| `/setchannel <channel>` | Set announcement channel |
| `/setdailybonus <amount>` | Set daily bonus XP (0-100) |
| `/setmultiplier <x>` | Set server multiplier (0.1-10x) |
| `/dmnotifications <enable/disable>` | Toggle DM notifications |

### 🎭 Role Multiplier Commands

| Command | Description |
|---------|-------------|
| `/setrolemultiplier <role> <x>` | Set XP multiplier for a role |
| `/rolemultipliers` | View all role multipliers |

### 🎁 Reward Commands

| Command | Description |
|---------|-------------|
| `/setreward <level> <role>` | Assign role reward for level |
| `/rewards` | View all level rewards |

### 🎪 Event Commands

| Command | Description |
|---------|-------------|
| `/event create <name> <hours> [multiplier]` | Create XP event (default: 2x) |
| `/event end` | End active event |
| `/event list` | View event history |
| `/event status` | Check active event status |

### 🛡️ Moderation Commands

| Command | Description |
|---------|-------------|
| `/addinvite <user> [amount]` | Add invites (+5 XP per invite) |
| `/setvip <user> <days>` | Set VIP status (1.5x XP) |
| `/setstreak <user> <days>` | Set user streak |
| `/blacklist <channel> <add/remove>` | Toggle channel XP |
| `/blacklistchannels` | View blacklisted channels |
| `/resetuser <user>` | Reset user XP |
| `/resetall` | Reset all users |

### 📚 Utility Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/help` | Shows active event in help menu |

### 💬 Message Variables

Use these in custom level-up messages:

| Variable | Description |
|----------|-------------|
| `{user}` | Username |
| `{level}` | New level |
| `{mention}` | @mention user |

**Example:** `/setmessage {user} has reached level {level}! 🎉`

---

## 🎯 XP System

### Base XP Formula

```
Level Requirement = level × 100 × 1.1^(level-1)
```

### Level Progression

| Level | XP Required | Total XP |
|-------|-------------|----------|
| 1 → 2 | 100 | 100 |
| 5 → 6 | 500 | 1,500 |
| 10 → 11 | 1,000 | 5,500 |
| 25 → 26 | 2,500 | 32,500 |
| 50 → 51 | 5,000 | 127,500 |
| 100 → 101 | 13,780 | 1,000,000+ |

### Multiplier Stacking Example

```
Base XP: 20
├─ Weekend (2x): 40
├─ VIP (1.5x): 60
├─ Server (1.5x): 90
├─ Role (2x): 180
└─ Event (2x): 360 XP final!
```

---

## ⚙️ Installation

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn
- Discord bot token

### Setup Steps

1. **Clone Repository**
   ```bash
   git clone https://github.com/ramkrishna-js/Leveling-Bot.git
   cd Leveling-Bot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env`:
   ```env
   BOT_TOKEN=your_bot_token_here
   CLIENT_ID=your_bot_client_id_here
   GUILD_ID=your_server_id_here
   ```

4. **Create Discord Bot**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create application and bot
   - Copy token to `.env`
   - Enable **Message Content Intent**
   - Copy application ID to `.env`

5. **Invite Bot**
   - OAuth2 → URL Generator
   - Scopes: `applications.commands`, `bot`
   - Permissions: `Send Messages`, `Manage Roles`, `Manage Channels`
   - Use generated URL to invite

6. **Start Bot**
   ```bash
   npm start        # Production
   npm run dev      # Development (auto-restart)
   ```

---

## 📚 Configuration Guide

### Setting Role Rewards

```
/setreward 5 @Level 5 Role
/setreward 10 @Level 10 Role
/setreward 25 @Elite Member
```

### Setting Role Multipliers

```
/setrolemultiplier @VIP 2.0
/setrolemultiplier @Moderator 1.5
```

### Customizing Level-Up Message

```
/setmessage {user} reached level {level}! 🎉
```

### Setting Up Announcements

1. Create channel: `#level-up`
2. Run: `/setchannel #level-up`
3. Set banner: `/setbanner https://example.com/banner.png`
4. Enable DMs (optional): `/dmnotifications enable`

### Blacklisting Channels

```
/blacklist #spam add
/blacklist #bot-commands add
/blacklist #general remove
```

### Tracking Invites

```
/addinvite @John 5
# Gives +5 invites and +25 XP (5 XP per invite)
```

### VIP System

```
/setvip @John 30
# VIP gets 1.5x XP multiplier
```

---

## 🎪 Event System

### Create Events

**Basic Event (2x XP, 24 hours)**
```
/event create "Double XP Weekend" 24
```

**Custom Multiplier (3x XP, 48 hours)**
```
/event create "Triple XP" 48 3
```

**Quick Event (2x XP, 1 hour)**
```
/event create "Flash Event" 1
```

### Manage Events

| Command | Description |
|---------|-------------|
| `/event end` | End event early |
| `/event list` | View all past events |
| `/event status` | See current event & time left |

### Event Features

- 🎉 Stacks with all multipliers
- 📢 Auto announcements on start/end
- ⏱️ Time remaining in status
- 🔒 Only one active event at a time

---

## 🗃️ Database Setup

### SQLite (Default)

No setup required! Uses local `database.sqlite` file.

### MongoDB (Optional)

For production use:

1. **Install MongoDB**
   - [Local](https://www.mongodb.com/try/download/community)
   - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (cloud)

2. **Configure**
   ```env
   USE_MONGODB=true
   MONGODB_URI=mongodb://localhost:27017/leveling-bot
   ```

   Or Atlas:
   ```env
   USE_MONGODB=true
   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/leveling-bot
   ```

3. **Restart Bot**
   ```bash
   npm start
   ```

> ⚠️ **Note:** Data doesn't migrate automatically between SQLite and MongoDB.

---

## 💻 Console Logging

| Color | Prefix | Meaning |
|-------|--------|---------|
| Cyan | `[INFO]` | General info |
| Green | `[SUCCESS]` | Success |
| Yellow | `[WARN]` | Warnings |
| Red | `[ERROR]` | Errors |
| Magenta | `[XP]` | XP earnings |
| Yellow | `[LEVEL]` | Level ups |
| Blue | `[CMD]` | Command usage |

---

## 📁 Project Structure

```
Leveling-Bot/
├── src/
│   ├── index.js              # Main bot file (700+ lines)
│   └── utils/
│       └── deployCommands.js # Slash command deployment
├── .env.example              # Environment template
├── package.json              # Dependencies
├── LICENSE                   # MIT License
└── README.md                 # This file
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- [Discord.js](https://discord.js.org/) - Powerful Discord API library
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Fast SQLite3 wrapper
- [MongoDB Node Driver](https://mongodb.github.io/node-mongodb-native/) - MongoDB driver

---

<div align="center">

Made with ❤️ by [ramkrishna-js](https://github.com/ramkrishna-js)

</div>
