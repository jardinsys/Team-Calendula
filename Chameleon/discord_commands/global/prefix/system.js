// sys!system - System management prefix command
// Advanced CLI-style command for direct system manipulation
//
// USAGE:
//   sys!system                           - Show your system info
//   sys!system [@user|ID]                - Show another user's system
//   sys!system new [name]                - Create a new system
//   sys!system rename <name>             - Change system indexable name
//   sys!system displayname <name>        - Change display name
//   sys!system closedname <name>         - Set closed name display
//   sys!system description <desc>        - Change description
//   sys!system avatar <url>              - Change avatar
//   sys!system banner <url>              - Change banner
//   sys!system color <hex>               - Change color
//   sys!system tag <tag>                 - Set system tag(s) (comma-separated)
//   sys!system birthday <date>           - Set birthday (YYYY-MM-DD)
//   sys!system timezone <tz>             - Set timezone
//   sys!system type <type>               - Set system type name
//   sys!system dsm <type>                - Set DSM classification
//   sys!system icd <type>                - Set ICD classification
//   sys!system synonym <singular> <plural> - Set alter synonyms
//   sys!system sync <true|false>         - Toggle Discord sync
//   sys!system autoshare <true|false>    - Toggle auto-share notes
//   sys!system cooldown <seconds>        - Set proxy cooldown
//   sys!system friendautobucket <name>   - Set friend auto-bucket
//   sys!system proxylayout <type> <fmt>  - Set proxy layout
//   sys!system proxybreak <true|false>   - Toggle proxy break
//   sys!system proxystyle <off|last|front|name> - Set proxy style
//   sys!system casesensitive <true|false> - Toggle case sensitivity
//   sys!system pronounseparator <char>   - Set pronoun separator
//   sys!system frontstatus <status>      - Set front status
//   sys!system battery <0-100>           - Set battery
//   sys!system caution <type> [detail]   - Set caution
//   sys!system mask <field> <value>      - Edit mask mode
//   sys!system conditions <type> list|new|delete - Manage conditions
//   sys!system privacy                   - Show privacy settings
//   sys!system privacy <field> <pub|priv> - Set privacy
//   sys!system privacy buckets list|create|delete|show|addfriend|removefriend - Buckets
//   sys!system list [-full]              - List all alters
//   sys!system fronter                   - Show current fronter(s)
//   sys!system delete                    - Delete your system
//   sys!system <field> -clear            - Clear a field

const { EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const { PrivacyBucket } = require('../../../schemas/settings');
const { Shift } = require('../../../schemas/front');

const utils = require('../../functions/bot_utils');
const proxyMessageHandler = require('../proxy-message');
const { publishEvent } = require('../../../redis');

const { getSystemTerm, getAlterTerm } = utils;

const DSM_TYPES = ['DID', 'Amnesia', 'Dereal/Depers', 'OSDD-1A', 'OSDD-1B', 'OSDD-2', 'OSDD-3', 'OSDD-4', 'UDD'];
const ICD_TYPES = ['P-DID', 'Trance', 'DNSD', 'Possession Trance', 'SDS'];

module.exports = {
    name: 'system',
    aliases: ['s', 'sys', 'profile', 'me'],

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
            
            case 'closedname':
            case 'cn':
                return handleClosedName(message, parsed);
            
            case 'sync':
                return handleSync(message, parsed);
            
            case 'autoshare':
            case 'sharenotes':
                return handleAutoshare(message, parsed);
            
            case 'cooldown':
            case 'cd':
                return handleCooldown(message, parsed);
            
            case 'friendautobucket':
            case 'fab':
                return handleFriendAutoBucket(message, parsed);
            
            case 'proxylayout':
            case 'layout':
                return handleProxyLayout(message, parsed);
            
            case 'proxybreak':
            case 'break':
                return handleProxyBreak(message, parsed);
            
            case 'frontstatus':
            case 'fs':
                return handleFrontStatus(message, parsed);
            
            case 'battery':
            case 'bat':
                return handleBattery(message, parsed);
            
            case 'caution':
                return handleCaution(message, parsed);
            
            case 'mask':
                return handleMask(message, parsed);
            
            case 'proxystyle':
            case 'ps':
                return handleProxyStyle(message, parsed);
            
            case 'replystyle':
            case 'rs':
                return handleReplyStyle(message, parsed);
            
            case 'casesensitive':
            case 'cs':
                return handleCaseSensitive(message, parsed);
            
            case 'pronounseparator':
            case 'pronounsep':
            case 'psep':
                return handlePronounSeparator(message, parsed);
            
            case 'conditions':
            case 'condition':
                return handleConditions(message, parsed);
            
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
        if (targetUserId === message.author.id) 
            return utils.error(message, 'You don\'t have a system yet. Use `sys!system new [name]` to create one.');
        return utils.error(message, 'That user doesn\'t have a system.');
    }

    const embed = await buildSystemEmbed(system, parsed.full);
    return message.reply({ embeds: [embed] });
}

