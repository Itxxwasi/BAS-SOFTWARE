document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('date').valueAsDate = new Date();

    // Set User
    const user = JSON.parse(localStorage.getItem('user')) || { name: 'Unknown' };
    document.getElementById('userName').textContent = user.name;

    await loadBranches();

    // Auto-load on Date or Branch change
    document.getElementById('date')?.addEventListener('change', loadSheet);
    document.getElementById('branch')?.addEventListener('change', loadSheet);

    loadSheet();

    // Fix: Manually handle tab switching cleanup to prevent overlap
    const tabLinks = document.querySelectorAll('button[data-bs-toggle="tab"]');



    // Force explicit cleanup on load to ensure no double-active tabs
    const activeTabBtn = document.querySelector('button.nav-link.active');
    const activeTarget = activeTabBtn ? activeTabBtn.getAttribute('data-bs-target') : '#dept-opening';
    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (`#${pane.id}` !== activeTarget) {
            pane.classList.remove('show', 'active');
        } else {
            pane.classList.add('show', 'active'); // Ensure active is actually showing
        }
    });

    tabLinks.forEach(tab => {
        tab.addEventListener('shown.bs.tab', async (event) => {
            const targetId = event.target.getAttribute('data-bs-target');

            // Save state
            localStorage.setItem('closingSheetLastTab', targetId);

            // Manual cleanup
            document.querySelectorAll('.tab-pane').forEach(pane => {
                if (`#${pane.id}` !== targetId) {
                    pane.classList.remove('show', 'active');
                }
            });

            // Auto-Refresh Logic on Tab Switch
            if (targetId === '#closing02') {
                console.log('Refreshing Closing 02 Data...');
                await refreshDailyCashData();
                await loadClosing02BankTable();
                const deptId = document.getElementById('closing02Dept').value;
                if (deptId) {
                    updateClosing02Derived(deptId);
                }
            } else if (targetId === '#closing01') {
                console.log('Refreshing Closing 01 Data...');
                await refreshDailyCashData();
                if (typeof calcDeptOpeningTotal === 'function') calcDeptOpeningTotal();
                if (typeof calcClosing01Totals === 'function') calcClosing01Totals();
            } else if (targetId === '#deptOpening') {
                if (typeof calcDeptOpeningTotal === 'function') calcDeptOpeningTotal();
            } else if (targetId === '#income-statement') {
                console.log('Loading Income Statement Data...');
                loadIncomeStatementData();
            }
        });
    });

    // Tab Persistence & Overlap Fix (Moved to end to ensure listeners are active)
    const lastTab = localStorage.getItem('closingSheetLastTab');
    if (lastTab) {
        const tabBtn = document.querySelector(`button[data-bs-target="${lastTab}"]`);
        if (tabBtn) {
            // Delay slightly to ensure Bootstrap is ready? No, standard call should work if listener is there.
            const tab = new bootstrap.Tab(tabBtn);
            tab.show();
        }
    }
});


let currentDepartments = [];
let currentDailyCashData = [];
let currentCashSalesData = [];
let currentSheetData = {};
let closing02State = {};

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
        currentSheetData = sheet;
        if (sheet.closing02 && sheet.closing02.data) {
            closing02State = sheet.closing02.data;
        } else {
            closing02State = {};
        }

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

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d.code || (index + 1)}</td>
                <td>${d.name}</td>
                <td class="p-1">
                    <input type="number" class="form-control form-control-sm text-end dept-opening-input border-0 bg-transparent" 
                        data-dept-id="${d._id}" value="${amount}" onchange="calcDeptOpeningTotal()">
                </td>
            `;
            deptOpeningContainer.appendChild(tr);
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

            if (dcJson.success) {
                dailyCashData = dcJson.data;
                currentDailyCashData = dcJson.data; // Store globally
            }
            if (csJson.success) {
                cashSalesData = csJson.data;
                currentCashSalesData = csJson.data; // Store globally
            }

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
            if (dailyCashData.length > 0) {
                // Filter: Match Dept AND Exclude Bank Mode
                // Logic: Count BigCash/Slip if records exist for this department, regardless of flag
                const validRecords = dailyCashData.filter(r =>
                    (r.department && (r.department._id === d._id || r.department === d._id)) &&
                    r.mode !== 'Bank'
                );

                bigCashAmount = validRecords.reduce((sum, r) => sum + (r.bigCash || 0), 0);
                slipAmount = validRecords.reduce((sum, r) => sum + (parseFloat(r.slip) || 0), 0);
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
                // Fix: Case-insensitive match for Cash Counter name
                const counterSales = cashSalesData.filter(s =>
                    s.cashCounter && s.cashCounter.toUpperCase() === d.name.toUpperCase()
                );
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

                // Prioritize calculated value as per request (Formula Driven)
                // Removed logic that overwrote with saved value because this field is readonly and should update dynamically.
                /* 
                if (sheet.closing01 && sheet.closing01.departments) {
                    const saved = sheet.closing01.departments.find(item =>
                        (item.department && item.department._id === d._id) || (item.department === d._id)
                    );
                    if (saved && saved.amount !== 0) finalAmount = saved.amount;
                }
                */

                closing01DeptTotal += finalAmount;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                     <td class="small align-middle">${d.name}</td>
                     <td class="p-1">
                         <input type="number" class="form-control form-control-sm text-end closing01-dept-input border-0 bg-transparent" 
                              data-dept-id="${d._id}" value="${finalAmount}" onchange="calcClosing01Totals()" readonly>
                     </td>
                 `;
                closing01Rows.appendChild(tr);
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
                if (!d.closing2DeptDropDown) return; // User Request: Only show 'Closing 2 Dept Drop Down' checked departments
                const opt = document.createElement('option');
                opt.value = d._id;
                opt.text = d.name;
                closing02DeptSelect.appendChild(opt);
            });
        }

        // Load Closing 02 tables
        loadClosing02DeptTable(filteredDepts);
        loadClosing02BankTable();

        // Add event listener for Closing 02 Dept Change
        const c02DeptSelect = document.getElementById('closing02Dept');
        c02DeptSelect.removeEventListener('change', handleClosing02DeptChange); // prevent duplicates
        c02DeptSelect.addEventListener('change', handleClosing02DeptChange);

        // Clear Closing 02 Form initially
        clearClosing02Form();

    } catch (e) {
        console.error(e);
        alert('Error loading sheet data');
    }
}

