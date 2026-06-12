// sys!help - Show help for prefix commands
const { EmbedBuilder } = require('discord.js');
const utils = require('../../functions/bot_utils');

module.exports = {
    name: 'help',
    aliases: ['h', 'commands', 'cmds'],

    async executeMessage(message, args) {
        const parsed = utils.parseArgs(args);
        const topic = parsed._positional[0]?.toLowerCase();

        // If a specific topic is requested, show detailed help
        const topics = {
            'system': systemHelp,
            's': systemHelp,
            'alter': alterHelp,
            'a': alterHelp,
            'member': alterHelp,
            'm': alterHelp,
            'state': stateHelp,
            'st': stateHelp,
            'group': groupHelp,
            'g': groupHelp,
            'switch': frontHelp,
            'sw': frontHelp,
            'front': frontHelp,
            'autoproxy': autoproxyHelp,
            'ap': autoproxyHelp,
            'proxy': proxyHelp,
            'config': configHelp,
            'cfg': configHelp,
            'server': configHelp,
            'whois': whoisHelp,
            'who': whoisHelp,
            'note': noteHelp,
            'notes': noteHelp,
            'n': noteHelp,
            'import': importHelp,
            'imp': importHelp,
            'convert': convertHelp,
            'conv': convertHelp,
            'profile': profileHelp,
            'prof': profileHelp,
            'friend': friendHelp,
            'friends': friendHelp,
            'fr': friendHelp,
            'settings': configHelp
        };

        if (topic && topics[topic]) {
            return message.reply({ embeds: [topics[topic]()] });
        }

        // General help
        const embed = new EmbedBuilder()
            .setColor(utils.ENTITY_COLORS.info)
            .setTitle('🎡 Systemiser Prefix Commands')
            .setDescription(
                'Prefix commands use `sys!` or `sys;` followed by the command.\n' +
                'These are designed for power users who want quick, direct access.\n\n' +
                'For a more guided experience, use `/` slash commands.'
            )
            .addFields(
                {
                    name: '📋 Core Commands', value:
                        '`sys!system` - Manage your system\n' +
                        '`sys!alter` / `sys!a` - Manage alters\n' +
                        '`sys!state` / `sys!st` - Manage states\n' +
                        '`sys!group` / `sys!g` - Manage groups', inline: false
                },
                {
                    name: '🎭 Switching & Front', value:
                        '`sys!front` - Manage front status\n' +
                        '`sys!autoproxy` / `sys!ap` - Configure autoproxy\n' +
                        '*Use `/front` slash command for guided switching*', inline: false
                },
                {
                    name: '💬 Message Utilities', value:
                        '`sys!edit` / `sys!e` - Edit proxied messages\n' +
                        '`sys!reproxy` / `sys!rp` - Change who "sent" a message\n' +
                        '`sys!message` / `sys!msg` - Lookup message info', inline: false
                },
                {
                    name: '📥 Import & Export', value:
                        '`sys!import` - Import from PluralKit/Tupperbox/Simply Plural\n' +
                        '`sys!convert` - Convert alters ↔ states\n' +
                        '`sys!export` - Export your system data *(coming soon)*', inline: false
                },
                {
                    name: '📝 Notes', value:
                        '`sys!note` - Manage personal notes\n' +
                        '`sys!note new` - Create a note\n' +
                        '`sys!note search` - Search notes', inline: false
                },
                {
                    name: '🔍 Lookup & Social', value:
                        '`sys!whois` - Look up who sent a proxied message\n' +
                        '`sys!profile` - View user profile\n' +
                        '`sys!friend` - Manage friends\n' +
                        '`sys!find` - Search for members\n' +
                        '`sys!random` - Show a random member', inline: false
                },
                {
                    name: '⚙️ Server Config (Prefix Only)', value:
                        '`sys!config` - Server settings (admins only)\n' +
                        '*Channel restrictions, logging, proxy settings*', inline: false
                },
                {
                    name: '📖 Getting Help', value:
                        'Use `sys!help <topic>` for detailed help on a command.\n' +
                        'Example: `sys!help alter`\n\n' +
                        'Most commands also support `sys!<command> help`', inline: false
                }
            )
            .setFooter({ text: 'Use -clear flag to clear fields, -confirm for destructive actions' });

        return message.reply({ embeds: [embed] });
    }
};

