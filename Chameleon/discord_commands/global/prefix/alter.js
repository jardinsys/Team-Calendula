// sys!alter - Alter management prefix command
// CLI-style alter CRUD with privacy, mask, triggers, and R2 media support
//
// USAGE:
//   sys!alter <n>                              - View an alter
//   sys!alter new <n>                          - Create an alter
//   sys!alter list [-full]                     - List all alters
//   sys!alter <n> displayname|dn <name>        - Set display name
//   sys!alter <n> closedname|cn <name>         - Set closed name display
//   sys!alter <n> description <text>           - Set description
//   sys!alter <n> avatar|banner <url>          - Set media
//   sys!alter <n> color <hex>                  - Set color
//   sys!alter <n> pronouns <p, p>             - Set pronouns
//   sys!alter <n> birthday <date>              - Set birthday
//   sys!alter <n> proxy add|remove <tag>       - Manage proxies
//   sys!alter <n> aliases add|remove <alias>   - Manage aliases
//   sys!alter <n> groups add|remove <group>    - Manage groups
//   sys!alter <n> sync <true|false>            - Toggle Discord sync
//   sys!alter <n> defaultstatus <s>            - Set default shift status
//   sys!alter <n> defaultbattery <0-100>       - Set default shift battery
//   sys!alter <n> caution <type> [detail]      - Set caution
//   sys!alter <n> triggers add|remove <text>   - Manage triggers
//   sys!alter <n> mask <field> <value>         - Edit mask mode
//   sys!alter <n> dormant                      - Toggle dormant
//   sys!alter <n> privacy <field> <pub|priv>   - Set privacy
//   sys!alter <n> privacy bucket:<name> <f> <v> - Per-bucket privacy
//   sys!alter <n> delete -confirm              - Delete alter

const { EmbedBuilder } = require('discord.js');
const System = require('../../../schemas/system');
const User = require('../../../schemas/user');
const Alter = require('../../../schemas/alter');
const State = require('../../../schemas/state');
const Group = require('../../../schemas/group');
const utils = require('../../functions/bot_utils');
const proxyMessageHandler = require('../proxy-message');

const { getSystemTerm, getAlterTerm } = utils;

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
            'closedname': handleClosedName, 'cn': handleClosedName,
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
            'states': handleStates,
            'activestates': handleActiveStates, 'as': handleActiveStates,
            'condition': handleCondition, 'cond': handleCondition,
            'caution': handleCaution,
            'triggers': handleTriggers, 'trigger': handleTriggers,
            'privacy': handlePrivacy,
            'sync': handleSync,
            'defaultstatus': handleDefaultStatus, 'ds': handleDefaultStatus,
            'defaultbattery': handleDefaultBattery, 'db': handleDefaultBattery,
            'mask': handleMask,
            'delete': handleDelete,
            'dormant': handleDormant,
            'id': handleId
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
        await utils.error(message, 'Not registered yet. Use `sys!system new` to create one.');
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
            ? 'Not registered yet.' : 'Not registered.');
    }
    const result = await utils.findEntity(alterName, system, 'alter');
    if (!result) return utils.error(message, `Alter **${alterName}** not found.`);
    const embed = await buildAlterEmbed(result.entity, system, parsed.full, message.author?.displayName);
    return message.reply({ embeds: [embed] });
}

async function handleNew(message, parsed) {
    const { system } = await utils.getOrCreateUserAndSystem(message);
    if (!await utils.requireSystem(message, system)) return;

    const name = parsed._positional.slice(1).join(' ') || parsed.name;
    if (!name) return utils.error(message, 'Please provide a name: `sys!alter new <n>`');

    const indexable = name.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || undefined;

    if (indexable) {
        const existing = await utils.findEntity(indexable, system, 'alter');
        if (existing) return utils.error(message, `An alter with the name **${indexable}** already exists.`);
    }

    const alter = new Alter({
        name: { ...(indexable && { indexable }), display: name },
        metadata: { addedAt: new Date() }
    });
    await utils.createAndLinkEntity(alter, system, 'alter');

    const embed = new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.success)
        .setTitle(`✅ ${system.alterSynonym?.singular || 'Alter'} Created!`)
        .setDescription(`**${name}** has been created.`)
        .addFields(
            { name: 'ID', value: `\`${alter._id}\``, inline: true },
            ...(indexable ? [{ name: 'Indexable Name', value: `\`${indexable}\``, inline: true }] : [])
        );
    return message.reply({ embeds: [embed] });
}

