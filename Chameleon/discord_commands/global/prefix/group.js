// sys!group - Group management prefix command
// Groups are collections of alters and/or states
//
// USAGE:
//   sys!group <n>                              - View a group
//   sys!group new <n>                          - Create a group
//   sys!group list [-full]                     - List all groups
//   sys!group <n> displayname|dn <name>        - Set display name
//   sys!group <n> closedname|cn <name>         - Set closed name display
//   sys!group <n> description <text>           - Set description
//   sys!group <n> type <name>                  - Set group type
//   sys!group <n> canfront <yes|no>            - Toggle can front
//   sys!group <n> avatar|banner <url>          - Set media
//   sys!group <n> add <member>...              - Add members
//   sys!group <n> remove <member>...           - Remove members
//   sys!group <n> members                      - List members
//   sys!group <n> random                       - Show random member
//   sys!group <n> proxy add|remove <tag>       - Manage proxies
//   sys!group <n> sync <true|false>            - Toggle Discord sync
//   sys!group <n> defaultstatus <s>            - Set default shift status
//   sys!group <n> defaultbattery <0-100>       - Set default shift battery
//   sys!group <n> caution <type> [detail]      - Set caution
//   sys!group <n> triggers add|remove <text>   - Manage triggers
//   sys!group <n> mask <field> <value>         - Edit mask mode
//   sys!group <n> privacy <field> <pub|priv>   - Set privacy
//   sys!group <n> privacy bucket:<name> <f> <v> - Per-bucket privacy
//   sys!group <n> delete -confirm              - Delete group

const { EmbedBuilder } = require('discord.js');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const utils = require('../../functions/bot_utils');

const { getSystemTerm } = utils;

module.exports = {
    name: 'group',
    aliases: ['g'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        const firstArg = parsed._positional[0]?.toLowerCase();

        if (firstArg === 'new' || firstArg === 'create') return handleNew(message, parsed);
        if (firstArg === 'list') return handleList(message, parsed);
        if (firstArg === 'help' || !firstArg) return handleHelp(message);

        const groupName = parsed._positional[0];
        const subcommand = parsed._positional[1]?.toLowerCase();

        const handlers = {
            'rename': handleRename, 'name': handleRename,
            'displayname': handleDisplayName, 'dn': handleDisplayName,
            'closedname': handleClosedName, 'cn': handleClosedName,
            'description': handleDescription, 'desc': handleDescription,
            'avatar': handleAvatar, 'icon': handleAvatar, 'av': handleAvatar,
            'banner': handleBanner,
            'color': handleColor, 'colour': handleColor,
            'proxy': handleProxy,
            'signoff': handleSignoff, 'sign': handleSignoff,
            'aliases': handleAliases, 'alias': handleAliases,
            'add': handleAdd,
            'remove': handleRemove,
            'members': handleMembers, 'list': handleMemberList,
            'type': handleType,
            'canfront': handleCanFront, 'cf': handleCanFront,
            'caution': handleCaution,
            'triggers': handleTriggers, 'trigger': handleTriggers,
            'privacy': handlePrivacy,
            'sync': handleSync,
            'defaultstatus': handleDefaultStatus, 'ds': handleDefaultStatus,
            'defaultbattery': handleDefaultBattery, 'db': handleDefaultBattery,
            'mask': handleMask,
            'delete': handleDelete,
            'random': handleRandom,
            'id': handleId
        };

        if (handlers[subcommand]) return handlers[subcommand](message, parsed, groupName);
        return handleShow(message, parsed, groupName);
    }
};

async function getGroup(message, groupName) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!system) { await utils.error(message, 'You don\'t have a system yet.'); return { group: null, system: null }; }
    const result = await utils.findEntity(groupName, system, 'group');
    if (!result) { await utils.error(message, `Group **${groupName}** not found.`); return { group: null, system }; }
    return { group: result.entity, system };
}

async function handleShow(message, parsed, groupName) {
    const { system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) return utils.error(message, targetUserId === message.author.id ? 'Not registered yet.' : 'Not registered.');
    const result = await utils.findEntity(groupName, system, 'group');
    if (!result) return utils.error(message, `Group **${groupName}** not found.`);
    const embed = await buildGroupEmbed(result.entity, system);
    return message.reply({ embeds: [embed] });
}

