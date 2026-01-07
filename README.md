# Leveling-Bot

A powerful and feature-rich Discord leveling bot with XP tracking, role rewards, voice XP, streaks, invite tracking, VIP system, and more. Built with Discord.js with support for both SQLite and MongoDB.

![Discord Leveling Bot](https://i.imgur.com/8K3v5tW.png)

## Features

### Core Features
- **XP System**: Users earn XP for each message (10-25 base XP)
- **Cooldown**: Configurable cooldown between XP gains (default: 60 seconds)
- **Leveling**: Automatic level-up system with increasing XP requirements
- **Role Rewards**: Assign roles automatically when users reach specific levels
- **Leaderboard**: Real-time top 10 leaderboard with rankings
- **Weekly/Monthly Leaderboards**: Track XP over different time periods

### Bonus XP System
- **Images**: +5 bonus XP for sharing images
- **Links**: +3 bonus XP for sharing links
- **Daily Bonus**: Extra XP for first message of the day (configurable)
- **Streak Bonus**: Earn extra XP for daily activity streaks (up to +5 XP at 30 days)
- **Weekend Multiplier**: 2x XP multiplier on weekends (Saturday & Sunday)
- **Voice XP**: Earn XP for time spent in voice channels (1 XP per 5 minutes)

### Advanced Features
- **Invite Tracking**: Track and reward server invites
- **Channel Blacklist**: Disable XP gain in specific channels
- **Streak System**: Daily activity tracking with bonus rewards
- **Server Statistics**: View overall XP statistics
- **XP Decay**: Inactive users lose 5% XP after 30 days
- **Daily/Weekly/Monthly Resets**: Automatic tracking resets

### VIP System
- **VIP Membership**: Grant users 1.5x XP multiplier
- **Configurable Duration**: Set VIP for any number of days
- **Automatic Expiry**: VIP expires automatically

### Role Multipliers
- **Custom Multipliers**: Set different XP multipliers for different roles
- **Stackable**: Multipliers stack multiplicatively
- **VIP Bonus**: VIP users get an additional 1.5x multiplier

### Database Support
- **SQLite**: Lightweight file-based database (default)
- **MongoDB**: Full MongoDB support for production (optional)

### Customization
- **Custom Banner**: Set your own level-up announcement banner image
- **Custom Messages**: Personalize level-up messages with variables
- **Announcement Channel**: Choose where level-ups are announced
- **DM Notifications**: Send level-up notifications via DM (disabled by default)
- **Server Multiplier**: Set a server-wide XP multiplier
- **Daily Bonus**: Configure the daily first-message bonus

## Commands

### User Commands
| Command | Description |
|---------|-------------|
| `/rank [user]` | View your or another user's rank, XP progress, and streak |
| `/leaderboard` | Display the top 10 users on the server (all-time) |
| `/weekly` | Display the weekly top 10 leaderboard |
| `/monthly` | Display the monthly top 10 leaderboard |
| `/level [user]` | Check your or another user's current level |
| `/compare <user1> <user2>` | Compare XP between two users |
| `/invites [user]` | Check a user's invite count |
| `/checkvip [user]` | Check a user's VIP status |
| `/stats` | View server XP statistics |

### Configuration Commands
| Command | Description |
|---------|-------------|
| `/setcooldown <seconds>` | Set XP gain cooldown (0-300 seconds) |
| `/setbanner <url>` | Set custom banner image URL for embeds |
| `/setmessage <message>` | Customize level-up announcement message |
| `/setchannel <channel>` | Set channel for level-up announcements |
| `/setdailybonus <amount>` | Set daily bonus XP (0-100) |
| `/setmultiplier <x>` | Set server-wide XP multiplier (0.1-10x) |
| `/dmnotifications <enable\|disable>` | Enable/disable DM level-up notifications |

### Role Multiplier Commands
| Command | Description |
|---------|-------------|
| `/setrolemultiplier <role> <x>` | Set XP multiplier for a role |
| `/rolemultipliers` | View all configured role multipliers |

### Reward Commands
| Command | Description |
|---------|-------------|
| `/setreward <level> <role>` | Assign a role reward for reaching a level |
| `/rewards` | View all configured level rewards |

### Moderation Commands
| Command | Description |
|---------|-------------|
| `/addinvite <user> [amount]` | Add invites to a user (+5 XP per invite) |
| `/setvip <user> <days>` | Set VIP status for a user |
| `/setstreak <user> <days>` | Set streak for a user |
| `/blacklist <channel> <add\|remove>` | Toggle XP gain in a channel |
| `/blacklistchannels` | View all blacklisted channels |
| `/resetuser <user>` | Reset XP and level for a user |
| `/resetall` | Reset all users' XP and levels |

### Utility Commands
| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |

### Message Variables
Use these variables in custom level-up messages:
- `{user}` - Username of the person who leveled up
- `{level}` - The new level achieved
- `{mention}` - Mention the user (@username)

## XP Formula

### Base XP
- **Per Message**: 10-25 (random)
- **Level Requirement**: `level * 100 * 1.1^(level-1)`

### Bonuses
| Bonus Type | Amount |
|------------|--------|
| Images | +5 XP |
| Links | +3 XP |
| Daily Bonus (first message) | Configurable (default: 25 XP) |
| Streak (7 days) | +2 XP |
| Streak (14 days) | +3 XP |
| Streak (30 days) | +5 XP |
| Weekend Multiplier | 2x |
| Server Multiplier | Configurable |
| Role Multipliers | Configurable per role |
| VIP Multiplier | 1.5x |

### Level Progression
| Level | XP Required | Total XP |
|-------|-------------|----------|
| 1 → 2 | 100 | 100 |
| 5 → 6 | 500 | 1,500 |
| 10 → 11 | 1,000 | 5,500 |
| 25 → 26 | 2,500 | 32,500 |
| 50 → 51 | 5,000 | 127,500 |
| 100 → 101 | 13,780 | 1,000,000+ |

## Installation

### Prerequisites
- Node.js 18.0 or higher
- npm or yarn
- A Discord bot token

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ramkrishna-js/Leveling-Bot.git
   cd Leveling-Bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your credentials:
   ```env
   BOT_TOKEN=your_bot_token_here
   CLIENT_ID=your_bot_client_id_here
   GUILD_ID=your_server_id_here
   
   # Database Configuration (optional)
   # Set USE_MONGODB to "true" to use MongoDB
   USE_MONGODB=false
   MONGODB_URI=mongodb://localhost:27017/leveling-bot
   ```

4. **Create a Discord Bot**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to the "Bot" section and create a bot
   - Copy the bot token to your `.env` file
   - Copy the application ID (CLIENT_ID) to your `.env` file
   - Enable "Message Content Intent" in the Bot section

5. **Invite the bot to your server**
   - Go to OAuth2 > URL Generator in Developer Portal
   - Select scope: `applications.commands` and `bot`
   - Grant permissions: `Send Messages`, `Manage Roles`, `Manage Channels`
   - Use the generated URL to invite the bot

6. **Start the bot**
   ```bash
   npm start
   ```

7. **For development with auto-restart**
   ```bash
   npm run dev
   ```

## MongoDB Setup (Optional)

The bot supports MongoDB for production environments. To use MongoDB:

1. **Install MongoDB**
   - [Download MongoDB](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

2. **Configure the bot**
   Edit `.env`:
   ```env
   USE_MONGODB=true
   MONGODB_URI=mongodb://localhost:27017/leveling-bot
   ```
   
   Or use MongoDB Atlas:
   ```env
   USE_MONGODB=true
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/leveling-bot?retryWrites=true&w=majority
   ```

3. **Restart the bot**
   ```bash
   npm start
   ```

**Note:** When switching from SQLite to MongoDB, existing data will not be automatically migrated. You would need to export and import data manually.

## Configuration Guide

### Setting Up Role Rewards
Roles are automatically assigned when users reach specific levels.

Example:
```
/setreward 5 @Level 5 Role
/setreward 10 @Level 10 Role
/setreward 25 @Elite Member
/setreward 50 @Veteran
/setreward 100 @Legend
```

### Setting Up Role Multipliers
Give certain roles bonus XP:

```
/setrolemultiplier @VIP 2.0
/setrolemultiplier @Moderator 1.5
```

Multipliers stack: VIP with 2.0x + Server 1.5x = 3.0x total

### Customizing Level-Up Messages
Use the `/setmessage` command to customize announcements:

```
/setmessage {user} has reached level {level}! 🎉
```

Output example: `John has reached level 5! 🎉`

### Setting Up Announcements
1. Create a dedicated channel for level-ups (e.g., #level-up)
2. Use `/setchannel #level-up` to set it as the announcement channel
3. Use `/setbanner <image_url>` to set a custom banner
4. Use `/dmnotifications enable` to send DMs instead (disabled by default)

### Blacklisting Channels
Prevent XP gain in certain channels (like #spam or #bot-commands):

```
/blacklist #spam add
/blacklist #general remove
```

### Tracking Invites
Reward users for inviting friends:

```
/addinvite @John 5
```

This gives +5 invites and +25 XP (5 XP per invite).

### VIP System
Grant VIP status for bonus XP:

```
/setvip @John 30
```

VIP users get 1.5x XP multiplier.

## Console Logging

The bot features colorful console logging for easy monitoring:

| Color | Prefix | Meaning |
|-------|--------|---------|
| Cyan | `[INFO]` | General information |
| Green | `[SUCCESS]` | Successful operations |
| Yellow | `[WARN]` | Warnings |
| Red | `[ERROR]` | Errors |
| Magenta | `[XP]` | XP earnings |
| Yellow | `[LEVEL]` | Level ups |
| Blue | `[CMD]` | Command usage |

## Project Structure

```
Leveling-Bot/
├── src/
│   ├── index.js              # Main bot file
│   └── utils/
│       └── deployCommands.js # Slash command deployment
├── .env.example              # Environment template
├── package.json              # Project dependencies
├── LICENSE                   # MIT License
└── README.md                 # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions:
- Open an issue on GitHub
- Check existing documentation

## Acknowledgments

- [Discord.js](https://discord.js.org/) - Powerful Discord API library
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Fast SQLite3 wrapper
- [MongoDB Node Driver](https://mongodb.github.io/node-mongodb-native/) - MongoDB driver

---

Made with ❤️ by [ramkrishna-js](https://github.com/ramkrishna-js)
