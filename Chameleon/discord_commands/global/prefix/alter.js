// sys!alter - Alter management prefix command
// USAGE: See handleHelp() for full command list

const { EmbedBuilder } = require('discord.js');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const utils = require('../../functions/bot_utils');

module.exports = {
    name: 'alter',
    aliases: ['a', 'member', 'm'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        const firstArg = parsed._positional[0]?.toLowerCase();

        // Special cases
        if (firstArg === 'new' || firstArg === 'create') return handleNew(message, parsed);
        if (firstArg === 'list') return handleList(message, parsed);
        if (firstArg === 'help' || !firstArg) return handleHelp(message);

        const alterName = parsed._positional[0];
        const subcommand = parsed._positional[1]?.toLowerCase();

        const handlers = {
            'rename': handleRename, 'name': handleRename,
            'displayname': handleDisplayName, 'dn': handleDisplayName,
            'description': handleDescription, 'desc': handleDescription,
            'avatar': handleAvatar, 'icon': handleAvatar, 'av': handleAvatar, 'pfp': handleAvatar,
            'banner': handleBanner,
            'proxyavatar': handleProxyAvatar, 'pav': handleProxyAvatar,
            'color': handleColor, 'colour': handleColor,
            'birthday': handleBirthday, 'bd': handleBirthday, 'bday': handleBirthday,
            'pronouns': handlePronouns, 'prns': handlePronouns,
            'proxy': handleProxy,
            'signoff': handleSignoff, 'sign': handleSignoff,
            'aliases': handleAliases, 'alias': handleAliases,
            'groups': handleGroups, 'group': handleGroups,
            'condition': handleCondition, 'cond': handleCondition,
            'caution': handleCaution,
            'privacy': handlePrivacy,
            'delete': handleDelete,
            'dormant': handleDormant,
            'id': handleId,
            'autoproxy': handleAutoproxy, 'ap': handleAutoproxy,
            'keepproxy': handleKeepProxy, 'kp': handleKeepProxy
        };

        if (handlers[subcommand]) {
            return handlers[subcommand](message, parsed, alterName);
        }
        return handleShow(message, parsed, alterName);
    }
};

async function getAlter(message, alterName) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!system) {
        await utils.error(message, 'You don\'t have a system yet. Use `sys!system new` to create one.');
        return { alter: null, system: null };
    }
    const result = await utils.findEntity(alterName, system, 'alter');
    if (!result) {
        await utils.error(message, `Alter **${alterName}** not found.`);
        return { alter: null, system };
    }
    return { alter: result.entity, system };
}

async function handleShow(message, parsed, alterName) {
    const { user, system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) {
        return utils.error(message, targetUserId === message.author.id 
            ? 'You don\'t have a system yet.' : 'That user doesn\'t have a system.');
    }
    const result = await utils.findEntity(alterName, system, 'alter');
    if (!result) return utils.error(message, `Alter **${alterName}** not found.`);
    const embed = await buildAlterEmbed(result.entity, system, parsed.full);
    return message.reply({ embeds: [embed] });
}

async function handleNew(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    const name = parsed._positional.slice(1).join(' ') || parsed.name;
    if (!name) return utils.error(message, 'Please provide a name: `sys!alter new <n>`');

    const indexable = name.toLowerCase().replace(/[^a-z0-9\-_]/g, '');
    if (!indexable) return utils.error(message, 'Name must contain at least one alphanumeric character.');

    const existing = await utils.findEntity(indexable, system, 'alter');
    if (existing) return utils.error(message, `An alter with the name **${indexable}** already exists.`);

    const alter = new Alter({
        systemID: system._id,
        name: { indexable, display: name },
        metadata: { addedAt: new Date() }
    });
    await alter.save();

    system.alters = system.alters || { IDs: [] };
    system.alters.IDs.push(alter._id);
    await system.save();

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.success)
        .setTitle(`✅ ${system.alterSynonym?.singular || 'Alter'} Created!`)
        .setDescription(`**${name}** has been created.`)
        .addFields(
            { name: 'ID', value: `\`${alter._id}\``, inline: true },
            { name: 'Indexable Name', value: `\`${indexable}\``, inline: true }
        );
    return message.reply({ embeds: [embed] });
}

