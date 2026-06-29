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
            body: JSON.stringify(data),
        })
    }

    async createSystemSession(data) {
        return this.request('/system', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async createSystemLayers(data) {
        return this.request('/system/layers', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    // ═══════════════════════════════════════════
    // ALTERS
    // ═══════════════════════════════════════════

    async getAlters(skip, limit) {
        const params = new URLSearchParams();
        if (skip !== undefined) params.set('skip', skip);
        if (limit !== undefined) params.set('limit', limit);
        const qs = params.toString();
        return this.request(`/alters${qs ? '?' + qs : ''}`)
    }

    async getAlterSummary(skip, limit) {
        const params = new URLSearchParams();
        if (skip !== undefined) params.set('skip', skip);
        if (limit !== undefined) params.set('limit', limit);
        const qs = params.toString();
        return this.request(`/alters/summary${qs ? '?' + qs : ''}`)
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

    async addAlterProxy(id, proxy) {
        return this.request(`/alters/${id}/proxy`, {
            method: 'POST',
            body: JSON.stringify({ proxy })
        })
    }

    async removeAlterProxy(id, proxy) {
        return this.request(`/alters/${id}/proxy`, {
            method: 'DELETE',
            body: JSON.stringify({ proxy })
        })
    }

    // ═══════════════════════════════════════════
    // STATES
    // ═══════════════════════════════════════════

    async getStates(skip, limit) {
        const params = new URLSearchParams();
        if (skip !== undefined) params.set('skip', skip);
        if (limit !== undefined) params.set('limit', limit);
        const qs = params.toString();
        return this.request(`/states${qs ? '?' + qs : ''}`)
    }

    async getStateSummary(skip, limit) {
        const params = new URLSearchParams();
        if (skip !== undefined) params.set('skip', skip);
        if (limit !== undefined) params.set('limit', limit);
        const qs = params.toString();
        return this.request(`/states/summary${qs ? '?' + qs : ''}`)
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

    async addStateProxy(id, proxy) {
        return this.request(`/states/${id}/proxy`, {
            method: 'POST',
            body: JSON.stringify({ proxy })
        })
    }

    async removeStateProxy(id, proxy) {
        return this.request(`/states/${id}/proxy`, {
            method: 'DELETE',
            body: JSON.stringify({ proxy })
        })
    }

    // ═══════════════════════════════════════════
    // GROUPS
    // ═══════════════════════════════════════════

    async getGroups(skip, limit) {
        const params = new URLSearchParams();
        if (skip !== undefined) params.set('skip', skip);
        if (limit !== undefined) params.set('limit', limit);
        const qs = params.toString();
        return this.request(`/groups${qs ? '?' + qs : ''}`)
    }

    async getGroupSummary(skip, limit) {
        const params = new URLSearchParams();
        if (skip !== undefined) params.set('skip', skip);
        if (limit !== undefined) params.set('limit', limit);
        const qs = params.toString();
        return this.request(`/groups/summary${qs ? '?' + qs : ''}`)
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

    async addGroupProxy(id, proxy) {
        return this.request(`/groups/${id}/proxy`, {
            method: 'POST',
            body: JSON.stringify({ proxy })
        })
    }

    async addGroupMembers(groupId, data) {
        return this.request(`/groups/${groupId}/members`, {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async removeGroupMembers(groupId, data) {
        return this.request(`/groups/${groupId}/members`, {
            method: 'DELETE',
            body: JSON.stringify(data)
        })
    }

    async removeGroupProxy(id, proxy) {
        return this.request(`/groups/${id}/proxy`, {
            method: 'DELETE',
            body: JSON.stringify({ proxy })
        })
    }

    // ═══════════════════════════════════════════
    // BATCH OPERATIONS
    // ═══════════════════════════════════════════

    async deleteAlters(ids) {
        return this.request('/alters', {
            method: 'DELETE',
            body: JSON.stringify({ ids })
        })
    }

    async updateAlters(ids, updates) {
        return this.request('/alters', {
            method: 'PATCH',
            body: JSON.stringify({ ids, updates })
        })
    }

    async deleteStates(ids) {
        return this.request('/states', {
            method: 'DELETE',
            body: JSON.stringify({ ids })
        })
    }

    async updateStates(ids, updates) {
        return this.request('/states', {
            method: 'PATCH',
            body: JSON.stringify({ ids, updates })
        })
    }

    async deleteGroups(ids) {
        return this.request('/groups', {
            method: 'DELETE',
            body: JSON.stringify({ ids })
        })
    }

    async updateGroups(ids, updates) {
        return this.request('/groups', {
            method: 'PATCH',
            body: JSON.stringify({ ids, updates })
        })
    }

    async convertEntities(sourceType, targetType, names, keep) {
        return this.request('/convert', {
            method: 'POST',
            body: JSON.stringify({ sourceType, targetType, names, keep })
        })
    }

    // ═══════════════════════════════════════════
    // FRONT
    // ═══════════════════════════════════════════

    async getFront() {
        return this.request('/front')
    }

    async getFrontHistory(limit = 100, before, from, to) {
        const params = new URLSearchParams({ limit })
        if (before) params.set('before', before)
        if (from) params.set('from', from)
        if (to) params.set('to', to)
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

    async guidedSwitch(data) {
        return this.request('/front/switch', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async addShiftToLayer(entityId, entityType, layerId, parentShiftId) {
        return this.request('/front/shift', {
            method: 'POST',
            body: JSON.stringify({ entityId, entityType, layerId, parentShiftId })
        })
    }

    async removeShift(shiftId) {
        return this.request(`/front/shift/${shiftId}`, {
            method: 'DELETE'
        })
    }

    async renameLayer(layerId, name, color) {
        return this.request(`/front/layers/${layerId}`, {
            method: 'PATCH',
            body: JSON.stringify({ name, color })
        })
    }

    async reorderLayers(layerIds) {
        return this.request('/front/layers/reorder', {
            method: 'PATCH',
            body: JSON.stringify({ layerIds })
        })
    }

    async addChildShift(parentShiftId, entityId, entityType) {
        return this.request(`/front/shift/${parentShiftId}/children`, {
            method: 'POST',
            body: JSON.stringify({ entityId, entityType })
        })
    }

    async removeChildShift(parentShiftId, childId) {
        return this.request(`/front/shift/${parentShiftId}/children/${childId}`, {
            method: 'DELETE'
        })
    }

    async updateShiftStatus(shiftId, data) {
        return this.request(`/front/shift/${shiftId}/status`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    }

    async updateShift(shiftId, data) {
        return this.request(`/front/shift/${shiftId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    }

    async deleteShift(shiftId) {
        return this.request(`/front/shift/${shiftId}`, {
            method: 'DELETE'
        })
    }

    async mergeShifts(shiftIds) {
        return this.request('/front/shift/merge', {
            method: 'POST',
            body: JSON.stringify({ shiftIds })
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

    async getFriends(skip, limit) {
        const params = new URLSearchParams();
        if (skip !== undefined) params.set('skip', skip);
        if (limit !== undefined) params.set('limit', limit);
        const qs = params.toString();
        return this.request(`/friends${qs ? '?' + qs : ''}`)
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

    async getBlocked(skip, limit) {
        const params = new URLSearchParams();
        if (skip !== undefined) params.set('skip', skip);
        if (limit !== undefined) params.set('limit', limit);
        const qs = params.toString();
        return this.request(`/friends/blocked${qs ? '?' + qs : ''}`)
    }

    async getFriendRequests(skip, limit) {
        const params = new URLSearchParams();
        if (skip !== undefined) params.set('skip', skip);
        if (limit !== undefined) params.set('limit', limit);
        const qs = params.toString();
        return this.request(`/friends/requests${qs ? '?' + qs : ''}`)
    }

    async acceptFriendRequest(index) {
        return this.request(`/friends/requests/${index}/accept`, {
            method: 'POST'
        })
    }

    async declineFriendRequest(index) {
        return this.request(`/friends/requests/${index}/decline`, {
            method: 'POST'
        })
    }

    // ═══════════════════════════════════════════
    // USER ACCOUNT
    // ═══════════════════════════════════════════

    async wipeData(keepFriends = false) {
        return this.request('/user/wipe', {
            method: 'POST',
            body: JSON.stringify({ confirm: true, keepFriends })
        })
    }

    async deleteAccount(systemName) {
        return this.request('/user/account', {
            method: 'DELETE',
            body: JSON.stringify({ confirm: true, systemName })
        })
    }

    async updateUserSettings(data) {
        return this.request('/user/settings', {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    }

    // ═══════════════════════════════════════════
    // IMAGE UPLOADS
    // ═══════════════════════════════════════════

    async uploadImage(endpoint, formData) {
        const headers = {}
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`
        }
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers,
            body: formData
        })
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Upload failed' }))
            throw new Error(error.error || 'Upload failed')
        }
        return response.json()
    }

    async removeImage(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        })
    }

    async uploadAvatar(type, id, file) {
        const formData = new FormData()
        formData.append('file', file)
        return this.uploadImage(`/${type}s/${id}/avatar`, formData)
    }

    async uploadBanner(type, id, file) {
        const formData = new FormData()
        formData.append('file', file)
        return this.uploadImage(`/${type}s/${id}/banner`, formData)
    }

    async uploadProxyAvatar(type, id, file) {
        const formData = new FormData()
        formData.append('file', file)
        return this.uploadImage(`/${type}s/${id}/proxyAvatar`, formData)
    }

    async removeAvatar(type, id) {
        return this.request(`/${type}s/${id}/avatar`, { method: 'DELETE' })
    }

    async removeBanner(type, id) {
        return this.request(`/${type}s/${id}/banner`, { method: 'DELETE' })
    }

    async removeProxyAvatar(type, id) {
        return this.request(`/${type}s/${id}/proxyAvatar`, { method: 'DELETE' })
    }

    async uploadSystemAvatar(file) {
        const formData = new FormData()
        formData.append('file', file)
        return this.uploadImage('/system/avatar', formData)
    }

    async uploadSystemBanner(file) {
        const formData = new FormData()
        formData.append('file', file)
        return this.uploadImage('/system/banner', formData)
    }

    async removeSystemAvatar() {
        return this.request('/system/avatar', { method: 'DELETE' })
    }

    async removeSystemBanner() {
        return this.request('/system/banner', { method: 'DELETE' })
    }

    // ═══════════════════════════════════════════
    // PUBLIC ENTITY VIEW
    // ═══════════════════════════════════════════

    async getPublicEntity(type, id) {
        return this.request(`/public/entity/${type}/${id}`)
    }

    // ═══════════════════════════════════════════
    // ACTIVITY
    // ═══════════════════════════════════════════

    async getPendingActivityPage() {
        return this.request('/activity/pending-page')
    }

    // ═══════════════════════════════════════════
    // IMPORT
    // ═══════════════════════════════════════════

    async importFromSource(source, tokenOrId, options = {}, fileData = null) {
        const body = { source, tokenOrId, options }
        if (fileData) body.fileData = fileData
        return this.request('/import', {
            method: 'POST',
            body: JSON.stringify(body)
        })
    }

    async previewImport(source, tokenOrId, fileData = null, options = {}) {
        const body = { source, tokenOrId, options }
        if (fileData) body.fileData = fileData
        return this.request('/import/preview', {
            method: 'POST',
            body: JSON.stringify(body),
        })
    }

    importFromSourceStream(source, tokenOrId, options = {}, fileData = null, onProgress, systemConfig) {
        const body = { source, tokenOrId, options }
        if (fileData) body.fileData = fileData
        if (systemConfig) body.systemConfig = systemConfig

        const controller = new AbortController()

        const promise = fetch(`${this.baseUrl}/import/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        }).then(async (response) => {
            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Import failed' }))
                throw new Error(err.error || 'Import failed')
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop()

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.slice(6))
                            if (event.type === 'progress' && onProgress) {
                                onProgress(event)
                            } else if (event.type === 'complete') {
                                return event
                            } else if (event.type === 'error') {
                                throw new Error(event.message)
                            }
                        } catch (e) {
                            if (e.message && !e.message.includes('JSON')) throw e
                        }
                    }
                }
            }

            throw new Error('Stream ended without completion')
        })

        promise.abort = () => controller.abort()
        return promise
    }

    // ═══════════════════════════════════════════
    // PRIVACY BUCKETS
    // ═══════════════════════════════════════════

    async getPrivacyBuckets() {
        return this.request('/system/privacy-buckets')
    }

    async createPrivacyBucket(data) {
        return this.request('/system/privacy-buckets', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updatePrivacyBucket(bucketId, data) {
        return this.request(`/system/privacy-buckets/${bucketId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
    }

    async deletePrivacyBucket(bucketId) {
        return this.request(`/system/privacy-buckets/${bucketId}`, {
            method: 'DELETE'
        })
    }

    async propagatePrivacyBucket(bucketId, options = {}) {
        return this.request(`/system/privacy-buckets/${bucketId}/propagate`, {
            method: 'POST',
            body: JSON.stringify(options)
        })
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
