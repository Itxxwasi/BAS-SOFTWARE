const mongoose = require('mongoose');

const PayrollSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    monthYear: {
        type: String,
        required: true // Format: "YYYY-MM"
    },
    branch: {
        type: String,
        required: true
    },

    // Employee Profile Info
    employeeName: String, // Added for snapshot
    code: String,
    bank: String,
    department: String,
    designation: String,
    residency: String,
    totalDays: { type: Number, default: 0 },
    totalHrsPerDay: { type: Number, default: 0 },
    perMonth: { type: Number, default: 0 },
    offDay: { type: Number, default: 0 },
    totalPerDay: { type: Number, default: 0 },
    totalPerHr: { type: Number, default: 0 },
    salaryPer: { type: Number, default: 0 },
    workedHrs: { type: Number, default: 0 },
    workedDays: { type: Number, default: 0 },

    // Earnings
    overTime: { type: Number, default: 0 },
    rent: { type: Number, default: 0 },
    natin: { type: Number, default: 0 },
    monthlyComm: { type: Number, default: 0 },
    teaAllowance: { type: Number, default: 0 },
    stLateAllow: { type: Number, default: 0 },
    otherAllow: { type: Number, default: 0 },
    earningsTotal: { type: Number, default: 0 },

    // Deductions
    overTimeHrs: { type: Number, default: 0 },
    ttw: { type: Number, default: 0 },
    fund: { type: Number, default: 0 },
    ugrm: { type: Number, default: 0 },
    securityDeposit: { type: Number, default: 0 },
    penalty: { type: Number, default: 0 },
    deductionsTotal: { type: Number, default: 0 },

    // Net Calculation
    grossTotal: { type: Number, default: 0 },
    csMale: { type: Number, default: 0 },
    pAAdv: { type: Number, default: 0 },
    totalAdv: { type: Number, default: 0 },
    netTotal: { type: Number, default: 0 },
    bankAmt: { type: Number, default: 0 },
    wht: { type: Number, default: 0 },
    bankPaid: { type: Number, default: 0 },
    cashPaid: { type: Number, default: 0 },
    rebate: { type: Number, default: 0 },
    remarks: { type: String, default: '' },
    branchBank: { type: String, default: '' },

    // Short Week Deduction
    shortWeek: { type: Number, default: 0 },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Compound index for employee and month
PayrollSchema.index({ employee: 1, monthYear: 1 }, { unique: true });

// Snapshot Hook
PayrollSchema.pre('save', async function (next) {
    if (this.isModified('employee') || (this.isNew && !this.employeeName)) {
        try {
            const mongoose = require('mongoose');
            const Employee = mongoose.model('Employee');
            if (Employee && this.employee) {
                const emp = await Employee.findById(this.employee).lean();
                if (emp) {
                    this.employeeName = emp.name;
                    // Other fields might be set by controller but we ensure name here
                    if (!this.code) this.code = emp.code;
                    if (!this.department) this.department = emp.department;
                    if (!this.designation) this.designation = emp.designation;
                }
            }
        } catch (e) {
            console.error('Payroll Snapshot Error:', e);
        }
    }
    next();
});

const { logsConnection } = require('../config/db');
module.exports = logsConnection.model('Payroll', PayrollSchema);
