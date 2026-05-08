const express = require('express');
const router = express.Router();
const { processCommand } = require('../services/aiCommandService');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');

/**
 * POST /api/ai/command
 * Process natural language command
 * Body: { command: string }
 */
router.post('/command', asyncHandler(async (req, res) => {
    const { command } = req.body;
    
    if (!command || typeof command !== 'string' || command.trim().length === 0) {
        throw new AppError('VALIDATION_ERROR', 'Command is required', 400);
    }
    
    if (command.length > 500) {
        throw new AppError('VALIDATION_ERROR', 'Command too long (max 500 characters)', 400);
    }
    
    const result = await processCommand(
        command.trim(),
        req.clinicId,
        { userId: req.user.userId, ip: req.ip }
    );
    
    res.json(result);
}));

module.exports = router;