function systemHelp() {
    return new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.system)
        .setTitle('📋 Profile Commands')
        .setDescription('Manage your profile settings.')
        .addFields(
            {
                name: 'View & Create', value:
                    '`sys!system` - View your system\n' +
                    '`sys!system [@user]` - View another\'s system\n' +
                    '`sys!system new [name]` - Create a system', inline: false
            },
            {
                name: 'Edit Info', value:
                    '`sys!system displayname <n>` - Set display name\n' +
                    '`sys!system closedname <n>` - Set closed name display\n' +
                    '`sys!system description <text>` - Set description\n' +
                    '`sys!system avatar <url>` - Set avatar\n' +
                    '`sys!system color <hex>` - Set color\n' +
                    '`sys!system tag <tags>` - Set system tags', inline: false
            },
            {
                name: 'Classification', value:
                    '`sys!system type <type>` - Set system type\n' +
                    '`sys!system dsm <type>` - Set DSM classification\n' +
                    '`sys!system icd <type>` - Set ICD classification\n' +
                    '`sys!system synonym <sing> <plur>` - Set alter synonyms', inline: false
            },
            {
                name: 'Proxy & Front', value:
                    '`sys!system cooldown <seconds>` - Set proxy cooldown\n' +
                    '`sys!system proxybreak <true|false>` - Toggle proxy break\n' +
                    '`sys!system proxylayout <type> <layout>` - Set proxy layout\n' +
                    '`sys!system proxystyle <off|last|front|state|name>` - Set proxy style\n' +
                    '`sys!system replystyle <embed|native>` - Set reply style\n' +
                    '`sys!system casesensitive <true|false>` - Toggle case sensitivity\n' +
                    '`sys!system frontstatus <status>` - Set front status\n' +
                    '`sys!system battery <0-100>` - Set system battery', inline: false
            },
            {
                name: 'Settings & Privacy', value:
                    '`sys!system sync <true|false>` - Toggle Discord sync\n' +
                    '`sys!system autoshare <true|false>` - Toggle auto-share notes\n' +
                    '`sys!system friendautobucket <name>` - Set friend auto-bucket\n' +
                    '`sys!system pronounseparator <char>` - Set pronoun separator\n' +
                    '`sys!system privacy <field> <pub|priv>` - Set privacy\n' +
                    '`sys!system privacy buckets list` - Manage privacy buckets', inline: false
            },
            {
                name: 'Mask & Conditions', value:
                    '`sys!system mask <field> <value>` - Edit mask mode\n' +
                    '`sys!system conditions <type> list|new|delete` - Manage conditions', inline: false
            },
            {
                name: 'Lists & Info', value:
                    '`sys!system list [-full]` - List alters\n' +
                    '`sys!system fronter` - Show current front\n' +
                    '`sys!system caution <type> [detail]` - Set system caution', inline: false
            }
        );
}

function alterHelp() {
    return new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.alter)
        .setTitle('🎭 Alter Commands')
        .setDescription('Manage system members.')
        .addFields(
            {
                name: 'View & Create', value:
                    '`sys!alter <n>` - View an alter\n' +
                    '`sys!alter new <n>` - Create an alter\n' +
                    '`sys!alter list [-full]` - List all alters', inline: false
            },
            {
                name: 'Edit Info', value:
                    '`sys!alter <n> displayname <n>` - Set display name\n' +
                    '`sys!alter <n> closedname <n>` - Set closed name display\n' +
                    '`sys!alter <n> description <text>` - Set description\n' +
                    '`sys!alter <n> avatar <url>` - Set avatar\n' +
                    '`sys!alter <n> color <hex>` - Set color\n' +
                    '`sys!alter <n> pronouns <p, p>` - Set pronouns\n' +
                    '`sys!alter <n> birthday <date>` - Set birthday', inline: false
            },
            {
                name: 'Proxy & Organization', value:
                    '`sys!alter <n> proxy [add|remove] <tag>` - Manage proxies\n' +
                    '`sys!alter <n> aliases [add|remove] <alias>` - Manage aliases\n' +
                    '`sys!alter <n> groups [add|remove] <group>` - Manage groups', inline: false
            },
            {
                name: 'Front & Settings', value:
                    '`sys!alter <n> sync <true|false>` - Toggle Discord sync\n' +
                    '`sys!alter <n> defaultstatus <status>` - Set default shift status\n' +
                    '`sys!alter <n> defaultbattery <0-100>` - Set default shift battery', inline: false
            },
            {
                name: 'Mask & Privacy', value:
                    '`sys!alter <n> mask <field> <value>` - Edit mask mode\n' +
                    '`sys!alter <n> privacy <field> <pub|priv>` - Set privacy\n' +
                    '`sys!alter <n> privacy bucket:<name> <field> <pub|priv>` - Per-bucket', inline: false
            },
            {
                name: 'Caution & Special', value:
                    '`sys!alter <n> caution <type> [detail]` - Set caution\n' +
                    '`sys!alter <n> triggers add|remove <text>` - Manage triggers\n' +
                    '`sys!alter <n> dormant` - Mark as dormant\n' +
                    '`sys!alter <n> delete -confirm` - Delete alter', inline: false
            }
        );
}

