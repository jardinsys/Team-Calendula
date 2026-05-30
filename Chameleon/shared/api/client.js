import React from 'react'

class ApiClient {
    constructor() {
        this.token = null
        this.baseUrl = '/api'
    }

    setToken(token) {
        this.token = token
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

    async request(endpoint, options = {}) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: this.getHeaders()
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }))
            throw new Error(error.error || 'Request failed')
        }

        return response.json()
    }

    async getNotes(filter = 'all', tag, skip = 0, limit = 50) {
        const params = new URLSearchParams({ filter, skip, limit })
        if (tag) params.set('tag', tag)
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
}

const api = new ApiClient()
export default api
export { ApiClient }