async function handleRename(message, parsed, alterName) {
    const { alter, system } = await getAlter(message, alterName);
    if (!alter) return;
    const newName = parsed._positional.slice(2).join(' ');
    if (!newName) return utils.error(message, 'Please provide a new name.');
    if (!utils.isValidIndexableName(newName)) return utils.error(message, 'Indexable names can only contain letters, numbers, dashes, and underscores.');
    // Check for duplicate indexable name within the system
    const existing = await utils.findEntity(newName, system, 'alter');
    if (existing && existing.entity._id.toString() !== alter._id.toString()) {
        return utils.error(message, `An alter with the name **${newName}** already exists.`);
    }
    alter.name.indexable = newName;
    await alter.save();
    await proxyMessageHandler.invalidateDisplayCache(alter._id);
    return utils.success(message, `Indexable name changed to **${newName}**`);
}

async function handleDisplayName(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.name.display = undefined; await alter.save(); await proxyMessageHandler.invalidateDisplayCache(alter._id); return utils.success(message, 'Display name cleared.'); }
    const newName = parsed._positional.slice(2).join(' ');
    if (!newName) return utils.error(message, 'Please provide a display name.');
    alter.name.display = newName;
    await alter.save();
    await proxyMessageHandler.invalidateDisplayCache(alter._id);
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
    if (parsed.clear) { if (alter.avatar?.r2Key) await utils.deleteFromR2(alter.avatar.r2Key, alter.avatar.bucket || 'app'); alter.avatar = undefined; await alter.save(); await proxyMessageHandler.invalidateDisplayCache(alter._id); return utils.success(message, 'Avatar cleared.'); }
    const attachment = message.attachments.first();
    const urlArg = parsed._positional[2];
    const result = await utils.handlePrefixMediaUpload(attachment, urlArg, 'avatar', 'Alter', message.author.id, 'app');
    if (!result.success) return utils.error(message, result.message);
    if (alter.avatar?.r2Key) await utils.deleteFromR2(alter.avatar.r2Key, alter.avatar.bucket || 'app');
    alter.avatar = result.media;
    await alter.save();
    await proxyMessageHandler.invalidateDisplayCache(alter._id);
    return utils.success(message, 'Avatar uploaded and updated.');
}

async function handleBanner(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    const syncWithDiscord = alter.syncWithApps?.discord;
    const bucket = utils.resolveUploadBucket(syncWithDiscord, 'discord');
    if (parsed.clear) { if (alter.discord?.image?.banner?.r2Key) await utils.deleteFromR2(alter.discord.image.banner.r2Key, alter.discord.image.banner.bucket || 'app'); if (alter.discord?.image) alter.discord.image.banner = undefined; await alter.save(); await proxyMessageHandler.invalidateDisplayCache(alter._id); return utils.success(message, 'Banner cleared.'); }
    const attachment = message.attachments.first();
    const urlArg = parsed._positional[2];
    const result = await utils.handlePrefixMediaUpload(attachment, urlArg, 'banner', 'Alter', message.author.id, bucket);
    if (!result.success) return utils.error(message, result.message);
    if (alter.discord?.image?.banner?.r2Key) await utils.deleteFromR2(alter.discord.image.banner.r2Key, alter.discord.image.banner.bucket || 'app');
    alter.discord = alter.discord || {}; alter.discord.image = alter.discord.image || {};
    alter.discord.image.banner = result.media;
    await alter.save();
    await proxyMessageHandler.invalidateDisplayCache(alter._id);
    return utils.success(message, 'Banner uploaded and updated.');
}

