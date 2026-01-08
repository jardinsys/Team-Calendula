// sys!group - Group management prefix command
// Groups are collections of alters and/or states

const { EmbedBuilder } = require('discord.js');
const System = require('../../schemas/system');
const User = require('../../schemas/user');
const Alter = require('../../schemas/alter');
const State = require('../../schemas/state');
const Group = require('../../schemas/group');
const utils = require('../../functions/bot_utils');

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
            'privacy': handlePrivacy,
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
    if (!system) return utils.error(message, targetUserId === message.author.id ? 'You don\'t have a system.' : 'That user doesn\'t have a system.');
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
    const indexable = name.toLowerCase().replace(/[^a-z0-9\-_]/g, '');
    if (!indexable) return utils.error(message, 'Name must contain at least one alphanumeric character.');
    const existing = await utils.findEntity(indexable, system, 'group');
    if (existing) return utils.error(message, `A group with the name **${indexable}** already exists.`);

    const group = new Group({
        systemID: system._id,
        name: { indexable, display: name },
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
    if (parsed.clear) { group.avatar = undefined; await group.save(); return utils.success(message, 'Avatar cleared.'); }
    const url = message.attachments.first()?.url || parsed._positional[2];
    if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
    group.avatar = { url };
    await group.save();
    return utils.success(message, 'Avatar updated.');
}

async function handleBanner(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    if (parsed.clear) { if (group.discord?.image) group.discord.image.banner = undefined; await group.save(); return utils.success(message, 'Banner cleared.'); }
    const url = message.attachments.first()?.url || parsed._positional[2];
    if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
    group.discord = group.discord || {}; group.discord.image = group.discord.image || {};
    group.discord.image.banner = { url };
    await group.save();
    return utils.success(message, 'Banner updated.');
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

async function handlePrivacy(message, parsed, groupName) {
    const { group } = await getGroup(message, groupName);
    if (!group) return;
    const field = parsed._positional[2]?.toLowerCase();
    const value = parsed._positional[3]?.toLowerCase();
    const validFields = ['description', 'avatar', 'banner', 'list', 'metadata', 'hidden', 'caution', 'aliases'];
    if (!field) {
        const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.group).setTitle('🔒 Group Privacy')
            .setDescription(`Use \`sys!group <n> privacy <field> <public|private>\`\nFields: ${validFields.join(', ')}`);
        return message.reply({ embeds: [embed] });
    }
    if (!validFields.includes(field)) return utils.error(message, 'Invalid field.');
    if (!value || !['public', 'private'].includes(value)) return utils.error(message, 'Specify `public` or `private`.');
    group.setting = group.setting || {}; group.setting.privacy = group.setting.privacy || [];
    let priv = group.setting.privacy.find(p => p.bucket === 'default');
    if (!priv) { priv = { bucket: 'default', settings: {} }; group.setting.privacy.push(priv); }
    priv.settings[field] = value === 'private'; await group.save();
    return utils.success(message, `**${field}** is now **${value}**`);
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
        .setTitle(`🎲 ${entity.name?.display || entity.name?.indexable || 'Unknown'}`)
        .setDescription(entity.description || '*No description*')
        .setFooter({ text: `Type: ${type} | ID: ${entity._id}` });
    
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
    if (!system) return utils.error(message, targetUserId === message.author.id ? 'You don\'t have a system.' : 'That user doesn\'t have a system.');
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
    const embed = utils.buildHelpEmbed('group', 'Manage groups in your system.', [
        { usage: 'sys!group <n>', description: 'Show group info' },
        { usage: 'sys!group new <n>', description: 'Create new group' },
        { usage: 'sys!group <n> add <member> [member2...]', description: 'Add members' },
        { usage: 'sys!group <n> remove <member> [member2...]', description: 'Remove members' },
        { usage: 'sys!group <n> members [-full]', description: 'List members' },
        { usage: 'sys!group <n> rename <new>', description: 'Change name' },
        { usage: 'sys!group <n> displayname <n>', description: 'Set display name' },
        { usage: 'sys!group <n> description <text>', description: 'Set description' },
        { usage: 'sys!group <n> avatar <url>', description: 'Set avatar' },
        { usage: 'sys!group <n> color <hex>', description: 'Set color' },
        { usage: 'sys!group <n> proxy [add|remove] <tag>', description: 'Manage proxies' },
        { usage: 'sys!group <n> random', description: 'Show random member' },
        { usage: 'sys!group <n> delete -confirm', description: 'Delete group' },
        { usage: 'sys!group list [-full]', description: 'List all groups' },
    ]);
    return message.reply({ embeds: [embed] });
}

async function buildGroupEmbed(group, system) {
    const embed = new EmbedBuilder().setColor(group.color || utils.ENTITY_COLORS.group);
    const displayName = group.name?.display || group.name?.indexable || 'Unknown';
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
    
    embed.setFooter({ text: `ID: ${group._id}` });
    return embed;
}