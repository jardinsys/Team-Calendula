const express = require('express');
const router = express.Router();
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
const authActivity = require('../routes/auth');

// POST /api/import — Import from external source
router.post('/', async (req, res) => {
    try {
        const { source, tokenOrId, options = {}, fileData } = req.body;

        if (!source) {
            return res.status(400).json({ error: 'Missing required field: source' });
        }

        const validSources = ['pluralkit', 'simplyplural', 'octocon', 'tupperbox'];
        if (!validSources.includes(source)) {
            return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` });
        }

        // Validate required fields per source
        if (source === 'simplyplural' && !tokenOrId) {
            return res.status(400).json({ error: 'Missing required field: tokenOrId for Simply Plural import' });
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
        };

        // Create backup before import
        await createBackup(system, source);

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
                result = await importSimplyPluralAPI(system, user, tokenOrId, importOptions);
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
    }
});

// POST /api/import/preview — Preview import data without writing
router.post('/preview', async (req, res) => {
    try {
        const { source, tokenOrId, fileData } = req.body;

        if (!source) return res.status(400).json({ error: 'Missing required field: source' });

        const validSources = ['pluralkit', 'simplyplural', 'octocon', 'tupperbox'];
        if (!validSources.includes(source)) {
            return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` });
        }

        const user = await User.findById(req.user._id);
        if (!user || !user.systemID) return res.status(404).json({ error: 'No system found.' });

        const system = await System.findById(user.systemID);
        if (!system) return res.status(404).json({ error: 'System not found.' });

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
                if (!tokenOrId) return res.status(400).json({ error: 'Missing tokenOrId' });
                preview = await previewSimplyPluralAPI(system, tokenOrId);
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
    }
});

// POST /api/import/stream — Import with SSE progress streaming
router.post('/stream', async (req, res) => {
    try {
        const { source, tokenOrId, options = {}, fileData } = req.body;

        if (!source) {
            return res.status(400).json({ error: 'Missing required field: source' });
        }

        const validSources = ['pluralkit', 'simplyplural', 'octocon', 'tupperbox'];
        if (!validSources.includes(source)) {
            return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` });
        }

        if (source === 'simplyplural' && !tokenOrId) {
            return res.status(400).json({ error: 'Missing required field: tokenOrId for Simply Plural import' });
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

        const user = await User.findById(req.user._id);
        if (!user || !user.systemID) {
            return res.status(404).json({ error: 'No system found. Please register first.' });
        }

        const system = await System.findById(user.systemID);
        if (!system) {
            return res.status(404).json({ error: 'System not found.' });
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
            onProgress,
        };

        await createBackup(system, source);

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
                result = await importSimplyPluralAPI(system, user, tokenOrId, importOptions, onProgress);
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
    }
});

module.exports = router;
