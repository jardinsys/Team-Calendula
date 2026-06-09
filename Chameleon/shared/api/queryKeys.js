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