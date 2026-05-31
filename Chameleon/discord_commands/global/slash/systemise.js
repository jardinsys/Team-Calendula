// (/systemise) - Launch Systemise embedded app
// Responds with LAUNCH_ACTIVITY (type 12) to open the Activity immediately

const { SlashCommandBuilder, REST, Routes } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('systemise')
        .setDescription('Launch the Systemise embedded app'),

    async execute(interaction) {
        const rest = new REST({ version: '10' }).setToken(interaction.client.token);
        await rest.post(Routes.interactionCallback(interaction.id, interaction.token), {
            body: { type: 12 }
        });
    }
};
