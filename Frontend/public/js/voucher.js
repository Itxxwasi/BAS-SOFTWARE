document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});

let voucherEntries = [];
let accounts = [];

async function initializePage() {
    document.getElementById('voucherDate').valueAsDate = new Date();
    await loadAccounts();
}

async function loadAccounts() {
    // Load parties as accounts
    try {
        const response = await fetch('/api/v1/parties?limit=1000');
        const data = await response.json();

        const select = document.getElementById('accountSelect');
        select.innerHTML = '<option value="">Select Account</option>';

        // Add Cash/Bank manually
        const defaultAccounts = ['Cash in Hand (Shop)', 'Bank', 'Capital Account', 'Sales Account', 'Purchase Account', 'Expense Account'];
        defaultAccounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc;
            option.textContent = acc;
            select.appendChild(option);
        });

        if (data.success && data.data) {
            data.data.forEach(party => {
                const option = document.createElement('option');
                option.value = party.name; // Storing name as model uses String
                option.textContent = party.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error(error);
    }
}

function addEntry() {
    const account = document.getElementById('accountSelect').value;
    const detail = document.getElementById('lineDetail').value;
    const debit = parseFloat(document.getElementById('lineDebit').value || 0);
    const credit = parseFloat(document.getElementById('lineCredit').value || 0);

    if (!account) {
        alert('Select account');
        return;
    }

    if (debit === 0 && credit === 0) {
        alert('Enter Debit or Credit amount');
        return;
    }

    if (debit > 0 && credit > 0) {
        alert('Cannot have both Debit and Credit in same line (normally)');
        // Allowing it if user insists, but usually one is zero.
    }

    voucherEntries.push({
        account,
        detail, // map to something? Schema doesn't have line detail in `entries`.
        // Wait, Schema `entries` has `account`, `debit`, `credit`. No detail?
        // Let's check Schema.
        debit,
        credit
    });

    // Clear line inputs
    document.getElementById('accountSelect').value = '';
    document.getElementById('lineDetail').value = '';
    document.getElementById('lineDebit').value = 0;
    document.getElementById('lineCredit').value = 0;

    renderGrid();
}

function renderGrid() {
    const tbody = document.getElementById('voucherEntriesBody');
    tbody.innerHTML = '';

    let queryTotalDebit = 0;
    let queryTotalCredit = 0;

    voucherEntries.forEach((entry, index) => {
        queryTotalDebit += entry.debit;
        queryTotalCredit += entry.credit;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${entry.account}</td>
            <td>${entry.detail || ''}</td>
            <td class="text-end">${entry.debit.toFixed(2)}</td>
            <td class="text-end">${entry.credit.toFixed(2)}</td>
            <td>
                <button class="btn btn-sm btn-danger py-0" onclick="removeEntry(${index})">&times;</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('totalDebit').textContent = queryTotalDebit.toFixed(2);
    document.getElementById('totalCredit').textContent = queryTotalCredit.toFixed(2);
}

window.removeEntry = function (index) {
    voucherEntries.splice(index, 1);
    renderGrid();
};


window.loadVoucherList = async function () {
    let modal = document.getElementById('voucherListModal');
    if (!modal) {
        const modalHtml = `
        <div class="modal fade" id="voucherListModal" tabindex="-1">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Voucher List</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="table-responsive">
                            <table class="table table-bordered table-striped">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Voucher No</th>
                                        <th>Type</th>
                                        <th>Narration</th>
                                        <th>Total Amount</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="voucherListBody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('voucherListModal');
    }

    try {
        const response = await fetch('/api/v1/vouchers?limit=50&sort=-date');
        const data = await response.json();

        const tbody = document.getElementById('voucherListBody');
        tbody.innerHTML = '';

        if (data.success && data.data) {
            data.data.forEach(voucher => {
                const total = voucher.entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(voucher.date).toLocaleDateString()}</td>
                    <td>${voucher.voucherNo || '-'}</td>
                    <td>${voucher.voucherType}</td>
                    <td>${voucher.narration || ''}</td>
                    <td>${total.toFixed(2)}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="printVoucherRecord('${voucher._id}')">Print</button>
                        <button class="btn btn-sm btn-info" onclick="editVoucher('${voucher._id}')" data-bs-dismiss="modal">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteVoucher('${voucher._id}')">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    } catch (error) {
        console.error('Error loading vouchers:', error);
        alert('Failed to load voucher list');
    }
};

window.editVoucher = async function (id) {
    try {
        const response = await fetch(`/api/v1/vouchers/${id}`);
        const data = await response.json();

        if (data.success) {
            const voucher = data.data;
            document.getElementById('voucherDate').value = voucher.date.split('T')[0];
            document.getElementById('voucherType').value = voucher.voucherType;
            document.getElementById('voucherNo').value = voucher.voucherNo;
            document.getElementById('branch').value = voucher.branch || 'Shop';
            document.getElementById('narration').value = voucher.narration || '';

            document.getElementById('voucherDate').dataset.editId = id;

            // Populate grid
            voucherEntries = voucher.entries.map(entry => ({
                account: entry.account,
                detail: entry.detail || '',
                debit: entry.debit || 0,
                credit: entry.credit || 0
            }));

            renderGrid();
        }
    } catch (error) {
        console.error('Error loading voucher:', error);
        alert('Failed to load voucher details');
    }
};

window.deleteVoucher = async function (id) {
    if (!confirm('Are you sure you want to delete this voucher?')) return;

    try {
        const response = await fetch(`/api/v1/vouchers/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
            alert('Voucher deleted successfully');
            const modalEl = document.getElementById('voucherListModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
            }
            loadVoucherList();
        } else {
            alert('Error deleting voucher: ' + data.message);
        }
    } catch (error) {
        console.error('Error deleting voucher:', error);
        alert('Failed to delete voucher');
    }
};

window.saveVoucher = async function () {
    const totalDebit = parseFloat(document.getElementById('totalDebit').textContent);
    const totalCredit = parseFloat(document.getElementById('totalCredit').textContent);
    const editId = document.getElementById('voucherDate').dataset.editId;

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        alert('Total Debit and Credit must be equal!');
        return;
    }

    if (voucherEntries.length === 0) {
        alert('Add entries first');
        return;
    }

    const payload = {
        voucherType: document.getElementById('voucherType').value,
        date: document.getElementById('voucherDate').value,
        branch: document.getElementById('branch').value,
        narration: document.getElementById('narration').value,
        entries: voucherEntries
    };

    try {
        const url = editId ? `/api/v1/vouchers/${editId}` : '/api/v1/vouchers';
        const method = editId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.success) {
            alert('Voucher Saved Successfully');
            if (!editId && confirm('Do you want to print this voucher?')) {
                printVoucherRecord(data.data._id);
            }
            clearForm();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error(error);
        alert('Error saving voucher');
    }
};

window.clearForm = function () {
    voucherEntries = [];
    document.getElementById('narration').value = '';
    document.getElementById('lineDetail').value = '';
    document.getElementById('voucherNo').value = '';
    delete document.getElementById('voucherDate').dataset.editId;
    renderGrid();
};

window.printVoucherRecord = function (id) {
    const url = `/print-invoice.html?type=voucher&id=${id}`;
    window.open(url, '_blank', 'width=1000,height=800');
};
