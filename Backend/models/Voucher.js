const mongoose = require('mongoose');

const voucherEntrySchema = new mongoose.Schema({
    account: {
        type: String,
        required: [true, 'Please provide account name'],
        trim: true
    },
    debit: {
        type: Number,
        default: 0,
        min: 0
    },
    credit: {
        type: Number,
        default: 0,
        min: 0
    },
    detail: {
        type: String,
        trim: true
    }
});

const voucherSchema = new mongoose.Schema({
    voucherNo: {
        type: String,
        unique: true,
        trim: true
    },
    voucherType: {
        type: String,
        enum: ['journal', 'payment', 'receipt', 'contra'],
        required: [true, 'Please select voucher type']
    },
    date: {
        type: Date,
        required: [true, 'Please provide voucher date'],
        default: Date.now
    },
    branch: {
        type: String,
        required: [true, 'Please select a branch'],
        default: 'Shop'
    },
    entries: [voucherEntrySchema],
    totalDebit: {
        type: Number,
        default: 0
    },
    totalCredit: {
        type: Number,
        default: 0
    },
    narration: {
        type: String,
        trim: true,
        maxlength: [500, 'Narration cannot be more than 500 characters']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes
voucherSchema.index({ voucherType: 1 });
voucherSchema.index({ date: -1 });
voucherSchema.index({ createdBy: 1 });

// Pre-save hook to generate voucher number and calculate totals
voucherSchema.pre('save', async function (next) {
    if (!this.voucherNo) {
        const count = await mongoose.model('Voucher').countDocuments({ voucherType: this.voucherType });
        const prefix = this.voucherType.substring(0, 2).toUpperCase();
        this.voucherNo = `${prefix}-${String(count + 1).padStart(5, '0')}`;
    }

    // Calculate totals
    this.totalDebit = this.entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    this.totalCredit = this.entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);

    next();
});

// Validation: Debit and Credit must be equal
voucherSchema.pre('save', function (next) {
    if (Math.abs(this.totalDebit - this.totalCredit) > 0.01) {
        return next(new Error('Total Debit and Total Credit must be equal'));
    }
    next();
});

module.exports = mongoose.model('Voucher', voucherSchema);
