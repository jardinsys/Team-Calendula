// Response Helpers
// Success, error, info messages and help embed builder for prefix commands

const { EmbedBuilder } = require('discord.js');
const constants = require('./constants');
const { ENTITY_COLORS } = constants;

// Success Message
async function success(message, text) {
    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(ENTITY_COLORS.success)
            .setDescription(`✅ ${text}`)]
    });
}

// Error Message
async function error(message, text) {
    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(ENTITY_COLORS.error)
            .setDescription(`❌ ${text}`)]
    });
}

// Info
async function info(message, text) {
    return message.reply({
        embeds: [new EmbedBuilder()
            .setColor(ENTITY_COLORS.info)
            .setDescription(`ℹ️ ${text}`)]
    });
}

/* Build a help embed for a command
 * @param {string} commandName - Name of the command
 * @param {string} description - Command description
 * @param {Array<{usage: string, description: string}>} subcommands - List of subcommands
 * @returns {EmbedBuilder}
 */
function buildHelpEmbed(commandName, description, subcommands) {
    const embed = new EmbedBuilder()
        .setColor(ENTITY_COLORS.info)
        .setTitle(`📖 ${commandName} Command Help`)
        .setDescription(description);

    let usageText = '';
    for (const sub of subcommands) {
        usageText += `\`${sub.usage}\`\n${sub.description}\n\n`;
    }

    embed.addFields({ name: 'Usage', value: usageText.trim() });

    return embed;
}

module.exports = {
    success,
    error,
    info,
    buildHelpEmbed,
};