async function handleProxyAvatar(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    const syncWithDiscord = alter.syncWithApps?.discord;
    const bucket = utils.resolveUploadBucket(syncWithDiscord, 'discord');
    if (parsed.clear) { if (alter.discord?.image?.proxyAvatar?.r2Key) await utils.deleteFromR2(alter.discord.image.proxyAvatar.r2Key, alter.discord.image.proxyAvatar.bucket || 'app'); if (alter.discord?.image) alter.discord.image.proxyAvatar = undefined; await alter.save(); await proxyMessageHandler.invalidateDisplayCache(alter._id); return utils.success(message, 'Proxy avatar cleared.'); }
    const attachment = message.attachments.first();
    const urlArg = parsed._positional[2];
    const result = await utils.handlePrefixMediaUpload(attachment, urlArg, 'proxyAvatar', 'Alter', message.author.id, bucket);
    if (!result.success) return utils.error(message, result.message);
    if (alter.discord?.image?.proxyAvatar?.r2Key) await utils.deleteFromR2(alter.discord.image.proxyAvatar.r2Key, alter.discord.image.proxyAvatar.bucket || 'app');
    alter.discord = alter.discord || {}; alter.discord.image = alter.discord.image || {};
    alter.discord.image.proxyAvatar = result.media;
    await alter.save();
    await proxyMessageHandler.invalidateDisplayCache(alter._id);
    return utils.success(message, 'Proxy avatar uploaded and updated.');
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
    const { alter, system } = await getAlter(message, alterName);
    if (!alter) return;
    const action = parsed._positional[2]?.toLowerCase();
    if (parsed.clear || action === 'clear') { alter.proxy = []; await alter.save(); return utils.success(message, 'Proxy tags cleared.'); }
    if (action === 'add') {
        const tag = parsed._positional.slice(3).join(' ');
        if (!tag) return utils.error(message, 'Please provide a proxy tag.');
        const { exists, entity, type } = await utils.checkProxyExists(tag, system, alter._id.toString());
        if (exists) return utils.error(message, `Proxy \`${tag}\` is already used by ${type} **${utils.getDisplayName(entity)}**.`);
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
    const { exists, entity, type } = await utils.checkProxyExists(tag, system, alter._id.toString());
    if (exists) return utils.error(message, `Proxy \`${tag}\` is already used by ${type} **${utils.getDisplayName(entity)}**.`);
    const oldCount = alter.proxy?.length || 0;
    alter.proxy = [tag]; await alter.save();
    return utils.success(message, oldCount > 0
        ? `Proxy tag set to \`${tag}\` (replaced ${oldCount} previous proxy${oldCount > 1 ? 's' : ''}).`
        : `Proxy tag set to \`${tag}\`.`);
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
        gr.entity.alterIDs = gr.entity.alterIDs || [];
        if (!gr.entity.alterIDs.includes(alter._id.toString())) { gr.entity.alterIDs.push(alter._id.toString()); await gr.entity.save(); }
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
        gr.entity.alterIDs = gr.entity.alterIDs?.filter(id => id !== alter._id.toString()) || [];
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

async function handleClosedName(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.name.closedNameDisplay = undefined; await alter.save(); await proxyMessageHandler.invalidateDisplayCache(alter._id); return utils.success(message, 'Closed name display cleared.'); }
    const newName = parsed._positional.slice(2).join(' ');
    if (!newName) return utils.error(message, 'Please provide a closed name display.');
    alter.name.closedNameDisplay = newName;
    await alter.save();
    await proxyMessageHandler.invalidateDisplayCache(alter._id);
    return utils.success(message, `Closed name display set to **${newName}**`);
}

async function handleSync(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    const val = parsed._positional[2]?.toLowerCase();
    if (!val || !['true', 'false', 'on', 'off', 'yes', 'no'].includes(val)) return utils.error(message, 'Specify `true` or `false`.');
    alter.syncWithApps = alter.syncWithApps || {};
    alter.syncWithApps.discord = ['true', 'on', 'yes'].includes(val);
    await alter.save();
    return utils.success(message, `Discord sync is now **${alter.syncWithApps.discord ? 'enabled' : 'disabled'}**`);
}

async function handleDefaultStatus(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.setting = alter.setting || {}; alter.setting.default_status = undefined; await alter.save(); return utils.success(message, 'Default status cleared.'); }
    const status = parsed._positional.slice(2).join(' ');
    if (!status) return utils.error(message, 'Please provide a default status.');
    alter.setting = alter.setting || {};
    alter.setting.default_status = status;
    await alter.save();
    return utils.success(message, `Default status set to **${status}**`);
}

async function handleDefaultBattery(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    if (parsed.clear) { alter.setting = alter.setting || {}; alter.setting.default_battery = undefined; await alter.save(); return utils.success(message, 'Default battery cleared.'); }
    const val = parseInt(parsed._positional[2]);
    if (isNaN(val) || val < 0 || val > 100) return utils.error(message, 'Please provide a battery level (0-100).');
    alter.setting = alter.setting || {};
    alter.setting.default_battery = val;
    await alter.save();
    return utils.success(message, `Default battery set to **${val}**`);
}

