const express = require('express');
const router = express.Router();
const {
    getSupplierTaxes,
    createSupplierTax,
    updateSupplierTax,
    deleteSupplierTax
} = require('../controllers/supplierTaxController');

const { protect } = require('../middleware/auth');

router.use(protect);

router
    .route('/')
    .get(getSupplierTaxes)
    .post(createSupplierTax);

router
    .route('/:id')
    .put(updateSupplierTax)
    .delete(deleteSupplierTax);

module.exports = router;