async function handleNew(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;
    const name = parsed._positional.slice(1).join(' ');
    if (!name) return utils.error(message, 'Please provide a name: `sys!group new <n>`');
    const indexable = name.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || undefined;

    if (indexable) {
        const existing = await utils.findEntity(indexable, system, 'group');
        if (existing) return utils.error(message, `A group with the name **${indexable}** already exists.`);
    }

    const group = new Group({
        systemID: system._id,
        name: { ...(indexable && { indexable }), display: name },
        addedAt: new Date(),
        memberIDs: []
    });
    await group.save();

    system.groups = system.groups || { IDs: [] };
    system.groups.IDs.push(group._id);
    await system.save();

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.success)
        .setTitle('✅ Group Created!')
        .setDescription(`**${name}** has been created.`)
        .addFields({ name: 'ID', value: `\`${group._id}\``, inline: true });
    return message.reply({ embeds: [embed] });
}

async function handleRename(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    const newName = parsed._positional.slice(2).join(' ');
    if (!newName) return utils.error(message, 'Please provide a new name.');
    if (!utils.isValidIndexableName(newName)) return utils.error(message, 'Invalid indexable name format.');
    group.name.indexable = newName;
    await group.save();
    return utils.success(message, `Indexable name changed to **${newName}**`);
}

async function handleDisplayName(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    if (parsed.clear) { group.name.display = undefined; await group.save(); return utils.success(message, 'Display name cleared.'); }
    const newName = parsed._positional.slice(2).join(' ');
    if (!newName) return utils.error(message, 'Please provide a display name.');
    group.name.display = newName;
    await group.save();
    return utils.success(message, `Display name set to **${newName}**`);
}

async function handleDescription(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    if (parsed.clear) { group.description = undefined; await group.save(); return utils.success(message, 'Description cleared.'); }
    const desc = parsed._positional.slice(2).join(' ');
    if (!desc) return utils.error(message, 'Please provide a description.');
    group.description = desc;
    await group.save();
    return utils.success(message, 'Description updated.');
}

async function handleAvatar(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    if (parsed.clear) { if (group.avatar?.r2Key) await utils.deleteFromR2(group.avatar.r2Key, group.avatar.bucket || 'app'); group.avatar = undefined; await group.save(); return utils.success(message, 'Avatar cleared.'); }
    const attachment = message.attachments.first();
    const urlArg = parsed._positional[2];
    const result = await utils.handlePrefixMediaUpload(attachment, urlArg, 'avatar', 'Group', message.author.id, 'app');
    if (!result.success) return utils.error(message, result.message);
    if (group.avatar?.r2Key) await utils.deleteFromR2(group.avatar.r2Key, group.avatar.bucket || 'app');
    group.avatar = result.media;
    await group.save();
    return utils.success(message, 'Avatar uploaded and updated.');
}

async function handleBanner(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    const syncWithDiscord = group.syncWithApps?.discord;
    const bucket = utils.resolveUploadBucket(syncWithDiscord, 'discord');
    if (parsed.clear) { if (group.discord?.image?.banner?.r2Key) await utils.deleteFromR2(group.discord.image.banner.r2Key, group.discord.image.banner.bucket || 'app'); if (group.discord?.image) group.discord.image.banner = undefined; await group.save(); return utils.success(message, 'Banner cleared.'); }
    const attachment = message.attachments.first();
    const urlArg = parsed._positional[2];
    const result = await utils.handlePrefixMediaUpload(attachment, urlArg, 'banner', 'Group', message.author.id, bucket);
    if (!result.success) return utils.error(message, result.message);
    if (group.discord?.image?.banner?.r2Key) await utils.deleteFromR2(group.discord.image.banner.r2Key, group.discord.image.banner.bucket || 'app');
    group.discord = group.discord || {}; group.discord.image = group.discord.image || {};
    group.discord.image.banner = result.media;
    await group.save();
    return utils.success(message, 'Banner uploaded and updated.');
}

async function handleColor(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    if (parsed.clear) { group.color = undefined; await group.save(); return utils.success(message, 'Color cleared.'); }
    const color = utils.normalizeColor(parsed._positional[2]);
    if (!color) return utils.error(message, 'Please provide a valid hex color.');
    group.color = color;
    await group.save();
    return utils.success(message, `Color set to **${color}**`);
}

