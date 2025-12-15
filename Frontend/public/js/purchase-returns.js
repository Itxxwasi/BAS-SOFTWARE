// Purchase Returns Management JavaScript - Desktop Design
let currentPage = 1;
let currentLimit = 10;
let returnItems = [];
let availableItems = [];
let suppliers = [];
let purchases = [];

document.addEventListener('DOMContentLoaded', function () {
    // Check if user is authenticated
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Set user name
    setUserName();

    // Initialize returns page
    initReturnsPage();
});

// Set user name in header
function setUserName() {
    const user = getCurrentUser();
    const userNameElement = document.getElementById('userName');
    if (userNameElement && user) {
        userNameElement.textContent = user.name || user.email;
    }
}

// Initialize returns page
function initReturnsPage() {
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('returnDate').value = today;
    document.getElementById('startDate').value = today;
    document.getElementById('endDate').value = today;

    // Load data
    loadSuppliers();
    loadItems();
    // Don't load returns on init - only when List button is clicked
    generateReturnNumber();

    // Event listeners
    document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));
    document.getElementById('startDate').addEventListener('change', loadReturns);
    document.getElementById('endDate').addEventListener('change', loadReturns);
    document.getElementById('statusFilter').addEventListener('change', loadReturns);

    // Supplier change event
    document.getElementById('supplier').addEventListener('change', function () {
        const selectedSupplier = suppliers.find(s => s._id === this.value);
        if (selectedSupplier) {
            document.getElementById('preBalance').value = selectedSupplier.currentBalance || 0;
            loadSupplierPurchases(this.value);
            calculateTotals();
        }
    });

    // Purchase Invoice change event
    document.getElementById('purchaseInvoice').addEventListener('change', function () {
        loadPurchaseDetails(this.value);
    });

    // Item selection event
    document.getElementById('itemSelect').addEventListener('change', function () {
        const selectedItem = availableItems.find(item => item._id === this.value);
        if (selectedItem) {
            document.getElementById('itemCode').value = selectedItem.sku || '';
            document.getElementById('costPrice').value = selectedItem.purchasePrice || 0;
            document.getElementById('stock').value = selectedItem.stockQty || 0;
            document.getElementById('taxPercent').value = selectedItem.taxPercent || 0;
            calculateItemTotal();
        }
    });

    // Calculation events
    document.getElementById('quantity').addEventListener('input', calculateItemTotal);
    document.getElementById('costPrice').addEventListener('input', calculateItemTotal);
    document.getElementById('taxPercent').addEventListener('input', calculateItemTotal);
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

