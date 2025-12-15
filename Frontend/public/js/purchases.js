// Purchases Management JavaScript - Desktop Design
let currentPage = 1;
let currentLimit = 10;
let purchaseItems = [];
let availableItems = [];
let suppliers = [];

document.addEventListener('DOMContentLoaded', function () {
    // Check if user is authenticated
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Set user name
    setUserName();

    // Initialize purchases page
    initPurchasesPage();
});

// Set user name in header
function setUserName() {
    const user = getCurrentUser();
    const userNameElement = document.getElementById('userName');
    if (userNameElement && user) {
        userNameElement.textContent = user.name || user.email;
    }
}

// Initialize purchases page
function initPurchasesPage() {
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('purchaseDate').value = today;
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';

    // Load data
    loadSuppliers();
    loadItems();
    // Don't load purchases on init - only when List button is clicked
    generateInvoiceNumber();

    // Event listeners
    document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));
    document.getElementById('startDate').addEventListener('change', loadPurchases);
    document.getElementById('endDate').addEventListener('change', loadPurchases);
    document.getElementById('statusFilter').addEventListener('change', loadPurchases);

    // Supplier change event
    document.getElementById('supplier').addEventListener('change', function () {
        const selectedSupplier = suppliers.find(s => s._id === this.value);
        if (selectedSupplier) {
            document.getElementById('preBalance').value = selectedSupplier.currentBalance || 0;
            calculateTotals();
        }
    });

    // Item selection event
    document.getElementById('itemSelect').addEventListener('change', function () {
        const selectedItem = availableItems.find(item => item._id === this.value);
        if (selectedItem) {
            document.getElementById('itemCode').value = selectedItem.sku || '';
            document.getElementById('costPrice').value = selectedItem.purchasePrice || 0;
            document.getElementById('salePrice').value = selectedItem.salePrice || 0;
            document.getElementById('stock').value = selectedItem.stockQty || 0;
            document.getElementById('taxPercent').value = selectedItem.taxPercent || 0;
            calculateItemTotal();
        }
    });

    // Calculation events
    document.getElementById('pack').addEventListener('input', calculateItemTotal);
    document.getElementById('costPrice').addEventListener('input', calculateItemTotal);
    document.getElementById('taxPercent').addEventListener('input', calculateItemTotal);
    document.getElementById('discPercent').addEventListener('input', calculateItemTotal);
    document.getElementById('discountPercent').addEventListener('input', calculateTotals);
    document.getElementById('discountRs').addEventListener('input', calculateTotals);
    document.getElementById('totalTaxPercent').addEventListener('input', calculateTotals);
    document.getElementById('misc').addEventListener('input', calculateTotals);
    document.getElementById('freight').addEventListener('input', calculateTotals);
    document.getElementById('paid').addEventListener('input', calculateTotals);
}

// Load suppliers
async function loadSuppliers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/parties?partyType=supplier&limit=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            suppliers = data.data || [];
            const supplierSelect = document.getElementById('supplier');
            supplierSelect.innerHTML = '<option value="">-- Select Supplier --</option>';

            suppliers.forEach(supplier => {
                supplierSelect.innerHTML += `<option value="${supplier._id}">${supplier.name}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

// Load items
async function loadItems() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/items?limit=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            availableItems = data.data || [];
            const itemSelect = document.getElementById('itemSelect');
            itemSelect.innerHTML = '<option value="">-- Select Item --</option>';

            availableItems.forEach(item => {
                itemSelect.innerHTML += `<option value="${item._id}">${item.name} (Stock: ${item.stockQty || 0})</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading items:', error);
    }
}

// Generate invoice number
async function generateInvoiceNumber() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/purchases?limit=1&sort=-createdAt', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const lastPurchase = data.data[0];
            let newInvoice = 'PUR-001';

            if (lastPurchase && lastPurchase.invoiceNo) {
                const lastNumber = parseInt(lastPurchase.invoiceNo.split('-')[1]) || 0;
                newInvoice = `PUR-${String(lastNumber + 1).padStart(3, '0')}`;
            }

            document.getElementById('invoiceNo').value = newInvoice;
        }
    } catch (error) {
        console.error('Error generating invoice number:', error);
    }
}

