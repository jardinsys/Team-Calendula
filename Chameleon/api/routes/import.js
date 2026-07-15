const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const System = require('../../schemas/system');
const User = require('../../schemas/user');

const importFunctions = require('../../discord_commands/functions/import_functions');
const {
    importPluralKitAPI,
    importPluralKitFile,
    importSimplyPluralAPI,
    importOctoconAPI,
    importOctoconFile,
    importTupperboxFile,
    parseOctoconId,
    createBackup,
    getSourceEntityTerm,
    previewPluralKitAPI,
    previewPluralKitFile,
    previewSimplyPluralAPI,
    previewOctoconAPI,
    previewOctoconFile,
    previewTupperboxFile,
} = importFunctions;
const { importSimplyPluralFile, previewSimplyPluralFile } = require('../../discord_commands/functions/import/import_simplyplural_file');
const authActivity = require('../routes/auth');

/**
 * Decode avatarData array [{ id, name, data, contentType }] to a temp directory.
 * Returns the temp dir path, or null if no avatars.
 */
function decodeAvatarData(avatarData) {
    if (!Array.isArray(avatarData) || avatarData.length === 0) return null;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-avatars-'));
    for (const avatar of avatarData) {
        if (!avatar.id || !avatar.data) continue;
        const filename = avatar.name || `${avatar.id}.png`;
        const buffer = Buffer.from(avatar.data, 'base64');
        fs.writeFileSync(path.join(tmpDir, filename), buffer);
    }
    return tmpDir;
}

