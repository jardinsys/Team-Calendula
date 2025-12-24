// ping command (/ping)
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('ping Sucre'),
	async execute(interaction) {
        const sent = await interaction.reply({ content: 'HI!', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`PONG!
			Latency: ${latency}ms | WebSocket: ${interaction.client.ws.ping}ms`);
	},
};



