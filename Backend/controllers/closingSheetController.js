const ClosingSheet = require('../models/ClosingSheet');

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