// Calculate item total
function calculateItemTotal() {
    const pack = parseFloat(document.getElementById('pack').value) || 0;
    const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
    const taxPercent = parseFloat(document.getElementById('taxPercent').value) || 0;
    const discPercent = parseFloat(document.getElementById('discPercent').value) || 0;

    const subtotal = pack * costPrice;
    const taxAmount = (subtotal * taxPercent) / 100;
    const total = subtotal + taxAmount;
    const discAmount = (total * discPercent) / 100;
    const netTotal = total - discAmount;

    document.getElementById('itemTotal').value = total.toFixed(2);
    document.getElementById('taxRs').value = taxAmount.toFixed(2);
    document.getElementById('discRs').value = discAmount.toFixed(2);
    document.getElementById('itemNetTotal').value = netTotal.toFixed(2);
}

// Add item to purchase
function addItemToPurchase() {
    const itemId = document.getElementById('itemSelect').value;
    const itemCode = document.getElementById('itemCode').value;
    const pack = parseFloat(document.getElementById('pack').value) || 0;
    const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
    const salePrice = parseFloat(document.getElementById('salePrice').value) || 0;
    const taxPercent = parseFloat(document.getElementById('taxPercent').value) || 0;
    const discPercent = parseFloat(document.getElementById('discPercent').value) || 0;

    if (!itemId || pack <= 0) {
        showError('Please select an item and enter quantity');
        return;
    }

    const selectedItem = availableItems.find(item => item._id === itemId);
    if (!selectedItem) {
        showError('Item not found');
        return;
    }

    const subtotal = pack * costPrice;
    const taxAmount = (subtotal * taxPercent) / 100;
    const total = subtotal + taxAmount;
    const discAmount = (total * discPercent) / 100;
    const netTotal = total - discAmount;

    const item = {
        id: itemId,
        code: itemCode,
        name: selectedItem.name,
        pack: pack,
        costPrice: costPrice,
        salePrice: salePrice,
        subtotal: subtotal,
        taxPercent: taxPercent,
        taxAmount: taxAmount,
        total: total,
        discPercent: discPercent,
        discAmount: discAmount,
        netTotal: netTotal
    };

    purchaseItems.push(item);
    updateItemsTable();
    clearItemFields();
    calculateTotals();
}

// Update items table
function updateItemsTable() {
    const tbody = document.getElementById('purchaseItemsBody');
    tbody.innerHTML = '';

    purchaseItems.forEach((item, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.code}</td>
            <td>${item.name}</td>
            <td class="text-right">${item.pack}</td>
            <td class="text-right">${item.costPrice.toFixed(2)}</td>
            <td class="text-right">${item.subtotal.toFixed(2)}</td>
            <td class="text-right">${item.taxPercent.toFixed(2)}</td>
            <td class="text-right">${item.taxAmount.toFixed(2)}</td>
            <td class="text-right">${item.total.toFixed(2)}</td>
            <td class="text-right">${item.discPercent.toFixed(2)}</td>
            <td class="text-right">${item.discAmount.toFixed(2)}</td>
            <td class="text-right">${item.netTotal.toFixed(2)}</td>
            <td class="text-center">
                <button class="icon-btn danger" onclick="removeItem(${index})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
    });

    // Update footer totals
    const totalSub = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalTaxRs = purchaseItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalAmount = purchaseItems.reduce((sum, item) => sum + item.total, 0);
    const totalDiscRs = purchaseItems.reduce((sum, item) => sum + item.discAmount, 0);
    const totalNet = purchaseItems.reduce((sum, item) => sum + item.netTotal, 0);

    document.getElementById('footerSub').textContent = totalSub.toFixed(2);
    document.getElementById('footerTaxRs').textContent = totalTaxRs.toFixed(2);
    document.getElementById('footerTotal').textContent = totalAmount.toFixed(2);
    document.getElementById('footerDiscRs').textContent = totalDiscRs.toFixed(2);
    document.getElementById('footerNetTotal').textContent = totalNet.toFixed(2);
}

// Remove item from purchase
function removeItem(index) {
    purchaseItems.splice(index, 1);
    updateItemsTable();
    calculateTotals();
}

// Clear item fields
function clearItemFields() {
    document.getElementById('itemSelect').value = '';
    document.getElementById('itemCode').value = '';
    document.getElementById('pack').value = 1;
    document.getElementById('costPrice').value = '';
    document.getElementById('salePrice').value = '';
    document.getElementById('stock').value = '';
    document.getElementById('taxPercent').value = 0;
    document.getElementById('taxRs').value = '';
    document.getElementById('discPercent').value = 0;
    document.getElementById('discRs').value = '';
    document.getElementById('itemTotal').value = '';
    document.getElementById('itemNetTotal').value = '';
}

