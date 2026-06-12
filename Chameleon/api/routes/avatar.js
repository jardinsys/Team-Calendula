const { uploadMediaToR2, deleteMediaFromR2 } = require('../../api/utils/r2');

const ENTITY_TYPES = {
    alter: { model: require('../../schemas/alter'), idField: 'alters', entityType: 'Alter' },
    state: { model: require('../../schemas/state'), idField: 'states', entityType: 'State' },
    group: { model: require('../../schemas/group'), idField: 'groups', entityType: 'Group' },
};

async function handleEntityImageUpload(req, res, entityType, field) {
    const config = ENTITY_TYPES[entityType];
    if (!config) return res.status(400).json({ error: 'Invalid entity type' });

    const User = require('../../schemas/user');
    const System = require('../../schemas/system');

    const user = await User.findById(req.user._id);
    const system = await System.findById(user?.systemID);
    if (!system) return res.status(404).json({ error: 'Not registered' });

    const ids = system[config.idField]?.IDs || [];
    if (!ids.includes(req.params.id)) {
        return res.status(404).json({ error: `${config.entityType} not found` });
    }

    const entity = await config.model.findById(req.params.id);
    if (!entity) return res.status(404).json({ error: `${config.entityType} not found` });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const existingMedia = getNestedValue(entity.toObject(), field);
    if (existingMedia?.r2Key) {
        await deleteMediaFromR2(existingMedia.r2Key);
    }

    const media = await uploadMediaToR2(
        req.file.buffer,
        req.file.originalname || 'image',
        req.file.mimetype,
        user.discordID || user._id.toString(),
        config.entityType,
        field.split('.').pop()
    );

    setNestedValue(entity, field, media);
    await entity.save();

    return res.json(entity);
}

async function handleEntityImageDelete(req, res, entityType, field) {
    const config = ENTITY_TYPES[entityType];
    if (!config) return res.status(400).json({ error: 'Invalid entity type' });

    const User = require('../../schemas/user');
    const System = require('../../schemas/system');

    const user = await User.findById(req.user._id);
    const system = await System.findById(user?.systemID);
    if (!system) return res.status(404).json({ error: 'Not registered' });

    const ids = system[config.idField]?.IDs || [];
    if (!ids.includes(req.params.id)) {
        return res.status(404).json({ error: `${config.entityType} not found` });
    }

    const entity = await config.model.findById(req.params.id);
    if (!entity) return res.status(404).json({ error: `${config.entityType} not found` });

    const existingMedia = getNestedValue(entity.toObject(), field);
    if (existingMedia?.r2Key) {
        await deleteMediaFromR2(existingMedia.r2Key);
    }

    setNestedValue(entity, field, undefined);
    await entity.save();

    return res.json(entity);
}

async function handleSystemImageUpload(req, res, field) {
    const User = require('../../schemas/user');
    const System = require('../../schemas/system');

    const user = await User.findById(req.user._id);
    if (!user?.systemID) return res.status(404).json({ error: 'Not registered' });

    const system = await System.findById(user.systemID);
    if (!system) return res.status(404).json({ error: 'Not registered' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const existingMedia = getNestedValue(system.toObject(), field);
    if (existingMedia?.r2Key) {
        await deleteMediaFromR2(existingMedia.r2Key);
    }

    const media = await uploadMediaToR2(
        req.file.buffer,
        req.file.originalname || 'image',
        req.file.mimetype,
        user.discordID || user._id.toString(),
        'System',
        field.split('.').pop()
    );

    setNestedValue(system, field, media);
    await system.save();

    return res.json(system);
}

async function handleSystemImageDelete(req, res, field) {
    const User = require('../../schemas/user');
    const System = require('../../schemas/system');

    const user = await User.findById(req.user._id);
    if (!user?.systemID) return res.status(404).json({ error: 'Not registered' });

    const system = await System.findById(user.systemID);
    if (!system) return res.status(404).json({ error: 'Not registered' });

    const existingMedia = getNestedValue(system.toObject(), field);
    if (existingMedia?.r2Key) {
        await deleteMediaFromR2(existingMedia.r2Key);
    }

    setNestedValue(system, field, undefined);
    await system.save();

    return res.json(system);
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setNestedValue(doc, path, value) {
    if (value === undefined) {
        const parentPath = path.split('.').slice(0, -1).join('.');
        const lastKey = path.split('.').pop();
        const parent = parentPath ? doc.get(parentPath) : doc;
        if (parent && typeof parent === 'object') {
            parent[lastKey] = undefined;
            if (parentPath) doc.markModified(parentPath);
        }
    } else {
        doc.set(path, value);
    }
}

module.exports = { handleEntityImageUpload, handleEntityImageDelete, handleSystemImageUpload, handleSystemImageDelete };