async function handleNew(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);

    if (system) return utils.error(message, 'You already have a profile. Use `sys!system delete` first if you want to create a new one.');

    // Get name from remaining positional args
    const name = parsed._positional.slice(1).join(' ') || null;

    // Create new system with proper sys_type (matches embedded app)
    const sysType = {
        name: 'None',
        dd: {},
        isSystem: false,
        isFragmented: false,
        isDissociative: false,
        onboardingCompleted: true,  // Important: marks onboarding as complete
    };

    const newSystem = new System({
        users: [user._id],
        name: name ? (() => {
            const idx = name.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || undefined;
            return { ...(idx && { indexable: idx }), display: name };
        })() : undefined,
        sys_type: sysType,
        metadata: {
            joinedAt: new Date()
        }
    });

    // Create privacy buckets (matches embedded app defaults)
    const strangersBucket = new PrivacyBucket({ name: 'Strangers', friends: [] });
    const friendsBucket = new PrivacyBucket({ name: 'Friends', friends: [] });
    await strangersBucket.save();
    await friendsBucket.save();
    newSystem.privacyBuckets = [strangersBucket._id, friendsBucket._id];

    // Set default privacy settings (matches embedded app)
    newSystem.setting = {
        friendAutoBucket: 'Friends',
        privacy: [
            {
                bucket: 'Strangers',
                settings: { mask: false, description: false, banner: false, avatar: false, birthday: false, pronouns: false, metadata: false, caution: false, hidden: true }
            },
            {
                bucket: 'Friends',
                settings: { mask: false, description: true, banner: true, avatar: true, birthday: false, pronouns: true, metadata: false, caution: false, hidden: false }
            }
        ]
    };

    await newSystem.save();

    user.systemID = newSystem._id;
    await user.save();

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.success)
        .setTitle('✅ Profile Created!')
        .setDescription(name 
            ? `Your profile **${name}** has been created.`
            : 'Your profile has been created.')
        .addFields(
            { name: 'Profile ID', value: `\`${newSystem._id}\``, inline: true },
            { name: 'Next Steps', value: 
                '• `sys!system displayname <name>` - Set display name\n' +
                '• `sys!system description <desc>` - Add description\n' +
                '• `sys!alter new <name>` - Create your first alter\n' +
                '• `sys!import simplyplural` - Import from Simply Plural\n' +
                '• `sys!import pluralkit` - Import from PluralKit', inline: false }
        );

    return message.reply({ embeds: [embed] });
}

async function handleRename(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.name = system.name || {};
        system.name.indexable = undefined;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        await proxyMessageHandler.invalidateDisplayCache(system._id);
        return utils.success(message, 'System indexable name cleared.');
    }

    const newName = parsed._positional.slice(1).join(' ');
    if (!newName) return utils.error(message, 'Please provide a new name: `sys!system rename <name>`');

    if (!utils.isValidIndexableName(newName)) 
        return utils.error(message, 'Indexable names can only contain letters, numbers, dashes, and underscores.');

    system.name = system.name || {};
    system.name.indexable = newName;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    await proxyMessageHandler.invalidateDisplayCache(system._id);

    return utils.success(message, `System indexable name set to **${newName}**`);
}

async function handleDisplayName(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        if (system.name) system.name.display = undefined;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        await proxyMessageHandler.invalidateDisplayCache(system._id);
        return utils.success(message, 'Profile display name cleared.');
    }

    const newName = parsed._positional.slice(1).join(' ');
    if (!newName) return utils.error(message, 'Please provide a display name: `sys!system displayname <name>`');

    system.name = system.name || {};
    system.name.display = newName;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    await proxyMessageHandler.invalidateDisplayCache(system._id);

    return utils.success(message, `Profile display name set to **${newName}**`);
}

async function handleDescription(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.description = undefined;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, 'Profile description cleared.');
    }

    const desc = parsed._positional.slice(1).join(' ') || parsed.description;
    if (!desc) return utils.error(message, 'Please provide a description: `sys!system description <text>`');

    system.description = desc;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

    return utils.success(message, 'Profile description updated.');
}

async function handleAvatar(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        if (system.avatar?.r2Key) await utils.deleteFromR2(system.avatar.r2Key, system.avatar.bucket || 'app');
        system.avatar = undefined;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        await proxyMessageHandler.invalidateDisplayCache(system._id);
        return utils.success(message, 'Profile avatar cleared.');
    }

    const attachment = message.attachments.first();
    const urlArg = parsed._positional[1] || parsed.avatar;

    const result = await utils.handlePrefixMediaUpload(attachment, urlArg, 'avatar', 'System', message.author.id, 'app');
    if (!result.success) return utils.error(message, result.message);
    if (system.avatar?.r2Key) await utils.deleteFromR2(system.avatar.r2Key, system.avatar.bucket || 'app');
    system.avatar = result.media;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    await proxyMessageHandler.invalidateDisplayCache(system._id);

    return utils.success(message, 'Profile avatar uploaded and updated.');
}

async function handleBanner(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const syncWithDiscord = system.syncWithApps?.discord;
    const bucket = utils.resolveUploadBucket(syncWithDiscord, 'discord');

    if (parsed.clear) {
        if (system.discord?.image?.banner?.r2Key) await utils.deleteFromR2(system.discord.image.banner.r2Key, system.discord.image.banner.bucket || 'app');
        if (system.discord?.image) system.discord.image.banner = undefined;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        await proxyMessageHandler.invalidateDisplayCache(system._id);
        return utils.success(message, 'Profile banner cleared.');
    }

    const attachment = message.attachments.first();
    const urlArg = parsed._positional[1] || parsed.banner;

    const result = await utils.handlePrefixMediaUpload(attachment, urlArg, 'banner', 'System', message.author.id, bucket);
    if (!result.success) return utils.error(message, result.message);
    if (system.discord?.image?.banner?.r2Key) await utils.deleteFromR2(system.discord.image.banner.r2Key, system.discord.image.banner.bucket || 'app');
    system.discord = system.discord || {};
    system.discord.image = system.discord.image || {};
    system.discord.image.banner = result.media;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    await proxyMessageHandler.invalidateDisplayCache(system._id);

    return utils.success(message, 'Profile banner uploaded and updated.');
}

async function handleColor(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.color = undefined;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, 'Profile color cleared.');
    }

    const colorInput = parsed._positional[1] || parsed.color;
    const color = utils.normalizeColor(colorInput);

    if (!color) return utils.error(message, 'Please provide a valid hex color: `sys!system color #FF0000`');

    system.color = color;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

    return utils.success(message, `Profile color set to **${color}**`);
}

async function handleTag(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.discord = system.discord || {};
        system.discord.tag = system.discord.tag || {};
        system.discord.tag.normal = [];
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, 'Profile tags cleared.');
    }

    const tagInput = parsed._positional.slice(1).join(' ') || parsed.tag;
    if (!tagInput) return utils.error(message, 'Please provide tag(s): `sys!system tag <tag1>, <tag2>, ...`');

    const tags = utils.parseList(tagInput);
    
    system.discord = system.discord || {};
    system.discord.tag = system.discord.tag || {};
    system.discord.tag.normal = tags;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

    return utils.success(message, `Profile tags set to: ${tags.map(t => `**${t}**`).join(', ')}`);
}