async function handleRename(message, parsed, alterName) {
    const { alter, system } = await getAlter(message, alterName);
    if (!alter) return;
    const newName = parsed._positional.slice(2).join(' ');
    if (!newName) return utils.error(message, 'Please provide a new name.');
    if (!utils.isValidIndexableName(newName)) return utils.error(message, 'Indexable names can only contain letters, numbers, dashes, and underscores.');
    alter.name.indexable = newName;
    await alter.save();
    return utils.success(message, `Indexable name changed to **${newName}**`);
}

async function handleDisplayName(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.name.display = undefined; await alter.save(); return utils.success(message, 'Display name cleared.'); }
    const newName = parsed._positional.slice(2).join(' ');
    if (!newName) return utils.error(message, 'Please provide a display name.');
    alter.name.display = newName;
    await alter.save();
    return utils.success(message, `Display name set to **${newName}**`);
}

async function handleDescription(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.description = undefined; await alter.save(); return utils.success(message, 'Description cleared.'); }
    const desc = parsed._positional.slice(2).join(' ');
    if (!desc) return utils.error(message, 'Please provide a description.');
    alter.description = desc;
    await alter.save();
    return utils.success(message, 'Description updated.');
}

async function handleAvatar(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.avatar = undefined; await alter.save(); return utils.success(message, 'Avatar cleared.'); }
    const url = message.attachments.first()?.url || parsed._positional[2];
    if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
    alter.avatar = { url };
    await alter.save();
    return utils.success(message, 'Avatar updated.');
}

async function handleBanner(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { if (alter.discord?.image) alter.discord.image.banner = undefined; await alter.save(); return utils.success(message, 'Banner cleared.'); }
    const url = message.attachments.first()?.url || parsed._positional[2];
    if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
    alter.discord = alter.discord || {}; alter.discord.image = alter.discord.image || {};
    alter.discord.image.banner = { url };
    await alter.save();
    return utils.success(message, 'Banner updated.');
}

async function handleProxyAvatar(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { if (alter.discord?.image) alter.discord.image.proxyAvatar = undefined; await alter.save(); return utils.success(message, 'Proxy avatar cleared.'); }
    const url = message.attachments.first()?.url || parsed._positional[2];
    if (!url) return utils.error(message, 'Please provide a URL.');
    alter.discord = alter.discord || {}; alter.discord.image = alter.discord.image || {};
    alter.discord.image.proxyAvatar = { url };
    await alter.save();
    return utils.success(message, 'Proxy avatar updated.');
}

async function handleColor(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.color = undefined; await alter.save(); return utils.success(message, 'Color cleared.'); }
    const color = utils.normalizeColor(parsed._positional[2]);
    if (!color) return utils.error(message, 'Please provide a valid hex color.');
    alter.color = color;
    await alter.save();
    return utils.success(message, `Color set to **${color}**`);
}

async function handleBirthday(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.birthday = undefined; await alter.save(); return utils.success(message, 'Birthday cleared.'); }
    const dateInput = parsed._positional[2];
    if (!dateInput) return utils.error(message, 'Please provide a date (YYYY-MM-DD or "today").');
    const date = dateInput.toLowerCase() === 'today' ? new Date() : new Date(dateInput);
    if (isNaN(date.getTime())) return utils.error(message, 'Invalid date format.');
    alter.birthday = date;
    await alter.save();
    return utils.success(message, `Birthday set to **${utils.formatDate(date)}**`);
}

async function handlePronouns(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.pronouns = []; await alter.save(); return utils.success(message, 'Pronouns cleared.'); }
    const input = parsed._positional.slice(2).join(' ');
    if (!input) return utils.error(message, 'Please provide pronouns.');
    alter.pronouns = input.split(/[,]/).map(p => p.trim()).filter(Boolean);
    await alter.save();
    return utils.success(message, `Pronouns set to **${alter.pronouns.join(', ')}**`);
}