function stateHelp() {
    return new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.state)
        .setTitle('🔄 State Commands')
        .setDescription('Manage states (modes/conditions).')
        .addFields(
            {
                name: 'View & Create', value:
                    '`sys!state <n>` - View a state\n' +
                    '`sys!state new <n>` - Create a state\n' +
                    '`sys!state list [-full]` - List all states', inline: false
            },
            {
                name: 'Edit & Organize', value:
                    '`sys!state <n> displayname <n>` - Set display name\n' +
                    '`sys!state <n> closedname <n>` - Set closed name display\n' +
                    '`sys!state <n> description <text>` - Set description\n' +
                    '`sys!state <n> alters [add|remove] <alter>` - Link alters\n' +
                    '`sys!state <n> proxy [add|remove] <tag>` - Manage proxies', inline: false
            },
            {
                name: 'Front & Settings', value:
                    '`sys!state <n> sync <true|false>` - Toggle Discord sync\n' +
                    '`sys!state <n> defaultstatus <status>` - Set default shift status\n' +
                    '`sys!state <n> defaultbattery <0-100>` - Set default shift battery\n' +
                    '`sys!state <n> mask <field> <value>` - Edit mask mode', inline: false
            },
            {
                name: 'Caution & Privacy', value:
                    '`sys!state <n> caution <type> [detail]` - Set caution\n' +
                    '`sys!state <n> triggers add|remove <text>` - Manage triggers\n' +
                    '`sys!state <n> privacy <field> <pub|priv>` - Set privacy', inline: false
            },
            {
                name: 'Special', value:
                    '`sys!state <n> remission` - Mark as in remission\n' +
                    '`sys!state <n> delete -confirm` - Delete state', inline: false
            }
        );
}

function groupHelp() {
    return new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.group)
        .setTitle('👥 Group Commands')
        .setDescription('Manage groups of members.')
        .addFields(
            {
                name: 'View & Create', value:
                    '`sys!group <n>` - View a group\n' +
                    '`sys!group new <n>` - Create a group\n' +
                    '`sys!group list [-full]` - List all groups', inline: false
            },
            {
                name: 'Manage Members', value:
                    '`sys!group <n> add <member>...` - Add members\n' +
                    '`sys!group <n> remove <member>...` - Remove members\n' +
                    '`sys!group <n> members` - List members\n' +
                    '`sys!group <n> random` - Show random member', inline: false
            },
            {
                name: 'Edit Info', value:
                    '`sys!group <n> displayname <n>` - Set display name\n' +
                    '`sys!group <n> closedname <n>` - Set closed name display\n' +
                    '`sys!group <n> description <text>` - Set description\n' +
                    '`sys!group <n> type <name>` - Set group type\n' +
                    '`sys!group <n> canfront <yes|no>` - Toggle can front\n' +
                    '`sys!group <n> proxy [add|remove] <tag>` - Manage proxies', inline: false
            },
            {
                name: 'Front & Settings', value:
                    '`sys!group <n> sync <true|false>` - Toggle Discord sync\n' +
                    '`sys!group <n> defaultstatus <status>` - Set default shift status\n' +
                    '`sys!group <n> defaultbattery <0-100>` - Set default shift battery\n' +
                    '`sys!group <n> mask <field> <value>` - Edit mask mode', inline: false
            },
            {
                name: 'Caution & Privacy', value:
                    '`sys!group <n> caution <type> [detail]` - Set caution\n' +
                    '`sys!group <n> triggers add|remove <text>` - Manage triggers\n' +
                    '`sys!group <n> privacy <field> <pub|priv>` - Set privacy', inline: false
            }
        );
}

function frontHelp() {
    return new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.success)
        .setTitle('🔀 Front Commands')
        .setDescription('View and manage front status.')
        .addFields(
            {
                name: 'View', value:
                    '`sys!front` - View current front\n' +
                    '*(Use `/front` slash command for guided switching, quick mode, and layer management)*', inline: false
            }
        );
}