// Load Department Sales Table for Closing 02
// Load Department Sales Table for Closing 02
function loadClosing02DeptTable(departments) {
    const tbody = document.getElementById('closing02DeptTable');
    const totalEl = document.getElementById('closing02DeptTotal');

    if (!tbody) return;

    tbody.innerHTML = '';
    let total = 0;
    let hasRows = false;

    if (departments && departments.length > 0) {
        departments.forEach(dept => {
            // Filter: Only show departments meant for Main Dropdown (Parent/Visible)
            // This hides 'Child' departments (like Surgical/Cosmetics which are part of Medicine's popup)
            if (!dept.closing2DeptDropDown) return;

            // 1. Manual Entry from Modal/State
            let manualSale = 0;
            if (closing02State[dept._id]) {
                manualSale = closing02State[dept._id].totalSaleComputer || 0;
            }

            // 2. Auto Entry from Cash Counter (Cash Sales)
            let autoSale = 0;
            if (currentCashSalesData) {
                // Filter by Department ID
                const deptSales = currentCashSalesData.filter(s =>
                    (s.department && (s.department._id === dept._id || s.department === dept._id))
                );
                autoSale = deptSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
            }

            // Total Sale for this Dept
            const finalSale = manualSale + autoSale;

            // Only show if finalSale > 0
            if (finalSale > 0) {
                total += finalSale;
                hasRows = true;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="fw-bold">${dept.name}</td>
                    <td class="text-end">${finalSale.toLocaleString()}</td>
                `;
                tbody.appendChild(tr);
            }
        });
    }

    if (!hasRows) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No sales data</td></tr>';
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
            // Filter only 'Bank' mode entries
            let bankEntries = data.data.filter(r => r.mode === 'Bank');

            // Filter by Department if provided
            // if (deptId) {
            //     bankEntries = bankEntries.filter(r =>
            //         (r.department && r.department._id === deptId) || r.department === deptId
            //     );
            // }

            // Aggregate by Department AND Bank Name
            const bankMap = new Map(); // Key: DeptID_BankName -> { displayName: "Bank (XXX)", amount: Total }

            bankEntries.forEach(entry => {
                // Bank Name Logic
                let bankName = 'Unknown Bank';
                if (entry.bank && typeof entry.bank === 'object') {
                    // Bank model uses 'bankName', but check 'name' just in case of inconsistency
                    bankName = entry.bank.bankName || entry.bank.name || 'Unknown Bank';
                } else if (entry.bankName) {
                    bankName = entry.bankName;
                } else if (typeof entry.bank === 'string') {
                    // Should hopefully be resolved now, but if not:
                    bankName = 'Bank';
                }

                // Department Info
                let deptId = 'unknown';
                let deptShort = 'UNK';

                if (entry.department && typeof entry.department === 'object') {
                    deptId = entry.department._id;
                    const dName = entry.department.name || '';
                    if (dName) deptShort = dName.substring(0, 3).toUpperCase();
                } else if (entry.department) {
                    deptId = entry.department;
                }

                // Composite Key
                const uniqueKey = `${deptId}_${bankName}`;

                // Format: "ALF (MED)"
                // Check if bankName already contains the deptShort to avoid double like "ALF (COS) (COS)"
                let displayName = bankName;
                if (!bankName.includes(`(${deptShort})`)) {
                    displayName = `${bankName} (${deptShort})`;
                }

                const amount = entry.totalAmount || entry.amount || 0;

                if (bankMap.has(uniqueKey)) {
                    const current = bankMap.get(uniqueKey);
                    current.amount += amount;
                } else {
                    bankMap.set(uniqueKey, {
                        name: displayName,
                        amount: amount
                    });
                }
            });

            // Iterate Map
            if (bankMap.size > 0) {
                bankMap.forEach((data, key) => {
                    total += data.amount;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="fw-bold">${data.name}</td>
                        <td class="text-end">${data.amount.toLocaleString()}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No bank data</td></tr>';
            }

        } else {
            tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No bank data</td></tr>';
        }

        if (totalEl) {
            totalEl.textContent = total.toLocaleString();
        }

        // Also update the "Bank Total" input in the form if it's meant to be the sum of ALL banks
        // But wait, the form is Department specific. 
        // If the user wants to show "Bank Total" for THAT department, we should calculate it differently.
        // However, currently the logic sets 'bankTotal' input from SavedState or calc.
        // If this table is global, we shouldn't overwrite the department-specific input unless explicitly asked.
        // The user said: "daily cash i save bank enteries accourding to department wise so show here bank enteries".
        // This implies the TABLE should show them.
        // I will NOT strictly overwrite the Department's 'Bank Total' input here, because that might be specific to the department (if needed).
        // Actually, lines 572 in loadClosing02DeptData sets bankTotal from state.

        // HOWEVER, if the user sees a "Bank Total" field in the form, they might expect it to autosum from the table?
        // But the table is potentially global.
        // Let's stick to just populating the TABLE as requested.

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

// --- Closing 02 Logic ---

// Helper to refresh Daily Cash AND Cash Sales Data globally
async function refreshDailyCashData() {
    const branch = document.getElementById('branch').value;
    const date = document.getElementById('date').value;
    const token = localStorage.getItem('token');
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

        if (dcJson.success) {
            currentDailyCashData = dcJson.data;
            console.log('Daily Cash Data Refreshed');
        }
        if (csJson.success) {
            currentCashSalesData = csJson.data;
            console.log('Cash Sales Data Refreshed');
        }
    } catch (e) { console.error('Error refreshing data:', e); }
}

// Helper to update Closing 02 derived fields without resetting manual inputs
function updateClosing02Derived(deptId) {
    if (!currentDailyCashData) return;

    // 1. Counter Closing (Cash Only)
    let dailyCashTotal = 0;
    const deptCashRecords = currentDailyCashData.filter(r =>
        ((r.department && r.department._id === deptId) || r.department === deptId) &&
        r.mode === 'Cash'
    );
    dailyCashTotal = deptCashRecords.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    document.getElementById('counterClosing').value = dailyCashTotal;

    // 2. Bank Total
    let deptBankTotal = 0;
    const deptBankRecords = currentDailyCashData.filter(r =>
        ((r.department && r.department._id === deptId) || r.department === deptId) &&
        r.mode === 'Bank'
    );
    deptBankTotal = deptBankRecords.reduce((sum, r) => sum + (r.totalAmount || r.amount || 0), 0);
    document.getElementById('bankTotal').value = deptBankTotal;

    // 3. Recalc Totals
    calcClosing02Totals();
}

function updateState(key, value) {
    const deptId = document.getElementById('closing02Dept').value;
    if (deptId) {
        if (!closing02State[deptId]) closing02State[deptId] = {};
        closing02State[deptId][key] = parseFloat(value) || 0;
    }
}
function handleClosing02DeptChange() {
    const deptId = document.getElementById('closing02Dept').value;
    if (!deptId) {
        clearClosing02Form();
        return;
    }
    loadClosing02DeptData(deptId);
}

async function loadClosing02DeptData(deptId) {
    const branch = document.getElementById('branch').value;
    const dateStr = document.getElementById('date').value;

    // 1. Calculate Counter Closing from Daily Cash (Cash Mode Only)
    // User Request: Match "Daily Cash List" Department Total for Cash entries.
    let dailyCashTotal = 0;
    if (currentDailyCashData) {
        // Filter for this Dept AND mode='Cash'
        const deptCashRecords = currentDailyCashData.filter(r =>
            ((r.department && r.department._id === deptId) || r.department === deptId) &&
            r.mode === 'Cash'
        );
        dailyCashTotal = deptCashRecords.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    }

    // 2. Fetch Previous Day's Closing for Opening (-)
    let prevOpening = 0;
    try {
        const dateObj = new Date(dateStr);
        dateObj.setDate(dateObj.getDate() - 1);
        const prevDateStr = dateObj.toISOString().split('T')[0];

        const token = localStorage.getItem('token');
        const resp = await fetch(`/api/v1/closing-sheets?date=${prevDateStr}&branch=${branch}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await resp.json();
        if (json.success && json.data && json.data.closing02 && json.data.closing02.data) {
            const prevData = json.data.closing02.data[deptId];
            if (prevData) {
                // The previous day's "Counter Closing" (or Balance?) 
                // User Request: "today counter closing... next day closing 2 will show opening (-)"
                // This implies Previous Counter Closing -> Current Opening Minus
                // But typically Opening comes from Closing Balance. 
                // Let's assume 'counterClosing' field of previous day.
                prevOpening = prevData.counterClosing || 0;

                // OR if they meant the Difference/Balance:
                // prevOpening = prevData.difference || 0;
                // Based on phrasing "today counter closing ... will show opening", I stick to counterClosing.
            }
        }
    } catch (e) {
        console.error('Error fetching previous closing:', e);
    }

    // 3. Load Saved State (if any)
    const savedState = closing02State[deptId] || {};

    // Populate Form
    document.getElementById('counterClosing').value = dailyCashTotal; // Always from Daily Cash
    document.getElementById('openingMinus').value = prevOpening;      // Always from Prev Day

    // Load others from state or default to 0
    document.getElementById('lp').value = savedState.lp || 0;
    document.getElementById('misc').value = savedState.misc || 0;

    // Check if Medicine to auto-populate Received Cash from Closing 01 Total
    const deptSelect = document.getElementById('closing02Dept');
    const deptName = deptSelect.options[deptSelect.selectedIndex]?.text?.toUpperCase();

    let receivedCashVal = savedState.receivedCash || 0;

    if (deptName === 'MEDICINE') {
        // Strict Rule: Medicine Received Cash = Closing 01 Grand Total (Red Bar)
        const c01TotalEl = document.getElementById('grandTotal');
        if (c01TotalEl) {
            receivedCashVal = parseFloat(c01TotalEl.textContent) || 0;
        }
    } else {
        // For OTHER Departments (Per User Request)
        // Formula: (DailyClosing BigCash + Slips) - Deduct_UG_Sale
        // "Deduct_UG_Sale": check which department have [deductUgSale flag] 
        // and if so, less amount from counter sale cash counter drop down [CashSale where cashCounter == DeptName]

        let initialCash = 0;
        if (currentDailyCashData) {
            const deptRecords = currentDailyCashData.filter(r =>
                (r.department && r.department._id === deptId) || r.department === deptId
            );
            // Sum BigCash + Slip
            // User: "daily closing big cash + slips"
            // Previous logic included totalAmount (denominations), but user implies specific fields.
            // Also user complained "slips total not inclde".
            // So we MUST add 'slip'. And likely 'totalAmount' is NOT 'Received Cash' (it's Counter Cash?).
            initialCash = deptRecords.reduce((sum, r) => {
                const bc = Number(r.bigCash) || 0;
                // Parse slip string to number
                const slipVal = parseFloat(r.slip) || 0;

                return sum + bc + slipVal;
            }, 0);
        }

        // Deduction Logic
        let deduction = 0;
        // Find the current department object to check flag
        const currentDeptObj = currentDepartments.find(d => d._id === deptId);

        if (currentDeptObj && currentDeptObj.deductUgSale) {
            // Find Sales where cashCounter == Dept Name
            if (currentCashSalesData) {
                const counterSales = currentCashSalesData.filter(s =>
                    s.cashCounter === currentDeptObj.name
                );
                deduction = counterSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
            }
        }

        receivedCashVal = initialCash - deduction;

        // If not explicit override in saved state, use calculated.
        if (!savedState.receivedCash) {
            // Apply calculation
            // Allow manual override? User formula usually implies auto.
        } else {
            // If saved state exists, maybe keep it? the user said "formula", usually implying automatic.
            // I'll update it to calculated value to be responsive.
        }
    }
    document.getElementById('receivedCashC02').value = receivedCashVal;

    document.getElementById('totalSaleComputer').value = savedState.totalSaleComputer || 0;
    document.getElementById('grossSale').value = savedState.grossSale || 0;
    document.getElementById('discountPer').value = savedState.discountPer || 0;

    // Calculate Bank Total for THIS department from Daily Cash
    let deptBankTotal = 0;
    if (currentDailyCashData) {
        const deptBankRecords = currentDailyCashData.filter(r =>
            (r.department && (r.department._id === deptId || r.department === deptId)) && r.mode === 'Bank'
        );
        deptBankTotal = deptBankRecords.reduce((sum, r) => sum + (r.totalAmount || r.amount || 0), 0);
    }
    // Set Bank Total to calculated value (or saved if we want to allow manual override? No, usually auto from daily cash)
    document.getElementById('bankTotal').value = deptBankTotal;

    document.getElementById('coin').value = savedState.coin || 0;
    document.getElementById('divCS').value = savedState.divCS || 0;
    document.getElementById('tSaleManual').value = savedState.tSaleManual || 0;
    document.getElementById('discountValue').value = savedState.discountValue || 0;

    calcClosing02Totals();
}

function updateClosing02State(deptId) {
    if (!deptId) return;

    const currentState = closing02State[deptId] || {};
    closing02State[deptId] = {
        ...currentState,
        counterClosing: parseFloat(document.getElementById('counterClosing').value) || 0,
        lp: parseFloat(document.getElementById('lp').value) || 0,
        misc: parseFloat(document.getElementById('misc').value) || 0,
        openingMinus: parseFloat(document.getElementById('openingMinus').value) || 0,
        receivedCash: parseFloat(document.getElementById('receivedCashC02').value) || 0,
        totalSaleComputer: parseFloat(document.getElementById('totalSaleComputer').value) || 0,
        grossSale: parseFloat(document.getElementById('grossSale').value) || 0,
        discountPer: parseFloat(document.getElementById('discountPer').value) || 0,
        bankTotal: parseFloat(document.getElementById('bankTotal').value) || 0,
        coin: parseFloat(document.getElementById('coin').value) || 0,
        divCS: parseFloat(document.getElementById('divCS').value) || 0,
        tSaleManual: parseFloat(document.getElementById('tSaleManual').value) || 0,
        discountValue: parseFloat(document.getElementById('discountValue').value) || 0,
        // Save calculated totals too if needed
        closing02Total: parseFloat(document.getElementById('closing02Total').value) || 0,
        grandTotal: parseFloat(document.getElementById('closing02GrandTotal').value) || 0,
        totalC02: parseFloat(document.getElementById('totalC02').value) || 0,
        difference: parseFloat(document.getElementById('difference').value) || 0
    };
}

function clearClosing02Form() {
    const inputs = [
        'counterClosing', 'lp', 'misc', 'closing02Total', 'closing02GrandTotal',
        'receivedCashC02', 'openingMinus', 'totalSaleComputer', 'grossSale',
        'discountPer', 'bankTotal', 'coin', 'divCS', 'totalC02', 'tSaleManual',
        'difference', 'discountValue'
    ];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 0;
    });
}

function calcClosing02Totals() {
    // 1. Total (First Block) = Counter Closing + Bank Total (User Request: 1 + 2 Sum)
    const counterClosing = parseFloat(document.getElementById('counterClosing').value) || 0;
    const bankTotal = parseFloat(document.getElementById('bankTotal').value) || 0;
    const block1Total = counterClosing + bankTotal;
    document.getElementById('closing02Total').value = block1Total;

    // 2. Grand Total (Second Green Block - Circled by User)
    // Formula: (Counter Closing + Bank Total) + LP + Coin + Dis & C.S - Misc (-)
    const lp = parseFloat(document.getElementById('lp').value) || 0;
    const misc = parseFloat(document.getElementById('misc').value) || 0;
    const coin = parseFloat(document.getElementById('coin').value) || 0;
    const disCS = parseFloat(document.getElementById('divCS').value) || 0;

    // closing02Total is (Counter Closing + Bank Total)
    const grandTotal = block1Total + lp + coin + disCS - misc;
    document.getElementById('closing02GrandTotal').value = grandTotal;

    // 3. Total (Right Side Green Field) = Grand Total (Left Green) - Received Cash ?
    // Check previous logic:
    // User Diagram arrow: Total (Green Left) -> Received Cash -> Total (Green Right)
    // Previous logic was: rightSideTotal = grandTotal + recCash;
    // Keeping this consistent with flow unless specified otherwise.
    // However, usually "Total" at bottom implies carrying down.

    const recCash = parseFloat(document.getElementById('receivedCashC02').value) || 0;

    // If logic needs to be preserved:
    const rightSideTotal = grandTotal + recCash;
    document.getElementById('totalC02').value = rightSideTotal;
    /*
       Logic:
       1. Total (Left Green) = Counter Closing
       2. Grand Total (Left Green 2) = Counter Closing + LP - Misc
       3. Total (Right Green) = Grand Total (Left Green 2) - Received Cash
       4. Difference = (Total Sale Manual + Discount Value) - Total (Right Green)
    */

    // Formula: Total (Right Green) - Opening (-) = T.Sale Manual
    const openingMinus = parseFloat(document.getElementById('openingMinus').value) || 0;
    const calcTSaleManual = rightSideTotal - openingMinus;
    document.getElementById('tSaleManual').value = calcTSaleManual;

    /*
       Logic:
       1. Total (Left Green) = Counter Closing
       2. Grand Total (Left Green 2) = Counter Closing + LP - Misc
       3. Total (Right Green) = Grand Total (Left Green 2) + Received Cash
       4. T.Sale Manual = Total (Right Green) - Opening (-)
       5. Difference = T.Sale Manual - Total (Right Green) (This will effectively be -Opening)
    */

    // Discount Percentage Calculation
    // Formula: Discount Value / Gross Sale * 100
    const grossSale = parseFloat(document.getElementById('grossSale').value) || 0;
    const discountVal = parseFloat(document.getElementById('discountValue').value) || 0;
    let discountPer = 0;
    if (grossSale !== 0) {
        discountPer = (discountVal / grossSale) * 100;
        // Optional logic: if discountPer has many decimals, fix it. But user input normally implies integer or 2 decimals.
        // Let's keep it clean:
        discountPer = parseFloat(discountPer.toFixed(2));
    }
    document.getElementById('discountPer').value = discountPer;

    // Difference Calculation
    // We use the NEW calculated T.Sale Manual
    const tSaleManual = calcTSaleManual;

    // User Request: T.Sale Manual - Total Sale Computer = Difference
    const totalSaleComputer = parseFloat(document.getElementById('totalSaleComputer').value) || 0;
    const diff = tSaleManual - totalSaleComputer;
    document.getElementById('difference').value = diff;

    // Save state on calc
    const deptId = document.getElementById('closing02Dept').value;
    if (deptId) updateClosing02State(deptId);
}

// Add listeners for calc
const c02Inputs = [
    'counterClosing', 'lp', 'misc', 'receivedCashC02', 'openingMinus',
    'totalSaleComputer', 'bankTotal', 'coin', 'divCS', 'tSaleManual',
    'grossSale', 'discountValue'
];
c02Inputs.forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcClosing02Totals);
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

    // Add Closing 02 Data
    // Save the current form state to state object before saving
    const currentC02Dept = document.getElementById('closing02Dept').value;
    if (currentC02Dept) {
        updateClosing02State(currentC02Dept);
    }
    payload.closing02 = { data: closing02State };

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

        let data;
        try {
            data = await response.json();
        } catch (err) {
            // If JSON parse fails, try text
            const text = await response.text();
            console.error('Non-JSON response:', text);
            alert('Server Error (Non-JSON): ' + text.substring(0, 200));
            return;
        }

        if (data.success) {
            showNotification('Saved successfully');
        } else {
            console.error('Save Error Data:', data);
            showNotification('Error: ' + (data.message || 'Unknown Error'), true);
        }
    } catch (e) { console.error(e); }
}

