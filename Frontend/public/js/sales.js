// Sales Management JavaScript - Desktop Design
let currentPage = 1;
let currentLimit = 10;
let saleItems = [];
let availableItems = [];
let customers = [];

document.addEventListener('DOMContentLoaded', function () {
    // Check if user is authenticated
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Set user name
    setUserName();

    // Initialize sales page
    initSalesPage();
});

// Set user name in header
function setUserName() {
    const user = getCurrentUser();
    const userNameElement = document.getElementById('userName');
    if (userNameElement && user) {
        userNameElement.textContent = user.name || user.email;
    }
}

// Initialize sales page
function initSalesPage() {
    // Set date range (First day of month to Today)
    const todayDate = new Date();
    const firstDay = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

    // Format to YYYY-MM-DD
    const formatDateInput = (date) => date.toISOString().split('T')[0];

    document.getElementById('saleDate').value = formatDateInput(todayDate);
    document.getElementById('startDate').value = formatDateInput(firstDay);
    document.getElementById('endDate').value = formatDateInput(todayDate);

    // Load data
    loadCustomers();
    loadItems();
    loadCategories();
    // Don't load sales on init - only when List button is clicked
    generateInvoiceNumber();

    // Event listeners
    document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));
    document.getElementById('startDate').addEventListener('change', loadSales);
    document.getElementById('endDate').addEventListener('change', loadSales);
    document.getElementById('statusFilter').addEventListener('change', loadSales);

    // Customer change event
    document.getElementById('customer').addEventListener('change', function () {
        const selectedCustomer = customers.find(c => c._id === this.value);
        if (selectedCustomer) {
            document.getElementById('customerContact').value = selectedCustomer.phone || selectedCustomer.mobile || '';
            document.getElementById('preBalance').value = selectedCustomer.currentBalance || 0;
            calculateTotals();
        }
    });

    // Item selection event
    document.getElementById('itemSelect').addEventListener('change', function () {
        const selectedItem = availableItems.find(item => item._id === this.value);
        if (selectedItem) {
            document.getElementById('itemCode').value = selectedItem.sku || '';
            document.getElementById('price').value = selectedItem.salePrice || 0;
            document.getElementById('stock').value = selectedItem.stockQty || 0;
            document.getElementById('taxPercent').value = selectedItem.taxPercent || 0;
            calculateItemTotal();
        }
    });

    // Calculation events
    document.getElementById('pack').addEventListener('input', calculateItemTotal);
    document.getElementById('price').addEventListener('input', calculateItemTotal);
    document.getElementById('taxPercent').addEventListener('input', calculateItemTotal);
    document.getElementById('discPercent').addEventListener('input', calculateItemTotal);
    document.getElementById('discountPercent').addEventListener('input', calculateTotals);
    document.getElementById('discountRs').addEventListener('input', calculateTotals);
    document.getElementById('totalTaxPercent').addEventListener('input', calculateTotals);
    document.getElementById('misc').addEventListener('input', calculateTotals);
    document.getElementById('freight').addEventListener('input', calculateTotals);
    document.getElementById('paid').addEventListener('input', calculateTotals);
}