// Load supplier purchases
async function loadSupplierPurchases(supplierId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/purchases?supplier=${supplierId}&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            purchases = data.data || [];
            const purchaseSelect = document.getElementById('purchaseInvoice');
            purchaseSelect.innerHTML = '<option value="">-- Select Invoice --</option>';

            purchases.forEach(purchase => {
                purchaseSelect.innerHTML += `<option value="${purchase._id}">${purchase.invoiceNo} - ${formatDate(purchase.date)}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading purchases:', error);
    }
}

// Load purchase details and populate return items
async function loadPurchaseDetails(purchaseId) {
    try {
        if (!purchaseId) return;

        showLoading();
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/purchases/${purchaseId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const purchase = data.data;

            if (purchase && purchase.items) {
                returnItems = [];

                purchase.items.forEach(item => {
                    const quantity = item.quantity;
                    const costPrice = item.costPrice;
                    const subtotal = quantity * costPrice;
                    const taxPercent = item.taxPercent || 0;
                    const taxAmount = (subtotal * taxPercent) / 100;
                    const total = subtotal + taxAmount;

                    returnItems.push({
                        id: item.item._id || item.item,
                        code: item.item.sku || '', // If populated
                        name: item.name,
                        quantity: quantity,
                        costPrice: costPrice,
                        subtotal: subtotal,
                        taxPercent: taxPercent,
                        taxAmount: taxAmount,
                        total: total
                    });
                });

                updateItemsTable();
                calculateTotals();
                showSuccess('Items loaded from purchase invoice');
            }
        } else {
            showError('Failed to load purchase details');
        }
    } catch (error) {
        console.error('Error loading purchase details:', error);
        showError('Error loading purchase details');
    } finally {
        hideLoading();
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

// Generate return number
async function generateReturnNumber() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/purchase-returns?limit=1&sort=-createdAt', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const lastReturn = data.data[0];
            let newReturnNo = 'PRET-001';

            // Check for returnInvoiceNo (backend) or returnNo (legacy/frontend)
            const lastNo = lastReturn ? (lastReturn.returnInvoiceNo || lastReturn.returnNo) : null;

            if (lastNo) {
                // Extract number part: PRET-001 -> 1
                const parts = lastNo.split('-');
                if (parts.length > 1) {
                    const lastNumber = parseInt(parts[1]) || 0;
                    newReturnNo = `PRET-${String(lastNumber + 1).padStart(3, '0')}`;
                }
            }

            document.getElementById('returnNo').value = newReturnNo;
        }
    } catch (error) {
        console.error('Error generating return number:', error);
        document.getElementById('returnNo').value = 'PRET-001';
    }
}

// Calculate item total
function calculateItemTotal() {
    const quantity = parseFloat(document.getElementById('quantity').value) || 0;
    const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
    const taxPercent = parseFloat(document.getElementById('taxPercent').value) || 0;

    const subtotal = quantity * costPrice;
    const taxAmount = (subtotal * taxPercent) / 100;
    const total = subtotal + taxAmount;

    document.getElementById('taxRs').value = taxAmount.toFixed(2);
    document.getElementById('itemTotal').value = total.toFixed(2);
}

// Add item to return
function addItemToReturn() {
    const itemId = document.getElementById('itemSelect').value;
    const itemCode = document.getElementById('itemCode').value;
    const quantity = parseFloat(document.getElementById('quantity').value) || 0;
    const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
    const taxPercent = parseFloat(document.getElementById('taxPercent').value) || 0;

    if (!itemId || quantity <= 0) {
        showError('Please select an item and enter quantity');
        return;
    }

    const selectedItem = availableItems.find(item => item._id === itemId);
    if (!selectedItem) {
        showError('Item not found');
        return;
    }

    const subtotal = quantity * costPrice;
    const taxAmount = (subtotal * taxPercent) / 100;
    const total = subtotal + taxAmount;

    const item = {
        id: itemId,
        code: itemCode,
        name: selectedItem.name,
        quantity: quantity,
        costPrice: costPrice,
        subtotal: subtotal,
        taxPercent: taxPercent,
        taxAmount: taxAmount,
        total: total
    };

    returnItems.push(item);
    updateItemsTable();
    clearItemFields();
    calculateTotals();
}

// Update items table
function updateItemsTable() {
    const tbody = document.getElementById('returnItemsBody');
    tbody.innerHTML = '';

    returnItems.forEach((item, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.code}</td>
            <td>${item.name}</td>
            <td class="text-right">${item.quantity}</td>
            <td class="text-right">${item.costPrice.toFixed(2)}</td>
            <td class="text-right">${item.subtotal.toFixed(2)}</td>
            <td class="text-right">${item.taxPercent.toFixed(2)}</td>
            <td class="text-right">${item.taxAmount.toFixed(2)}</td>
            <td class="text-right">${item.total.toFixed(2)}</td>
            <td class="text-center">
                <button class="icon-btn danger" onclick="removeItem(${index})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
    });

    // Update footer totals
    const totalSub = returnItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalTaxRs = returnItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalAmount = returnItems.reduce((sum, item) => sum + item.total, 0);

    document.getElementById('footerSub').textContent = totalSub.toFixed(2);
    document.getElementById('footerTaxRs').textContent = totalTaxRs.toFixed(2);
    document.getElementById('footerTotal').textContent = totalAmount.toFixed(2);
}

// Remove item from return
function removeItem(index) {
    returnItems.splice(index, 1);
    updateItemsTable();
    calculateTotals();
}

// Clear item fields
function clearItemFields() {
    document.getElementById('itemSelect').value = '';
    document.getElementById('itemCode').value = '';
    document.getElementById('quantity').value = 1;
    document.getElementById('costPrice').value = '';
    document.getElementById('stock').value = '';
    document.getElementById('taxPercent').value = 0;
    document.getElementById('taxRs').value = '';
    document.getElementById('itemTotal').value = '';
}

// Calculate totals
function calculateTotals() {
    const itemsTotal = returnItems.reduce((sum, item) => sum + item.total, 0);
    const itemsTax = returnItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const itemsSubtotal = returnItems.reduce((sum, item) => sum + item.subtotal, 0);
    const paid = parseFloat(document.getElementById('paid').value) || 0;
    const preBalance = parseFloat(document.getElementById('preBalance').value) || 0;

    // Calculate balances (returns reduce supplier balance)
    const balance = itemsTotal - paid;
    const newBalance = preBalance - itemsTotal + paid;

    // Update fields
    document.getElementById('subTotal').value = itemsSubtotal.toFixed(2);
    document.getElementById('totalTaxRs').value = itemsTax.toFixed(2);
    document.getElementById('grandTotal').value = itemsTotal.toFixed(2);
    document.getElementById('balance').value = balance.toFixed(2);
    document.getElementById('newBalance').value = newBalance.toFixed(2);
}

// Save return
async function saveReturn(status = 'completed') {
    try {
        if (returnItems.length === 0) {
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
        const returnId = document.getElementById('returnId').value;

        // Calculate totals
        const itemsTotal = returnItems.reduce((sum, item) => sum + item.total, 0);
        const itemsTax = returnItems.reduce((sum, item) => sum + item.taxAmount, 0);
        const itemsSubtotal = returnItems.reduce((sum, item) => sum + item.subtotal, 0);
        const paid = parseFloat(document.getElementById('paid').value) || 0;

        const formData = {
            returnNo: document.getElementById('returnNo').value,
            date: document.getElementById('returnDate').value,
            supplier: supplierId,
            purchaseInvoice: document.getElementById('purchaseInvoice').value || null,
            items: returnItems.map(item => ({
                item: item.id,
                name: item.name,
                quantity: item.quantity,
                unit: 'pcs',
                purchasePrice: item.costPrice,
                costPrice: item.costPrice,
                taxPercent: item.taxPercent,
                total: item.total
            })),
            subTotal: itemsSubtotal,
            taxAmount: itemsTax,
            grandTotal: itemsTotal,
            netTotal: itemsTotal,
            paidAmount: paid,
            paymentMode: document.getElementById('paymentMode').value,
            notes: document.getElementById('remarks').value,
            status: status
        };

        const url = returnId ? `/api/v1/purchase-returns/${returnId}` : '/api/v1/purchase-returns';
        const method = returnId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            clearForm();
            loadReturns(currentPage, currentLimit);
            showSuccess('Purchase return saved successfully');
        } else {
            const error = await response.json();
            showError(error.message || 'Failed to save purchase return');
        }
    } catch (error) {
        console.error('Error saving return:', error);
        showError('Failed to save purchase return');
    } finally {
        hideLoading();
    }
}

// Load returns
async function loadReturns(page = 1, limit = 10) {
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

        const response = await fetch(`/api/v1/purchase-returns${queryParams}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            displayReturns(data.data);
            updatePagination(data.pagination);
        } else {
            throw new Error('Failed to load returns');
        }
    } catch (error) {
        console.error('Error loading returns:', error);
        showError('Failed to load purchase returns');
    } finally {
        hideLoading();
    }
}

