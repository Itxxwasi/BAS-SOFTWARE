// Cash Counter Report JavaScript
const API_URL = 'http://localhost:5000/api/v1';


// Set default dates on page load
document.addEventListener('DOMContentLoaded', function () {
    setDefaultDates();
    loadBranches();
    displayUserName();
});

function setDefaultDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    document.getElementById('fromDate').valueAsDate = firstDay;
    document.getElementById('toDate').valueAsDate = today;
}

function displayUserName() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.name) {
        document.getElementById('userName').textContent = user.name;
    }
}

async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/stores`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch branches');

        const result = await response.json();
        const stores = result.data || result; // Handle both {data: []} and [] formats
        const branchFilter = document.getElementById('branchFilter');

        // Clear existing options except "All Branches"
        branchFilter.innerHTML = '<option value="">All Branches</option>';

        // Get unique branches
        if (!Array.isArray(stores)) {
            throw new Error('Invalid stores data format');
        }
        const branches = [...new Set(stores.map(s => s.name))];
        branches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch;
            option.textContent = branch;
            branchFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading branches:', error);
        showError('Failed to load branches');
    }
}

async function loadReport() {
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const branchFilter = document.getElementById('branchFilter').value;

    if (!fromDate || !toDate) {
        showError('Please select both from and to dates');
        return;
    }

    try {
        showLoading();

        // Fetch departments (cash counters)
        const departments = await fetchDepartments();

        // Fetch cash sales data
        const salesData = await fetchCashSales(fromDate, toDate, branchFilter);

        // Filter only cash counters
        const cashCounters = departments.filter(dept => dept.isCashCounter);

        // Group by branch
        const branchData = groupByBranch(cashCounters, salesData, branchFilter);

        // Display report
        displayReport(branchData, salesData);

    } catch (error) {
        console.error('Error loading report:', error);
        showError('Failed to load report data');
    }
}

async function fetchDepartments() {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/departments`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) throw new Error('Failed to fetch departments');
    const result = await response.json();
    return result.data || result; // Handle both {data: []} and [] formats
}

async function fetchCashSales(fromDate, toDate, branch) {
    const token = localStorage.getItem('token');
    let url = `${API_URL}/cash-sales?startDate=${fromDate}&endDate=${toDate}`;

    if (branch) {
        url += `&branch=${encodeURIComponent(branch)}`;
    }

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) throw new Error('Failed to fetch cash sales');
    const result = await response.json();
    return result.data || result; // Handle both {data: []} and [] formats
}

function groupByBranch(cashCounters, salesData, branchFilter) {
    const grouped = {};

    console.log('Cash Counters:', cashCounters.length);
    console.log('Sales Data:', salesData.length);
    if (salesData.length > 0) {
        console.log('Sample sale:', salesData[0]);
    }
    if (cashCounters.length > 0) {
        console.log('Sample counter:', cashCounters[0]);
    }

    cashCounters.forEach(counter => {
        // Skip if branch filter is applied and doesn't match
        if (branchFilter && counter.branch !== branchFilter) {
            return;
        }

        if (!grouped[counter.branch]) {
            grouped[counter.branch] = {
                branchName: counter.branch,
                departments: {} // Changed from counters to departments
            };
        }

        // Calculate sales for this counter
        const counterSales = salesData.filter(sale => {
            if (!sale.department) return false;
            const deptId = typeof sale.department === 'object' ? sale.department._id : sale.department;
            const match = deptId.toString() === counter._id.toString();
            if (match) {
                console.log('Match found!', counter.name, sale.totalAmount);
            }
            return match;
        });

        console.log(`Counter: ${counter.name}, Sales: ${counterSales.length}`);

        const totalSales = counterSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
        const cashSales = counterSales.filter(s => s.mode === 'Cash').reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
        const bankSales = counterSales.filter(s => s.mode === 'Bank').reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);

        // Determine the department key (parent department or counter itself)
        const deptKey = counter.parentDepartment ?
            (typeof counter.parentDepartment === 'object' ? counter.parentDepartment._id : counter.parentDepartment).toString() :
            counter._id.toString();

        const deptName = counter.parentDepartment ?
            (typeof counter.parentDepartment === 'object' ? counter.parentDepartment.name : counter.name) :
            counter.name;

        // Initialize department if not exists
        if (!grouped[counter.branch].departments[deptKey]) {
            grouped[counter.branch].departments[deptKey] = {
                id: deptKey,
                name: deptName,
                totalSales: 0,
                cashSales: 0,
                bankSales: 0,
                transactionCount: 0,
                counters: []
            };
        }

        // Add counter data to department
        grouped[counter.branch].departments[deptKey].totalSales += totalSales;
        grouped[counter.branch].departments[deptKey].cashSales += cashSales;
        grouped[counter.branch].departments[deptKey].bankSales += bankSales;
        grouped[counter.branch].departments[deptKey].transactionCount += counterSales.length;
        grouped[counter.branch].departments[deptKey].counters.push({
            id: counter._id,
            name: counter.name,
            code: counter.code,
            totalSales: totalSales,
            cashSales: cashSales,
            bankSales: bankSales,
            transactionCount: counterSales.length
        });
    });

    // Convert departments object to array
    Object.keys(grouped).forEach(branch => {
        grouped[branch].departments = Object.values(grouped[branch].departments);
    });

    return grouped;
}

