const fs = require('fs');
const path = require('path');
const { Client, Events, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const config = require('./config.json');
const dbConnection = require('./database');
const token = config.discordTokens.system;
const prefixes = ['sys!', 'sys;'];
const utils = require('./discord_commands/functions/bot_utils');
const redis = require('./redis');

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

// Initialize notification manager
client.notificationManager = utils.notificationManager;

// Check if Ready
client.once(Events.ClientReady, async (readyClient) => {
	console.log(`Let our wheels spin... Logged in as ${readyClient.user.tag}`);
	
	// Reconcile any unflushed messages from Redis to MongoDB
	await proxyMessageHandler.reconcileOnStartup();
});
console.log('');

// Load Commands 
console.log(`💙---LOADING COMMANDS---💙`);
	client.commands = new Collection();
	client.prefixCommands = new Collection();
	client.contextMenus = new Collection();

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
				// Register context menu commands for O(1) lookup
				if (command.contextMenuData) {
					client.contextMenus.set(command.contextMenuData.name, command);
				}
				if (command.userContextMenuData) {
					client.contextMenus.set(command.userContextMenuData.name, command);
				}
				console.log(`Loaded Slash command: ${command.data.name}`);
				loadedSlashCommands.push(command.data.name);
			}
		if (hasPrefixCommand) {
			client.prefixCommands.set(command.name, command);
			if (command.aliases && Array.isArray(command.aliases)) {
				for (const alias of command.aliases) {
					client.prefixCommands.set(alias, command);
				}
			}
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
//connectToDatabase();
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

// ==== INTERACTION HANDLING ====
const router = require('./discord_commands/functions/bot_utils/interactionRouter');

client.on(Events.InteractionCreate, async (interaction) => {

	// --- SLASH COMMAND HANDLING ---
	if (interaction.isChatInputCommand()) {
		const command = interaction.client.commands.get(interaction.commandName);
		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}
		try {
			if (command.execute) await command.execute(interaction);
			else if (command.executeInteraction) await command.executeInteraction(interaction);
		} catch (error) {
			console.error(`Error executing command ${interaction.commandName}:`, error);
			await router.replyWithError(interaction, 'There was an error while executing this command!');
		}
		return;
	}

	// --- BUTTON INTERACTIONS ---
	if (interaction.isButton()) {
		try {
			await router.routeButtonInteraction(interaction);
		} catch (error) {
			console.error('Button interaction error:', error);
			await router.replyWithError(interaction, 'There was an error processing this button!');
		}
		return;
	}

	// --- SELECT MENU INTERACTIONS ---
	if (interaction.isStringSelectMenu()) {
		try {
			await router.routeSelectInteraction(interaction);
		} catch (error) {
			console.error('Select menu interaction error:', error);
			await router.replyWithError(interaction, 'There was an error processing this selection!');
		}
		return;
	}

	// --- MODAL SUBMIT ---
	if (interaction.isModalSubmit()) {
		try {
			await router.routeModalInteraction(interaction);
		} catch (error) {
			console.error('Modal submit error:', error);
			await router.replyWithError(interaction, 'There was an error processing this form!');
		}
		return;
	}

	// --- AUTOCOMPLETE ---
	if (interaction.isAutocomplete()) {
		try {
			const command = interaction.client.commands.get(interaction.commandName);
			if (command?.autocomplete) await command.autocomplete(interaction);
		} catch (error) {
			console.error('Autocomplete error:', error);
		}
		return;
	}

	// --- CONTEXT MENUS ---
	if (interaction.isMessageContextMenuCommand()) {
		try {
			const command = interaction.client.contextMenus.get(interaction.commandName);
			if (command?.executeContextMenu) await command.executeContextMenu(interaction);
		} catch (error) {
			console.error('Context menu error:', error);
			await router.replyWithError(interaction, 'There was an error processing this action!');
		}
		return;
	}

	if (interaction.isUserContextMenuCommand()) {
		try {
			const command = interaction.client.contextMenus.get(interaction.commandName);
			if (command?.executeUserContextMenu) await command.executeUserContextMenu(interaction);
		} catch (error) {
			console.error('User context menu error:', error);
		}
		return;
	}
});

// ==== MESSAGE HANDLING (Prefix Commands + Proxy) ====

// Import proxy message handler
const proxyMessageHandler = require('./discord_commands/global/proxy-message');

client.on(Events.MessageCreate, async (message) => {
	// Ignore messages from bots
	if (message.author.bot) return;

	// Check for prefix commands first
	const prefix = prefixes.find(p => message.content.startsWith(p));
	
	if (prefix) {
		// Parse command and arguments
		const args = message.content.slice(prefix.length).trim().split(/ +/);
		const commandName = args.shift().toLowerCase();

		// Get command from prefix commands collection
		const command = client.prefixCommands.get(commandName);

		if (command) {
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
			return; // Don't check for proxy if it was a prefix command
		}
	}

	// If not a prefix command, check for proxy messages
	try {
		await proxyMessageHandler.handleProxyMessage(message, client);
	} catch (error) {
		console.error('Proxy handler error:', error);
	}
});

// ==== GRACEFUL SHUTDOWN ====

async function gracefulShutdown(signal) {
	console.log(`\n[Shutdown] Received ${signal}. Flushing pending writes...`);
	
	try {
		await proxyMessageHandler.flushToMongoDB();
		console.log('[Shutdown] Flush complete. Closing Redis connection...');
		await redis.quit();
		console.log('[Shutdown] Redis connection closed. Exiting.');
	} catch (err) {
		console.error('[Shutdown] Error during shutdown:', err);
	}
	
	process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Windows support (Ctrl+C)
if (process.platform === 'win32') {
	const readline = require('readline');
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	rl.on('SIGINT', () => {
		process.emit('SIGINT');
	});
}