// Calculate totals
function calculateTotals() {
    const itemsTotal = purchaseItems.reduce((sum, item) => sum + item.netTotal, 0);
    const discountPercent = parseFloat(document.getElementById('discountPercent').value) || 0;
    const discountRs = parseFloat(document.getElementById('discountRs').value) || 0;
    const totalTaxPercent = parseFloat(document.getElementById('totalTaxPercent').value) || 0;
    const misc = parseFloat(document.getElementById('misc').value) || 0;
    const freight = parseFloat(document.getElementById('freight').value) || 0;
    const paid = parseFloat(document.getElementById('paid').value) || 0;
    const preBalance = parseFloat(document.getElementById('preBalance').value) || 0;

    // Calculate discount
    let totalDiscount = discountRs;
    if (discountPercent > 0) {
        totalDiscount = (itemsTotal * discountPercent) / 100;
        document.getElementById('discountRs').value = totalDiscount.toFixed(2);
    }

    // Calculate after discount
    const afterDiscount = itemsTotal - totalDiscount;

    // Calculate tax
    const taxAmount = (afterDiscount * totalTaxPercent) / 100;

    // Calculate net total
    const netTotal = afterDiscount + taxAmount + misc + freight;

    // Calculate balances
    const invBalance = netTotal - paid;
    const newBalance = preBalance + invBalance;

    // Update fields
    document.getElementById('totalAmount').value = itemsTotal.toFixed(2);
    document.getElementById('totalTaxRs').value = taxAmount.toFixed(2);
    document.getElementById('netTotal').value = netTotal.toFixed(2);
    document.getElementById('invBalance').value = invBalance.toFixed(2);
    document.getElementById('newBalance').value = newBalance.toFixed(2);
}

// Save purchase
async function savePurchase(status = 'received', printAfter = false) {
    try {
        if (purchaseItems.length === 0) {
            showError('Please add at least one item');
            return;
        }

        const supplierId = document.getElementById('supplier').value;
        if (!supplierId) {
            showError('Please select a supplier');
            return;
        }

        showLoading();

        const token = localStorage.getItem('token');
        const purchaseId = document.getElementById('purchaseId').value;

        // Calculate totals
        const itemsTotal = purchaseItems.reduce((sum, item) => sum + item.netTotal, 0);
        const discountRs = parseFloat(document.getElementById('discountRs').value) || 0;
        const totalTaxPercent = parseFloat(document.getElementById('totalTaxPercent').value) || 0;
        const misc = parseFloat(document.getElementById('misc').value) || 0;
        const freight = parseFloat(document.getElementById('freight').value) || 0;
        const paid = parseFloat(document.getElementById('paid').value) || 0;

        // Calculate after discount
        const afterDiscount = itemsTotal - discountRs;

        // Calculate tax
        const taxAmount = (afterDiscount * totalTaxPercent) / 100;

        // Calculate final totals
        const subTotal = itemsTotal;
        const netTotal = afterDiscount + taxAmount + misc + freight;
        const grandTotal = netTotal;

        const formData = {
            invoiceNo: document.getElementById('invoiceNo').value,
            billNo: document.getElementById('billNo').value,
            date: document.getElementById('purchaseDate').value,
            supplier: supplierId,
            items: purchaseItems.map(item => ({
                item: item.id,
                name: item.name,
                quantity: item.pack,
                unit: 'pcs',
                purchasePrice: item.costPrice,
                costPrice: item.costPrice,
                salePrice: item.salePrice,
                taxPercent: item.taxPercent,
                discountPercent: item.discPercent,
                total: item.netTotal
            })),
            subTotal: subTotal,
            discount: discountRs,
            taxPercent: totalTaxPercent,
            taxAmount: taxAmount,
            misc: misc,
            freight: freight,
            netTotal: netTotal,
            grandTotal: grandTotal,
            paidAmount: paid,
            paymentMode: document.getElementById('paymentMode').value,
            notes: document.getElementById('remarks').value,
            status: status
        };

        const url = purchaseId ? `/api/v1/purchases/${purchaseId}` : '/api/v1/purchases';
        const method = purchaseId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            const savedPurchase = await response.json();
            clearForm();
            loadPurchases(currentPage, currentLimit);
            showSuccess(status === 'draft' ? 'Purchase saved as draft' : 'Purchase saved successfully');

            if (printAfter) {
                printPurchase(savedPurchase._id || savedPurchase.data._id);
            }
        } else {
            const error = await response.json();
            showError(error.message || 'Failed to save purchase');
        }
    } catch (error) {
        console.error('Error saving purchase:', error);
        showError('Failed to save purchase');
    } finally {
        hideLoading();
    }
}

