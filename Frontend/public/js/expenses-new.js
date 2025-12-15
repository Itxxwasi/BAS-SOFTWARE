document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});

async function initializePage() {
    document.getElementById('expenseDate').valueAsDate = new Date();
    document.getElementById('filterFromDate').valueAsDate = new Date();
    document.getElementById('filterToDate').valueAsDate = new Date();

    await loadCategories();
    await loadCashInHand();
    await loadExpenses();
}

async function loadCategories() {
    try {
        const response = await fetch('/api/v1/categories');
        const data = await response.json();

        const select = document.getElementById('head');
        select.innerHTML = '<option value="">Select Expense Head</option>';

        if (data.success && data.data) {
            data.data.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name; // Use name as value to match model
                option.textContent = cat.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadCashInHand() {
    try {
        const response = await fetch('/api/v1/cash-transactions/summary');
        const data = await response.json();

        if (data.success && data.data) {
            document.getElementById('cashInHandDisplay').textContent = data.data.currentBalance.toLocaleString();
        }
    } catch (error) {
        console.error('Error loading cash in hand:', error);
    }
}


window.editExpense = async function (id) {
    try {
        const response = await fetch(`/api/v1/expenses/${id}`);
        const data = await response.json();

        if (data.success) {
            const exp = data.data;
            document.getElementById('expenseDate').value = exp.date.split('T')[0];
            document.getElementById('branch').value = exp.branch || 'Shop';
            document.getElementById('head').value = exp.head || exp.category;
            document.getElementById('amount').value = exp.amount;
            document.getElementById('payMode').value = exp.paymentMode || 'cash';
            document.getElementById('remarks').value = exp.description || '';

            // Add ID to a hidden field or dataset to handle update vs create in saveExpense
            // Ideally we modify saveExpense to handle PUT if ID exists.
            document.getElementById('expenseDate').dataset.editId = id;

            // Change save button text?
            // For now, let's keep it simple. User edits, clicks save.
        }
    } catch (error) {
        console.error('Error loading expense:', error);
    }
};

async function saveExpense() {
    const head = document.getElementById('head').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const editId = document.getElementById('expenseDate').dataset.editId;

    if (!head) {
        alert('Select expense head');
        return;
    }

    if (!amount || amount <= 0) {
        alert('Enter valid amount');
        return;
    }

    const payload = {
        date: document.getElementById('expenseDate').value,
        branch: document.getElementById('branch').value,
        head: head,
        amount: amount,
        paymentMode: document.getElementById('payMode').value,
        cashAccount: document.getElementById('cashAccount').value,
        description: document.getElementById('remarks').value
    };
    payload.category = head;

    try {
        const url = editId ? `/api/v1/expenses/${editId}` : '/api/v1/expenses';
        const method = editId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.success) {
            alert('Expense saved');
            clearForm();
            loadExpenses();
            loadCashInHand();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error(error);
        alert('Error saving expense');
    }
}

async function loadExpenses() {
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;

    let url = `/api/v1/expenses?sort=-date&limit=50`;
    if (fromDate) url += `&startDate=${fromDate}`;
    if (toDate) url += `&endDate=${toDate}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        const tbody = document.getElementById('expensesTableBody');
        tbody.innerHTML = '';

        let total = 0;

        if (data.success && data.data) {
            data.data.forEach(exp => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(exp.date).toLocaleDateString()}</td>
                    <td>Expense</td>
                    <td>${exp.head || exp.category}</td>
                    <td>${exp.subHead || ''}</td>
                    <td class="text-end">${exp.amount.toFixed(2)}</td>
                    <td>${exp.description || ''}</td>
                    <td>
                        <button class="btn btn-sm btn-primary py-0 me-1" onclick="printExpenseRecord('${exp._id}')"><i class="fas fa-print"></i></button>
                        <button class="btn btn-sm btn-info py-0 me-1" onclick="editExpense('${exp._id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger py-0" onclick="deleteExpense('${exp._id}')"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
                total += exp.amount;
            });
        }
        document.getElementById('totalAmount').textContent = total.toFixed(2);
    } catch (error) {
        console.error('Error loading expenses:', error);
    }
}

function clearForm() {
    document.getElementById('head').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('remarks').value = '';
    delete document.getElementById('expenseDate').dataset.editId;
}

function printExpense() {
    alert('Please select an expense from the list to print.');
}

window.printExpenseRecord = function (id) {
    const url = `/print-invoice.html?type=expense&id=${id}`;
    window.open(url, '_blank', 'width=1000,height=800');
};

function addHead() {
    const name = prompt('Enter new Head Name:');
    if (name) {
        // Create category API call
        // Not implemented in this snippet
    }
}