async function handleProxy(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    const action = parsed._positional[2]?.toLowerCase();
    if (parsed.clear || action === 'clear') { group.proxy = []; await group.save(); return utils.success(message, 'Proxy tags cleared.'); }
    if (action === 'add') {
        const tag = parsed._positional.slice(3).join(' ');
        if (!tag) return utils.error(message, 'Please provide a proxy tag.');
        group.proxy = group.proxy || []; group.proxy.push(tag); await group.save();
        return utils.success(message, `Proxy tag \`${tag}\` added.`);
    }
    if (action === 'remove') {
        const tag = parsed._positional.slice(3).join(' ');
        group.proxy = group.proxy || [];
        const idx = group.proxy.findIndex(p => p.toLowerCase() === tag.toLowerCase());
        if (idx === -1) return utils.error(message, 'Proxy tag not found.');
        group.proxy.splice(idx, 1); await group.save();
        return utils.success(message, 'Proxy tag removed.');
    }
    const tag = parsed._positional.slice(2).join(' ');
    if (!tag) {
        const proxies = group.proxy || [];
        return proxies.length ? utils.info(message, `Proxy tags: ${utils.formatProxies(proxies)}`) : utils.info(message, 'No proxy tags set.');
    }
    group.proxy = [tag]; await group.save();
    return utils.success(message, `Proxy tag set to \`${tag}\``);
}

async function handleSignoff(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    if (parsed.clear) { group.signoff = undefined; await group.save(); return utils.success(message, 'Sign-offs cleared.'); }
    const input = parsed._positional.slice(2).join(' ');
    if (!input) return utils.error(message, 'Please provide sign-offs.');
    group.signoff = utils.parseList(input).join('\n');
    await group.save();
    return utils.success(message, 'Sign-offs updated.');
}

async function handleAliases(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    const action = parsed._positional[2]?.toLowerCase();
    if (parsed.clear || action === 'clear') { group.name.aliases = []; await group.save(); return utils.success(message, 'Aliases cleared.'); }
    if (action === 'add') {
        const alias = parsed._positional.slice(3).join(' ');
        if (!alias) return utils.error(message, 'Please provide an alias.');
        group.name.aliases = group.name.aliases || []; group.name.aliases.push(alias); await group.save();
        return utils.success(message, `Alias **${alias}** added.`);
    }
    if (action === 'remove') {
        const alias = parsed._positional.slice(3).join(' ');
        group.name.aliases = group.name.aliases || [];
        const idx = group.name.aliases.findIndex(a => a.toLowerCase() === alias.toLowerCase());
        if (idx === -1) return utils.error(message, 'Alias not found.');
        group.name.aliases.splice(idx, 1); await group.save();
        return utils.success(message, 'Alias removed.');
    }
    const aliases = group.name?.aliases || [];
    return aliases.length ? utils.info(message, `Aliases: ${aliases.join(', ')}`) : utils.info(message, 'No aliases set.');
}

async function handleAdd(message, parsed, groupName) {
    const { group, system } = await getGroup(message, groupName);
    if (!group) return;
    // Can add multiple members: sys!group mygroup add luna stella
    const memberNames = parsed._positional.slice(2);
    if (!memberNames.length) return utils.error(message, 'Please provide member name(s): `sys!group <group> add <member> [member2] ...`');
    
    const added = [];
    const failed = [];
    
    for (const memberName of memberNames) {
        const result = await utils.findEntity(memberName, system); // Can be alter, state, or group
        if (!result) { failed.push(memberName); continue; }
        
        group.memberIDs = group.memberIDs || [];
        if (group.memberIDs.includes(result.entity._id)) { failed.push(`${memberName} (already in group)`); continue; }
        
        group.memberIDs.push(result.entity._id);
        
        // Also update the entity's groups
        if (result.type === 'alter') {
            result.entity.groupsIDs = result.entity.groupsIDs || [];
            if (!result.entity.groupsIDs.includes(group._id)) {
                result.entity.groupsIDs.push(group._id);
                await result.entity.save();
            }
        } else if (result.type === 'state') {
            result.entity.groupIDs = result.entity.groupIDs || [];
            if (!result.entity.groupIDs.includes(group._id)) {
                result.entity.groupIDs.push(group._id);
                await result.entity.save();
            }
        }
        
        added.push(result.entity.name?.display || memberName);
    }
    
    await group.save();
    
    let response = '';
    if (added.length) response += `✅ Added: ${added.join(', ')}\n`;
    if (failed.length) response += `❌ Failed: ${failed.join(', ')}`;
    
    return message.reply(response.trim());
}

