// ping command (/ping)
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('ping Prune'),
	async execute(interaction) {
        const sent = await interaction.reply({ content: '?', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`What?
			Latency: ${latency}ms | WebSocket: ${interaction.client.ws.ping}ms`);
	},
};