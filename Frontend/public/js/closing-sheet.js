document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('date').valueAsDate = new Date();

    // Set User
    const user = JSON.parse(localStorage.getItem('user')) || { name: 'Unknown' };
    document.getElementById('userName').textContent = user.name;

    await loadBranches();
    loadSheet();

    // Fix: Manually handle tab switching cleanup to prevent overlap
    const tabLinks = document.querySelectorAll('button[data-bs-toggle="tab"]');
    tabLinks.forEach(tab => {
        tab.addEventListener('shown.bs.tab', (event) => {
            const targetId = event.target.getAttribute('data-bs-target');
            document.querySelectorAll('.tab-pane').forEach(pane => {
                if (`#${pane.id}` !== targetId) {
                    pane.classList.remove('show', 'active');
                }
            });
        });
    });
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

        // Load Departments fresh every time to ensure settings changes are reflected
        const depResp = await fetch('/api/v1/departments', { headers: { 'Authorization': `Bearer ${token}` } });
        const depData = await depResp.json();
        if (depData.success) {
            currentDepartments = depData.data; // Store all
        }

        const filteredDepts = currentDepartments
            .filter(d => d.branch === branch && d.isActive)
            .sort((a, b) => (parseInt(a.code) || 999999) - (parseInt(b.code) || 999999));

        // Filter for Dept Opening Tab: Show if Opening Forward OR Receiving Forward is checked
        // User Request: "only opening farward , and received farward check department will show only"
        const deptOpeningFilteredDepts = filteredDepts.filter(d => d.openingForward || d.receivingForward);

        // Sort by Code (seq)
        deptOpeningFilteredDepts.sort((a, b) => {
            const codeA = parseInt(a.code) || 999999;
            const codeB = parseInt(b.code) || 999999;
            return codeA - codeB;
        });

        console.log('Dept Opening Filtered:', deptOpeningFilteredDepts.map(d => d.name));

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
        // Calculate Received Cash from Big Cash Departments
        // Store Daily Cash Data & Cash Sales Data
        let dailyCashData = [];
        let cashSalesData = [];
        const bigCashDeptIds = filteredDepts.filter(d => d.bigCashForward).map(d => d._id);
        let receivedCashSum = 0;

        try {
            const [dcResp, csResp] = await Promise.all([
                fetch(`/api/v1/daily-cash?date=${date}&branch=${branch}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`/api/v1/cash-sales?startDate=${date}&endDate=${date}&branch=${branch}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            const dcJson = await dcResp.json();
            const csJson = await csResp.json();

            if (dcJson.success) dailyCashData = dcJson.data;
            if (csJson.success) cashSalesData = csJson.data;

            if (dailyCashData.length > 0) {
                const relevantRecords = dailyCashData.filter(r =>
                    r.department && bigCashDeptIds.includes(r.department._id || r.department)
                );
                receivedCashSum = relevantRecords.reduce((sum, r) => sum + (r.bigCash || 0), 0);
            }
        } catch (e) { console.error('Error fetching data:', e); }

        document.getElementById('openingCash').value = deptOpeningTotal;
        document.getElementById('receivedCash').value = receivedCashSum; // Use calculated sum
        document.getElementById('departmentTotal').value = sheet.closing01?.departmentTotal || 0;
        document.getElementById('counterCashTotal').value = sheet.closing01?.counterCashTotal || 0;
        document.getElementById('percentageCashTotal').value = sheet.closing01?.percentageCashTotal || 0;
        document.getElementById('totalClosing02').value = sheet.closing01?.totalClosing02 || 0;

        const closing01Rows = document.getElementById('closing01DeptRows');
        closing01Rows.innerHTML = '';

        let closing01DeptTotal = 0;
        let calculatedCounterCashTotal = 0;
        let calculatedDepartmentTotal = 0;
        let calculatedPercentageCashTotal = 0;

        filteredDepts.forEach((d) => {
            // ... (Lines 175-238 similar, but need to handle block structure)
            // I will paste the surrounding context to just inject the new variable and logic logic.
            // Wait, replace_file_content works on chunks.
            // I will split this into two edits if needed, or one big replace of the loop setup and footer.
            // But the logic for PERCENTAGE CASH needs to be INSIDE the loop.
            // I will use a larger block replacement for the whole loop area if possible, or targeted edits.
            // Let's TRY to target the specific conditional block.

            // Actually, I can just modify the loop start and end, and the 'else' block.
            // That's 3 places.

            // Let's do the loop start first to add the variable.

            // 1. Get Opening Amount
            let openingAmount = 0;
            if (sheet.departmentOpening) {
                const op = sheet.departmentOpening.find(item =>
                    (item.department && item.department._id === d._id) || (item.department === d._id)
                );
                if (op) openingAmount = op.amount;
            }

            // 2. Get Big Cash & Slip
            let bigCashAmount = 0;
            let slipAmount = 0;
            if (d.bigCashForward && dailyCashData.length > 0) {
                const dc = dailyCashData.find(r =>
                    r.department && (r.department._id === d._id || r.department === d._id)
                );
                if (dc) {
                    bigCashAmount = dc.bigCash || 0;
                    slipAmount = parseFloat(dc.slip) || 0;
                }
            }

            // 3. Calculate Sales
            // Sales as Main Dept (for Combine_Dep_Sales)
            let salesAsMainDept = 0;
            if (cashSalesData.length > 0) {
                const mainSales = cashSalesData.filter(s =>
                    s.department && (s.department._id === d._id || s.department === d._id)
                );
                salesAsMainDept = mainSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
            }

            // Sales as Cash Counter (for Deduct_UG_Sale)
            let salesAsCounter = 0;
            if (cashSalesData.length > 0) {
                const counterSales = cashSalesData.filter(s => s.cashCounter === d.name);
                salesAsCounter = counterSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
            }

            // 4. Determine Net Value & Routing
            let netValue = 0;
            let showInList = false;

            if (d.combineDepSales) {
                // Combine Logic: Opening + Sales (Main)
                netValue = openingAmount + salesAsMainDept;
                if (netValue >= 0) {
                    calculatedCounterCashTotal += netValue;
                    showInList = false;
                } else {
                    showInList = true;
                }

                // Note: Combine depts do NOT contribute to Department Total based on current understanding

            } else if (d.name === 'MEDICINE') {
                // Medicine Logic: Opening Only
                netValue = openingAmount;
                if (netValue < 0) {
                    showInList = true;
                } else if (d.receivingForward && netValue > 0) {
                    calculatedDepartmentTotal += netValue;
                }

            } else {
                // Standard Logic: Opening + Big + Slip - (Counter Sales if Deduct)
                netValue = openingAmount + bigCashAmount + slipAmount;

                if (d.deductUgSale) {
                    netValue -= salesAsCounter;
                }

                if (d.name === 'PERCENTAGE CASH' && netValue > 0) {
                    calculatedPercentageCashTotal += netValue;
                }

                if (netValue < 0) {
                    showInList = true;
                } else if (d.receivingForward && netValue > 0 && d.name !== 'CASH REC FROM COUNTER' && d.name !== 'PERCENTAGE CASH') {
                    calculatedDepartmentTotal += netValue;
                }
            }

            // 5. Render to List if Negative (Shortfall)
            if (showInList) {
                const displayValue = Math.abs(netValue);
                let finalAmount = displayValue;

                // Use saved value if valid and different? 
                // Prioritize calculated as per request "Show in list" usually means the mismatch.
                // Keeping existing overwrite logic just in case user edits.
                if (sheet.closing01 && sheet.closing01.departments) {
                    const saved = sheet.closing01.departments.find(item =>
                        (item.department && item.department._id === d._id) || (item.department === d._id)
                    );
                    if (saved && saved.amount !== 0) finalAmount = saved.amount;
                }

                closing01DeptTotal += finalAmount;

                const div = document.createElement('div');
                div.className = 'row mx-0 border-bottom py-1 align-items-center';
                div.innerHTML = `
                     <div class="col-8 small">${d.name}</div>
                     <div class="col-4">
                         <input type="number" class="form-control form-control-sm text-end closing01-dept-input" 
                              data-dept-id="${d._id}" value="${finalAmount}" onchange="calcClosing01Totals()" readonly>
                     </div>
                 `;
                closing01Rows.appendChild(div);
            }
        });

        // Update Totals
        document.getElementById('counterCashTotal').value = calculatedCounterCashTotal;
        document.getElementById('departmentTotal').value = calculatedDepartmentTotal;
        document.getElementById('percentageCashTotal').value = calculatedPercentageCashTotal;

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
    let deptListTotal = 0;
    document.querySelectorAll('.closing01-dept-input').forEach(inp => {
        deptListTotal += parseFloat(inp.value) || 0;
    });

    const openingCash = parseFloat(document.getElementById('openingCash').value) || 0;
    const receivedCash = parseFloat(document.getElementById('receivedCash').value) || 0;

    // Read Right-Hand Side Totals
    const departmentTotal = parseFloat(document.getElementById('departmentTotal').value) || 0;
    const counterCashTotal = parseFloat(document.getElementById('counterCashTotal').value) || 0;
    const percentageCashTotal = parseFloat(document.getElementById('percentageCashTotal').value) || 0;

    // Calculate Total Closing 02 (User Formula)
    const totalClosing02 = departmentTotal + counterCashTotal + percentageCashTotal;
    document.getElementById('totalClosing02').value = totalClosing02;

    // Calculate Total Closing 01 (Left Side Total)
    // Formula: Sum of Departments (Shortfalls) + Opening Cash + Received Cash
    const totalClosing01 = deptListTotal + openingCash + receivedCash;

    document.getElementById('totalClosing01').textContent = totalClosing01.toFixed(0);

    // Calculate Grand Total (Red Bar)
    // Formula: Total Closing 01 - Total Closing 02
    const grandTotal = totalClosing01 - totalClosing02;
    document.getElementById('grandTotal').textContent = grandTotal.toFixed(0);
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
