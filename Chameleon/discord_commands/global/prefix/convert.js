// sys!convert - Convert entities between types (alter <-> state)
// 
// USAGE:
//   sys!convert alter <name> to state       - Convert an alter to a state
//   sys!convert state <name> to alter       - Convert a state to an alter
//   sys!convert alters <n1,n2,n3> to states - Batch convert alters to states
//   sys!convert states <n1,n2,n3> to alters - Batch convert states to alters
//
// FLAGS:
//   -confirm                                - Skip confirmation prompt
//   -keep                                   - Keep original (creates copy)

const { EmbedBuilder } = require('discord.js');
const System = require('../../../schemas/system');
const { convertAltersToStates, convertStatesToAlters, CONVERT_COLOR } = require('../../functions/convert_functions');
const utils = require('../../functions/bot_utils');

module.exports = {
    name: 'convert',
    aliases: ['conv', 'transform'],

    async executeMessage(message, args) {
        const { user, system } = await utils.getOrCreateUserAndSystem(message);

        if (!system) return utils.error(message, 'You need a system to convert entities. Use `sys!system new` or `/system manage` to create one.');

        const parsed = utils.parseArgs(args);

        const sourceType = parsed._positional[0]?.toLowerCase();
        if (!sourceType || sourceType === 'help') return handleHelp(message);

        const isBatch = sourceType === 'alters' || sourceType === 'states';
        const normalizedSourceType = sourceType.replace(/s$/, '');

        if (!['alter', 'state'].includes(normalizedSourceType))
            return utils.error(message, `Invalid source type: \`${sourceType}\`\nUse \`alter\` or \`state\` (or \`alters\`/\`states\` for batch).`);

        const toIndex = parsed._positional.findIndex(p => p.toLowerCase() === 'to');
        if (toIndex === -1) return utils.error(message, 'Missing `to` keyword.\nUsage: `sys!convert alter <name> to state`');

        const namesPart = parsed._positional.slice(1, toIndex).join(' ');
        if (!namesPart) return utils.error(message, `Please specify the ${normalizedSourceType} name(s) to convert.`);

        let targetType = parsed._positional[toIndex + 1]?.toLowerCase();
        if (!targetType) return utils.error(message, 'Please specify the target type (alter or state).');
        targetType = targetType.replace(/s$/, '');

        if (!['alter', 'state'].includes(targetType))
            return utils.error(message, `Invalid target type: \`${targetType}\`\nUse \`alter\` or \`state\`.`);

        if (normalizedSourceType === targetType)
            return utils.error(message, `Cannot convert ${normalizedSourceType} to ${targetType} - they're the same type!`);

        const names = isBatch
            ? namesPart.split(',').map(n => n.trim()).filter(Boolean)
            : [namesPart];

        const options = {
            confirm: parsed.confirm || false,
            keep: parsed.keep || false
        };

        if (normalizedSourceType === 'alter' && targetType === 'state')
            return handleConvert(message, system, names, options, 'alter', 'state');
        else
            return handleConvert(message, system, names, options, 'state', 'alter');
    }
};

