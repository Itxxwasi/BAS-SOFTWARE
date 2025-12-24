const DailyCash = require('../models/DailyCash');

// @desc    Get daily cash records
// @route   GET /api/v1/daily-cash
// @access  Private
exports.getDailyCash = async (req, res) => {
    try {
        const query = {};
        if (req.query.startDate && req.query.endDate) {
            const start = new Date(req.query.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(req.query.endDate);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        } else if (req.query.date) {
            const start = new Date(req.query.date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(req.query.date);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }

        if (req.query.branch) {
            query.branch = req.query.branch;
        }

        if (req.query.mode) {
            query.mode = req.query.mode;
        }

        if (req.query.isDeduction !== undefined) {
            query.isDeduction = req.query.isDeduction === 'true';
        }

        if (req.query.hasBank === 'true') {
            query.bank = { $exists: true, $ne: null };
        }

        // Use lean() to get plain objects, sort by createdAt
        let records = await DailyCash.find(query).sort({ createdAt: -1 }).lean();

        // --- Manual Population Start ---
        // Extract unique IDs
        const departmentIds = [...new Set(records.map(r => r.department && r.department.toString()).filter(Boolean))];
        const bankIds = [...new Set(records.map(r => r.bank && r.bank.toString()).filter(Boolean))];

        // Fetch related data from Core DB (Department and Bank models are on Core Connection)
        // We need to require the models here or at top level. Let's assume top level import, but for safety I'll dynamic import or rely on top level. 
        // Better to add imports at top of file interactively next step.
        // But for this block, I will assume Department and Bank are available.
        // Wait, I need to add the imports first before I can use them.
        // I will do two edits. One to add imports, one to change this function.
        // Actually I can do it all here if I assume imports are there, but I need to be safe.
        // I'll return the modified code assuming imports will be added.
        
        // Since I can't guarantee imports are there yet, I will use mongoose.models to access them if they are registered globally on default connection? 
        // No, 'require' is safer.
        const Department = require('../models/Department');
        const Bank = require('../models/Bank');

        const departments = await Department.find({ _id: { $in: departmentIds } }).lean();
        const banks = await Bank.find({ _id: { $in: bankIds } }).lean();

        // Create lookups
        const deptMap = {};
        departments.forEach(d => deptMap[d._id.toString()] = d);

        const bankMap = {};
        banks.forEach(b => bankMap[b._id.toString()] = b);

        // Merge data
        records = records.map(record => {
             if (record.department) {
                 record.department = deptMap[record.department.toString()] || null;
             }
             if (record.bank) {
                 record.bank = bankMap[record.bank.toString()] || null;
             }
             return record;
        });
        // --- Manual Population End ---

        res.status(200).json({ success: true, count: records.length, data: records });
    } catch (err) {
        console.error('getDailyCash Error:', err); // Log the error
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Create daily cash record
// @route   POST /api/v1/daily-cash
// @access  Private
exports.createDailyCash = async (req, res) => {
    try {
        const dailyCash = await DailyCash.create(req.body);
        res.status(201).json({ success: true, data: dailyCash });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update daily cash record
// @route   PUT /api/v1/daily-cash/:id
// @access  Private
exports.updateDailyCash = async (req, res) => {
    try {
        const dailyCash = await DailyCash.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!dailyCash) return res.status(404).json({ success: false, message: 'Record not found' });
        res.status(200).json({ success: true, data: dailyCash });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete daily cash record
// @route   DELETE /api/v1/daily-cash/:id
// @access  Private
exports.deleteDailyCash = async (req, res) => {
    try {
        const dailyCash = await DailyCash.findById(req.params.id);
        if (!dailyCash) return res.status(404).json({ success: false, message: 'Record not found' });
        await dailyCash.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Bulk Verify Daily Cash Records
// @route   PUT /api/v1/daily-cash/verify
// @access  Private
exports.verifyDailyCash = async (req, res) => {
    try {
        console.log('--- verifyDailyCash Hit ---');
        const { updates } = req.body; // Array of { id, isVerified }
        console.log('Updates:', JSON.stringify(updates));

        if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({ success: false, message: 'Invalid updates payload' });
        }

        const bulkOps = updates.map(update => ({
            updateOne: {
                filter: { _id: update.id },
                update: {
                    $set: {
                        isVerified: update.isVerified,
                        ...(update.date && { date: update.date })
                    }
                }
            }
        }));

        if (bulkOps.length > 0) {
            await DailyCash.bulkWrite(bulkOps);
        }

        res.status(200).json({ success: true, message: 'Records updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
