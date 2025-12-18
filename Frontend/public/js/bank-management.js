document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Fields - Default Cheque Dates to today, others empty for "yyyy-mm-dd"
    const today = new Date().toISOString().split('T')[0];
    const dateFields = document.querySelectorAll('input[type="date"]');
    dateFields.forEach(field => {
        if (field.id === 'bp-chq-from' || field.id === 'bp-chq-to') {
            field.value = today;
        } else if (field.id.includes('from') || field.id.includes('to') || field.id.includes('search')) {
            field.value = '';
        } else {
            field.value = today;
        }
    });

    // Initial Load - Load Banks FIRST so we can filter departments by them
    await loadAllBanks();
    await loadBranches();
    // Set default tab based on URL hash or first tab
    const hash = window.location.hash || '#bank-detail';
    const tabTrigger = document.querySelector(`button[data-bs-target="${hash}"]`);
    if (tabTrigger) tabTrigger.click();

    // Event Listeners for Filters
    document.querySelectorAll('.branch-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const scope = e.target.closest('.tab-pane');
            loadDepartments(scope);
        });
    });

    document.querySelectorAll('.dept-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const scope = e.target.closest('.tab-pane');
            filterBanks(scope);
        });
    });

    // Select All Batches Logic
    const selectAllDetails = document.getElementById('selectAllBatches');
    if (selectAllDetails) {
        selectAllDetails.addEventListener('change', function () {
            const isChecked = this.checked;
            document.querySelectorAll('.batch-checkbox').forEach(cb => cb.checked = isChecked);
        });
    }
});

let allBranches = [];
let allDepartments = [];
let allBanksReference = []; // To store all banks and filter locally

// Shared Data Loaders
async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/stores', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        if (data.success) {
            allBranches = data.data;
            const selects = document.querySelectorAll('.branch-select');
            selects.forEach(sel => {
                const currentVal = sel.value;
                sel.innerHTML = '<option value="">Select Branch</option>'; // Or PWD-1 as default if needed
                allBranches.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b.name;
                    opt.textContent = b.name;
                    sel.appendChild(opt);
                });
                // Default to first if available or PWD-1
                if (allBranches.length > 0) sel.value = allBranches[0].name;
            });
            // Trigger department load for all scopes
            document.querySelectorAll('.tab-pane').forEach(scope => loadDepartments(scope));
        }
    } catch (e) { console.error(e); }
}

async function loadDepartments(scopeElement) {
    if (!scopeElement) return;
    const branchSel = scopeElement.querySelector('.branch-select');
    const deptSel = scopeElement.querySelector('.dept-select');
    if (!branchSel || !deptSel) return;

    const branch = branchSel.value;
    deptSel.innerHTML = '<option value="">Select Department</option>';

    if (!branch) return;

    try {
        const token = localStorage.getItem('token');
        // We could cache this but fetching for freshness is safer for now
        const response = await fetch('/api/v1/departments', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        if (data.success) {
            // Filter departments: Must be active, match branch, AND have at least one bank
            const filtered = data.data.filter(d => {
                const isActiveAndBranch = d.branch === branch && d.isActive;
                if (!isActiveAndBranch) return false;

                // Check if any bank belongs to this department
                // Bank department field can be ID string or object
                const hasBank = allBanksReference.some(b => {
                    const bankDeptId = (b.department && b.department._id) ? b.department._id : b.department;
                    return bankDeptId === d._id;
                });
                return hasBank;
            });

            if (filtered.length === 0) {
                const opt = document.createElement('option');
                opt.textContent = "No Departments with Banks";
                opt.disabled = true;
                opt.selected = true;
                deptSel.appendChild(opt);
            } else {
                filtered.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d._id;
                    opt.textContent = d.name;
                    deptSel.appendChild(opt);
                });
            }
            // Trigger bank filter
            filterBanks(scopeElement);
        }
    } catch (e) { console.error(e); }
}

async function loadAllBanks() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/banks', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        if (data.success) {
            allBanksReference = data.data;
            // Initial filter for active tabs
            document.querySelectorAll('.tab-pane').forEach(scope => filterBanks(scope));
        }
    } catch (e) { console.error(e); }
}

function filterBanks(scopeElement) {
    if (!scopeElement) return;
    const bankSel = scopeElement.querySelector('.bank-select');
    if (!bankSel) return;

    const branchVal = scopeElement.querySelector('.branch-select')?.value;
    const deptVal = scopeElement.querySelector('.dept-select')?.value;

    bankSel.innerHTML = '<option value="">Select Bank</option>';

    const filtered = allBanksReference.filter(b => {
        if (branchVal && b.branch !== branchVal) return false;
        if (deptVal && b.department && b.department !== deptVal) return false;
        return true;
    });



    filtered.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b._id;
        opt.textContent = b.bankName;
        bankSel.appendChild(opt);
    });
    // Remove if desired: bankSel.value = ""; // Reset or keep?
}

