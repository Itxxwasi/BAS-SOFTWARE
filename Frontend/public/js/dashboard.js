// Dashboard JavaScript - Professional Upgrade
let currentDateFilter = 'month';
let currentFromDate = '';
let currentToDate = '';
let salesChart = null;

document.addEventListener('DOMContentLoaded', function () {
    // Check auth
    if (window.pageAccess && typeof window.pageAccess.checkAuthentication === 'function') {
        if (!window.pageAccess.checkAuthentication()) return;
    } else {
        // Fallback or skip if pageAccess not loaded yet (rare)
        console.warn('pageAccess not loaded');
    }

    // Set user name
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (document.getElementById('userName')) {
        document.getElementById('userName').textContent = user.name || 'User';
    }

    // Initialize with Month filter
    setDateFilter('month');
});

function setDateFilter(filter) {
    currentDateFilter = filter;

    // Update UI
    document.querySelectorAll('.date-filter-pills .nav-link').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.date-filter-pills .nav-link[data-filter="${filter}"]`).classList.add('active');

    const today = new Date();
    let fromDate, toDate;

    switch (filter) {
        case 'today':
            fromDate = new Date(today);
            toDate = new Date(today);
            break;
        case 'week':
            // Start of week (Monday)
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            fromDate = new Date(today.setDate(diff));
            toDate = new Date(); // Up to now
            break;
        case 'month':
            fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
            toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'custom':
            document.getElementById('customDateRange').classList.remove('d-none');
            return; // Wait for apply
    }

    if (filter !== 'custom') {
        document.getElementById('customDateRange').classList.add('d-none');
        currentFromDate = formatDateForAPI(fromDate);
        currentToDate = formatDateForAPI(toDate);
        refreshDashboard();
    }
}

function applyCustomDateFilter() {
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    if (!from || !to) {
        alert('Please select both dates');
        return;
    }
    currentFromDate = from;
    currentToDate = to;
    refreshDashboard();
}

function formatDateForAPI(date) {
    return date.toISOString().split('T')[0];
}

async function refreshDashboard() {
    const container = document.getElementById('branchCardsContainer');
    const catContainer = document.getElementById('categoryBreakdownContainer');

    container.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Loading Data...</p>
        </div>
    `;
    if (catContainer) catContainer.innerHTML = '<div class="text-center py-3 text-muted">Loading Categories...</div>';

    try {
        await loadDashboardData();
    } catch (error) {
        console.error("Dashboard Load Error", error);
        container.innerHTML = `<div class="col-12 text-center text-danger py-5">Failed to load data: ${error.message}</div>`;
    }
}

