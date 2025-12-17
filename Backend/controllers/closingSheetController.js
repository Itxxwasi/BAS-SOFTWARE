const ClosingSheet = require('../models/ClosingSheet');
const CashSale = require('../models/CashSale');
const Expense = require('../models/Expense');
const MonthlyBalance = require('../models/MonthlyBalance');

// @desc    Get closing sheet by date and branch
// @route   GET /api/v1/closing-sheets
// @access  Private
exports.getClosingSheet = async (req, res) => {
    try {
        const { date, branch } = req.query;
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        const sheet = await ClosingSheet.findOne({
            date: { $gte: start, $lte: end },
            branch: branch || 'F-6'
        }).populate('departmentOpening.department').populate('closing01.departments.department');

        if (!sheet) {
            return res.status(200).json({ success: true, data: null }); // Return null if not found
        }
        res.status(200).json({ success: true, data: sheet });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Save (Upsert) closing sheet
// @route   POST /api/v1/closing-sheets
// @access  Private
exports.saveClosingSheet = async (req, res) => {
    try {
        const { date, branch, departmentOpening, closing01 } = req.body;

        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        let sheet = await ClosingSheet.findOne({
            date: { $gte: start, $lte: end },
            branch
        });

        if (sheet) {
            // Update existing
            if (departmentOpening) sheet.departmentOpening = departmentOpening;
            if (closing01) sheet.closing01 = closing01;
            if (req.body.closing02) sheet.closing02 = req.body.closing02;
            // Add other tabs here as they implemented
            await sheet.save();
        } else {
            // Create new
            sheet = await ClosingSheet.create(req.body);
        }

        res.status(200).json({ success: true, data: sheet });
    } catch (err) {
        console.error('Save Sheet Error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get Income Statement Data (Monthly Sales & Expenses)
// @route   GET /api/v1/closing-sheets/income-statement
// @access  Private
exports.getIncomeStatementData = async (req, res) => {
    try {
        const { date, branch } = req.query;
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const queryDate = new Date(date);
        // Start of month
        const startOfMonth = new Date(queryDate.getFullYear(), queryDate.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);

        // End of month
        const endOfMonth = new Date(queryDate.getFullYear(), queryDate.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        // 1. Fetch Cash Sales (Total Amount for 'Cash' mode in current month)
        const cashSalesResult = await CashSale.aggregate([
            {
                $match: {
                    date: { $gte: startOfMonth, $lte: endOfMonth },
                    branch: branch || 'F-6',
                    mode: 'Cash'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalAmount' }
                }
            }
        ]);
        const cashSaleTotal = cashSalesResult.length > 0 ? cashSalesResult[0].total : 0;

        // 2. Fetch Bank Sales (Total Amount for NON-Cash mode in current month)
        const bankSalesResult = await CashSale.aggregate([
            {
                $match: {
                    date: { $gte: startOfMonth, $lte: endOfMonth },
                    branch: branch || 'F-6',
                    mode: { $ne: 'Cash' }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalAmount' }
                }
            }
        ]);
        const bankSaleTotal = bankSalesResult.length > 0 ? bankSalesResult[0].total : 0;

        // 3. Fetch Expenses (Pay) - Type: 'expense'
        // Note: Expense model has 'branch' field, ensuring we filter by it.
        // Assuming Expenses linked to 'branch' (e.g. F-6). If default is 'Shop', might need to handle.
        // The user hasn't specified Expense branch logic, but usually expenses are branch specific.
        const payExpenses = await Expense.find({
            date: { $gte: startOfMonth, $lte: endOfMonth },
            // branch: branch || 'F-6', // Temporarily commented out branch filter for Expenses if schema defaults to 'Shop' or differs.
            // But strict filtering is safer. Let's check Expense model again. default: 'Shop'.
            // If the user selects F-6, we expect expenses for F-6.
            branch: branch || 'F-6',
            type: 'expense'
        }).select('date createdAt description head subHead amount expenseNo notes');

        console.log('DEBUG: PayExpenses count:', payExpenses.length);
        if (payExpenses.length > 0) {
            console.log('DEBUG: First PayExpense:', JSON.stringify(payExpenses[0], null, 2));
        }

        // 4. Fetch Income (Received) - Type: 'receipt'
        const incomeExpenses = await Expense.find({
            date: { $gte: startOfMonth, $lte: endOfMonth },
            branch: branch || 'F-6',
            type: 'receipt'
        });

        // 5. Fetch Opening Balance from MonthlyBalance
        let openingBalance = 0;
        const currentMonthString = `${queryDate.getFullYear()}-${String(queryDate.getMonth() + 1).padStart(2, '0')}`;
        const prevDate = new Date(queryDate.getFullYear(), queryDate.getMonth() - 1, 1);
        const prevMonthString = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        const currentMonthBalance = await MonthlyBalance.findOne({ branch: branch || 'F-6', monthString: currentMonthString });

        if (currentMonthBalance) {
            openingBalance = currentMonthBalance.openingBalance;
        } else {
            // Try previous month
            const prevMonthBalance = await MonthlyBalance.findOne({ branch: branch || 'F-6', monthString: prevMonthString });
            if (prevMonthBalance) {
                openingBalance = prevMonthBalance.closingBalance;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                cashSaleTotal,
                bankSaleTotal,
                payExpenses,
                incomeExpenses,
                openingBalance // Return fetched opening balance
            }
        });

    } catch (err) {
        console.error('Income Statement Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Save Income Statement Balances
// @route   POST /api/v1/closing-sheets/income-statement
// @access  Private
exports.saveIncomeStatement = async (req, res) => {
    try {
        const { date, branch, openingBalance, closingBalance } = req.body;

        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        const queryDate = new Date(date);
        const monthString = `${queryDate.getFullYear()}-${String(queryDate.getMonth() + 1).padStart(2, '0')}`;

        // Define Next Month
        const nextDate = new Date(queryDate.getFullYear(), queryDate.getMonth() + 1, 1);
        const nextMonthString = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

        // Upsert Current Month
        await MonthlyBalance.findOneAndUpdate(
            { branch: branch || 'F-6', monthString: monthString },
            {
                openingBalance: openingBalance,
                closingBalance: closingBalance,
                updatedAt: Date.now()
            },
            { upsert: true, new: true }
        );

        // Upsert Next Month (Set its Opening = Current Closing)
        // This ensures the chain continues
        await MonthlyBalance.findOneAndUpdate(
            { branch: branch || 'F-6', monthString: nextMonthString },
            {
                openingBalance: closingBalance,
                updatedAt: Date.now()
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ success: true, message: 'Income statement saved and balances updated' });
    } catch (err) {
        console.error('Save Income Statement Error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
