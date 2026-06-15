// Prefix command argument parsing extracted from `bot_utils/index.js`.
// Re-exported through the `bot_utils` barrel so all consumers keep the same API.

/* Parse prefix command arguments into structured data
 * Supports: key:value pairs, flags (-flag), quoted strings, and positional args
 * ALL KEYS AND FLAGS ARE CASE-INSENSITIVE
 *
 * Examples:
 *   "bird name:bird color:#FF0000" -> { _positional: ['bird'], name: 'bird', color: '#FF0000' }
 *   "bird -private" -> { _positional: ['bird'], private: true }
 *   'bird description:"Our little blue bird"' -> { _positional: ['bird'], description: 'Our little blue bird' }
 *
 * @param {string[]} args - Array of arguments from message.content.split(' ')
 * @returns {Object} Parsed arguments object
 */
function parseArgs(args) {
    const result = { _positional: [] };
    let i = 0;

    while (i < args.length) {
        const arg = args[i];

        // Handle flags: -private, -clear, -full (case-insensitive)
        if (arg.startsWith('-') && !arg.includes(':')) {
            const flagName = arg.slice(1).toLowerCase();
            result[flagName] = true;
            i++;
            continue;
        }

        // Handle key:value pairs (key is case-insensitive)
        if (arg.includes(':')) {
            const colonIndex = arg.indexOf(':');
            const key = arg.slice(0, colonIndex).toLowerCase();
            let value = arg.slice(colonIndex + 1);

            // Handle quoted values that might span multiple args
            if (value.startsWith('"') && !value.endsWith('"')) {
                const parts = [value.slice(1)];
                i++;
                while (i < args.length) {
                    if (args[i].endsWith('"')) {
                        parts.push(args[i].slice(0, -1));
                        break;
                    }
                    parts.push(args[i]);
                    i++;
                }
                value = parts.join(' ');
            } else if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }

            result[key] = value;
            i++;
            continue;
        }

        // Handle quoted positional arguments
        if (arg.startsWith('"')) {
            const parts = [arg.slice(1)];
            if (!arg.endsWith('"') || arg.length === 1) {
                i++;
                while (i < args.length) {
                    if (args[i].endsWith('"')) {
                        parts.push(args[i].slice(0, -1));
                        break;
                    }
                    parts.push(args[i]);
                    i++;
                }
            } else {
                parts[0] = arg.slice(1, -1);
            }
            result._positional.push(parts.join(' '));
            i++;
            continue;
        }

        // Regular positional argument (preserve original case for names)
        result._positional.push(arg);
        i++;
    }

    return result;
}

/* Extract target system from args (handles @mention, user ID, or defaults to self)
 * @param {Message} message - Discord message object
 * @param {Object} parsedArgs - Parsed arguments
 * @returns {Promise<{user: User, system: System, targetUserId: string}|null>}
 */
async function resolveTargetSystem(message, parsedArgs) {
    let targetUserId = message.author.id;

    // Check for @mention
    const mention = message.mentions.users.first();
    if (mention) {
        targetUserId = mention.id;
    }
    // Check for explicit user ID in args
    else if (parsedArgs.user) {
        targetUserId = parsedArgs.user;
    }
    // Check first positional for user ID pattern
    else if (parsedArgs._positional[0]?.match(/^\d{17,19}$/)) {
        targetUserId = parsedArgs._positional[0];
        parsedArgs._positional.shift();
    }

    const user = await User.findOne({ discordID: targetUserId });
    if (!user) {
        return { user: null, system: null, targetUserId };
    }

    const system = await System.findById(user.systemID);
    return { user, system, targetUserId };
}

module.exports = {
    parseArgs,
    resolveTargetSystem,
};