async function handleRemove(message, parsed, groupName) {
    const { group, system } = await getGroup(message, groupName);
    if (!group) return;
    const memberNames = parsed._positional.slice(2);
    if (!memberNames.length) return utils.error(message, 'Please provide member name(s).');
    
    const removed = [];
    const failed = [];
    
    for (const memberName of memberNames) {
        const result = await utils.findEntity(memberName, system);
        if (!result) { failed.push(memberName); continue; }
        
        group.memberIDs = group.memberIDs || [];
        const idx = group.memberIDs.indexOf(result.entity._id);
        if (idx === -1) { failed.push(`${memberName} (not in group)`); continue; }
        
        group.memberIDs.splice(idx, 1);
        
        // Also update the entity's groups
        if (result.type === 'alter') {
            result.entity.groupsIDs = result.entity.groupsIDs?.filter(id => id !== group._id) || [];
            await result.entity.save();
        } else if (result.type === 'state') {
            result.entity.groupIDs = result.entity.groupIDs?.filter(id => id !== group._id) || [];
            await result.entity.save();
        }
        
        removed.push(result.entity.name?.display || memberName);
    }
    
    await group.save();
    
    let response = '';
    if (removed.length) response += `✅ Removed: ${removed.join(', ')}\n`;
    if (failed.length) response += `❌ Failed: ${failed.join(', ')}`;
    
    return message.reply(response.trim());
}

async function handleMembers(message, parsed, groupName) {
    return handleMemberList(message, parsed, groupName);
}

async function handleMemberList(message, parsed, groupName) {
    const { group, system } = await getGroup(message, groupName);
    if (!group) return;
    
    const memberIDs = group.memberIDs || [];
    if (!memberIDs.length) return utils.info(message, 'No members in this group.');
    
    // Fetch all possible member types
    const alters = await Alter.find({ _id: { $in: memberIDs } });
    const states = await State.find({ _id: { $in: memberIDs } });
    const subgroups = await Group.find({ _id: { $in: memberIDs } });
    
    const members = [
        ...alters.map(a => ({ name: a.name?.display || a.name?.indexable, type: 'alter' })),
        ...states.map(s => ({ name: s.name?.display || s.name?.indexable, type: 'state' })),
        ...subgroups.map(g => ({ name: g.name?.display || g.name?.indexable, type: 'group' }))
    ];
    
    const embed = new EmbedBuilder()
        .setColor(group.color || utils.ENTITY_COLORS.group)
        .setTitle(`${group.name?.display || group.name?.indexable} Members (${members.length})`);
    
    if (parsed.full) {
        const desc = members.map(m => `**${m.name}** (${m.type})`).join('\n');
        embed.setDescription(desc.slice(0, 4000));
    } else {
        embed.setDescription(members.map(m => m.name).join(', '));
    }
    
    return message.reply({ embeds: [embed] });
}

async function handleType(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    if (parsed.clear) { group.type = undefined; await group.save(); return utils.success(message, 'Type cleared.'); }
    const typeName = parsed._positional.slice(2).join(' ');
    if (!typeName) return utils.error(message, 'Please provide a type.');
    group.type = group.type || {};
    group.type.name = typeName;
    await group.save();
    return utils.success(message, `Type set to **${typeName}**`);
}

async function handleCanFront(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    const val = parsed._positional[2]?.toLowerCase();
    if (!val || !['yes', 'no', 'true', 'false'].includes(val)) return utils.error(message, 'Specify `yes` or `no`.');
    group.type = group.type || {};
    group.type.canFront = ['yes', 'true'].includes(val) ? 'yes' : 'no';
    await group.save();
    return utils.success(message, `Group can front: **${group.type.canFront}**`);
}