async function handleBirthday(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.birthday = undefined;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, 'Profile birthday cleared.');
    }

    const dateInput = parsed._positional[1] || parsed.birthday;
    if (!dateInput) return utils.error(message, 'Please provide a date (YYYY-MM-DD): `sys!system birthday 2020-01-15`');

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return utils.error(message, 'Invalid date format. Use YYYY-MM-DD.');

    system.birthday = date;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

    return utils.success(message, `Profile birthday set to **${utils.formatDate(date)}**`);
}

async function handleTimezone(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.timezone = undefined;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, 'Profile timezone cleared.');
    }

    const tz = parsed._positional[1] || parsed.timezone;
    if (!tz) return utils.error(message, 'Please provide a timezone: `sys!system timezone America/New_York`');

    system.timezone = tz;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

    return utils.success(message, `Profile timezone set to **${tz}**`);
}

async function handleType(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.sys_type = system.sys_type || {};
        system.sys_type.name = 'None';
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, 'Profile type cleared.');
    }

    const typeName = parsed._positional.slice(1).join(' ') || parsed.type;
    if (!typeName) return utils.error(message, 'Please provide a type name: `sys!system type <name>`');

    system.sys_type = system.sys_type || {};
    system.sys_type.name = typeName;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

    return utils.success(message, `Profile type set to **${typeName}**`);
}

async function handleDSM(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    if (parsed.clear) {
        system.sys_type = system.sys_type || {};
        system.sys_type.dd = system.sys_type.dd || {};
        system.sys_type.dd.DSM = undefined;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, 'DSM classification cleared.');
    }

    const dsmType = parsed._positional[1]?.toUpperCase() || parsed.dsm?.toUpperCase();
    if (!dsmType) return utils.error(message, `Please provide a DSM type: \`sys!system dsm <type>\`\nValid types: ${DSM_TYPES.join(', ')}`);

    if (!DSM_TYPES.includes(dsmType))
        return utils.error(message, `Invalid DSM type. Valid types: ${DSM_TYPES.join(', ')}`);

    system.sys_type = system.sys_type || {};
    system.sys_type.dd = system.sys_type.dd || {};
    system.sys_type.dd.DSM = dsmType;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

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
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, 'ICD classification cleared.');
    }

    const icdType = parsed._positional[1] || parsed.icd;
    if (!icdType) return utils.error(message, `Please provide an ICD type: \`sys!system icd <type>\`\nValid types: ${ICD_TYPES.join(', ')}`);

    if (!ICD_TYPES.includes(icdType))
        return utils.error(message, `Invalid ICD type. Valid types: ${ICD_TYPES.join(', ')}`);

    system.sys_type = system.sys_type || {};
    system.sys_type.dd = system.sys_type.dd || {};
    system.sys_type.dd.ICD = icdType;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

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
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, 'Alter synonyms reset to default (alter/alters).');
    }

    if (!singular) return utils.error(message, 'Please provide synonyms: `sys!system synonym <singular> <plural>`\nExample: `sys!system synonym headmate headmates`');

    system.alterSynonym = {
        singular: singular,
        plural: plural || singular + 's'
    };
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

    return utils.success(message, `Alter synonyms set to **${system.alterSynonym.singular}**/**${system.alterSynonym.plural}**`);
}

async function handlePrivacy(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    const firstArg = parsed._positional[1]?.toLowerCase();

    // Bucket CRUD sub-system
    if (firstArg === 'buckets' || firstArg === 'bucket') 
        return handlePrivacyBuckets(message, parsed, system);

    // Per-bucket field setting: sys!system privacy bucket:<name> <field> <public|private>
    if (firstArg && firstArg.startsWith('bucket:'))
        return handlePrivacyBucketField(message, parsed, system, firstArg.slice(7));

    // Default bucket field setting: sys!system privacy <field> <public|private>
    const field = firstArg;
    const value = parsed._positional[2]?.toLowerCase();

    if (!field) {
        const embed = new EmbedBuilder()
            .setColor(utils.ENTITY_COLORS.system)
            .setTitle('🔒 Privacy Settings')
            .setDescription('Use `sys!system privacy <field> <public|private>` to change.\nOr `sys!system privacy buckets list` to manage buckets.')
            .addFields(
                { name: 'Fields', value: '• description\n• avatar\n• banner\n• birthday\n• pronouns\n• metadata\n• caution\n• hidden\n• mask', inline: true },
                { name: 'Bucket Management', value: '`sys!system privacy buckets list`\n`sys!system privacy buckets create name:"Friends"`\n`sys!system privacy buckets delete name:"Friends" -confirm`', inline: true }
            );
        return message.reply({ embeds: [embed] });
    }

    const validFields = ['description', 'avatar', 'banner', 'birthday', 'pronouns', 'metadata', 'caution', 'hidden', 'mask'];
    if (!validFields.includes(field))
        return utils.error(message, `Invalid field. Valid fields: ${validFields.join(', ')}`);

    if (!value || !['public', 'private'].includes(value)) 
        return utils.error(message, 'Please specify `public` or `private`: `sys!system privacy description private`');

    system.setting = system.setting || {};
    system.setting.privacy = system.setting.privacy || [];
    
    await system.populate('privacyBuckets');
    let privacy = system.setting.privacy.find(p => p.bucket === 'Strangers') || system.setting.privacy.find(p => p.bucket === 'Friends') || system.setting.privacy[0];
    if (!privacy) {
        privacy = { bucket: 'Strangers', settings: {} };
        system.setting.privacy.push(privacy);
    }
    
    privacy.settings[field] = value === 'private';
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

    return utils.success(message, `**${field}** is now **${value}**`);
}

