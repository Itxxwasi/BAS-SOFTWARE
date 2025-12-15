const Store = require('../models/Store');

// @desc    Get all stores
// @route   GET /api/v1/stores
exports.getStores = async (req, res) => {
    try {
        const stores = await Store.find().sort({ name: 1 });
        res.status(200).json({ success: true, data: stores });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single store
// @route   GET /api/v1/stores/:id
exports.getStore = async (req, res) => {
    try {
        const store = await Store.findById(req.params.id);
        if (!store) {
            return res.status(404).json({ success: false, message: 'Store not found' });
        }
        res.status(200).json({ success: true, data: store });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create store
// @route   POST /api/v1/stores
exports.createStore = async (req, res) => {
    try {
        const store = await Store.create(req.body);
        res.status(201).json({ success: true, data: store });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update store
// @route   PUT /api/v1/stores/:id
exports.updateStore = async (req, res) => {
    try {
        const store = await Store.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!store) {
            return res.status(404).json({ success: false, message: 'Store not found' });
        }
        res.status(200).json({ success: true, data: store });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete store
// @route   DELETE /api/v1/stores/:id
exports.deleteStore = async (req, res) => {
    try {
        const store = await Store.findByIdAndDelete(req.params.id);
        if (!store) {
            return res.status(404).json({ success: false, message: 'Store not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
