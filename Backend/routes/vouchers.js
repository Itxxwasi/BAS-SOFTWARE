const express = require('express');
const {
    getVouchers,
    getVoucher,
    createVoucher,
    updateVoucher,
    deleteVoucher
} = require('../controllers/voucherController');

const router = express.Router();

const { protect } = require('../middleware/auth');

router.use(protect);

router
    .route('/')
    .get(getVouchers)
    .post(createVoucher);

router
    .route('/:id')
    .get(getVoucher)
    .put(updateVoucher)
    .delete(deleteVoucher);

module.exports = router;
