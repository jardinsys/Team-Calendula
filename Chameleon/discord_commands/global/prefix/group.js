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
const proxyMessageHandler = require('../proxy-message');
const {
    nameField, simpleField, mediaField, booleanField,
    nestedField, listField, proxyHandler, privacyHandler,
    idHandler, maskHandler
} = require('../../functions/bot_utils/entityHandlers');

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

        // Groups are not available for dissociative profiles
        const { system } = await utils.getOrCreateUserAndSystem(message);
        if (system?.sys_type?.isDissociative) {
            return utils.error(message, 'Groups are not available for your profile type. Dissociative profiles use states instead.');
        }

        const groupName = parsed._positional[0];
        const subcommand = parsed._positional[1]?.toLowerCase();

        // Getter wrapper that returns { entity, system } for factory functions
        const getGroupEntity = async (msg, name) => {
            const { system: sys } = await utils.getOrCreateUserAndSystem(msg);
            if (!sys) { await utils.error(msg, 'You don\'t have a system yet.'); return null; }
            const result = await utils.findEntity(name, sys, 'group');
            if (!result) { await utils.error(msg, `Group **${name}** not found.`); return null; }
            return { entity: result.entity, system: sys };
        };

        const handlers = {
            'rename': nameField(getGroupEntity, 'indexable', 'Indexable name', { validateIndexable: true }),
            'name': nameField(getGroupEntity, 'indexable', 'Indexable name', { validateIndexable: true }),
            'displayname': nameField(getGroupEntity, 'display', 'Display name'),
            'dn': nameField(getGroupEntity, 'display', 'Display name'),
            'closedname': nameField(getGroupEntity, 'closedNameDisplay', 'Closed name display'),
            'cn': nameField(getGroupEntity, 'closedNameDisplay', 'Closed name display'),
            'description': simpleField(getGroupEntity, 'description', 'Description'),
            'desc': simpleField(getGroupEntity, 'description', 'Description'),
            'avatar': mediaField(getGroupEntity, 'avatar', 'Avatar', { entityType: 'Group', uploadFieldName: 'avatar' }),
            'icon': mediaField(getGroupEntity, 'avatar', 'Avatar', { entityType: 'Group', uploadFieldName: 'avatar' }),
            'av': mediaField(getGroupEntity, 'avatar', 'Avatar', { entityType: 'Group', uploadFieldName: 'avatar' }),
            'banner': mediaField(getGroupEntity, 'discord.image.banner', 'Banner', { syncBucket: true, entityType: 'Group', uploadFieldName: 'banner' }),
            'color': simpleField(getGroupEntity, 'color', 'Color'),
            'colour': simpleField(getGroupEntity, 'color', 'Color'),
            'proxy': proxyHandler(getGroupEntity),
            'signoff': simpleField(getGroupEntity, 'signoff', 'Sign-offs'),
            'sign': simpleField(getGroupEntity, 'signoff', 'Sign-offs'),
            'aliases': listField(getGroupEntity, 'name.aliases', 'Aliases'),
            'alias': listField(getGroupEntity, 'name.aliases', 'Aliases'),
            'add': handleAdd,
            'remove': handleRemove,
            'members': handleMembers,
            'list': handleMemberList,
            'type': handleType,
            'canfront': handleCanFront,
            'cf': handleCanFront,
            'caution': simpleField(getGroupEntity, 'caution', 'Caution'),
            'triggers': listField(getGroupEntity, 'caution.triggers', 'Triggers', { matchKey: 'text', itemFactory: (text) => ({ text }) }),
            'trigger': listField(getGroupEntity, 'caution.triggers', 'Triggers', { matchKey: 'text', itemFactory: (text) => ({ text }) }),
            'privacy': privacyHandler(getGroupEntity, 'group', ['description', 'avatar', 'banner', 'metadata', 'proxies', 'caution', 'hidden', 'aliases'], utils.ENTITY_COLORS.group),
            'sync': booleanField(getGroupEntity, 'syncWithApps.discord', 'Discord sync'),
            'defaultstatus': nestedField(getGroupEntity, 'setting', 'default_status', 'Default status'),
            'ds': nestedField(getGroupEntity, 'setting', 'default_status', 'Default status'),
            'defaultbattery': nestedField(getGroupEntity, 'setting', 'default_battery', 'Default battery', { parser: (v) => parseInt(v), validator: (v) => !isNaN(v) && v >= 0 && v <= 100, errorMsg: 'Please provide a battery level (0-100).' }),
            'db': nestedField(getGroupEntity, 'setting', 'default_battery', 'Default battery', { parser: (v) => parseInt(v), validator: (v) => !isNaN(v) && v >= 0 && v <= 100, errorMsg: 'Please provide a battery level (0-100).' }),
            'mask': maskHandler(getGroupEntity, 'group', utils.ENTITY_COLORS.group),
            'delete': handleDelete,
            'random': handleRandom,
            'id': idHandler(getGroupEntity)
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
    const embed = await buildGroupEmbed(result.entity, system, message.author?.displayName);
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
        name: { ...(indexable && { indexable }), display: name },
        addedAt: new Date(),
        memberIDs: []
    });
    await utils.createAndLinkEntity(group, system, 'group');

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.success)
        .setTitle('✅ Group Created!')
        .setDescription(`**${name}** has been created.`)
        .addFields({ name: 'ID', value: `\`${group._id}\``, inline: true });
    return message.reply({ embeds: [embed] });
}