async function loadDashboardData() {
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const limit = 10000;

    // Fetch Stores to filter visible branches
    const storeRes = await fetch('/api/v1/stores', { headers });
    const storeData = await storeRes.json();
    const enabledStores = (storeData.data || []).filter(s => s.showOnDashboard);

    // Populate branch filter dropdown
    const branchFilter = document.getElementById('dashboardBranchFilter');
    if (branchFilter && branchFilter.options.length === 1) { // Only populate once
        enabledStores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.name;
            option.textContent = store.name;
            branchFilter.appendChild(option);
        });
    }

    // Get selected branch filter
    const selectedBranch = branchFilter ? branchFilter.value : 'all';

    // Normalization Logic for fuzzy matching (e.g. "PWD - 1" vs "PWD 1")
    const normalize = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const branchNameMap = new Map(); // normalized -> original name

    // If specific branch selected, only map that branch
    if (selectedBranch !== 'all') {
        const selectedStore = enabledStores.find(s => s.name === selectedBranch);
        if (selectedStore) {
            branchNameMap.set(normalize(selectedStore.name), selectedStore.name);
        }
    } else {
        // Map all enabled stores
        enabledStores.forEach(s => {
            branchNameMap.set(normalize(s.name), s.name);
        });
    }

    // Fetch Departments (for Mapping)
    const deptRes = await fetch('/api/v1/departments', { headers });
    const deptData = await deptRes.json();
    const departmentsMap = {}; // ID -> Name
    (deptData.data || []).forEach(d => departmentsMap[d._id] = d.name);

    // Fetch Warehouse Categories (for Breakdown) + New requirement: Use Warehouse Sale Categories instead of Departments
    const catRes = await fetch('/api/v1/customer-categories', { headers });
    const catData = await catRes.json();
    const warehouseCatsMap = {}; // ID -> Name
    (catData.data || []).forEach(c => warehouseCatsMap[c._id] = c.name);

    // 1. Fetch Closing Sheets (Sales Data)
    const sheetsRes = await fetch(`/api/v1/closing-sheets/report?startDate=${currentFromDate}&endDate=${currentToDate}&branch=all`, { headers });
    const sheetsData = await sheetsRes.json();
    const sheets = sheetsData.data || [];

    // 2. Fetch Purchases (Cost Data)
    const purchRes = await fetch(`/api/v1/purchases?startDate=${currentFromDate}&endDate=${currentToDate}&limit=${limit}`, { headers });
    const purchData = await purchRes.json();
    const purchases = purchData.data || [];

    // 3. Fetch Expenses (Cost Data)
    const expRes = await fetch(`/api/v1/expenses?startDate=${currentFromDate}&endDate=${currentToDate}&limit=${limit}`, { headers });
    const expData = await expRes.json();
    const expenses = expData.data || [];

    // 4. Fetch Vouchers (Payment Data)
    const vouchRes = await fetch(`/api/v1/vouchers?startDate=${currentFromDate}&endDate=${currentToDate}&limit=${limit}`, { headers });
    const vouchData = await vouchRes.json();
    const vouchers = vouchData.data || [];

    // --- Aggregate Data by Branch (Top Section) ---
    const branchStats = {};
    const getBranchObj = (name) => {
        if (!branchStats[name]) {
            branchStats[name] = {
                name: name,
                grossSale: 0,
                discountVal: 0,
                returnVal: 0,
                gst: 0,
                netSale: 0,
                cost: 0,
                daysCount: new Set()
            };
        }
        return branchStats[name];
    };

    // Initialize all enabled branches first (so they show up even with 0 sales)
    enabledStores.forEach(store => {
        getBranchObj(store.name);
    });

    sheets.forEach(sheet => {
        const rawName = sheet.branch || 'Unknown';
        const targetBranchName = branchNameMap.get(normalize(rawName));

        if (!targetBranchName) return; // Filter: Skip if not mapped to an enabled store

        const b = getBranchObj(targetBranchName);
        b.daysCount.add(sheet.date.split('T')[0]);

        if (sheet.closing02) {
            // Main Card Totals still come from Departmental Sums (as per previous instructions)
            // Or should they come from Warehouse Sale? 
            // "1 day sale is pwd" refers to the Total column in Closing 2 Dept Table.
            // So MAIN CARDS use DEPT TOTALS.
            const dataObj = sheet.closing02.data || sheet.closing02; // Fallback for structure variations
            if (!dataObj) return;

            Object.values(dataObj).forEach(val => {
                // Check if it looks like a dept object (has sale/discount properties)
                if (val && typeof val === 'object' && (val.totalSaleComputer !== undefined || val.netSale !== undefined)) {
                    const sale = parseFloat(val.totalSaleComputer || val.grossSale || val.netSale || 0);
                    const disc = parseFloat(val.discountValue || 0);
                    b.netSale += sale;
                    b.discountVal += disc;
                    if (val.grossSale) {
                        b.grossSale += parseFloat(val.grossSale);
                    } else {
                        b.grossSale += (sale + disc);
                    }
                }
            });
        }
    });

    // Purchases/Expenses to Branch Cost
    purchases.forEach(p => {
        const rawName = p.branch || 'Head Office';
        const targetBranchName = branchNameMap.get(normalize(rawName));
        if (!targetBranchName) return;

        const b = getBranchObj(targetBranchName);
        b.cost += (p.grandTotal || 0);
    });
    expenses.forEach(e => {
        const rawName = e.branch || 'Head Office';
        const targetBranchName = branchNameMap.get(normalize(rawName));
        if (!targetBranchName) return;

        const b = getBranchObj(targetBranchName);
        b.cost += (e.amount || 0);
    });

    const finalBranchData = Object.values(branchStats).map(b => {
        const profit = b.netSale - b.cost;
        return {
            ...b,
            profit: profit,
            margin: b.netSale > 0 ? (profit / b.netSale) * 100 : 0,
            discPct: b.grossSale > 0 ? (b.discountVal / b.grossSale) * 100 : 0,
            avgDailySale: b.netSale / (b.daysCount.size || 1)
        };
    });
    finalBranchData.sort((a, b) => b.netSale - a.netSale);

    renderBranchCards(finalBranchData);
    renderSalesChart(finalBranchData);
    renderBranchTable(finalBranchData);

    // --- Process Category Breakdown (Warehouse Sale) ---
    // Ensure the container exists in HTML or cleared properly
    if (document.getElementById('categoryBreakdownContainer')) {
        processAndRenderCategoryBreakdown(sheets, warehouseCatsMap, branchNameMap);
    } else {
        console.warn("categoryBreakdownContainer not found");
    }

    // --- Process Payment Section ---
    processPaymentSection(sheets, expenses, warehouseCatsMap, branchNameMap);
}

