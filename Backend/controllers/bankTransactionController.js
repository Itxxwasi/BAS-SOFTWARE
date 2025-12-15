const asyncHandler = require('../middleware/async');
const BankTransaction = require('../models/BankTransaction');
const LedgerEntry = require('../models/LedgerEntry');
const Ledger = require('../models/Ledger');

// @desc    Get all bank transactions
// @route   GET /api/v1/bank-transactions
// @access  Private (accounts access)
exports.getBankTransactions = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Build query
  let query = {};
  
  if (req.query.bankName) {
    query.bankName = req.query.bankName;
  }
  
  if (req.query.type) {
    query.type = req.query.type;
  }
  
  if (req.query.refType) {
    query.refType = req.query.refType;
  }
  
  if (req.query.partyId) {
    query.partyId = req.query.partyId;
  }
  
  if (req.query.startDate || req.query.endDate) {
    query.date = {};
    if (req.query.startDate) query.date.$gte = new Date(req.query.startDate);
    if (req.query.endDate) query.date.$lte = new Date(req.query.endDate);
  }

  const transactions = await BankTransaction.find(query)
    .populate('partyId', 'name email phone')
    .populate('createdBy', 'name')
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  const total = await BankTransaction.countDocuments(query);

  res.status(200).json({
    success: true,
    data: transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      prev: page > 1 ? { page: page - 1 } : null,
      next: page < Math.ceil(total / limit) ? { page: page + 1 } : null
    }
  });
});

// @desc    Get single bank transaction
// @route   GET /api/v1/bank-transactions/:id
// @access  Private (accounts access)
exports.getBankTransaction = asyncHandler(async (req, res) => {
  const transaction = await BankTransaction.findById(req.params.id)
    .populate('partyId', 'name email phone address')
    .populate('createdBy', 'name');

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'Bank transaction not found'
    });
  }

  res.status(200).json({
    success: true,
    data: transaction
  });
});

// @desc    Create bank transaction
// @route   POST /api/v1/bank-transactions
// @access  Private (accounts access)
exports.createBankTransaction = asyncHandler(async (req, res) => {
  const session = await BankTransaction.startSession();
  session.startTransaction();

  try {
    const { bankName, bankAccount, date, type, refType, refId, amount, narration, partyId } = req.body;

    // Get or create bank ledger
    const bankLedger = await Ledger.findOne({ 
      ledgerType: 'bank',
      ledgerName: bankName 
    });

    if (!bankLedger) {
      // Create bank ledger if it doesn't exist
      const newBankLedger = new Ledger({
        ledgerName: bankName,
        ledgerType: 'bank',
        openingBalance: 0,
        balanceType: 'debit',
        currentBalance: 0,
        createdBy: req.user.id
      });
      await newBankLedger.save({ session });
    }

    const ledger = bankLedger || newBankLedger;

    // Create bank transaction
    const transaction = new BankTransaction({
      bankName,
      bankAccount,
      date: date || new Date(),
      type,
      refType,
      refId,
      amount,
      narration,
      partyId,
      createdBy: req.user.id
    });

    await transaction.save({ session });

    // Create ledger entry for bank account
    const ledgerEntry = new LedgerEntry({
      ledgerId: ledger._id,
      date: transaction.date,
      debit: type === 'withdrawal' ? amount : 0,
      credit: type === 'deposit' ? amount : 0,
      narration,
      refType: `bank_${type}`,
      refId: transaction._id,
      createdBy: req.user.id
    });

    await ledgerEntry.save({ session });

    // Update bank ledger balance
    if (type === 'withdrawal') {
      ledger.currentBalance += amount;
    } else {
      ledger.currentBalance -= amount;
    }
    await ledger.save({ session });

    await session.commitTransaction();

    const populatedTransaction = await BankTransaction.findById(transaction._id)
      .populate('partyId', 'name email phone')
      .populate('createdBy', 'name');

    res.status(201).json({
      success: true,
      data: populatedTransaction
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Bank transaction creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during bank transaction creation'
    });
  } finally {
    session.endSession();
  }
});

