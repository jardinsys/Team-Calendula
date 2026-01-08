// sys!system - System management prefix command
// Advanced CLI-style command for direct system manipulation
//
// USAGE:
//   sys!system                           - Show your system info
//   sys!system [@user|ID]                - Show another user's system
//   sys!system new [name]                - Create a new system
//   sys!system rename <name>             - Change system indexable name
//   sys!system displayname <name>        - Change display name
//   sys!system description <desc>        - Change description
//   sys!system avatar <url>              - Change avatar
//   sys!system banner <url>              - Change banner
//   sys!system color <hex>               - Change color
//   sys!system tag <tag>                 - Set system tag(s) (comma-separated for multiple)
//   sys!system birthday <date>           - Set birthday (YYYY-MM-DD)
//   sys!system timezone <tz>             - Set timezone
//   sys!system type <type>               - Set system type name
//   sys!system dsm <type>                - Set DSM classification
//   sys!system icd <type>                - Set ICD classification
//   sys!system synonym <singular> <plural> - Set alter synonyms
//   sys!system privacy                   - Show privacy settings
//   sys!system privacy <field> <public|private> - Set privacy
//   sys!system list                      - List all alters
//   sys!system list -full                - List all alters with details
//   sys!system fronter                   - Show current fronter(s)
//   sys!system delete                    - Delete your system
//   sys!system <field> -clear            - Clear a field

const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');

const utils = require('../../functions/bot_utils');

const DSM_TYPES = ['DID', 'Amnesia', 'Dereal/Depers', 'OSDD-1A', 'OSDD-1B', 'OSDD-2', 'OSDD-3', 'OSDD-4', 'UDD'];
const ICD_TYPES = ['P-DID', 'Trance', 'DNSD', 'Possession Trance', 'SDS'];

module.exports = {
    name: 'system',
    aliases: ['s','sys'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        const subcommand = parsed._positional[0]?.toLowerCase();

        // Route to appropriate handler
        switch (subcommand) {
            case 'new':
            case 'create':
                return handleNew(message, parsed);
            
            case 'rename':
            case 'name':
                return handleRename(message, parsed);
            
            case 'displayname':
            case 'dn':
                return handleDisplayName(message, parsed);
            
            case 'description':
            case 'desc':
                return handleDescription(message, parsed);
            
            case 'avatar':
            case 'icon':
            case 'av':
            case 'pfp':
                return handleAvatar(message, parsed);
            
            case 'banner':
                return handleBanner(message, parsed);
            
            case 'color':
            case 'colour':
                return handleColor(message, parsed);
            
            case 'tag':
            case 'tags':
                return handleTag(message, parsed);
            
            case 'birthday':
            case 'bd':
            case 'bday':
                return handleBirthday(message, parsed);
            
            case 'timezone':
            case 'tz':
                return handleTimezone(message, parsed);
            
            case 'type':
                return handleType(message, parsed);
            
            case 'dsm':
                return handleDSM(message, parsed);
            
            case 'icd':
                return handleICD(message, parsed);
            
            case 'synonym':
            case 'synonyms':
                return handleSynonym(message, parsed);
            
            case 'privacy':
                return handlePrivacy(message, parsed);
            
            case 'list':
                return handleList(message, parsed);
            
            case 'fronter':
            case 'front':
            case 'f':
                return handleFronter(message, parsed);
            
            case 'fronthistory':
            case 'fh':
                return handleFrontHistory(message, parsed);
            
            case 'delete':
                return handleDelete(message, parsed);
            
            case 'id':
                return handleId(message, parsed);
            
            case 'help':
                return handleHelp(message);
            
            default:
                // No subcommand or viewing another system
                return handleShow(message, parsed);
        }
    }
};

// ============================================
// HANDLERS
// ============================================

