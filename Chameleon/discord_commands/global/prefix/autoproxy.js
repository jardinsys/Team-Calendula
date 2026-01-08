// sys!autoproxy - Autoproxy settings management
const { EmbedBuilder } = require('discord.js');
const System = require('../../schemas/system');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const utils = require('../../functions/bot_utils');

module.exports = {
    name: 'autoproxy',
    aliases: ['ap'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        const mode = parsed._positional[0]?.toLowerCase();

        const { system } = await utils.getOrCreateUserAndSystem(message);
        if (!await utils.requireSystem(message, system)) return;

        if (!mode || mode === 'help') return handleHelp(message, system);

        // Mode handlers
        switch (mode) {
            case 'off':
                return handleOff(message, system);
            case 'front':
                return handleFront(message, system);
            case 'latch':
            case 'last':
                return handleLatch(message, system);
            default:
                // Assume it's a member name
                return handleMember(message, system, mode);
        }
    }
};

async function handleOff(message, system) {
    system.proxy = system.proxy || {};
    system.proxy.style = 'off';
    await system.save();
    return utils.success(message, 'Autoproxy disabled. Messages will only be proxied when using proxy tags.');
}

async function handleFront(message, system) {
    system.proxy = system.proxy || {};
    system.proxy.style = 'front';
    await system.save();
    return utils.success(message, 'Autoproxy set to **front**. Messages will be proxied as the current fronter (if single).');
}

async function handleLatch(message, system) {
    system.proxy = system.proxy || {};
    system.proxy.style = 'last';
    await system.save();
    return utils.success(message, 'Autoproxy set to **latch**. Messages will be proxied as the most recent manually proxied member.');
}

async function handleMember(message, system, memberName) {
    // Find the entity
    const result = await utils.findEntity(memberName, system);
    if (!result) {
        return utils.error(message, `Member **${memberName}** not found. Did you mean \`sys!ap off\`, \`sys!ap front\`, or \`sys!ap latch\`?`);
    }

    // Set autoproxy to this specific member
    system.proxy = system.proxy || {};
    system.proxy.style = result.entity.name?.indexable || memberName;
    await system.save();

    const displayName = result.entity.name?.display || result.entity.name?.indexable || memberName;
    return utils.success(message, `Autoproxy set to **${displayName}**. All messages will be proxied as this ${result.type}.`);
}

async function handleHelp(message, system) {
    const currentStyle = system.proxy?.style || 'off';
    let currentDisplay = currentStyle;
    
    // If it's a member name, try to find and display it nicely
    if (!['off', 'last', 'front'].includes(currentStyle)) {
        const result = await utils.findEntity(currentStyle, system);
        if (result) {
            currentDisplay = result.entity.name?.display || currentStyle;
        }
    }

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.info)
        .setTitle('🔄 Autoproxy Settings')
        .setDescription(`Current mode: **${currentDisplay}**`)
        .addFields(
            { name: 'Usage', value: 
                '`sys!ap off` - Disable autoproxy\n' +
                '`sys!ap front` - Proxy as current fronter\n' +
                '`sys!ap latch` - Proxy as last manually proxied\n' +
                '`sys!ap <member>` - Always proxy as specific member', inline: false },
            { name: 'Notes', value:
                '• Use `\\` before a message to skip autoproxy once\n' +
                '• Use `\\\\` to skip and clear latch\n' +
                '• Server admins can override these settings', inline: false }
        );

    return message.reply({ embeds: [embed] });
}