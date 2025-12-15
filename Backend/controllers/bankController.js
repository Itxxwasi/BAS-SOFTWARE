const Bank = require('../models/Bank');

exports.getBanks = async (req, res) => {
    try {
        const banks = await Bank.find().sort({ bankName: 1 });
        res.status(200).json({ success: true, data: banks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getBank = async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.id);
        if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });
        res.status(200).json({ success: true, data: bank });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.createBank = async (req, res) => {
    try {
        const bank = await Bank.create(req.body);
        res.status(201).json({ success: true, data: bank });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateBank = async (req, res) => {
    try {
        const bank = await Bank.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });
        res.status(200).json({ success: true, data: bank });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteBank = async (req, res) => {
    try {
        const bank = await Bank.findByIdAndDelete(req.params.id);
        if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
