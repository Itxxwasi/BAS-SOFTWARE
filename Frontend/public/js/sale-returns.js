// Sale Returns Management JavaScript - Desktop Design
let currentPage = 1;
let currentLimit = 10;
let returnItems = [];
let availableItems = [];
let customers = [];
let sales = [];

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
    loadCustomers();
    loadItems();
    generateReturnNumber();

    // Event listeners
    document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));
    document.getElementById('startDate').addEventListener('change', loadReturns);
    document.getElementById('endDate').addEventListener('change', loadReturns);
    document.getElementById('statusFilter').addEventListener('change', loadReturns);

    // Customer change event
    document.getElementById('customer').addEventListener('change', function () {
        const selectedCustomer = customers.find(c => c._id === this.value);
        if (selectedCustomer) {
            document.getElementById('preBalance').value = selectedCustomer.currentBalance || 0;
            loadCustomerSales(this.value);
            calculateTotals();
        }
    });

    // Sale Invoice change event (Auto-load items)
    document.getElementById('saleInvoice').addEventListener('change', function () {
        console.log('Sale Invoice Changed:', this.value);
        if (this.value) {
            loadSaleDetails(this.value);
        } else {
            // Clear items if unselected
            returnItems = [];
            updateItemsTable();
            calculateTotals();
        }
    });

    // Item selection event
    document.getElementById('itemSelect').addEventListener('change', function () {
        const selectedItem = availableItems.find(item => item._id === this.value);
        if (selectedItem) {
            document.getElementById('itemCode').value = selectedItem.sku || '';
            document.getElementById('salePrice').value = selectedItem.salePrice || 0;
            document.getElementById('stock').value = selectedItem.stockQty || 0;
            document.getElementById('taxPercent').value = selectedItem.taxPercent || 0;
            calculateItemTotal();
        }
    });

    // Calculation events
    document.getElementById('quantity').addEventListener('input', calculateItemTotal);
    document.getElementById('salePrice').addEventListener('input', calculateItemTotal);
    document.getElementById('taxPercent').addEventListener('input', calculateItemTotal);
    document.getElementById('refunded').addEventListener('input', calculateTotals);
}

// Load customers
async function loadCustomers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/parties?partyType=customer&limit=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            customers = data.data || [];
            const customerSelect = document.getElementById('customer');
            customerSelect.innerHTML = '<option value="">-- Select Customer --</option>';

            customers.forEach(customer => {
                customerSelect.innerHTML += `<option value="${customer._id}">${customer.name}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

// Load customer sales
async function loadCustomerSales(customerId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/sales?party=${customerId}&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            sales = data.data || [];
            const saleSelect = document.getElementById('saleInvoice');
            saleSelect.innerHTML = '<option value="">-- Select Invoice --</option>';

            sales.forEach(sale => {
                saleSelect.innerHTML += `<option value="${sale._id}">${sale.invoiceNumber || sale.invoiceNo} - ${formatDate(sale.date)}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading sales:', error);
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

// Load sale details and populate return items
async function loadSaleDetails(saleId) {
    try {
        if (!saleId) return;

        showLoading();
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/sales/${saleId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const sale = data.data;

            if (sale && sale.items) {
                returnItems = [];

                sale.items.forEach(item => {
                    // Handle populate structure or ID only
                    const itemId = item.item._id || item.item;
                    const itemCode = item.item.sku || item.item.code || ''; // Depends on population
                    const itemName = item.item.name || item.name; // Fallback

                    // Add to return items
                    returnItems.push({
                        id: itemId,
                        code: itemCode,
                        name: itemName,
                        quantity: item.quantity, // Default to full return? Or 0? Let's verify requirement.
                        // Ideally default to 0 to let user choose, or full quantity to return everything.
                        // User asked "load data agt invoice all ietm was save in sale".
                        // Usually pre-filling with sold quantity is convenient.
                        salePrice: item.rate || item.price || 0,
                        subtotal: (item.quantity * (item.rate || 0)),
                        taxPercent: item.taxPercent || 0, // Need to handle tax populate if complex
                        taxAmount: item.taxAmount || 0,
                        total: item.total || item.amount
                    });
                });

                updateItemsTable();
                calculateTotals();
                showSuccess('Items loaded from invoice');
            }
        } else {
            showError('Failed to load sale details');
        }
    } catch (error) {
        console.error('Error loading sale details:', error);
        showError('Error loading sale details');
    } finally {
        hideLoading();
    }
}

// Generate return number
async function generateReturnNumber() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/sales-returns?limit=10&sort=-createdAt', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            // Find the first return with SRET- prefix
            const lastReturn = data.data.find(r =>
                (r.returnInvoiceNo || r.returnNo || '').startsWith('SRET-')
            );
            let newReturnNo = 'SRET-001';

            if (lastReturn && (lastReturn.returnInvoiceNo || lastReturn.returnNo)) {
                const returnNo = lastReturn.returnInvoiceNo || lastReturn.returnNo;
                // Check if it matches SRET format
                if (returnNo.startsWith('SRET-')) {
                    const lastNumber = parseInt(returnNo.split('-')[1]) || 0;
                    newReturnNo = `SRET-${String(lastNumber + 1).padStart(3, '0')}`;
                }
            }

            document.getElementById('returnNo').value = newReturnNo;
        }
    } catch (error) {
        console.error('Error generating return number:', error);
        document.getElementById('returnNo').value = 'SRET-001';
    }
}

