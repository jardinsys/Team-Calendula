// (/systemise) - Launch Systemise embedded app
// Responds with LAUNCH_ACTIVITY (type 12) to open the Activity immediately

const { SlashCommandBuilder, REST, Routes } = require('discord.js');
const redis = require('../../../redis');
const User = require('../../../schemas/user');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('systemise')
        .setDescription('Launch the Systemise embedded app')
        .addStringOption(opt => opt
            .setName('page')
            .setDescription('Open directly to a specific page')
            .setRequired(false)
            .addChoices(
                { name: 'System', value: 'system' },
                { name: 'Friends', value: 'friends' },
                { name: 'Notes', value: 'notes' },
                { name: 'Crisis', value: 'crisis' }
            )),

    async execute(interaction) {
        const page = interaction.options.getString('page');

        // Respond immediately — DB/Redis work happens async
        const rest = new REST({ version: '10' }).setToken(interaction.client.token);
        try {
            await rest.post(Routes.interactionCallback(interaction.id, interaction.token), {
                body: { type: 12 }
            });
        } catch (err) {
            // Interaction already expired — nothing we can do
            console.error('[systemise] Failed to send interaction callback:', err.message);
            return;
        }

        // Fire-and-forget: set pending page in Redis
        if (page) {
            try {
                const user = await User.findOne({ discordID: interaction.user.id });
                if (user) {
                    await redis.set(`pendingActivity:${user._id}`, page, 'EX', 60);
                }
            } catch (err) {
                console.error('[systemise] Failed to set pending page:', err.message);
            }
        }
    }
};
