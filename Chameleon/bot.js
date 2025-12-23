const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits } = require('discord.js');
const config = require('./../config.json');
const { MongoClient } = require('mongodb');
const token = config.discordTokens.system;
const mongoURI = config.mongoURIs.system;

// Create New client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

//Connect to MongoDB
async function connectToDatabase() {
try {
    await MongoClient.connect(mongoURI);
    console.log(`Connected to System's MongoDB Cluster`);
} catch (error) {
    console.error(`System's MongoDB connection error:`, error);
}}

//Check if Ready
client.once(Events.ClientReady, (readyClient) => {
	console.log(`Let our wheels spin... Logged in as ${readyClient.user.tag}`);
});

/*
//Load Commands
client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}
*/

// Log in to Discord
connectToDatabase();
client.login(token);


/*
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
*/