async function handlePrivacyBuckets(message, parsed, system) {
    const subcommand = parsed._positional[2]?.toLowerCase();
    const nameArg = parsed.name || parsed._positional.slice(3).join(' ');

    if (!subcommand || subcommand === 'list') {
        const buckets = system.privacyBuckets || [];
        if (!buckets.length) return utils.info(message, 'No privacy buckets created yet. Use `sys!system privacy buckets create name:"Friends"`');
        
        const bucketDocs = await PrivacyBucket.find({ _id: { $in: buckets } });
        const desc = bucketDocs.map(b => {
            const friendCount = b.friends?.length || 0;
            return `**${b.name}** — ${friendCount} friend(s)`;
        }).join('\n');
        return utils.info(message, `Privacy buckets:\n${desc}`);
    }

    if (subcommand === 'create' || subcommand === 'new') {
        if (!nameArg) return utils.error(message, 'Please provide a bucket name: `sys!system privacy buckets create name:"Close Friends"`');
        
        const existing = await PrivacyBucket.findOne({ name: nameArg });
        if (existing) return utils.error(message, `Bucket **${nameArg}** already exists.`);

        const bucket = new PrivacyBucket({
            _id: new mongoose.Types.ObjectId(),
            name: nameArg,
            friends: []
        });
        await bucket.save();

        system.privacyBuckets = system.privacyBuckets || [];
        system.privacyBuckets.push(bucket._id);
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

        return utils.success(message, `Privacy bucket **${nameArg}** created.`);
    }

    if (subcommand === 'delete' || subcommand === 'remove') {
        if (!nameArg) return utils.error(message, 'Please provide a bucket name.');
        if (!parsed.confirm) return utils.error(message, `⚠️ Delete bucket **${nameArg}**?\nConfirm: \`sys!system privacy buckets delete name:"${nameArg}" -confirm\``);

        const bucket = await PrivacyBucket.findOne({ name: nameArg });
        if (!bucket) return utils.error(message, `Bucket **${nameArg}** not found.`);

        // Remove from system
        system.privacyBuckets = (system.privacyBuckets || []).filter(id => id.toString() !== bucket._id.toString());
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

        // Remove privacy settings referencing this bucket
        system.setting = system.setting || {};
        system.setting.privacy = (system.setting.privacy || []).filter(p => p.bucket !== nameArg);
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

        // Delete bucket
        await PrivacyBucket.deleteOne({ _id: bucket._id });

        return utils.success(message, `Privacy bucket **${nameArg}** deleted.`);
    }

    if (subcommand === 'show' || subcommand === 'view') {
        if (!nameArg) return utils.error(message, 'Please provide a bucket name.');
        const bucket = await PrivacyBucket.findOne({ name: nameArg });
        if (!bucket) return utils.error(message, `Bucket **${nameArg}** not found.`);

        const friends = bucket.friends || [];
        const friendList = friends.length ? friends.map(f => {
            const parts = [];
            if (f.friendID) parts.push(`ID: ${f.friendID}`);
            if (f.discordUserID) parts.push(`<@${f.discordUserID}>`);
            if (f.discordGuildID) parts.push(`Guild: ${f.discordGuildID}`);
            return parts.join(' • ');
        }).join('\n') : '*No friends added*';

        const embed = new EmbedBuilder()
            .setColor(utils.ENTITY_COLORS.info)
            .setTitle(`🔒 Bucket: ${bucket.name}`)
            .addFields(
                { name: 'Friends', value: friendList, inline: false }
            );
        return message.reply({ embeds: [embed] });
    }

    if (subcommand === 'addfriend' || subcommand === 'add') {
        const bucketName = parsed.name || parsed._positional.slice(3).join(' ');
        if (!bucketName) return utils.error(message, 'Please provide a bucket name.');
        
        const bucket = await PrivacyBucket.findOne({ name: bucketName });
        if (!bucket) return utils.error(message, `Bucket **${bucketName}** not found.`);

        // Get user from mention
        const userMention = message.mentions.users.first();
        if (!userMention) return utils.error(message, 'Please mention a user to add: `sys!system privacy buckets addfriend name:"Friends" @User`');

        bucket.friends = bucket.friends || [];
        if (bucket.friends.find(f => f.discordUserID === userMention.id)) return utils.error(message, 'User is already in this bucket.');

        bucket.friends.push({
            friendID: '', // Will be set when they become a friend
            discordUserID: userMention.id,
            discordGuildID: message.guildId || ''
        });
        await bucket.save();

        return utils.success(message, `Added **${userMention.username}** to bucket **${bucketName}**.`);
    }

    if (subcommand === 'removefriend' || subcommand === 'remove') {
        const bucketName = parsed.name || parsed._positional.slice(3).join(' ');
        if (!bucketName) return utils.error(message, 'Please provide a bucket name.');
        
        const bucket = await PrivacyBucket.findOne({ name: bucketName });
        if (!bucket) return utils.error(message, `Bucket **${bucketName}** not found.`);

        const userMention = message.mentions.users.first();
        if (!userMention) return utils.error(message, 'Please mention a user to remove.');

        bucket.friends = bucket.friends || [];
        const idx = bucket.friends.findIndex(f => f.discordUserID === userMention.id);
        if (idx === -1) return utils.error(message, 'User is not in this bucket.');

        bucket.friends.splice(idx, 1);
        await bucket.save();

        return utils.success(message, `Removed **${userMention.username}** from bucket **${bucketName}**.`);
    }

    return utils.error(message, `Unknown bucket action: ${subcommand}. Use: list, create, delete, show, addfriend, removefriend`);
}

