# 🎮 Leveling-Bot

<div align="center">

![Discord](https://img.shields.io/badge/Discord-JS-5865F2?style=for-the-badge&logo=discord)
![Node](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-2.0.0-blue?style=for-the-badge)

A powerful, feature-rich Discord leveling bot with XP tracking, role rewards, voice XP, streaks, VIP system, XP events, challenges, mentor system, and much more. Built with Discord.js with support for both SQLite and MongoDB.

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
- [🎯 Challenges System](#challenges-system)
- [👨‍🏫 Mentor System](#mentor-system)
- [🎂 Birthday System](#birthday-system)
- [🏅 Level Milestones](#level-milestones)
- [😴 Quiet Hours](#quiet-hours)
- [🗓️ Activity Tracking](#activity-tracking)
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
| 📝 Long Messages | 1.2x-2x XP based on length |
| 🎁 Daily Bonus | +25 XP (first message of day, configurable) |
| 🚀 First in Channel | +5 XP (first message in each channel per day) |
| ⭐ Reactions | +1 XP (when others react to your messages) |
| 🔥 Streak (7 days) | +2 XP |
| 🔥 Streak (14 days) | +3 XP |
| 🔥 Streak (30 days) | +5 XP |
| 🎉 Weekend | 2x XP multiplier (Sat-Sun) |

### Advanced Features

| Feature | Description |
|---------|-------------|
| 👥 **Invite Tracking** | Track and reward server invites |
| 🚫 **Channel Blacklist** | Disable XP in specific channels |
| 🔥 **Activity Streaks** | Consecutive days with any XP gain |
| 📊 **Server Statistics** | View overall XP statistics |
| 📉 **XP Decay** | Inactive users lose 5% XP after 30 days |
| 🎯 **Daily XP Cap** | Limit maximum XP per day per user |
| 📅 **Auto Resets** | Weekly (Monday) and monthly (1st) XP resets |

### Multipliers (All Stack!)

| Multiplier | Effect |
|------------|--------|
| 🌟 **VIP** | 1.5x XP multiplier |
| 🎂 **Birthday** | 2x XP on your birthday |
| 👋 **Welcome Bonus** | 1.5x XP for new members (first 7 days) |
| 🎭 **Role Multipliers** | Custom multipliers per role |
| 🌍 **Server Multiplier** | Server-wide XP boost |
| 🎪 **Events** | Custom event multipliers (2x, 3x, etc.) |
| 👨‍🏫 **Mentor Bonus** | Extra XP when helping new users |
| 😴 **Quiet Hours** | Reduced XP during set hours |

### Level Milestones

- **Auto-Role Assignment** - Assign roles at specific levels (Level 5 = "Newbie", Level 25 = "Regular", Level 50 = "Veteran")
- **Custom Milestones** - Set any level/role combination
- **Stack with Rewards** - Milestones work alongside regular level rewards

### Challenges System

- **Daily Challenges** - Complete quests for bonus XP
- **Progress Tracking** - See your challenge progress
- **Rewards** - Earn XP for completing challenges
- **Multiple Types** - Message count, voice time, reactions, etc.

### Mentor System

- **Mentor-Mentee Pairs** - Link experienced users with new members
- **Bonus XP** - Mentees get bonus XP for helping
- **Configurable** - Set custom bonus amounts

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
| `/activity [user]` | View activity stats (peak hours, days) |
| `/stats` | Server XP statistics |
| `/birthday <month> <day> [year]` | Set your birthday for 2x XP |

### 🎯 Challenge Commands

| Command | Description |
|---------|-------------|
| `/challenge list` | View available daily challenges |
| `/challenge progress` | See your challenge progress |

### 👨‍🏫 Mentor Commands

| Command | Description |
|---------|-------------|
| `/setmentor <mentor> <mentee> [bonus]` | Set mentor relationship |
| `/removementor <mentor> <mentee>` | Remove mentor relationship |
| `/mentors` | View your mentees |

### 🏅 Milestone Commands

| Command | Description |
|---------|-------------|
| `/setmilestone <level> <role>` | Set auto-role at level |
| `/milestones` | View all milestones |

### ⚙️ Configuration Commands

| Command | Description |
|---------|-------------|
| `/setcooldown <seconds>` | Set XP cooldown (0-300s) |
| `/setbanner <url>` | Set level-up banner image URL |
| `/setmessage <message>` | Set custom level-up message |
| `/setchannel <channel>` | Set announcement channel |
| `/setdailybonus <amount>` | Set daily bonus XP (0-100) |
| `/setmultiplier <x>` | Set server multiplier (0.1-10x) |
| `/setxpcap <amount>` | Set daily XP cap (0 = no cap) |
| `/setreactionxp <amount>` | Set reaction XP (0 = disabled) |
| `/setwelcomebonus <amount> <days>` | Set welcome bonus |
| `/setquiethours <start> <end> [multiplier]` | Set quiet hours |
| `/dmnotifications <enable/disable>` | Toggle DM notifications |

### 🎤 Voice Commands

| Command | Description |
|---------|-------------|
| `/setvoicemultiplier <channel> <x>` | Set VC XP multiplier |
| `/voicemultipliers` | View all VC multipliers |

### 🎭 Role Multiplier Commands

| Command | Description |
|---------|-------------|
| `/setrolemultiplier <role> <x>` | Set XP multiplier for role |
| `/rolemultipliers` | View all role multipliers |

### 🎁 Reward Commands

| Command | Description |
|---------|-------------|
| `/setreward <level> <role>` | Assign role reward for level |
| `/rewards` | View all level rewards |

### 🎪 Event Commands

| Command | Description |
|---------|-------------|
| `/event create <name> <hours> [multiplier]` | Create XP event |
| `/event end` | End active event |
| `/event list` | View event history |
| `/event status` | Check active event |

### 🚫 Blacklist Commands

| Command | Description |
|---------|-------------|
| `/blacklist <channel> <add/remove>` | Toggle channel XP |
| `/blacklistchannels` | View blacklisted channels |

### 🛡️ Moderation Commands

| Command | Description |
|---------|-------------|
| `/addinvite <user> [amount]` | Add invites (+5 XP per invite) |
| `/setvip <user> <days>` | Set VIP status (1.5x XP) |
| `/setstreak <user> <days>` | Set user streak |
| `/resetuser <user>` | Reset user XP |
| `/resetall` | Reset all users |

### 😴 Utility Commands

| Command | Description |
|---------|-------------|
| `/quiethours` | View quiet hours settings |
| `/help` | Show all commands |

### 💬 Message Variables

Use these in custom level-up messages:

| Variable | Description |
|----------|-------------|
| `{user}` | Username |
| `{level}` | New level |
| `{mention}` | @mention user |

**Example:** `/setmessage {user} reached level {level}! 🎉`

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

### Message Length Bonus

| Message Length | Multiplier |
|---------------|------------|
| 25+ chars | 1.2x XP |
| 50+ chars | 1.5x XP |
| 100+ chars | 2x XP |

### Multiplier Stacking Example

```
Base XP: 20
├─ Weekend (2x): 40
├─ VIP (1.5x): 60
├─ Server (1.5x): 90
├─ Role (2x): 180
├─ Long message (1.5x): 270
├─ First in channel (5 XP): 275
└─ Event (2x): 550 XP final!
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

---

## 🎯 Challenges System

### Available Challenges

- **Message Goal** - Send X messages
- **Voice Time** - Spend X minutes in VC
- **Reaction Goal** - Get X reactions

### Using Challenges

```
/challenge list       # View available challenges
/challenge progress   # See your progress
```

---

## 👨‍🏫 Mentor System

### Set Up Mentors

```
/setmentor @Veteran @Newbie 0.3
```

Mentee gets 30% bonus XP when the mentor is active!

### Benefits

- Encourage new member engagement
- Reward helpful community members
- Build community relationships

---

## 🎂 Birthday System

### Set Your Birthday

```
/birthday 6 15 2000
```

**On your birthday:**
- 2x XP all day
- Special celebration

---

## 🏅 Level Milestones

### Create Milestones

```
/setmilestone 5 @Newbie
/setmilestone 25 @Regular
/setmilestone 50 @Veteran
/setmilestone 100 @Legend
```

Users automatically receive roles when they reach these levels!

---

## 😴 Quiet Hours

### Set Quiet Hours

Reduce XP during specific hours (e.g., night time):

```
/setquiethours 0 8 0.5
```

**Effect:** 0:00 - 8:00 with 0.5x XP multiplier

---

## 🗓️ Activity Tracking

### View Activity Stats

```
/activity @user
```

**Shows:**
- Peak activity hours
- Most active day
- Total messages and XP

### Server Stats

```
/stats
```

**Shows:**
- Total users
- Total XP earned
- Peak activity times
- And more!

---

## ⚙️ Installation

### Prerequisites

- Node.js 18.0+
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
| Cyan | `[EVENT]` | Event notifications |

---

## 📁 Project Structure

```
Leveling-Bot/
├── src/
│   ├── index.js              # Main bot file (1200+ lines)
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
