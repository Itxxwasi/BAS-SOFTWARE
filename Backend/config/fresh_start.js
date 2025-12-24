const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { connectDB, mongoose: coreMongoose, transConnection, logsConnection } = require('./db');

// Models we want to KEEP
const KEEP_MODELS = [
    // Configuration
    'Store',
    'Branch', // (If Branch is separate from Store? Your request says "stores branches")
    'Department',
    'Bank',

    // Core User Access (You usually want to keep admin access)
    'User',
    'Role',
    'Permission',

    // Core Basic Configs if essential
    'Settings'
];

// Models to WIPE (Everything else)
// We will scan all registered models and wipe if not in KEEP list.

const wipeData = async () => {
    console.log('🚀 Starting "Fresh Start" Wipe Script...');
    console.log('⚠️  WARNING: This will PERMANENTLY DELETE all Sales, Purchases, Closing Sheets, Logs etc.');
    console.log('ℹ️  KEEPING: Stores, Departments, Banks, Users, Settings.');

    // 1. Connect
    await connectDB();

    // Wait a moment for async connections to open fully if needed
    await new Promise(r => setTimeout(r, 2000));

    // 2. Load all models to ensure they are registered
    const modelsPath = path.join(__dirname, '../models');
    const fs = require('fs');
    fs.readdirSync(modelsPath).forEach(file => {
        if (file.endsWith('.js')) require(path.join(modelsPath, file));
    });

    // 3. Collect All Models from all 3 connections
    // Note: 'mongoose.models' only has models on the Default connection (Core).
    // Services on transConnection/logsConnection are separate.

    const allModels = [];

    // Core Connection Models
    Object.values(coreMongoose.models).forEach(m => allModels.push(m));

    // Transaction Connection Models
    Object.values(transConnection.models).forEach(m => allModels.push(m));

    // Logs Connection Models
    Object.values(logsConnection.models).forEach(m => allModels.push(m));

    console.log(`📋 Found ${allModels.length} Total Models registered.`);

    // 4. Loop and Wipe
    for (const Model of allModels) {
        const modelName = Model.modelName;

        if (KEEP_MODELS.includes(modelName)) {
            const count = await Model.countDocuments();
            console.log(`✅ [KEEP] ${modelName} (${count} records preserved)`);
        } else {
            // WIPE
            try {
                const countBefore = await Model.countDocuments();
                if (countBefore > 0) {
                    await Model.deleteMany({});
                    console.log(`🗑️  [WIPE] ${modelName} - Deleted ${countBefore} records.`);
                } else {
                    console.log(`⚪ [SKIP] ${modelName} - Already empty.`);
                }
            } catch (err) {
                console.error(`❌ Error wiping ${modelName}: ${err.message}`);
            }
        }
    }

    console.log('\n✨ Fresh Start Complete!');
    console.log('You can now run the app with clean Transaction/Log databases.');
    process.exit(0);
};

wipeData();
