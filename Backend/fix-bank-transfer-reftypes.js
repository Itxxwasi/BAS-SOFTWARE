// Script to update existing Bank Transfer records with correct refType
// Run this once to fix existing data

const mongoose = require('mongoose');
const BankTransaction = require('./models/BankTransaction');

async function updateBankTransferRefTypes() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/your_db_name');

        // Find all transactions that have "Bank Transfer" in narration but don't have refType set correctly
        const result = await BankTransaction.updateMany(
            {
                $or: [
                    { narration: /Bank Transfer/i },
                    { remarks: /Bank Transfer/i }
                ],
                refType: { $ne: 'bank_transfer' }
            },
            {
                $set: { refType: 'bank_transfer' }
            }
        );

        console.log(`✅ Updated ${result.modifiedCount} bank transfer records`);

        // Also check for records with no refType at all
        const noRefType = await BankTransaction.updateMany(
            {
                refType: { $exists: false }
            },
            {
                $set: { refType: 'manual' }
            }
        );

        console.log(`✅ Set refType='manual' for ${noRefType.modifiedCount} records without refType`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

updateBankTransferRefTypes();