// POST /api/import — Import from external source
router.post('/', async (req, res) => {
    let avatarTmpDir = null;
    try {
        const { source, tokenOrId, options = {}, fileData, avatarData } = req.body;

        if (!source) {
            return res.status(400).json({ error: 'Missing required field: source' });
        }

        const validSources = ['pluralkit', 'simplyplural', 'octocon', 'tupperbox'];
        if (!validSources.includes(source)) {
            return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` });
        }

        // Validate required fields per source
        if (source === 'simplyplural' && !tokenOrId && !fileData) {
            return res.status(400).json({ error: 'Provide either tokenOrId (API) or fileData (file) for Simply Plural import' });
        }
        if (source === 'tupperbox' && !fileData) {
            return res.status(400).json({ error: 'Missing required field: fileData for Tupperbox import' });
        }
        if (source === 'pluralkit' && !tokenOrId && !fileData) {
            return res.status(400).json({ error: 'Provide either tokenOrId (API) or fileData (file) for PluralKit import' });
        }
        if (source === 'octocon' && !tokenOrId && !fileData) {
            return res.status(400).json({ error: 'Provide either tokenOrId (API) or fileData (file) for Octocon import' });
        }

        // Load system and user
        const user = await User.findById(req.user._id);
        if (!user || !user.systemID) {
            return res.status(404).json({ error: 'No system found. Please register first.' });
        }

        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'System not found.' });
        }

        // Build import options
        const importOptions = {
            replace: options.replace || false,
            skipExisting: options.skipExisting || false,
            noGroups: options.noGroups || false,
            noSwitches: options.noSwitches || false,
            stateNames: options.stateNames || [],
            target: options.target || 'app',
            forceAsStates: options.forceAsStates || false,
            overwriteAvatars: options.overwriteAvatars !== false,
            setFronters: options.setFronters || false,
        };

        // Create backup before import when possible
        if (typeof createBackup === 'function') {
            await createBackup(system, source);
        }

        // Decode avatar zip data to temp dir for SP file import
        if (avatarData && source === 'simplyplural' && fileData) {
            avatarTmpDir = decodeAvatarData(avatarData);
            if (avatarTmpDir) importOptions.avatarFolderPath = avatarTmpDir;
        }

        // Run import based on source and method
        let result;
        switch (source) {
            case 'pluralkit':
                if (fileData) {
                    result = await importPluralKitFile(system, user, fileData, importOptions);
                } else {
                    result = await importPluralKitAPI(system, user, tokenOrId, importOptions);
                }
                break;

            case 'simplyplural':
                if (fileData) {
                    result = await importSimplyPluralFile(system, user, fileData, importOptions);
                } else {
                    if (!tokenOrId) return res.status(400).json({ error: 'Missing tokenOrId' });
                    result = await importSimplyPluralAPI(system, user, tokenOrId, importOptions);
                }
                break;

            case 'octocon':
                if (fileData) {
                    result = await importOctoconFile(system, user, fileData, importOptions);
                } else {
                    const systemId = parseOctoconId(tokenOrId);
                    if (!systemId) {
                        return res.status(400).json({ error: 'Invalid Octocon system ID. Expected 7 characters or a URL like octocon.app/u/abcdefg.' });
                    }
                    result = await importOctoconAPI(system, user, systemId, importOptions);
                }
                break;

            case 'tupperbox':
                result = await importTupperboxFile(system, user, fileData, importOptions);
                break;
        }

        res.json({
            success: true,
            source,
            sourceTerm: getSourceEntityTerm(source),
            result
        });
    } catch (err) {
        console.error('[Import] API error:', err);
        res.status(500).json({ error: err.message || 'Import failed' });
    } finally {
        if (avatarTmpDir) fs.rm(avatarTmpDir, { recursive: true, force: true }, () => {});
    }
});

// POST /api/import/preview — Preview import data without writing
router.post('/preview', async (req, res) => {
    let avatarTmpDir = null;
    try {
        const { source, tokenOrId, fileData, options = {}, avatarData } = req.body;

        if (!source) return res.status(400).json({ error: 'Missing required field: source' });

        const validSources = ['pluralkit', 'simplyplural', 'octocon', 'tupperbox'];
        if (!validSources.includes(source)) {
            return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` });
        }

        // Prefer in-memory systemConfig from onboarding; fall back to DB for normal auth
        let system;
        if (options.systemConfig) {
            system = options.systemConfig;
        } else {
            const user = await User.findById(req.user._id);
            if (!user || !user.systemID) return res.status(404).json({ error: 'No system found.' });
            system = await System.findById(user.systemID);
            if (!system) return res.status(404).json({ error: 'System not found.' });
        }

        // Decode avatar zip data for SP preview
        if (avatarData && source === 'simplyplural' && fileData) {
            avatarTmpDir = decodeAvatarData(avatarData);
        }

        let preview;
        switch (source) {
            case 'pluralkit':
                if (fileData) {
                    preview = await previewPluralKitFile(system, fileData);
                } else {
                    if (!tokenOrId) return res.status(400).json({ error: 'Missing tokenOrId' });
                    preview = await previewPluralKitAPI(system, tokenOrId);
                }
                break;
            case 'simplyplural':
                if (fileData) {
                    preview = await previewSimplyPluralFile(system, fileData, avatarTmpDir ? { avatarFolderPath: avatarTmpDir } : {});
                } else {
                    if (!tokenOrId) return res.status(400).json({ error: 'Missing tokenOrId' });
                    preview = await previewSimplyPluralAPI(system, tokenOrId);
                }
                break;
            case 'octocon':
                if (fileData) {
                    preview = await previewOctoconFile(system, fileData);
                } else {
                    if (!tokenOrId) return res.status(400).json({ error: 'Missing tokenOrId' });
                    const systemId = parseOctoconId(tokenOrId);
                    if (!systemId) return res.status(400).json({ error: 'Invalid Octocon system ID.' });
                    preview = await previewOctoconAPI(system, systemId);
                }
                break;
            case 'tupperbox':
                if (!fileData) return res.status(400).json({ error: 'Missing fileData' });
                preview = await previewTupperboxFile(system, fileData);
                break;
        }

        const newCount = preview.members.filter(m => m.action === 'new').length;
        const updateCount = preview.members.filter(m => m.action === 'update').length;

        res.json({
            success: true,
            source,
            preview,
            counts: {
                total: preview.members.length,
                new: newCount,
                update: updateCount,
                groups: preview.groups.length,
            }
        });
    } catch (err) {
        console.error('[Import] Preview error:', err);
        res.status(500).json({ error: err.message || 'Preview failed' });
    } finally {
        if (avatarTmpDir) fs.rm(avatarTmpDir, { recursive: true, force: true }, () => {});
    }
});