async function handleTriggers(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    const action = parsed._positional[2]?.toLowerCase();
    if (action === 'add') {
        const trigger = parsed._positional.slice(3).join(' ');
        if (!trigger) return utils.error(message, 'Please provide a trigger.');
        alter.caution = alter.caution || {};
        alter.caution.triggers = alter.caution.triggers || [];
        alter.caution.triggers.push({ text: trigger });
        await alter.save();
        return utils.success(message, `Trigger \`${trigger}\` added.`);
    }
    if (action === 'remove') {
        const trigger = parsed._positional.slice(3).join(' ');
        if (!trigger) return utils.error(message, 'Please provide a trigger to remove.');
        alter.caution = alter.caution || {};
        alter.caution.triggers = alter.caution.triggers || [];
        const idx = alter.caution.triggers.findIndex(t => t.text?.toLowerCase() === trigger.toLowerCase());
        if (idx === -1) return utils.error(message, `Trigger \`${trigger}\` not found.`);
        alter.caution.triggers.splice(idx, 1);
        await alter.save();
        return utils.success(message, `Trigger \`${trigger}\` removed.`);
    }
    if (action === 'clear') {
        alter.caution = alter.caution || {};
        alter.caution.triggers = [];
        await alter.save();
        return utils.success(message, 'All triggers cleared.');
    }
    const triggers = alter.caution?.triggers || [];
    if (!triggers.length) return utils.info(message, 'No caution triggers set.');
    return utils.info(message, `Triggers: ${triggers.map(t => t.text || t).join(', ')}`);
}

async function handleMask(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    const field = parsed._positional[2]?.toLowerCase();
    if (!field) {
        const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.alter).setTitle('🎭 Mask Settings')
            .setDescription(`Use \`sys!alter <n> mask <field> <value>\`\nFields: name, displayname (dn), description, color, avatar, banner, proxyavatar (pav)`)
            .addFields(
                { name: 'Current Mask', value: `Name: ${alter.mask?.name?.display || alter.mask?.name?.indexable || '*not set*'}\nColor: ${alter.mask?.color || '*not set*'}\nDescription: ${alter.mask?.description || '*not set*'}`, inline: false }
            );
        return message.reply({ embeds: [embed] });
    }
    alter.mask = alter.mask || {};
    if (field === 'name') {
        const val = parsed._positional.slice(3).join(' ');
        if (!val) return utils.error(message, 'Please provide a mask name.');
        alter.mask.name = alter.mask.name || {};
        alter.mask.name.indexable = val.toLowerCase().replace(/[^a-z0-9\-_]/g, '') || undefined;
        alter.mask.name.display = val;
        await alter.save();
        await proxyMessageHandler.invalidateDisplayCache(alter._id);
        return utils.success(message, `Mask name set to **${val}**`);
    }
    if (field === 'displayname' || field === 'dn') {
        if (parsed.clear) { alter.mask.name = alter.mask.name || {}; alter.mask.name.display = undefined; await alter.save(); await proxyMessageHandler.invalidateDisplayCache(alter._id); return utils.success(message, 'Mask display name cleared.'); }
        const val = parsed._positional.slice(3).join(' ');
        if (!val) return utils.error(message, 'Please provide a mask display name.');
        alter.mask.name = alter.mask.name || {};
        alter.mask.name.display = val;
        await alter.save();
        await proxyMessageHandler.invalidateDisplayCache(alter._id);
        return utils.success(message, `Mask display name set to **${val}**`);
    }
    if (field === 'description' || field === 'desc') {
        if (parsed.clear) { alter.mask.description = undefined; await alter.save(); return utils.success(message, 'Mask description cleared.'); }
        const val = parsed._positional.slice(3).join(' ');
        if (!val) return utils.error(message, 'Please provide a mask description.');
        alter.mask.description = val;
        await alter.save();
        return utils.success(message, 'Mask description updated.');
    }
    if (field === 'color' || field === 'colour') {
        if (parsed.clear) { alter.mask.color = undefined; await alter.save(); return utils.success(message, 'Mask color cleared.'); }
        const val = utils.normalizeColor(parsed._positional[3]);
        if (!val) return utils.error(message, 'Please provide a valid hex color.');
        alter.mask.color = val;
        await alter.save();
        return utils.success(message, `Mask color set to **${val}**`);
    }
    if (field === 'avatar' || field === 'icon' || field === 'av' || field === 'pfp') {
        if (parsed.clear) { alter.mask.avatar = undefined; await alter.save(); await proxyMessageHandler.invalidateDisplayCache(alter._id); return utils.success(message, 'Mask avatar cleared.'); }
        const url = message.attachments.first()?.url || parsed._positional[3];
        if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
        alter.mask.avatar = { url };
        await alter.save();
        await proxyMessageHandler.invalidateDisplayCache(alter._id);
        return utils.success(message, 'Mask avatar updated.');
    }
    if (field === 'banner') {
        if (parsed.clear) { alter.mask.discord = alter.mask.discord || {}; alter.mask.discord.image = alter.mask.discord.image || {}; alter.mask.discord.image.banner = undefined; await alter.save(); await proxyMessageHandler.invalidateDisplayCache(alter._id); return utils.success(message, 'Mask banner cleared.'); }
        const url = message.attachments.first()?.url || parsed._positional[3];
        if (!url) return utils.error(message, 'Please provide a URL or upload an image.');
        alter.mask.discord = alter.mask.discord || {};
        alter.mask.discord.image = alter.mask.discord.image || {};
        alter.mask.discord.image.banner = { url };
        await alter.save();
        await proxyMessageHandler.invalidateDisplayCache(alter._id);
        return utils.success(message, 'Mask banner updated.');
    }
    if (field === 'proxyavatar' || field === 'pav') {
        if (parsed.clear) { alter.mask.discord = alter.mask.discord || {}; alter.mask.discord.image = alter.mask.discord.image || {}; alter.mask.discord.image.proxyAvatar = undefined; await alter.save(); await proxyMessageHandler.invalidateDisplayCache(alter._id); return utils.success(message, 'Mask proxy avatar cleared.'); }
        const url = message.attachments.first()?.url || parsed._positional[3];
        if (!url) return utils.error(message, 'Please provide a URL.');
        alter.mask.discord = alter.mask.discord || {};
        alter.mask.discord.image = alter.mask.discord.image || {};
        alter.mask.discord.image.proxyAvatar = { url };
        await alter.save();
        await proxyMessageHandler.invalidateDisplayCache(alter._id);
        return utils.success(message, 'Mask proxy avatar updated.');
    }
    return utils.error(message, `Unknown mask field: ${field}. Use: name, displayname, description, color, avatar, banner, proxyavatar`);
}