let paymentDataCache = []; // Store calculated data for filtering

function processPaymentSection(sheets, expenses, categoriesMap, branchNameMap) {
    const normalize = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const allowedBranchList = Array.from(new Set(branchNameMap.values()));

    // Structure: Map<CategoryName, Map<BranchName, {sale, cost, payment}>>
    const stats = {};

    // Initialize with warehouse categories (customer categories) only
    Object.values(categoriesMap).forEach(catName => {
        stats[catName] = {};
        allowedBranchList.forEach(b => {
            stats[catName][b] = { branch: b, sale: 0, cost: 0, payment: 0 };
        });
    });

    // Fill Sale/Cost from warehouse categories
    sheets.forEach(sheet => {
        const rawName = sheet.branch || 'Unknown';
        const targetBranchName = branchNameMap.get(normalize(rawName));
        if (!targetBranchName) return;

        const dataObj = sheet.closing02?.data || sheet.closing02;
        if (dataObj && dataObj.warehouseSale && Array.isArray(dataObj.warehouseSale)) {
            dataObj.warehouseSale.forEach(item => {
                const catName = categoriesMap[item.category];
                if (!catName) return;

                if (!stats[catName]) {
                    stats[catName] = {};
                    allowedBranchList.forEach(b => {
                        stats[catName][b] = { branch: b, sale: 0, cost: 0, payment: 0 };
                    });
                }

                if (!stats[catName][targetBranchName]) {
                    stats[catName][targetBranchName] = { branch: targetBranchName, sale: 0, cost: 0, payment: 0 };
                }

                stats[catName][targetBranchName].sale += parseFloat(item.sale || 0);
                stats[catName][targetBranchName].cost += parseFloat(item.cost || 0);
            });
        }
    });

    // Fill Payments from Expenses - Match expense head to warehouse category name
    console.log('=== Processing Expenses for Payments ===');
    console.log('Total expenses:', expenses.length);
    console.log('Available categories:', Object.values(categoriesMap));

    expenses.forEach(exp => {
        const rawName = exp.branch || 'Unknown';
        const targetBranchName = branchNameMap.get(normalize(rawName));
        if (!targetBranchName) return;

        // Match expense head to customer category name
        const expenseHead = exp.head;
        if (!expenseHead) return;

        console.log(`Trying to match expense: "${expenseHead}" (${exp.amount}) from branch ${targetBranchName}`);

        // Find matching category (exact match or contains)
        const matchingCategory = Object.values(categoriesMap).find(catName => {
            return normalize(catName) === normalize(expenseHead) ||
                normalize(expenseHead).includes(normalize(catName)) ||
                normalize(catName).includes(normalize(expenseHead));
        });

        if (matchingCategory && stats[matchingCategory] && stats[matchingCategory][targetBranchName]) {
            console.log(`✓ Matched to category: "${matchingCategory}"`);
            stats[matchingCategory][targetBranchName].payment += (exp.amount || 0);
        } else {
            console.log(`✗ No match found for "${expenseHead}"`);
        }
    });

    console.log('=== Payment Stats After Processing ===', stats);

    paymentDataCache = stats;

    // Populate Dropdowns
    populatePaymentFilters(stats, allowedBranchList);
    renderPaymentUI();
}

