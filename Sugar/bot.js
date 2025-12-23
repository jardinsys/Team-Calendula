const { Client, Events, GatewayIntentBits } = require('discord.js');
const config = require('./../config.json');
const token = config.discordTokens.sucre;

// Create New client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
	console.log(`Let our wheels spin... Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord
client.login(token);