// POST /api/import/stream — Import with SSE progress streaming
router.post('/stream', async (req, res) => {
    let avatarTmpDir = null;
    try {
        const { source, tokenOrId, options = {}, fileData, avatarData } = req.body;

        if (!source) {
            return res.status(400).json({ error: 'Missing required field: source' });
        }

        const validSources = ['pluralkit', 'simplyplural', 'octocon', 'tupperbox'];
        if (!validSources.includes(source)) {
            return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` });
        }

        if (source === 'simplyplural' && !tokenOrId && !fileData) {
            return res.status(400).json({ error: 'Provide either tokenOrId (API) or fileData (file) for Simply Plural import' });
        }
        if (source === 'tupperbox' && !fileData) {
            return res.status(400).json({ error: 'Missing required field: fileData for Tupperbox import' });
        }
        if (source === 'pluralkit' && !tokenOrId && !fileData) {
            return res.status(400).json({ error: 'Provide either tokenOrId (API) or fileData (file) for PluralKit import' });
        }
        if (source === 'octocon' && !tokenOrId && !fileData) {
            return res.status(400).json({ error: 'Provide either tokenOrId (API) or fileData (file) for Octocon import' });
        }

        let system;
        let user = null;
        if (options.systemConfig) {
            system = options.systemConfig;
            user = {
                _id: system._id || system.id || options.systemConfig._id,
                systemID: system._id || system.id,
                discordId: system.discordId || system._id,
                pronouns: system.pronouns || [],
                users: system.users && system.users.length > 0
                    ? system.users
                    : [{ _id: system._id || system.id, discordId: system.discordId || system._id, name: system.name?.display || 'System' }],
            };
        } else {
            user = await User.findById(req.user._id);
            if (!user || !user.systemID) {
                return res.status(404).json({ error: 'No system found. Please register first.' });
            }
            system = await System.findById(user.systemID);
            if (!system) {
                return res.status(404).json({ error: 'System not found.' });
            }
        }

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const sendEvent = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Progress callback — sends SSE events
        const onProgress = (event) => {
            sendEvent({ type: 'progress', ...event });
        };

        const importOptions = {
            replace: options.replace || false,
            skipExisting: options.skipExisting || false,
            noGroups: options.noGroups || false,
            noSwitches: options.noSwitches || false,
            stateNames: options.stateNames || [],
            target: options.target || 'app',
            forceAsStates: options.forceAsStates || false,
            overwriteAvatars: options.overwriteAvatars !== false,
            setFronters: options.setFronters || false,
            selectedMemberIds: options.selectedMemberIds ? new Set(options.selectedMemberIds) : undefined,
            selectedGroupIds: options.selectedGroupIds ? new Set(options.selectedGroupIds) : undefined,
            dryRun: !!options.systemConfig,
            onProgress,
        };

        if (typeof createBackup === 'function') {
            await createBackup(system, source);
        }

        // Decode avatar zip data to temp dir for SP file import
        if (avatarData && source === 'simplyplural' && fileData) {
            avatarTmpDir = decodeAvatarData(avatarData);
            if (avatarTmpDir) importOptions.avatarFolderPath = avatarTmpDir;
        }

        let result;
        switch (source) {
            case 'pluralkit':
                if (fileData) {
                    result = await importPluralKitFile(system, user, fileData, importOptions, onProgress);
                } else {
                    result = await importPluralKitAPI(system, user, tokenOrId, importOptions, onProgress);
                }
                break;

            case 'simplyplural':
                if (fileData) {
                    result = await importSimplyPluralFile(system, user, fileData, importOptions, onProgress);
                } else {
                    if (!tokenOrId) {
                        sendEvent({ type: 'error', message: 'Missing tokenOrId' });
                        return res.end();
                    }
                    result = await importSimplyPluralAPI(system, user, tokenOrId, importOptions, onProgress);
                }
                break;

            case 'octocon':
                if (fileData) {
                    result = await importOctoconFile(system, user, fileData, importOptions, onProgress);
                } else {
                    const systemId = parseOctoconId(tokenOrId);
                    if (!systemId) {
                        sendEvent({ type: 'error', message: 'Invalid Octocon system ID. Expected 7 characters or a URL like octocon.app/u/abcdefg.' });
                        return res.end();
                    }
                    result = await importOctoconAPI(system, user, systemId, importOptions, onProgress);
                }
                break;

            case 'tupperbox':
                result = await importTupperboxFile(system, user, fileData, importOptions, onProgress);
                break;
        }

        sendEvent({
            type: 'complete',
            source,
            sourceTerm: getSourceEntityTerm(source),
            result
        });

        res.end();
    } catch (err) {
        console.error('[Import] Stream error:', err);
        try {
            res.write(`data: ${JSON.stringify({ type: 'error', message: err.message || 'Import failed' })}\n\n`);
            res.end();
        } catch {
            res.status(500).end();
        }
    } finally {
        if (avatarTmpDir) fs.rm(avatarTmpDir, { recursive: true, force: true }, () => {});
    }
});

module.exports = router;
