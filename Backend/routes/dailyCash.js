const express = require('express');
const router = express.Router();
const {
    getDailyCash,
    createDailyCash,
    updateDailyCash,
    deleteDailyCash
} = require('../controllers/dailyCashController');

const { protect } = require('../middleware/auth');

router.route('/')
    .get(protect, getDailyCash)
    .post(protect, createDailyCash);

router.route('/:id')
    .put(protect, updateDailyCash)
    .delete(protect, deleteDailyCash);

module.exports = router;
