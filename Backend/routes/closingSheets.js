const express = require('express');
const router = express.Router();
const {
    getClosingSheet,
    saveClosingSheet
} = require('../controllers/closingSheetController');

const { protect } = require('../middleware/auth');

router.route('/')
    .get(protect, getClosingSheet)
    .post(protect, saveClosingSheet);

module.exports = router;