function autoproxyHelp() {
    return new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.info)
        .setTitle('🔄 Autoproxy Commands')
        .setDescription('Configure automatic proxying.')
        .addFields(
            {
                name: 'Modes', value:
                    '`sys!ap off` - Disable autoproxy\n' +
                    '`sys!ap front` - Proxy as current fronter\n' +
                    '`sys!ap latch` - Proxy as last manually proxied\n' +
                    '`sys!ap <member>` - Always proxy as specific member', inline: false
            },
            {
                name: 'Tips', value:
                    '• Start a message with `\\` to skip autoproxy once\n' +
                    '• Start with `\\\\` to skip and clear latch', inline: false
            }
        );
}

function proxyHelp() {
    return new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.info)
        .setTitle('💬 Proxy Format')
        .setDescription('How proxy tags work.')
        .addFields(
            {
                name: 'Format', value:
                    'Proxy tags use `text` as a placeholder for your message.\n' +
                    'Examples:\n' +
                    '• `bird:text` → `bird: Hello!` becomes a message\n' +
                    '• `text -b` → `Hello -b` becomes a message\n' +
                    '• `[text]` → `[Hello!]` becomes a message', inline: false
            },
            {
                name: 'Setting Proxies', value:
                    '`sys!alter <n> proxy <tag>` - Set proxy\n' +
                    '`sys!alter <n> proxy add <tag>` - Add proxy\n' +
                    '`sys!alter <n> proxy remove <tag>` - Remove proxy', inline: false
            }
        );
}

function configHelp() {
    return new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.system)
        .setTitle('⚙️ Server Config / Settings Commands')
        .setDescription('Configure Systemiser for this server.\n**Prefix aliases:** `sys!config`, `sys!settings`\n*Requires Manage Server permission or Systemiser admin role.*')
        .addFields(
            {
                name: 'General', value:
                    '`sys!config` - Show current settings\n' +
                    '`sys!config proxy <on|off>` - Enable/disable proxying\n' +
                    '`sys!config autoproxy <on|off>` - Allow/force-disable autoproxy\n' +
                    '`sys!config closedchar <on|off>` - Allow/restrict special characters\n' +
                    '`sys!config replystyle <off|embed|native>` - Force reply style', inline: false
            },
            {
                name: 'Channels', value:
                    '`sys!config channel list` - Show channel restrictions\n' +
                    '`sys!config channel blacklist #channel` - Block proxying\n' +
                    '`sys!config channel whitelist #channel` - Only allow proxying\n' +
                    '`sys!config channel remove #channel` - Remove from list\n' +
                    '`sys!config channel clear` - Clear all restrictions', inline: false
            },
            {
                name: 'Logging', value:
                    '`sys!config log #channel` - Set log channel\n' +
                    '`sys!config log off` - Disable logging\n' +
                    '`sys!config log events <proxy|edit|delete> <on|off>`', inline: false
            },
            {
                name: 'Admins', value:
                    '`sys!config admin list` - List bot admins\n' +
                    '`sys!config admin add @role|@user` - Add admin\n' +
                    '`sys!config admin remove @role|@user` - Remove admin', inline: false
            }
        );
}

function whoisHelp() {
    return new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.info)
        .setTitle('🔍 Whois Command')
        .setDescription('Look up who sent a proxied message.')
        .addFields(
            {
                name: 'Usage', value:
                    '`sys!whois <message_id>` - Look up by ID\n' +
                    '`sys!whois <message_link>` - Look up by link\n' +
                    '*(or reply to a proxied message)*', inline: false
            },
            {
                name: 'What It Shows', value:
                    '• Discord account that sent the message\n' +
                    '• System name (if available)\n' +
                    '• Alter/state/group that was used\n' +
                    '• Proxy tag used\n' +
                    '• When the message was sent', inline: false
            }
        );
}

function noteHelp() {
    return new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('📝 Note Commands')
        .setDescription('Quick note management. Use the Notes app for full editing, linking, sharing, and search.')
        .addFields(
            { name: 'View', value:
                '`sys!note` - List your notes\n' +
                '`sys!note <id>` - View a note', inline: false },
            { name: 'Create', value:
                '`sys!note new <title>` - Create a note\n' +
                '`sys!note new <title> content:<text>` - Create with content', inline: false },
            { name: 'Delete', value:
                '`sys!note <id> delete -confirm` - Delete a note', inline: false }
        );
}