async function handleProxy(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    const action = parsed._positional[2]?.toLowerCase();
    if (parsed.clear || action === 'clear') { alter.proxy = []; await alter.save(); return utils.success(message, 'Proxy tags cleared.'); }
    if (action === 'add') {
        const tag = parsed._positional.slice(3).join(' ');
        if (!tag) return utils.error(message, 'Please provide a proxy tag.');
        alter.proxy = alter.proxy || []; alter.proxy.push(tag); await alter.save();
        return utils.success(message, `Proxy tag \`${tag}\` added.`);
    }
    if (action === 'remove') {
        const tag = parsed._positional.slice(3).join(' ');
        if (!tag) return utils.error(message, 'Please provide a proxy tag to remove.');
        alter.proxy = alter.proxy || [];
        const idx = alter.proxy.findIndex(p => p.toLowerCase() === tag.toLowerCase());
        if (idx === -1) return utils.error(message, `Proxy tag \`${tag}\` not found.`);
        alter.proxy.splice(idx, 1); await alter.save();
        return utils.success(message, `Proxy tag \`${tag}\` removed.`);
    }
    const tag = parsed._positional.slice(2).join(' ');
    if (!tag) {
        const proxies = alter.proxy || [];
        return proxies.length ? utils.info(message, `Proxy tags: ${utils.formatProxies(proxies)}`) : utils.info(message, 'No proxy tags set.');
    }
    alter.proxy = [tag]; await alter.save();
    return utils.success(message, `Proxy tag set to \`${tag}\``);
}

async function handleSignoff(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.signoff = undefined; await alter.save(); return utils.success(message, 'Sign-offs cleared.'); }
    const input = parsed._positional.slice(2).join(' ');
    if (!input) return utils.error(message, 'Please provide sign-offs.');
    alter.signoff = utils.parseList(input).join('\n');
    await alter.save();
    return utils.success(message, 'Sign-offs updated.');
}

async function handleAliases(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    const action = parsed._positional[2]?.toLowerCase();
    if (parsed.clear || action === 'clear') { alter.name.aliases = []; await alter.save(); return utils.success(message, 'Aliases cleared.'); }
    if (action === 'add') {
        const alias = parsed._positional.slice(3).join(' ');
        if (!alias) return utils.error(message, 'Please provide an alias.');
        alter.name.aliases = alter.name.aliases || []; alter.name.aliases.push(alias); await alter.save();
        return utils.success(message, `Alias **${alias}** added.`);
    }
    if (action === 'remove') {
        const alias = parsed._positional.slice(3).join(' ');
        if (!alias) return utils.error(message, 'Please provide an alias to remove.');
        alter.name.aliases = alter.name.aliases || [];
        const idx = alter.name.aliases.findIndex(a => a.toLowerCase() === alias.toLowerCase());
        if (idx === -1) return utils.error(message, `Alias **${alias}** not found.`);
        alter.name.aliases.splice(idx, 1); await alter.save();
        return utils.success(message, `Alias **${alias}** removed.`);
    }
    const input = parsed._positional.slice(2).join(' ');
    if (!input) {
        const aliases = alter.name?.aliases || [];
        return aliases.length ? utils.info(message, `Aliases: ${aliases.join(', ')}`) : utils.info(message, 'No aliases set.');
    }
    alter.name.aliases = utils.parseList(input); await alter.save();
    return utils.success(message, `Aliases set.`);
}

async function handleGroups(message, parsed, alterName) {
    const { alter, system } = await getAlter(message, alterName);
    if (!alter) return;
    const action = parsed._positional[2]?.toLowerCase();
    const groupName = parsed._positional.slice(3).join(' ');
    if (action === 'add') {
        if (!groupName) return utils.error(message, 'Please provide a group name.');
        const gr = await utils.findEntity(groupName, system, 'group');
        if (!gr) return utils.error(message, `Group **${groupName}** not found.`);
        alter.groupsIDs = alter.groupsIDs || [];
        if (alter.groupsIDs.includes(gr.entity._id)) return utils.error(message, 'Already in that group.');
        alter.groupsIDs.push(gr.entity._id); await alter.save();
        gr.entity.memberIDs = gr.entity.memberIDs || [];
        if (!gr.entity.memberIDs.includes(alter._id)) { gr.entity.memberIDs.push(alter._id); await gr.entity.save(); }
        return utils.success(message, `Added to group **${gr.entity.name?.display || groupName}**`);
    }
    if (action === 'remove') {
        if (!groupName) return utils.error(message, 'Please provide a group name.');
        const gr = await utils.findEntity(groupName, system, 'group');
        if (!gr) return utils.error(message, `Group **${groupName}** not found.`);
        alter.groupsIDs = alter.groupsIDs || [];
        const idx = alter.groupsIDs.indexOf(gr.entity._id);
        if (idx === -1) return utils.error(message, 'Not in that group.');
        alter.groupsIDs.splice(idx, 1); await alter.save();
        gr.entity.memberIDs = gr.entity.memberIDs?.filter(id => id !== alter._id) || [];
        await gr.entity.save();
        return utils.success(message, `Removed from group.`);
    }
    const groups = await Group.find({ _id: { $in: alter.groupsIDs || [] } });
    if (!groups.length) return utils.info(message, 'Not in any groups.');
    return utils.info(message, `Groups: ${groups.map(g => g.name?.display || g.name?.indexable).join(', ')}`);
}