async function handleShow(message, parsed) {
    const { user, system, targetUserId } = await utils.resolveTargetSystem(message, parsed);

    if (!system) {
        if (targetUserId === message.author.id) {
            return utils.error(message, 'You don\'t have a system yet. Use `sys!system new [name]` to create one.');
        }
        return utils.error(message, 'That user doesn\'t have a system.');
    }

    const embed = await buildSystemEmbed(system, parsed.full);
    return message.reply({ embeds: [embed] });
}

async function handleNew(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);

    if (system) {
        return utils.error(message, 'You already have a system. Use `sys!system delete` first if you want to create a new one.');
    }

    // Get name from remaining positional args
    const name = parsed._positional.slice(1).join(' ') || null;

    // Create new system
    const newSystem = new System({
        users: [user._id],
        name: name ? {
            indexable: name.toLowerCase().replace(/[^a-z0-9\-_]/g, ''),
            display: name
        } : undefined,
        metadata: {
            joinedAt: new Date()
        }
    });

    await newSystem.save();

    // Link user to system
    user.systemID = newSystem._id;
    await user.save();

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.success)
        .setTitle('✅ System Created!')
        .setDescription(name 
            ? `Your system **${name}** has been created.`
            : 'Your system has been created.')
        .addFields(
            { name: 'System ID', value: `\`${newSystem._id}\``, inline: true },
            { name: 'Next Steps', value: 
                '• `sys!system displayname <name>` - Set display name\n' +
                '• `sys!system description <desc>` - Add description\n' +
                '• `sys!alter new <name>` - Create your first alter', inline: false }
        );

    return message.reply({ embeds: [embed] });
}

async function handleRename(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.name.indexable = undefined;
        await system.save();
        return utils.success(message, 'System indexable name cleared.');
    }

    const newName = parsed._positional.slice(1).join(' ');
    if (!newName) {
        return utils.error(message, 'Please provide a new name: `sys!system rename <name>`');
    }

    if (!utils.isValidIndexableName(newName)) {
        return utils.error(message, 'Indexable names can only contain letters, numbers, dashes, and underscores.');
    }

    system.name = system.name || {};
    system.name.indexable = newName;
    await system.save();

    return utils.success(message, `System indexable name set to **${newName}**`);
}

async function handleDisplayName(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        if (system.name) system.name.display = undefined;
        await system.save();
        return utils.success(message, 'System display name cleared.');
    }

    const newName = parsed._positional.slice(1).join(' ');
    if (!newName) {
        return utils.error(message, 'Please provide a display name: `sys!system displayname <name>`');
    }

    system.name = system.name || {};
    system.name.display = newName;
    await system.save();

    return utils.success(message, `System display name set to **${newName}**`);
}

async function handleDescription(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.description = undefined;
        await system.save();
        return utils.success(message, 'System description cleared.');
    }

    const desc = parsed._positional.slice(1).join(' ') || parsed.description;
    if (!desc) {
        return utils.error(message, 'Please provide a description: `sys!system description <text>`');
    }

    system.description = desc;
    await system.save();

    return utils.success(message, 'System description updated.');
}

async function handleAvatar(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.avatar = undefined;
        await system.save();
        return utils.success(message, 'System avatar cleared.');
    }

    // Check for attachment
    const attachment = message.attachments.first();
    const url = attachment?.url || parsed._positional[1] || parsed.avatar;

    if (!url) {
        return utils.error(message, 'Please provide an avatar URL or upload an image: `sys!system avatar <url>`');
    }

    system.avatar = { url };
    await system.save();

    return utils.success(message, 'System avatar updated.');
}

async function handleBanner(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        if (system.discord?.image) system.discord.image.banner = undefined;
        await system.save();
        return utils.success(message, 'System banner cleared.');
    }

    const attachment = message.attachments.first();
    const url = attachment?.url || parsed._positional[1] || parsed.banner;

    if (!url) {
        return utils.error(message, 'Please provide a banner URL or upload an image: `sys!system banner <url>`');
    }

    system.discord = system.discord || {};
    system.discord.image = system.discord.image || {};
    system.discord.image.banner = { url };
    await system.save();

    return utils.success(message, 'System banner updated.');
}

