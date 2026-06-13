// Convert Routes
// Batch entity conversion (alter <-> state)

const express = require('express');
const router = express.Router();

const System = require('../../schemas/system');
const User = require('../../schemas/user');
const { convertAltersToStates, convertStatesToAlters } = require('../../discord_commands/functions/convert_functions');

router.post('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const system = await System.findById(user?.systemID);
        if (!system) return res.status(404).json({ error: 'Not registered' });

        const { sourceType, targetType, names, keep } = req.body;
        if (!sourceType || !targetType || !Array.isArray(names) || !names.length) {
            return res.status(400).json({ error: 'sourceType, targetType, and names[] required' });
        }

        if (!['alter', 'state'].includes(sourceType) || !['alter', 'state'].includes(targetType)) {
            return res.status(400).json({ error: 'sourceType and targetType must be alter or state' });
        }
        if (sourceType === targetType) {
            return res.status(400).json({ error: 'sourceType and targetType must be different' });
        }

        let result;
        if (sourceType === 'alter' && targetType === 'state') {
            result = await convertAltersToStates(system, names, { keep: keep || false, confirm: true });
        } else {
            result = await convertStatesToAlters(system, names, { keep: keep || false, confirm: true });
        }

        res.json({ success: true, converted: result?.converted || names.length });
    } catch (err) {
        console.error('[Convert] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