async function handlePrivacyBucketField(message, parsed, system, bucketName) {
    const field = parsed._positional[2]?.toLowerCase();
    const value = parsed._positional[3]?.toLowerCase();
    const validFields = ['description', 'avatar', 'banner', 'birthday', 'pronouns', 'metadata', 'caution', 'hidden', 'mask'];

    if (!field || !validFields.includes(field)) 
        return utils.error(message, `Invalid field. Valid: ${validFields.join(', ')}`);
    if (!value || !['public', 'private'].includes(value)) 
        return utils.error(message, 'Specify `public` or `private`.');

    system.setting = system.setting || {};
    system.setting.privacy = system.setting.privacy || [];
    
    let bucketPrivacy = system.setting.privacy.find(p => p.bucket === bucketName);
    if (!bucketPrivacy) {
        bucketPrivacy = { bucket: bucketName, settings: {} };
        system.setting.privacy.push(bucketPrivacy);
    }
    
    bucketPrivacy.settings[field] = value === 'private';
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });

    return utils.success(message, `**${field}** is now **${value}** in bucket **${bucketName}**`);
}

async function handleClosedName(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    if (parsed.clear) { system.name = system.name || {}; system.name.closedNameDisplay = undefined; await system.save(); 
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); await proxyMessageHandler.invalidateDisplayCache(system._id); return utils.success(message, 'Closed name display cleared.'); }
    const newName = parsed._positional.slice(1).join(' ');
    if (!newName) return utils.error(message, 'Please provide a closed name display.');
    system.name = system.name || {};
    system.name.closedNameDisplay = newName;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    await proxyMessageHandler.invalidateDisplayCache(system._id);
    return utils.success(message, `Closed name display set to **${newName}**`);
}

async function handleSync(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const val = parsed._positional[1]?.toLowerCase();
    if (!val || !['true', 'false', 'on', 'off', 'yes', 'no'].includes(val)) return utils.error(message, 'Specify `true` or `false`.');
    system.syncWithApps = system.syncWithApps || {};
    system.syncWithApps.discord = ['true', 'on', 'yes'].includes(val);
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    return utils.success(message, `Discord sync is now **${system.syncWithApps.discord ? 'enabled' : 'disabled'}**`);
}

async function handleAutoshare(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const val = parsed._positional[1]?.toLowerCase();
    if (!val || !['true', 'false', 'on', 'off', 'yes', 'no'].includes(val)) return utils.error(message, 'Specify `true` or `false`.');
    system.setting = system.setting || {};
    system.setting.autoshareNotestoUsers = ['true', 'on', 'yes'].includes(val);
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    return utils.success(message, `Auto-share notes is now **${system.setting.autoshareNotestoUsers ? 'enabled' : 'disabled'}**`);
}

async function handleCooldown(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const val = parseInt(parsed._positional[1]);
    if (isNaN(val) || val < 0) return utils.error(message, 'Please provide a cooldown in seconds (0+).');
    system.setting = system.setting || {};
    system.setting.proxyCoolDown = val;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    return utils.success(message, `Proxy cooldown set to **${val}s** (${Math.floor(val / 60)}m ${val % 60}s)`);
}

async function handleFriendAutoBucket(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    if (parsed.clear) { system.setting = system.setting || {}; system.setting.friendAutoBucket = undefined; await system.save(); 
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); return utils.success(message, 'Friend auto-bucket cleared.'); }
    const bucketName = parsed._positional.slice(1).join(' ');
    if (!bucketName) return utils.error(message, 'Please provide a bucket name.');
    system.setting = system.setting || {};
    system.setting.friendAutoBucket = bucketName;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    return utils.success(message, `Friend auto-bucket set to **${bucketName}**`);
}

async function handleProxyLayout(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const entityType = parsed._positional[1]?.toLowerCase();
    if (!entityType || !['alter', 'state', 'group'].includes(entityType)) return utils.error(message, 'Specify entity type: `alter`, `state`, or `group`.');
    if (parsed.clear) { system.discord = system.discord || {}; system.discord.proxylayout = system.discord.proxylayout || {}; system.discord.proxylayout[entityType] = undefined; await system.save(); 
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); return utils.success(message, `Proxy layout for ${entityType} cleared.`); }
    const layout = parsed._positional.slice(2).join(' ');
    if (!layout) return utils.error(message, 'Please provide a layout string. Use `{name}`, `{sys-name}`, `{pronouns}`, `{caution}`, `{tag1}`, etc.');
    system.discord = system.discord || {};
    system.discord.proxylayout = system.discord.proxylayout || {};
    system.discord.proxylayout[entityType] = layout;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    return utils.success(message, `Proxy layout for ${entityType} set to \`${layout}\``);
}

async function handleProxyBreak(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const val = parsed._positional[1]?.toLowerCase();
    if (!val || !['true', 'false', 'on', 'off', 'yes', 'no'].includes(val)) return utils.error(message, 'Specify `true` or `false`.');
    system.proxy = system.proxy || {};
    system.proxy.break = ['true', 'on', 'yes'].includes(val);
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    return utils.success(message, `Proxy break is now **${system.proxy.break ? 'active' : 'inactive'}**`);
}

async function handleFrontStatus(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    if (parsed.clear) { system.front = system.front || { layers: [] }; system.front.status = undefined; await system.save(); 
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); return utils.success(message, 'Front status cleared.'); }
    const status = parsed._positional.slice(1).join(' ');
    if (!status) return utils.error(message, 'Please provide a front status.');
    system.front = system.front || { layers: [] };
    system.front.status = status;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    return utils.success(message, `Front status set to **${status}**`);
}

async function handleBattery(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    if (parsed.clear) { system.battery = undefined; await system.save(); 
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); return utils.success(message, 'Battery cleared.'); }
    const val = parseInt(parsed._positional[1]);
    if (isNaN(val) || val < 0 || val > 100) return utils.error(message, 'Please provide a battery level (0-100).');
    system.battery = val;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    return utils.success(message, `Profile battery set to **${val}** ${utils.getBatteryEmoji(val)}`);
}

async function handleCaution(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    if (parsed.clear) { system.caution = undefined; await system.save(); 
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); return utils.success(message, 'Profile caution cleared.'); }
    const type = parsed._positional[1];
    const detail = parsed._positional.slice(2).join(' ');
    if (!type) return utils.error(message, 'Please provide a caution type.');
    system.caution = { c_type: type, detail: detail || undefined };
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    return utils.success(message, `Profile caution set to **${type}**`);
}

