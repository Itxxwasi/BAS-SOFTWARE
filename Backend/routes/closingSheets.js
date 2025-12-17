const express = require('express');
const router = express.Router();
const {
    getClosingSheet,
    saveClosingSheet,
    getIncomeStatementData,
    saveIncomeStatement
} = require('../controllers/closingSheetController');

const { protect } = require('../middleware/auth');

router.route('/income-statement')
    .get(protect, getIncomeStatementData)
    .post(protect, saveIncomeStatement);

router.route('/')
    .get(protect, getClosingSheet)
    .post(protect, saveClosingSheet);

module.exports = router;
