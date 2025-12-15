document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('date').valueAsDate = new Date();
    loadCustomers();
    loadItems();

    // Add enter key support for itemCode
    document.getElementById('itemCode').addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = e.target.value;
            if (code) await findAndAddItem(code);
        }
    });
});

let items = []; // Cache items
let cart = []; // Cart items

async function loadCustomers() {
    try {
        const response = await fetch('/api/v1/parties?partyType=customer&limit=1000');
        const data = await response.json();
        const select = document.getElementById('customer');
        select.innerHTML = '<option value="">Select Customer</option>';
        if (data.success) {
            data.data.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c._id;
                opt.text = c.name;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error(e); }
}

async function loadItems() {
    try {
        const response = await fetch('/api/v1/items?limit=1000');
        const data = await response.json();
        const select = document.getElementById('itemSelect');
        select.innerHTML = '<option value="">Select Item</option>';
        if (data.success) {
            items = data.data;
            items.forEach(i => {
                const opt = document.createElement('option');
                opt.value = i._id;
                opt.text = `${i.name} (${i.code})`;
                select.appendChild(opt);
            });
        }
    } catch (e) { console.error(e); }
}

function handleItemSelect(select) {
    const id = select.value;
    const item = items.find(i => i._id === id);
    if (item) {
        document.getElementById('itemCode').value = item.code;
        document.getElementById('currentStock').value = item.stock || 0;
    } else {
        document.getElementById('itemCode').value = '';
        document.getElementById('currentStock').value = '';
    }
}

async function findAndAddItem(code) {
    const item = items.find(i => i.code === code);
    if (!item) {
        alert('Item not found');
        return;
    }

    // Check if already in cart
    const existing = cart.find(c => c.itemId === item._id);
    if (existing) {
        alert('Item already in list');
        return;
    }

    addItemToCart(item);
}

function addItem() {
    const id = document.getElementById('itemSelect').value;
    if (!id) return;
    const item = items.find(i => i._id === id);
    if (item) addItemToCart(item);
}

function addItemToCart(item) {
    cart.push({
        itemId: item._id,
        code: item.code,
        name: item.name,
        pack: item.piecesPerCotton || '-',
        price: item.salePrice,
        qty: 1,
        discPercent: 0,
        discAmount: 0,
        stock: item.stock || 0
    });
    renderCart();
    calculateTotals();

    // Clear item selection
    document.getElementById('itemSelect').value = '';
    document.getElementById('itemCode').value = '';
    document.getElementById('currentStock').value = '';
    document.getElementById('itemCode').focus();
}

function renderCart() {
    const container = document.getElementById('itemsGrid');
    container.innerHTML = '';

    cart.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'row g-0 border-bottom p-1 align-items-center';

        // Calculate row total
        const amount = item.price * item.qty;
        const discount = (amount * item.discPercent) / 100;
        const total = amount - discount;
        item.discAmount = discount;
        item.total = total;

        row.innerHTML = `
            <div class="col-1 small">${item.code}</div>
            <div class="col-4 small text-truncate" title="${item.name}">${item.name}</div>
            <div class="col-1 text-center small">${item.pack}</div>
            <div class="col-1"><input type="number" class="form-control form-control-sm p-1 text-end" value="${item.price}" onchange="updateItem(${index}, 'price', this.value)"></div>
            <div class="col-1"><input type="number" class="form-control form-control-sm p-1 text-center" value="${item.qty}" onchange="updateItem(${index}, 'qty', this.value)"></div>
            <div class="col-1"><input type="number" class="form-control form-control-sm p-1 text-center" value="${item.discPercent}" onchange="updateItem(${index}, 'discPercent', this.value)"></div>
            <div class="col-1 text-end small">${discount.toFixed(2)}</div>
            <div class="col-1 text-end small fw-bold">${total.toFixed(2)}</div>
            <div class="col-1 text-center"><button class="btn btn-xs btn-danger py-0" onclick="removeItem(${index})">&times;</button></div>
        `;
        container.appendChild(row);
    });
}

window.updateItem = function (index, field, value) {
    const val = parseFloat(value);
    if (field === 'qty' && val <= 0) {
        alert('Quantity must be > 0');
        renderCart();
        return;
    }

    cart[index][field] = val || 0;
    renderCart();
    calculateTotals();
};

window.removeItem = function (index) {
    cart.splice(index, 1);
    renderCart();
    calculateTotals();
};

function calculateTotals() {
    let gross = 0;
    cart.forEach(i => gross += (i.price * i.qty)); // Gross before item discounts? 
    // Usually Gross is sum of line totals (which include line discounts?)
    // Let's stick to standard: Gross = sum(qty * price). Line Discount is usually deducted.

    const itemDiscounts = cart.reduce((sum, i) => sum + ((i.price * i.qty) * i.discPercent / 100), 0);
    const grossAfterLineDisc = gross - itemDiscounts;

    document.getElementById('grossTotal').value = grossAfterLineDisc.toFixed(2);

    const globalDiscPerc = parseFloat(document.getElementById('globalDiscPercent').value || 0);
    const globalDiscAmount = (grossAfterLineDisc * globalDiscPerc) / 100;
    document.getElementById('globalDiscAmount').value = globalDiscAmount.toFixed(2);

    const taxPerc = parseFloat(document.getElementById('taxPercent').value || 0);
    const taxAmount = ((grossAfterLineDisc - globalDiscAmount) * taxPerc) / 100;
    document.getElementById('taxAmount').value = taxAmount.toFixed(2);

    const freight = parseFloat(document.getElementById('freight').value || 0);

    const net = grossAfterLineDisc - globalDiscAmount + taxAmount + freight;
    document.getElementById('netTotal').value = Math.round(net).toFixed(2);
}

window.saveDemand = async function () {
    const customer = document.getElementById('customer').value;
    if (!customer) { alert('Select Customer'); return; }
    if (cart.length === 0) { alert('Add items to list'); return; }

    const payload = {
        invNo: document.getElementById('invNo').value || undefined, // undefined lets backed generate
        date: document.getElementById('date').value,
        customer,
        remarks: document.getElementById('remarks').value,
        items: cart.map(i => ({
            item: i.itemId,
            quantity: i.qty,
            price: i.price,
            discountPercent: i.discPercent,
            discountAmount: i.discAmount,
            total: i.total
        })),
        totalAmount: parseFloat(document.getElementById('grossTotal').value),
        discountPercent: parseFloat(document.getElementById('globalDiscPercent').value),
        discountAmount: parseFloat(document.getElementById('globalDiscAmount').value),
        taxPercent: parseFloat(document.getElementById('taxPercent').value),
        taxAmount: parseFloat(document.getElementById('taxAmount').value),
        freightAmount: parseFloat(document.getElementById('freight').value),
        netTotal: parseFloat(document.getElementById('netTotal').value),
        paidAmount: parseFloat(document.getElementById('paidAmount').value)
    };

    try {
        const response = await fetch('/api/v1/customer-demands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            alert('Saved successfully!');
            // Print logic
            window.open(`/print-invoice.html?type=customer-demand&id=${data.data._id}`, '_blank', 'width=1000,height=800');
            clearForm();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (e) { console.error(e); }
};

window.clearForm = function () {
    cart = [];
    document.getElementById('customer').value = '';
    document.getElementById('remarks').value = '';
    document.getElementById('invNo').value = '';
    renderCart();
    calculateTotals();
};

window.loadDemandList = function () {
    alert('List view not yet implemented (Backend supports it)');
};

function handleCustomerChange(select) {
    // maybe load balance?
}