async function handlePrivacy(message, parsed, alterName) {
    const { alter } = await getAlter(message, alterName);
    if (!alter) return;
    const bucketArg = parsed._positional[2]?.toLowerCase();
    const field = parsed._positional[3]?.toLowerCase();
    const value = parsed._positional[4]?.toLowerCase();
    const validFields = ['description', 'avatar', 'banner', 'birthday', 'pronouns', 'metadata', 'proxies', 'caution', 'hidden', 'aliases'];
    if (!bucketArg || !validFields.includes(bucketArg)) {
        const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.alter).setTitle('🔒 Alter Privacy')
            .setDescription(`Use \`sys!alter <n> privacy <field> <public|private>\`\nor \`sys!alter <n> privacy bucket:<name> <field> <public|private>\`\nFields: ${validFields.join(', ')}`);
        return message.reply({ embeds: [embed] });
    }
    const bucketName = bucketArg.startsWith('bucket:') ? bucketArg.slice(7) : 'default';
    const actualField = bucketArg.startsWith('bucket:') ? field : bucketArg;
    const actualValue = bucketArg.startsWith('bucket:') ? value : field;
    if (!validFields.includes(actualField)) return utils.error(message, `Invalid field. Valid: ${validFields.join(', ')}`);
    if (!actualValue || !['public', 'private'].includes(actualValue)) return utils.error(message, 'Specify `public` or `private`.');
    alter.setting = alter.setting || {}; alter.setting.privacy = alter.setting.privacy || [];
    let priv = alter.setting.privacy.find(p => p.bucket === bucketName);
    if (!priv) { priv = { bucket: bucketName, settings: {} }; alter.setting.privacy.push(priv); }
    priv.settings[actualField] = actualValue === 'private'; await alter.save();
    return utils.success(message, `**${actualField}** is now **${actualValue}** in bucket **${bucketName}**`);
}

