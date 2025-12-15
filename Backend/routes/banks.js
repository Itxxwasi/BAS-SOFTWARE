const express = require('express');
const router = express.Router();
const {
    getBanks,
    getBank,
    createBank,
    updateBank,
    deleteBank
} = require('../controllers/bankController');

const { protect, authorize } = require('../middleware/auth');

router.route('/')
    .get(protect, getBanks)
    .post(protect, authorize('admin', 'manager'), createBank);

router.route('/:id')
    .get(protect, getBank)
    .put(protect, authorize('admin', 'manager'), updateBank)
    .delete(protect, authorize('admin'), deleteBank);


module.exports = router;
