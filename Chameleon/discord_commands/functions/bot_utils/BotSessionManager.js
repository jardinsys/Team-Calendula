// Staged session manager for bot onboarding/import flows.
// Uses shared sessions.js for TTL management, keyed by userId.
// Re-exported through the `bot_utils` barrel.

const { activeSessions, generateSessionId, setSession, deleteSession, getSession } = require('./sessions');
const path = require('path');
const { mergePrivacySettings } = require('../../../schemas/settings');

class BotSessionManager {
    static TTL_MS = 15 * 60 * 1000;

    /**
     * Start a new staged session for a user.
     * @param {string} userId - Discord user ID
     * @returns {string} sessionId
     */
    static start(userId) {
        this.clear(userId);
        const sessionId = generateSessionId(userId);
        const session = this.createEmpty();
        session.userId = userId;
        setSession(sessionId, session);
        return sessionId;
    }

    /**
     * Get the current session for a user.
     * @param {string} userId - Discord user ID
     * @returns {Object|null} session data or null
     */
    static get(userId) {
        for (const [sessionId, session] of activeSessions) {
            if (session.userId === userId) return session;
        }
        return null;
    }

    /**
     * Update session data by sessionId (used internally after start).
     * @param {string} sessionId - Session ID
     * @param {Object} patch - Partial session data to merge
     */
    static set(sessionId, patch) {
        const session = getSession(sessionId);
        if (!session) return null;
        Object.assign(session, patch);
        setSession(sessionId, session);
        return session;
    }

    /**
     * Clear a user's staged session.
     * @param {string} userId - Discord user ID
     */
    static clear(userId) {
        for (const [sessionId, session] of activeSessions) {
            if (session.userId === userId) {
                deleteSession(sessionId);
                break;
            }
        }
    }

    /**
     * Commit a staged session atomically.
     * Runs the callback with the built system payload, then clears the session.
     * @param {string} userId - Discord user ID
     * @param {Function} persistFn - Async function(payload) => { system, user }
     * @returns {Promise<Object>} Result from callback
     */
    static async commit(userId, persistFn) {
        const session = this.get(userId);
        if (!session) throw new Error('No active session for user');

        const payload = this.buildSystemPayload(session);
        try {
            const result = await persistFn(payload);
            this.clear(userId);
            return result;
        } catch (err) {
            this.clear(userId);
            throw err;
        }
    }

    /**
     * Build the full system payload from a session.
     * Mirrors the API's createSystemFromPayload structure.
     *
     * IMPORTANT: This payload is consumed by createSystemFromPayload which expects:
     * - privacyBuckets: array of { name, friends } objects (NOT strings)
     * - alters/states/groups: { entities: [...], conditions: [...], IDs: [...] }
     * - entities: array of full entity objects to be bulk-inserted
     * - IDs: array of IDs (will be populated after insert)
     * - conditions: array of { name, settings } objects
     */
    static buildSystemPayload(session) {
        const sysType = session.sysType || {};
        const flags = {
            isSystem: !!sysType.isSystem,
            isFragmented: !!sysType.isFragmented,
            isDissociative: !!sysType.isDissociative,
        };

        const name = session.systemName || '';
        const members = session.members || [];
        const states = session.states || [];
        const groups = session.groups || [];
        const shiftHistory = session.shifts || [];

        // Separate alters from states based on entityType
        const alters = members.filter((m) => m.entityType !== 'state');
        const stateEntities = members.filter((m) => m.entityType === 'state');

        // Build entity objects for bulk insert (createSystemFromPayload expects full objects)
        const alterEntities = alters.map((m) => ({
            name: {
                display: m.name,
                indexable: m.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 32) || `alter${Date.now()}`,
            },
            avatar: m.avatar || undefined,
            banner: m.banner || undefined,
            description: m.description || undefined,
            pronouns: m.pronouns || [],
            color: m.color || undefined,
            proxy: m.proxy || [],
            // Don't include _id - createSystemFromPayload will generate new ones
        }));

        const stateEntitites = stateEntities.map((s) => ({
            name: {
                display: s.name,
                indexable: s.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 32) || `state${Date.now()}`,
            },
            avatar: s.avatar || undefined,
            banner: s.banner || undefined,
            description: s.description || undefined,
            pronouns: s.pronouns || [],
            color: s.color || undefined,
            proxy: s.proxy || [],
        }));

        const groupEntities = groups.map((g) => ({
            name: {
                display: g.name,
                indexable: g.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 32) || `group${Date.now()}`,
            },
            description: g.description || undefined,
            color: g.color || undefined,
            avatar: g.avatar || undefined,
            banner: g.banner || undefined,
            alterIDs: [],
        }));

        const payload = {
            name: {
                display: name || 'My System',
                ...(name && { indexable: name.toLowerCase().replace(/[^a-z0-9]/g, '') }),
            },
            sys_type: {
                name: sysType.name || 'None',
                dd: sysType.dd || {},
                ...flags,
                dissociativeStateName: sysType.dissociativeStateName || 'Dissociated',
                onboardingCompleted: true,
            },
            // Privacy buckets as objects (NOT strings) - createSystemFromPayload creates them
            privacyBuckets: [
                { name: 'Strangers', friends: [] },
                { name: 'Friends', friends: [] }
            ],
            alters: {
                entities: alterEntities,
                conditions: alters.map((m) => ({
                    name: m.name,
                    settings: { hide_to_self: false, include_in_Count: true }
                })),
                IDs: [], // Will be populated by createSystemFromPayload after insert
            },
            states: {
                entities: stateEntitites,
                conditions: [...states, ...stateEntities].map((s) => ({
                    name: s.name,
                    settings: { hide_to_self: false, include_in_Count: true }
                })),
                IDs: [],
            },
            groups: {
                entities: groupEntities,
                conditions: groups.map((g) => ({
                    name: g.name,
                    settings: { hide_to_self: false, include_in_Count: true }
                })),
                IDs: [],
            },
            setting: {
                friendAutoBucket: 'Friends',
                privacy: [
                    {
                        bucket: 'Strangers',
                        settings: mergePrivacySettings('Strangers', 'system')
                    },
                    {
                        bucket: 'Friends',
                        settings: mergePrivacySettings('Friends', 'system')
                    },
                ],
            },
            front: {
                status: '',
                caution: '',
                layers: shiftHistory.length
                    ? [{
                        name: 'Main',
                        color: '#8b5cf6',
                        shifts: shiftHistory.map((s) => ({
                            ...s,
                            timestamp: typeof s.timestamp === 'number' ? new Date(s.timestamp) : s.timestamp,
                        })),
                    }]
                    : [],
            },
        };

        return payload;
    }

    /**
     * Create an empty session structure with all fields.
     * Matches the activity's userSystemSession hook structure.
     */
    static createEmpty() {
        return {
            type: null,
            step: null,
            userId: null,
            systemName: '',
            sysType: null,
            members: [],
            states: [],
            groups: [],
            shifts: [],
            front: {},
            privacyBuckets: {
                Strangers: { name: 'Strangers', friends: [] },
                Friends: { name: 'Friends', friends: [] },
            },
            import: {
                source: null,
                method: null,
                token: '',
                fileData: null,
                fileName: '',
                replace: false,
                skipExisting: false,
                noGroups: false,
                noSwitches: false,
                preview: null,
                selectedMemberIds: new Set(),
                selectedGroupIds: new Set(),
                memberEntityTypes: {},
                entityTypeMode: 'all_alters',
                searchQuery: '',
                importing: false,
                progressLogs: [],
                result: null,
                error: null,
            },
        };
    }
}

module.exports = BotSessionManager;