const { REST, Routes } = require('discord.js');
const config = require('../config.json');
const fs = require('fs');
const path = require('path');
const clientId = config.discordClientIDs.system;
const guildId = config.core.discordGuildID;
const token = config.discordTokens.system;

const globalCommands = [];
const guildCommands = [];

// Load commands from a specific directory (only .js files with 'data' property)
function loadCommands(foldersPath, commandArray) {
    if (!fs.existsSync(foldersPath)) {
        return; // Skip if directory doesn't exist
    }

    const items = fs.readdirSync(foldersPath);

    for (const item of items) {
        const itemPath = path.join(foldersPath, item);

        // Check if Directory
        if (fs.statSync(itemPath).isDirectory()) {
            // Recursively load commands from subfolder
            loadCommands(itemPath, commandArray);
        } else if (item.endsWith('.js')) {
            // It's a .js file - try to load it as a command
            try {
                const command = require(itemPath);
                if ('data' in command) {
                    commandArray.push(command.data.toJSON());
                    console.log(`  ✓ Loaded: ${command.data.name}`);
                } else if ('name' in command) {
                    console.log(`  - Skipped (prefix only): ${command.name}`);
                } else {
                    console.log(`  - Skipped (not a command): ${item}`);
                }
            } catch (error) {
                console.log(`  ✗ Error loading ${item}: ${error.message}`);
            }
        }
    }
}

// FIXED: Only load from slash command directories
// Load from discord_commands/global/slash/ (not the entire global folder)
const globalSlashPath = path.join(__dirname, 'discord_commands', 'global', 'slash');
if (fs.existsSync(globalSlashPath)) {
    console.log('Loading global commands from discord_commands/global/slash/');
    loadCommands(globalSlashPath, globalCommands);
}

// Load from discord_commands/core/ (guild-specific commands)
const guildPath = path.join(__dirname, 'discord_commands', 'core');
if (fs.existsSync(guildPath)) {
    console.log('Loading guild commands from discord_commands/core/');
    loadCommands(guildPath, guildCommands);
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// Deploy commands
(async () => {
    try {
        console.log(`
Started refreshing ${globalCommands.length} global and ${guildCommands.length} guild application (/) commands.`);

        // Clear existing commands
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });

        // Deploy global commands
        if (globalCommands.length > 0) {
            const globalData = await rest.put(Routes.applicationCommands(clientId), { body: globalCommands });
            console.log(`✓ Successfully reloaded ${globalData.length} global application (/) commands.`);
        }

        // Deploy guild-specific commands
        if (guildCommands.length > 0) {
            const guildData = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: guildCommands });
            console.log(`✓ Successfully reloaded ${guildData.length} guild application (/) commands.`);
        }

        console.log('All Chameleon commands deployed! 🎡');
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();