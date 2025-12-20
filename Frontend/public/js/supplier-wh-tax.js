
document.addEventListener('DOMContentLoaded', async () => {
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('filterDate').value = today;
    document.getElementById('entryDate').value = today;

    await loadBranches();
    await loadSuppliers();
    await loadCategories();

    setupCalculations();
    setupAddButton();
});

// --- Data Loading ---

async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('branchSelect');
            data.data.forEach(store => {
                const opt = document.createElement('option');
                opt.value = store._id;
                opt.textContent = `${store.name}`; // e.g. (PWD-1)
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Error loading branches:', err);
    }
}

let suppliersMap = {}; // ID -> { name, ntn }

async function loadSuppliers() {
    try {
        const token = localStorage.getItem('token');
        // Fetch parties (filtered by type=supplier if supported, otherwise all)
        // Trying parties/type/supplier route pattern if exists, else query param
        let res = await fetch('/api/v1/parties/type/supplier', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // If the specific type route doesn't exist (404), fall back to query param or all
        if (!res.ok) {
            res = await fetch('/api/v1/parties?type=supplier', { headers: { 'Authorization': `Bearer ${token}` } });
        }

        // If still not ok or no query support, just all
        if (!res.ok) {
            res = await fetch('/api/v1/parties', { headers: { 'Authorization': `Bearer ${token}` } });
        }

        const data = await res.json();

        if (data.success || data.data) {
            // Filter client-side just in case if we got all parties
            const list = (data.data || []).filter(p => p.type === 'supplier' || !p.type); // inclusive if type missing
            const select = document.getElementById('entrySupplier');

            list.forEach(sup => {
                // Determine display name
                const name = sup.name || sup.partyName;
                const id = sup._id;
                const ntn = sup.ntn || '';

                suppliersMap[id] = { name, ntn };

                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = name;
                select.appendChild(opt);
            });

            // Supplier Selection Event for NTN
            select.addEventListener('change', (e) => {
                const id = e.target.value;
                if (id && suppliersMap[id]) {
                    document.getElementById('entryNTN').value = suppliersMap[id].ntn || '';
                } else {
                    document.getElementById('entryNTN').value = '';
                }
            });
        }
    } catch (err) {
        console.error('Error loading suppliers:', err);
    }
}

async function loadCategories() {
    // Mocking or fetching if API exists. Steps suggest just dropping in.
    // I'll leave empty or add dummy options.
    const select = document.getElementById('categorySelect');
    ['Medicine', 'Grocery', 'Cosmetics', 'General'].forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
}

// --- Logic ---

function setupCalculations() {
    const amountInput = document.getElementById('entryInvAmt');
    const taxPctInput = document.getElementById('entryTaxPct');
    const taxDedInput = document.getElementById('entryTaxDed');
    const aiPctInput = document.getElementById('entryAiTaxPct');
    const aiAmtInput = document.getElementById('entryAiTaxAmt');

    function calculate() {
        const amt = parseFloat(amountInput.value) || 0;

        const taxPct = parseFloat(taxPctInput.value) || 0;
        const taxVal = amt * (taxPct / 100);
        taxDedInput.value = taxVal > 0 ? taxVal.toFixed(2) : '';

        const aiPct = parseFloat(aiPctInput.value) || 0;
        const aiVal = amt * (aiPct / 100);
        aiAmtInput.value = aiVal > 0 ? aiVal.toFixed(2) : '';
    }

    [amountInput, taxPctInput, aiPctInput].forEach(inp => {
        inp.addEventListener('input', calculate);
    });
}

// Local state for rows
let addedRows = [];

function setupAddButton() {
    document.getElementById('addItemBtn').addEventListener('click', () => {
        const supplierId = document.getElementById('entrySupplier').value;
        const ntn = document.getElementById('entryNTN').value;
        const date = document.getElementById('entryDate').value;
        const invNum = document.getElementById('entryInvNum').value;
        const invAmt = parseFloat(document.getElementById('entryInvAmt').value) || 0;
        const taxPct = parseFloat(document.getElementById('entryTaxPct').value) || 0;
        const taxDed = parseFloat(document.getElementById('entryTaxDed').value) || 0;
        const aiPct = parseFloat(document.getElementById('entryAiTaxPct').value) || 0;
        const aiAmt = parseFloat(document.getElementById('entryAiTaxAmt').value) || 0;

        if (!supplierId || !date || !invNum || invAmt <= 0) {
            alert('Please fill required fields (Supplier, Date, Invoice #, Amount)');
            return;
        }

        const supplierName = suppliersMap[supplierId]?.name || 'Unknown';

        const rowData = {
            id: Date.now(), // temp id
            supplierId, supplierName, ntn, date, invNum, invAmt, taxPct, taxDed, aiPct, aiAmt
        };

        addedRows.push(rowData);
        renderTableRows();
        clearEntryInputs();
    });
}

function clearEntryInputs() {
    document.getElementById('entrySupplier').value = '';
    document.getElementById('entryNTN').value = '';
    // Keep date
    document.getElementById('entryInvNum').value = '';
    document.getElementById('entryInvAmt').value = '';
    document.getElementById('entryTaxPct').value = '';
    document.getElementById('entryTaxDed').value = '';
    document.getElementById('entryAiTaxPct').value = '';
    document.getElementById('entryAiTaxAmt').value = '';
}

function renderTableRows() {
    const tbody = document.querySelector('#taxTable tbody');
    // Remove all rows except the first (entry row)
    // Actually, easier to append AFTER the entry row. 
    // Wait, reference puts entry row at top.

    // Clear existing data rows (keep index 0 which is entry)
    const rows = Array.from(tbody.children);
    for (let i = 1; i < rows.length; i++) {
        rows[i].remove();
    }

    let totalAmt = 0;
    let totalTax = 0;
    let totalAi = 0;

    addedRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.supplierName}</td>
            <td>${row.ntn}</td>
            <td>${row.date}</td>
            <td>${row.invNum}</td>
            <td class="text-end">${row.invAmt.toFixed(2)}</td>
            <td>${row.taxPct}%</td>
            <td class="text-end">${row.taxDed.toFixed(2)}</td>
            <td>${row.aiPct}%</td>
            <td class="text-end">${row.aiAmt.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-danger px-2 py-0" onclick="removeRow(${row.id})"><i class="fas fa-times"></i></button>
            </td>
        `;
        tbody.appendChild(tr);

        totalAmt += row.invAmt;
        totalTax += row.taxDed;
        totalAi += row.aiAmt;
    });

    document.getElementById('totalInvAmt').textContent = totalAmt.toFixed(2);
    document.getElementById('totalTaxDed').textContent = totalTax.toFixed(2);
    document.getElementById('totalAiTaxAmt').textContent = totalAi.toFixed(2);
}

window.removeRow = function (id) {
    addedRows = addedRows.filter(r => r.id !== id);
    renderTableRows();
}

// --- Save & List Logic ---

let currentEditId = null;
let loadedRecords = [];

document.getElementById('saveBtn').addEventListener('click', saveData);
document.getElementById('listBtn').addEventListener('click', () => {
    document.getElementById('savedRecordsTable').scrollIntoView({ behavior: 'smooth' });
    loadSavedData();
});

// Search & Filter Listeners
document.getElementById('searchFilterBtn').addEventListener('click', loadSavedData);
document.getElementById('filterDate').addEventListener('change', loadSavedData);
document.getElementById('branchSelect').addEventListener('change', loadSavedData);

// Initial load
setTimeout(loadSavedData, 1000);

// Search Feature (Client Side Text Search)
document.getElementById('listSearch').addEventListener('input', function (e) {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#savedRecordsBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
});

async function saveData() {
    if (addedRows.length === 0) {
        alert('No entries to save');
        return;
    }

    const branch = document.getElementById('branchSelect').value;
    const date = document.getElementById('filterDate').value;

    if (!branch || !date) {
        alert('Please select Branch and Date');
        return;
    }

    // Calculate totals
    const totalAmt = addedRows.reduce((acc, r) => acc + r.invAmt, 0);
    const totalTax = addedRows.reduce((acc, r) => acc + r.taxDed, 0);
    const totalAi = addedRows.reduce((acc, r) => acc + r.aiAmt, 0);

    const payload = {
        branch,
        date,
        entries: addedRows.map(r => ({
            supplier: r.supplierId,
            supplierName: r.supplierName,
            ntn: r.ntn,
            invoiceDate: r.date,
            invoiceNumber: r.invNum,
            invoiceAmount: r.invAmt,
            taxPct: r.taxPct,
            taxDeducted: r.taxDed,
            aiTaxPct: r.aiPct,
            aiTaxAmount: r.aiAmt
        })),
        totalAmount: totalAmt,
        totalTaxDeducted: totalTax,
        totalAiTaxAmount: totalAi
    };

    try {
        const token = localStorage.getItem('token');
        const method = currentEditId ? 'PUT' : 'POST';
        const url = currentEditId ? `/api/v1/supplier-taxes/${currentEditId}` : '/api/v1/supplier-taxes';

        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            alert(currentEditId ? 'Data Updated Successfully!' : 'Data Saved Successfully!');
            addedRows = [];
            currentEditId = null;
            renderTableRows();

            // Reset Button
            const btn = document.getElementById('saveBtn');
            btn.innerHTML = '<i class="fas fa-save"></i> Save';
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-success');

            loadSavedData();
        } else {
            alert('Error: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        alert('Network Error: ' + err.message);
        console.error(err);
    }
}

async function loadSavedData() {
    const branch = document.getElementById('branchSelect').value;
    const date = document.getElementById('filterDate').value;

    // Default to today if no date? Or fetch recent.
    // User wants "day wise". If date is selected, show that day.

    let url = '/api/v1/supplier-taxes?limit=100';
    if (branch) url += `&branch=${branch}`;
    if (date) url += `&date=${date}`;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();

        if (data.success) {
            loadedRecords = data.data; // Store for editing
            renderSavedTable(data.data);
        }
    } catch (err) { console.error(err); }
}

function renderSavedTable(records) {
    const tbody = document.getElementById('savedRecordsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted">No records found</td></tr>';
        return;
    }

    let flatRows = [];
    records.forEach(rec => {
        const sheetDate = new Date(rec.date).toLocaleDateString();
        const branchName = rec.branch ? (rec.branch.name || 'Unknown') : 'Unknown';

        if (rec.entries && rec.entries.length > 0) {
            rec.entries.forEach(entry => {
                flatRows.push({
                    parentId: rec._id, // The ID of the Main Sheet
                    sheetDate,
                    branchName,
                    ...entry
                });
            });
        }
    });

    flatRows.forEach(row => {
        const invDate = row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString() : '-';

        const tr = document.createElement('tr');
        tr.className = 'align-middle';
        tr.innerHTML = `
            <td>${row.sheetDate}</td>
            <td>${row.branchName}</td>
            <td class="fw-bold">${row.supplierName || '-'}</td>
            <td>${row.ntn || '-'}</td>
            <td>${row.invoiceNumber || '-'}</td>
            <td>${invDate}</td>
            <td class="text-end">${(row.invoiceAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="text-end">${row.taxPct || 0}%</td>
            <td class="text-end fw-bold text-danger">${(row.taxDeducted || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="text-end">${row.aiTaxPct || 0}%</td>
            <td class="text-end fw-bold text-success">${(row.aiTaxAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger px-2" title="Delete Sheet" onclick="deleteRecord('${row.parentId}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteRecord = async function (id) {
    if (!confirm('Are you sure you want to delete this SHEET? (All entries on this sheet will be deleted)')) return;
    try {
        const token = localStorage.getItem('token');
        await fetch(`/api/v1/supplier-taxes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadSavedData();
    } catch (e) { alert(e); }
}
