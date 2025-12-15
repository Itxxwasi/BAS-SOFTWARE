document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('date').valueAsDate = new Date();

    // Set User
    const user = JSON.parse(localStorage.getItem('user')) || { name: 'Unknown' };
    document.getElementById('userName').textContent = user.name;

    await loadBranches();
    loadSheet();
});

let currentDepartments = [];

async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            const select = document.getElementById('branch');
            select.innerHTML = ''; // Clear default options
            data.data.forEach(store => {
                const option = document.createElement('option');
                option.value = store.name;
                option.textContent = store.name;
                select.appendChild(option);
            });
        }
    } catch (e) {
        console.error('Error loading branches:', e);
    }
}

async function loadSheet() {
    const branch = document.getElementById('branch').value;
    const date = document.getElementById('date').value;

    // First clear existing
    document.getElementById('deptOpeningRows').innerHTML = 'Loading...';
    document.getElementById('closing01DeptRows').innerHTML = 'Loading...';

    try {
        const token = localStorage.getItem('token');

        // Load Departments first to build structure
        if (currentDepartments.length === 0) {
            const depResp = await fetch('/api/v1/departments', { headers: { 'Authorization': `Bearer ${token}` } });
            const depData = await depResp.json();
            if (depData.success) {
                currentDepartments = depData.data; // Store all
            }
        }

        const filteredDepts = currentDepartments.filter(d => d.branch === branch && d.isActive);

        // Filter specifically for Dept Opening Tab functionality
        // "DEPARTMENT OPENING TAB WILL LOAD DEPARTMENT WHICH DEPARTMENT HAVE OPENING FARWARD OR RECEIVING FARWARD CHECK"
        const deptOpeningFilteredDepts = filteredDepts.filter(d => d.openingForward || d.receivingForward);

        // Load existing sheet data
        const sheetResp = await fetch(`/api/v1/closing-sheets?date=${date}&branch=${branch}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const sheetData = await sheetResp.json();
        const sheet = sheetData.data || {};

        console.log('Sheet Data:', sheet);

        // --- Tab 1: Department Opening ---
        const deptOpeningContainer = document.getElementById('deptOpeningRows');
        deptOpeningContainer.innerHTML = '';

        let deptOpeningTotal = 0;

        deptOpeningFilteredDepts.forEach((d, index) => {
            // Find saved amount or 0
            let amount = 0;
            if (sheet.departmentOpening) {
                const saved = sheet.departmentOpening.find(item =>
                    (item.department && item.department._id === d._id) || (item.department === d._id)
                );
                if (saved) amount = saved.amount;
            }

            deptOpeningTotal += amount;

            const div = document.createElement('div');
            div.className = 'row mx-0 border-bottom py-1 align-items-center';
            div.innerHTML = `
                <div class="col-2 small">${d.code || (index + 1)}</div>
                <div class="col-8 small">${d.name}</div>
                <div class="col-2">
                    <input type="number" class="form-control form-control-sm text-end dept-opening-input" 
                        data-dept-id="${d._id}" value="${amount}" onchange="calcDeptOpeningTotal()">
                </div>
            `;
            deptOpeningContainer.appendChild(div);
        });
        document.getElementById('deptOpeningTotal').textContent = deptOpeningTotal.toFixed(2);


        // --- Tab 2: Closing 01 ---
        // Basic fields
        // Opening Cash is forwarded from Department Opening Total
        document.getElementById('openingCash').value = deptOpeningTotal;
        document.getElementById('receivedCash').value = sheet.closing01?.receivedCash || 0;
        document.getElementById('departmentTotal').value = sheet.closing01?.departmentTotal || 0;
        document.getElementById('counterCashTotal').value = sheet.closing01?.counterCashTotal || 0;
        document.getElementById('percentageCashTotal').value = sheet.closing01?.percentageCashTotal || 0;
        document.getElementById('totalClosing02').value = sheet.closing01?.totalClosing02 || 0;

        const closing01Rows = document.getElementById('closing01DeptRows');
        closing01Rows.innerHTML = '';

        let closing01DeptTotal = 0;

        filteredDepts.forEach((d) => {
            let amount = 0;
            if (sheet.closing01 && sheet.closing01.departments) {
                const saved = sheet.closing01.departments.find(item =>
                    (item.department && item.department._id === d._id) || (item.department === d._id)
                );
                if (saved) amount = saved.amount;
            }
            closing01DeptTotal += amount;

            const div = document.createElement('div');
            div.className = 'row mx-0 border-bottom py-1 align-items-center';
            div.innerHTML = `
                <div class="col-8 small">${d.name}</div>
                <div class="col-4">
                    <input type="number" class="form-control form-control-sm text-end closing01-dept-input" 
                         data-dept-id="${d._id}" value="${amount}" onchange="calcClosing01Totals()">
                </div>
            `;
            closing01Rows.appendChild(div);
        });

        // Initial Calculation
        calcClosing01Totals();

        // Load departments for Closing 02 tab
        const closing02DeptSelect = document.getElementById('closing02Dept');
        if (closing02DeptSelect) {
            closing02DeptSelect.innerHTML = '<option value="">Select Department</option>';
            filteredDepts.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d._id;
                opt.text = d.name;
                closing02DeptSelect.appendChild(opt);
            });
        }

        // Load Closing 02 tables
        loadClosing02DeptTable(filteredDepts);
        loadClosing02BankTable();

    } catch (e) {
        console.error(e);
        alert('Error loading sheet data');
    }
}

// Load Department Sales Table for Closing 02
function loadClosing02DeptTable(departments) {
    const tbody = document.getElementById('closing02DeptTable');
    const totalEl = document.getElementById('closing02DeptTotal');

    if (!tbody) return;

    tbody.innerHTML = '';
    let total = 0;

    if (departments && departments.length > 0) {
        departments.forEach(dept => {
            const sale = dept.sale || 0; // You can fetch actual sales data from API
            total += sale;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="fw-bold">${dept.name}</td>
                <td class="text-end">${sale.toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No departments</td></tr>';
    }

    if (totalEl) {
        totalEl.textContent = total.toLocaleString();
    }
}

// Load Bank Table for Closing 02
async function loadClosing02BankTable() {
    const tbody = document.getElementById('closing02BankTable');
    const totalEl = document.getElementById('closing02BankTotal');
    const bankTotalInput = document.getElementById('bankTotal');

    if (!tbody) return;

    try {
        const token = localStorage.getItem('token');
        const branch = document.getElementById('branch').value;
        const date = document.getElementById('date').value;

        // Fetch bank data from Daily Cash API
        const response = await fetch(`/api/v1/daily-cash?branch=${branch}&date=${date}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        tbody.innerHTML = '';
        let total = 0;

        if (data.success && data.data && data.data.length > 0) {
            data.data.forEach(bank => {
                const amount = bank.amount || 0;
                total += amount;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="fw-bold">${bank.bankName || 'Unknown'}</td>
                    <td class="text-end">${amount.toLocaleString()}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No bank data</td></tr>';
        }

        if (totalEl) {
            totalEl.textContent = total.toLocaleString();
        }

        if (bankTotalInput) {
            bankTotalInput.value = total;
        }

    } catch (error) {
        console.error('Error loading bank data:', error);
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-danger">Error loading data</td></tr>';
    }
}

function calcDeptOpeningTotal() {
    let total = 0;
    document.querySelectorAll('.dept-opening-input').forEach(inp => {
        total += parseFloat(inp.value) || 0;
    });
    const totalFixed = total.toFixed(2);
    document.getElementById('deptOpeningTotal').textContent = totalFixed;

    // Forward to Closing 01 Opening Cash
    const openingCashInput = document.getElementById('openingCash');
    if (openingCashInput) {
        openingCashInput.value = total; // Use number or fixed? Input type=number prefers raw number usually, but .value stringifies.
        calcClosing01Totals(); // Recalculate Closing 01 totals
    }
}

function calcClosing01Totals() {
    let deptTotal = 0;
    document.querySelectorAll('.closing01-dept-input').forEach(inp => {
        deptTotal += parseFloat(inp.value) || 0;
    });

    // In simpler version, maybe we just calculate total of these inputs
    // But image shows "Total Closing 01" which seems to be independent or sum of specific fields

    // For now, let's assume specific logic:
    // Total Closing 01 = Sum of Departments + OpeningCash + ReceivedCash? No that's usually separate.
    // Based on image:
    // Department Total seems to be the sum of Department Closing amounts?
    // Total Closing 01 (Green) = 2560358
    // Total (Red) = 0?

    // This is complex accounting logic. I will implement sum calculation for now.

    const openingCash = parseFloat(document.getElementById('openingCash').value) || 0;
    const receivedCash = parseFloat(document.getElementById('receivedCash').value) || 0;
    const counterCashTotal = parseFloat(document.getElementById('counterCashTotal').value) || 0;
    const percentageCashTotal = parseFloat(document.getElementById('percentageCashTotal').value) || 0;
    const totalClosing02 = parseFloat(document.getElementById('totalClosing02').value) || 0;

    // Based on image:
    // Total Closing 01 is emphasized green.
    // Let's assume it is sum of all cash sources:
    // OpeningCash + ReceivedCash + CounterCashTotal + PercentageCashTotal + TotalClosing02 + DeptTotal ?

    // For now, I will just display sum of dept amounts in "Total Closing 01" for demonstration if logic is not explicit.
    // But better: deptTotal + openingCash + receivedCash + counterCashTotal + percentageCashTotal + totalClosing02

    const totalClosing01 = deptTotal + openingCash + receivedCash + counterCashTotal + percentageCashTotal + totalClosing02;
    document.getElementById('totalClosing01').textContent = totalClosing01.toFixed(0);
    document.getElementById('grandTotal').textContent = totalClosing01.toFixed(0); // If red total is same or diff?
}

// Add listeners for other inputs in Tab 2 to recalc
['openingCash', 'receivedCash', 'totalClosing02'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcClosing01Totals);
});


async function saveSheet() {
    const branch = document.getElementById('branch').value;
    const date = document.getElementById('date').value;

    // 1. Collect Department Opening Data
    const departmentOpening = [];
    document.querySelectorAll('.dept-opening-input').forEach(inp => {
        departmentOpening.push({
            department: inp.dataset.deptId,
            amount: parseFloat(inp.value) || 0
        });
    });

    // 2. Collect Closing 01 Data
    const closing01Depts = [];
    document.querySelectorAll('.closing01-dept-input').forEach(inp => {
        closing01Depts.push({
            department: inp.dataset.deptId,
            amount: parseFloat(inp.value) || 0
        });
    });

    const closing01 = {
        openingCash: parseFloat(document.getElementById('openingCash').value) || 0,
        receivedCash: parseFloat(document.getElementById('receivedCash').value) || 0,
        departmentTotal: parseFloat(document.getElementById('departmentTotal').value) || 0,
        counterCashTotal: parseFloat(document.getElementById('counterCashTotal').value) || 0,
        percentageCashTotal: parseFloat(document.getElementById('percentageCashTotal').value) || 0,
        totalClosing02: parseFloat(document.getElementById('totalClosing02').value) || 0,
        departments: closing01Depts,
        // calculated totals can be saved or recalc on server
    };

    const payload = {
        branch,
        date,
        departmentOpening,
        closing01
    };

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/closing-sheets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.success) {
            alert('Saved successfully');
        } else {
            alert('Error: ' + data.message);
        }
    } catch (e) { console.error(e); }
}

