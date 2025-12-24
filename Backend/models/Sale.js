const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Party',
        required: true
    },
    // Snapshot of customer details (for cross-DB integrity and history)
    customerDetails: {
        name: String,
        phone: String,
        address: String,
        city: String
    },
    items: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
            required: true
        },
        // Snapshot item details
        name: String,
        code: String,

        quantity: {
            type: Number,
            required: true,
            min: 0
        },
        rate: {
            type: Number,
            required: true,
            min: 0
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        tax: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tax'
        },
        taxAmount: {
            type: Number,
            default: 0
        }
    }],
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },

    taxAmount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    roundOff: {
        type: Number,
        default: 0
    },
    grandTotal: {
        type: Number,
        required: true,
        min: 0
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'partial', 'paid'],
        default: 'pending'
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    balanceAmount: {
        type: Number,
        required: true
    },
    notes: {
        type: String
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    branch: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['draft', 'final', 'cancelled'],
        default: 'final'
    }
}, {
    timestamps: true
});

// Indexes
saleSchema.index({ date: 1 });
saleSchema.index({ party: 1 });
saleSchema.index({ createdBy: 1 });
saleSchema.index({ paymentStatus: 1 });

// Virtual for calculating balance
saleSchema.virtual('balance').get(function () {
    return this.grandTotal - this.paidAmount;
});

// Pre-save middleware for invoice number generation
// Note: Using async function without next parameter (Mongoose handles it automatically)
saleSchema.pre('save', async function () {
    if (!this.invoiceNumber) {
        const year = new Date().getFullYear();
        const count = await this.constructor.countDocuments({
            date: {
                $gte: new Date(year, 0, 1),
                $lt: new Date(year + 1, 0, 1)
            }
        });
        this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
    }
});

// Cross-DB Snapshot Hook: Ensures Party and Item names are stored for 10-year integrity
saleSchema.pre('save', async function (next) {
    // Only run if necessary
    if (!this.isModified('party') && !this.isModified('items') && !this.isNew) return next();

    try {
        const mongoose = require('mongoose'); // Access Default (Core) Connection

        // 1. Snapshot Party Details
        if (this.isModified('party') || (this.isNew && !this.customerDetails?.name)) {
            let Party;
            try { Party = mongoose.model('Party'); } catch (e) { /* model might not be registered if server.js didn't load it */ }

            if (Party && this.party) {
                const partyData = await Party.findById(this.party).select('name phone address city').lean();
                if (partyData) {
                    this.customerDetails = {
                        name: partyData.name,
                        phone: partyData.phone,
                        address: partyData.address,
                        city: partyData.city
                    };
                }
            }
        }

        // 2. Snapshot Item Names
        if (this.isModified('items') || this.isNew) {
            let Item;
            try { Item = mongoose.model('Item'); } catch (e) { }

            if (Item && this.items && this.items.length > 0) {
                const itemIds = this.items.filter(i => i.item && !i.name).map(i => i.item);
                if (itemIds.length > 0) {
                    const itemsData = await Item.find({ _id: { $in: itemIds } }).select('name code').lean();
                    const itemMap = new Map(itemsData.map(i => [i._id.toString(), i]));

                    for (const lineItem of this.items) {
                        if (lineItem.item && itemMap.has(lineItem.item.toString())) {
                            const data = itemMap.get(lineItem.item.toString());
                            lineItem.name = data.name;
                            lineItem.code = data.code;
                        }
                    }
                }
            }
        }
        next();
    } catch (err) {
        console.error('Snapshot Warning:', err);
        next(); // Proceed anyway
    }
});

const { transConnection } = require('../config/db');

// Register model on the Transactions Database Connection
module.exports = transConnection.model('Sale', saleSchema);