// @desc    Update bank transaction
// @route   PUT /api/v1/bank-transactions/:id
// @access  Private (admin, manager)
exports.updateBankTransaction = asyncHandler(async (req, res) => {
  const session = await BankTransaction.startSession();
  session.startTransaction();

  try {
    const transaction = await BankTransaction.findById(req.params.id);

    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Bank transaction not found'
      });
    }

    const oldAmount = transaction.amount;
    const oldType = transaction.type;
    const { amount, type, narration, partyId } = req.body;

    // Update transaction
    const updatedTransaction = await BankTransaction.findByIdAndUpdate(
      req.params.id,
      { amount, type, narration, partyId },
      { new: true, runValidators: true, session }
    );

    // Update corresponding ledger entry
    const ledgerEntry = await LedgerEntry.findOne({
      refType: `bank_${oldType}`,
      refId: transaction._id
    });

    if (ledgerEntry) {
      // Reverse old entry
      const bankLedger = await Ledger.findById(ledgerEntry.ledgerId);
      if (oldType === 'withdrawal') {
        bankLedger.currentBalance -= oldAmount;
      } else {
        bankLedger.currentBalance += oldAmount;
      }

      // Apply new entry
      if (type === 'withdrawal') {
        bankLedger.currentBalance += amount;
        ledgerEntry.debit = amount;
        ledgerEntry.credit = 0;
      } else {
        bankLedger.currentBalance -= amount;
        ledgerEntry.debit = 0;
        ledgerEntry.credit = amount;
      }

      ledgerEntry.narration = narration;
      ledgerEntry.refType = `bank_${type}`;
      await ledgerEntry.save({ session });
      await bankLedger.save({ session });
    }

    await session.commitTransaction();

    const populatedTransaction = await BankTransaction.findById(updatedTransaction._id)
      .populate('partyId', 'name email phone')
      .populate('createdBy', 'name');

    res.status(200).json({
      success: true,
      data: populatedTransaction
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Bank transaction update error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during bank transaction update'
    });
  } finally {
    session.endSession();
  }
});

// @desc    Delete bank transaction
// @route   DELETE /api/v1/bank-transactions/:id
// @access  Private (admin only)
exports.deleteBankTransaction = asyncHandler(async (req, res) => {
  const session = await BankTransaction.startSession();
  session.startTransaction();

  try {
    const transaction = await BankTransaction.findById(req.params.id);

    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Bank transaction not found'
      });
    }

    // Update bank ledger balance
    const ledgerEntry = await LedgerEntry.findOne({
      refType: `bank_${transaction.type}`,
      refId: transaction._id
    });

    if (ledgerEntry) {
      const bankLedger = await Ledger.findById(ledgerEntry.ledgerId);
      if (transaction.type === 'withdrawal') {
        bankLedger.currentBalance -= transaction.amount;
      } else {
        bankLedger.currentBalance += transaction.amount;
      }
      await bankLedger.save({ session });
    }

    // Delete ledger entry
    await LedgerEntry.deleteOne(
      { refType: `bank_${transaction.type}`, refId: transaction._id },
      { session }
    );

    // Delete transaction
    await BankTransaction.findByIdAndDelete(req.params.id, { session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Bank transaction deleted successfully'
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Bank transaction deletion error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during bank transaction deletion'
    });
  } finally {
    session.endSession();
  }
});

// @desc    Get bank book summary
// @route   GET /api/v1/bank-transactions/summary
// @access  Private (accounts access)
exports.getBankBookSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate, bankName } = req.query;

  // Build date filter
  let dateFilter = {};
  if (startDate || endDate) {
    dateFilter.date = {};
    if (startDate) dateFilter.date.$gte = new Date(startDate);
    if (endDate) dateFilter.date.$lte = new Date(endDate);
  }

  // Build bank filter
  let bankFilter = dateFilter;
  if (bankName) {
    bankFilter.bankName = bankName;
  }

  // Get bank ledgers
  const bankLedgers = await Ledger.find({ ledgerType: 'bank' });
  const bankBalances = bankLedgers.reduce((acc, ledger) => {
    acc[ledger.ledgerName] = ledger.currentBalance;
    return acc;
  }, {});

  // Get transaction summary
  const summary = await BankTransaction.aggregate([
    { $match: bankFilter },
    {
      $group: {
        _id: { bankName: '$bankName', type: '$type' },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Get daily totals
  const dailyTotals = await BankTransaction.aggregate([
    { $match: bankFilter },
    {
      $group: {
        _id: { 
          bankName: '$bankName',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
        },
        deposits: {
          $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] }
        },
        withdrawals: {
          $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] }
        },
        net: { 
          $sum: { 
            $cond: [
              { $eq: ['$type', 'deposit'] }, 
              '$amount', 
              { $multiply: ['$amount', -1] }
            ] 
          } 
        }
      }
    },
    { $sort: { '_id.date': 1, '_id.bankName': 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      bankBalances,
      summary: summary.reduce((acc, item) => {
        const key = `${item._id.bankName}_${item._id.type}`;
        acc[key] = {
          totalAmount: item.totalAmount,
          count: item.count
        };
        return acc;
      }, {}),
      dailyTotals
    }
  });
});

// @desc    Get bank list
// @route   GET /api/v1/bank-transactions/banks
// @access  Private (accounts access)
exports.getBankList = asyncHandler(async (req, res) => {
  const banks = await BankTransaction.aggregate([
    {
      $group: {
        _id: '$bankName',
        totalTransactions: { $sum: 1 },
        totalDeposits: {
          $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] }
        },
        totalWithdrawals: {
          $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: banks
  });
});