// Expose functions for other logic files
window.loadDepartments = loadDepartments;
window.filterBanks = filterBanks;
window.loadBranches = loadBranches;
window.loadAllBanks = loadAllBanks;
window.updateBankRowsStatus = updateBankRowsStatus;

// --- Tab 1: Bank Detail Functions ---
async function searchBankDetails() {
    const fromDate = document.getElementById('bd-from-date').value;
    const toDate = document.getElementById('bd-to-date').value;
    const branch = document.getElementById('bd-branch').value;
    const dept = document.getElementById('bd-dept').value;
    const bank = document.getElementById('bd-bank').value;
    const isDeduction = document.getElementById('deductionOption').checked; // If true, filter for batches/deductions

    if (!fromDate || !toDate) {
        alert('Please select a date range');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        let url;

        if (isDeduction) {
            // Bank Deduction (Daily Cash)
            // User requested "all bank entries" from daily cash
            url = `/api/v1/daily-cash?startDate=${fromDate}&endDate=${toDate}&mode=Bank&hasBank=true`;
            if (branch) url += `&branch=${branch}`;
        } else {
            // Bank Payment (Bank Transactions) - Assuming type='debit' or general fetch
            // We'll filter by 'payment' type if the API supports it, or valid 'bank' transactions
            url = `/api/v1/bank-transactions?startDate=${fromDate}&endDate=${toDate}`;
            if (branch) url += `&branch=${branch}`;
            // If the API supports filtering by transaction type (e.g. 'payment' vs 'receipt'), add it here
            // url += '&type=payment'; 
        }

        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();

        if (data.success) {
            let filtered = data.data;

            // Client-side Refined Filtering
            if (isDeduction) {
                // EXTREMELY STRICT: If there is no bank object, it is "Cash data" and must NOT show here.
                filtered = filtered.filter(item => item.bank && (item.bank.bankName || typeof item.bank === 'string'));
            }

            if (dept) filtered = filtered.filter(item => item.department && (item.department._id === dept || item.department === dept));

            if (bank) {
                filtered = filtered.filter(item => {
                    // Check populated bank object or direct ID
                    const itemBankId = (item.bank && item.bank._id) ? item.bank._id : item.bank;
                    return itemBankId === bank;
                });
            }

            // Map Data to Common Format
            const mappedData = filtered.map(item => {
                let mapped = {
                    date: item.date,
                    bank: item.bank,
                    remarks: item.remarks || item.details || item.description || '',
                    batchNo: item.batchNo || '-',
                    _id: item._id,
                    isVerified: item.isVerified || false,
                    department: item.department ? (item.department.name || item.department) : '-'
                };

                if (isDeduction) {
                    const ratePerc = item.deductedAmount || 0;
                    const grossBase = (item.totalAmount || 0) + ratePerc;

                    mapped.ratePercent = ratePerc;
                    mapped.amount = grossBase;
                    mapped.deduction = (grossBase * ratePerc) / 100;
                    mapped.total = Math.round(grossBase - mapped.deduction);

                    mapped.department = item.department ? (item.department.name || item.department) : '-';
                    mapped.bank = item.bank && item.bank.bankName ? item.bank.bankName : (item.bankName || item.bank || '-');
                    mapped.remarks = item.remarks || item.description || '';
                    mapped.batchNo = item.batchID || item.batchNo || '-';
                } else {
                    // Bank Payment Logic (BankTransaction model)
                    mapped.amount = item.amount || 0;
                    mapped.deduction = 0;
                    mapped.total = item.amount || 0;

                    // Map correct fields from BankTransaction
                    mapped.bank = item.bankName || (item.bank && item.bank.bankName) || item.bank || '-';
                    mapped.remarks = item.narration || item.remarks || '-';
                    mapped.batchNo = item.invoiceNo || '-';
                    mapped.department = item.department ? (item.department.name || item.department) : '-';
                }
                return mapped;
            });

            // Sort by Date Ascending (Oldest first at top, Newest at bottom)
            mappedData.sort((a, b) => new Date(a.date) - new Date(b.date));

            renderBankDetailGrid(mappedData, isDeduction);
        } else {
            console.error(data.message);
            alert('Failed to fetch data');
        }
    } catch (e) {
        console.error(e);
        alert('Error fetching data');
    }
}