async function handleMask(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const field = parsed._positional[1]?.toLowerCase();
    if (!field) {
        const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.system).setTitle('🎭 Mask Settings')
            .setDescription(`Use \`sys!system mask <field> <value>\`\nFields: name, displayname (dn), description, color, avatar, banner, proxyavatar (pav), pronouns`)
            .addFields(
                { name: 'Current Mask', value: `Name: ${system.mask?.name?.display || system.mask?.name?.indexable || '*not set*'}\nColor: ${system.mask?.color || '*not set*'}\nDescription: ${system.mask?.description || '*not set*'}\nPronouns: ${system.mask?.pronouns || '*not set*'}`, inline: false }
            );
        return message.reply({ embeds: [embed] });
    }
    system.mask = system.mask || {};
    if (field === 'name') {
        const val = parsed._positional.slice(2).join(' ');
        if (!val) return utils.error(message, 'Please provide a mask name.');
        system.mask.name = system.mask.name || {};
        system.mask.name.indexable = val.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || undefined;
        system.mask.name.display = val;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        await proxyMessageHandler.invalidateDisplayCache(system._id);
        return utils.success(message, `Mask name set to **${val}**`);
    }
    if (field === 'displayname' || field === 'dn') {
        if (parsed.clear) { system.mask.name = system.mask.name || {}; system.mask.name.display = undefined; await system.save(); 
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); await proxyMessageHandler.invalidateDisplayCache(system._id); return utils.success(message, 'Mask display name cleared.'); }
        const val = parsed._positional.slice(2).join(' ');
        if (!val) return utils.error(message, 'Please provide a mask display name.');
        system.mask.name = system.mask.name || {};
        system.mask.name.display = val;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        await proxyMessageHandler.invalidateDisplayCache(system._id);
        return utils.success(message, `Mask display name set to **${val}**`);
    }
    if (field === 'description' || field === 'desc') {
        if (parsed.clear) { system.mask.description = undefined; await system.save(); 
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); return utils.success(message, 'Mask description cleared.'); }
        const val = parsed._positional.slice(2).join(' ');
        if (!val) return utils.error(message, 'Please provide a mask description.');
        system.mask.description = val;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, 'Mask description updated.');
    }
    if (field === 'color' || field === 'colour') {
        if (parsed.clear) { system.mask.color = undefined; await system.save(); 
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); return utils.success(message, 'Mask color cleared.'); }
        const val = utils.normalizeColor(parsed._positional[2]);
        if (!val) return utils.error(message, 'Please provide a valid hex color.');
        system.mask.color = val;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, `Mask color set to **${val}**`);
    }
    if (field === 'pronouns' || field === 'prns') {
        if (parsed.clear) { system.mask.pronouns = undefined; await system.save(); 
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); return utils.success(message, 'Mask pronouns cleared.'); }
        const val = parsed._positional.slice(2).join(' ');
        if (!val) return utils.error(message, 'Please provide mask pronouns.');
        system.mask.pronouns = val;
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, `Mask pronouns set to **${val}**`);
    }
    if (field === 'avatar' || field === 'icon' || field === 'av' || field === 'pfp') {
        if (parsed.clear) { system.mask.avatar = undefined; await system.save(); 
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); await proxyMessageHandler.invalidateDisplayCache(system._id); return utils.success(message, 'Mask avatar cleared.'); }
        const url = message.attachments.first()?.url || parsed._positional[2];
        if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
        system.mask.avatar = { url };
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        await proxyMessageHandler.invalidateDisplayCache(system._id);
        return utils.success(message, 'Mask avatar updated.');
    }
    if (field === 'banner') {
        if (parsed.clear) { system.mask.discord = system.mask.discord || {}; system.mask.discord.image = system.mask.discord.image || {}; system.mask.discord.image.banner = undefined; await system.save(); 
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); await proxyMessageHandler.invalidateDisplayCache(system._id); return utils.success(message, 'Mask banner cleared.'); }
        const url = message.attachments.first()?.url || parsed._positional[2];
        if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
        system.mask.discord = system.mask.discord || {};
        system.mask.discord.image = system.mask.discord.image || {};
        system.mask.discord.image.banner = { url };
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        await proxyMessageHandler.invalidateDisplayCache(system._id);
        return utils.success(message, 'Mask banner updated.');
    }
    if (field === 'proxyavatar' || field === 'pav') {
        if (parsed.clear) { system.mask.discord = system.mask.discord || {}; system.mask.discord.image = system.mask.discord.image || {}; system.mask.discord.image.proxyAvatar = undefined; await system.save(); 
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); await proxyMessageHandler.invalidateDisplayCache(system._id); return utils.success(message, 'Mask proxy avatar cleared.'); }
        const url = message.attachments.first()?.url || parsed._positional[2];
        if (!url) return utils.error(message, 'Please provide a URL.');
        system.mask.discord = system.mask.discord || {};
        system.mask.discord.image = system.mask.discord.image || {};
        system.mask.discord.image.proxyAvatar = { url };
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        await proxyMessageHandler.invalidateDisplayCache(system._id);
        return utils.success(message, 'Mask proxy avatar updated.');
    }
    return utils.error(message, `Unknown mask field: ${field}. Use: name, displayname, description, color, pronouns, avatar, banner, proxyavatar`);
}

async function handleProxyStyle(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const val = parsed._positional.slice(1).join(' ');
    if (!val) {
        const current = system.proxy?.style || 'off';
        return utils.info(message, `Current proxy style: **${current}**\nOptions: \`off\`, \`last\`, \`front\`, or an entity name.\nUsage: \`sys!system proxystyle <style>\``);
    }
    if (parsed.clear) { system.proxy = system.proxy || {}; system.proxy.style = 'off'; await system.save(); 
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); return utils.success(message, 'Proxy style reset to **off**.'); }
    system.proxy = system.proxy || {};
    system.proxy.style = val;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    return utils.success(message, `Proxy style set to **${val}**`);
}