// Calculate item total
function calculateItemTotal() {
    const quantity = parseFloat(document.getElementById('quantity').value) || 0;
    const salePrice = parseFloat(document.getElementById('salePrice').value) || 0;
    const taxPercent = parseFloat(document.getElementById('taxPercent').value) || 0;

    const subtotal = quantity * salePrice;
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
    const salePrice = parseFloat(document.getElementById('salePrice').value) || 0;
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

    const subtotal = quantity * salePrice;
    const taxAmount = (subtotal * taxPercent) / 100;
    const total = subtotal + taxAmount;

    const item = {
        id: itemId,
        code: itemCode,
        name: selectedItem.name,
        quantity: quantity,
        salePrice: salePrice,
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
            <td class="text-right">${item.salePrice.toFixed(2)}</td>
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
    document.getElementById('salePrice').value = '';
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
    const refunded = parseFloat(document.getElementById('refunded').value) || 0;
    const preBalance = parseFloat(document.getElementById('preBalance').value) || 0;

    // Calculate balances (returns reduce customer balance - they owe us less)
    const balance = itemsTotal - refunded;
    const newBalance = preBalance - itemsTotal + refunded;

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

        const customerId = document.getElementById('customer').value;
        if (!customerId) {
            showError('Please select a customer');
            return;
        }

        showLoading();

        const token = localStorage.getItem('token');
        const returnId = document.getElementById('returnId').value;

        // Calculate totals
        const itemsTotal = returnItems.reduce((sum, item) => sum + item.total, 0);
        const itemsTax = returnItems.reduce((sum, item) => sum + item.taxAmount, 0);
        const itemsSubtotal = returnItems.reduce((sum, item) => sum + item.subtotal, 0);
        const refunded = parseFloat(document.getElementById('refunded').value) || 0;

        const formData = {
            returnInvoiceNo: document.getElementById('returnNo').value,
            date: document.getElementById('returnDate').value,
            customerId: customerId, // Changed from customer to customerId
            saleInvoice: document.getElementById('saleInvoice').value || null,
            items: returnItems.map(item => ({
                itemId: item.id, // Backend expects itemId or item
                // Backend uses item.id as itemId
                returnQty: item.quantity, // Backend expects returnQty or quantity
                // Note: Frontend UI calculates 'quantity' as return qty for new items.
                // For auto-loaded items, we set quantity.
                salePrice: item.salePrice,
                price: item.salePrice,
                taxPercent: item.taxPercent,
                returnAmount: item.total // Backend calcs this, but we send it
            })),
            totalReturnAmount: itemsTotal, // Backend expects totalReturnAmount
            returnMode: document.getElementById('paymentMode').value, // Changed from paymentMode
            notes: document.getElementById('remarks').value, // Changed from remarks
            status: status
        };

        const url = returnId ? `/api/v1/sales-returns/${returnId}` : '/api/v1/sales-returns';
        const method = returnId ? 'PUT' : 'POST';

        console.log('Sending Return Data:', formData);

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
            showSuccess('Sale return saved successfully');
        } else {
            const error = await response.json();
            showError(error.message || 'Failed to save sale return');
        }
    } catch (error) {
        console.error('Error saving return:', error);
        showError('Failed to save sale return');
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

        const response = await fetch(`/api/v1/sales-returns${queryParams}`, {
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
        document.getElementById('returnsTableBody').innerHTML =
            '<tr><td colspan="10" class="text-center">No sale returns found</td></tr>';
    } finally {
        hideLoading();
    }
}

// Display returns
function displayReturns(returns) {
    const tbody = document.getElementById('returnsTableBody');

    if (!returns || returns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">No sale returns found</td></tr>';
        return;
    }

    tbody.innerHTML = returns.map(returnItem => `
        <tr>
            <td class="text-center">
                <button class="icon-btn" onclick="editReturn('${returnItem._id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="icon-btn text-secondary" onclick="window.open('/print-invoice.html?type=sale-return&id=${returnItem._id}', '_blank')" title="Print">
                    <i class="fas fa-print"></i>
                </button>
            </td>
            <td>${returnItem.returnInvoiceNo}</td>
            <td>${formatDate(returnItem.date)}</td>
            <td>${returnItem.customerId?.name || '-'}</td>
            <td>${returnItem.saleId?.invoiceNumber || '-'}</td>
            <td>${returnItem.items?.length || 0} items</td>
            <td class="text-right">${(returnItem.totalReturnAmount || returnItem.grandTotal || 0).toFixed(2)}</td>
            <td class="text-center"><span class="badge badge-info">${returnItem.returnMode || returnItem.paymentMode}</span></td>
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
        const response = await fetch(`/api/v1/sales-returns/${returnId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const responseData = await response.json();
            const returnData = responseData.data || responseData;

            // Populate form
            document.getElementById('returnId').value = returnData._id;
            document.getElementById('returnNo').value = returnData.returnInvoiceNo;
            document.getElementById('returnDate').value = returnData.date ? returnData.date.split('T')[0] : '';
            document.getElementById('customer').value = returnData.customerId?._id || returnData.customerId;
            document.getElementById('saleInvoice').value = returnData.saleId?._id || returnData.saleId || '';
            document.getElementById('remarks').value = returnData.notes || '';
            document.getElementById('paymentMode').value = returnData.returnMode || 'cash';
            document.getElementById('refunded').value = returnData.refundedAmount || 0;

            // Load items
            returnItems = returnData.items.map(item => ({
                id: item.itemId?._id || item.itemId,
                code: item.itemId?.sku || '',
                name: item.itemId?.name || '',
                quantity: item.returnQty,
                salePrice: item.price,
                subtotal: item.returnQty * item.price,
                taxPercent: item.taxPercent || 0,
                taxAmount: ((item.returnQty * item.price) * (item.taxPercent || 0)) / 100,
                total: item.returnAmount || (item.returnQty * item.price)
            }));

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
    if (!confirm('Are you sure you want to delete this sale return?')) {
        return;
    }

    try {
        showLoading();

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/sales-returns/${returnId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            loadReturns(currentPage, currentLimit);
            showSuccess('Sale return deleted successfully');
        } else {
            showError('Failed to delete sale return');
        }
    } catch (error) {
        console.error('Error deleting return:', error);
        showError('Failed to delete sale return');
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
function showCustomerList() {
    window.location.href = '/parties.html';
}

function showItemList() {
    window.location.href = '/items.html';
}
