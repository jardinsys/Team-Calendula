class ApiClient {
    constructor() {
        this.token = typeof window !== 'undefined' ? localStorage.getItem('systemiser_token') : null
        this.baseUrl = '/api'
    }

    setToken(token) {
        this.token = token
        if (typeof window !== 'undefined') {
            if (token) {
                localStorage.setItem('systemiser_token', token)
            } else {
                localStorage.removeItem('systemiser_token')
            }
        }
    }

    setBaseUrl(url) {
        this.baseUrl = url
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' }
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`
        }
        return headers
    }

    loadTokenFromStorage() {
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('systemiser_token')
        }
    }

    async request(endpoint, options = {}) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: { ...this.getHeaders(), ...options.headers }
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }))
            throw new Error(error.error || 'Request failed')
        }

        return response.json()
    }

    // ═══════════════════════════════════════════
    // NOTES
    // ═══════════════════════════════════════════

    async getNotes(filter = 'all', tag, skip = 0, limit = 50, { entityId, entityType } = {}) {
        const params = new URLSearchParams({ filter, skip, limit })
        if (tag) params.set('tag', tag)
        if (entityId && entityType) {
            params.set('entityId', entityId)
            params.set('entityType', entityType)
        }
        return this.request(`/notes?${params}`)
    }

    async getNote(id) {
        return this.request(`/notes/${id}`)
    }

    async createNote(data) {
        return this.request('/notes', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updateNote(id, data) {
        return this.request(`/notes/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    }

    async deleteNote(id) {
        return this.request(`/notes/${id}`, {
            method: 'DELETE'
        })
    }

    async getNoteTags() {
        return this.request('/notes/tags')
    }

    async deleteNoteTag(tag) {
        return this.request(`/notes/tags/${encodeURIComponent(tag)}`, {
            method: 'DELETE'
        })
    }

    async shareNote(id, data) {
        return this.request(`/notes/${id}/share`, {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async unshareNote(id, data) {
        return this.request(`/notes/${id}/share`, {
            method: 'DELETE',
            body: JSON.stringify(data)
        })
    }

    async linkEntityToNote(id, data) {
        return this.request(`/notes/${id}/link`, {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async unlinkEntityFromNote(id, data) {
        return this.request(`/notes/${id}/link`, {
            method: 'DELETE',
            body: JSON.stringify(data)
        })
    }

    // Quick notes (convenience wrappers for backward compat)
    async getQuickNotes(limit = 10) {
        return this.request(`/notes?filter=all&limit=${limit}&sort=recent`)
    }

    async createQuickNote(data) {
        return this.createNote(data)
    }

    async appendToNote(id, content, attribution) {
        const body = { content }
        if (attribution) body.attribution = attribution
        return this.request(`/notes/${id}/append`, {
            method: 'PATCH',
            body: JSON.stringify(body)
        })
    }

    async getNoteHistory(id, skip = 0, limit = 20) {
        const params = new URLSearchParams({ skip, limit })
        return this.request(`/notes/${id}/history?${params}`)
    }

    // ═══════════════════════════════════════════
    // SYSTEM
    // ═══════════════════════════════════════════

    async getSystem() {
        return this.request('/system')
    }

    async getSystemFull() {
        return this.request('/system/full')
    }

    async getMe() {
        return this.request('/auth/me')
    }

    async updateSystem(data) {
        return this.request('/system', {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    }

    async updateSystemType(data) {
        return this.request('/system/type', {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    }

    async createSystem(data) {
        return this.request('/system', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    // ═══════════════════════════════════════════
    // ALTERS
    // ═══════════════════════════════════════════

    async getAlters() {
        return this.request('/alters')
    }

    async getAlterSummary() {
        return this.request('/alters/summary')
    }

    async getAlter(id, populate = false) {
        return this.request(`/alters/${id}${populate ? '?populate=true' : ''}`)
    }

    async createAlter(data) {
        return this.request('/alters', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updateAlter(id, data) {
        return this.request(`/alters/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    }

    async deleteAlter(id) {
        return this.request(`/alters/${id}`, {
            method: 'DELETE'
        })
    }

    // ═══════════════════════════════════════════
    // STATES
    // ═══════════════════════════════════════════

    async getStates() {
        return this.request('/states')
    }

    async getStateSummary() {
        return this.request('/states/summary')
    }

    async getState(id) {
        return this.request(`/states/${id}`)
    }

    async createState(data) {
        return this.request('/states', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updateState(id, data) {
        return this.request(`/states/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    }

    async deleteState(id) {
        return this.request(`/states/${id}`, {
            method: 'DELETE'
        })
    }

    // ═══════════════════════════════════════════
    // GROUPS
    // ═══════════════════════════════════════════

    async getGroups() {
        return this.request('/groups')
    }

    async getGroupSummary() {
        return this.request('/groups/summary')
    }

    async getGroup(id, populate = false) {
        return this.request(`/groups/${id}${populate ? '?populate=true' : ''}`)
    }

    async createGroup(data) {
        return this.request('/groups', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updateGroup(id, data) {
        return this.request(`/groups/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    }

    async deleteGroup(id) {
        return this.request(`/groups/${id}`, {
            method: 'DELETE'
        })
    }

    // ═══════════════════════════════════════════
    // FRONT
    // ═══════════════════════════════════════════

    async getFront() {
        return this.request('/front')
    }

    async getFrontHistory(limit = 20, before) {
        const params = new URLSearchParams({ limit })
        if (before) params.set('before', before)
        return this.request(`/front/history?${params}`)
    }

    async updateFrontStatus(data) {
        return this.request('/front/status', {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    }

    async getLayers() {
        return this.request('/front/layers')
    }

    async createLayer(data) {
        return this.request('/front/layers', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async deleteLayer(layerId) {
        return this.request(`/front/layers/${layerId}`, {
            method: 'DELETE'
        })
    }

    // ═══════════════════════════════════════════
    // QUICK SWITCH
    // ═══════════════════════════════════════════

    async getQuickSwitchEntities() {
        return this.request('/quick/switch')
    }

    async quickSwitch(entities, status, battery) {
        return this.request('/quick/switch', {
            method: 'POST',
            body: JSON.stringify({ entities, status, battery })
        })
    }

    async switchOut() {
        return this.request('/quick/switch/out', {
            method: 'POST'
        })
    }

    // ═══════════════════════════════════════════
    // FRIENDS
    // ═══════════════════════════════════════════

    async getFriends() {
        return this.request('/friends')
    }

    async getFriendFront(friendId) {
        return this.request(`/friends/${friendId}/front`)
    }

    async addFriend(data) {
        return this.request('/friends', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async removeFriend(friendId) {
        return this.request(`/friends/${friendId}`, {
            method: 'DELETE'
        })
    }

    async updateFriend(friendId, data) {
        return this.request(`/friends/${friendId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    }

    async getMyFriendId() {
        return this.request('/friends/my-id')
    }

    async blockUser(data) {
        return this.request('/friends/block', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async unblockUser(id) {
        return this.request(`/friends/block/${id}`, {
            method: 'DELETE'
        })
    }

    async getBlocked() {
        return this.request('/friends/blocked')
    }

    // ═══════════════════════════════════════════
    // ACTIVITY
    // ═══════════════════════════════════════════

    async getPendingActivityPage() {
        return this.request('/activity/pending-page')
    }
}

const api = new ApiClient()
export default api
export { ApiClient }

// ═══════════════════════════════════════════
// TERMINOLOGY HELPERS
// ═══════════════════════════════════════════

const NEUTRAL_TERMS = {
    label: 'Profile',
    title: '',
    error: 'Registration',
    ownership: 'profile',
    ownershipCap: 'Profile'
};

export function isSystemUser(system) {
    return !!system?.sys_type?.isSystem;
}

export function isFragmentedUser(system) {
    return !!system?.sys_type?.isFragmented;
}

export function isDissociativeUser(system) {
    return !!system?.sys_type?.isDissociative;
}

export function isBasicUser(system) {
    return !isSystemUser(system) && !isFragmentedUser(system) && !isDissociativeUser(system);
}

export function getSystemTerm(system, { context = 'label' } = {}) {
    if (!isSystemUser(system)) {
        return NEUTRAL_TERMS[context] || NEUTRAL_TERMS.label;
    }
    const synonym = system?.systemSynonym || 'system';
    switch (context) {
        case 'title': return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        case 'error': return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        case 'ownership': return synonym.toLowerCase();
        case 'ownershipCap': return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        case 'activity': return 'You';
        default: return synonym.charAt(0).toUpperCase() + synonym.slice(1);
    }
}

export function getAlterTerm(system, { plural = false } = {}) {
    return plural
        ? (system?.alterSynonym?.plural || 'alters')
        : (system?.alterSynonym?.singular || 'alter');
}

export function getStateTerm(system, { plural = false } = {}) {
    return plural ? 'states' : 'state';
}

export function getGroupTerm(system, { plural = false } = {}) {
    return plural ? 'groups' : 'group';
}