function printSheet(type) {
    if (type === 'income') {
        printIncomeStatement();
    } else {
        alert('Print functionality for ' + type + ' coming soon');
    }
}

function printIncomeStatement() {
    const branch = document.getElementById('branch').value;
    const date = document.getElementById('date').value;
    const opening = document.getElementById('incomeOpening').value;
    const cashSale = document.getElementById('incomeCashSale').value;
    const bankSale = document.getElementById('incomeBankSale').value;

    const diffIncome = document.getElementById('diffIncome').value;
    const diffExpense = document.getElementById('diffExpense').value;
    const diffBalance = document.getElementById('diffBalance').value;

    // Get formatted table rows (which now include dates and remarks)
    const incomeRows = document.getElementById('incomeDetailsRows').innerHTML;
    const payRows = document.getElementById('payDetailsRows').innerHTML;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Income Statement - ${branch} - ${date}</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    padding: 30px; 
                    color: #333; 
                    max-width: 1000px;
                    margin: 0 auto;
                }
                .header-section { 
                    text-align: center; 
                    margin-bottom: 30px; 
                    border-bottom: 3px solid #2E5C99; 
                    padding-bottom: 20px; 
                }
                .header-section h1 { 
                    margin: 0 0 10px 0; 
                    font-size: 28px; 
                    text-transform: uppercase; 
                    color: #2E5C99;
                    letter-spacing: 1px;
                }
                .meta { 
                    display: flex; 
                    justify-content: space-between; 
                    font-size: 14px;
                    color: #555;
                }
                .meta-item strong { color: #333; }

                .section-header { 
                    background-color: #f0f4f8; 
                    padding: 8px 15px; 
                    font-weight: bold; 
                    font-size: 16px; 
                    color: #1E3A5F;
                    border-left: 5px solid #2E5C99;
                    margin: 25px 0 10px 0;
                }

                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 10px; 
                    font-size: 12px; 
                }
                th { 
                    background-color: #2E5C99; 
                    color: white; 
                    text-align: left; 
                    padding: 8px; 
                    font-weight: 600;
                    border: 1px solid #2E5C99;
                }
                td { 
                    border: 1px solid #DEE2E6; 
                    padding: 8px; 
                }
                tr:nth-child(even) td { background-color: #F8F9FA; }
                
                .text-end { text-align: right; }
                .text-center { text-align: center; }
                .text-bold { font-weight: bold; }
                
                /* Summary Section */
                .summary-container {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 30px;
                    break-inside: avoid;
                }
                .summary-table {
                    width: 350px;
                    border: 2px solid #2E5C99;
                }
                .summary-table td {
                    padding: 10px 15px;
                    font-size: 14px;
                    border: none;
                    border-bottom: 1px solid #ddd;
                }
                .summary-table tr:last-child td {
                    border-bottom: none;
                    background-color: #e8f5e9;
                    font-size: 16px;
                    color: #155724;
                }

                .footer {
                    margin-top: 50px;
                    border-top: 1px solid #ddd;
                    padding-top: 10px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 10px;
                    color: #888;
                }

                @media print {
                    body { margin: 0; padding: 10px; max-width: 100%; }
                    .section-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .summary-table tr:last-child td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="header-section">
                <h1>Income Statement</h1>
                <div class="meta">
                    <span class="meta-item">Branch: <strong>${branch}</strong></span>
                    <span class="meta-item">Date: <strong>${date}</strong></span>
                </div>
            </div>

            <!-- 1. Income Sources (Key Metrics) -->
            <div class="section-header">Income Sources (Cash & Bank)</div>
            <table>
                <thead>
                    <tr>
                        <th>Source</th>
                        <th class="text-end" style="width: 200px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Opening Balance</td>
                        <td class="text-end text-bold">${parseFloat(opening).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td>Cash Sale</td>
                        <td class="text-end text-bold">${parseFloat(cashSale).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td>Bank Sale</td>
                        <td class="text-end text-bold">${parseFloat(bankSale).toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>

            <!-- 2. Other Income Table -->
            <div class="section-header">Other Income / Receipts</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 15%">Date</th>
                        <th style="width: 20%">Detail</th>
                        <th style="width: 15%">Head</th>
                        <th style="width: 15%">Sub Head</th>
                        <th style="width: 20%">Remarks</th>
                        <th class="text-end" style="width: 15%">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${incomeRows}
                </tbody>
            </table>

            <!-- 3. Expenses Table -->
            <div class="section-header">Expenses (Pay)</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 15%">Date</th>
                        <th style="width: 20%">Detail</th>
                        <th style="width: 15%">Head</th>
                        <th style="width: 15%">Sub Head</th>
                        <th style="width: 20%">Remarks</th>
                        <th class="text-end" style="width: 15%">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${payRows}
                </tbody>
            </table>

            <!-- 4. Summary -->
            <div class="summary-container">
                <table class="summary-table">
                    <tr>
                        <td><strong>Total Income</strong></td>
                        <td class="text-end text-bold">${parseFloat(diffIncome).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="color: #dc3545;"><strong>Total Expense</strong></td>
                        <td class="text-end text-bold" style="color: #dc3545;">${parseFloat(diffExpense).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td><strong>Closing Balance</strong></td>
                        <td class="text-end text-bold">${parseFloat(diffBalance).toLocaleString()}</td>
                    </tr>
                </table>
            </div>

            <div class="footer">
                <span>Generated by BAS Software</span>
                <span>User: ${document.getElementById('userName').textContent} | Printed on ${new Date().toLocaleString()}</span>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
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
    const branch = document.getElementById('branch').value;

    if (!fromDate) {
        alert('Please select date');
        return;
    }

    const reportOutput = document.getElementById('reportOutput');
    if (!reportOutput) return;

    reportOutput.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Generating report...</p>';

    try {
        const token = localStorage.getItem('token');

        // 1. Fetch Closing Sheet Data for the Date
        const response = await fetch(`/api/v1/closing-sheets?date=${fromDate}&branch=${branch}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await response.json();
        const sheet = json.data || {};
        const closing02 = sheet.closing02 && sheet.closing02.data ? sheet.closing02.data : {};

        // 2. Fetch Departments to iterate
        // Use global `currentDepartments` if available, else fetch
        let departments = currentDepartments;
        if (!departments || departments.length === 0) {
            const dResp = await fetch('/api/v1/departments', { headers: { 'Authorization': `Bearer ${token}` } });
            const dData = await dResp.json();
            departments = dData.data || [];
        }

        // Filter valid departments (e.g. Active)
        departments = departments.filter(d => d.isActive).sort((a, b) => (parseInt(a.code) || 99).toString().localeCompare((parseInt(b.code) || 99).toString())); // Simple sort

        let reportHTML = '';

        if (reportType === 'openingBalance') {
            // 1. Fetch Cash Sales for the Date (for Counter Sales integration)
            const csResp = await fetch(`/api/v1/cash-sales?date=${fromDate}&branch=${branch}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const csJson = await csResp.json();
            const cashSales = csJson.data || [];

            // User Request: All Cash Counter Sales should be summed into OPTICS department
            const totalCounterSales = cashSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

            // Pre-calculate Total % Cash Rec (Deduction Sum) for PERCENTAGE CASH Department
            let totalPercentageCashSum = 0;
            departments.forEach(d => {
                if (d.name.toUpperCase() === 'PERCENTAGE CASH') return;
                const state = closing02[d._id] || {};
                const sale = state.totalSaleComputer || 0;
                const rate = d.deduction || 0;
                const ded = Math.round((sale * rate) / 100);
                totalPercentageCashSum += ded;
            });

            // Build Rows
            let rowsHTML = '';

            // Totals
            let totalOpening = 0;
            let totalReceived = 0;
            let totalPercCash = 0;
            let totalGrand = 0;
            let totalSaleComp = 0;
            let totalDed = 0;
            let totalNet = 0;
            let totalRate = 0; // Sum of rates? Reference shows 45.00 sum.

            departments.forEach(dept => {
                const dId = dept._id;
                const dName = dept.name;
                const state = closing02[dId] || {};

                // Map Fields
                // Opening Amount: In UI it is 'Opening (-)' which is usually Previous Closing.
                // In reference: negative values shown. 
                // Let's use `openingMinus` from state.
                // Note: If user entered positive `openingMinus`, it means subtract positive. 
                // Reference has NEGATIVE "Opening Amount". 
                // User Ref: "Opening Amount" column.
                // Let's just take `openingMinus`. If it matches the input, good.
                // Actually, `openingMinus` in Closing 02 is "Opening (-)".
                // Let's assume the value in DB is what we show.
                // HOWEVER, Reference image has "Medicine: -471,304".
                // If the UI input was 471304 (positive because label says (-)), then we might need to negate it.
                // But let's check one row logic: (-471304) + 367334 = -103970.
                // Logic: Opening + Received = GrandTotal.
                // So if `openingMinus` is positive 471304, we should treat it as -471304.

                // 1. Opening Amount (From Department Opening Tab)
                let opAmt = 0;
                if (Array.isArray(sheet.departmentOpening)) {
                    const found = sheet.departmentOpening.find(x => (x.department === dId || (x.department && x.department._id === dId)));
                    if (found) opAmt = Number(found.amount) || 0;
                } else if (sheet.departmentOpening && sheet.departmentOpening[dId]) {
                    opAmt = Number(sheet.departmentOpening[dId].amount) || Number(sheet.departmentOpening[dId].openingBalance) || 0;
                }

                // Filter: Hide department if Opening Amount is 0 (not available in plus or minus)
                if (opAmt === 0 && dName.toUpperCase() !== 'OPTICS') return;

                // 2. Received Cash
                // Part A: From Closing Sheet 2 Received Cash Column (Manual Entry)
                const recCashSheet = Number(state.receivedCash) || 0;

                // Part B: From Cash Counter Cash Sale (Auto Entry)
                // User Request: All Cash Sales go to OPTICS. Others get 0.
                let recCashCounter = 0;
                if (dName.toUpperCase() === 'OPTICS') {
                    recCashCounter = totalCounterSales;
                }

                // Total Received Cash
                const totalRecCashForDept = recCashSheet + recCashCounter;

                // For legacy variable support in later code
                let recCash = totalRecCashForDept;

                // Rate: From Department Settings (Deduction field)
                const rate = dept.deduction || 0;

                // Total Sale Computer
                const saleComp = state.totalSaleComputer || 0;

                // Ded (Deduction) = Sale * Rate / 100
                const ded = Math.round((saleComp * rate) / 100);

                // % Cash Rec From Dept Formula: Only Rate % Calculation Value (Deduction)
                let percCashRec = ded;

                // Logic: For "PERCENTAGE CASH" department, show sum of all other departments' deductions
                if (dName.toUpperCase() === 'PERCENTAGE CASH') {
                    percCashRec = totalPercentageCashSum;
                    recCash = 0;
                }

                // GrandTotal: Only PERCENTAGE CASH dept includes the % Cash Rec amount in its total. Exception: CASH REC FROM COUNTER is always 0.
                let grandTotal = Math.round(opAmt + recCash + (dName.toUpperCase() === 'PERCENTAGE CASH' ? percCashRec : 0));
                if (dName.toUpperCase() === 'CASH REC FROM COUNTER') grandTotal = 0;

                // Net_Total = GrandTotal - Ded
                const netTotal = Math.round(grandTotal - ded);

                // Update Totals
                totalOpening += opAmt;
                totalReceived += recCash;
                if (dName.toUpperCase() !== 'PERCENTAGE CASH') totalPercCash += percCashRec;
                totalGrand += grandTotal;
                totalSaleComp += saleComp;
                totalDed += ded;
                totalNet += netTotal;
                totalRate += rate;

                // Rows
                rowsHTML += `
                    <tr>
                        <td>${dName}</td>
                        <td class="text-end">${opAmt.toLocaleString()}</td> <!-- Watches Removed -->
                        <td class="text-end">${recCash.toLocaleString()}</td>
                        <td class="text-end">${dName.toUpperCase() === 'PERCENTAGE CASH' && percCashRec !== 0 ? percCashRec.toLocaleString() : ''}</td>
                        <td class="text-end">${grandTotal.toLocaleString()}</td>
                        <td class="text-center">${rate > 0 ? rate.toFixed(2) : ''}</td>
                        <td class="text-end">${saleComp.toLocaleString()}</td>
                        <td class="text-end">${ded.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td class="text-end fw-bold">${netTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                `;
            });

            // Format Totals
            const footerHTML = `
                <tr class="fw-bold" style="background-color: black; color: white;">
                    <td>Total</td>
                    <td class="text-end">${totalOpening.toLocaleString()}</td>
                    <td class="text-end">${totalReceived.toLocaleString()}</td>
                    <td class="text-end">${totalPercCash.toLocaleString()}</td>
                    <td class="text-end">${totalGrand.toLocaleString()}</td>
                    <td class="text-center"></td>
                    <td class="text-end">${totalSaleComp.toLocaleString()}</td>
                    <td class="text-end">${totalDed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td class="text-end">${totalNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                </tr>
            `;

            reportHTML = `
                <div id="printArea">
                    <style>
                        @media print {
                            body * { visibility: hidden; }
                            #printArea, #printArea * { visibility: visible; }
                            #printArea { position: absolute; left: 0; top: 0; width: 100%; }
                            table { width: 100%; border-collapse: collapse; font-size: 12px; }
                            th, td { border: 1px solid black; padding: 4px; }
                            th { background-color: #ccc !important; color: black !important; -webkit-print-color-adjust: exact; }
                            tfoot tr, tfoot td { background-color: transparent !important; color: black !important; border: 1px solid black !important; }
                        }
                        .report-header { text-align: center; margin-bottom: 20px; }
                        .report-meta { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; }
                        table { width: 100%; border-collapse: collapse; }
                        th { border: 1px solid black; padding: 5px; text-align: center; }
                        @media screen {
                            th { background-color: #007bff !important; color: white !important; }
                            tfoot tr { background-color: black !important; color: white !important; }
                            tfoot td { background-color: black !important; color: white !important; border: 1px solid white !important; }
                        }
                        td { border: 1px solid black; padding: 5px; }
                    </style>
                    
                    <div class="report-header">
                        <h3>Opening Balance and Received Cash Detail</h3>
                    </div>
                    <div class="report-meta">
                        <span>${new Date(fromDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        <span>(${branch})</span>
                    </div>

                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Department</th>
                                <th>Opening Amount</th>
                                <th>Received Cash</th>
                                <th>% Cash Rec From Dept</th>
                                <th>GrandTotal</th>
                                <th>Rate</th>
                                <th>Total Sale Computer</th>
                                <th>Ded</th>
                                <th>Net_Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML}
                        </tbody>
                        <tfoot>
                            ${footerHTML}
                        </tfoot>
                    </table>
                </div>
                <div class="mt-3 text-end section-no-print">
                    <button class="btn btn-primary" onclick="window.print()"><i class="fas fa-print"></i> Print Report</button>
                </div>
            `;
        }

        reportOutput.innerHTML = reportHTML;

    } catch (e) {
        console.error('Error generating report:', e);
        reportOutput.innerHTML = '<p class="text-danger">Error generating report. Please check console.</p>';
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

// --- Modal Logic ---

function openDepartmentSalesModal() {
    const tbody = document.querySelector('#deptSalesTable tbody');
    tbody.innerHTML = '';

    const currentDeptId = document.getElementById('closing02Dept').value;
    if (!currentDeptId) {
        alert('Please select a department first');
        return;
    }

    console.log('Opening Modal for:', currentDeptId);
    console.log('Current State:', closing02State[currentDeptId]);

    let hasRows = false;
    const deptState = closing02State[currentDeptId] || {};
    let breakdown = deptState.salesBreakdown || {};

    // MIGRATION: If no scoped breakdown exists, check for Global Legacy Data
    if (Object.keys(breakdown).length === 0) {
        const legacyBreakdown = {};
        let foundLegacy = false;
        if (typeof currentDepartments !== 'undefined') {
            currentDepartments.forEach(d => {
                // Check global scope for this department
                const globalData = closing02State[d._id];
                if (globalData && (globalData.totalSaleComputer > 0 || globalData.computerSaleComponent > 0 || globalData.costSale > 0)) {
                    // Include if it's the Current Department OR a 'Pure' Child Component (Not a Main Dept)
                    // This prevents other Main Departments (like Grocery) from appearing in Medicine's popup during migration
                    if (d._id === currentDeptId || (d.closing2CompSale && !d.closing2DeptDropDown)) {
                        const sale = globalData.computerSaleComponent || globalData.totalSaleComputer || 0;
                        const cost = globalData.costSale || 0;
                        if (sale > 0 || cost > 0) {
                            legacyBreakdown[d._id] = { sale, cost };
                            foundLegacy = true;
                        }
                    }
                }
            });
        }
        if (foundLegacy) {
            console.log('Legacy Data Detected. Migrating view for:', currentDeptId);
            breakdown = legacyBreakdown; // Use legacy data for this view
        }
    }

    // Clear existing table
    tbody.innerHTML = '';

    Object.keys(breakdown).forEach(subDeptId => {
        const data = breakdown[subDeptId];
        // Only add row if it has data or if it's explicitly tracked
        if (data.sale !== 0 || data.cost !== 0) {
            addDeptSaleRow(subDeptId, data.sale || 0, data.cost || 0);
            hasRows = true;
        }
    });

    // If no existing data found, add default row for current dept
    if (!hasRows) {
        addDeptSaleRow(currentDeptId);
    }

    // Update Total
    calcModalTotal();

    // Show Modal
    const modal = new bootstrap.Modal(document.getElementById('departmentSalesModal'));
    modal.show();
}

function addDeptSaleRow(deptId = '', sale = 0, cost = 0) {
    // Default to currently selected department if not provided
    if (!deptId) {
        deptId = document.getElementById('closing02Dept').value;
    }

    const tbody = document.querySelector('#deptSalesTable tbody');
    const tr = document.createElement('tr');

    // Build Department Options
    let options = '<option value="">Select Department</option>';
    currentDepartments.forEach(d => {
        if (!d.closing2CompSale) return; // User Request: Only show 'Closing 2 Comp Sale' departments
        const selected = d._id === deptId ? 'selected' : '';
        options += `<option value="${d._id}" ${selected}>${d.name}</option>`;
    });

    tr.innerHTML = `
        <td>
            <select class="form-select form-select-sm modal-dept-select">
                ${options}
            </select>
        </td>
        <td>
            <input type="number" class="form-control form-control-sm modal-sale-input" value="${sale}" oninput="calcModalTotal()">
        </td>
        <td>
            <input type="number" class="form-control form-control-sm modal-cost-input" value="${cost}">
        </td>
        <td class="text-center">
            <button class="btn btn-sm btn-danger" onclick="removeDeptSaleRow(this)"><i class="fas fa-trash"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
}

function removeDeptSaleRow(btn) {
    btn.closest('tr').remove();
    calcModalTotal();
}

function calcModalTotal() {
    let total = 0;
    document.querySelectorAll('.modal-sale-input').forEach(inp => {
        total += parseFloat(inp.value) || 0;
    });
    document.getElementById('modalTotalAmount').value = total;
}

function saveDepartmentSalesModal() {
    const currentDeptId = document.getElementById('closing02Dept').value;
    if (!currentDeptId) {
        alert('Error: No active department found');
        return;
    }

    // 1. Accumulate Data from Modal
    const breakdown = {};
    let grandTotalSale = 0;

    document.querySelectorAll('#deptSalesTable tbody tr').forEach(tr => {
        const deptId = tr.querySelector('.modal-dept-select').value;
        const sale = parseFloat(tr.querySelector('.modal-sale-input').value) || 0;
        const cost = parseFloat(tr.querySelector('.modal-cost-input').value) || 0;

        if (deptId) {
            // ONLY add to breakdown if it has valid data
            // This ensures that if a user deletes a row (or clears values), it isn't saved back into state if empty
            // However, to allow "0" to be a valid update (overwriting previous data), we tracked it.
            // But the user issue is "deleted row reappears".
            // If the row exists in the modal, we save it. If the user DELETED the row from the DOM, it won't be in this loop, so it won't be in 'breakdown'.
            // Thus, 'breakdown' will effectively replace the old state, removing deleted items.
            breakdown[deptId] = { sale, cost };
            grandTotalSale += sale;
        }
    });

    // 2. Save to State (Scoped to Current Department)
    if (!closing02State[currentDeptId]) closing02State[currentDeptId] = {};

    closing02State[currentDeptId].salesBreakdown = breakdown;
    closing02State[currentDeptId].totalSaleComputer = grandTotalSale;

    // 3. Update UI
    document.getElementById('totalSaleComputer').value = grandTotalSale;
    calcClosing02Totals();

    // CRITICAL: Re-assign breakdown in case calcClosing02Totals/updateClosing02State wiped it
    if (closing02State[currentDeptId]) {
        closing02State[currentDeptId].salesBreakdown = breakdown;
        console.log('Saved Breakdown for', currentDeptId, breakdown);
    }

    // Refresh Side Table
    loadClosing02DeptTable(currentDepartments);

    // 4. Close Modal
    const el = document.getElementById('departmentSalesModal');
    const modal = bootstrap.Modal.getInstance(el);
    modal.hide();
}

function showNotification(message, isError = false) {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '20px';
    div.style.right = '20px';
    div.style.padding = '10px 20px';
    div.style.backgroundColor = isError ? '#dc3545' : '#28a745';
    div.style.color = 'white';
    div.style.borderRadius = '5px';
    div.style.zIndex = '9999';
    div.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    div.style.fontWeight = 'bold';
    div.textContent = message;
    document.body.appendChild(div);

    setTimeout(() => {
        div.remove();
    }, 2000);
}

// --- Warehouse Sale Logic ---

let warehouseCategories = [];

async function loadWarehouseCategories() {
    if (warehouseCategories.length > 0) return;
    try {
        const token = localStorage.getItem('token');
        // Load only Customer categories for Warehouse Sale
        const res = await fetch('/api/v1/customer-categories', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        warehouseCategories = json.data || [];
    } catch (err) {
        console.error('Failed to load categories', err);
        showNotification('Error loading categories', true);
    }
}

async function openWarehouseSaleModal() {
    // Force reload categories to ensure latest data
    warehouseCategories = [];
    await loadWarehouseCategories();

    const tbody = document.querySelector('#warehouseSaleTable tbody');
    tbody.innerHTML = '';

    const savedData = closing02State.warehouseSale || [];

    if (savedData.length > 0) {
        savedData.forEach(item => {
            addWarehouseRow(item.category, item.sale, item.cost);
        });
    } else {
        addWarehouseRow();
    }

    calcWarehouseTotal();

    const modal = new bootstrap.Modal(document.getElementById('warehouseSaleModal'));
    modal.show();
}

function addWarehouseRow(catId = '', sale = 0, cost = 0) {
    const tbody = document.querySelector('#warehouseSaleTable tbody');
    const tr = document.createElement('tr');

    let options = '<option value="">Select Category</option>';
    warehouseCategories.forEach(c => {
        const selected = c._id === catId ? 'selected' : '';
        options += `<option value="${c._id}" ${selected}>${c.name}</option>`;
    });

    const profit = (sale || 0) - (cost || 0);

    tr.innerHTML = `
        <td>
            <select class="form-select form-select-sm warehouse-cat-select">
                ${options}
            </select>
        </td>
        <td>
            <input type="number" class="form-control form-control-sm warehouse-sale-input" value="${sale}" oninput="calcWarehouseTotal()">
        </td>
        <td>
            <input type="number" class="form-control form-control-sm warehouse-cost-input" value="${cost}" oninput="calcWarehouseTotal()">
        </td>
        <td>
            <input type="number" class="form-control form-control-sm warehouse-profit-input bg-light fw-bold" value="${profit}" readonly>
        </td>
        <td class="text-center">
            <button class="btn btn-sm btn-danger" onclick="removeWarehouseRow(this)"><i class="fas fa-trash"></i></button>
        </td>
    `;
    tbody.appendChild(tr);
}

function removeWarehouseRow(btn) {
    btn.closest('tr').remove();
    calcWarehouseTotal();
}

function calcWarehouseTotal() {
    let totalSale = 0;
    let totalCost = 0;

    const rows = document.querySelectorAll('#warehouseSaleTable tbody tr');
    rows.forEach(tr => {
        const saleInp = tr.querySelector('.warehouse-sale-input');
        const costInp = tr.querySelector('.warehouse-cost-input');
        const profitInp = tr.querySelector('.warehouse-profit-input');

        const sale = parseFloat(saleInp.value) || 0;
        const cost = parseFloat(costInp.value) || 0;
        const profit = sale - cost;

        if (profitInp) profitInp.value = profit;

        totalSale += sale;
        totalCost += cost;
    });

    const totalProfit = totalSale - totalCost;

    const tSaleEl = document.getElementById('warehouseTotalAmount');
    const tCostEl = document.getElementById('warehouseTotalCost');
    const tProfitEl = document.getElementById('warehouseTotalProfit');

    if (tSaleEl) tSaleEl.value = totalSale;
    if (tCostEl) tCostEl.value = totalCost;
    if (tProfitEl) tProfitEl.value = totalProfit;
}



function saveWarehouseSale() {
    const data = [];
    document.querySelectorAll('#warehouseSaleTable tbody tr').forEach(tr => {
        const catId = tr.querySelector('.warehouse-cat-select').value;
        const sale = parseFloat(tr.querySelector('.warehouse-sale-input').value) || 0;
        const cost = parseFloat(tr.querySelector('.warehouse-cost-input').value) || 0;
        if (catId) {
            data.push({ category: catId, sale, cost });
        }
    });

    closing02State.warehouseSale = data;
    showNotification('Warehouse Sale Saved (In Memory). Click Main Save to Persist.');

    const el = document.getElementById('warehouseSaleModal');
    const modal = bootstrap.Modal.getInstance(el);
    modal.hide();
}
// --- Income Statement Logic ---
async function loadIncomeStatementData() {
    const branch = document.getElementById('branch').value;
    const date = document.getElementById('date').value;
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`/api/v1/closing-sheets/income-statement?date=${date}&branch=${branch}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();

        if (json.success) {
            const { cashSaleTotal, bankSaleTotal, payExpenses, incomeExpenses, openingBalance } = json.data;

            // Populate Income Inputs
            document.getElementById('incomeOpening').value = openingBalance || 0;
            document.getElementById('incomeCashSale').value = cashSaleTotal || 0;
            document.getElementById('incomeBankSale').value = bankSaleTotal || 0;

            // Populate Income Details (Receipts) - Table Based
            const incomeContainer = document.getElementById('incomeDetailsRows');
            incomeContainer.innerHTML = '';

            if (incomeExpenses && incomeExpenses.length > 0) {
                incomeExpenses.forEach(exp => {
                    const tr = document.createElement('tr');

                    let expDate = '-';
                    if (exp.date) {
                        expDate = new Date(exp.date).toLocaleDateString(); // Try standard format
                    } else if (exp.createdAt) {
                        expDate = new Date(exp.createdAt).toLocaleDateString();
                    }

                    // Prepend Date to remarks for debugging user visibility
                    const debugNotes = `(RawDate: ${exp.date}) ` + (exp.notes || '-');

                    tr.innerHTML = `
                        <td>${expDate}</td>
                        <td>${exp.description || '-'}</td>
                        <td>${exp.head || '-'}</td>
                        <td>${exp.subHead || '-'}</td>
                        <td>${exp.notes || '-'}</td>
                        <td class="text-end fw-bold text-success">${(exp.amount || 0).toLocaleString()}</td>
                        <input type="hidden" class="amount-income-val" value="${exp.amount || 0}"> 
                     `;
                    incomeContainer.appendChild(tr);
                });
            } else {
                incomeContainer.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No receipts</td></tr>';
            }

            // Populate Pay Details (Expenses) - Table Based
            const payContainer = document.getElementById('payDetailsRows');
            payContainer.innerHTML = '';

            if (payExpenses && payExpenses.length > 0) {
                payExpenses.forEach(exp => {
                    const tr = document.createElement('tr');

                    let expDate = '-';
                    if (exp.date) {
                        expDate = new Date(exp.date).toLocaleDateString();
                    } else if (exp.createdAt) {
                        expDate = new Date(exp.createdAt).toLocaleDateString();
                    }

                    tr.innerHTML = `
                         <td>${expDate}</td>
                         <td>${exp.description || '-'}</td>
                        <td>${exp.head || '-'}</td>
                        <td>${exp.subHead || '-'}</td>
                        <td>${exp.notes || '-'}</td>
                        <td class="text-end fw-bold text-danger">${(exp.amount || 0).toLocaleString()}</td>
                        <input type="hidden" class="amount-pay-val" value="${exp.amount || 0}">
                     `;
                    payContainer.appendChild(tr);
                });
            } else {
                payContainer.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No expenses</td></tr>';
            }

            // Recalculate Differences
            calcIncomeStatementTotals();
        }
    } catch (e) {
        console.error('Error loading income statement:', e);
    }
}

function calcIncomeStatementTotals() {
    // Income
    const opening = parseFloat(document.getElementById('incomeOpening').value) || 0;
    const cashSale = parseFloat(document.getElementById('incomeCashSale').value) || 0;
    const bankSale = parseFloat(document.getElementById('incomeBankSale').value) || 0;

    let otherIncome = 0;
    // Use hidden inputs for accurate values from table
    document.querySelectorAll('.amount-income-val').forEach(el => otherIncome += parseFloat(el.value) || 0);

    const totalIncome = opening + cashSale + bankSale + otherIncome;
    document.getElementById('diffIncome').value = totalIncome;

    // Expense
    let totalExpense = 0;
    document.querySelectorAll('.amount-pay-val').forEach(el => totalExpense += parseFloat(el.value) || 0);
    document.getElementById('diffExpense').value = totalExpense;

    // Balance
    document.getElementById('diffBalance').value = totalIncome - totalExpense;
}

// Save Income Statement
async function saveIncomeStatement() {
    const branch = document.getElementById('branch').value;
    const date = document.getElementById('date').value;
    const openingBalance = parseFloat(document.getElementById('incomeOpening').value) || 0;
    const closingBalance = parseFloat(document.getElementById('diffBalance').value) || 0;
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/v1/closing-sheets/income-statement', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                date,
                branch,
                openingBalance,
                closingBalance
            })
        });

        const json = await response.json();
        if (json.success) {
            showNotification('Income Statement Saved Successfully');
        } else {
            showNotification('Error: ' + json.message, true);
        }
    } catch (error) {
        console.error('Error saving income statement:', error);
        showNotification('Error saving income statement', true);
    }
}
