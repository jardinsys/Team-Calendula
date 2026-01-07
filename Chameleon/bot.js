const fs = require('fs');
const path = require('path');
const { Client, Events, GatewayIntentBits, Collection, MessageFlags, EmbedBuilder } = require('discord.js');
const config = require('./../config.json');
const { MongoClient } = require('mongodb');
const dbConnection = require('./database');
const token = config.discordTokens.system;
const prefixes = ['sys!', 'sys;'];

// Create New client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

// Connect to MongoDB
client.db = dbConnection;

// Check if Ready
client.once(Events.ClientReady, (readyClient) => {
	console.log(`Let our wheels spin... Logged in as ${readyClient.user.tag}`);
});
console.log('');

// Load Commands 
console.log(`💙---LOADING COMMANDS---💙`);
client.commands = new Collection();
client.prefixCommands = new Collection();

const foldersPath = path.join(__dirname, 'discord_commands');

const loadedSlashCommands = [];
const loadedPrefixCommands = [];
const loadedHybridCommands = [];
const couldntCommands = [];

// Recursively load commands from folders
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

			// Validate command structure
			// Support both 'execute' and 'executeInteraction' for slash commands
			const hasSlashCommand = 'data' in command && ('execute' in command || 'executeInteraction' in command);
			const hasPrefixCommand = 'name' in command && 'executeMessage' in command;

			// Register Commands
			if (!hasSlashCommand && !hasPrefixCommand) {
				console.log(`[WARNING] The command at ${itemPath} is missing required properties.`);
				console.log(`  - For slash commands: needs "data" and "execute" (or "executeInteraction")`);
				console.log(`  - For prefix commands: needs "name" and "executeMessage"`);
				couldntCommands.push(itemPath);
				continue;
			}
			if (hasSlashCommand && hasPrefixCommand) {
				client.commands.set(command.data.name, command);
				client.prefixCommands.set(command.name, command);
				console.log(`Loaded Hybrid command: ${command.data.name}`);
				loadedHybridCommands.push(command.data.name);
				continue;
			}
			if (hasSlashCommand) {
				client.commands.set(command.data.name, command);
				console.log(`Loaded Slash command: ${command.data.name}`);
				loadedSlashCommands.push(command.data.name);
			}
			if (hasPrefixCommand) {
				client.prefixCommands.set(command.name, command);
				console.log(`Loaded Prefix command: ${command.name}`);
				loadedPrefixCommands.push(command.name);
			}
		}
	}
}

loadCommandsFromDirectory(foldersPath);

// Print Loaded Commands
if (loadedPrefixCommands.length > 0) {
	console.log('');
	console.log("Loaded PREFIX Commands:")
	for (const lc of loadedPrefixCommands) console.log(lc);
}
if (loadedSlashCommands.length > 0) {
	console.log('');
	console.log("Loaded SLASH Commands:")
	for (const lc of loadedSlashCommands) console.log(lc);
}
if (loadedHybridCommands.length > 0) {
	console.log('');
	console.log("Loaded HYBRID Commands:")
	for (const lc of loadedHybridCommands) console.log(lc);
}
if (couldntCommands.length > 0) {
	console.log('');
	console.log(`Couldn't load these Commands:`)
	for (const lc of couldntCommands)
		console.log(lc);
}
console.log('');

// Log in
console.log(`💙---LOGGING IN---💙`);
connectToDatabase();
client.login(token);

// Upon Invite to server
client.on('guildCreate', async guild => {
	try {
		const owner = await guild.fetchOwner();

		const embed = new EmbedBuilder()
			.setTitle("🎉 Thanks for Adding Me!")
			.setDescription(
				`Hey **${owner.user.username}**, thanks for adding me to **${guild.name}**!\n\n` +
				`Here's how to get started:\n` +
				`• Use \`/help\` to see all commands\n` +
				`• Configure settings with \`/setup\`\n` +
				`• DM me anytime if you need help`
			)
			.setColor("Blurple");

		await owner.send({ embeds: [embed] }).catch(() => {
			console.log(`Couldn't DM the owner of ${guild.name}`);
		});

	} catch (err) {
		console.error(err);
	}
});