async function handleConvert(message, system, names, options, sourceType, targetType) {
    const label = sourceType === 'alter' ? 'Alters' : 'States';
    const targetLabel = targetType === 'alter' ? 'Alters' : 'States';

    if (!options.confirm) {
        const embed = new EmbedBuilder()
            .setColor(CONVERT_COLOR)
            .setTitle(`🔄 Convert ${label} to ${targetLabel}?`)
            .setDescription(`This will convert **${names.length}** ${label.toLowerCase()}:\n${names.join(', ')}`)
            .addFields({
                name: options.keep ? '📋 Mode: Copy' : '⚠️ Mode: Convert',
                value: options.keep
                    ? `Original ${label.toLowerCase()} will be kept (copies created as ${targetLabel.toLowerCase()})`
                    : `Original ${label.toLowerCase()} will be **deleted** after conversion`,
                inline: false
            })
            .setFooter({ text: 'Add -confirm to skip this prompt' });

        const confirmMsg = await message.reply({ embeds: [embed] });

        const filter = m => m.author.id === message.author.id &&
            ['yes', 'y', 'confirm', 'no', 'n', 'cancel'].includes(m.content.toLowerCase());

        try {
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
            const response = collected.first().content.toLowerCase();

            if (['no', 'n', 'cancel'].includes(response)) {
                return confirmMsg.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(utils.ENTITY_COLORS.error)
                        .setDescription('❌ Conversion cancelled.')]
                });
            }
        } catch {
            return confirmMsg.edit({
                embeds: [new EmbedBuilder()
                    .setColor(utils.ENTITY_COLORS.error)
                    .setDescription('❌ Conversion timed out.')]
            });
        }
    }

    const statusMsg = await message.reply({
        embeds: [new EmbedBuilder()
            .setColor(CONVERT_COLOR)
            .setDescription(`🔄 Converting ${names.length} ${sourceType}(s) to ${targetType}s...`)]
    });

    const convertFn = sourceType === 'alter' ? convertAltersToStates : convertStatesToAlters;
    const { error, results } = await convertFn(system, names, options);

    if (error) {
        return statusMsg.edit({
            embeds: [new EmbedBuilder()
                .setColor(utils.ENTITY_COLORS.error)
                .setDescription(`❌ ${error}`)]
        });
    }

    const embed = buildResultEmbed(`${label} → ${targetLabel}`, results, options.keep);
    await statusMsg.edit({ embeds: [embed] });
}

function buildResultEmbed(conversionType, results, keepOriginal) {
    const embed = new EmbedBuilder()
        .setColor(results.errors.length > 0 ? '#FFA500' : utils.ENTITY_COLORS.success)
        .setTitle(`✅ ${conversionType} Conversion Complete`);

    let description = '';

    if (results.converted.length > 0)
        description += `**${keepOriginal ? 'Copied' : 'Converted'}:** ${results.converted.join(', ')}\n`;

    if (results.notFound.length > 0)
        description += `\n**Not Found:** ${results.notFound.join(', ')}\n`;

    embed.setDescription(description || 'No entities processed.');

    if (results.errors.length > 0) {
        embed.addFields({
            name: '⚠️ Errors',
            value: results.errors.slice(0, 5).join('\n'),
            inline: false
        });
    }

    return embed;
}

async function handleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(CONVERT_COLOR)
        .setTitle('🔄 Convert Command')
        .setDescription('Convert entities between alters and states.')
        .addFields(
            {
                name: 'Single Conversion',
                value: [
                    '`sys!convert alter <name> to state`',
                    '`sys!convert state <name> to alter`'
                ].join('\n'),
                inline: false
            },
            {
                name: 'Batch Conversion',
                value: [
                    '`sys!convert alters <n1,n2,n3> to states`',
                    '`sys!convert states <n1,n2,n3> to alters`'
                ].join('\n'),
                inline: false
            },
            {
                name: 'Options',
                value: [
                    '`-confirm` - Skip confirmation prompt',
                    '`-keep` - Keep original (creates a copy instead)'
                ].join('\n'),
                inline: false
            },
            {
                name: 'What Transfers',
                value: [
                    '✅ Name, display name, description, aliases',
                    '✅ Avatar, color, sign-off',
                    '✅ Proxy tags, caution, condition',
                    '✅ Group memberships',
                    '✅ Privacy settings',
                    '✅ Import metadata (PluralKit, etc.)',
                    '✅ Front/shift history (snowflake inherited)'
                ].join('\n'),
                inline: false
            },
            {
                name: '💡 Tip',
                value: 'Use this after importing from PluralKit/Tupperbox to convert members that should be states!',
                inline: false
            }
        );

    return message.reply({ embeds: [embed] });
}
