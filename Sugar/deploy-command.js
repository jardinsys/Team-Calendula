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
            // Skip certain directories that don't contain commands
            const folderName = path.basename(itemPath);
            if (folderName === 'functions' || folderName === 'schemas' || folderName === 'utils') {
                console.log(`  - Skipped directory: ${folderName}/`);
                continue;
            }
            // Add it to the list of Directories to process
            directoriesToProcess.push(itemPath);
        } else if (item.endsWith('.js')) {
            // .js file - try to load as command
            try {
                const command = require(itemPath);
                if ('data' in command) {
                    commands.push(command.data.toJSON());
                    console.log(`  ✓ Loaded: ${command.data.name}`);
                } else {
                    console.log(`  - Skipped (not a slash command): ${item}`);
                }
            } catch (error) {
                console.log(`  ✗ Error loading ${item}: ${error.message}`);
            }
        }
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy commands
(async () => {
    try {
        console.log(`
Started refreshing ${commands.length} application (/) commands.`);

        // Clear existing commands
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

        console.log(`✓ Successfully reloaded ${data.length} application (/) commands.`);
        console.log('All Sugar commands deployed! 💌');
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();