// Display returns
function displayReturns(returns) {
    const tbody = document.getElementById('returnsTableBody');

    if (!returns || returns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">No purchase returns found</td></tr>';
        return;
    }

    tbody.innerHTML = returns.map(returnItem => `
        <tr>
            <td class="text-center">
                <button class="icon-btn" onclick="editReturn('${returnItem._id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="icon-btn text-secondary" onclick="window.open('/print-invoice.html?type=purchase-return&id=${returnItem._id}', '_blank')" title="Print">
                    <i class="fas fa-print"></i>
                </button>
            </td>
            <td>${returnItem.returnInvoiceNo || returnItem.returnNo}</td>
            <td>${formatDate(returnItem.date)}</td>
            <td>${returnItem.supplier?.name || returnItem.supplierId?.name || '-'}</td>
            <td>${returnItem.purchaseInvoice?.invoiceNo || returnItem.purchaseId?.invoiceNo || '-'}</td>
            <td>${returnItem.items?.length || 0} items</td>
            <td class="text-right">${(returnItem.totalReturnAmount || returnItem.grandTotal || 0).toFixed(2)}</td>
            <td class="text-center"><span class="badge badge-info">${returnItem.returnMode || returnItem.paymentMode || 'Cash'}</span></td>
            <td class="text-center">${getReturnStatusBadge(returnItem.status)}</td>
            <td class="text-center">
                <button class="icon-btn danger" onclick="deleteReturnById('${returnItem._id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Get return status badge
function getReturnStatusBadge(status) {
    const badges = {
        draft: '<span class="badge badge-warning">Draft</span>',
        completed: '<span class="badge badge-success">Completed</span>',
        cancelled: '<span class="badge badge-danger">Cancelled</span>'
    };
    return badges[status] || badges.draft;
}

// Edit return
async function editReturn(returnId) {
    try {
        showLoading();

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/purchase-returns/${returnId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const responseData = await response.json();
            const returnData = responseData.data || responseData;

            // Populate form
            document.getElementById('returnId').value = returnData._id;
            document.getElementById('returnNo').value = returnData.returnNo || returnData.returnInvoiceNo;
            document.getElementById('returnDate').value = returnData.date ? returnData.date.split('T')[0] : '';

            // Handle supplier/supplierId populate mismatch
            const sId = returnData.supplier?._id || returnData.supplier || returnData.supplierId?._id || returnData.supplierId;
            document.getElementById('supplier').value = sId;

            // Handle purchaseInvoice/purchaseId populate mismatch
            const pId = returnData.purchaseInvoice?._id || returnData.purchaseInvoice || returnData.purchaseId?._id || returnData.purchaseId;
            document.getElementById('purchaseInvoice').value = pId || '';
            document.getElementById('remarks').value = returnData.notes || '';
            document.getElementById('paymentMode').value = returnData.paymentMode || 'cash';
            document.getElementById('paid').value = returnData.paidAmount || 0;

            // Load items
            // Load items
            returnItems = returnData.items.map(item => {
                // Handle different field names from backend vs frontend structure
                const itemObj = item.itemId || item.item;
                const qty = item.returnQty || item.quantity || 0;
                const cost = item.cost || item.purchasePrice || item.costPrice || 0;
                const tax = item.taxPercent || 0;
                const total = item.returnAmount || item.total || 0;

                // Calculate derived values if needed
                const subtotal = qty * cost;
                const taxAmt = (subtotal * tax) / 100;

                return {
                    id: itemObj?._id || itemObj,
                    code: itemObj?.sku || '',
                    name: itemObj?.name || item.name || '',
                    quantity: qty,
                    costPrice: cost,
                    subtotal: subtotal,
                    taxPercent: tax,
                    taxAmount: taxAmt,
                    total: total || (subtotal + taxAmt)
                };
            });

            updateItemsTable();
            calculateTotals();

            // Close the list modal
            hideList();

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            showSuccess('Return loaded for editing');
        } else {
            showError('Failed to load return data');
        }
    } catch (error) {
        console.error('Error loading return data:', error);
        showError('Failed to load return data');
    } finally {
        hideLoading();
    }
}

// Delete return by ID
async function deleteReturnById(returnId) {
    if (!confirm('Are you sure you want to delete this purchase return?')) {
        return;
    }

    try {
        showLoading();

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/purchase-returns/${returnId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            loadReturns(currentPage, currentLimit);
            showSuccess('Purchase return deleted successfully');
        } else {
            showError('Failed to delete purchase return');
        }
    } catch (error) {
        console.error('Error deleting return:', error);
        showError('Failed to delete purchase return');
    } finally {
        hideLoading();
    }
}

// Clear form
function clearForm() {
    document.getElementById('returnForm').reset();
    document.getElementById('returnId').value = '';
    document.getElementById('returnDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('paymentMode').value = 'cash';
    returnItems = [];
    updateItemsTable();
    clearItemFields();
    calculateTotals();
    generateReturnNumber();
}

// Show returns list
function showReturnsList() {
    const listModal = document.getElementById('listModal');
    const listModalOverlay = document.getElementById('listModalOverlay');

    if (listModal && listModalOverlay) {
        listModal.classList.add('active');
        listModalOverlay.classList.add('active');

        // Load returns data
        loadReturns(currentPage, currentLimit);
    }
}

// Hide returns list
function hideList() {
    const listModal = document.getElementById('listModal');
    const listModalOverlay = document.getElementById('listModalOverlay');

    if (listModal && listModalOverlay) {
        listModal.classList.remove('active');
        listModalOverlay.classList.remove('active');
    }
}

// Handle search
function handleSearch() {
    loadReturns(1, currentLimit);
}

// Reset filters
function resetFilters() {
    document.getElementById('searchInput').value = '';
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = today;
    document.getElementById('endDate').value = today;
    document.getElementById('statusFilter').value = '';
    loadReturns(1, currentLimit);
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
        html += `<button class="btn btn-sm btn-secondary" onclick="loadReturns(${pagination.prev.page}, ${currentLimit})">
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
        html += `<button class="btn btn-sm btn-secondary" onclick="loadReturns(${pagination.next.page}, ${currentLimit})">
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

// Helper functions
function showSupplierList() {
    window.location.href = '/parties.html';
}

function showItemList() {
    window.location.href = '/items.html';
}
