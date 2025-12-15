const express = require('express');
const router = express.Router();

// @desc    Health check endpoint
// @route   GET /api/v1/health
// @access  Public
router.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
