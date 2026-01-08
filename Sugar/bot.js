const fs = require('fs');
const path = require('path');
const { Client, Events, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const { MongoClient } = require('mongodb');
const config = require('./../config.json');
const dbConnection = require('./database');
const token = config.discordTokens.sucre;

// Create New client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

//Connect to MongoDB
client.db = dbConnection;

//Check if Ready
client.once(Events.ClientReady, (readyClient) => {
	console.log(`Ready to send love! Logged in as ${readyClient.user.tag}`);
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

loadCommandsFromDirectory(foldersPath);

// Log in to Discord
//connectToDatabase();
client.login(token);

//Interaction Handling
client.on(Events.InteractionCreate, async (interaction) => {
	// Handle slash commands
	if (interaction.isChatInputCommand()) {
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
	}
	
	// Handle modal submissions
	else if (interaction.isModalSubmit()) {
		try {
			// Import handlers from addmessage command
			const addMessageCommand = client.commands.get('addmessage');
			if (addMessageCommand && addMessageCommand.handleModalSubmit) {
				if (interaction.customId.startsWith('select_field_')) {
					await addMessageCommand.handleFieldSelection(interaction);
				} else {
					await addMessageCommand.handleModalSubmit(interaction);
				}
			}
		} catch (error) {
			console.error('Modal submit error:', error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({
					content: 'There was an error processing your form!',
					flags: MessageFlags.Ephemeral,
				}).catch(console.error);
			}
		}
	}
	
	// Handle button clicks
	else if (interaction.isButton()) {
		try {
			// Import handlers from addmessage command
			const addMessageCommand = client.commands.get('addmessage');
			if (addMessageCommand && addMessageCommand.handleButton) {
				await addMessageCommand.handleButton(interaction);
			}
		} catch (error) {
			console.error('Button error:', error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({
					content: 'There was an error processing your button click!',
					flags: MessageFlags.Ephemeral,
				}).catch(console.error);
			}
		}
	}
});
