const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    branch: {
        type: String,
        default: 'F-6'
    },
    code: String,
    busyHours: {
        type: Number,
        default: 12
    },
    // Check In/Out Times
    checkIn: String,
    checkOut: String,
    workedHrs: String,
    breakHrs: String,
    // Time Differences
    timeDiffIn: String,
    timeDiffOut: String,
    totalDiffHrs: String,
    totalHrs: {
        type: Number,
        default: 0
    },
    // Display Status
    displayStatus: {
        type: String,
        enum: ['Present', 'Absent', 'Leave', 'Half Day'],
        default: 'Present'
    },
    remarks: String,
    // Snapshot for Cross-DB Integrity
    employeeName: String,
    employeeCode: String,

    isPresent: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Snapshot Hook
attendanceSchema.pre('save', async function (next) {
    if (this.isModified('employee') || (this.isNew && !this.employeeName)) {
        try {
            const mongoose = require('mongoose');
            const Employee = mongoose.model('Employee');
            if (Employee && this.employee) {
                const emp = await Employee.findById(this.employee).select('name code').lean();
                if (emp) {
                    this.employeeName = emp.name;
                    this.employeeCode = emp.code;
                }
            }
        } catch (e) {
            console.error('Attendance Snapshot Error:', e);
        }
    }
    next();
});

// Compound index for employee and date
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

const { logsConnection } = require('../config/db');
module.exports = logsConnection.model('Attendance', attendanceSchema);