function importHelp() {
    return new EmbedBuilder()
        .setColor('#00CED1')
        .setTitle('📥 Import Command')
        .setDescription('Import your system data from other platforms.')
        .addFields(
            {
                name: '🔷 PluralKit', value:
                    '**Via API (recommended):**\n' +
                    '`sys!import pluralkit <token>`\n' +
                    'Get token: DM PluralKit with `pk;token`\n\n' +
                    '**Via file:**\n' +
                    '`sys!import pluralkit` (attach file)\n' +
                    'Export with: `pk;export`', inline: false
            },
            {
                name: '📦 Tupperbox', value:
                    '`sys!import tupperbox` (attach file)\n' +
                    'Export with: `tul!export`', inline: false
            },
            {
                name: '💜 Simply Plural', value:
                    '`sys!import simplyplural <token>`\n' +
                    'Get token: Settings → Developer → Add Token', inline: false
            },
            {
                name: '🎯 Target Mode (Multi-Source)', value:
                    '`-target:app` - Import to main profile *(default)*\n' +
                    '`-target:discord` - Import to Discord fields\n\n' +
                    '**Example workflow:**\n' +
                    '1. `sys!import simplyplural <token>`\n' +
                    '2. `sys!import pluralkit <token> -target:discord`\n' +
                    '*Now you have SP data for app, PK data for Discord!*', inline: false
            },
            {
                name: '⚙️ Other Options', value:
                    '`-replace` - Replace all existing data\n' +
                    '`-skipexisting` - Skip existing members\n' +
                    '`-states:Name1,Name2` - Import these as states', inline: false
            }
        );
}

function convertHelp() {
    return new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🔄 Convert Command')
        .setDescription('Convert entities between alters and states.\n\n⚠️ Other platforms don\'t have "states" - use this after importing!')
        .addFields(
            {
                name: 'Single Conversion', value:
                    '`sys!convert alter <n> to state`\n' +
                    '`sys!convert state <n> to alter`', inline: false
            },
            {
                name: 'Batch Conversion', value:
                    '`sys!convert alters <n1,n2,n3> to states`\n' +
                    '`sys!convert states <n1,n2,n3> to alters`', inline: false
            },
            {
                name: 'Options', value:
                    '`-confirm` - Skip confirmation prompt\n' +
                    '`-keep` - Keep original (creates a copy)', inline: false
            },
            {
                name: 'What Transfers', value:
                    '✅ Name, description, avatar, pronouns\n' +
                    '✅ Proxy tags, color, groups\n' +
                    '🔄 Dormancy ↔ Remission status', inline: false
            }
        );
}

function profileHelp() {
    return new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.info)
        .setTitle('👤 Profile Commands')
        .setDescription('View and manage user profiles.')
        .addFields(
            {
                name: 'View', value:
                    '`sys!profile` - Show your profile\n' +
                    '`sys!profile @User` - Show another user\'s profile', inline: false
            },
            {
                name: 'Edit', value:
                    '`sys!profile edit displayname <name>` - Edit your profile display name', inline: false
            },
            {
                name: 'Notifications', value:
                    '`sys!profile edit notify` - View notification settings\n' +
                    '`sys!profile edit notify method <dm|command|none>` - Set delivery method\n' +
                    '`sys!profile edit notify friendreq <on|off>` - Toggle friend request alerts\n' +
                    '`sys!profile edit notify friendswitch <on|off>` - Toggle friend switch alerts\n' +
                    '`sys!profile edit notify appmessages <on|off>` - Toggle app message alerts', inline: false
            }
        );
}

function friendHelp() {
    return new EmbedBuilder()
        .setColor(utils.ENTITY_COLORS.info)
        .setTitle('👥 Friend Commands')
        .setDescription('Manage friends, view friend fronts, and handle requests.')
        .addFields(
            {
                name: 'List & View', value:
                    '`sys!friend` - List your friends\n' +
                    '`sys!friend view @User` - View a friend\'s front\n' +
                    '`sys!friend view` - Select a friend to view', inline: false
            },
            {
                name: 'Manage', value:
                    '`sys!friend add @User` - Send friend request\n' +
                    '`sys!friend add friend_id:abc` - Add by Friend ID\n' +
                    '`sys!friend remove @User -confirm` - Remove friend\n' +
                    '`sys!friend requests` - Accept/decline requests', inline: false
            },
            {
                name: 'Block', value:
                    '`sys!friend block @User` - Block a user\n' +
                    '`sys!friend unblock @User` - Unblock a user', inline: false
            },
            {
                name: 'Settings', value:
                    '`sys!friend settings` - View settings\n' +
                    '`sys!friend settings defaultbucket <name>` - Set auto-bucket', inline: false
            }
        );
}