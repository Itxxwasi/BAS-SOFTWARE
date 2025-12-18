const asyncHandler = require('../middleware/async');
const Ledger = require('../models/Ledger');
const BankTransaction = require('../models/BankTransaction');
const DailyCash = require('../models/DailyCash');
const Bank = require('../models/Bank');

// @desc    Get Detailed Bank Ledger Report
// @route   GET /api/v1/reports/bank-ledger
// @access  Private
exports.getBankLedgerReport = asyncHandler(async (req, res) => {
    const { startDate, endDate, bankId } = req.query;

    if (!bankId) {
        return res.status(400).json({ success: false, message: 'Please select a bank' });
    }

    const start = startDate ? new Date(startDate) : new Date(0);
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // 1. Get the Ledger
    const ledger = await Ledger.findById(bankId);
    if (!ledger) {
        return res.status(404).json({ success: false, message: 'Bank Ledger not found' });
    }

    // 2. Find the corresponding Bank document to link with DailyCash
    // We try to match by name or by refId if available
    const bankDoc = await Bank.findOne({ bankName: ledger.ledgerName });
    const bankDocId = bankDoc ? bankDoc._id : null;

    // 3. Fetch data from both sources (BankTransaction and DailyCash)

    // Payments/Manual entries
    const bankTransactions = await BankTransaction.find({
        bankName: ledger.ledgerName,
        date: { $gte: start, $lte: end }
    }).lean();

    // Deductions/Deposits (Only verified batches as requested)
    let dailyCashEntries = [];
    if (bankDocId) {
        dailyCashEntries = await DailyCash.find({
            bank: bankDocId,
            mode: 'Bank',
            isVerified: true,
            date: { $gte: start, $lte: end }
        }).lean();
    }

    // 4. Calculate Opening Balance (from LedgerEntry as it's the consolidated source for past data)
    // or we can calculate it relative to current balance if LedgerEntries exist.
    // However, the user wants entries "from screen", implying they might not all have ledger entries yet.
    // For now, let's use the Ledger's openingBalance as a base and add historical entries from these models.

    const histBT = await BankTransaction.aggregate([
        { $match: { bankName: ledger.ledgerName, date: { $lt: start } } },
        {
            $group: {
                _id: null,
                plus: { $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] } },
                minus: { $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] } }
            }
        }
    ]);

    let histDC = [{ plus: 0 }];
    if (bankDocId) {
        histDC = await DailyCash.aggregate([
            { $match: { bank: bankDocId, mode: 'Bank', isVerified: true, date: { $lt: start } } },
            {
                $group: {
                    _id: null,
                    plus: { $sum: '$totalAmount' } // Assuming totalAmount is net deposit
                }
            }
        ]);
    }

    const btStats = histBT[0] || { plus: 0, minus: 0 };
    const dcStats = histDC[0] || { plus: 0 };

    const openingBalance = (ledger.openingBalance || 0) + btStats.plus + dcStats.plus - btStats.minus;

    // 5. Transform and Combine current period entries
    const combined = [];

    bankTransactions.forEach(tx => {
        combined.push({
            date: tx.date,
            narration: tx.narration,
            refType: tx.type === 'deposit' ? 'Bank Receipt' : 'Bank Payment',
            debit: tx.type === 'deposit' ? tx.amount : 0,  // Plus
            credit: tx.type === 'withdrawal' ? tx.amount : 0, // Minus
            batchNo: tx.batchNo || '-',
            sortDate: new Date(tx.date).getTime()
        });
    });

    dailyCashEntries.forEach(dc => {
        // Daily Cash Deduction calculation matching frontend logic
        const ratePerc = dc.deductedAmount || 0;
        const grossBase = (dc.totalAmount || 0) + ratePerc;
        const deductionAmount = (grossBase * ratePerc) / 100;
        const netTotal = Math.round(grossBase - deductionAmount);

        combined.push({
            date: dc.date,
            narration: dc.remarks || `Daily Cash Deposit - Batch ${dc.batchNo || ''}`,
            refType: 'Bank Deduction',
            debit: netTotal, // Plus (Received)
            credit: 0,
            batchNo: dc.batchNo || '-',
            sortDate: new Date(dc.date).getTime()
        });
    });

    // 6. Sort and Calculate Running Balance
    combined.sort((a, b) => a.sortDate - b.sortDate);

    let runningBalance = openingBalance;
    const finalTransactions = combined.map(tx => {
        runningBalance = runningBalance + tx.debit - tx.credit;
        return {
            ...tx,
            balance: runningBalance
        };
    });

    res.status(200).json({
        success: true,
        data: {
            bankName: ledger.ledgerName,
            openingBalance,
            transactions: finalTransactions,
            closingBalance: runningBalance
        }
    });
});
