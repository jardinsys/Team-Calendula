//ping command (sys!ping, sys;ping, sys!hi, sys;hi)

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    // Slash command data (used when registering commands)
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Pong?'),

    // Prefix command name
    name: 'ping',

// Slash command handler
    async executeInteraction(interaction) {
        const sent = await interaction.reply({ content: '...?', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`Pong...
            Latency: ${latency}ms | WebSocket: ${interaction.client.ws.ping}ms`);
    },

    // Prefix command handler
    async executeMessage(message, args) {
        const sent = await message.reply('...?');
        const latency = sent.createdTimestamp - message.createdTimestamp;
        await sent.edit(`Pong...
            Latency: ${latency}ms | WebSocket: ${message.client.ws.ping}ms`);
    }
};