async function handleCaution(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    if (parsed.clear) { group.caution = undefined; await group.save(); return utils.success(message, 'Caution cleared.'); }
    const type = parsed._positional[2];
    const detail = parsed._positional.slice(3).join(' ');
    if (!type) return utils.error(message, 'Please provide a caution type.');
    group.caution = { c_type: type, detail: detail || undefined }; await group.save();
    return utils.success(message, `Caution set to **${type}**`);
}

async function handleClosedName(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    if (parsed.clear) { group.name.closedNameDisplay = undefined; await group.save(); return utils.success(message, 'Closed name display cleared.'); }
    const newName = parsed._positional.slice(2).join(' ');
    if (!newName) return utils.error(message, 'Please provide a closed name display.');
    group.name.closedNameDisplay = newName;
    await group.save();
    return utils.success(message, `Closed name display set to **${newName}**`);
}

async function handleSync(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    const val = parsed._positional[2]?.toLowerCase();
    if (!val || !['true', 'false', 'on', 'off', 'yes', 'no'].includes(val)) return utils.error(message, 'Specify `true` or `false`.');
    group.syncWithApps = group.syncWithApps || {};
    group.syncWithApps.discord = ['true', 'on', 'yes'].includes(val);
    await group.save();
    return utils.success(message, `Discord sync is now **${group.syncWithApps.discord ? 'enabled' : 'disabled'}**`);
}

async function handleDefaultStatus(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    if (parsed.clear) { group.setting = group.setting || {}; group.setting.default_status = undefined; await group.save(); return utils.success(message, 'Default status cleared.'); }
    const status = parsed._positional.slice(2).join(' ');
    if (!status) return utils.error(message, 'Please provide a default status.');
    group.setting = group.setting || {};
    group.setting.default_status = status;
    await group.save();
    return utils.success(message, `Default status set to **${status}**`);
}

async function handleDefaultBattery(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    if (parsed.clear) { group.setting = group.setting || {}; group.setting.default_battery = undefined; await group.save(); return utils.success(message, 'Default battery cleared.'); }
    const val = parseInt(parsed._positional[2]);
    if (isNaN(val) || val < 0 || val > 100) return utils.error(message, 'Please provide a battery level (0-100).');
    group.setting = group.setting || {};
    group.setting.default_battery = val;
    await group.save();
    return utils.success(message, `Default battery set to **${val}**`);
}

async function handleTriggers(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    const action = parsed._positional[2]?.toLowerCase();
    if (action === 'add') {
        const trigger = parsed._positional.slice(3).join(' ');
        if (!trigger) return utils.error(message, 'Please provide a trigger.');
        group.caution = group.caution || {};
        group.caution.triggers = group.caution.triggers || [];
        group.caution.triggers.push({ text: trigger });
        await group.save();
        return utils.success(message, `Trigger \`${trigger}\` added.`);
    }
    if (action === 'remove') {
        const trigger = parsed._positional.slice(3).join(' ');
        if (!trigger) return utils.error(message, 'Please provide a trigger to remove.');
        group.caution = group.caution || {};
        group.caution.triggers = group.caution.triggers || [];
        const idx = group.caution.triggers.findIndex(t => t.text?.toLowerCase() === trigger.toLowerCase());
        if (idx === -1) return utils.error(message, `Trigger \`${trigger}\` not found.`);
        group.caution.triggers.splice(idx, 1);
        await group.save();
        return utils.success(message, `Trigger \`${trigger}\` removed.`);
    }
    if (action === 'clear') {
        group.caution = group.caution || {};
        group.caution.triggers = [];
        await group.save();
        return utils.success(message, 'All triggers cleared.');
    }
    const triggers = group.caution?.triggers || [];
    if (!triggers.length) return utils.info(message, 'No caution triggers set.');
    return utils.info(message, `Triggers: ${triggers.map(t => t.text || t).join(', ')}`);
}

