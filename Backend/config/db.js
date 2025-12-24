const mongoose = require('mongoose');

// 1. Setup URIs
const coreUri = process.env.MONGO_URI_CORE || process.env.MONGO_URI || 'mongodb://localhost:27017/sales-inventory';
const transUri = process.env.MONGO_URI_TRANS || coreUri;
const logsUri = process.env.MONGO_URI_LOGS || coreUri;

// 2. Create Connections Immediately (Ensures connectivity before models are loaded)
let transConnection;
let logsConnection;

try {
    transConnection = mongoose.createConnection(transUri);
    logsConnection = mongoose.createConnection(logsUri);

    // Event listeners for cleaner status reporting
    transConnection.on('connected', () => console.log('✅ DATABASE 2: Transactions Connected'));
    transConnection.on('error', (err) => console.error('❌ DATABASE 2: Connection Error:', err.message));

    logsConnection.on('connected', () => console.log('✅ DATABASE 3: Logs & History Connected'));
    logsConnection.on('error', (err) => console.error('❌ DATABASE 3: Connection Error:', err.message));

} catch (err) {
    console.error('❌ MongoDB Connection Error: Invalid Connection String');
    process.exit(1);
}

// 3. Connect Core (Default Mongoose)
// We export a function to trigger the main connection logic to keep server.js clean
const connectDB = async () => {
    try {
        await mongoose.connect(coreUri);
        console.log('✅ DATABASE 1: Core Connected (' + mongoose.connection.host + ')');
    } catch (err) {
        console.error('❌ DATABASE 1 Error:', err);
        process.exit(1);
    }
};

module.exports = {
    connectDB,
    transConnection,
    logsConnection,
    mongoose
};
