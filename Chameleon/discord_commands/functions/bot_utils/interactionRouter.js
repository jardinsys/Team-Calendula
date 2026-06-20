/**
 * Interaction Router — data-driven replacement for the if/else chain in bot.js
 *
 * Each route table maps customId prefixes to command lookup config.
 * Adding a new command prefix = one line per interaction type.
 */

const { MessageFlags } = require('discord.js');
const { handleNewUserButton, handleNewUserModal, handleNewUserNameModal } = require('./index');

// ─── Error reply helper ───────────────────────────────────────
async function replyWithError(interaction, message = 'Something went wrong.') {
	const payload = {
		content: message,
		flags: MessageFlags.Ephemeral,
	};
	if (interaction.replied || interaction.deferred) {
		await interaction.followUp(payload).catch(console.error);
	} else {
		await interaction.reply(payload).catch(console.error);
	}
}

// ─── Route tables ─────────────────────────────────────────────
// Each entry: prefix → { collection?, method? }
// 'collection' defaults to 'commands' (slash commands).
// 'method' defaults to the per-interaction-type default.

const BUTTON_ROUTES = {
	system:   {},
	alter:    {},
	state:    {},
	group:    {},
	front:    {},
	message:  {},
	profile:  {},
	note:     {},
	friend:   {},
	settings: {},
	whois:    {},
	import:   { collection: 'prefixCommands' },
};

const SELECT_ROUTES = {
	system:   {},
	alter:    {},
	state:    {},
	group:    {},
	front:    {},
	profile:  {},
	note:     {},
	friend:   {},
	settings: {},
	import:   { collection: 'prefixCommands', method: 'handleSelectMenuInteraction' },
};

const MODAL_ROUTES = {
	system:   {},
	alter:    {},
	state:    {},
	group:    {},
	front:    {},
	message:  {},
	profile:  {},
	note:     {},
	friend:   {},
	settings: {},
	import:   { collection: 'prefixCommands' },
};

// ─── Prefix extraction ────────────────────────────────────────

function getPrefix(customId) {
	const i = customId.indexOf('_');
	return i > 0 ? customId.substring(0, i) : null;
}

// ─── Generic router ───────────────────────────────────────────

async function routeInteraction(interaction, routes, defaultMethod) {
	const prefix = getPrefix(interaction.customId);
	if (!prefix || prefix === 'new_user') return false;

	const route = routes[prefix];
	if (!route) return false;

	const collection = interaction.client[route.collection || 'commands'];
	const cmd = collection?.get(prefix);
	const method = route.method || defaultMethod;

	if (cmd?.[method]) await cmd[method](interaction);
	return true;
}

// ─── Typed routers (handle special new_user_* cases inline) ───

async function routeButtonInteraction(interaction) {
	if (interaction.customId.startsWith('new_user_')) {
		return await handleNewUserButton(interaction);
	}
	return routeInteraction(interaction, BUTTON_ROUTES, 'handleButtonInteraction');
}

async function routeSelectInteraction(interaction) {
	if (interaction.customId.startsWith('new_user_disorder_')) {
		return await handleNewUserButton(interaction);
	}
	return routeInteraction(interaction, SELECT_ROUTES, 'handleSelectMenu');
}

async function routeModalInteraction(interaction) {
	if (interaction.customId.startsWith('new_user_other_modal_')) {
		return await handleNewUserModal(interaction);
	}
	if (interaction.customId.startsWith('new_user_name_modal_')) {
		return await handleNewUserNameModal(interaction);
	}
	return routeInteraction(interaction, MODAL_ROUTES, 'handleModalSubmit');
}

module.exports = {
	routeButtonInteraction,
	routeSelectInteraction,
	routeModalInteraction,
	replyWithError,
};