async function handleCondition(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.condition = undefined; await alter.save(); return utils.success(message, 'Condition cleared.'); }
    const cond = parsed._positional.slice(2).join(' ');
    if (!cond) return utils.error(message, 'Please provide a condition.');
    alter.condition = cond; await alter.save();
    return utils.success(message, `Condition set to **${cond}**`);
}

async function handleCaution(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.caution = undefined; await alter.save(); return utils.success(message, 'Caution cleared.'); }
    const type = parsed._positional[2];
    const detail = parsed._positional.slice(3).join(' ');
    if (!type) return utils.error(message, 'Please provide a caution type.');
    alter.caution = { c_type: type, detail: detail || undefined }; await alter.save();
    return utils.success(message, `Caution set to **${type}**`);
}

async function handlePrivacy(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    const field = parsed._positional[2]?.toLowerCase();
    const value = parsed._positional[3]?.toLowerCase();
    const validFields = ['description', 'avatar', 'banner', 'birthday', 'pronouns', 'metadata', 'proxies', 'caution', 'hidden', 'aliases'];
    if (!field) {
        const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.alter).setTitle('🔒 Alter Privacy')
            .setDescription(`Use \`sys!alter <n> privacy <field> <public|private>\`\nFields: ${validFields.join(', ')}`);
        return message.reply({ embeds: [embed] });
    }
    if (!validFields.includes(field)) return utils.error(message, `Invalid field. Valid: ${validFields.join(', ')}`);
    if (!value || !['public', 'private'].includes(value)) return utils.error(message, 'Specify `public` or `private`.');
    alter.setting = alter.setting || {}; alter.setting.privacy = alter.setting.privacy || [];
    let priv = alter.setting.privacy.find(p => p.bucket === 'default');
    if (!priv) { priv = { bucket: 'default', settings: {} }; alter.setting.privacy.push(priv); }
    priv.settings[field] = value === 'private'; await alter.save();
    return utils.success(message, `**${field}** is now **${value}**`);
}

async function handleDelete(message, parsed, alterName) {
    const { alter, system } = await getAlter(message, alterName);
    if (!alter) return;
    if (!parsed.confirm) return utils.error(message, `⚠️ This will permanently delete **${alter.name?.display || alterName}**.\nConfirm: \`sys!alter ${alterName} delete -confirm\``);
    for (const gid of alter.groupsIDs || []) {
        const g = await Group.findById(gid);
        if (g) { g.memberIDs = g.memberIDs?.filter(id => id !== alter._id) || []; await g.save(); }
    }
    system.alters.IDs = system.alters.IDs?.filter(id => id !== alter._id) || [];
    await system.save(); await Alter.deleteOne({ _id: alter._id });
    return utils.success(message, `**${alter.name?.display || alterName}** deleted.`);
}

async function handleDormant(message, parsed, alterName) {
    const { alter, system } = await getAlter(message, alterName);
    if (!alter) return;
    alter.condition = 'Dormant'; await alter.save();
    return utils.success(message, `**${alter.name?.display || alterName}** marked as dormant.`);
}

async function handleId(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    return message.reply(`\`${alter._id}\``);
}

async function handleAutoproxy(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    const val = parsed._positional[2]?.toLowerCase();
    if (!val || !['on', 'off'].includes(val)) return utils.error(message, 'Specify `on` or `off`.');
    alter.setting = alter.setting || {}; alter.setting.autoproxyEnabled = val === 'on'; await alter.save();
    return utils.success(message, `Autoproxy for **${alter.name?.display || alterName}** is now **${val}**`);
}

async function handleKeepProxy(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    const val = parsed._positional[2]?.toLowerCase();
    if (!val || !['on', 'off'].includes(val)) return utils.error(message, 'Specify `on` or `off`.');
    alter.setting = alter.setting || {}; alter.setting.keepProxy = val === 'on'; await alter.save();
    return utils.success(message, `Keep proxy is now **${val}**`);
}

