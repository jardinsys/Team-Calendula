// Temporary in-memory session for bot onboarding/import.
// Keyed by Discord user ID; one active session per user for simplicity.
class BotSessionManager {
    constructor() {
        this.sessions = new Map()
        this.timeouts = new Map()
        this.TTL_MS = 15 * 60 * 1000
    }

    getKey(userId) {
        return `bot:${userId}`
    }

    start(userId) {
        this.clear(userId)
        const key = this.getKey(userId)
        this.sessions.set(key, this.createEmpty())
        this.setExpiry(key)
        return key
    }

    get(userId) {
        const key = this.getKey(userId)
        const session = this.sessions.get(key)
        if (!session) return null
        this.setExpiry(key)
        return session
    }

    set(key, patch) {
        const session = this.sessions.get(key)
        if (!session) return null
        Object.assign(session, patch)
        this.setExpiry(key)
        return session
    }

    clear(userId) {
        const key = this.getKey(userId)
        if (this.timeouts.has(key)) clearTimeout(this.timeouts.get(key))
        this.sessions.delete(key)
        this.timeouts.delete(key)
    }

    setExpiry(key) {
        if (this.timeouts.has(key)) clearTimeout(this.timeouts.get(key))
        const timeout = setTimeout(() => {
            this.sessions.delete(key)
            this.timeouts.delete(key)
        }, this.TTL_MS)
        this.timeouts.set(key, timeout)
    }

    /**
     * Commit the staged session to the database.
     * @param {string} userId - Discord user ID
     * @param {Function} persistFn - Async function(payload) => { system, user }
     * @returns {Promise<Object>} Created system
     */
    async commit(userId, persistFn) {
        const key = this.getKey(userId)
        const session = this.sessions.get(key)
        if (!session) throw new Error('No active session for user')
        
        const payload = this.buildSystemPayload(session)
        const result = await persistFn(payload)
        
        this.clear(userId)
        return result
    }

    buildSystemPayload(session) {
        const sysType = session.sysType || {}
        const flags = {
            isSystem: !!sysType.isSystem,
            isFragmented: !!sysType.isFragmented,
            isDissociative: !!sysType.isDissociative,
        }
        const name = session.systemName || ''
        const members = session.members || []
        const states = session.states || []
        const groups = session.groups || []
        const shiftHistory = session.shifts || []

        const payload = {
            name: {
                display: name || 'My System',
                ...(name && { indexable: name.toLowerCase().replace(/[^a-z0-9]/g, '') }),
            },
            sys_type: {
                name: sysType.name || 'None',
                dd: sysType.dd || {},
                ...flags,
                onboardingCompleted: true,
            },
            privacyBuckets: ['strangers_bucket', 'friends_bucket'],
            alters: {
                conditions: members
                    .filter((m) => m.entityType !== 'state')
                    .map((m) => ({ name: m.name, settings: { hide_to_self: false, include_in_Count: true } })),
                IDs: members
                    .filter((m) => m.entityType !== 'state')
                    .map((m) => m.id),
            },
            states: {
                conditions: states.map((s) => ({ name: s.name, settings: { hide_to_self: false, include_in_Count: true } })),
                IDs: states.map((s) => s.id),
            },
            groups: { conditions: groups.map((g) => ({ name: g.name, settings: { hide_to_self: false, include_in_Count: true } })), IDs: groups.map((g) => g.id) },
            setting: {
                friendAutoBucket: 'Friends',
                privacy: [
                    {
                        bucket: 'Strangers',
                        settings: { mask: false, description: false, banner: false, avatar: false, birthday: false, pronouns: false, metadata: false, caution: false, hidden: true },
                    },
                    {
                        bucket: 'Friends',
                        settings: { mask: false, description: true, banner: true, avatar: true, birthday: false, pronouns: true, metadata: false, caution: false, hidden: false },
                    },
                ],
            },
            front: {
                status: '',
                caution: '',
                layers: shiftHistory.length
                    ? [
                        {
                            _id: `layer_${Date.now()}`,
                            name: 'Active',
                            shifts: shiftHistory.map((s) => ({
                                ...s,
                                timestamp: typeof s.timestamp === 'number' ? new Date(s.timestamp) : s.timestamp,
                            })),
                        },
                    ]
                    : [],
            },
        }

        return payload
    }

    createEmpty() {
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
        }
    }
}

module.exports = new BotSessionManager()
