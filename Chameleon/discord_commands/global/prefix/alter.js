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
const {
    simpleField, nameField, mediaField, booleanField,
    nestedField, listField, proxyHandler, privacyHandler,
    idHandler, maskHandler
} = require('../../functions/bot_utils/entityHandlers');

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

        // Build handler map using factory functions (requires getter at call time)
        const handlers = {
            'rename': nameField(getAlterEntity, 'indexable', 'Indexable name', { validateIndexable: true, checkDuplicates: true, entityType: 'alter' }),
            'name': nameField(getAlterEntity, 'indexable', 'Indexable name', { validateIndexable: true, checkDuplicates: true, entityType: 'alter' }),
            'displayname': nameField(getAlterEntity, 'display', 'Display name'),
            'dn': nameField(getAlterEntity, 'display', 'Display name'),
            'closedname': nameField(getAlterEntity, 'closedNameDisplay', 'Closed name display'),
            'cn': nameField(getAlterEntity, 'closedNameDisplay', 'Closed name display'),
            'description': simpleField(getAlterEntity, 'description', 'Description'),
            'desc': simpleField(getAlterEntity, 'description', 'Description'),
            'avatar': mediaField(getAlterEntity, 'avatar', 'Avatar', { entityType: 'Alter', uploadFieldName: 'avatar' }),
            'icon': mediaField(getAlterEntity, 'avatar', 'Avatar', { entityType: 'Alter', uploadFieldName: 'avatar' }),
            'av': mediaField(getAlterEntity, 'avatar', 'Avatar', { entityType: 'Alter', uploadFieldName: 'avatar' }),
            'pfp': mediaField(getAlterEntity, 'avatar', 'Avatar', { entityType: 'Alter', uploadFieldName: 'avatar' }),
            'banner': mediaField(getAlterEntity, 'discord.image.banner', 'Banner', { syncBucket: true, entityType: 'Alter', uploadFieldName: 'banner' }),
            'proxyavatar': mediaField(getAlterEntity, 'discord.image.proxyAvatar', 'Proxy avatar', { syncBucket: true, entityType: 'Alter', uploadFieldName: 'proxyAvatar' }),
            'pav': mediaField(getAlterEntity, 'discord.image.proxyAvatar', 'Proxy avatar', { syncBucket: true, entityType: 'Alter', uploadFieldName: 'proxyAvatar' }),
            'color': simpleField(getAlterEntity, 'color', 'Color'),
            'colour': simpleField(getAlterEntity, 'color', 'Color'),
            'birthday': simpleField(getAlterEntity, 'birthday', 'Birthday', {
                parser: (val) => val?.toLowerCase() === 'today' ? new Date() : new Date(val),
                successMsg: (v) => `Birthday set to **${utils.formatDate(v)}**`,
                errorMsg: 'Please provide a date (YYYY-MM-DD or "today").'
            }),
            'bd': simpleField(getAlterEntity, 'birthday', 'Birthday', {
                parser: (val) => val?.toLowerCase() === 'today' ? new Date() : new Date(val),
                successMsg: (v) => `Birthday set to **${utils.formatDate(v)}**`,
                errorMsg: 'Please provide a date (YYYY-MM-DD or "today").'
            }),
            'bday': simpleField(getAlterEntity, 'birthday', 'Birthday', {
                parser: (val) => val?.toLowerCase() === 'today' ? new Date() : new Date(val),
                successMsg: (v) => `Birthday set to **${utils.formatDate(v)}**`,
                errorMsg: 'Please provide a date (YYYY-MM-DD or "today").'
            }),
            'pronouns': simpleField(getAlterEntity, 'pronouns', 'Pronouns', {
                parser: (val) => val.split(/[,]/).map(p => p.trim()).filter(Boolean),
                successMsg: (v) => `Pronouns set to **${v.join(', ')}**`
            }),
            'prns': simpleField(getAlterEntity, 'pronouns', 'Pronouns', {
                parser: (val) => val.split(/[,]/).map(p => p.trim()).filter(Boolean),
                successMsg: (v) => `Pronouns set to **${v.join(', ')}**`
            }),
            'proxy': proxyHandler(getAlterEntity),
            'signoff': simpleField(getAlterEntity, 'signoff', 'Sign-offs'),
            'sign': simpleField(getAlterEntity, 'signoff', 'Sign-offs'),
            'aliases': listField(getAlterEntity, 'name.aliases', 'Aliases'),
            'alias': listField(getAlterEntity, 'name.aliases', 'Aliases'),
            'groups': handleGroups,
            'group': handleGroups,
            'states': handleStates,
            'activestates': handleActiveStates,
            'as': handleActiveStates,
            'condition': simpleField(getAlterEntity, 'condition', 'Condition', { entityType: 'alter' }),
            'cond': simpleField(getAlterEntity, 'condition', 'Condition', { entityType: 'alter' }),
            'caution': simpleField(getAlterEntity, 'caution', 'Caution'),
            'triggers': listField(getAlterEntity, 'caution.triggers', 'Triggers', { matchKey: 'text', itemFactory: (text) => ({ text }) }),
            'trigger': listField(getAlterEntity, 'caution.triggers', 'Triggers', { matchKey: 'text', itemFactory: (text) => ({ text }) }),
            'privacy': privacyHandler(getAlterEntity, 'alter', ['description', 'avatar', 'banner', 'birthday', 'pronouns', 'metadata', 'proxies', 'caution', 'hidden', 'aliases'], utils.ENTITY_COLORS.alter),
            'sync': booleanField(getAlterEntity, 'syncWithApps.discord', 'Discord sync'),
            'defaultstatus': nestedField(getAlterEntity, 'setting', 'default_status', 'Default status'),
            'ds': nestedField(getAlterEntity, 'setting', 'default_status', 'Default status'),
            'defaultbattery': nestedField(getAlterEntity, 'setting', 'default_battery', 'Default battery', {
                parser: (v) => parseInt(v),
                validator: (v) => !isNaN(v) && v >= 0 && v <= 100,
                errorMsg: 'Please provide a battery level (0-100).'
            }),
            'db': nestedField(getAlterEntity, 'setting', 'default_battery', 'Default battery', {
                parser: (v) => parseInt(v),
                validator: (v) => !isNaN(v) && v >= 0 && v <= 100,
                errorMsg: 'Please provide a battery level (0-100).'
            }),
            'mask': maskHandler(getAlterEntity, 'alter', utils.ENTITY_COLORS.alter),
            'delete': handleDelete,
            'dormant': handleDormant,
            'id': idHandler(getAlterEntity),
        };

        if (handlers[subcommand]) {
            return handlers[subcommand](message, parsed, alterName);
        }
        return handleShow(message, parsed, alterName);
    }
};

// ── Getter wrappers ──────────────────────────────────────────────────────────

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

/** Getter wrapper that returns { entity, system } for factory functions */
async function getAlterEntity(message, alterName) {
    const result = await getAlter(message, alterName);
    return { entity: result.alter, system: result.system };
}

// ── Entity-specific handlers ─────────────────────────────────────────────────

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
    utils.publishDeleteEvent(system._id, 'alter', alter._id);
    return utils.success(message, `**${alter.name?.display || alterName}** deleted.`);
}

async function handleDormant(message, parsed, alterName) {
    const { alter, system } = await getAlter(message, alterName);
    if (!alter) return;
    alter.condition = 'Dormant'; await alter.save();
    await utils.ensureConditionExists(system, 'alter', 'Dormant');
    return utils.success(message, `**${alter.name?.display || alterName}** marked as dormant.`);
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