async function handleDelete(message, parsed, alterName) {
    const { alter, system } = await getAlter(message, alterName);
    if (!alter) return;
    if (!parsed.confirm) return utils.error(message, `⚠️ This will permanently delete **${alter.name?.display || alterName}**.\nConfirm: \`sys!alter ${alterName} delete -confirm\``);
    for (const gid of alter.groupsIDs || []) {
        const g = await Group.findById(gid);
        if (g) { g.alterIDs = g.alterIDs?.filter(id => id !== alter._id) || []; await g.save(); }
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

async function handleList(message, parsed) {
    const { system, targetUserId } = await utils.resolveTargetSystem(message, parsed);
    if (!system) return utils.error(message, targetUserId === message.author.id ? 'Not registered yet.' : 'Not registered.');
    const alters = await Alter.find({ _id: { $in: system.alters?.IDs || [] } });
    if (!alters.length) return utils.info(message, `No ${system.alterSynonym?.plural || 'alters'} found.`);
    const embed = new EmbedBuilder().setColor(utils.ENTITY_COLORS.system).setTitle(`${system.alterSynonym?.plural || 'Alters'} (${alters.length})`);
    if (parsed.full) {
        let desc = alters.slice(0, 25).map(a => {
            const name = a.name?.display || a.name?.indexable || '(no name)';
            const prx = a.proxy?.length ? ` • \`${a.proxy[0]}\`` : '';
            return `**${name}** (\`${a.name?.indexable || a._id}\`)${prx}`;
        }).join('\n');
        if (alters.length > 25) desc += `\n*...and ${alters.length - 25} more*`;
        embed.setDescription(desc);
    } else {
        embed.setDescription(alters.map(a => a.name?.display || a.name?.indexable || '(no name)').join(', '));
    }
    return message.reply({ embeds: [embed] });
}

async function handleHelp(message) {
    const embed = utils.buildHelpEmbed('alter', 'Manage alters/members in your profile.', [
        { usage: 'sys!alter <n>', description: 'Show alter info' },
        { usage: 'sys!alter new <n>', description: 'Create new alter' },
        { usage: 'sys!alter <n> rename <new>', description: 'Change indexable name' },
        { usage: 'sys!alter <n> displayname <n>', description: 'Set display name' },
        { usage: 'sys!alter <n> closedname <n>', description: 'Set closed name display' },
        { usage: 'sys!alter <n> description <text>', description: 'Set description' },
        { usage: 'sys!alter <n> avatar <url>', description: 'Set avatar' },
        { usage: 'sys!alter <n> pronouns <p, p>', description: 'Set pronouns' },
        { usage: 'sys!alter <n> proxy [add|remove] <tag>', description: 'Manage proxy tags' },
        { usage: 'sys!alter <n> color <hex>', description: 'Set color' },
        { usage: 'sys!alter <n> birthday <date>', description: 'Set birthday' },
        { usage: 'sys!alter <n> aliases [add|remove] <alias>', description: 'Manage aliases' },
        { usage: 'sys!alter <n> groups [add|remove] <group>', description: 'Manage groups' },
        { usage: 'sys!alter <n> condition <cond>', description: 'Set condition' },
        { usage: 'sys!alter <n> caution <type> [detail]', description: 'Set caution' },
        { usage: 'sys!alter <n> triggers add|remove <text>', description: 'Manage caution triggers' },
        { usage: 'sys!alter <n> privacy <field> <pub|priv>', description: 'Set privacy (default bucket)' },
        { usage: 'sys!alter <n> privacy bucket:<name> <field> <pub|priv>', description: 'Set privacy (named bucket)' },
        { usage: 'sys!alter <n> sync <true|false>', description: 'Toggle Discord sync' },
        { usage: 'sys!alter <n> defaultstatus <status>', description: 'Set default shift status' },
        { usage: 'sys!alter <n> defaultbattery <0-100>', description: 'Set default shift battery' },
        { usage: 'sys!alter <n> mask <field> <value>', description: 'Edit mask mode settings' },
        { usage: 'sys!alter <n> delete -confirm', description: 'Delete alter' },
        { usage: 'sys!alter list [-full]', description: 'List all alters' },
    ]);
    return message.reply({ embeds: [embed] });
}

async function buildAlterEmbed(alter, system, showFull = false, fallbackName = null) {
    // Resolve active states for display
    let displayName, description, color, avatarUrl, signoff, pronouns;
    if (alter.activeStates?.all?.length > 0) {
        const resolved = await utils.resolveAlterDisplay(alter, system);
        displayName = resolved.name || alter.name?.display || alter.name?.indexable || fallbackName || '(no name)';
        description = resolved.description || alter.description;
        color = resolved.color || alter.color || utils.ENTITY_COLORS.alter;
        avatarUrl = resolved.avatar || alter.avatar?.url;
        signoff = resolved.signoff || alter.signoff;
        pronouns = resolved.pronouns || alter.pronouns;
    } else {
        displayName = alter.name?.display || alter.name?.indexable || fallbackName || '(no name)';
        description = alter.description;
        color = alter.color || utils.ENTITY_COLORS.alter;
        avatarUrl = alter.avatar?.url;
        signoff = alter.signoff;
        pronouns = alter.pronouns;
    }

    const embed = new EmbedBuilder().setColor(color);
    if (alter.name?.indexable) embed.setAuthor({ name: alter.name.indexable, iconURL: avatarUrl });
    embed.setTitle(displayName);
    if (description) embed.setDescription(description);
    if (avatarUrl) embed.setThumbnail(avatarUrl);
    if (alter.discord?.image?.banner?.url) embed.setImage(alter.discord.image.banner.url);
    
    let info = '';
    if (pronouns?.length) info += `**Pronouns:** ${pronouns.join(', ')}\n`;
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
    return embed;
}

// ==== STATES HANDLERS ====

async function handleStates(message, parsed, alterName) {
    const { alter, system } = await getAlter(message, alterName);
    if (!alter) return;
    const action = parsed._positional[2]?.toLowerCase();
    const stateName = parsed._positional.slice(3).join(' ');

    if (action === 'add') {
        if (!stateName) return utils.error(message, 'Please provide a state name.');
        const st = await utils.findEntity(stateName, system, 'state');
        if (!st) return utils.error(message, `State **${stateName}** not found.`);
        alter.states = alter.states || [];
        const stateIdStr = st.entity._id.toString();
        if (alter.states.some(s => s.connected_id === stateIdStr)) return utils.error(message, 'Already connected.');
        alter.states.push({
            connected_id: stateIdStr,
            name: { indexable: st.entity.name?.indexable, display: st.entity.name?.display }
        });
        await alter.save();
        // Bidirectional: add alter to state.alters
        st.entity.alters = st.entity.alters || [];
        if (!st.entity.alters.includes(alter._id.toString())) {
            st.entity.alters.push(alter._id.toString());
            await st.entity.save();
        }
        return utils.success(message, `Connected to state **${st.entity.name?.display || stateName}**`);
    }

    if (action === 'remove') {
        if (!stateName) return utils.error(message, 'Please provide a state name.');
        const st = await utils.findEntity(stateName, system, 'state');
        if (!st) return utils.error(message, `State **${stateName}** not found.`);
        alter.states = alter.states || [];
        const stateIdStr = st.entity._id.toString();
        const idx = alter.states.findIndex(s => s.connected_id === stateIdStr);
        if (idx === -1) return utils.error(message, 'Not connected.');
        alter.states.splice(idx, 1);
        // Clean up active states if removing connected state
        if (alter.activeStates?.all?.length > 0) {
            alter.activeStates.all = alter.activeStates.all.filter(id => id !== stateIdStr);
            if (alter.activeStates.priority === stateIdStr) {
                alter.activeStates.priority = alter.activeStates.all[0] || null;
            }
        }
        await alter.save();
        // Bidirectional: remove alter from state.alters
        st.entity.alters = st.entity.alters || [];
        const alterIdx = st.entity.alters.indexOf(alter._id.toString());
        if (alterIdx !== -1) {
            st.entity.alters.splice(alterIdx, 1);
            await st.entity.save();
        }
        return utils.success(message, `Disconnected from state.`);
    }

    // List connected states
    alter.states = alter.states || [];
    if (alter.states.length === 0) return utils.info(message, 'No connected states.');
    const states = await State.find({ _id: { $in: alter.states.map(s => s.connected_id) } });
    const lines = states.map(s => {
        const name = s.name?.display || s.name?.indexable || '?';
        const isActive = alter.activeStates?.all?.includes(s._id.toString());
        const isPriority = alter.activeStates?.priority === s._id.toString();
        return `${isPriority ? '⭐' : (isActive ? '🟢' : '⚪')} **${name}**`;
    });
    return utils.info(message, `Connected states:\n${lines.join('\n')}`);
}

async function handleActiveStates(message, parsed, alterName) {
    const { alter, system } = await getAlter(message, alterName);
    if (!alter) return;
    const action = parsed._positional[2]?.toLowerCase();
    const stateName = parsed._positional.slice(3).join(' ');

    if (action === 'priority') {
        if (!stateName) return utils.error(message, 'Please provide a state name.');
        const st = await utils.findEntity(stateName, system, 'state');
        if (!st) return utils.error(message, `State **${stateName}** not found.`);
        const stateIdStr = st.entity._id.toString();
        if (!alter.states?.some(s => s.connected_id === stateIdStr)) {
            return utils.error(message, `**${st.entity.name?.display || stateName}** is not connected. Use \`sys!alter states ${alterName} add ${stateName}\` first.`);
        }
        if (!alter.activeStates) alter.activeStates = {};
        if (!alter.activeStates.all) alter.activeStates.all = [];
        // Ensure it's in the active list
        if (!alter.activeStates.all.includes(stateIdStr)) {
            alter.activeStates.all.unshift(stateIdStr);
        }
        // Move to front (priority = all[0])
        alter.activeStates.all = alter.activeStates.all.filter(id => id !== stateIdStr);
        alter.activeStates.all.unshift(stateIdStr);
        alter.activeStates.priority = stateIdStr;
        await alter.save();
        return utils.success(message, `Set **${st.entity.name?.display || stateName}** as priority state.`);
    }

    if (action === 'add') {
        if (!stateName) return utils.error(message, 'Please provide a state name.');
        const st = await utils.findEntity(stateName, system, 'state');
        if (!st) return utils.error(message, `State **${stateName}** not found.`);
        const stateIdStr = st.entity._id.toString();
        if (!alter.states?.some(s => s.connected_id === stateIdStr)) {
            return utils.error(message, `**${st.entity.name?.display || stateName}** is not connected. Use \`sys!alter states ${alterName} add ${stateName}\` first.`);
        }
        if (!alter.activeStates) alter.activeStates = {};
        if (!alter.activeStates.all) alter.activeStates.all = [];
        if (alter.activeStates.all.includes(stateIdStr)) return utils.error(message, 'Already active.');
        alter.activeStates.all.push(stateIdStr);
        if (!alter.activeStates.priority) alter.activeStates.priority = stateIdStr;
        await alter.save();
        return utils.success(message, `Activated **${st.entity.name?.display || stateName}**.`);
    }

    if (action === 'remove') {
        if (!stateName) return utils.error(message, 'Please provide a state name.');
        const st = await utils.findEntity(stateName, system, 'state');
        if (!st) return utils.error(message, `State **${stateName}** not found.`);
        const stateIdStr = st.entity._id.toString();
        if (!alter.activeStates?.all?.includes(stateIdStr)) return utils.error(message, 'Not active.');
        alter.activeStates.all = alter.activeStates.all.filter(id => id !== stateIdStr);
        if (alter.activeStates.priority === stateIdStr) {
            alter.activeStates.priority = alter.activeStates.all[0] || null;
        }
        await alter.save();
        return utils.success(message, `Deactivated **${st.entity.name?.display || stateName}**.`);
    }

    if (action === 'clear') {
        alter.activeStates = { priority: null, all: [] };
        await alter.save();
        return utils.success(message, 'Cleared all active states.');
    }

    // List active states
    alter.activeStates = alter.activeStates || { priority: null, all: [] };
    if (alter.activeStates.all.length === 0) return utils.info(message, 'No active states. Use `sys!alter activestates <name> add <state>` to activate one.');
    const states = await State.find({ _id: { $in: alter.activeStates.all } });
    const lines = alter.activeStates.all.map(id => {
        const s = states.find(st => st._id.toString() === id);
        const name = s?.name?.display || s?.name?.indexable || id;
        const isPriority = id === alter.activeStates.priority;
        return `${isPriority ? '⭐' : '🟢'} **${name}**`;
    });
    return utils.info(message, `Active states (priority first):\n${lines.join('\n')}`);
}