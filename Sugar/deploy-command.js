const { REST, Routes } = require('discord.js');
const config = require('../config.json');
const fs = require('fs');
const path = require('path');
const clientId = config.discordClientIDs.sucre;
const guildId = config.core.discordGuildID;
const token = config.discordTokens.sucre;

const commands = [];

const foldersPath = path.join(__dirname, 'commands');
const directoriesToProcess = [foldersPath];

// Process Directories
while (directoriesToProcess.length > 0) {
    const currentPath = directoriesToProcess.shift(); // Get next Directory
    const items = fs.readdirSync(currentPath);

    for (const item of items) {
        const itemPath = path.join(currentPath, item);

        // Check if Directory
        if (fs.statSync(itemPath).isDirectory()) {
            // Add it to the list of Directories to process
            directoriesToProcess.push(itemPath);
        } else if (item.endsWith('.js')) {
            //.js file - load command
            const command = require(itemPath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.log(`[WARNING] The command at ${itemPath} is missing a required "data" or "execute" property.`);
            }
        }
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy commands
(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] }); // Nuke/Delete all guild Commands

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();