const express = require('express');
const router = express.Router();
const {
  getBankTransactions,
  getBankTransaction,
  createBankTransaction,
  updateBankTransaction,
  deleteBankTransaction,
  getBankBookSummary,
  getBankList
} = require('../controllers/bankTransactionController');
const { protect, accountsAccess, adminAccess, managerAccess } = require('../middleware/auth');

router
  .route('/')
  .get(protect, accountsAccess, getBankTransactions)
  .post(protect, accountsAccess, createBankTransaction);

router
  .route('/summary')
  .get(protect, accountsAccess, getBankBookSummary);

router
  .route('/banks')
  .get(protect, accountsAccess, getBankList);

router
  .route('/:id')
  .get(protect, accountsAccess, getBankTransaction)
  .put(protect, managerAccess, updateBankTransaction)
  .delete(protect, adminAccess, deleteBankTransaction);

module.exports = router;