async function handleColor(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.color = undefined;
        await system.save();
        return utils.success(message, 'System color cleared.');
    }

    const colorInput = parsed._positional[1] || parsed.color;
    const color = utils.normalizeColor(colorInput);

    if (!color) {
        return utils.error(message, 'Please provide a valid hex color: `sys!system color #FF0000`');
    }

    system.color = color;
    await system.save();

    return utils.success(message, `System color set to **${color}**`);
}

async function handleTag(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.discord = system.discord || {};
        system.discord.tag = system.discord.tag || {};
        system.discord.tag.normal = [];
        await system.save();
        return utils.success(message, 'System tags cleared.');
    }

    const tagInput = parsed._positional.slice(1).join(' ') || parsed.tag;
    if (!tagInput) {
        return utils.error(message, 'Please provide tag(s): `sys!system tag <tag1>, <tag2>, ...`');
    }

    const tags = utils.parseList(tagInput);
    
    system.discord = system.discord || {};
    system.discord.tag = system.discord.tag || {};
    system.discord.tag.normal = tags;
    await system.save();

    return utils.success(message, `System tags set to: ${tags.map(t => `**${t}**`).join(', ')}`);
}

async function handleBirthday(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.birthday = undefined;
        await system.save();
        return utils.success(message, 'System birthday cleared.');
    }

    const dateInput = parsed._positional[1] || parsed.birthday;
    if (!dateInput) {
        return utils.error(message, 'Please provide a date (YYYY-MM-DD): `sys!system birthday 2020-01-15`');
    }

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
        return utils.error(message, 'Invalid date format. Use YYYY-MM-DD.');
    }

    system.birthday = date;
    await system.save();

    return utils.success(message, `System birthday set to **${utils.formatDate(date)}**`);
}

async function handleTimezone(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.timezone = undefined;
        await system.save();
        return utils.success(message, 'System timezone cleared.');
    }

    const tz = parsed._positional[1] || parsed.timezone;
    if (!tz) {
        return utils.error(message, 'Please provide a timezone: `sys!system timezone America/New_York`');
    }

    system.timezone = tz;
    await system.save();

    return utils.success(message, `System timezone set to **${tz}**`);
}

async function handleType(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.sys_type = system.sys_type || {};
        system.sys_type.name = 'None';
        await system.save();
        return utils.success(message, 'System type cleared.');
    }

    const typeName = parsed._positional.slice(1).join(' ') || parsed.type;
    if (!typeName) {
        return utils.error(message, 'Please provide a type name: `sys!system type <name>`');
    }

    system.sys_type = system.sys_type || {};
    system.sys_type.name = typeName;
    await system.save();

    return utils.success(message, `System type set to **${typeName}**`);
}

async function handleDSM(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.sys_type = system.sys_type || {};
        system.sys_type.dd = system.sys_type.dd || {};
        system.sys_type.dd.DSM = undefined;
        await system.save();
        return utils.success(message, 'DSM classification cleared.');
    }

    const dsmType = parsed._positional[1]?.toUpperCase() || parsed.dsm?.toUpperCase();
    if (!dsmType) {
        return utils.error(message, `Please provide a DSM type: \`sys!system dsm <type>\`\nValid types: ${DSM_TYPES.join(', ')}`);
    }

    if (!DSM_TYPES.includes(dsmType)) {
        return utils.error(message, `Invalid DSM type. Valid types: ${DSM_TYPES.join(', ')}`);
    }

    system.sys_type = system.sys_type || {};
    system.sys_type.dd = system.sys_type.dd || {};
    system.sys_type.dd.DSM = dsmType;
    await system.save();

    return utils.success(message, `DSM classification set to **${dsmType}**`);
}

