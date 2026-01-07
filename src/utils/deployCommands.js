import { REST, Routes } from 'discord.js';

const commands = [
  {
    name: 'rank',
    description: 'Check your or another user\'s rank',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to check',
        required: false
      }
    ]
  },
  {
    name: 'leaderboard',
    description: 'View the top 10 users on the leaderboard'
  },
  {
    name: 'weekly',
    description: 'View the weekly leaderboard'
  },
  {
    name: 'monthly',
    description: 'View the monthly leaderboard'
  },
  {
    name: 'level',
    description: 'Check your or another user\'s level',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'The user to check',
        required: false
      }
    ]
  },
  {
    name: 'compare',
    description: 'Compare XP with another user',
    options: [
      {
        name: 'user1',
        type: 6,
        description: 'First user',
        required: false
      },
      {
        name: 'user2',
        type: 6,
        description: 'Second user',
        required: true
      }
    ]
  },
  {
    name: 'setcooldown',
    description: 'Set the XP gain cooldown (in seconds)',
    options: [
      {
        name: 'seconds',
        type: 4,
        description: 'Cooldown in seconds',
        required: true,
        min_value: 0,
        max_value: 300
      }
    ]
  },
  {
    name: 'setbanner',
    description: 'Set the level-up announcement banner image',
    options: [
      {
        name: 'url',
        type: 3,
        description: 'Image URL for the banner',
        required: true
      }
    ]
  },
  {
    name: 'setreward',
    description: 'Set a role reward for a specific level',
    options: [
      {
        name: 'level',
        type: 4,
        description: 'Level requirement',
        required: true,
        min_value: 1
      },
      {
        name: 'role',
        type: 8,
        description: 'Role to give',
        required: true
      }
    ]
  },
  {
    name: 'rewards',
    description: 'View all level rewards'
  },
  {
    name: 'setmessage',
    description: 'Set the level-up announcement message',
    options: [
      {
        name: 'message',
        type: 3,
        description: 'Message (use {user}, {level}, {mention})',
        required: true
      }
    ]
  },
  {
    name: 'setchannel',
    description: 'Set the level-up announcement channel',
    options: [
      {
        name: 'channel',
        type: 7,
        description: 'Channel for announcements',
        required: true
      }
    ]
  },
  {
    name: 'setdailybonus',
    description: 'Set the daily bonus XP amount',
    options: [
      {
        name: 'amount',
        type: 4,
        description: 'Daily bonus XP amount',
        required: true,
        min_value: 0,
        max_value: 100
      }
    ]
  },
  {
    name: 'setmultiplier',
    description: 'Set the server-wide XP multiplier',
    options: [
      {
        name: 'multiplier',
        type: 10,
        description: 'XP multiplier (e.g., 1.5 for 1.5x)',
        required: true,
        min_value: 0.1,
        max_value: 10
      }
    ]
  },
  {
    name: 'setrolemultiplier',
    description: 'Set XP multiplier for a role',
    options: [
      {
        name: 'role',
        type: 8,
        description: 'Role to set multiplier for',
        required: true
      },
      {
        name: 'multiplier',
        type: 10,
        description: 'XP multiplier',
        required: true,
        min_value: 0.1,
        max_value: 10
      }
    ]
  },
  {
    name: 'rolemultipliers',
    description: 'View all role multipliers'
  },
  {
    name: 'addinvite',
    description: 'Add invites to a user (for tracking)',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'User to add invites to',
        required: true
      },
      {
        name: 'amount',
        type: 4,
        description: 'Number of invites',
        required: false,
        min_value: 1,
        max_value: 100
      }
    ]
  },
  {
    name: 'invites',
    description: 'Check a user\'s invite count',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'User to check',
        required: false
      }
    ]
  },
  {
    name: 'blacklist',
    description: 'Add or remove a channel from XP blacklist',
    options: [
      {
        name: 'channel',
        type: 7,
        description: 'Channel to blacklist',
        required: true
      },
      {
        name: 'action',
        type: 3,
        description: 'Add or remove from blacklist',
        required: true,
        choices: [
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' }
        ]
      }
    ]
  },
  {
    name: 'blacklistchannels',
    description: 'View all blacklisted channels'
  },
  {
    name: 'resetuser',
    description: 'Reset XP and level for a user',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'User to reset',
        required: true
      }
    ]
  },
  {
    name: 'resetall',
    description: 'Reset all users XP and levels'
  },
  {
    name: 'stats',
    description: 'View server XP statistics'
  },
  {
    name: 'setvip',
    description: 'Set VIP status for a user',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'User to set as VIP',
        required: true
      },
      {
        name: 'days',
        type: 4,
        description: 'Number of days',
        required: true,
        min_value: 1,
        max_value: 365
      }
    ]
  },
  {
    name: 'checkvip',
    description: 'Check a user\'s VIP status',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'User to check',
        required: false
      }
    ]
  },
  {
    name: 'setstreak',
    description: 'Set streak for a user',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'User to set streak for',
        required: true
      },
      {
        name: 'days',
        type: 4,
        description: 'Streak days',
        required: true,
        min_value: 0,
        max_value: 365
      }
    ]
  },
  {
    name: 'dmnotifications',
    description: 'Enable or disable DM level-up notifications',
    options: [
      {
        name: 'action',
        type: 3,
        description: 'Enable or disable',
        required: true,
        choices: [
          { name: 'Enable', value: 'enable' },
          { name: 'Disable', value: 'disable' }
        ]
      }
    ]
  },
  {
    name: 'help',
    description: 'Show all available commands'
  }
];

export async function DeployCommands(clientId, guildId, token) {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('⚡ Deploying commands...');
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('✅ Commands deployed successfully!');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}
