export const noteKeys = {
    all: ['notes'],
    lists: () => [...noteKeys.all, 'list'],
    list: (filters) => [...noteKeys.lists(), filters],
    detail: (id) => [...noteKeys.all, 'detail', id],
    tags: () => [...noteKeys.all, 'tags'],
    quick: () => [...noteKeys.all, 'quick'],
};

export const systemKeys = {
    all: ['system'],
    detail: () => [...systemKeys.all, 'detail'],
    front: () => [...systemKeys.all, 'front'],
    layers: () => [...systemKeys.all, 'layers'],
};

export const alterKeys = {
    all: ['alters'],
    lists: () => [...alterKeys.all, 'list'],
    list: (filters) => [...alterKeys.lists(), filters],
    detail: (id) => [...alterKeys.all, 'detail', id],
    summary: () => [...alterKeys.all, 'summary'],
};

export const stateKeys = {
    all: ['states'],
    lists: () => [...stateKeys.all, 'list'],
    list: (filters) => [...stateKeys.lists(), filters],
    detail: (id) => [...stateKeys.all, 'detail', id],
    summary: () => [...stateKeys.all, 'summary'],
};

export const groupKeys = {
    all: ['groups'],
    lists: () => [...groupKeys.all, 'list'],
    list: (filters) => [...groupKeys.lists(), filters],
    detail: (id) => [...groupKeys.all, 'detail', id],
    summary: () => [...groupKeys.all, 'summary'],
};

export const friendKeys = {
    all: ['friends'],
    lists: () => [...friendKeys.all, 'list'],
    detail: (id) => [...friendKeys.all, 'detail', id],
    requests: () => [...friendKeys.all, 'requests'],
    blocked: () => [...friendKeys.all, 'blocked'],
    myId: () => [...friendKeys.all, 'myId'],
};

export const frontKeys = {
    all: ['front'],
    current: () => [...frontKeys.all, 'current'],
    history: (params) => [...frontKeys.all, 'history', params],
    layers: () => [...frontKeys.all, 'layers'],
};

export const quickKeys = {
    all: ['quick'],
    switch: () => [...quickKeys.all, 'switch'],
    notes: () => [...quickKeys.all, 'notes'],
};

export const privacyBucketKeys = {
    all: ['system', 'privacy-buckets'],
    list: () => [...privacyBucketKeys.all, 'list'],
    detail: (id) => [...privacyBucketKeys.all, 'detail', id],
};

// ==========================================
// EVENT → QUERY KEY MAPPING
// Used by the WebSocket handler to invalidate
// the correct React Query caches on real-time events.
// ==========================================

const ENTITY_KEY_MAP = {
    alter: alterKeys,
    state: stateKeys,
    group: groupKeys,
};

export function eventToKeys(event) {
    switch (event.type) {
        case 'front:switch':
        case 'front:update':
            return [frontKeys.all, systemKeys.front(), systemKeys.layers(), systemKeys.detail()];

        case 'entity:created':
            return [ENTITY_KEY_MAP[event.entityType]?.all, systemKeys.detail()].filter(Boolean);

        case 'entity:edited':
            return [
                ENTITY_KEY_MAP[event.entityType]?.all,
                ENTITY_KEY_MAP[event.entityType]?.detail(event.entityId),
                systemKeys.detail(),
            ].filter(Boolean);

        case 'entity:deleted':
            return [
                ENTITY_KEY_MAP[event.entityType]?.all,
                ENTITY_KEY_MAP[event.entityType]?.detail(event.entityId),
                systemKeys.detail(),
                groupKeys.all, // bidirectional group membership cleanup
            ].filter(Boolean);

        case 'note:created':
        case 'note:edited':
        case 'note:deleted':
            return [noteKeys.lists(), noteKeys.tags()];

        case 'friend:request':
        case 'friend:accepted':
        case 'friend:declined':
        case 'friend:removed':
            return [friendKeys.lists(), friendKeys.requests(), friendKeys.blocked()];

        case 'friend:blocked':
        case 'friend:unblocked':
            return [friendKeys.lists(), friendKeys.blocked()];

        case 'privacy-bucket:created':
        case 'privacy-bucket:updated':
        case 'privacy-bucket:deleted':
            return [privacyBucketKeys.list()];

        case 'system:updated':
        case 'system:created':
            return [systemKeys.all, frontKeys.all, alterKeys.all, stateKeys.all, groupKeys.all];

        default:
            return [];
    }
}