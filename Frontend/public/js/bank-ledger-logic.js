let allBanksWithBranches = [];
let allLedgers = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Dates (Default to Current Date)
    const today = new Date().toISOString().split('T')[0];

    document.getElementById('startDate').value = today;
    document.getElementById('endDate').value = today;

    // 2. Load Data
    await loadInitialData();

    // 3. User Info
    const user = JSON.parse(localStorage.getItem('user')) || { name: 'User' };
    document.getElementById('userNameDisplay').textContent = user.name;
    document.getElementById('userInitial').textContent = user.name.charAt(0).toUpperCase();
});

async function loadInitialData() {
    try {
        const token = localStorage.getItem('token');

        // Fetch all Banks (with branch info)
        const bankResp = await fetch('/api/v1/banks', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const bankData = await bankResp.json();
        if (bankData.success) {
            allBanksWithBranches = bankData.data;

            // Populate Branch Dropdown
            const branches = [...new Set(allBanksWithBranches.map(b => b.branch))].sort();
            const branchSelect = document.getElementById('branchSelect');
            branches.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b;
                opt.textContent = b;
                branchSelect.appendChild(opt);
            });
        }

        // Fetch all Ledgers
        const ledgerResp = await fetch('/api/v1/reports/ledger/trial-balance', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const ledgerData = await ledgerResp.json();
        if (ledgerData.success) {
            allLedgers = ledgerData.data.trialBalance.filter(l => l.ledgerType === 'bank');
            // Initial call to populate banks (All)
            filterBanksByBranch();
        }

    } catch (e) {
        console.error('Error loading initial data:', e);
    }
}

function filterBanksByBranch() {
    const selectedBranch = document.getElementById('branchSelect').value;
    const bankSelect = document.getElementById('bankSelect');
    bankSelect.innerHTML = '<option value="">Choose Bank...</option>';

    // 1. Get banks belonging to this branch
    let filteredBankDocs = allBanksWithBranches;
    if (selectedBranch) {
        filteredBankDocs = allBanksWithBranches.filter(b => b.branch === selectedBranch);
    }

    const bankNamesInBranch = filteredBankDocs.map(b => b.bankName);

    // 2. Filter Ledgers that match these bank names
    const filteredLedgers = allLedgers.filter(l => bankNamesInBranch.includes(l.ledgerName));

    filteredLedgers.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName)).forEach(l => {
        const opt = document.createElement('option');
        opt.value = l._id;
        opt.textContent = l.ledgerName;
        bankSelect.appendChild(opt);
    });
}

async function generateBankLedger() {
    const bankId = document.getElementById('bankSelect').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!bankId) {
        alert('Please select a bank first');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const url = `/api/v1/reports/bank-ledger?bankId=${bankId}&startDate=${startDate}&endDate=${endDate}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            renderLedger(data.data, startDate, endDate);
            document.getElementById('reportArea').style.display = 'block';
            document.getElementById('emptyState').style.display = 'none';
        } else {
            alert(data.message || 'Failed to generate report');
        }
    } catch (e) {
        console.error('Report error:', e);
        alert('An error occurred while generating the report');
    }
}

function renderLedger(data, start, end) {
    document.getElementById('displayBankName').textContent = data.bankName;
    document.getElementById('displayPeriod').textContent = `${start} to ${end}`;
    document.getElementById('displayClosingBalance').textContent = data.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 });

    const tbody = document.getElementById('ledgerBody');
    tbody.innerHTML = '';

    // 1. Opening Balance Row
    const opRow = document.createElement('tr');
    opRow.className = 'bg-light';
    opRow.innerHTML = `
        <td class="text-muted italic">${start}</td>
        <td class="fw-bold">Opening Balance</td>
        <td>-</td>
        <td></td>
        <td></td>
        <td class="text-end fw-bold">${data.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
    `;
    tbody.appendChild(opRow);

    let totalDebit = 0;
    let totalCredit = 0;

    // 2. Transaction Rows
    data.transactions.forEach(tx => {
        totalDebit += tx.debit;
        totalCredit += tx.credit;

        const date = new Date(tx.date).toISOString().split('T')[0];
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${date}</td>
            <td>
                <div class="fw-bold">${tx.narration || '-'}</div>
                <small class="text-muted text-uppercase">${tx.refType}</small>
            </td>
            <td>${tx.batchNo || '-'}</td>
            <td class="text-end text-success">${tx.debit > 0 ? tx.debit.toLocaleString() : '-'}</td>
            <td class="text-end text-danger">${tx.credit > 0 ? tx.credit.toLocaleString() : '-'}</td>
            <td class="text-end fw-bold">${tx.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        `;
        tbody.appendChild(tr);
    });

    // 3. Totals
    document.getElementById('totalDebit').textContent = totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 });
    document.getElementById('totalCredit').textContent = totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 });
}