// INTERACTION HANDLING
client.on(Events.InteractionCreate, async (interaction) => {
	// SLASH COMMAND HANDLING
	if (interaction.isChatInputCommand()) {
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			// Support both 'execute' and 'executeInteraction' method names
			if (command.execute) {
				await command.execute(interaction);
			} else if (command.executeInteraction) {
				await command.executeInteraction(interaction);
			}
		} catch (error) {
			console.error(`Error executing command ${interaction.commandName}:`, error);

			const errorMessage = {
				content: 'There was an error while executing this command!',
				flags: MessageFlags.Ephemeral,
			};

			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(errorMessage).catch(console.error);
			} else {
				await interaction.reply(errorMessage).catch(console.error);
			}
		}
		return;
	}

	// BUTTON INTERACTION HANDLING
	if (interaction.isButton()) {
		try {
			const customId = interaction.customId;

			// Systemiser commands - route based on customId prefix
			// new_user_ buttons can come from any systemiser command
			if (customId.startsWith('new_user_')) {
				// Extract entity type from customId (e.g., new_user_has_system_alter -> alter)
				const parts = customId.split('_');
				const entityType = parts[parts.length - 1]; // Last part is entity type
				const cmd = interaction.client.commands.get(entityType);
				if (cmd?.handleButtonInteraction) {
					return await cmd.handleButtonInteraction(interaction);
				}
			}

			// System command buttons
			if (customId.startsWith('system_')) {
				const cmd = interaction.client.commands.get('system');
				if (cmd?.handleButtonInteraction) {
					return await cmd.handleButtonInteraction(interaction);
				}
			}

			// Alter command buttons
			if (customId.startsWith('alter_')) {
				const cmd = interaction.client.commands.get('alter');
				if (cmd?.handleButtonInteraction) {
					return await cmd.handleButtonInteraction(interaction);
				}
			}

			// State command buttons
			if (customId.startsWith('state_')) {
				const cmd = interaction.client.commands.get('state');
				if (cmd?.handleButtonInteraction) {
					return await cmd.handleButtonInteraction(interaction);
				}
			}

			// Group command buttons
			if (customId.startsWith('group_')) {
				const cmd = interaction.client.commands.get('group');
				if (cmd?.handleButtonInteraction) {
					return await cmd.handleButtonInteraction(interaction);
				}
			}

		} catch (error) {
			console.error('Button interaction error:', error);

			const errorMessage = {
				content: 'There was an error processing this button!',
				flags: MessageFlags.Ephemeral,
			};

			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(errorMessage).catch(console.error);
			} else {
				await interaction.reply(errorMessage).catch(console.error);
			}
		}
		return;
	}

	// SELECT MENU INTERACTION HANDLING
	if (interaction.isStringSelectMenu()) {
		try {
			const customId = interaction.customId;

			// System command select menus
			if (customId.startsWith('system_')) {
				const cmd = interaction.client.commands.get('system');
				if (cmd?.handleSelectMenu) {
					return await cmd.handleSelectMenu(interaction);
				}
			}

			// Alter command select menus
			if (customId.startsWith('alter_')) {
				const cmd = interaction.client.commands.get('alter');
				if (cmd?.handleSelectMenu) {
					return await cmd.handleSelectMenu(interaction);
				}
			}

			// State command select menus
			if (customId.startsWith('state_')) {
				const cmd = interaction.client.commands.get('state');
				if (cmd?.handleSelectMenu) {
					return await cmd.handleSelectMenu(interaction);
				}
			}

			// Group command select menus
			if (customId.startsWith('group_')) {
				const cmd = interaction.client.commands.get('group');
				if (cmd?.handleSelectMenu) {
					return await cmd.handleSelectMenu(interaction);
				}
			}

			// Add more select menu handlers here as needed...

		} catch (error) {
			console.error('Select menu interaction error:', error);

			const errorMessage = {
				content: 'There was an error processing this selection!',
				flags: MessageFlags.Ephemeral,
			};

			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(errorMessage).catch(console.error);
			} else {
				await interaction.reply(errorMessage).catch(console.error);
			}
		}
		return;
	}

	// MODAL SUBMIT HANDLING
	if (interaction.isModalSubmit()) {
		try {
			const customId = interaction.customId;

			// System command modals
			if (customId.startsWith('system_')) {
				const cmd = interaction.client.commands.get('system');
				if (cmd?.handleModalSubmit) {
					return await cmd.handleModalSubmit(interaction);
				}
			}

			// Alter command modals
			if (customId.startsWith('alter_')) {
				const cmd = interaction.client.commands.get('alter');
				if (cmd?.handleModalSubmit) {
					return await cmd.handleModalSubmit(interaction);
				}
			}

			// State command modals
			if (customId.startsWith('state_')) {
				const cmd = interaction.client.commands.get('state');
				if (cmd?.handleModalSubmit) {
					return await cmd.handleModalSubmit(interaction);
				}
			}

			// Group command modals
			if (customId.startsWith('group_')) {
				const cmd = interaction.client.commands.get('group');
				if (cmd?.handleModalSubmit) {
					return await cmd.handleModalSubmit(interaction);
				}
			}

		} catch (error) {
			console.error('Modal submit error:', error);

			const errorMessage = {
				content: 'There was an error processing this form!',
				flags: MessageFlags.Ephemeral,
			};

			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(errorMessage).catch(console.error);
			} else {
				await interaction.reply(errorMessage).catch(console.error);
			}
		}
		return;
	}

	// AUTOCOMPLETE HANDLING
	if (interaction.isAutocomplete()) {
		try {
			const command = interaction.client.commands.get(interaction.commandName);

			if (command?.autocomplete) {
				await command.autocomplete(interaction);
			}
		} catch (error) {
			console.error('Autocomplete error:', error);
		}
		return;
	}
});

// ============================================
// MESSAGE HANDLING (Prefix Commands)
// ============================================

client.on(Events.MessageCreate, async (message) => {
	// Ignore messages from bots and messages that don't start with prefix
	if (message.author.bot) return;

	const prefix = prefixes.find(p => message.content.startsWith(p));
	if (!prefix) return;

	// Parse command and arguments
	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const commandName = args.shift().toLowerCase();

	// Get command from prefix commands collection
	const command = client.prefixCommands.get(commandName);

	if (!command) return; // Command not found, silently ignore

	try {
		await command.executeMessage(message, args);
	} catch (error) {
		console.error(error);
		try {
			await message.reply('There was an error while executing this command!');
		} catch (replyError) {
			console.error('Could not send error message:', replyError);
		}
	}
});