async function handleAdd(message, parsed, groupName) {
    const { group, system } = await getGroup(message, groupName);
    if (!group) return;
    const memberNames = parsed._positional.slice(2);
    if (!memberNames.length) return utils.error(message, 'Please provide member name(s): `sys!group <group> add <member> [member2] ...`');
    
    const added = [];
    const failed = [];
    
    for (const memberName of memberNames) {
        const result = await utils.findEntity(memberName, system);
        if (!result) { failed.push(memberName); continue; }
        
        group.memberIDs = group.memberIDs || [];
        if (group.memberIDs.includes(result.entity._id)) { failed.push(`${memberName} (already in group)`); continue; }
        
        group.memberIDs.push(result.entity._id);
        
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

async function handleDelete(message, parsed, groupName) {
    const { group, system } = await getGroup(message, groupName);
    if (!group) return;
    if (!parsed.confirm) return utils.error(message, `⚠️ This will permanently delete **${group.name?.display || groupName}**.\nConfirm: \`sys!group ${groupName} delete -confirm\``);
    
    for (const alterId of group.alterIDs || []) {
        const alter = await Alter.findById(alterId);
        if (alter) { alter.groupsIDs = alter.groupsIDs?.filter(id => id !== group._id) || []; await alter.save(); }
    }
    for (const stateId of group.stateIDs || []) {
        const state = await State.findById(stateId);
        if (state) { state.groupIDs = state.groupIDs?.filter(id => id !== group._id) || []; await state.save(); }
    }
    
    system.groups.IDs = system.groups.IDs?.filter(id => id !== group._id) || [];
    await system.save(); await Group.deleteOne({ _id: group._id });
    utils.publishDeleteEvent(system._id, 'group', group._id);
    return utils.success(message, `**${group.name?.display || groupName}** deleted.`);
}

async function handleRandom(message, parsed, groupName) {
    const { group, system } = await getGroup(message, groupName);
    if (!group) return;
    
    const memberIDs = group.memberIDs || [];
    if (!memberIDs.length) return utils.info(message, 'No members in this group.');
    
    const randomId = memberIDs[Math.floor(Math.random() * memberIDs.length)];
    
    let entity = await Alter.findById(randomId);
    let type = 'alter';
    if (!entity) { entity = await State.findById(randomId); type = 'state'; }
    if (!entity) { entity = await Group.findById(randomId); type = 'group'; }
    
    if (!entity) return utils.error(message, 'Could not find random member.');
    
    const embed = new EmbedBuilder()
        .setColor(entity.color || utils.ENTITY_COLORS[type])
        .setTitle(`🎲 ${entity.name?.display || entity.name?.indexable || '(no name)'}`)
        .setDescription(entity.description || '*No description*');
    
    if (entity.avatar?.url) embed.setThumbnail(entity.avatar.url);
    
    return message.reply({ embeds: [embed] });
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

async function buildGroupEmbed(group, system, fallbackName = null) {
    const embed = new EmbedBuilder().setColor(group.color || utils.ENTITY_COLORS.group);
    const displayName = group.name?.display || group.name?.indexable || fallbackName || '(no name)';
    if (group.name?.indexable) embed.setAuthor({ name: group.name.indexable, iconURL: group.avatar?.url });
    embed.setTitle(displayName);
    if (group.description) embed.setDescription(group.description);
    if (group.avatar?.url) embed.setThumbnail(group.avatar.url);
    if (group.discord?.image?.banner?.url) embed.setImage(group.discord.image.banner.url);
    
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
    
    return embed;
}