async function handleMask(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    const field = parsed._positional[2]?.toLowerCase();
    if (!field) {
        const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.group).setTitle('🎭 Mask Settings')
            .setDescription(`Use \`sys!group <n> mask <field> <value>\`\nFields: name, displayname (dn), description, color, avatar, banner, proxyavatar (pav)`)
            .addFields(
                { name: 'Current Mask', value: `Name: ${group.mask?.name?.display || group.mask?.name?.indexable || '*not set*'}\nColor: ${group.mask?.color || '*not set*'}\nDescription: ${group.mask?.description || '*not set*'}`, inline: false }
            );
        return message.reply({ embeds: [embed] });
    }
    group.mask = group.mask || {};
    if (field === 'name') {
        const val = parsed._positional.slice(3).join(' ');
        if (!val) return utils.error(message, 'Please provide a mask name.');
        group.mask.name = group.mask.name || {};
        group.mask.name.indexable = val.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || undefined;
        group.mask.name.display = val;
        await group.save();
        return utils.success(message, `Mask name set to **${val}**`);
    }
    if (field === 'displayname' || field === 'dn') {
        if (parsed.clear) { group.mask.name = group.mask.name || {}; group.mask.name.display = undefined; await group.save(); return utils.success(message, 'Mask display name cleared.'); }
        const val = parsed._positional.slice(3).join(' ');
        if (!val) return utils.error(message, 'Please provide a mask display name.');
        group.mask.name = group.mask.name || {};
        group.mask.name.display = val;
        await group.save();
        return utils.success(message, `Mask display name set to **${val}**`);
    }
    if (field === 'description' || field === 'desc') {
        if (parsed.clear) { group.mask.description = undefined; await group.save(); return utils.success(message, 'Mask description cleared.'); }
        const val = parsed._positional.slice(3).join(' ');
        if (!val) return utils.error(message, 'Please provide a mask description.');
        group.mask.description = val;
        await group.save();
        return utils.success(message, 'Mask description updated.');
    }
    if (field === 'color' || field === 'colour') {
        if (parsed.clear) { group.mask.color = undefined; await group.save(); return utils.success(message, 'Mask color cleared.'); }
        const val = utils.normalizeColor(parsed._positional[3]);
        if (!val) return utils.error(message, 'Please provide a valid hex color.');
        group.mask.color = val;
        await group.save();
        return utils.success(message, `Mask color set to **${val}**`);
    }
    if (field === 'avatar' || field === 'icon' || field === 'av') {
        if (parsed.clear) { group.mask.avatar = undefined; await group.save(); return utils.success(message, 'Mask avatar cleared.'); }
        const url = message.attachments.first()?.url || parsed._positional[3];
        if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
        group.mask.avatar = { url };
        await group.save();
        return utils.success(message, 'Mask avatar updated.');
    }
    if (field === 'banner') {
        if (parsed.clear) { if (group.mask.discord) group.mask.discord.image = group.mask.discord.image || {}; group.mask.discord.image.banner = undefined; await group.save(); return utils.success(message, 'Mask banner cleared.'); }
        const url = message.attachments.first()?.url || parsed._positional[3];
        if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
        group.mask.discord = group.mask.discord || {};
        group.mask.discord.image = group.mask.discord.image || {};
        group.mask.discord.image.banner = { url };
        await group.save();
        return utils.success(message, 'Mask banner updated.');
    }
    if (field === 'proxyavatar' || field === 'pav') {
        if (parsed.clear) { if (group.mask.discord) group.mask.discord.image = group.mask.discord.image || {}; group.mask.discord.image.proxyAvatar = undefined; await group.save(); return utils.success(message, 'Mask proxy avatar cleared.'); }
        const url = message.attachments.first()?.url || parsed._positional[3];
        if (!url) return utils.error(message, 'Please provide a URL.');
        group.mask.discord = group.mask.discord || {};
        group.mask.discord.image = group.mask.discord.image || {};
        group.mask.discord.image.proxyAvatar = { url };
        await group.save();
        return utils.success(message, 'Mask proxy avatar updated.');
    }
    return utils.error(message, `(no name) mask field: ${field}. Use: name, displayname, description, color, avatar, banner, proxyavatar`);
}