function displayReport(branchData, salesData) {
    const reportContent = document.getElementById('reportContent');
    const summarySection = document.getElementById('summarySection');

    // Calculate summary
    const branches = Object.keys(branchData);
    const totalDepartments = branches.reduce((sum, branch) => sum + branchData[branch].departments.length, 0);
    const totalSales = salesData.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);

    // Update summary cards
    document.getElementById('totalBranches').textContent = branches.length;
    document.getElementById('totalCounters').textContent = totalDepartments; // Now showing departments count
    const totalSalesElement = document.getElementById('totalSales');
    if (totalSalesElement) {
        totalSalesElement.textContent = formatCurrency(totalSales);
    }
    summarySection.style.display = branches.length > 0 ? 'grid' : 'none';

    // Display branch cards
    if (branches.length === 0) {
        reportContent.innerHTML = `
            <div class="no-data">
                <i class="fas fa-inbox fa-3x mb-3"></i>
                <p>No cash counters found for the selected criteria</p>
            </div>
        `;
        return;
    }

    let html = '';
    branches.forEach(branchName => {
        const branch = branchData[branchName];
        const branchTotal = branch.departments.reduce((sum, dept) => sum + dept.totalSales, 0);

        html += `
            <div class="branch-card">
                <div class="branch-header">
                    <div class="branch-name">
                        <i class="fas fa-building me-2"></i>${branchName}
                    </div>
                    <div class="branch-total">
                        <small>Total Sales</small><br>
                        <strong style="font-size: 1.3rem;">${formatCurrency(branchTotal)}</strong>
                    </div>
                </div>
                <div class="counter-grid">
        `;

        if (branch.departments.length === 0) {
            html += `
                <div class="counter-card">
                    <div class="text-muted">No departments in this branch</div>
                </div>
            `;
        } else {
            branch.departments.forEach(dept => {
                html += `
                    <div class="counter-card">
                        <div class="counter-name">
                            <i class="fas fa-layer-group me-2"></i>${dept.name}
                        </div>
                        <div class="counter-stats">
                            <div class="stat-item">
                                <div class="stat-label">Cash</div>
                                <div class="stat-value text-success">${formatCurrency(dept.cashSales)}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Bank</div>
                                <div class="stat-value text-primary">${formatCurrency(dept.bankSales)}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Total</div>
                                <div class="stat-value">${formatCurrency(dept.totalSales)}</div>
                            </div>
                        </div>
                        <div class="text-center mt-2 small text-muted">
                            ${dept.transactionCount} transaction${dept.transactionCount !== 1 ? 's' : ''}
                        </div>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>
        `;
    });

    reportContent.innerHTML = html;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency: 'PKR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

function showLoading() {
    document.getElementById('reportContent').innerHTML = `
        <div class="no-data">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p>Loading report data...</p>
        </div>
    `;
}

function showError(message) {
    document.getElementById('reportContent').innerHTML = `
        <div class="no-data text-danger">
            <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
            <p>${message}</p>
        </div>
    `;
}
