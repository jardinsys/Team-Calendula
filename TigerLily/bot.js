const fs = require('fs');
const path = require('path');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { MongoClient } = require('mongodb');
const config = require('./../config.json');
const dbConnection = require('./database');
const token = config.discordTokens.trigin;
const prefix = 'tr!'

// Create New client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

//Connect to MongoDB
client.db = dbConnection;

//Check if Ready
client.once(Events.ClientReady, (readyClient) => {
	console.log(`Ready to Roar! Logged in as ${readyClient.user.tag}`);
});


//Load 
console.log(`🧡---LOADING COMMANDS---🧡`);
client.commands = new Collection();
client.prefixCommands = new Collection();

const foldersPath = path.join(__dirname, 'commands');

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
			const hasSlashCommand = 'data' in command && 'executeInteraction' in command;
			const hasPrefixCommand = 'name' in command && 'executeMessage' in command;

			// Register Commands
			if (!hasSlashCommand && !hasPrefixCommand) {
				console.log(`[WARNING] The command at ${itemPath} is missing required properties.`);
				console.log(`  - For slash commands: needs "data" and "executeInteraction"`);
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
//Print Loaded Commands
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

// Log in to 
console.log(`🧡---LOGGING IN---🧡`);
connectToDatabase();
client.login(token);

//Upon Invite to server (PLEASE DESCRIPTION LATER)
client.on('guildCreate', async guild => {
    try {
        const owner = await guild.fetchOwner();

        const embed = new EmbedBuilder()
            .setTitle("🎉 Thanks for Adding Me!")
            .setDescription(
                `Hey **${owner.user.username}**, thanks for adding me to **${guild.name}**!\n\n` +
                `Here’s how to get started:\n` +
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

//Interaction Handling (Slash Commands)
client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	/*
	// THIS CHECK IS TEMPORARILY REMOVED UNTIL DEEMED USEFUL FOR PUBLIC
	// Check if command has executeInteraction method
	if (!command.executeInteraction) {
		console.error(`Command ${interaction.commandName} doesn't support slash commands.`);
		
		//THIS DISCORD INTERACTION WAS REMOVED TEMPORARILY FOR "SAFETY"/INTEGRITY UNTIL FURTHER NOTICE

		await interaction.reply({
			content: 'This command is only available as a prefix command.',
			flags: MessageFlags.Ephemeral,
		});
		
		//
		return;
	}
		*/

	try {
		await command.executeInteraction(interaction);
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

//Message Handling (Prefix Commands)
client.on(Events.MessageCreate, async (message) => {
	// Ignore messages from bots and messages that don't start with prefix
	if (message.author.bot || !message.content.startsWith(prefix)) return;

	// Parse command and arguments
	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const commandName = args.shift().toLowerCase();

	// Get command from prefix commands collection
	const command = client.prefixCommands.get(commandName);

	if (!command) return; // Command not found, silently ignore


	/*
	// THIS CHECK IS TEMPORARILY REMOVED UNTIL DEEMED USEFUL FOR PUBLIC
	// Check if command has executeMessage method
	if (!command.executeMessage) {
		console.error(`Command ${commandName} doesn't support prefix commands.`);
		await message.reply('This command is only available as a slash command.');
		return;
	}
		*/

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