function populatePaymentFilters(stats, branches) {
    // Populate Branch Filter
    const branchFilter = document.getElementById('paymentBranchFilter');
    if (branchFilter) {
        const currentBranch = branchFilter.value;
        branchFilter.innerHTML = '<option value="all">All Branches</option>';
        branches.forEach(b => {
            branchFilter.innerHTML += `<option value="${b}">${b}</option>`;
        });
        if (currentBranch) branchFilter.value = currentBranch;
        branchFilter.onchange = renderPaymentUI;
    }

    // Populate Category Filter
    const categoryFilter = document.getElementById('paymentCategoryFilter');
    if (categoryFilter) {
        const currentCat = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="all">All Categories</option>';
        Object.keys(stats).sort().forEach(c => {
            categoryFilter.innerHTML += `<option value="${c}">${c}</option>`;
        });
        if (currentCat && stats[currentCat]) categoryFilter.value = currentCat;
        categoryFilter.onchange = renderPaymentUI;
    }
}

function renderPaymentUI() {
    const branchFilter = document.getElementById('paymentBranchFilter');
    const categoryFilter = document.getElementById('paymentCategoryFilter');
    const container = document.getElementById('paymentCategoryBreakdown');

    if (!container || !paymentDataCache || Object.keys(paymentDataCache).length === 0) {
        if (container) container.innerHTML = '<div class="text-center text-muted py-3">No payment data available</div>';
        return;
    }

    const selectedBranch = branchFilter ? branchFilter.value : 'all';
    const selectedCategory = categoryFilter ? categoryFilter.value : 'all';

    let totalSale = 0, totalCost = 0, totalPayment = 0;
    let html = '';

    // Filter categories
    const categoriesToShow = selectedCategory === 'all' ?
        Object.keys(paymentDataCache).sort() :
        [selectedCategory];

    categoriesToShow.forEach(catName => {
        const branchMap = paymentDataCache[catName];
        if (!branchMap) return;

        let catSale = 0, catCost = 0, catPayment = 0;
        let branchRows = '';

        // Filter and aggregate branches
        const branchesToShow = selectedBranch === 'all' ?
            Object.values(branchMap) :
            Object.values(branchMap).filter(b => b.branch === selectedBranch);

        const sortedBranches = branchesToShow.sort((a, b) => b.sale - a.sale);

        sortedBranches.forEach((b, idx) => {
            if (b.sale === 0 && b.cost === 0 && b.payment === 0) return; // Skip empty rows

            catSale += b.sale;
            catCost += b.cost;
            catPayment += b.payment;

            const balance = b.cost - b.payment;

            branchRows += `
                <tr>
                    <td class="text-center fw-bold">${idx + 1}</td>
                    <td>${b.branch}</td>
                    <td class="text-end">${formatCurrency(b.sale)}</td>
                    <td class="text-end">${formatCurrency(b.cost)}</td>
                    <td class="text-end">${formatCurrency(b.payment)}</td>
                    <td class="text-end fw-bold ${balance > 0 ? 'text-danger' : 'text-success'}">${formatCurrency(balance)}</td>
                </tr>
            `;
        });

        if (branchRows) {
            totalSale += catSale;
            totalCost += catCost;
            totalPayment += catPayment;

            const catBalance = catCost - catPayment;

            html += `
                <div class="category-detail-card mb-3">
                    <div class="category-header" style="background-color: #0288d1;">
                        <i class="fas fa-box me-2"></i> ${catName}
                    </div>
                    <div class="table-responsive">
                        <table class="table table-hover table-sm mb-0">
                            <thead class="bg-light">
                                <tr>
                                    <th width="5%" class="text-center">Rank</th>
                                    <th>Branch</th>
                                    <th class="text-end">Sale</th>
                                    <th class="text-end">Cost</th>
                                    <th class="text-end">Category Payments</th>
                                    <th class="text-end">Balance Payment</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${branchRows}
                                <tr class="grand-total-row">
                                    <td colspan="2" class="text-center fw-bold">Grand Total</td>
                                    <td class="text-end fw-bold">${formatCurrency(catSale)}</td>
                                    <td class="text-end fw-bold">${formatCurrency(catCost)}</td>
                                    <td class="text-end fw-bold">${formatCurrency(catPayment)}</td>
                                    <td class="text-end fw-bold">${formatCurrency(catBalance)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    });

    if (!html) {
        html = '<div class="text-center text-muted py-3">No data for selected filters</div>';
    }

    container.innerHTML = html;

    // Update stat cards
    const totalBalance = totalCost - totalPayment;
    document.getElementById('payStatSale').textContent = formatCurrency(totalSale);
    document.getElementById('payStatCost').textContent = formatCurrency(totalCost);
    document.getElementById('payStatPayment').textContent = formatCurrency(totalPayment);
    document.getElementById('payStatBalance').textContent = formatCurrency(totalBalance);
}

function refreshPaymentData() {
    refreshDashboard();
}

function processAndRenderCategoryBreakdown(sheets, categoriesMap, branchNameMap) {
    // Normalization Logic
    const normalize = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    console.log('=== Processing Category Breakdown ===');
    console.log('Total closing sheets:', sheets.length);
    console.log('Available categories:', Object.values(categoriesMap));

    // Map<CategoryName, Map<BranchName, {netSale, cost}>>
    const catStats = {};

    // 1. Initialize stats for all known Categories and allowed branches
    const allowedBranchList = Array.from(new Set(branchNameMap.values()));

    Object.values(categoriesMap).forEach(catName => {
        catStats[catName] = {};
        allowedBranchList.forEach(branchName => {
            catStats[catName][branchName] = {
                branch: branchName,
                netSale: 0,
                cost: 0
            };
        });
    });

    // 2. Populate with Data from Warehouse Sale
    sheets.forEach(sheet => {
        const rawName = sheet.branch || 'Unknown';
        const targetBranchName = branchNameMap.get(normalize(rawName));

        if (!targetBranchName) return; // Filter check

        // Check for warehouseSale data in closing02.data
        const dataObj = sheet.closing02?.data || sheet.closing02;

        console.log(`Sheet for branch ${rawName}:`, {
            hasClosing02: !!sheet.closing02,
            hasData: !!dataObj,
            hasWarehouseSale: !!(dataObj && dataObj.warehouseSale),
            warehouseSaleLength: dataObj?.warehouseSale?.length || 0,
            warehouseSale: dataObj?.warehouseSale
        });

        if (dataObj && dataObj.warehouseSale && Array.isArray(dataObj.warehouseSale)) {
            console.log(`Processing ${dataObj.warehouseSale.length} warehouse sale items for ${targetBranchName}`);

            dataObj.warehouseSale.forEach(item => {
                const catName = categoriesMap[item.category];
                console.log(`Warehouse item:`, {
                    categoryId: item.category,
                    categoryName: catName,
                    sale: item.sale,
                    cost: item.cost
                });

                if (!catName) return; // Unknown category

                // Initialize if missing (e.g. if category list changed)
                if (!catStats[catName]) {
                    catStats[catName] = {};
                    allowedBranchList.forEach(b => {
                        catStats[catName][b] = { branch: b, netSale: 0, cost: 0 };
                    });
                }

                if (catStats[catName][targetBranchName]) {
                    catStats[catName][targetBranchName].netSale += parseFloat(item.sale || 0);
                    catStats[catName][targetBranchName].cost += parseFloat(item.cost || 0);
                    console.log(`Added to ${catName} - ${targetBranchName}: Sale ${item.sale}, Cost ${item.cost}`);
                }
            });
        } else {
            console.log(`No warehouse sale data found for ${rawName}`);
        }
    });

    console.log('=== Final Category Stats ===', catStats);

    // Departments/Categories to display
    const sortedCats = Object.entries(catStats).map(([name, branches]) => {
        const totalSale = Object.values(branches).reduce((sum, b) => sum + b.netSale, 0);
        return { name, branches, totalSale };
    }).sort((a, b) => b.totalSale - a.totalSale);


    renderCategoryCards(sortedCats);
    renderCategoryBreakdown(sortedCats);
}

function renderCategoryCards(categories) {
    const container = document.getElementById('categoryCardsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (categories.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted">No category data</div>';
        return;
    }

    categories.forEach(cat => {
        // Aggregate totals for the card
        let tSale = 0, tCost = 0;
        Object.values(cat.branches).forEach(b => {
            tSale += b.netSale;
            tCost += b.cost;
        });
        const tProfit = tSale - tCost;
        const margin = tSale > 0 ? (tProfit / tSale) * 100 : 0;

        const cardHtml = `
            <div class="col-xl-3 col-md-6 mb-4">
                <div class="branch-card">
                    <div class="branch-card-header" style="background: linear-gradient(45deg, #0288d1, #26c6da);">
                        ${cat.name}
                    </div>
                    <div class="branch-card-body">
                        <div class="stat-box red">
                            <span class="stat-label"><i class="fas fa-shopping-cart"></i> TOTAL SALE</span>
                            <span class="stat-value">${formatCurrency(tSale)}</span>
                        </div>
                        <div class="stat-box blue">
                            <span class="stat-label"><i class="fas fa-money-bill-wave"></i> TOTAL COST</span>
                            <span class="stat-value">${formatCurrency(tCost)}</span>
                        </div>
                        <div class="stat-box green">
                            <span class="stat-label"><i class="fas fa-chart-line"></i> TOTAL PROFIT</span>
                            <span class="stat-value">${formatCurrency(tProfit)}</span>
                        </div>
                         <div class="stat-box dark">
                            <span class="stat-label"><i class="fas fa-percentage"></i> MARGIN</span>
                            <span class="stat-value">${margin.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
}

function renderCategoryBreakdown(categories) {
    const container = document.getElementById('categoryBreakdownContainer');
    if (!container) return;
    container.innerHTML = '';

    if (categories.length === 0) {
        container.innerHTML = '<div class="text-center text-muted">No category data available</div>';
        return;
    }

    categories.forEach(cat => {
        // Prepare branch list for this category
        const branchList = Object.values(cat.branches).sort((a, b) => b.netSale - a.netSale);

        let tableRows = '';
        let tSale = 0, tCost = 0, tProfit = 0;

        branchList.forEach((b, idx) => {
            const margin = b.netSale > 0 ? ((b.netSale - b.cost) / b.netSale) * 100 : 0; // Cost is 0 so margin 100%?
            // If cost is 0, Profit = Sale. Margin = 100%. 
            // Display Cost/Profit only if meaningful? The Image shows them.
            // I'll display 0 for cost and Sale for profit if cost missing, but maybe "-" is better.

            tSale += b.netSale;
            tCost += b.cost;
            tProfit += (b.netSale - b.cost);

            tableRows += `
                <tr>
                    <td class="text-center fw-bold">${idx + 1}</td>
                    <td>${b.branch}</td>
                    <td class="text-end">${formatCurrency(b.netSale)}</td>
                    <td class="text-end">${b.cost > 0 ? formatCurrency(b.cost) : '-'}</td>
                    <td class="text-end text-success">${formatCurrency(b.netSale - b.cost)}</td>
                    <td class="text-end"><span class="badge bg-success">${margin.toFixed(1)}%</span></td>
                </tr>
            `;
        });

        // Grand total for Category
        const totalMargin = tSale > 0 ? (tProfit / tSale) * 100 : 0;

        const cardHtml = `
            <div class="category-detail-card">
                <div class="category-header">
                     <i class="fas fa-cubes"></i> ${cat.name}
                </div>
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead class="bg-light">
                            <tr>
                                <th width="5%" class="text-center">Rank</th>
                                <th>Branch</th>
                                <th class="text-end">Sales</th>
                                <th class="text-end">Cost</th>
                                <th class="text-end">Profit</th>
                                <th class="text-end">Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                            <tr class="grand-total-row">
                                <td colspan="2" class="text-center">Grand Total</td>
                                <td class="text-end">${formatCurrency(tSale)}</td>
                                <td class="text-end">${tCost > 0 ? formatCurrency(tCost) : '-'}</td>
                                <td class="text-end">${formatCurrency(tProfit)}</td>
                                <td class="text-end"><span class="badge bg-success">${totalMargin.toFixed(1)}%</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
}

function renderBranchCards(data) {
    const container = document.getElementById('branchCardsContainer');
    container.innerHTML = '';

    data.forEach(b => {
        const cardHtml = `
            <div class="col-xl-3 col-md-6 mb-4">
                <div class="branch-card">
                    <div class="branch-card-header">
                        ${b.name}
                    </div>
                    <div class="branch-card-body">
                        <div class="stat-box red">
                            <span class="stat-label"><i class="fas fa-shopping-cart"></i> TOTAL SALE</span>
                            <span class="stat-value">${formatCurrency(b.netSale)}</span>
                        </div>
                        <div class="stat-box blue">
                            <span class="stat-label"><i class="fas fa-money-bill-wave"></i> TOTAL COST</span>
                            <span class="stat-value">${formatCurrency(b.cost)}</span>
                        </div>
                        <div class="stat-box green">
                            <span class="stat-label"><i class="fas fa-chart-line"></i> TOTAL PROFIT</span>
                            <span class="stat-value">${formatCurrency(b.profit)}</span>
                        </div>
                        <div class="stat-box yellow">
                            <span class="stat-label"><i class="fas fa-tags"></i> BRANCH DISC %</span>
                            <span class="stat-value">${b.discPct.toFixed(1)}%</span>
                        </div>
                        <div class="stat-box dark">
                            <span class="stat-label"><i class="fas fa-percentage"></i> MARGIN</span>
                            <span class="stat-value">${b.margin.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
}

function renderSalesChart(data) {
    const ctx = document.getElementById('salesChart').getContext('2d');

    const labels = data.map(d => d.name);
    const sales = data.map(d => d.netSale);

    // Colorful bars
    const colors = [
        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69'
    ];
    const bgColors = labels.map((_, i) => colors[i % colors.length]);

    if (salesChart) {
        salesChart.destroy();
    }

    salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Net Sale',
                data: sales,
                backgroundColor: bgColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function renderBranchTable(data) {
    const tbody = document.getElementById('branchTableBody');
    let html = '';

    // Totals
    let tGross = 0, tDiscVal = 0, tRet = 0, tSaleVal = 0, tGst = 0, tNet = 0, tAvg = 0;

    data.forEach((b, index) => {
        tGross += b.grossSale;
        tDiscVal += b.discountVal;
        tRet += b.returnVal;
        tGst += b.gst;
        tNet += b.netSale;
        tAvg += b.avgDailySale;

        html += `
            <tr>
                <td class="text-center fw-bold">${index + 1}</td>
                <td class="fw-bold">${b.name}</td>
                <td class="text-end">${b.discPct.toFixed(2)}%</td>
                <td class="text-end fw-bold text-success">${formatCurrency(b.netSale)}</td>
                <td class="text-end fw-bold">${formatCurrency(b.avgDailySale)}</td>
            </tr>
        `;
    });

    // Grand Total
    const totalDiscPct = tGross > 0 ? (tDiscVal / tGross) * 100 : 0;

    html += `
        <tr class="grand-total-row">
            <td colspan="2" class="text-center">Grand Total</td>
            <td class="text-end">${totalDiscPct.toFixed(2)}%</td>
            <td class="text-end">${formatCurrency(tNet)}</td>
            <td class="text-end">${formatCurrency(tAvg)}</td>
        </tr>
    `;

    tbody.innerHTML = html;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

