const { REST, Routes } = require('discord.js');
const config = require('../config.json');
const fs = require('fs');
const path = require('path');
const clientId = config.discordClientIDs.trigin;
const guildId =  config.core.discordGuildID;
const token = config.discordTokens.trigin; 

const globalCommands = [];
const guildCommands = [];

// Grab all the command folders from the commands directory

function loadCommands(foldersPath, commandArray) {
    const commandFolders = fs.readdirSync(foldersPath);

    for (const folder of commandFolders) {
        // Grab all the command files from the commands directory 
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
        // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commandArray.push(command.data.toJSON());
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
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

        // Deploy global commands
        if (globalCommands.length > 0) {
            const globalData = await rest.put(
                Routes.applicationCommands(clientId),
                { body: globalCommands }
            );
            console.log(`Successfully reloaded ${globalData.length} global application (/) commands.`);
        }

        // Deploy guild-specific commands
        if (guildCommands.length > 0) {
            const guildData = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: guildCommands }
            );
            console.log(`Successfully reloaded ${guildData.length} guild application (/) commands.`);
        }

        console.log('All commands deployed successfully!');
    } catch (error) {
        console.error(error);
    }
})();