async function handleReplyStyle(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const val = parsed._positional[1]?.toLowerCase();
    if (!val || !['embed', 'native'].includes(val)) {
        const current = system.proxy?.replyStyle || 'embed';
        return utils.info(message, `Current reply style: **${current}**\nOptions: \`embed\`, \`native\`.\nUsage: \`sys!system replystyle <style>\``);
    }
    system.proxy = system.proxy || {};
    system.proxy.replyStyle = val;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    if (val === 'embed') return utils.success(message, 'Reply style set to **embed**. Proxied replies will use a custom embed.');
    if (val === 'native') return utils.success(message, 'Reply style set to **native**. Proxied replies will use Discord\'s built-in reply feature.');
}

async function handleCaseSensitive(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const val = parsed._positional[1]?.toLowerCase();
    if (!val || !['true', 'false', 'on', 'off', 'yes', 'no'].includes(val)) {
        const current = system.proxy?.caseSensitive ? 'on' : 'off';
        return utils.info(message, `Case sensitivity is currently **${current}**.\nUsage: \`sys!system casesensitive <true|false>\``);
    }
    system.proxy = system.proxy || {};
    system.proxy.caseSensitive = ['true', 'on', 'yes'].includes(val);
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    return utils.success(message, `Case sensitivity is now **${system.proxy.caseSensitive ? 'on' : 'off'}**`);
}

async function handlePronounSeparator(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    if (parsed.clear) { system.discord = system.discord || {}; system.discord.pronounSeparator = undefined; await system.save(); 
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() }); return utils.success(message, 'Pronoun separator cleared.'); }
    const sep = parsed._positional.slice(1).join(' ');
    if (!sep) {
        const current = system.discord?.pronounSeparator || '/';
        return utils.info(message, `Current pronoun separator: **${current}**\nUsage: \`sys!system pronounseparator <char>\``);
    }
    system.discord = system.discord || {};
    system.discord.pronounSeparator = sep;
    await system.save();
    if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
    return utils.success(message, `Pronoun separator set to **${sep}**`);
}

async function handleConditions(message, parsed) {
    const { user, system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const entityType = parsed._positional[1]?.toLowerCase();
    if (!entityType || !['alter', 'state', 'group'].includes(entityType)) return utils.error(message, 'Specify entity type: `alter`, `state`, or `group`.');
    const action = parsed._positional[2]?.toLowerCase();
    if (!action || action === 'list') {
        const conditions = system[entityType === 'alter' ? 'alters' : entityType === 'state' ? 'states' : 'groups']?.conditions || [];
        if (!conditions.length) return utils.info(message, `No ${entityType} conditions set.`);
        const desc = conditions.map(c => `**${c.name}** (hide: ${c.settings?.hide_to_self ? 'yes' : 'no'}, count: ${c.settings?.include_in_Count ? 'yes' : 'no'})`).join('\n');
        return utils.info(message, `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} conditions:\n${desc}`);
    }
    if (action === 'new') {
        const name = parsed._positional.slice(3).join(' ');
        if (!name) return utils.error(message, 'Please provide a condition name.');
        const container = system[entityType === 'alter' ? 'alters' : entityType === 'state' ? 'states' : 'groups'];
        container.conditions = container.conditions || [];
        if (container.conditions.find(c => c.name?.toLowerCase() === name.toLowerCase())) return utils.error(message, `Condition **${name}** already exists.`);
        container.conditions.push({ name, settings: { hide_to_self: false, include_in_Count: true } });
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, `Condition **${name}** added for ${entityType}.`);
    }
    if (action === 'delete') {
        const name = parsed._positional.slice(3).join(' ');
        if (!name) return utils.error(message, 'Please provide a condition name.');
        const container = system[entityType === 'alter' ? 'alters' : entityType === 'state' ? 'states' : 'groups'];
        container.conditions = container.conditions || [];
        const idx = container.conditions.findIndex(c => c.name?.toLowerCase() === name.toLowerCase());
        if (idx === -1) return utils.error(message, `Condition **${name}** not found.`);
        container.conditions.splice(idx, 1);
        await system.save();
        if (system?._id) publishEvent(system._id.toString(), { type: 'system:updated', systemId: system._id.toString() });
        return utils.success(message, `Condition **${name}** deleted for ${entityType}.`);
    }
    return utils.error(message, `Unknown action: ${action}. Use: list, new, delete`);
}

async function handleList(message, parsed) {
    const { user, system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) {
        return utils.error(message, targetUserId === message.author.id 
            ? 'Not registered yet.' 
            : 'That user doesn\'t have a system.');
    }

    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });

    if (alters.length === 0) 
        return utils.info(message, `No ${system.alterSynonym?.plural || 'alters'} found.`);

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.system)
        .setTitle(`${system.alterSynonym?.plural || 'Alters'} (${alters.length})`);

    if (parsed.full) {
        // Full list with more details
        let desc = '';
        for (const alter of alters.slice(0, 25)) { // Limit to 25 to avoid embed limits
            const name = alter.name?.display || alter.name?.indexable || '(no name)';
            const proxies = alter.proxy?.length > 0 ? ` • ${alter.proxy[0]}` : '';
            desc += `**${name}** (\`${alter.name?.indexable || alter._id}\`)${proxies}\n`;
        }
        if (alters.length > 25) 
            desc += `\n*...and ${alters.length - 25} more*`;
        embed.setDescription(desc);
    } else {
        // Compact list
        const names = alters.map(a => a.name?.display || a.name?.indexable || '(no name)');
        embed.setDescription(names.join(', '));
    }

    return message.reply({ embeds: [embed] });
}