async function handlePrivacy(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    const bucketArg = parsed._positional[2]?.toLowerCase();
    const field = parsed._positional[3]?.toLowerCase();
    const value = parsed._positional[4]?.toLowerCase();
    const validFields = ['description', 'avatar', 'banner', 'list', 'metadata', 'hidden', 'caution', 'aliases'];
    if (!bucketArg || !validFields.includes(bucketArg)) {
        const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.group).setTitle('🔒 Group Privacy')
            .setDescription(`Use \`sys!group <n> privacy <field> <public|private>\`\nor \`sys!group <n> privacy bucket:<name> <field> <public|private>\`\nFields: ${validFields.join(', ')}`);
        return message.reply({ embeds: [embed] });
    }
    const bucketName = bucketArg.startsWith('bucket:') ? bucketArg.slice(7) : 'default';
    const actualField = bucketArg.startsWith('bucket:') ? field : bucketArg;
    const actualValue = bucketArg.startsWith('bucket:') ? value : field;
    if (!validFields.includes(actualField)) return utils.error(message, 'Invalid field.');
    if (!actualValue || !['public', 'private'].includes(actualValue)) return utils.error(message, 'Specify `public` or `private`.');
    group.setting = group.setting || {}; group.setting.privacy = group.setting.privacy || [];
    let priv = group.setting.privacy.find(p => p.bucket === bucketName);
    if (!priv) { priv = { bucket: bucketName, settings: {} }; group.setting.privacy.push(priv); }
    priv.settings[actualField] = actualValue === 'private'; await group.save();
    return utils.success(message, `**${actualField}** is now **${actualValue}** in bucket **${bucketName}**`);
}

async function handleDelete(message, parsed, groupName) {
    const { group, system } = await getGroup(message, groupName);
    if (!group) return;
    if (!parsed.confirm) return utils.error(message, `⚠️ This will permanently delete **${group.name?.display || groupName}**.\nConfirm: \`sys!group ${groupName} delete -confirm\``);
    
    // Remove group from all members
    for (const memberId of group.memberIDs || []) {
        const alter = await Alter.findById(memberId);
        if (alter) { alter.groupsIDs = alter.groupsIDs?.filter(id => id !== group._id) || []; await alter.save(); }
        const state = await State.findById(memberId);
        if (state) { state.groupIDs = state.groupIDs?.filter(id => id !== group._id) || []; await state.save(); }
    }
    
    system.groups.IDs = system.groups.IDs?.filter(id => id !== group._id) || [];
    await system.save(); await Group.deleteOne({ _id: group._id });
    return utils.success(message, `**${group.name?.display || groupName}** deleted.`);
}

async function handleRandom(message, parsed, groupName) {
    const { group, system } = await getGroup(message, groupName);
    if (!group) return;
    
    const memberIDs = group.memberIDs || [];
    if (!memberIDs.length) return utils.info(message, 'No members in this group.');
    
    const randomId = memberIDs[Math.floor(Math.random() * memberIDs.length)];
    
    // Try to find the member
    let entity = await Alter.findById(randomId);
    let type = 'alter';
    if (!entity) { entity = await State.findById(randomId); type = 'state'; }
    if (!entity) { entity = await Group.findById(randomId); type = 'group'; }
    
    if (!entity) return utils.error(message, 'Could not find random member.');
    
    // Build appropriate embed based on type
    const embed = new EmbedBuilder()
        .setColor(entity.color || utils.ENTITY_COLORS[type])
        .setTitle(`🎲 ${entity.name?.display || entity.name?.indexable || '(no name)'}`)
        .setDescription(entity.description || '*No description*');
        //.setFooter({ text: `Type: ${type} | ID: ${entity._id}` });
    
    if (entity.avatar?.url) embed.setThumbnail(entity.avatar.url);
    
    return message.reply({ embeds: [embed] });
}

async function handleId(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    return message.reply(`\`${group._id}\``);
}

async function handleList(message, parsed) {
    const { system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) return utils.error(message, targetUserId === message.author.id ? 'Not registered yet.' : 'Not registered.');
    const groups = await Group.find({ _id: { $in: system.groups?.IDs || [] } });
    if (!groups.length) return utils.info(message, 'No groups found.');
    const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.group).setTitle(`Groups (${groups.length})`);
    if (parsed.full) {
        let desc = groups.slice(0, 25).map(g => {
            const memberCount = g.memberIDs?.length || 0;
            return `**${g.name?.display || g.name?.indexable}** (\`${g.name?.indexable || g._id}\`) - ${memberCount} members`;
        }).join('\n');
        if (groups.length > 25) desc += `\n*...and ${groups.length - 25} more*`;
        embed.setDescription(desc);
    } else {
        embed.setDescription(groups.map(g => g.name?.display || g.name?.indexable).join(', '));
    }
    return message.reply({ embeds: [embed] });
}