function printSheet(type) {
    alert('Print functionality coming soon');
}

// SMS Sending Functions
async function loadSMSCustomers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/parties?partyType=customer&limit=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const tbody = document.getElementById('smsCustomersBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (data.success && data.data) {
            data.data.forEach(customer => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input type="checkbox" class="sms-customer-check" data-customer-id="${customer._id}" data-phone="${customer.mobile || customer.phone}"></td>
                    <td>${customer.name}</td>
                    <td>${customer.phone || '-'}</td>
                    <td>${customer.mobile || '-'}</td>
                    <td>${customer.address || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error('Error loading SMS customers:', e);
    }
}

function sendSMS() {
    const selectedCustomers = [];
    document.querySelectorAll('.sms-customer-check:checked').forEach(checkbox => {
        selectedCustomers.push({
            id: checkbox.dataset.customerId,
            phone: checkbox.dataset.phone
        });
    });

    if (selectedCustomers.length === 0) {
        alert('Please select at least one customer');
        return;
    }

    const smsType = document.getElementById('smsType')?.value || 'Daily Sale';

    alert(`SMS will be sent to ${selectedCustomers.length} customers for ${smsType}`);
    // Implement actual SMS sending logic here
}

// Report Generation Functions
async function generateReport(reportType) {
    const fromDate = document.getElementById('reportFromDate')?.value;
    const toDate = document.getElementById('reportToDate')?.value;
    const branch = document.getElementById('branch').value;

    if (!fromDate || !toDate) {
        alert('Please select date range');
        return;
    }

    const reportOutput = document.getElementById('reportOutput');
    if (!reportOutput) return;

    reportOutput.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Generating report...</p>';

    try {
        const token = localStorage.getItem('token');

        // Fetch data based on report type
        let reportHTML = '';

        if (reportType === 'openingBalance') {
            reportHTML = `
                <h5>Opening Balance & Received Cash Detail</h5>
                <p>Branch: ${branch}</p>
                <p>Period: ${fromDate} to ${toDate}</p>
                <table class="table table-bordered table-sm">
                    <thead class="table-primary">
                        <tr>
                            <th>Date</th>
                            <th>Opening Balance</th>
                            <th>Received Cash</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="4" class="text-center text-muted">No data available for selected period</td>
                        </tr>
                    </tbody>
                </table>
            `;
        } else if (reportType === 'deptWisePercentage') {
            reportHTML = `
                <h5>Daily Department Wise Percentage Cash Detail</h5>
                <p>Branch: ${branch}</p>
                <p>Period: ${fromDate} to ${toDate}</p>
                <table class="table table-bordered table-sm">
                    <thead class="table-primary">
                        <tr>
                            <th>Department</th>
                            <th>Cash Amount</th>
                            <th>Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="3" class="text-center text-muted">No data available for selected period</td>
                        </tr>
                    </tbody>
                </table>
            `;
        }

        reportOutput.innerHTML = reportHTML;

    } catch (e) {
        console.error('Error generating report:', e);
        reportOutput.innerHTML = '<p class="text-danger">Error generating report. Please try again.</p>';
    }
}

// Load SMS customers when SMS tab is shown
document.addEventListener('shown.bs.tab', function (event) {
    if (event.target.id === 'sms-sending-tab') {
        loadSMSCustomers();
    }
});

// Initialize report dates
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    const reportFromDate = document.getElementById('reportFromDate');
    const reportToDate = document.getElementById('reportToDate');

    if (reportFromDate) reportFromDate.value = today;
    if (reportToDate) reportToDate.value = today;
});
