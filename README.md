# Leveling-Bot

A powerful and feature-rich Discord leveling bot with XP tracking, role rewards, voice XP, streaks, invite tracking, and more. Built with Discord.js and SQLite for fast, reliable performance.

![Discord Leveling Bot](https://i.imgur.com/8K3v5tW.png)

## Features

### Core Features
- **XP System**: Users earn XP for each message (10-25 base XP)
- **Cooldown**: Configurable cooldown between XP gains (default: 60 seconds)
- **Leveling**: Automatic level-up system with increasing XP requirements
- **Role Rewards**: Assign roles automatically when users reach specific levels
- **Leaderboard**: Real-time top 10 leaderboard with rankings

### Bonus XP System
- **Images**: +5 bonus XP for sharing images
- **Links**: +3 bonus XP for sharing links
- **Streak Bonus**: Earn extra XP for daily activity streaks (up to +5 XP at 30 days)
- **Weekend Multiplier**: 2x XP multiplier on weekends (Saturday & Sunday)
- **Voice XP**: Earn XP for time spent in voice channels (1 XP per 5 minutes)

### Advanced Features
- **Invite Tracking**: Track and reward server invites
- **Channel Blacklist**: Disable XP gain in specific channels
- **Streak System**: Daily activity tracking with bonus rewards
- **Server Statistics**: View overall XP statistics

### Customization
- **Custom Banner**: Set your own level-up announcement banner image
- **Custom Messages**: Personalize level-up messages with variables
- **Announcement Channel**: Choose where level-ups are announced
- **Cooldown Settings**: Adjust XP gain cooldown to your preference

## Commands

### User Commands
| Command | Description |
|---------|-------------|
| `/rank [user]` | View your or another user's rank, XP progress, and streak |
| `/leaderboard` | Display the top 10 users on the server |
| `/level [user]` | Check your or another user's current level |
| `/invites [user]` | Check a user's invite count |
| `/stats` | View server XP statistics |

### Configuration Commands
| Command | Description |
|---------|-------------|
| `/setcooldown <seconds>` | Set XP gain cooldown (0-300 seconds) |
| `/setbanner <url>` | Set custom banner image URL for embeds |
| `/setmessage <message>` | Customize level-up announcement message |
| `/setchannel <channel>` | Set channel for level-up announcements |

### Reward Commands
| Command | Description |
|---------|-------------|
| `/setreward <level> <role>` | Assign a role reward for reaching a level |
| `/rewards` | View all configured level rewards |

### Moderation Commands
| Command | Description |
|---------|-------------|
| `/addinvite <user> [amount]` | Add invites to a user (+5 XP per invite) |
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

## Installation

### Prerequisites
- Node.js 18.0 or higher
- npm or yarn
- A Discord bot token

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ramkrishnaxyz/Leveling-Bot.git
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

## XP Formula

- **Base XP per message**: 10-25 (random)
- **Level requirement**: `level * 100 XP`
- **Bonus XP**: +5 for images, +3 for links
- **Streak Bonus**: +1 to +5 XP based on streak length
- **Weekend Multiplier**: 2x on Saturdays and Sundays
- **Voice XP**: 1 XP per 5 minutes in voice channels

### Example Progression
| Level | XP Required | Total XP |
|-------|-------------|----------|
| 1 → 2 | 100 | 100 |
| 5 → 6 | 500 | 1,500 |
| 10 → 11 | 1,000 | 5,500 |
| 25 → 26 | 2,500 | 32,500 |
| 50 → 51 | 5,000 | 127,500 |

### Streak Bonuses
| Streak Length | Bonus XP |
|---------------|----------|
| 7 days | +2 XP |
| 14 days | +3 XP |
| 30 days | +5 XP |

## Project Structure

```
Leveling-Bot/
├── src/
│   ├── index.js              # Main bot file
│   ├── utils/
│   │   └── deployCommands.js # Slash command deployment
│   └── database/
│       └── schema.sql        # Database schema (embedded in index.js)
├── .env.example              # Environment template
├── package.json              # Project dependencies
├── LICENSE                   # MIT License
└── README.md                 # This file
```

## Database Schema

The bot uses SQLite with the following tables:

### users
| Column | Type | Description |
|--------|------|-------------|
| user_id | TEXT | Discord user ID (primary key) |
| username | TEXT | Discord username |
| xp | INTEGER | Current XP amount |
| level | INTEGER | Current level |
| last_message_time | INTEGER | Timestamp of last message |
| voice_time | INTEGER | Minutes spent in voice |
| streak | INTEGER | Current streak days |
| last_active_date | TEXT | Last active date |
| invites | INTEGER | Total invites |

### config
| Column | Type | Description |
|--------|------|-------------|
| key | TEXT | Configuration key (primary key) |
| value | TEXT | Configuration value (JSON) |

### rewards
| Column | Type | Description |
|--------|------|-------------|
| level | INTEGER | Required level (primary key) |
| role_id | TEXT | Discord role ID |

### invites
| Column | Type | Description |
|--------|------|-------------|
| user_id | TEXT | Discord user ID (primary key) |
| invites | INTEGER | Invite count |
| inviter_id | TEXT | Who invited them |

### blacklisted_channels
| Column | Type | Description |
|--------|------|-------------|
| channel_id | TEXT | Discord channel ID (primary key) |

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

---

Made with ❤️ by [rmkrishnaxyz](https://github.com/ramkrishnaxyz)
