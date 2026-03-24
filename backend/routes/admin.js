const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { getUsage, getLogs, addCredits } = require('../services/adminService');

router.get('/usage', asyncHandler(async (req, res) => {
    const { data } = await getUsage();
    res.json(data);
}));

router.get('/logs', asyncHandler(async (req, res) => {
    const { data } = await getLogs();
    res.json(data);
}));

router.post('/add-credits', asyncHandler(async (req, res) => {
    const { clinicId, amount } = req.body;
    const { data } = await addCredits({ clinicId, amount });
    res.json({ success: true, ...data });
}));

module.exports = router;
