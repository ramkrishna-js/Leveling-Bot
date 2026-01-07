import { REST, Routes, EmbedBuilder } from 'discord.js';
import { config } from 'dotenv';

config();

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
  }
];

export async function DeployCommands(clientId, guildId, token) {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Deploying commands...');
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('Commands deployed successfully!');
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
}