async function handleFronter(message, parsed) {
    const { user, system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) {
        return utils.error(message, targetUserId === message.author.id 
            ? 'Not registered yet.' 
            : 'That user doesn\'t have a system.');
    }

    const frontLayers = system.front?.layers || [];
    if (frontLayers.length === 0)
        return utils.info(message, 'No fronters currently registered.');

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.system)
        .setTitle('🎭 Current Front');

    for (const layer of frontLayers) {
        const shiftIds = layer.shifts || [];
        if (shiftIds.length === 0) continue;

        const fronterLines = [];
        for (const shiftId of shiftIds) {
            const shift = await Shift.findById(shiftId);
            if (!shift) continue;

            let entity = null;
            if (shift.s_type === 'alter') entity = await Alter.findById(shift.ID);
            else if (shift.s_type === 'state') entity = await State.findById(shift.ID);
            else if (shift.s_type === 'group') entity = await Group.findById(shift.ID);

            const name = entity?.name?.display || entity?.name?.indexable || shift.type_name || '(no name)';
            const lastStatus = shift.statuses?.[shift.statuses.length - 1];
            let line = name;
            if (lastStatus?.status) line += ` — *${lastStatus.status}*`;
            if (lastStatus?.battery != null) line += ` ${utils.getBatteryEmoji(lastStatus.battery)}`;
            fronterLines.push(line);
        }

        if (fronterLines.length > 0) {
            embed.addFields({
                name: layer.name || 'Main',
                value: fronterLines.join('\n'),
                inline: false
            });
        }
    }

    // Show front status if set
    if (system.front?.status) embed.addFields({ name: 'Status', value: system.front.status, inline: true });
    if (system.front?.caution) embed.addFields({ name: 'Caution', value: system.front.caution, inline: true });

    return message.reply({ embeds: [embed] });
}

async function handleFrontHistory(message, parsed) {
    const { user, system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) {
        return utils.error(message, targetUserId === message.author.id 
            ? 'Not registered yet.' 
            : 'That user doesn\'t have a system.');
    }

    // TODO: Implement front history tracking
    return utils.info(message, 'Front history feature coming soon!');
}

async function handleDelete(message, parsed) {
    //const { user, system } = await utils.getOrCreateUserAndSystem(message);
    //if (!await utils.requireSystem(message, system)) return;

    // Require confirmation
    if (!parsed.confirm) {
        return utils.error(message, 
            '⚠️ **Warning:** This will permanently delete your system and all associated data (alters, states, groups).\n\n' +
            'To confirm, use: `sys!system delete -confirm`'
        );
    }

    // Look up user directly — don't use getOrCreateUserAndSystem (it may create a new one)
    const discordId = message.author.id;
    const user = await User.findOne({ discordID: discordId });

    if (!user || !user.systemID) return utils.error(message, 'Not registered yet.');

    const system = await System.findById(user.systemID);
    if (!system) {
        // System missing but user has a dangling reference — clean it up
        user.systemID = null;
        await user.save();
        return utils.error(message, 'Not registered. Your account has been cleaned up.');
    }

    // Delete all associated entities
    await Alter.deleteMany({ _id: { $in: system.alters?.IDs || [] } });
    await State.deleteMany({ _id: { $in: system.states?.IDs || [] } });
    await Group.deleteMany({ _id: { $in: system.groups?.IDs || [] } });
    
    // Delete the system
    await System.deleteOne({ _id: system._id });
    
    // Unlink user
    user.systemID = null;
    await user.save();

    return utils.success(message, 'Your profile has been deleted. Thank you for using Systemiser and good luck on your mental health journey 💙');
}

async function handleId(message, parsed) {
    const { user, system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) {
        return utils.error(message, targetUserId === message.author.id 
            ? 'Not registered yet.' 
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
            { usage: 'sys!system closedname <name>', description: 'Set closed name display' },
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
            { usage: 'sys!system privacy <field> <pub|priv>', description: 'View/edit privacy settings' },
            { usage: 'sys!system privacy buckets list', description: 'List privacy buckets' },
            { usage: 'sys!system privacy buckets create name:"N"', description: 'Create privacy bucket' },
            { usage: 'sys!system privacy buckets delete name:"N" -confirm', description: 'Delete privacy bucket' },
            { usage: 'sys!system privacy buckets addfriend name:"N" @User', description: 'Add friend to bucket' },
            { usage: 'sys!system privacy buckets removefriend name:"N" @User', description: 'Remove friend from bucket' },
            { usage: 'sys!system privacy bucket:<name> <field> <pub|priv>', description: 'Set per-bucket privacy' },
            { usage: 'sys!system sync <true|false>', description: 'Toggle Discord sync' },
            { usage: 'sys!system autoshare <true|false>', description: 'Toggle auto-share notes' },
            { usage: 'sys!system cooldown <seconds>', description: 'Set proxy cooldown' },
            { usage: 'sys!system friendautobucket <name>', description: 'Set friend auto-bucket' },
            { usage: 'sys!system proxylayout <type> <layout>', description: 'Set proxy layout' },
            { usage: 'sys!system proxybreak <true|false>', description: 'Toggle proxy break' },
            { usage: 'sys!system frontstatus <status>', description: 'Set front status' },
            { usage: 'sys!system battery <0-100>', description: 'Set system battery' },
            { usage: 'sys!system caution <type> [detail]', description: 'Set system caution' },
            { usage: 'sys!system mask <field> <value>', description: 'Edit mask mode settings' },
            { usage: 'sys!system conditions <type> list|new|delete', description: 'Manage conditions' },
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
    const displayName = system.name?.display || system.name?.indexable || '';
    const indexableName = system.name?.indexable;

    if (indexableName) embed.setAuthor({ name: indexableName, iconURL: system.avatar?.url });
    embed.setTitle(displayName);

    if (system.description) embed.setDescription(system.description);

    // Avatar
    if (system.avatar?.url) embed.setThumbnail(system.avatar.url);

    // Banner
    if (system.discord?.image?.banner?.url) embed.setImage(system.discord.image.banner.url);

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
    
    if (personalInfo) embed.addFields({ name: '👤 Personal', value: personalInfo.trim(), inline: true });

    // Tags
    const tags = system.discord?.tag?.normal;
    if (tags && tags.length > 0) embed.addFields({ name: '🏷️ Tags', value: tags.join(' '), inline: true });

    // System ID footer
    //embed.setFooter({ text: `System ID: ${system._id}` });

    return embed;
}