async function handleHelp(message) {
    const embed = utils.buildHelpEmbed('group', 'Manage groups in your profile.', [
        { usage: 'sys!group <n>', description: 'Show group info' },
        { usage: 'sys!group new <n>', description: 'Create new group' },
        { usage: 'sys!group <n> add <member> [member2...]', description: 'Add members' },
        { usage: 'sys!group <n> remove <member> [member2...]', description: 'Remove members' },
        { usage: 'sys!group <n> members [-full]', description: 'List members' },
        { usage: 'sys!group <n> rename <new>', description: 'Change name' },
        { usage: 'sys!group <n> displayname <n>', description: 'Set display name' },
        { usage: 'sys!group <n> closedname <n>', description: 'Set closed name display' },
        { usage: 'sys!group <n> description <text>', description: 'Set description' },
        { usage: 'sys!group <n> avatar <url>', description: 'Set avatar' },
        { usage: 'sys!group <n> color <hex>', description: 'Set color' },
        { usage: 'sys!group <n> proxy [add|remove] <tag>', description: 'Manage proxies' },
        { usage: 'sys!group <n> type <name>', description: 'Set group type' },
        { usage: 'sys!group <n> canfront <yes|no>', description: 'Toggle can front' },
        { usage: 'sys!group <n> caution <type> [detail]', description: 'Set caution' },
        { usage: 'sys!group <n> triggers add|remove <text>', description: 'Manage caution triggers' },
        { usage: 'sys!group <n> privacy <field> <pub|priv>', description: 'Set privacy (default bucket)' },
        { usage: 'sys!group <n> privacy bucket:<name> <field> <pub|priv>', description: 'Set privacy (named bucket)' },
        { usage: 'sys!group <n> sync <true|false>', description: 'Toggle Discord sync' },
        { usage: 'sys!group <n> defaultstatus <status>', description: 'Set default shift status' },
        { usage: 'sys!group <n> defaultbattery <0-100>', description: 'Set default shift battery' },
        { usage: 'sys!group <n> mask <field> <value>', description: 'Edit mask mode settings' },
        { usage: 'sys!group <n> random', description: 'Show random member' },
        { usage: 'sys!group <n> delete -confirm', description: 'Delete group' },
        { usage: 'sys!group list [-full]', description: 'List all groups' },
    ]);
    return message.reply({ embeds: [embed] });
}

async function buildGroupEmbed(group, system) {
    const embed = new EmbedBuilder().setColor(group.color || utils.ENTITY_COLORS.group);
    const displayName = group.name?.display || group.name?.indexable || '(no name)';
    if (group.name?.indexable) embed.setAuthor({ name: group.name.indexable, iconURL: group.avatar?.url });
    embed.setTitle(displayName);
    if (group.description) embed.setDescription(group.description);
    if (group.avatar?.url) embed.setThumbnail(group.avatar.url);
    if (group.discord?.image?.banner?.url) embed.setImage(group.discord.image.banner.url);
    
    // Member count and sample
    const memberCount = group.memberIDs?.length || 0;
    let memberInfo = `**Members:** ${memberCount}`;
    if (memberCount > 0 && memberCount <= 10) {
        const alters = await Alter.find({ _id: { $in: group.memberIDs } });
        const states = await State.find({ _id: { $in: group.memberIDs } });
        const names = [...alters, ...states].map(e => e.name?.display || e.name?.indexable).filter(Boolean);
        if (names.length) memberInfo += `\n${names.join(', ')}`;
    }
    embed.addFields({ name: '👥 Members', value: memberInfo, inline: true });
    
    if (group.type?.name) embed.addFields({ name: '🏷️ Type', value: group.type.name, inline: true });
    if (group.proxy?.length) embed.addFields({ name: '💬 Proxies', value: utils.formatProxies(group.proxy), inline: true });
    if (group.name?.aliases?.length) embed.addFields({ name: '📝 Aliases', value: group.name.aliases.join(', '), inline: true });
    
    //embed.setFooter({ text: `ID: ${group._id}` });
    return embed;
}