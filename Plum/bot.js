const fs = require('fs');
const path = require('path');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./../config.json');
const token = config.discordTokens.prune;

// Create New client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
	console.log(`Ready for the fixes. Logged in as ${readyClient.user.tag}`);
});

//Load Commands
client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');

// Recursive function to load commands from nested folders
function loadCommandsFromDirectory(directory) {
	const items = fs.readdirSync(directory);
	
	for (const item of items) {
		const itemPath = path.join(directory, item);
		const stat = fs.statSync(itemPath);
		
		if (stat.isDirectory()) {
			// Recursively search subdirectories
			loadCommandsFromDirectory(itemPath);
		} else if (item.endsWith('.js')) {
			// Load the command file
			const command = require(itemPath);
			
			// Set a new item in the Collection with the key as the command name and the value as the exported module
			if ('data' in command && 'execute' in command) {
				client.commands.set(command.data.name, command);
				console.log(`Loaded command: ${command.data.name}`);
			} else {
				console.log(`[WARNING] The command at ${itemPath} is missing a required "data" or "execute" property.`);
			}
		}
	}
}

// Log in to Discord
client.login(token);

//Interaction Handling
client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			});
		} else {
			await interaction.reply({
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			});
		}
	}
});