// Load customers
async function loadCustomers() {
    try {
        console.log('🔄 Loading customers...');
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/parties?partyType=customer&limit=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('📥 Response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            customers = data.data || [];
            console.log('✅ Loaded customers:', customers.length);
            console.log('📋 Customers:', customers);

            const customerSelect = document.getElementById('customer');
            customerSelect.innerHTML = '<option value="">-- Select Customer --</option>';

            customers.forEach(customer => {
                console.log('Adding customer:', customer.name, customer._id);
                console.log('Customer object:', customer);

                // Create option element properly
                const option = document.createElement('option');
                option.value = customer._id;
                option.textContent = customer.name;
                customerSelect.appendChild(option);

                console.log('Option added - value:', option.value, 'text:', option.textContent);
            });

            console.log('✅ Customer dropdown populated');
            console.log('Total options:', customerSelect.options.length);
        } else {
            const error = await response.text();
            console.error('❌ Failed to load customers:', response.status, error);
        }
    } catch (error) {
        console.error('❌ Error loading customers:', error);
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

// Load categories
async function loadCategories() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/categories', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const categorySelect = document.getElementById('category');
            categorySelect.innerHTML = '<option value="">-- Select --</option>';

            if (data.data) {
                data.data.forEach(cat => {
                    categorySelect.innerHTML += `<option value="${cat._id}">${cat.name}</option>`;
                });
            }
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Generate invoice number
// Generate invoice number
async function generateInvoiceNumber() {
    try {
        console.log('🔄 Generating invoice number...');
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/sales?limit=1&sort=-createdAt', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const lastSale = data.data[0];
            let newInvoice = 'INV-001';

            // Check for both invoiceNumber (model) and invoiceNo (legacy)
            const lastInvoiceNo = lastSale ? (lastSale.invoiceNumber || lastSale.invoiceNo) : null;

            if (lastInvoiceNo) {
                const parts = lastInvoiceNo.split('-');
                if (parts.length === 2) {
                    const lastNumber = parseInt(parts[1]) || 0;
                    newInvoice = `INV-${String(lastNumber + 1).padStart(3, '0')}`;
                }
            }

            console.log('✅ Generated Invoice Number:', newInvoice);
            document.getElementById('invoiceNo').value = newInvoice;
        } else {
            console.error('❌ Failed to fetch last sale for invoice generation');
        }
    } catch (error) {
        console.error('❌ Error generating invoice number:', error);
        // Fallback
        document.getElementById('invoiceNo').value = 'INV-' + Date.now().toString().slice(-4);
    }
}

// Calculate item total
function calculateItemTotal() {
    const pack = parseFloat(document.getElementById('pack').value) || 0;
    const price = parseFloat(document.getElementById('price').value) || 0;
    const taxPercent = parseFloat(document.getElementById('taxPercent').value) || 0;
    const discPercent = parseFloat(document.getElementById('discPercent').value) || 0;

    const subtotal = pack * price;
    const taxAmount = (subtotal * taxPercent) / 100;
    const total = subtotal + taxAmount;
    const discAmount = (total * discPercent) / 100;
    const netTotal = total - discAmount;

    document.getElementById('itemTotal').value = total.toFixed(2);
    document.getElementById('taxRs').value = taxAmount.toFixed(2);
    document.getElementById('itemNetTotal').value = netTotal.toFixed(2);
}

// Add item to sale
function addItemToSale() {
    const itemId = document.getElementById('itemSelect').value;
    const itemCode = document.getElementById('itemCode').value;
    const pack = parseFloat(document.getElementById('pack').value) || 0;
    const price = parseFloat(document.getElementById('price').value) || 0;
    const taxPercent = parseFloat(document.getElementById('taxPercent').value) || 0;
    const discPercent = parseFloat(document.getElementById('discPercent').value) || 0;
    const incentive = parseFloat(document.getElementById('incentive').value) || 0;

    if (!itemId || pack <= 0) {
        showError('Please select an item and enter quantity');
        return;
    }

    const selectedItem = availableItems.find(item => item._id === itemId);
    if (!selectedItem) {
        showError('Item not found');
        return;
    }

    const subtotal = pack * price;
    const taxAmount = (subtotal * taxPercent) / 100;
    const total = subtotal + taxAmount;
    const discAmount = (total * discPercent) / 100;
    const netTotal = total - discAmount;

    const item = {
        id: itemId,
        code: itemCode,
        name: selectedItem.name,
        pack: pack,
        price: price,
        subtotal: subtotal,
        taxPercent: taxPercent,
        taxAmount: taxAmount,
        total: total,
        discPercent: discPercent,
        discAmount: discAmount,
        netTotal: netTotal,
        incentive: incentive
    };

    saleItems.push(item);
    updateItemsTable();
    clearItemFields();
    calculateTotals();
}

// Update items table
function updateItemsTable() {
    const tbody = document.getElementById('saleItemsBody');
    tbody.innerHTML = '';

    saleItems.forEach((item, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.code}</td>
            <td>${item.name}</td>
            <td class="text-right">${item.pack}</td>
            <td class="text-right">${item.price.toFixed(2)}</td>
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
    const totalSub = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
    const totalTaxRs = saleItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalAmount = saleItems.reduce((sum, item) => sum + item.total, 0);
    const totalDiscRs = saleItems.reduce((sum, item) => sum + item.discAmount, 0);
    const totalNet = saleItems.reduce((sum, item) => sum + item.netTotal, 0);

    document.getElementById('footerSub').textContent = totalSub.toFixed(2);
    document.getElementById('footerTaxRs').textContent = totalTaxRs.toFixed(2);
    document.getElementById('footerTotal').textContent = totalAmount.toFixed(2);
    document.getElementById('footerDiscRs').textContent = totalDiscRs.toFixed(2);
    document.getElementById('footerNetTotal').textContent = totalNet.toFixed(2);
}

// Remove item from sale
function removeItem(index) {
    saleItems.splice(index, 1);
    updateItemsTable();
    calculateTotals();
}

// Clear item fields
function clearItemFields() {
    document.getElementById('itemSelect').value = '';
    document.getElementById('itemCode').value = '';
    document.getElementById('pack').value = 1;
    document.getElementById('price').value = '';
    document.getElementById('stock').value = '';
    document.getElementById('taxPercent').value = 0;
    document.getElementById('taxRs').value = '';
    document.getElementById('itemTotal').value = '';
    document.getElementById('itemNetTotal').value = '';
    document.getElementById('incentive').value = 0;
    document.getElementById('discPercent').value = 0;
}

// Calculate totals
function calculateTotals() {
    const itemsTotal = saleItems.reduce((sum, item) => sum + item.netTotal, 0);
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

// Save sale
async function saveSale(status = 'final', printAfter = false) {
    try {
        if (saleItems.length === 0) {
            showError('Please add at least one item');
            return;
        }

        const customerId = document.getElementById('customer').value;

        // Debug: Show what we captured
        console.log('🔍 DEBUG: Customer ID captured:', customerId);
        console.log('🔍 DEBUG: Customer ID length:', customerId ? customerId.length : 0);
        console.log('🔍 DEBUG: Customer ID type:', typeof customerId);

        if (!customerId) {
            showError('Please select a customer');
            return;
        }

        console.log('Customer ID:', customerId);

        showLoading();

        const token = localStorage.getItem('token');
        const saleId = document.getElementById('saleId').value;

        // Calculate totals
        const itemsTotal = saleItems.reduce((sum, item) => sum + item.netTotal, 0);
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
            invoiceNumber: document.getElementById('invoiceNo').value,
            date: document.getElementById('saleDate').value,
            party: customerId,
            items: saleItems.map(item => ({
                item: item.id,
                quantity: item.pack,
                rate: item.price,
                amount: item.netTotal,
                taxAmount: (item.netTotal * item.taxPercent) / 100 || 0
            })),
            subtotal: subTotal,
            discountAmount: discountRs,
            taxAmount: taxAmount,
            totalAmount: netTotal,
            grandTotal: grandTotal,
            paidAmount: paid,
            balanceAmount: grandTotal - paid,
            paymentStatus: paid === 0 ? 'pending' : (paid >= grandTotal ? 'paid' : 'partial'),
            notes: document.getElementById('remarks').value,
            createdBy: null, // Will be set by backend from token
            status: status
        };

        console.log('Form Data to send:', formData);

        const url = saleId ? `/api/v1/sales/${saleId}` : '/api/v1/sales';
        const method = saleId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            const savedSale = await response.json();
            clearForm();
            loadSales(currentPage, currentLimit);
            showSuccess(status === 'draft' ? 'Sale saved as draft' : 'Sale saved successfully');

            if (printAfter) {
                printSale(savedSale._id || savedSale.data._id);
            }
        } else {
            const error = await response.json();
            showError(error.message || 'Failed to save sale');
        }
    } catch (error) {
        console.error('Error saving sale:', error);
        showError('Failed to save sale');
    } finally {
        hideLoading();
    }
}

// Load sales
async function loadSales(page = 1, limit = 10) {
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

        const response = await fetch(`/api/v1/sales${queryParams}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            displaySales(data.data);
            updatePagination(data.pagination);
        } else {
            throw new Error('Failed to load sales');
        }
    } catch (error) {
        console.error('Error loading sales:', error);
        showError('Failed to load sales');
    } finally {
        hideLoading();
    }
}

// Display sales
function displaySales(sales) {
    const tbody = document.getElementById('salesTableBody');

    if (!sales || sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No sales found</td></tr>';
        return;
    }

    tbody.innerHTML = sales.map(sale => `
        <tr>
            <td class="text-center">
                <button class="icon-btn" onclick="editSale('${sale._id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="icon-btn text-secondary" onclick="window.open('/print-invoice.html?type=sale&id=${sale._id}', '_blank')" title="Print">
                    <i class="fas fa-print"></i>
                </button>
            </td>
            <td>${sale.invoiceNumber || sale.invoiceNo}</td>
            <td>${formatDate(sale.date)}</td>
            <td>${sale.party?.name || sale.customer?.name || '-'}</td>
            <td>${sale.items?.length || 0} items</td>
            <td class="text-right">${(parseFloat(sale.totalAmount || sale.grandTotal) || 0).toFixed(2)}</td>
            <td class="text-center"><span class="badge badge-info">${sale.paymentStatus || 'pending'}</span></td>
            <td class="text-center">${getSaleStatusBadge(sale.status)}</td>
            <td class="text-center">
                <button class="icon-btn danger" onclick="deleteSaleById('${sale._id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Get sale status badge
function getSaleStatusBadge(status) {
    const badges = {
        draft: '<span class="badge badge-warning">Draft</span>',
        final: '<span class="badge badge-success">Final</span>',
        cancelled: '<span class="badge badge-danger">Cancelled</span>'
    };
    return badges[status] || badges.draft;
}

// Edit sale
async function editSale(saleId) {
    try {
        showLoading();

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/sales/${saleId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const responseData = await response.json();
            const sale = responseData.data || responseData;

            // Populate form
            document.getElementById('saleId').value = sale._id;
            document.getElementById('invoiceNo').value = sale.invoiceNumber || sale.invoiceNo;
            document.getElementById('saleDate').value = sale.date ? sale.date.split('T')[0] : '';

            // Handle party/customer field
            const partyId = sale.party?._id || sale.party || sale.customer?._id || sale.customer;
            document.getElementById('customer').value = partyId;

            document.getElementById('remarks').value = sale.notes || '';
            // Payment mode might be in transaction, assume cash for now if missing
            document.getElementById('paymentMode').value = sale.paymentMode || 'cash';

            document.getElementById('discountRs').value = sale.discountAmount || sale.discount || 0;
            // taxPercent might not be directly on sale anymore, inferred from items or stored?
            // Assuming it might be stored or 0.
            document.getElementById('totalTaxPercent').value = 0;

            document.getElementById('misc').value = 0; // misc/freight might not be in new model, set 0
            document.getElementById('freight').value = 0;
            document.getElementById('paid').value = sale.paidAmount || 0;

            // Load items
            saleItems = sale.items.map(item => ({
                id: item.item._id || item.item,
                code: item.item.sku || '', // SKU might need population? Backend populates items.item
                name: item.item.name || item.name || '',
                pack: item.quantity,
                price: item.rate || item.salePrice || 0,
                subtotal: (item.quantity * (item.rate || item.salePrice || 0)),
                taxPercent: 0, // Item tax percent?
                taxAmount: item.taxAmount || 0,
                // Total amount for item
                total: item.amount || item.total || 0,
                discPercent: 0,
                discAmount: 0,
                netTotal: item.amount || item.total || 0,
                incentive: 0
            }));

            updateItemsTable();
            calculateTotals();

            // Close the list modal
            hideList();

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            showSuccess('Sale loaded for editing');
        } else {
            showError('Failed to load sale data');
        }
    } catch (error) {
        console.error('Error loading sale data:', error);
        showError('Failed to load sale data');
    } finally {
        hideLoading();
    }
}

// Delete sale by ID
async function deleteSaleById(saleId) {
    if (!confirm('Are you sure you want to delete this sale?')) {
        return;
    }

    try {
        showLoading();

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/sales/${saleId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            loadSales(currentPage, currentLimit);
            showSuccess('Sale deleted successfully');
        } else {
            showError('Failed to delete sale');
        }
    } catch (error) {
        console.error('Error deleting sale:', error);
        showError('Failed to delete sale');
    } finally {
        hideLoading();
    }
}

// Delete current sale
function deleteSale() {
    const saleId = document.getElementById('saleId').value;
    if (saleId) {
        deleteSaleById(saleId);
    } else {
        showError('No sale selected to delete');
    }
}

// Clear form
function clearForm() {
    document.getElementById('saleForm').reset();
    document.getElementById('saleId').value = '';
    document.getElementById('saleDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('paymentMode').value = 'cash';
    saleItems = [];
    updateItemsTable();
    clearItemFields();
    calculateTotals();
    generateInvoiceNumber();
}

// Show sales list
function showSalesList() {
    const listModal = document.getElementById('listModal');
    const listModalOverlay = document.getElementById('listModalOverlay');

    if (listModal && listModalOverlay) {
        listModal.classList.add('active');
        listModalOverlay.classList.add('active');

        // Load sales data
        loadSales(currentPage, currentLimit);
    }
}

// Hide sales list
function hideList() {
    const listModal = document.getElementById('listModal');
    const listModalOverlay = document.getElementById('listModalOverlay');

    if (listModal && listModalOverlay) {
        listModal.classList.remove('active');
        listModalOverlay.classList.remove('active');
    }
}

// Print sale
function printSale(saleId) {
    if (!saleId) {
        saleId = document.getElementById('saleId').value;
    }
    if (saleId) {
        window.print();
    } else {
        showError('No sale to print');
    }
}

// Search invoice
function searchInvoice() {
    const invoice = prompt('Enter invoice number:');
    if (invoice) {
        document.getElementById('searchInput').value = invoice;
        loadSales();
    }
}

// Handle search
function handleSearch() {
    loadSales(1, currentLimit);
}

// Reset filters
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('statusFilter').value = '';
    loadSales(1, currentLimit);
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
        html += `<button class="btn btn-sm btn-secondary" onclick="loadSales(${pagination.prev.page}, ${currentLimit})">
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
        html += `<button class="btn btn-sm btn-secondary" onclick="loadSales(${pagination.next.page}, ${currentLimit})">
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
function openCustomerModal() {
    showInfo('Customer quick add will be implemented');
}

function openItemModal() {
    showInfo('Item quick add will be implemented');
}

function showCustomerList() {
    window.location.href = '/parties.html';
}

function showItemList() {
    window.location.href = '/items.html';
}
