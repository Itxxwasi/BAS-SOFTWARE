
document.addEventListener('DOMContentLoaded', async () => {
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('filterDate').value = today;
    document.getElementById('entryDate').value = today;

    await loadBranches();
    await loadSuppliers();
    await loadCategories();

    // Default selection if available
    const branchSelect = document.getElementById('branchSelect');
    if (branchSelect.options.length > 1) {
        branchSelect.selectedIndex = 1;
    }

    setupCalculations();
    setupAddButton();

    // Initial load of the records
    await loadSavedData();
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

let suppliersMap = {}; // ID -> { name, ntn, whtPer, advTaxPer }

async function loadSuppliers() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/suppliers?limit=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            const list = data.data;
            suppliersMap = {};

            list.forEach(sup => {
                suppliersMap[sup._id] = {
                    name: sup.name,
                    ntn: sup.ntn || '',
                    subCategory: sup.subCategory || '',
                    whtPer: sup.whtPer || 0,
                    advTaxPer: sup.advTaxPer || 0
                };
            });

            // --- Custom Search Dropdown Logic ---
            const searchInput = document.getElementById('entrySupplierSearch');
            const resultsDiv = document.getElementById('supplierSearchResults');

            searchInput.addEventListener('input', function () {
                const val = this.value.toLowerCase();
                if (!val) {
                    resultsDiv.style.display = 'none';
                    return;
                }

                const matches = Object.keys(suppliersMap)
                    .filter(id => suppliersMap[id].name.toLowerCase().includes(val))
                    .slice(0, 15); // Show top 15 matches

                if (matches.length > 0) {
                    resultsDiv.innerHTML = matches.map(id => `
                        <div class="search-result-item" onclick="selectSupplier('${id}')">
                            <div class="fw-bold">${suppliersMap[id].name}</div>
                            <small class="text-muted">${suppliersMap[id].subCategory || 'No Category'}</small>
                        </div>
                    `).join('');
                    resultsDiv.style.display = 'block';
                } else {
                    resultsDiv.style.display = 'none';
                }
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', function (e) {
                if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
                    resultsDiv.style.display = 'none';
                }
            });
        }
    } catch (err) {
        console.error('Error loading suppliers:', err);
    }
}

window.selectSupplier = function (id) {
    const s = suppliersMap[id];
    if (!s) return;

    // Fill fields
    document.getElementById('entrySupplierSearch').value = s.name;
    document.getElementById('entrySupplier').value = id;
    document.getElementById('entryNTN').value = s.ntn;
    document.getElementById('entrySubCat').value = s.subCategory;
    document.getElementById('entryTaxPct').value = s.whtPer;
    document.getElementById('entryAiTaxPct').value = s.advTaxPer;

    // Trigger calculation if amount exists
    const amtInput = document.getElementById('entryInvAmt');
    if (amtInput.value) {
        const event = new Event('input');
        amtInput.dispatchEvent(event);
    }

    // Hide results
    document.getElementById('supplierSearchResults').style.display = 'none';

    // Set focus to the next logical field (Date)
    document.getElementById('entryDate').focus();
}

async function loadCategories() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/supplier-categories', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('categorySelect');
            const qsSelect = document.getElementById('qsCategory');

            const options = '<option value="">Select Supplier Category</option>' +
                data.data.map(cat => `<option value="${cat._id}">${cat.name}</option>`).join('');

            select.innerHTML = options;
            if (qsSelect) qsSelect.innerHTML = options;
        }
    } catch (err) {
        console.error('Error loading categories:', err);
    }
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

        const subCat = document.getElementById('entrySubCat').value;
        const supplierName = suppliersMap[supplierId]?.name || 'Unknown';

        const rowData = {
            id: Date.now(), // temp id
            supplierId, supplierName, subCat, ntn, date, invNum, invAmt, taxPct, taxDed, aiPct, aiAmt
        };

        addedRows.push(rowData);
        renderTableRows();
        clearEntryInputs();
    });

    // Add Enter key listener for Amount fields
    ['entryInvAmt', 'entryAiTaxAmt'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('addItemBtn').click();
            }
        });
    });
}

