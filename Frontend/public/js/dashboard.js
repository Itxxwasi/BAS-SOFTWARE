// Dashboard JavaScript
let currentDateFilter = 'month';
let currentFromDate = '';
let currentToDate = '';
let salesChart = null;
let categoryChart = null;

document.addEventListener('DOMContentLoaded', function () {
    // Check if user is authenticated (handled by pageAccess.js)
    // Set user name in navbar
    setUserName();

    // Initialize role-based menu
    initializeRoleBasedMenu();

    // Set up logout functionality
    setupLogout();

    // Set default date range (current month)
    setDateFilter('month');
});

// Set user name in navbar
function setUserName() {
    const user = getCurrentUser();
    const userNameElement = document.getElementById('userName');
    if (userNameElement && user) {
        userNameElement.textContent = user.name || user.email;
    }
}

// Initialize role-based menu
function initializeRoleBasedMenu() {
    const user = getCurrentUser();
    if (!user) return;

    const userRole = user.role;
    const menuItems = document.querySelectorAll('[data-role]');

    menuItems.forEach(item => {
        const allowedRoles = item.getAttribute('data-role').split(',');
        if (allowedRoles.includes(userRole)) {
            item.style.display = 'block';
        }
    });

    // Update active menu item
    updateActiveMenuItem();
}

// Update active menu item based on current page
function updateActiveMenuItem() {
    const currentPath = window.location.pathname;
    const menuLinks = document.querySelectorAll('.nav-link');

    menuLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPath.split('/').pop()) {
            link.classList.add('active');
        }
    });
}

// Setup logout functionality
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function (e) {
            e.preventDefault();

            if (confirm('Are you sure you want to logout?')) {
                await window.pageAccess.logout();
            }
        });
    }
}

// Set date filter
function setDateFilter(filter) {
    currentDateFilter = filter;

    // Update button states
    document.querySelectorAll('.date-filter-pills .nav-link').forEach(btn => {
        btn.classList.remove('active');
    });
    // Find the button that was clicked or matches the filter
    const clickedBtn = event ? event.target.closest('.nav-link') : document.querySelector(`.date-filter-pills .nav-link[data-filter="${filter}"]`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }

    const today = new Date();
    let fromDate, toDate;

    switch (filter) {
        case 'today':
            fromDate = toDate = today.toISOString().split('T')[0];
            document.getElementById('customDateRange').style.display = 'none';
            break;
        case 'week':
            const weekStart = new Date(today);
            const day = today.getDay(); // 0 (Sunday) to 6 (Saturday)
            // If today is Sunday (0), go back 6 days to last Monday. If Mon-Sat, go back day-1 days.
            // Adjust to start on Monday or Last 7 days? Let's use Last 7 Days for "This Week" relative to now, or Start of Week (Monday)
            // Let's go with Start of Week (assuming Monday start)
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            weekStart.setDate(diff);
            fromDate = weekStart.toISOString().split('T')[0];
            toDate = today.toISOString().split('T')[0];
            document.getElementById('customDateRange').style.display = 'none';
            break;
        case 'month':
            fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            toDate = today.toISOString().split('T')[0];
            document.getElementById('customDateRange').style.display = 'none';
            break;
        case 'custom':
            document.getElementById('customDateRange').style.display = 'block';
            document.getElementById('fromDate').value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            document.getElementById('toDate').value = today.toISOString().split('T')[0];
            return; // Don't load data yet, wait for user to apply
    }

    currentFromDate = fromDate;
    currentToDate = toDate;

    // Load dashboard with new dates
    initDashboard();
}

// Apply custom date filter
function applyCustomDateFilter() {
    currentFromDate = document.getElementById('fromDate').value;
    currentToDate = document.getElementById('toDate').value;

    if (!currentFromDate || !currentToDate) {
        alert('Please select both from and to dates');
        return;
    }

    initDashboard();
}

// Refresh dashboard
function refreshDashboard() {
    initDashboard();
}

