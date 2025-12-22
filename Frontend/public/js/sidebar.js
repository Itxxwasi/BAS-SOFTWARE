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
        this.setupHeader();

        // Ensure closed by default on mobile
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('sidebarBackdrop');
            if (sidebar) sidebar.classList.remove('show-mobile');
            if (backdrop) backdrop.classList.remove('show');
        }
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
                    { label: 'User Management', link: '/users.html', permission: 'users' },
                    { label: 'Group Rights', link: '/groups.html', permission: 'groups' },
                    { label: 'Stores', link: '/stores.html', permission: 'stores' }
                ]
            },
            {
                id: 'overview', icon: 'fa-tachometer-alt', label: 'Overview', permission: 'dashboard',
                children: [
                    { label: 'Dashboard', link: '/dashboard.html', permission: 'dashboard' }
                ]
            },
            {
                id: 'reports', icon: 'fa-chart-bar', label: 'Reports', permission: 'reports',
                children: [
                    {
                        id: 'sales-reports', label: 'Sales Reports', icon: 'fa-shopping-cart', permission: 'sales_reports',
                        submenu: [
                            { label: 'Sales Report', link: '/sales-report.html', permission: 'sales_report_link' },
                            { label: 'Dept Wise Sale', link: '/department-sales-report.html', permission: 'dept_sale_link' },
                            { label: 'Cash Counter Report', link: '/cash-counter-report.html', permission: 'cash_counter_rpt_link' },
                            { label: 'Customer Receipts', link: '/customer-receipts-report.html', permission: 'receipts_link' },
                            { label: 'Party Statement', link: '/party-statement-report.html', permission: 'party_stmt_link' }
                        ]
                    },
                    {
                        id: 'purchase-reports', label: 'Purchase Reports', icon: 'fa-truck', permission: 'purchase_reports',
                        submenu: [
                            { label: 'Purchase Report', link: '/purchase-report.html', permission: 'purchase_rpt_link' },
                            { label: 'Supplier Payments', link: '/supplier-payments-report.html', permission: 'supp_pay_link' },
                            { label: 'Supplier WHT Certificate', link: '/supplier-tax-certificate.html', permission: 'supplier_tax_cert_link' }
                        ]
                    },
                    {
                        id: 'stock-reports', label: 'Stock Reports', icon: 'fa-warehouse', permission: 'stock_reports',
                        submenu: [
                            { label: 'Stock Report', link: '/stock-report.html', permission: 'stock_rpt_link' },
                            { label: 'Stock Adjustments', link: '/stock-adjustments-report.html', permission: 'stock_adj_rpt_link' },
                            { label: 'Stock Audit', link: '/stock-audit-report.html', permission: 'stock_audit_rpt_link' }
                        ]
                    },
                    {
                        id: 'financial-reports', label: 'Financial Reports', icon: 'fa-file-invoice-dollar', permission: 'financial_reports',
                        submenu: [
                            { label: 'Profit & Loss', link: '/profit-loss-report.html', permission: 'pl_link' },
                            { label: 'Ledger', link: '/ledger-report.html', permission: 'ledger_link' },
                            { label: 'Bank Ledger', link: '/bank-ledger.html', permission: 'bank_ledger_link' },
                            { label: 'Expense Report', link: '/expense-report.html', permission: 'expense_rpt_link' },
                            {
                                id: 'pv-reports-group',
                                label: 'Vouchers',
                                permission: 'vouchers_rpt_link',
                                submenu: [
                                    { label: 'Supplier Vouchers', link: '/vouchers-report.html?context=supplier', permission: 'pv_supplier' },
                                    { label: 'Category Vouchers', link: '/vouchers-report.html?context=category', permission: 'pv_category' },
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                id: 'accounts', icon: 'fa-calculator', label: 'Accounts', permission: 'accounts',
                children: [
                    {
                        id: 'payment-vouchers-sub',
                        label: 'Payment Vouchers',
                        permission: 'payment_vouchers',
                        submenu: [
                            { label: 'Supplier Voucher', link: '/payment-vouchers.html?tab=supplier', permission: 'pv_supplier' },
                            { label: 'Category Voucher', link: '/payment-vouchers.html?tab=category', permission: 'pv_category' },
                        ]
                    },
                    { label: 'Vouchers', link: '/voucher.html', permission: 'vouchers' },
                    { label: 'Expenses', link: '/expenses.html', permission: 'expenses' },
                    { label: 'Account Register', link: '/accounts.html', permission: 'account_register' },
                    { label: 'Account Groups', link: '/account-groups.html', permission: 'account_groups' },
                    { label: 'Account Categories', link: '/account-categories.html', permission: 'account_categories' }
                ]
            },
            {
                id: 'bank-mgmt', icon: 'fa-university', label: 'Bank Management', permission: 'bank_mgmt',
                children: [
                    { label: 'Banks', link: '/banks.html', permission: 'banks' },
                    { label: 'Bank Management', link: '/bank-management.html', permission: 'bank_management' }
                ]
            },
            {
                id: 'closing', icon: 'fa-file-invoice-dollar', label: 'Closing', permission: 'closing',
                children: [
                    { label: 'Branch Departments', link: '/branch-departments.html', permission: 'branch_departments' },
                    { label: 'Daily Cash', link: '/daily-cash.html', permission: 'daily_cash' },
                    { label: 'Cash Counter', link: '/cash-counter.html', permission: 'cash_counter' },
                    { label: 'Closing Sheet', link: '/closing-sheet.html', permission: 'closing_sheet' }
                ]
            },
            {
                id: 'payroll', icon: 'fa-users', label: 'Payroll', permission: 'payroll',
                children: [
                    { label: 'Employee Registration', link: '/employee-registration.html', permission: 'employee_registration' },
                    { label: 'Attendance', link: '/attendance-list.html', permission: 'attendance' },
                    { label: 'Employee Advance', link: '/employee-advance.html', permission: 'employee_advance' },
                    { label: 'Monthly Payroll', link: '/payroll.html', permission: 'monthly_payroll' },
                    { label: 'Holy Days', link: '/holy-days.html', permission: 'holy_days' },
                    { label: 'Employee Penalty', link: '/employee-penalty.html', permission: 'employee_penalty' },
                    { label: 'Emp. Commission', link: '/employee-commission.html', permission: 'emp_commission' },
                    { label: 'Emp. Clearance', link: '/employee-clearance.html', permission: 'emp_clearance' },
                    { label: 'Emp. Adjustment', link: '/employee-adjustment.html', permission: 'emp_adjustment' }
                ]
            },
            {
                id: 'sales', icon: 'fa-shopping-cart', label: 'Sales', permission: 'sales',
                children: [
                    { label: 'Customer Demand', link: '/customer-demand.html', permission: 'customer_demand' },
                    { label: 'New Sale', link: '/sales.html', permission: 'new_sale' },
                    { label: 'Sales Return', link: '/sale-returns.html', permission: 'sale_returns' },
                    { label: 'Customer Receipt', link: '/customer-payments.html', permission: 'customer_receipt' }
                ]
            },
            {
                id: 'purchases', icon: 'fa-shopping-bag', label: 'Purchase', permission: 'purchase',
                children: [
                    { label: 'Items', link: '/items.html', permission: 'items' },
                    { label: 'Parties', link: '/parties.html', permission: 'parties' },
                    { label: 'New Purchase', link: '/purchases.html', permission: 'new_purchase' },
                    { label: 'Purchase Return', link: '/purchase-returns.html', permission: 'purchase_returns' },
                    { label: 'Supplier Payment', link: '/supplier-payments.html', permission: 'supplier_payment' },
                    { label: 'Supplier WH Tax', link: '/supplier-wh-tax.html', permission: 'supplier_wh_tax_link' },
                    { label: 'WHT Supplier', link: '/wht-supplier.html', permission: 'wht_supplier_link' },
                    { label: 'Supplier Tax Report', link: '/supplier-tax-report.html', permission: 'supplier_tax_report_link' }
                ]
            },
            {
                id: 'stock', icon: 'fa-warehouse', label: 'Stock', permission: 'stock',
                children: [
                    { label: 'Stock Audit', link: '/stock-audit.html', permission: 'stock_audit' },
                    { label: 'Stock Adjustments', link: '/stock-adjustments.html', permission: 'stock_adjustments' }
                ]
            },
            { id: 'settings', icon: 'fa-cog', label: 'Settings', link: '/settings.html', permission: 'settings' }
        ];

        let html = `
            <div class="sidebar-header">
                <i class="fas fa-bars text-white" style="cursor:pointer; font-size: 1.5rem;" id="sidebarToggleBtn"></i>
                <div class="logo-text d-none d-md-block">BAS</div>
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
                    <div class="nav-link collapsed" data-bs-toggle="collapse" href="#submenu-${item.id}" role="button" aria-expanded="false">
                        <i class="fas ${item.icon}"></i>
                        <span>${item.label}</span>
                        <i class="fas fa-chevron-right ms-auto arrow arrow-icon" style="font-size: 0.8rem; opacity: 0.7;"></i>
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
                            <li><a href="javascript:void(0)" class="nav-link small-link" data-permission="${child.permission}" onclick="document.getElementById('submenu-${child.id}').classList.toggle('show')" style="font-weight: normal !important; display: flex !important; align-items: center !important; justify-content: space-between !important; padding-left: 25px !important; padding-right: 15px !important;">
                                <span><i class="fas fa-circle bullet text-danger" style="font-size:0.5rem; margin-right:8px;"></i>${child.label}</span>
                                <i class="fas fa-chevron-right" style="font-size:0.7rem;"></i>
                            </a></li>
                            <ul class="collapse list-unstyled submenu-inline" id="submenu-${child.id}" style="margin-left: 25px !important; padding-left: 0 !important;">
                        `;
                        child.submenu.forEach(subItem => {
                            const permAttr = subItem.permission ? `data-permission="${subItem.permission}"` : '';
                            html += `<li><a href="${subItem.link}" class="nav-link small-link" ${permAttr} style="padding-right: 15px;"><i class="fas fa-circle bullet text-danger" style="font-size:0.5rem; margin-right:8px;"></i>${subItem.label}</a></li>`;
                        });
                        html += `</ul>`;
                    } else if (child.header) {
                        html += `<li class="sidebar-sub-header text-white text-uppercase fw-bold" style="font-size:0.7rem; padding: 5px 15px; margin-top:5px; opacity: 0.7;">${child.label}</li>`;
                    } else {
                        html += `<li><a href="${child.link}" class="nav-link small-link" data-permission="${child.permission}"><i class="fas fa-circle bullet text-danger" style="font-size:0.5rem; margin-right:8px;"></i>${child.label}</a></li>`;
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
                            <div class="popover-submenu-toggle" data-permission="${child.permission}" data-target="popover-sub-${child.id}" style="cursor:pointer; padding: 8px 20px; color:#b8c7ce; display:flex; align-items:center; transition: color 0.2s;">
                                <i class="fas fa-circle bullet" style="font-size:0.5rem; margin-right:10px; color:#e74c3c;"></i>
                                <span style="font-size:0.9rem;">${child.label}</span>
                                <i class="fas fa-chevron-right arrow" style="font-size:0.7rem; margin-left: auto; transition: transform 0.2s;"></i>
                            </div>
                            <div id="popover-sub-${child.id}" class="popover-submenu-content" style="display:none; background:rgba(0,0,0,0.2);">
                        `;
                        child.submenu.forEach(subItem => {
                            const permAttr = subItem.permission ? `data-permission="${subItem.permission}"` : '';
                            html += `
                                <a href="${subItem.link}" class="popover-item" ${permAttr} style="padding-left: 30px;">
                                    <i class="fas fa-circle bullet" style="font-size:0.4rem; margin-right:10px; color:#e74c3c;"></i> ${subItem.label}
                                </a>
                            `;
                        });
                        html += `</div>`;
                    } else if (child.header) {
                        html += `<div class="popover-sub-header text-white text-uppercase fw-bold" style="font-size:0.7rem; padding: 5px 15px; margin-top:5px; border-bottom: 1px solid rgba(255,255,255,0.1); opacity: 0.7;">${child.label}</div>`;
                    } else {
                        html += `
                            <a href="${child.link}" class="popover-item" data-permission="${child.permission}">
                                <i class="fas fa-circle bullet" style="font-size:0.5rem; margin-right:10px; color:#e74c3c;"></i> ${child.label}
                            </a>
                        `;
                    }
                });
                html += `</div></div>`;

            } else {
                html += `
                    <a href="${item.link}" class="nav-link" data-page="${item.id}" data-permission="${item.permission}">
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

        // Add Backdrop for mobile
        const backdrop = document.createElement('div');
        backdrop.id = 'sidebarBackdrop';
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', () => this.toggleSidebarMode());
    }

    setupEventListeners() {
        // Broad delegation for toggle buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('#sidebarToggle') || e.target.closest('#sidebarToggleBtn')) {
                e.preventDefault();
                this.toggleSidebarMode();
            }
        });

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

        // Close sidebar on mobile when link is clicked
        document.addEventListener('click', (e) => {
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) return;

            const navLink = e.target.closest('.nav-link:not([data-bs-toggle])');
            const popoverItem = e.target.closest('.popover-item');

            if (navLink || popoverItem) {
                const sidebar = document.getElementById('sidebar');
                const backdrop = document.getElementById('sidebarBackdrop');
                if (sidebar) sidebar.classList.remove('show-mobile');
                if (backdrop) backdrop.classList.remove('show');
            }
        });

        // Mobile Fix: Force expand accordion on click for mobile
        document.addEventListener('click', (e) => {
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) return;

            const toggle = e.target.closest('[data-bs-toggle="collapse"]');
            if (toggle) {
                // If it's a sidebar toggle, we might need to verify if the mini mode is interfering
                const targetId = toggle.getAttribute('href') || toggle.getAttribute('data-bs-target');
                if (targetId) {
                    const targetEl = document.querySelector(targetId);
                    // Bootstrap might lag or conflict with our 'mini' class logic. 
                    // Let's ensure the class 'show' is toggled.
                    // However, bootstrap js should handle this. 
                    // The issue is likely CSS hiding it despite 'show' class.
                    // We fixed CSS, but let's double check if we need to force anything here.

                    // Actually, if we are in Mini mode, the click might not be triggering bootstrap collapse 
                    // because the element might be visually different or hidden?

                    // If we need to force open specifically for mobile:
                    if (targetEl && targetEl.classList.contains('submenu-inline')) {
                        setTimeout(() => {
                            if (!targetEl.classList.contains('show')) {
                                // Ideally bootstrap opens it. If not, we force display block via style
                            }
                        }, 50);
                    }
                }
            }
        });
    }

    toggleSidebarMode() {
        const isMobile = window.innerWidth <= 768;
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');

        if (isMobile) {
            sidebar.classList.toggle('show-mobile');
            if (backdrop) backdrop.classList.toggle('show');
            return;
        }

        if (this.mode === 'full') {
            this.mode = 'mini';
            sidebar.classList.remove('full');
            sidebar.classList.add('mini');
        } else {
            this.mode = 'full';
            sidebar.classList.remove('mini');
            sidebar.classList.add('full');
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
                    if (trigger) {
                        trigger.classList.add('active-parent');
                        trigger.setAttribute('aria-expanded', 'true');
                    }
                }
            }
        });
    }

    setupRoleBasedAccess() {
        const user = this.getCurrentUser();
        if (!user) return;

        // Admin has full access
        if (user.role === 'admin' || (user.group && user.group.isAdmin) || (user.groupId && user.groupId.isAdmin)) return;

        // Rights can be in multiple places depending on how it was loaded
        let rights = user.rights || {};

        // If rights is empty and we have group rights, use those
        if (Object.keys(rights).length === 0) {
            if (user.group && user.group.rights) {
                rights = user.group.rights;
            } else if (user.groupId && user.groupId.rights) {
                rights = user.groupId.rights;
            }
        }

        // 1. Hide Unauthorized LEAF nodes (Links)
        const allPermElements = document.querySelectorAll('[data-permission]');
        allPermElements.forEach(el => {
            const perm = el.getAttribute('data-permission');
            if (perm && !rights[perm]) {
                const isNavOne = el.classList.contains('nav-item'); // Top container
                const isSubToggle = el.getAttribute('data-bs-toggle') === 'collapse' || el.classList.contains('popover-submenu-toggle'); // Sub container

                if (!isNavOne && !isSubToggle) {
                    // It is a leaf link
                    el.classList.add('auth-hidden');
                    el.style.display = 'none';
                    if (el.tagName === 'A' && el.parentElement.tagName === 'LI') {
                        el.parentElement.style.display = 'none'; // Hide wrapping LI
                    }
                    if (el.classList.contains('report-card')) {
                        const col = el.closest('.col-md-4');
                        if (col) col.style.display = 'none';
                    }
                }
            }
        });

        // 2. Check Sub-Menus (Nested Groups)
        // Find all submenus (ULs and Popover Divs)
        const subContainers = document.querySelectorAll('ul.submenu-inline, div.popover-submenu-content');
        subContainers.forEach(container => {
            // count visible children
            const visibleChildren = Array.from(container.querySelectorAll('a, .popover-item')).filter(child => {
                return child.style.display !== 'none' && !child.classList.contains('auth-hidden');
            });

            // If no visible children, hide this container AND its trigger
            if (visibleChildren.length === 0) {
                container.classList.add('auth-hidden');
                container.style.display = 'none';

                // Hide Trigger
                const id = container.id;
                if (id) {
                    const trigger = document.querySelector(`[href="#${id}"], [data-target="${id}"]`);
                    if (trigger) {
                        trigger.style.display = 'none';
                        if (trigger.closest('li')) trigger.closest('li').style.display = 'none';
                    }
                }
            } else {
                // Ensure Trigger is VISIBLE even if its permission is false
                const id = container.id;
                if (id) {
                    const trigger = document.querySelector(`[href="#${id}"], [data-target="${id}"]`);
                    if (trigger) {
                        trigger.style.display = '';
                        if (trigger.closest('li')) trigger.closest('li').style.display = '';
                    }
                }
            }
        });

        // 3. Check Top-Level Nav Items
        document.querySelectorAll('.nav-item').forEach(navItem => {
            // Check if it has a submenu (Full Mode) OR Popover (Mini Mode)
            const submenu = navItem.querySelector('ul.submenu-inline');
            const popover = navItem.querySelector('div.popover-menu');

            const hasChildren = submenu || popover;

            if (hasChildren) {
                // Check if any visible links exist inside
                const visibleLinks = navItem.querySelectorAll('a:not(.auth-hidden)');
                const visible = Array.from(visibleLinks).some(link => link.style.display !== 'none');

                if (!visible) {
                    navItem.style.display = 'none';
                } else {
                    navItem.style.display = ''; // Ensure visible
                }
            } else {
                // Direct Link (e.g. Dashboard)
                const perm = navItem.getAttribute('data-permission');
                if (perm && !rights[perm]) {
                    navItem.style.display = 'none';
                }
            }
        });
    }

    setupHeader() {
        const user = this.getCurrentUser();
        if (!user) return;

        // Common IDs for user name display
        const nameElements = ['userName', 'userNameHeader', 'headerUserName'];
        nameElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = user.name;
        });

        // Update avatars if any
        document.querySelectorAll('.user-avatar-img, .header-avatar').forEach(img => {
            img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
        });

        // Setup Logout buttons
        document.querySelectorAll('.logout-btn, #logoutBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.pageAccess && window.pageAccess.logout) {
                    window.pageAccess.logout();
                } else {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/login.html';
                }
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (!window.location.pathname.includes('login.html')) {
        new SidebarNavigation();
    }
});
