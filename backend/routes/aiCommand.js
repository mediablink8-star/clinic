const express = require('express');
const router = express.Router();
const { processCommand } = require('../services/aiCommandService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * POST /api/ai/command
 * Process natural language command
 * Body: { command: string }
 */
router.post('/command', asyncHandler(async (req, res) => {
    const { command } = req.body;
    
    if (!command || typeof command !== 'string' || command.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Command is required'
        });
    }
    
    if (command.length > 500) {
        return res.status(400).json({
            success: false,
            error: 'Command too long (max 500 characters)'
        });
    }
    
    const result = await processCommand(
        command.trim(),
        req.clinicId,
        { userId: req.user.userId, ip: req.ip }
    );
    
    res.json(result);
}));

module.exports = router;