// Initialize dashboard
async function initDashboard() {
    try {
        // Load dashboard statistics
        await loadDashboardStats();

        // Load recent transactions
        await loadRecentTransactions();

        // Initialize charts
        await initCharts();

    } catch (error) {
        console.error('Dashboard initialization error:', error);
        alert('Failed to load dashboard data');
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const token = localStorage.getItem('token');

        // Load sales
        const salesResponse = await fetch(`/api/v1/sales?startDate=${currentFromDate}&endDate=${currentToDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (salesResponse.ok) {
            const salesData = await salesResponse.json();
            const totalSales = salesData.data ? salesData.data.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0) : 0;
            document.getElementById('todaySales').textContent = totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        // Load purchases
        const purchasesResponse = await fetch(`/api/v1/purchases?startDate=${currentFromDate}&endDate=${currentToDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (purchasesResponse.ok) {
            const purchasesData = await purchasesResponse.json();
            const totalPurchases = purchasesData.data ? purchasesData.data.reduce((sum, purchase) => sum + (purchase.grandTotal || 0), 0) : 0;
            document.getElementById('todayPurchases').textContent = totalPurchases.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        // Load customer count
        const customersResponse = await fetch('/api/v1/parties?partyType=customer', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (customersResponse.ok) {
            const customersData = await customersResponse.json();
            document.getElementById('totalCustomers').textContent = customersData.data ? customersData.data.length : 0;
        }

        // Load low stock items
        const itemsResponse = await fetch('/api/v1/items', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            const lowStock = itemsData.data ? itemsData.data.filter(item => (item.currentStock || 0) < (item.minStock || 10)) : [];
            document.getElementById('lowStockItems').textContent = lowStock.length;
        }

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        throw error;
    }
}

// Load recent transactions
async function loadRecentTransactions() {
    try {
        const token = localStorage.getItem('token');

        // Load recent sales
        const salesResponse = await fetch(`/api/v1/sales?startDate=${currentFromDate}&endDate=${currentToDate}&limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (salesResponse.ok) {
            const salesData = await salesResponse.json();
            displayRecentSales(salesData.data || []);
        }

        // Load recent purchases
        const purchasesResponse = await fetch(`/api/v1/purchases?startDate=${currentFromDate}&endDate=${currentToDate}&limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (purchasesResponse.ok) {
            const purchasesData = await purchasesResponse.json();
            displayRecentPurchases(purchasesData.data || []);
        }

    } catch (error) {
        console.error('Error loading recent transactions:', error);
        throw error;
    }
}

// Display recent sales
function displayRecentSales(sales) {
    const tbody = document.getElementById('recentSales');

    if (!sales || sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No recent sales</td></tr>';
        return;
    }

    tbody.innerHTML = sales.map(sale => `
        <tr>
            <td>${sale.invoiceNo || sale.invoiceNumber || '-'}</td>
            <td>${new Date(sale.date).toLocaleDateString()}</td>
            <td>${sale.customer?.name || sale.partyName || sale.party?.name || '-'}</td>
            <td>${(sale.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td><span class="badge bg-success">Completed</span></td>
        </tr>
    `).join('');
}

// Display recent purchases
function displayRecentPurchases(purchases) {
    const tbody = document.getElementById('recentPurchases');

    if (!purchases || purchases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No recent purchases</td></tr>';
        return;
    }

    tbody.innerHTML = purchases.map(purchase => `
        <tr>
            <td>${purchase.invoiceNo || '-'}</td>
            <td>${new Date(purchase.date).toLocaleDateString()}</td>
            <td>${purchase.supplier?.name || purchase.partyName || purchase.party?.name || '-'}</td>
            <td>${(purchase.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td><span class="badge bg-success">Received</span></td>
        </tr>
    `).join('');
}

// Initialize charts
async function initCharts() {
    try {
        const token = localStorage.getItem('token');

        // Destroy existing charts
        if (salesChart) salesChart.destroy();
        if (categoryChart) categoryChart.destroy();

        // Load sales data for chart
        const salesResponse = await fetch(`/api/v1/sales?startDate=${currentFromDate}&endDate=${currentToDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let salesByDate = {};
        if (salesResponse.ok) {
            const salesData = await salesResponse.json();
            if (salesData.data) {
                salesData.data.forEach(sale => {
                    const date = new Date(sale.date).toLocaleDateString();
                    salesByDate[date] = (salesByDate[date] || 0) + (sale.grandTotal || 0);
                });
            }
        }

        const labels = Object.keys(salesByDate).slice(-7); // Last 7 days
        const data = labels.map(label => salesByDate[label] || 0);

        // Sales chart
        const salesCtx = document.getElementById('salesChart').getContext('2d');
        salesChart = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['No Data'],
                datasets: [{
                    label: 'Sales',
                    data: data.length > 0 ? data : [0],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Sales Trend'
                    }
                }
            }
        });

        // Category distribution chart (placeholder data)
        const categoryCtx = document.getElementById('categoryChart').getContext('2d');
        categoryChart = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: ['Sales', 'Purchases', 'Returns', 'Other'],
                datasets: [{
                    data: [40, 30, 20, 10],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)'
                    ],
                    borderColor: [
                        'rgb(255, 99, 132)',
                        'rgb(54, 162, 235)',
                        'rgb(255, 206, 86)',
                        'rgb(75, 192, 192)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: 'Transaction Distribution'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}

// Change chart period
function changeChartPeriod(period) {
    setDateFilter(period);
}