// Load purchases
async function loadPurchases(page = 1, limit = 10) {
    try {
        showLoading();

        currentPage = page;
        currentLimit = limit;

        const token = localStorage.getItem('token');
        const search = document.getElementById('searchInput').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const status = document.getElementById('statusFilter').value;

        let queryParams = `?page=${page}&limit=${limit}`;
        if (search) queryParams += `&search=${search}`;
        if (startDate) queryParams += `&startDate=${startDate}`;
        if (endDate) queryParams += `&endDate=${endDate}`;
        if (status) queryParams += `&status=${status}`;

        const response = await fetch(`/api/v1/purchases${queryParams}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Purchase data received:', data); // Debug log
            if (data && data.data) {
                displayPurchases(data.data);
                updatePagination(data.pagination);
            } else {
                console.error('Invalid response structure:', data);
                showError('Invalid response from server');
            }
        } else {
            const errorData = await response.json().catch(() => ({ message: 'Failed to load purchases' }));
            throw new Error(errorData.message || 'Failed to load purchases');
        }
    } catch (error) {
        console.error('Error loading purchases:', error);
        showError('Failed to load purchases');
    } finally {
        hideLoading();
    }
}

// Display purchases
function displayPurchases(purchases) {
    const tbody = document.getElementById('purchasesTableBody');

    if (!purchases || purchases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">No purchases found</td></tr>';
        return;
    }

    tbody.innerHTML = purchases.map(purchase => `
        <tr>
            <td class="text-center">
                <button class="icon-btn" onclick="editPurchase('${purchase._id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="icon-btn text-secondary" onclick="window.open('/print-invoice.html?type=purchase&id=${purchase._id}', '_blank')" title="Print">
                    <i class="fas fa-print"></i>
                </button>
            </td>
            <td>${purchase.invoiceNo}</td>
            <td>${purchase.billNo || '-'}</td>
            <td>${formatDate(purchase.date)}</td>
            <td>${purchase.supplier?.name || '-'}</td>
            <td>${purchase.items?.length || 0} items</td>
            <td class="text-right">${(parseFloat(purchase.grandTotal) || 0).toFixed(2)}</td>
            <td class="text-center"><span class="badge badge-info">${purchase.paymentMode}</span></td>
            <td class="text-center">${getPurchaseStatusBadge(purchase.status)}</td>
            <td class="text-center">
                <button class="icon-btn danger" onclick="deletePurchaseById('${purchase._id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Get purchase status badge
function getPurchaseStatusBadge(status) {
    const badges = {
        draft: '<span class="badge badge-warning">Draft</span>',
        received: '<span class="badge badge-success">Received</span>',
        pending: '<span class="badge badge-info">Pending</span>',
        cancelled: '<span class="badge badge-danger">Cancelled</span>'
    };
    return badges[status] || badges.draft;
}

// Edit purchase
async function editPurchase(purchaseId) {
    try {
        showLoading();

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/purchases/${purchaseId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const responseData = await response.json();
            const purchase = responseData.data || responseData; // Handle both response formats

            // Populate form
            document.getElementById('purchaseId').value = purchase._id;
            document.getElementById('invoiceNo').value = purchase.invoiceNo;
            document.getElementById('billNo').value = purchase.billNo || '';
            document.getElementById('purchaseDate').value = purchase.date ? purchase.date.split('T')[0] : '';
            document.getElementById('supplier').value = purchase.supplier._id || purchase.supplier;
            document.getElementById('remarks').value = purchase.notes || '';
            document.getElementById('paymentMode').value = purchase.paymentMode || 'cash';
            document.getElementById('discountRs').value = purchase.discountTotal || purchase.discount || 0;
            document.getElementById('totalTaxPercent').value = purchase.taxPercent || 0;
            document.getElementById('misc').value = purchase.otherCharges || purchase.misc || 0;
            document.getElementById('freight').value = purchase.shippingCharges || purchase.freight || 0;
            document.getElementById('paid').value = purchase.paidAmount || 0;

            // Load items
            purchaseItems = purchase.items.map(item => ({
                id: item.item._id || item.item,
                code: item.item.sku || '',
                name: item.item.name || item.name,
                pack: item.quantity,
                costPrice: item.costPrice || item.purchasePrice || 0,
                salePrice: item.salePrice || 0,
                subtotal: item.quantity * (item.costPrice || item.purchasePrice || 0),
                taxPercent: item.taxPercent || 0,
                taxAmount: ((item.quantity * (item.costPrice || item.purchasePrice || 0)) * (item.taxPercent || 0)) / 100,
                total: item.quantity * (item.costPrice || item.purchasePrice || 0),
                discPercent: item.discountPercent || 0,
                discAmount: 0,
                netTotal: item.total || (item.quantity * (item.costPrice || item.purchasePrice || 0))
            }));

            updateItemsTable();
            calculateTotals();

            // Close the list modal
            hideList();

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            showSuccess('Purchase loaded for editing');
        } else {
            showError('Failed to load purchase data');
        }
    } catch (error) {
        console.error('Error loading purchase data:', error);
        showError('Failed to load purchase data');
    } finally {
        hideLoading();
    }
}

// Delete purchase by ID
async function deletePurchaseById(purchaseId) {
    if (!confirm('Are you sure you want to delete this purchase?')) {
        return;
    }

    try {
        showLoading();

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/purchases/${purchaseId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            loadPurchases(currentPage, currentLimit);
            showSuccess('Purchase deleted successfully');
        } else {
            showError('Failed to delete purchase');
        }
    } catch (error) {
        console.error('Error deleting purchase:', error);
        showError('Failed to delete purchase');
    } finally {
        hideLoading();
    }
}

// Clear form
function clearForm() {
    document.getElementById('purchaseForm').reset();
    document.getElementById('purchaseId').value = '';
    document.getElementById('purchaseDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('paymentMode').value = 'cash';
    purchaseItems = [];
    updateItemsTable();
    clearItemFields();
    calculateTotals();
    generateInvoiceNumber();
}

// Show purchases list
function showPurchasesList() {
    const listModal = document.getElementById('listModal');
    const listModalOverlay = document.getElementById('listModalOverlay');

    if (listModal && listModalOverlay) {
        listModal.classList.add('active');
        listModalOverlay.classList.add('active');

        // Load purchases data
        loadPurchases(currentPage, currentLimit);
    }
}

// Hide purchases list
function hideList() {
    const listModal = document.getElementById('listModal');
    const listModalOverlay = document.getElementById('listModalOverlay');

    if (listModal && listModalOverlay) {
        listModal.classList.remove('active');
        listModalOverlay.classList.remove('active');
    }
}

// Print purchase
function printPurchase(purchaseId) {
    if (!purchaseId) {
        purchaseId = document.getElementById('purchaseId').value;
    }
    if (purchaseId) {
        window.print();
    } else {
        showError('No purchase to print');
    }
}

// Search invoice
function searchInvoice() {
    const invoice = prompt('Enter invoice number:');
    if (invoice) {
        document.getElementById('searchInput').value = invoice;
        loadPurchases();
    }
}

// Hold invoice
function holdInvoice() {
    savePurchase('draft');
}

// Show unposted list
function showUnpostedList() {
    document.getElementById('statusFilter').value = 'draft';
    loadPurchases();
}

// Apply discount
function applyDiscount() {
    const discount = prompt('Enter discount percentage:');
    if (discount && !isNaN(discount)) {
        document.getElementById('discountPercent').value = discount;
        calculateTotals();
    }
}

// Handle search
function handleSearch() {
    loadPurchases(1, currentLimit);
}

// Reset filters
function resetFilters() {
    document.getElementById('searchInput').value = '';
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('statusFilter').value = '';
    loadPurchases(1, currentLimit);
}

// Update pagination
function updatePagination(pagination) {
    const paginationDiv = document.getElementById('pagination');

    if (!pagination) {
        paginationDiv.innerHTML = '';
        return;
    }

    let html = '<div class="d-flex justify-content-center gap-2">';

    if (pagination.prev) {
        html += `<button class="btn btn-sm btn-secondary" onclick="loadPurchases(${pagination.prev.page}, ${currentLimit})">
            <i class="fas fa-chevron-left"></i> Previous
        </button>`;
    }

    const currentPage = pagination.page || 1;
    const total = pagination.total || 0;
    const limit = pagination.limit || 10;
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

    html += `<button class="btn btn-sm btn-primary" disabled>
        Page ${currentPage} of ${totalPages}
    </button>`;

    if (pagination.next) {
        html += `<button class="btn btn-sm btn-secondary" onclick="loadPurchases(${pagination.next.page}, ${currentLimit})">
            Next <i class="fas fa-chevron-right"></i>
        </button>`;
    }

    html += '</div>';
    paginationDiv.innerHTML = html;
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Modal functions (placeholders)
function openSupplierModal() {
    showInfo('Supplier quick add will be implemented');
}

function openItemModal() {
    showInfo('Item quick add will be implemented');
}

function showSupplierList() {
    window.location.href = '/parties.html';
}

function showItemList() {
    window.location.href = '/items.html';
}