function clearEntryInputs() {
    document.getElementById('entrySupplierSearch').value = '';
    document.getElementById('entrySupplier').value = '';
    document.getElementById('entrySubCat').value = '';
    document.getElementById('entryNTN').value = '';
    document.getElementById('entryInvNum').value = '';
    document.getElementById('entryInvAmt').value = '';
    document.getElementById('entryTaxPct').value = '';
    document.getElementById('entryTaxDed').value = '';
    document.getElementById('entryAiTaxPct').value = '';
    document.getElementById('entryAiTaxAmt').value = '';

    // Set focus back to supplier search for next entry
    document.getElementById('entrySupplierSearch').focus();
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
            <td>${row.subCat}</td>
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

// Initial load already handled in DOMContentLoaded

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
            subCategory: r.subCat,
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
            <td>${row.subCategory || '-'}</td>
            <td>${row.ntn || '-'}</td>
            <td>${row.invoiceNumber || '-'}</td>
            <td>${invDate}</td>
            <td class="text-end">${(row.invoiceAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="text-end">${row.taxPct || 0}%</td>
            <td class="text-end fw-bold text-danger">${(row.taxDeducted || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="text-end">${row.aiTaxPct || 0}%</td>
            <td class="text-end fw-bold text-success">${(row.aiTaxAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>
                <div class="d-flex justify-content-center gap-1">
                    <button class="btn btn-sm btn-outline-primary px-2" title="Edit Sheet" onclick="editRecord('${row.parentId}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger px-2" title="Delete Sheet" onclick="deleteRecord('${row.parentId}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.editRecord = function (id) {
    const record = loadedRecords.find(r => r._id === id);
    if (!record) return;

    currentEditId = id;

    // Set Header Data
    document.getElementById('branchSelect').value = record.branch?._id || record.branch || '';
    document.getElementById('filterDate').value = record.date ? new Date(record.date).toISOString().split('T')[0] : '';

    // Load Entries
    addedRows = record.entries.map(e => ({
        id: e._id || Date.now() + Math.random(),
        supplierId: e.supplier?._id || e.supplier,
        supplierName: e.supplierName,
        subCat: e.subCategory,
        ntn: e.ntn,
        date: e.invoiceDate ? new Date(e.invoiceDate).toISOString().split('T')[0] : '',
        invNum: e.invoiceNumber,
        invAmt: e.invoiceAmount,
        taxPct: e.taxPct,
        taxDed: e.taxDeducted,
        aiPct: e.aiTaxPct,
        aiAmt: e.aiTaxAmount
    }));

    renderTableRows();

    // Population for first entry
    if (addedRows.length > 0) {
        const first = addedRows[0];
        document.getElementById('entrySupplierSearch').value = first.supplierName;
        document.getElementById('entrySupplier').value = first.supplierId;
        document.getElementById('entryNTN').value = first.ntn;
        document.getElementById('entrySubCat').value = first.subCat;
        document.getElementById('entryTaxPct').value = first.taxPct;
        document.getElementById('entryAiTaxPct').value = first.aiPct;
    }

    // Toggle Save Button to Update
    const btn = document.getElementById('saveBtn');
    btn.innerHTML = '<i class="fas fa-edit"></i> Update';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-warning');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
// --- Quick Add Supplier ---

window.openQuickSupplierModal = function () {
    document.getElementById('quickSupplierForm').reset();
    new bootstrap.Modal(document.getElementById('quickSupplierModal')).show();
}

window.saveQuickSupplier = async function () {
    const formData = {
        name: document.getElementById('qsName').value,
        category: document.getElementById('qsCategory').value,
        ntn: document.getElementById('qsNTN').value,
        subCategory: document.getElementById('qsSubCat').value,
        whtPer: parseFloat(document.getElementById('qsWht').value) || 0,
        advTaxPer: parseFloat(document.getElementById('qsAdv').value) || 0,
        isActive: true,
        branch: document.getElementById('branchSelect').value // Default to current branch
    };

    if (!formData.name || !formData.category) {
        alert('Please fill Supplier Name and Category');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/suppliers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await res.json();
        if (data.success) {
            alert('Supplier Added Successfully!');
            bootstrap.Modal.getInstance(document.getElementById('quickSupplierModal')).hide();
            await loadSuppliers();

            // Auto-select the new supplier
            const newSupId = data.data._id;
            // Update map first so selectSupplier works
            suppliersMap[newSupId] = {
                name: formData.name,
                ntn: formData.ntn,
                subCategory: formData.subCategory,
                whtPer: formData.whtPer,
                advTaxPer: formData.advTaxPer
            };
            selectSupplier(newSupId);
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        console.error('Error saving quick supplier:', err);
    }
}
