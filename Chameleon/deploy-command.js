const { REST, Routes } = require('discord.js');
const config = require('../config.json');
const fs = require('fs');
const path = require('path');
const clientId = config.discordClientIDs.system;
const guildId = config.core.discordGuildID;
const token = config.discordTokens.system;

const globalCommands = [];
const guildCommands = [];

// Grab all the command folders and files from commands directory

function loadCommands(foldersPath, commandArray) {
    const items = fs.readdirSync(foldersPath);

    for (const item of items) {
        const itemPath = path.join(foldersPath, item);

        // Check if Directory
        if (fs.statSync(itemPath).isDirectory()) {
            // Recursively load commands from subfolder
            loadCommands(itemPath, commandArray);
        } else if (item.endsWith('.js')) {
            // It's a .js file - load command
            const command = require(itemPath);
            if ('data' in command) {
                commandArray.push(command.data.toJSON());
            } else if ('name' in command) {
                console.log(`The command at ${itemPath} is a prefix command`)
            }
            else {
                console.log(`[🔴WARNING] The command at ${itemPath} is missing a required "data" or "name" property`);
            }
        }
    }
}

const globalPath = path.join(__dirname, 'commands', 'global');
if (fs.existsSync(globalPath)) {
    loadCommands(globalPath, globalCommands);
}

// Load guild commands
const guildPath = path.join(__dirname, 'commands', 'core');
if (fs.existsSync(guildPath)) {
    loadCommands(guildPath, guildCommands);
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

//Deploy commands
(async () => {
    try {
        console.log(`Started refreshing ${globalCommands.length} global and ${guildCommands.length} guild application (/) commands.`);
        await rest.put(Routes.applicationCommands(clientId), { body: [] }); // Nuke/Delete all global Commands
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] }); // Nuke/Delete all guild Commands

        // Deploy global commands
        if (globalCommands.length > 0) {
            const globalData = await rest.put(Routes.applicationCommands(clientId), { body: globalCommands });
            console.log(`Successfully reloaded ${globalData.length} global application (/) commands.`);
        }

        // Deploy guild-specific commands
        if (guildCommands.length > 0) {
            const guildData = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: guildCommands });
            console.log(`Successfully reloaded ${guildData.length} guild application (/) commands.`);
        }
    } catch (error) {
        console.error(error);
    }
})();