const API_BASE = '/api';

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('systemiser_token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('systemiser_token', token);
        } else {
            localStorage.removeItem('systemiser_token');
        }
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async request(endpoint, options = {}) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    }

    // Auth
    async getMe() {
        return this.request('/auth/me');
    }

    // System
    async getSystem() {
        return this.request('/system');
    }

    async getSystemFull() {
        return this.request('/system/full');
    }

    async createSystem(data) {
        return this.request('/system', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateSystem(data) {
        return this.request('/system', {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    // Quick Switch
    async getQuickSwitch() {
        return this.request('/quick/switch');
    }

    async doQuickSwitch(data) {
        return this.request('/quick/switch', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Quick Notes
    async getQuickNotes() {
        return this.request('/quick/notes');
    }

    async createQuickNote(data) {
        return this.request('/quick/notes', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Alters
    async getAlters() {
        return this.request('/alters');
    }

    async getAlter(id) {
        return this.request(`/alters/${id}`);
    }

    async createAlter(data) {
        return this.request('/alters', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // States
    async getStates() {
        return this.request('/states');
    }

    async createState(data) {
        return this.request('/states', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Groups
    async getGroups() {
        return this.request('/groups');
    }

    // Front
    async getFront() {
        return this.request('/front');
    }

    // Notes
    async getNotes() {
        return this.request('/notes');
    }

    async getNote(id) {
        return this.request(`/notes/${id}`);
    }

    // Friends
    async getFriends() {
        return this.request('/friends');
    }

    async getFriendFront(friendId) {
        return this.request(`/friends/${friendId}/front`);
    }
}

const api = new ApiClient();

module.exports = api;
module.exports.api = api;
module.exports.ApiClient = ApiClient;