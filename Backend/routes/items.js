const express = require('express');
const router = express.Router();
const {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  getItemsByCategory,
  getCategories,
  getLowStockItems
} = require('../controllers/itemController');
const { protect, authorize } = require('../middleware/auth');
const { itemValidations, handleValidationErrors } = require('../middleware/validation');
const advancedResults = require('../middleware/advancedResults');
const Item = require('../models/Item');

// Re-route into other resource routers
// router.use('/:itemId/transactions', transactionRoutes);

router
  .route('/')
  .get(advancedResults(Item, ['company', 'class', 'subclass', 'supplier']), getItems)
  .post(protect, authorize('admin', 'manager'), itemValidations.create, handleValidationErrors, createItem);

// Specific routes MUST come before /:id route
router
  .route('/categories')
  .get(getCategories);

router
  .route('/category/:category')
  .get(getItemsByCategory);

router
  .route('/low-stock')
  .get(protect, getLowStockItems);

// Generic /:id route comes LAST
router
  .route('/:id')
  .get(getItem)
  .put(protect, authorize('admin', 'manager'), itemValidations.update, handleValidationErrors, updateItem)
  .delete(protect, authorize('admin', 'manager'), deleteItem);

module.exports = router;