async function handleICD(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.sys_type = system.sys_type || {};
        system.sys_type.dd = system.sys_type.dd || {};
        system.sys_type.dd.ICD = undefined;
        await system.save();
        return utils.success(message, 'ICD classification cleared.');
    }

    const icdType = parsed._positional[1] || parsed.icd;
    if (!icdType) {
        return utils.error(message, `Please provide an ICD type: \`sys!system icd <type>\`\nValid types: ${ICD_TYPES.join(', ')}`);
    }

    if (!ICD_TYPES.includes(icdType)) {
        return utils.error(message, `Invalid ICD type. Valid types: ${ICD_TYPES.join(', ')}`);
    }

    system.sys_type = system.sys_type || {};
    system.sys_type.dd = system.sys_type.dd || {};
    system.sys_type.dd.ICD = icdType;
    await system.save();

    return utils.success(message, `ICD classification set to **${icdType}**`);
}

async function handleSynonym(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    const singular = parsed._positional[1];
    const plural = parsed._positional[2];

    if (parsed.clear) {
        system.alterSynonym = { singular: 'alter', plural: 'alters' };
        await system.save();
        return utils.success(message, 'Alter synonyms reset to default (alter/alters).');
    }

    if (!singular) {
        return utils.error(message, 'Please provide synonyms: `sys!system synonym <singular> <plural>`\nExample: `sys!system synonym headmate headmates`');
    }

    system.alterSynonym = {
        singular: singular,
        plural: plural || singular + 's'
    };
    await system.save();

    return utils.success(message, `Alter synonyms set to **${system.alterSynonym.singular}**/**${system.alterSynonym.plural}**`);
}

async function handlePrivacy(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    const field = parsed._positional[1]?.toLowerCase();
    const value = parsed._positional[2]?.toLowerCase();

    // Just show privacy if no field specified
    if (!field) {
        const embed = new EmbedBuilder()
            .setColor(utils.ENTITY_COLORS.system)
            .setTitle('🔒 System Privacy Settings')
            .setDescription('Use `sys!system privacy <field> <public|private>` to change.')
            .addFields(
                { name: 'Fields', value: 
                    '• description\n• avatar\n• banner\n• birthday\n• pronouns\n• metadata\n• caution\n• hidden', inline: true }
            );
        return message.reply({ embeds: [embed] });
    }

    const validFields = ['description', 'avatar', 'banner', 'birthday', 'pronouns', 'metadata', 'caution', 'hidden', 'mask'];
    if (!validFields.includes(field)) {
        return utils.error(message, `Invalid field. Valid fields: ${validFields.join(', ')}`);
    }

    if (!value || !['public', 'private'].includes(value)) {
        return utils.error(message, 'Please specify `public` or `private`: `sys!system privacy description private`');
    }

    // Update privacy in default bucket
    system.setting = system.setting || {};
    system.setting.privacy = system.setting.privacy || [];
    
    let defaultPrivacy = system.setting.privacy.find(p => p.bucket === 'default');
    if (!defaultPrivacy) {
        defaultPrivacy = { bucket: 'default', settings: {} };
        system.setting.privacy.push(defaultPrivacy);
    }
    
    defaultPrivacy.settings[field] = value === 'private';
    await system.save();

    return utils.success(message, `**${field}** is now **${value}**`);
}

async function handleList(message, parsed) {
    const { user, system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) {
        return utils.error(message, targetUserId === message.author.id 
            ? 'You don\'t have a system yet.' 
            : 'That user doesn\'t have a system.');
    }

    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });

    if (alters.length === 0) {
        return utils.info(message, `No ${system.alterSynonym?.plural || 'alters'} found.`);
    }

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.system)
        .setTitle(`${system.alterSynonym?.plural || 'Alters'} (${alters.length})`);

    if (parsed.full) {
        // Full list with more details
        let desc = '';
        for (const alter of alters.slice(0, 25)) { // Limit to 25 to avoid embed limits
            const name = alter.name?.display || alter.name?.indexable || 'Unknown';
            const proxies = alter.proxy?.length > 0 ? ` • ${alter.proxy[0]}` : '';
            desc += `**${name}** (\`${alter.name?.indexable || alter._id}\`)${proxies}\n`;
        }
        if (alters.length > 25) {
            desc += `\n*...and ${alters.length - 25} more*`;
        }
        embed.setDescription(desc);
    } else {
        // Compact list
        const names = alters.map(a => a.name?.display || a.name?.indexable || 'Unknown');
        embed.setDescription(names.join(', '));
    }

    return message.reply({ embeds: [embed] });
}

