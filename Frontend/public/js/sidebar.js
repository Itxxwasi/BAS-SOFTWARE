// Sidebar Navigation - Hybrid Mode (Accordion for Full, Popover for Mini) - VERSION 2.0 UPDATED

class SidebarNavigation {
    constructor() {
        this.currentPage = this.getCurrentPage();
        this.userRole = this.getUserRole();
        // Default to mini mode on ALL pages
        this.mode = 'mini';

        this.init();
    }

    init() {
        this.createSidebar();
        this.applyBodyClass();
        this.highlightCurrentPage();
        this.setupEventListeners();
        this.setupRoleBasedAccess();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path === '/' || path.includes('index.html')) return 'main';
        const page = path.split('/').pop().replace('.html', '');
        return page || 'main';
    }

    getUserRole() {
        const user = this.getCurrentUser();
        return user ? user.role : 'guest';
    }

    getCurrentUser() {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) return JSON.parse(userStr);
        } catch (error) { console.error(error); }
        return null;
    }

    applyBodyClass() {
        document.body.classList.remove('sidebar-full', 'sidebar-mini');
        document.body.classList.add(this.mode === 'full' ? 'sidebar-full' : 'sidebar-mini');
    }

    createSidebar() {
        const sidebar = document.createElement('nav');
        sidebar.id = 'sidebar';
        sidebar.className = `sidebar-container ${this.mode}`;

        const menuItems = [
            { id: 'main', icon: 'fa-home', label: 'Home Page', link: '/main.html', permission: 'dashboard' },
            {
                id: 'admin', icon: 'fa-cogs', label: 'Administration', permission: 'administration',
                children: [
                    { label: 'Stores', link: '/stores.html' }
                ]
            },
            {
                id: 'overview', icon: 'fa-tachometer-alt', label: 'Overview', permission: 'dashboard',
                children: [
                    { label: 'Dashboard', link: '/dashboard.html' }
                ]
            },
            {
                id: 'reports', icon: 'fa-chart-bar', label: 'Reports', permission: 'reports',
                children: [
                    {
                        id: 'sales-reports', label: 'Sales Reports', icon: 'fa-shopping-cart',
                        submenu: [
                            { label: 'Sales Report', link: '/sales-report.html' },
                            { label: 'Dept Wise Sale', link: '/department-sales-report.html' },
                            { label: 'Customer Receipts', link: '/customer-receipts-report.html' },
                            { label: 'Party Statement', link: '/party-statement-report.html' }
                        ]
                    },
                    {
                        id: 'purchase-reports', label: 'Purchase Reports', icon: 'fa-truck',
                        submenu: [
                            { label: 'Purchase Report', link: '/purchase-report.html' },
                            { label: 'Supplier Payments', link: '/supplier-payments-report.html' }
                        ]
                    },
                    {
                        id: 'stock-reports', label: 'Stock Reports', icon: 'fa-warehouse',
                        submenu: [
                            { label: 'Stock Report', link: '/stock-report.html' },
                            { label: 'Stock Adjustments', link: '/stock-adjustments-report.html' },
                            { label: 'Stock Audit', link: '/stock-audit-report.html' }
                        ]
                    },
                    {
                        id: 'financial-reports', label: 'Financial Reports', icon: 'fa-file-invoice-dollar',
                        submenu: [
                            { label: 'Profit & Loss', link: '/profit-loss-report.html' },
                            { label: 'Ledger', link: '/ledger-report.html' },
                            { label: 'Bank Ledger', link: '/bank-ledger.html' },
                            { label: 'Expense Report', link: '/expense-report.html' },
                            { label: 'Vouchers', link: '/vouchers-report.html' }
                        ]
                    }
                ]
            },
            {
                id: 'accounts', icon: 'fa-calculator', label: 'Accounts', permission: 'accounts',
                children: [
                    { label: 'Payment Vouchers', link: '/payment-vouchers.html' },
                    { label: 'Vouchers', link: '/voucher.html' },
                    { label: 'Expenses', link: '/expenses.html' },
                    { label: 'Account Register', link: '/accounts.html' },
                    { label: 'Account Groups', link: '/account-groups.html' },
                    { label: 'Account Categories', link: '/account-categories.html' }
                ]
            },
            {
                id: 'bank-mgmt', icon: 'fa-university', label: 'Bank Management', permission: 'accounts',
                children: [
                    { label: 'Banks', link: '/banks.html' },
                    { label: 'Bank Management', link: '/bank-management.html' }
                ]
            },
            {
                id: 'closing', icon: 'fa-file-invoice-dollar', label: 'Closing', permission: 'closing',
                children: [
                    { label: 'Branch Departments', link: '/branch-departments.html' },
                    { label: 'Daily Cash', link: '/daily-cash.html' },
                    { label: 'Cash Counter', link: '/cash-counter.html' },
                    { label: 'Closing Sheet', link: '/closing-sheet.html' }
                ]
            },
            {
                id: 'payroll', icon: 'fa-users', label: 'Payroll', permission: 'payroll',
                children: [
                    { label: 'Employee Registration', link: '/employee-registration.html' },
                    { label: 'Attendance', link: '/attendance-list.html' },
                    { label: 'Employee Advance', link: '/employee-advance.html' },
                    { label: 'Monthly Payroll', link: '/payroll.html' },
                    { label: 'Holy Days', link: '/holy-days.html' },
                    { label: 'Employee Penalty', link: '/employee-penalty.html' },
                    { label: 'Emp. Commission', link: '/employee-commission.html' },
                    { label: 'Emp. Clearance', link: '/employee-clearance.html' },
                    { label: 'Emp. Adjustment', link: '/employee-adjustment.html' }
                ]
            },
            {
                id: 'sales', icon: 'fa-shopping-cart', label: 'Sales', permission: 'sales',
                children: [
                    { label: 'Customer Demand', link: '/customer-demand.html' },
                    { label: 'New Sale', link: '/sales.html' },
                    { label: 'Sales Return', link: '/sale-returns.html' },
                    { label: 'Customer Receipt', link: '/customer-payments.html' }
                ]
            },
            {
                id: 'purchases', icon: 'fa-shopping-bag', label: 'Purchase', permission: 'purchases',
                children: [
                    { label: 'Items', link: '/items.html' },
                    { label: 'Parties', link: '/parties.html' },
                    { label: 'New Purchase', link: '/purchases.html' },
                    { label: 'Purchase Return', link: '/purchase-returns.html' },
                    { label: 'Supplier Payment', link: '/supplier-payments.html' },
                    { label: 'Supplier WH Tax', link: '/supplier-wh-tax.html' },
                    { label: 'WHT Supplier', link: '/wht-supplier.html' },
                    { label: 'Supplier Tax Report', link: '/supplier-tax-report.html' },
                ]
            },
            {
                id: 'stock', icon: 'fa-warehouse', label: 'Stock', permission: 'stock',
                children: [
                    { label: 'Stock Audit', link: '/stock-audit.html' },
                    { label: 'Stock Adjustments', link: '/stock-adjustments.html' }
                ]
            },
            { id: 'settings', icon: 'fa-cog', label: 'Settings', link: '/settings.html', permission: 'settings' }
        ];

        let html = `
            <div class="sidebar-header">
                <i class="fas fa-bars text-white" style="cursor:pointer; font-size: 1.2rem;" id="sidebarToggleBtn"></i>
                <div class="logo-text">BAS</div>
            </div>
            
            <div class="user-info-mini">
                <div class="user-avatar-circle">
                    <i class="fas fa-user"></i>
                </div>
            </div>

            <div class="sidebar-menu">
                <ul class="list-unstyled">
        `;

        menuItems.forEach(item => {
            html += `<li class="nav-item" data-permission="${item.permission}">`;

            if (item.children) {
                // 1. Accordion Trigger (For Full Mode)
                html += `
                    <div class="nav-link" data-bs-toggle="collapse" href="#submenu-${item.id}" role="button" aria-expanded="false">
                        <i class="fas ${item.icon}"></i>
                        <span>${item.label}</span>
                        <i class="fas fa-chevron-right ms-auto arrow arrow-icon"></i>
                    </div>
                `;

                // 2. Accordion Content (For Full Mode)
                html += `
                    <ul class="collapse list-unstyled ps-3 submenu-inline" id="submenu-${item.id}">
                `;
                item.children.forEach(child => {
                    if (child.submenu) {
                        // Nested Submenu Logic - with chevron arrows centered
                        html += `
                            <li><a href="javascript:void(0)" class="nav-link small-link" onclick="document.getElementById('submenu-${child.id}').classList.toggle('show')" style="font-weight: normal !important; display: flex !important; align-items: center !important; justify-content: space-between !important; padding-left: 25px !important; padding-right: 15px !important;">
                                <span><i class="fas fa-circle bullet text-danger" style="font-size:0.5rem; margin-right:8px;"></i>${child.label}</span>
                                <i class="fas fa-chevron-right" style="font-size:0.7rem;"></i>
                            </a></li>
                            <ul class="collapse list-unstyled submenu-inline" id="submenu-${child.id}" style="margin-left: 25px !important; padding-left: 0 !important;">
                        `;
                        child.submenu.forEach(subItem => {
                            html += `<li><a href="${subItem.link}" class="nav-link small-link" style="padding-right: 15px;"><i class="fas fa-circle bullet text-danger" style="font-size:0.5rem; margin-right:8px;"></i>${subItem.label}</a></li>`;
                        });
                        html += `</ul>`;
                    } else if (child.header) {
                        html += `<li class="sidebar-sub-header text-white text-uppercase fw-bold" style="font-size:0.7rem; padding: 5px 15px; margin-top:5px; opacity: 0.7;">${child.label}</li>`;
                    } else {
                        html += `<li><a href="${child.link}" class="nav-link small-link"><i class="fas fa-circle bullet text-danger" style="font-size:0.5rem; margin-right:8px;"></i>${child.label}</a></li>`;
                    }
                });
                html += `</ul>`;

                // 3. Popover Content (For Mini Mode)
                html += `<div class="popover-menu">
                    <div class="popover-header">
                        ${item.label}
                    </div>
                    <div class="popover-content">
                `;
                item.children.forEach(child => {
                    if (child.submenu) {
                        // Collapsible Submenu for Popover - styled like regular items
                        html += `
                            <div class="popover-submenu-toggle" data-target="popover-sub-${child.id}" style="cursor:pointer; padding: 8px 20px; color:#b8c7ce; display:flex; align-items:center; transition: color 0.2s;">
                                <i class="fas fa-circle bullet" style="font-size:0.5rem; margin-right:10px; color:#e74c3c;"></i>
                                <span style="font-size:0.9rem;">${child.label}</span>
                                <i class="fas fa-chevron-right arrow" style="font-size:0.7rem; margin-left: auto; transition: transform 0.2s;"></i>
                            </div>
                            <div id="popover-sub-${child.id}" class="popover-submenu-content" style="display:none; background:rgba(0,0,0,0.2);">
                        `;
                        child.submenu.forEach(subItem => {
                            html += `
                                <a href="${subItem.link}" class="popover-item" style="padding-left: 30px;">
                                    <i class="fas fa-circle bullet" style="font-size:0.4rem; margin-right:10px; color:#e74c3c;"></i> ${subItem.label}
                                </a>
                            `;
                        });
                        html += `</div>`;
                    } else if (child.header) {
                        html += `<div class="popover-sub-header text-white text-uppercase fw-bold" style="font-size:0.7rem; padding: 5px 15px; margin-top:5px; border-bottom: 1px solid rgba(255,255,255,0.1); opacity: 0.7;">${child.label}</div>`;
                    } else {
                        html += `
                            <a href="${child.link}" class="popover-item">
                                <i class="fas fa-circle bullet" style="font-size:0.5rem; margin-right:10px; color:#e74c3c;"></i> ${child.label}
                            </a>
                        `;
                    }
                });
                html += `</div></div>`;

            } else {
                html += `
                    <a href="${item.link}" class="nav-link" data-page="${item.id}">
                        <i class="fas ${item.icon}"></i>
                        <span>${item.label}</span>
                    </a>
                `;
            }
            html += `</li>`;
        });

        html += `   </ul>
                </div>
        `;

        sidebar.innerHTML = html;
        document.body.prepend(sidebar);
    }

    setupEventListeners() {
        // Internal toggle (in sidebar)
        const toggleBtn = document.getElementById('sidebarToggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleSidebarMode());
        }

        // External toggle (e.g. in dashboard topbar)
        const extToggle = document.getElementById('sidebarToggle');
        if (extToggle) {
            extToggle.addEventListener('click', () => this.toggleSidebarMode());
        }

        // Popover Submenu Toggle (Delegated)
        document.addEventListener('click', (e) => {
            const toggle = e.target.closest('.popover-submenu-toggle');
            if (toggle) {
                e.preventDefault();
                e.stopPropagation();
                const targetId = toggle.getAttribute('data-target');
                const targetEl = document.getElementById(targetId);
                const icon = toggle.querySelector('.arrow');

                if (targetEl) {
                    const isHidden = targetEl.style.display === 'none';
                    targetEl.style.display = isHidden ? 'block' : 'none';
                    if (icon) {
                        icon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
                    }
                }
            }
        });
    }

    toggleSidebarMode() {
        if (this.mode === 'full') {
            this.mode = 'mini';
            document.getElementById('sidebar').classList.remove('full');
            document.getElementById('sidebar').classList.add('mini');

            // If external toggle exists, we might want to adjust it or leaving it is fine
        } else {
            this.mode = 'full';
            document.getElementById('sidebar').classList.remove('mini');
            document.getElementById('sidebar').classList.add('full');
        }
        this.applyBodyClass();
    }

    highlightCurrentPage() {
        let path = window.location.pathname;
        if (path === '/') path = '/main.html';

        // Clean highlight
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

        document.querySelectorAll('a').forEach(a => {
            if (a.getAttribute('href') === path) {
                a.classList.add('active');
                // Highlight parent accordion trigger
                const parentUl = a.closest('.submenu-inline');
                if (parentUl) {
                    parentUl.classList.add('show'); // Expand accordion
                    const trigger = document.querySelector(`[href="#${parentUl.id}"]`);
                    if (trigger) trigger.classList.add('active-parent');
                }
            }
        });
    }

    setupRoleBasedAccess() {
        const user = this.getCurrentUser();
        const userRole = user ? user.role : 'guest';
        const userPermissions = user ? (user.permissions || []) : [];

        if (userRole === 'admin') return;

        document.querySelectorAll('.nav-item').forEach(item => {
            const requiredOr = item.getAttribute('data-permission');
            if (requiredOr && !userPermissions.includes(requiredOr)) {
                item.style.display = 'none';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (!window.location.pathname.includes('login.html')) {
        new SidebarNavigation();
    }
});