function renderBankDetailGrid(data, isDeduction) {
    const tbody = document.getElementById('bankDetailsBody');
    tbody.innerHTML = '';

    // Toggle Headers Visibility
    const headers = document.querySelectorAll('#bankDetailsTable thead th');
    if (headers.length > 0) {
        // Indices: 2 (Batch Transfer Date), 6 (Rate), 7 (Deduction), 8 (Total)
        const displayStyle = isDeduction ? '' : 'none';
        if (headers[2]) headers[2].style.display = displayStyle;
        if (headers[6]) headers[6].style.display = displayStyle;
        if (headers[7]) headers[7].style.display = displayStyle;
        if (headers[8]) headers[8].style.display = displayStyle;
    }

    let greenTotal = 0;
    let redTotal = 0;

    data.forEach(item => {
        const deduction = item.deduction || 0;
        const total = item.total || 0;
        const amount = item.amount || 0;
        const rate = item.ratePercent || 0;

        if (item.isVerified) {
            greenTotal += total;
        } else {
            redTotal += total;
        }

        const bankName = item.bank ? (item.bank.bankName || item.bank) : '-';
        const dateStr = new Date(item.date).toISOString().split('T')[0];

        const tr = document.createElement('tr');
        tr.dataset.id = item._id; // Store ID for persistence

        let html = `
            <td>${dateStr}</td>
            <td class="text-center"><input type="checkbox" class="batch-checkbox" value="${item._id}" ${item.isVerified ? 'checked' : ''}></td>
        `;

        if (isDeduction) {
            html += `<td><input type="date" class="form-control form-control-sm border-0 bg-transparent batch-date-input" value="${dateStr}"></td>`;
        } else {
            html += `<td style="display:none"></td>`;
        }

        html += `<td>${bankName}</td>
                 <td>${item.department || '-'}</td>
                 <td>${amount.toLocaleString()}</td>`;

        if (isDeduction) {
            html += `<td>${rate}%</td>
                      <td>${deduction.toLocaleString()}</td>`;
        } else {
            html += `<td style="display:none"></td>
                      <td style="display:none"></td>`;
        }

        html += `<td class="${isDeduction ? '' : 'd-none'} fw-bold">${total.toLocaleString()}</td>
                 <td>${item.remarks || ''}</td>
                 <td>${item.batchNo || ''}</td>`;

        tr.innerHTML = html;
        applyRowColor(tr, item.isVerified);
        tbody.appendChild(tr);
    });

    // Update KPI Displays
    const greenDisplay = document.getElementById('bd-green-total');
    if (greenDisplay) {
        greenDisplay.textContent = Math.round(greenTotal).toLocaleString();
    }

    const redDisplay = document.getElementById('bd-red-total');
    if (redDisplay) {
        redDisplay.textContent = Math.round(redTotal).toLocaleString();
    }
}

// Helper to apply Green/Red styling based on verification status
function applyRowColor(row, isVerified) {
    const cells = row.querySelectorAll('td');
    if (isVerified) {
        // Verified: Green Background, White Text, Normal Weight
        row.style.setProperty('background-color', '#28a745', 'important');
        row.style.setProperty('color', '#fff', 'important');
        row.style.setProperty('font-weight', 'normal', 'important');
        cells.forEach(cell => {
            cell.style.setProperty('background-color', '#28a745', 'important');
            cell.style.setProperty('color', '#fff', 'important');
            cell.style.setProperty('font-weight', 'normal', 'important');
        });
    } else {
        // Unverified: Red Background, White Text, Normal Weight
        row.style.setProperty('background-color', '#dc3545', 'important');
        row.style.setProperty('color', '#fff', 'important');
        row.style.setProperty('font-weight', 'normal', 'important');
        cells.forEach(cell => {
            cell.style.setProperty('background-color', '#dc3545', 'important');
            cell.style.setProperty('color', '#fff', 'important');
            cell.style.setProperty('font-weight', 'normal', 'important');
        });
    }

    // Force white color and normal font on inputs (date, etc.)
    const inputs = row.querySelectorAll('input');
    inputs.forEach(input => {
        if (input.type !== 'checkbox') {
            input.style.setProperty('color', '#fff', 'important');
            input.style.setProperty('font-weight', 'normal', 'important');
            input.style.setProperty('font-size', '0.9rem', 'important');
        }
    });
}

