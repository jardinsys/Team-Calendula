const { Client, Events, GatewayIntentBits } = require('discord.js');
const config = require('./../config.json');
const token = config.discordTokens.trigin;

// Create New client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
	console.log(`Ready to Roar! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord
client.login(token);