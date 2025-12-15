const mongoose = require('mongoose');
const Department = require('./Backend/models/Department'); // Adjust path as needed
require('dotenv').config({ path: './Backend/.env' }); // Adjust path to .env

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected`);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
};

const checkDepts = async () => {
    await connectDB();
    const depts = await Department.find({ branch: 'DW-BR-ATTOCK-(COS)' });
    console.log('--- START OUTPUT ---');
    depts.forEach(d => {
        console.log(`DEPT: ${d.name} | OF: ${d.openingForward} | RF: ${d.receivingForward}`);
    });
    console.log('--- END OUTPUT ---');
    process.exit();
};

checkDepts();