// Function to recalculate green/red totals from the current screen state
function calculateGridTotals() {
    const rows = document.querySelectorAll('#bankDetailsBody tr');
    let greenTotal = 0;
    let redTotal = 0;

    rows.forEach(row => {
        // ONLY count rows that are visible (not hidden by search)
        if (row.style.display !== 'none') {
            const checkbox = row.querySelector('.batch-checkbox');
            const cells = row.querySelectorAll('td');
            // Column 8 is the "Total" column
            if (cells[8]) {
                const val = parseFloat(cells[8].textContent.replace(/,/g, '')) || 0;
                if (checkbox && checkbox.checked) {
                    greenTotal += val;
                } else {
                    redTotal += val;
                }
            }
        }
    });

    // Update Badges with rounded whole numbers
    const greenDisplay = document.getElementById('bd-green-total');
    if (greenDisplay) greenDisplay.textContent = Math.round(greenTotal).toLocaleString();

    const redDisplay = document.getElementById('bd-red-total');
    if (redDisplay) redDisplay.textContent = Math.round(redTotal).toLocaleString();
}

// Global real-time search filter
function filterBankGrid() {
    const input = document.getElementById('globalSearchInput');
    const filter = input.value.toLowerCase();
    const rows = document.querySelectorAll('#bankDetailsBody tr');

    rows.forEach(row => {
        // Extract all text from row cells
        const text = row.innerText.toLowerCase();
        // Remove commas to allow searching for "1234" instead of "1,234"
        const cleanText = text.replace(/,/g, '');

        // Also check input values (like date) which are not in innerText
        const dateInput = row.querySelector('.batch-date-input');
        const dateVal = dateInput ? dateInput.value.toLowerCase() : '';

        if (text.includes(filter) || cleanText.includes(filter) || dateVal.includes(filter)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });

    // Update totals based on search results
    calculateGridTotals();
}

// Function to handle "Update" button click - Visual Feedback & Persistence
async function updateBankRowsStatus() {
    const isDeduction = document.getElementById('deductionOption').checked;
    const tbody = document.getElementById('bankDetailsBody');
    const rows = tbody.querySelectorAll('tr');
    const updates = [];

    rows.forEach(row => {
        const checkbox = row.querySelector('.batch-checkbox');
        const id = row.dataset.id;
        if (checkbox && id) {
            const dateInput = row.querySelector('.batch-date-input');
            updates.push({
                id: id,
                isVerified: checkbox.checked,
                date: dateInput ? dateInput.value : null
            });
            // Instant visual feedback before save completes
            applyRowColor(row, checkbox.checked);
        }
    });

    // Re-calculate the totals at the top immediately
    calculateGridTotals();

    if (updates.length === 0) return;

    try {
        const token = localStorage.getItem('token');
        const endpoint = isDeduction ? '/api/v1/daily-cash/bulk-verify-status' : '/api/v1/bank-transactions/bulk-verify-status';

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ updates })
        });

        const result = await response.json();
        if (result.success) {
            console.log('Verification status saved successfully');
        } else {
            alert('Failed to save status: ' + result.message);
        }
    } catch (err) {
        console.error('Error saving verification status:', err);
        alert('Error saving status. Please try again.');
    }
}

// --- Tab 2: Pending Cheques ---
async function loadPendingCheques() {
    // API logic to load pending cheques grid
    const tbody = document.getElementById('pendingChqBody');
    tbody.innerHTML = '';

    // Mock for Green Grid
    const mockData = [
        { id: 379, dated: '12/15/2025', sysDate: '12/15/2025 9:43 PM', branch: 'PWD-1', bank: 'ALF', bankDate: '12/31/2026', ledger: -4350469, pending: 7457620 },
        // ...
    ];

    mockData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'table-success'; // Bootstrap green variant
        tr.innerHTML = `
            <td>${row.id}</td>
            <td>${row.dated}</td>
            <td>${row.sysDate}</td>
            <td>${row.branch}</td>
            <td>${row.bank}</td>
            <td>${row.bankDate}</td>
            <td>${row.ledger}</td>
            <td>${row.pending}</td>
            <td>...</td>
         `;
        tbody.appendChild(tr);
    });
}

// --- Helper Utils ---
function getSearchParams(scope) {
    return {
        fromDate: scope.querySelector('.from-date')?.value,
        toDate: scope.querySelector('.to-date')?.value,
        branch: scope.querySelector('.branch-select')?.value,
        dept: scope.querySelector('.dept-select')?.value,
        bank: scope.querySelector('.bank-select')?.value
    };
}

function formatDateForInput(dateStr) {
    // Basic parser for MM/DD/YYYY to YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    return '';
}

// --- Exported functions for global access ---
window.searchBankDetails = searchBankDetails;
window.loadPendingCheques = loadPendingCheques;
window.updateBankRowsStatus = updateBankRowsStatus;
window.calculateGridTotals = calculateGridTotals;
window.filterBankGrid = filterBankGrid;
window.applyRowColor = applyRowColor;