async function handleFronter(message, parsed) {
    const { user, system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) {
        return utils.error(message, targetUserId === message.author.id 
            ? 'You don\'t have a system yet.' 
            : 'That user doesn\'t have a system.');
    }

    const frontLayers = system.front?.layers || [];
    if (frontLayers.length === 0) {
        return utils.info(message, 'No fronters currently registered.');
    }

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.system)
        .setTitle('🎭 Current Front');

    for (const layer of frontLayers) {
        const fronters = layer.fronters || [];
        if (fronters.length === 0) continue;

        const fronterNames = [];
        for (const fronter of fronters) {
            let entity = null;
            if (fronter.alterID) {
                entity = await Alter.findById(fronter.alterID);
            } else if (fronter.stateID) {
                entity = await State.findById(fronter.stateID);
            } else if (fronter.groupID) {
                entity = await Group.findById(fronter.groupID);
            }
            if (entity) {
                fronterNames.push(entity.name?.display || entity.name?.indexable || 'Unknown');
            }
        }

        if (fronterNames.length > 0) {
            embed.addFields({
                name: layer.name || 'Main',
                value: fronterNames.join(', '),
                inline: false
            });
        }
    }

    // Show front status if set
    if (system.front?.status) {
        embed.addFields({ name: 'Status', value: system.front.status, inline: true });
    }
    if (system.front?.caution) {
        embed.addFields({ name: 'Caution', value: system.front.caution, inline: true });
    }

    return message.reply({ embeds: [embed] });
}

async function handleFrontHistory(message, parsed) {
    const { user, system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) {
        return utils.error(message, targetUserId === message.author.id 
            ? 'You don\'t have a system yet.' 
            : 'That user doesn\'t have a system.');
    }

    // TODO: Implement front history tracking
    return utils.info(message, 'Front history feature coming soon!');
}

async function handleDelete(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    // Require confirmation
    if (!parsed.confirm) {
        return utils.error(message, 
            '⚠️ **Warning:** This will permanently delete your system and all associated data (alters, states, groups).\n\n' +
            'To confirm, use: `sys!system delete -confirm`'
        );
    }

    // Delete all associated entities
    await Alter.deleteMany({ _id: { $in: system.alters?.IDs || [] } });
    await State.deleteMany({ _id: { $in: system.states?.IDs || [] } });
    await Group.deleteMany({ _id: { $in: system.groups?.IDs || [] } });
    
    // Delete the system
    await System.deleteOne({ _id: system._id });
    
    // Unlink user
    user.systemID = undefined;
    await user.save();

    return utils.success(message, 'Your system has been deleted.');
}

async function handleId(message, parsed) {
    const { user, system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) {
        return utils.error(message, targetUserId === message.author.id 
            ? 'You don\'t have a system yet.' 
            : 'That user doesn\'t have a system.');
    }

    return message.reply(`\`${system._id}\``);
}