async function handleList(message, parsed) {
    const { system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) return utils.error(message, targetUserId === message.author.id ? 'You don\'t have a system.' : 'That user doesn\'t have a system.');
    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
    if (!alters.length) return utils.info(message, `No ${system.alterSynonym?.plural || 'alters'} found.`);
    const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.system).setTitle(`${system.alterSynonym?.plural || 'Alters'} (${alters.length})`);
    if (parsed.full) {
        let desc = alters.slice(0, 25).map(a => {
            const name = a.name?.display || a.name?.indexable || 'Unknown';
            const prx = a.proxy?.length ? ` • \`${a.proxy[0]}\`` : '';
            return `**${name}** (\`${a.name?.indexable || a._id}\`)${prx}`;
        }).join('\n');
        if (alters.length > 25) desc += `\n*...and ${alters.length - 25} more*`;
        embed.setDescription(desc);
    } else {
        embed.setDescription(alters.map(a => a.name?.display || a.name?.indexable || 'Unknown').join(', '));
    }
    return message.reply({ embeds: [embed] });
}

async function handleHelp(message) {
    const embed = utils.buildHelpEmbed('alter', 'Manage alters/members in your system.', [
        { usage: 'sys!alter <n>', description: 'Show alter info' },
        { usage: 'sys!alter new <n>', description: 'Create new alter' },
        { usage: 'sys!alter <n> rename <new>', description: 'Change indexable name' },
        { usage: 'sys!alter <n> displayname <n>', description: 'Set display name' },
        { usage: 'sys!alter <n> description <text>', description: 'Set description' },
        { usage: 'sys!alter <n> avatar <url>', description: 'Set avatar' },
        { usage: 'sys!alter <n> pronouns <p, p>', description: 'Set pronouns' },
        { usage: 'sys!alter <n> proxy [add|remove] <tag>', description: 'Manage proxy tags' },
        { usage: 'sys!alter <n> color <hex>', description: 'Set color' },
        { usage: 'sys!alter <n> birthday <date>', description: 'Set birthday' },
        { usage: 'sys!alter <n> aliases [add|remove] <alias>', description: 'Manage aliases' },
        { usage: 'sys!alter <n> groups [add|remove] <group>', description: 'Manage groups' },
        { usage: 'sys!alter <n> delete -confirm', description: 'Delete alter' },
        { usage: 'sys!alter list [-full]', description: 'List all alters' },
    ]);
    return message.reply({ embeds: [embed] });
}

async function buildAlterEmbed(alter, system, showFull = false) {
    const embed = new EmbedBuilder().setColor(alter.color || utils.ENTITY_COLORS.alter);
    const displayName = alter.name?.display || alter.name?.indexable || 'Unknown';
    if (alter.name?.indexable) embed.setAuthor({ name: alter.name.indexable, iconURL: alter.avatar?.url });
    embed.setTitle(displayName);
    if (alter.description) embed.setDescription(alter.description);
    if (alter.avatar?.url) embed.setThumbnail(alter.avatar.url);
    if (alter.discord?.image?.banner?.url) embed.setImage(alter.discord.image.banner.url);
    
    let info = '';
    if (alter.pronouns?.length) info += `**Pronouns:** ${alter.pronouns.join(', ')}\n`;
    if (alter.birthday) info += `**Birthday:** ${utils.formatDate(alter.birthday)}\n`;
    if (alter.condition) info += `**Condition:** ${alter.condition}\n`;
    if (info) embed.addFields({ name: '👤 Info', value: info.trim(), inline: true });
    
    if (alter.proxy?.length) embed.addFields({ name: '💬 Proxies', value: utils.formatProxies(alter.proxy), inline: true });
    
    if (alter.groupsIDs?.length) {
        const groups = await Group.find({ _id: { $in: alter.groupsIDs } });
        if (groups.length) embed.addFields({ name: '👥 Groups', value: groups.map(g => g.name?.display || g.name?.indexable).join(', '), inline: true });
    }
    if (alter.name?.aliases?.length) embed.addFields({ name: '📝 Aliases', value: alter.name.aliases.join(', '), inline: true });
    if (alter.caution?.c_type) {
        let ct = alter.caution.c_type;
        if (alter.caution.detail) ct += `\n${alter.caution.detail}`;
        embed.addFields({ name: '⚠️ Caution', value: ct, inline: false });
    }
    embed.setFooter({ text: `ID: ${alter._id}` });
    return embed;
}