async function handleHelp(message) {
    const embed = utils.buildHelpEmbed('system', 
        'Manage your system settings and information.',
        [
            { usage: 'sys!system', description: 'Show your system info' },
            { usage: 'sys!system [@user|ID]', description: 'Show another user\'s system' },
            { usage: 'sys!system new [name]', description: 'Create a new system' },
            { usage: 'sys!system rename <name>', description: 'Change indexable name' },
            { usage: 'sys!system displayname <name>', description: 'Change display name' },
            { usage: 'sys!system description <text>', description: 'Set description' },
            { usage: 'sys!system avatar <url>', description: 'Set avatar (or upload image)' },
            { usage: 'sys!system banner <url>', description: 'Set banner' },
            { usage: 'sys!system color <hex>', description: 'Set color' },
            { usage: 'sys!system tag <tag1, tag2, ...>', description: 'Set system tags' },
            { usage: 'sys!system birthday <YYYY-MM-DD>', description: 'Set birthday' },
            { usage: 'sys!system timezone <tz>', description: 'Set timezone' },
            { usage: 'sys!system type <name>', description: 'Set system type' },
            { usage: 'sys!system dsm <type>', description: 'Set DSM classification' },
            { usage: 'sys!system icd <type>', description: 'Set ICD classification' },
            { usage: 'sys!system synonym <sing> <plur>', description: 'Set alter synonyms' },
            { usage: 'sys!system privacy', description: 'View/edit privacy settings' },
            { usage: 'sys!system list [-full]', description: 'List all alters' },
            { usage: 'sys!system fronter', description: 'Show current fronter(s)' },
            { usage: 'sys!system delete -confirm', description: 'Delete your system' },
            { usage: 'sys!system <field> -clear', description: 'Clear a field' },
        ]
    );
    return message.reply({ embeds: [embed] });
}

// ============================================
// EMBED BUILDERS
// ============================================

async function buildSystemEmbed(system, showFull = false) {
    const embed = new EmbedBuilder()
        .setColor(system.color || utils.ENTITY_COLORS.system);

    // Title and author
    const displayName = system.name?.display || system.name?.indexable || 'Unnamed System';
    const indexableName = system.name?.indexable;

    if (indexableName) {
        embed.setAuthor({ name: indexableName, iconURL: system.avatar?.url });
    }
    embed.setTitle(displayName);

    if (system.description) {
        embed.setDescription(system.description);
    }

    // Avatar
    if (system.avatar?.url) {
        embed.setThumbnail(system.avatar.url);
    }

    // Banner
    if (system.discord?.image?.banner?.url) {
        embed.setImage(system.discord.image.banner.url);
    }

    // Overview
    const alterCount = system.alters?.IDs?.length || 0;
    const stateCount = system.states?.IDs?.length || 0;
    const groupCount = system.groups?.IDs?.length || 0;

    let overview = '';
    overview += `**${system.alterSynonym?.plural || 'Alters'}:** ${alterCount}\n`;
    overview += `**States:** ${stateCount}\n`;
    overview += `**Groups:** ${groupCount}`;

    embed.addFields({ name: '📊 Overview', value: overview, inline: true });

    // Type info
    if (system.sys_type?.name && system.sys_type.name !== 'None') {
        let typeInfo = `**Type:** ${system.sys_type.name}`;
        if (system.sys_type?.dd?.DSM) typeInfo += `\n**DSM:** ${system.sys_type.dd.DSM}`;
        if (system.sys_type?.dd?.ICD) typeInfo += `\n**ICD:** ${system.sys_type.dd.ICD}`;
        embed.addFields({ name: '🏷️ Classification', value: typeInfo, inline: true });
    }

    // Personal info
    let personalInfo = '';
    if (system.birthday) personalInfo += `**Birthday:** ${utils.formatDate(system.birthday)}\n`;
    if (system.timezone) personalInfo += `**Timezone:** ${system.timezone}\n`;
    
    if (personalInfo) {
        embed.addFields({ name: '👤 Personal', value: personalInfo.trim(), inline: true });
    }

    // Tags
    const tags = system.discord?.tag?.normal;
    if (tags && tags.length > 0) {
        embed.addFields({ name: '🏷️ Tags', value: tags.join(' '), inline: true });
    }

    // System ID footer
    embed.setFooter({ text: `System ID: ${system._id}` });

    return embed;
}