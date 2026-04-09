// ===== SALES & PROFIT REPORTS FUNCTIONALITY =====

let salesChart = null;

// Initialize reports page
document.addEventListener('DOMContentLoaded', function () {
    setDefaultDates();
    loadFiltersForReport();
    generateReport();

    // Arrow keys navigation listener
    document.addEventListener('keydown', function (event) {
        const navIds = ['reportType', 'reportFromDate', 'reportToDate', 'reportEmployee', 'reportCategory'];
        const activeElement = document.activeElement;
        if (!activeElement || !navIds.includes(activeElement.id)) return;

        const currentIndex = navIds.indexOf(activeElement.id);
        let nextIndex = -1;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            if (currentIndex < navIds.length - 1) {
                nextIndex = currentIndex + 1;
            }
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            if (currentIndex > 0) {
                nextIndex = currentIndex - 1;
            }
        }

        if (nextIndex !== -1) {
            event.preventDefault();
            const nextElement = document.getElementById(navIds[nextIndex]);
            if (nextElement) {
                nextElement.focus();
                if (nextElement.tagName === 'INPUT') nextElement.select();
            }
        }
    });
});

// Set default dates (current month)
function setDefaultDates() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    document.getElementById('reportFromDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('reportToDate').value = lastDay.toISOString().split('T')[0];
}

// Load employees and categories for filters
function loadFiltersForReport() {
    const employees = getEmployees();
    const empSelect = document.getElementById('reportEmployee');
    if (empSelect) {
        empSelect.innerHTML = '<option value="">All Employees</option>';
        employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.salesCode;
            option.textContent = `${emp.salesCode} - ${emp.name}`;
            empSelect.appendChild(option);
        });
    }

    const categories = JSON.parse(localStorage.getItem('support_category1') || '[]');
    const catSelect = document.getElementById('reportCategory');
    if (catSelect) {
        catSelect.innerHTML = '<option value="">All Categories</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            catSelect.appendChild(option);
        });
    }

    const categories2 = JSON.parse(localStorage.getItem('support_category2') || '[]');
    const catSelect2 = document.getElementById('reportCategory2');
    if (catSelect2) {
        catSelect2.innerHTML = '<option value="">All Categories</option>';
        categories2.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            catSelect2.appendChild(option);
        });
    }
}

// Update report type
function updateReportType() {
    const reportType = document.getElementById('reportType').value;
    const catFilterGroup = document.getElementById('categoryFilterGroup');
    const cat2FilterGroup = document.getElementById('category2FilterGroup');
    if (catFilterGroup) catFilterGroup.style.display = (reportType === 'product') ? 'block' : 'none';
    if (cat2FilterGroup) cat2FilterGroup.style.display = (reportType === 'product') ? 'block' : 'none';
    generateReport();
}

// Generate report
function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const fromDate = document.getElementById('reportFromDate').value;
    const toDate = document.getElementById('reportToDate').value;
    const employeeFilter = document.getElementById('reportEmployee').value;
    const categoryFilter = document.getElementById('reportCategory') ? document.getElementById('reportCategory').value : '';
    const category2Filter = document.getElementById('reportCategory2') ? document.getElementById('reportCategory2').value : '';

    let sales = getSalesByDateRange(fromDate, toDate);

    if (employeeFilter) {
        sales = sales.filter(sale => sale.salesCode === employeeFilter);
    }

    switch (reportType) {
        case 'sales':
            generateSalesReport(sales, fromDate, toDate);
            break;
        case 'profit':
            generateProfitReport(sales, fromDate, toDate);
            break;
        case 'employee':
            generateEmployeeReport(sales, fromDate, toDate);
            break;
        case 'product':
            generateProductReport(sales, fromDate, toDate, categoryFilter, category2Filter);
            break;
        case 'customer':
            generateCustomerReport(sales, fromDate, toDate);
            break;
    }
}

// Generate sales report
function generateSalesReport(sales, fromDate, toDate) {
    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalTransactions = sales.length;
    const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    const paidAmount = sales.reduce((sum, sale) => sum + sale.paidAmount, 0);
    const outstanding = sales.reduce((sum, sale) => sum + (sale.balance || 0), 0);

    updateSummaryCards([
        { label: 'Total Sales', value: formatCurrency(totalSales), class: 'success' },
        { label: 'Total Transactions', value: totalTransactions, class: '' },
        { label: 'Average Transaction', value: formatCurrency(avgTransaction), class: '' },
        { label: 'Outstanding', value: formatCurrency(outstanding), class: outstanding > 0 ? 'warning' : '' }
    ]);

    // Generate chart
    generateSalesChart(sales, fromDate, toDate);

    // Generate table
    document.getElementById('reportTableTitle').textContent = 'Sales Report';
    const thead = document.getElementById('reportTableHead');
    thead.innerHTML = `
        <tr>
            <th>Invoice</th>
            <th>Date</th>
            <th>Sales Code</th>
            <th>Items</th>
            <th>Subtotal</th>
            <th>Discount</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Balance</th>
            <th>Status</th>
        </tr>
    `;

    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';

    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">No sales data found</td></tr>';
        return;
    }

    sales.forEach(sale => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sale.invoiceNumber}</td>
            <td>${formatDate(sale.date)}</td>
            <td>${sale.salesCode || '-'}</td>
            <td>${sale.items.length}</td>
            <td>${formatCurrency(sale.subtotal)}</td>
            <td>${formatCurrency(sale.discount)}</td>
            <td><strong>${formatCurrency(sale.total)}</strong></td>
            <td>${formatCurrency(sale.paidAmount)}</td>
            <td>${formatCurrency(sale.balance || 0)}</td>
            <td><span class="badge ${sale.balance > 0 ? 'badge-warning' : 'badge-success'}">${sale.balance > 0 ? 'Partial' : 'Paid'}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Generate profit report
function generateProfitReport(sales, fromDate, toDate) {
    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalCost = sales.reduce((sum, sale) =>
        sum + sale.items.reduce((itemSum, item) => itemSum + ((item.cost || 0) * item.qty), 0), 0
    );
    const totalProfit = sales.reduce((sum, sale) =>
        sum + sale.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0), 0
    );
    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    updateSummaryCards([
        { label: 'Total Sales', value: formatCurrency(totalSales), class: 'success' },
        { label: 'Total Cost', value: formatCurrency(totalCost), class: '' },
        { label: 'Total Profit', value: formatCurrency(totalProfit), class: 'success' },
        { label: 'Profit Margin', value: profitMargin.toFixed(2) + '%', class: profitMargin > 20 ? 'success' : 'warning' }
    ]);

    // Generate chart
    generateProfitChart(sales, fromDate, toDate);

    // Generate table
    document.getElementById('reportTableTitle').textContent = 'Profit Report';
    const thead = document.getElementById('reportTableHead');
    thead.innerHTML = `
        <tr>
            <th>Invoice</th>
            <th>Date</th>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>Qty</th>
            <th>Cost</th>
            <th>Price</th>
            <th>Profit</th>
            <th>Profit %</th>
        </tr>
    `;

    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';

    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No profit data found</td></tr>';
        return;
    }

    sales.forEach(sale => {
        sale.items.forEach((item, index) => {
            const itemProfit = item.profit || 0;
            const itemTotal = item.total || 0;
            const itemCost = (item.cost || 0) * item.qty;
            const itemProfitPercent = itemTotal > 0 ? ((itemProfit / itemTotal) * 100) : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index === 0 ? sale.invoiceNumber : ''}</td>
                <td>${index === 0 ? formatDate(sale.date) : ''}</td>
                <td>${item.code}</td>
                <td>${item.name}</td>
                <td>${item.qty}</td>
                <td>${formatCurrency(itemCost)}</td>
                <td>${formatCurrency(itemTotal)}</td>
                <td><strong style="color: ${itemProfit > 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(itemProfit)}</strong></td>
                <td>${itemProfitPercent.toFixed(2)}%</td>
            `;
            tbody.appendChild(row);
        });
    });
}

// Generate employee performance report
function generateEmployeeReport(sales, fromDate, toDate) {
    const employees = getEmployees();
    const employeeStats = {};

    sales.forEach(sale => {
        const code = sale.salesCode;
        if (!employeeStats[code]) {
            employeeStats[code] = {
                salesCode: code,
                name: employees.find(e => e.salesCode === code)?.name || code,
                totalSales: 0,
                transactions: 0,
                totalProfit: 0
            };
        }
        employeeStats[code].totalSales += sale.total;
        employeeStats[code].transactions += 1;
        employeeStats[code].totalProfit += sale.items.reduce((sum, item) => sum + (item.profit || 0), 0);
    });

    const statsArray = Object.values(employeeStats).sort((a, b) => b.totalSales - a.totalSales);
    const totalSales = statsArray.reduce((sum, stat) => sum + stat.totalSales, 0);
    const totalProfit = statsArray.reduce((sum, stat) => sum + stat.totalProfit, 0);
    const totalTransactions = statsArray.reduce((sum, stat) => sum + stat.transactions, 0);
    const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    updateSummaryCards([
        { label: 'Total Sales', value: formatCurrency(totalSales), class: 'success' },
        { label: 'Total Profit', value: formatCurrency(totalProfit), class: 'success' },
        { label: 'Total Transactions', value: totalTransactions, class: '' },
        { label: 'Avg Transaction', value: formatCurrency(avgTransaction), class: '' }
    ]);

    // Generate chart
    generateEmployeeChart(statsArray);

    // Generate table
    document.getElementById('reportTableTitle').textContent = 'Employee Performance Report';
    const thead = document.getElementById('reportTableHead');
    thead.innerHTML = `
        <tr>
            <th>Rank</th>
            <th>Sales Code</th>
            <th>Name</th>
            <th>Transactions</th>
            <th>Total Sales</th>
            <th>Total Profit</th>
            <th>Avg Transaction</th>
            <th>Performance</th>
        </tr>
    `;

    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';

    if (statsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No employee data found</td></tr>';
        return;
    }

    statsArray.forEach((stat, index) => {
        const avgTrans = stat.transactions > 0 ? stat.totalSales / stat.transactions : 0;
        const performance = totalSales > 0 ? ((stat.totalSales / totalSales) * 100).toFixed(1) + '%' : '0%';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${stat.salesCode}</strong></td>
            <td>${stat.name}</td>
            <td>${stat.transactions}</td>
            <td><strong>${formatCurrency(stat.totalSales)}</strong></td>
            <td>${formatCurrency(stat.totalProfit)}</td>
            <td>${formatCurrency(avgTrans)}</td>
            <td>${performance}</td>
        `;
        tbody.appendChild(row);
    });
}

// Generate product performance report
function generateProductReport(sales, fromDate, toDate, categoryFilter, category2Filter) {
    const productStats = {};
    const allProducts = typeof getProducts === 'function' ? getProducts() : [];

    // Initialize stats for all matching products based on the category filter
    allProducts.forEach(prod => {
        const matches1 = !categoryFilter || prod.category1 === categoryFilter;
        const matches2 = !category2Filter || prod.category2 === category2Filter;
        if (matches1 && matches2) {
            productStats[prod.itemCode] = {
                code: prod.itemCode,
                name: prod.name,
                category: prod.category1 || '-',
                category2: prod.category2 || '-',
                qtySold: 0,
                unsoldStock: prod.stock || 0,
                totalSales: 0,
                totalProfit: 0
            };
        }
    });

    sales.forEach(sale => {
        sale.items.forEach(item => {
            const code = item.code;
            // Only aggregate if it matches category filter (it's in productStats)
            // or if no filter
            if (!productStats[code]) {
                if (!categoryFilter) {
                    // product no longer exists or wasn't fetched, track anyway
                    productStats[code] = {
                        code: code,
                        name: item.name,
                        category: '-',
                        qtySold: 0,
                        unsoldStock: 0,
                        totalSales: 0,
                        totalProfit: 0
                    };
                }
            }
            if (productStats[code]) {
                productStats[code].qtySold += item.qty;
                productStats[code].totalSales += item.total;
                productStats[code].totalProfit += item.profit || 0;
            }
        });
    });

    const statsArray = Object.values(productStats).sort((a, b) => b.qtySold - a.qtySold); // Sort by quantity sold
    const totalSales = statsArray.reduce((sum, stat) => sum + stat.totalSales, 0);
    const totalProfit = statsArray.reduce((sum, stat) => sum + stat.totalProfit, 0);
    const totalQtySold = statsArray.reduce((sum, stat) => sum + stat.qtySold, 0);
    const totalUnsoldStock = statsArray.reduce((sum, stat) => sum + stat.unsoldStock, 0);
    const productsWithSales = statsArray.filter(s => s.qtySold > 0).length;
    const itemsWithoutSales = statsArray.length - productsWithSales;

    updateSummaryCards([
        { label: 'Products with Sales', value: productsWithSales, class: 'success' },
        { label: 'Zero-Sale Items', value: itemsWithoutSales, class: itemsWithoutSales > 0 ? 'warning' : '' },
        { label: 'Total Sales', value: formatCurrency(totalSales), class: 'success' },
        { label: 'Total Profit', value: formatCurrency(totalProfit), class: 'success' }
    ]);

    // Generate chart
    generateProductChart(statsArray.sort((a, b) => b.totalSales - a.totalSales).slice(0, 10)); // Top 10 products

    // Generate table
    document.getElementById('reportTableTitle').textContent = 'Product Performance Report';
    const thead = document.getElementById('reportTableHead');
    thead.innerHTML = `
        <tr>
            <th>Rank</th>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>Category</th>
            <th>Qty Sold</th>
            <th>Unsold (Stock)</th>
            <th>Total Sales</th>
            <th>Total Profit</th>
            <th>Profit Margin</th>
        </tr>
    `;

    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';

    if (statsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No product data found</td></tr>';
        return;
    }

    // Sort table by qty sold as default visual rank
    statsArray.sort((a, b) => b.qtySold - a.qtySold).forEach((stat, index) => {
        const profitMargin = stat.totalSales > 0 ? ((stat.totalProfit / stat.totalSales) * 100).toFixed(2) + '%' : '0%';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${stat.code}</strong></td>
            <td>${stat.name}</td>
            <td>${stat.category}</td>
            <td><strong>${stat.qtySold}</strong></td>
            <td><span style="color:var(--text-secondary);">${stat.unsoldStock}</span></td>
            <td><strong>${formatCurrency(stat.totalSales)}</strong></td>
            <td>${formatCurrency(stat.totalProfit)}</td>
            <td>${profitMargin}</td>
        `;
        tbody.appendChild(row);
    });
}

// Generate customer report
function generateCustomerReport(sales, fromDate, toDate) {
    if (typeof getCustomers === 'undefined') {
        document.getElementById('reportTableBody').innerHTML = '<tr><td colspan="10" class="text-center">Customer management not available</td></tr>';
        return;
    }

    const customerStats = {};

    sales.forEach(sale => {
        const customerId = sale.customerId || (sale.customerName && sale.customerContact ? `${sale.customerName}_${sale.customerContact}` : 'walkin');
        if (!customerStats[customerId]) {
            customerStats[customerId] = {
                id: customerId,
                name: sale.customerName || 'Walk-in Customer',
                contact: sale.customerContact || '-',
                transactions: 0,
                totalSales: 0,
                totalProfit: 0
            };
        }
        customerStats[customerId].transactions += 1;
        customerStats[customerId].totalSales += sale.total;
        customerStats[customerId].totalProfit += sale.items.reduce((sum, item) => sum + (item.profit || 0), 0);
    });

    const statsArray = Object.values(customerStats).sort((a, b) => b.totalSales - a.totalSales);
    const totalSales = statsArray.reduce((sum, stat) => sum + stat.totalSales, 0);
    const totalCustomers = statsArray.length;

    updateSummaryCards([
        { label: 'Total Customers', value: totalCustomers, class: '' },
        { label: 'Total Sales', value: formatCurrency(totalSales), class: 'success' },
        { label: 'Avg per Customer', value: formatCurrency(totalCustomers > 0 ? totalSales / totalCustomers : 0), class: '' },
        { label: 'Top Customer', value: statsArray[0]?.name || '-', class: 'success' }
    ]);

    // Generate table
    document.getElementById('reportTableTitle').textContent = 'Customer Analysis Report';
    const thead = document.getElementById('reportTableHead');
    thead.innerHTML = `
        <tr>
            <th>Rank</th>
            <th>Customer Name</th>
            <th>Contact</th>
            <th>Transactions</th>
            <th>Total Sales</th>
            <th>Total Profit</th>
            <th>Avg Transaction</th>
        </tr>
    `;

    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';

    if (statsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No customer data found</td></tr>';
        return;
    }

    statsArray.forEach((stat, index) => {
        const avgTrans = stat.transactions > 0 ? stat.totalSales / stat.transactions : 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${stat.name}</strong></td>
            <td>${stat.contact}</td>
            <td>${stat.transactions}</td>
            <td><strong>${formatCurrency(stat.totalSales)}</strong></td>
            <td>${formatCurrency(stat.totalProfit)}</td>
            <td>${formatCurrency(avgTrans)}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update summary cards
function updateSummaryCards(cards) {
    const container = document.getElementById('reportSummaryCards');
    container.innerHTML = '';

    cards.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.className = `stat-card ${card.class || ''}`;
        cardDiv.innerHTML = `
            <div class="stat-label">${card.label}</div>
            <div class="stat-value">${card.value}</div>
        `;
        container.appendChild(cardDiv);
    });
}

// Generate sales chart
function generateSalesChart(sales, fromDate, toDate) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    // Group sales by date
    const dailySales = {};
    sales.forEach(sale => {
        let dateStr = 'Unknown';
        try {
            const d = new Date(sale.date);
            if (!isNaN(d.getTime())) {
                dateStr = d.toISOString().split('T')[0];
            } else {
                // If it's a string like "10-03-2026", try splitting if it has 10 chars
                if (sale.date && sale.date.includes('-')) {
                    const parts = sale.date.split('-');
                    if (parts[0].length === 2) dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    else dateStr = sale.date.substring(0, 10);
                }
            }
        } catch(e) {}
        
        if (!dailySales[dateStr]) {
            dailySales[dateStr] = { sales: 0, count: 0 };
        }
        dailySales[dateStr].sales += (sale.total || 0);
        dailySales[dateStr].count += 1;
    });

    const dates = Object.keys(dailySales).sort();
    const salesData = dates.map(date => dailySales[date].sales);
    const countData = dates.map(date => dailySales[date].count);

    if (salesChart) {
        salesChart.destroy();
    }

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Sales Amount',
                data: salesData,
                borderColor: 'rgb(46, 204, 113)',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                tension: 0.4
            }, {
                label: 'Transaction Count',
                data: countData,
                borderColor: 'rgb(52, 152, 219)',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true
                }
            }
        }
    });
}

// Generate profit chart
function generateProfitChart(sales, fromDate, toDate) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    const dailyProfit = {};
    sales.forEach(sale => {
        let dateStr = 'Unknown';
        try {
            const d = new Date(sale.date);
            if (!isNaN(d.getTime())) {
                dateStr = d.toISOString().split('T')[0];
            } else {
                if (sale.date && sale.date.includes('-')) {
                    const parts = sale.date.split('-');
                    if (parts[0].length === 2) dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    else dateStr = sale.date.substring(0, 10);
                }
            }
        } catch(e) {}
        
        if (!dailyProfit[dateStr]) {
            dailyProfit[dateStr] = { profit: 0, cost: 0, sales: 0 };
        }
        dailyProfit[dateStr].profit += sale.items.reduce((sum, item) => sum + (item.profit || 0), 0);
        dailyProfit[dateStr].cost += sale.items.reduce((sum, item) => sum + ((item.cost || 0) * item.qty), 0);
        dailyProfit[dateStr].sales += (sale.total || 0);
    });

    const dates = Object.keys(dailyProfit).sort();
    const profitData = dates.map(date => dailyProfit[date].profit);
    const costData = dates.map(date => dailyProfit[date].cost);
    const salesData = dates.map(date => dailyProfit[date].sales);

    if (salesChart) {
        salesChart.destroy();
    }

    salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Profit',
                data: profitData,
                backgroundColor: 'rgba(46, 204, 113, 0.8)'
            }, {
                label: 'Cost',
                data: costData,
                backgroundColor: 'rgba(231, 76, 60, 0.8)'
            }, {
                label: 'Sales',
                data: salesData,
                backgroundColor: 'rgba(52, 152, 219, 0.8)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Generate employee chart
function generateEmployeeChart(statsArray) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    const labels = statsArray.map(stat => stat.name || stat.salesCode);
    const salesData = statsArray.map(stat => stat.totalSales);

    if (salesChart) {
        salesChart.destroy();
    }

    salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Sales',
                data: salesData,
                backgroundColor: 'rgba(52, 152, 219, 0.8)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Generate product chart
function generateProductChart(statsArray) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    const labels = statsArray.map(stat => stat.name || stat.code);
    const salesData = statsArray.map(stat => stat.totalSales);

    if (salesChart) {
        salesChart.destroy();
    }

    salesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sales',
                data: salesData,
                backgroundColor: [
                    'rgba(52, 152, 219, 0.8)',
                    'rgba(46, 204, 113, 0.8)',
                    'rgba(243, 156, 18, 0.8)',
                    'rgba(231, 76, 60, 0.8)',
                    'rgba(155, 89, 182, 0.8)',
                    'rgba(26, 188, 156, 0.8)',
                    'rgba(241, 196, 15, 0.8)',
                    'rgba(230, 126, 34, 0.8)',
                    'rgba(149, 165, 166, 0.8)',
                    'rgba(52, 73, 94, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true
        }
    });
}

// Export report to PDF
function exportReportPDF() {
    printReport();
}

// Export report to Excel
function exportReportExcel() {
    const reportType = document.getElementById('reportType').value;
    const fromDate = document.getElementById('reportFromDate').value;
    const toDate = document.getElementById('reportToDate').value;

    let csvContent = `Report Type: ${reportType}\n`;
    csvContent += `From: ${fromDate} To: ${toDate}\n\n`;

    const table = document.getElementById('reportTable');
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = Array.from(cols).map(col => `"${col.textContent.trim()}"`).join(',');
        csvContent += rowData + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `report_${reportType}_${fromDate}_${toDate}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert('Report exported to CSV successfully!');
}

// Print report
function printReport() {
    // Inject 80mm @page for Epson thermal receipt printer
    const style = document.createElement('style');
    style.id = 'reportPageStyle';
    style.media = 'print';
    style.textContent = `
        @page { 
            size: 80mm auto; 
            margin: 0; 
        }
        @media print {
            body { 
                background: #fff !important; 
                padding: 0 !important;
                margin: 0 !important;
            }
            .navbar, .btn, .card-header, .page-header, .filters, .app-footer { 
                display: none !important; 
            }
            .container {
                width: 80mm !important;
                max-width: 80mm !important;
                padding: 5mm !important;
                margin: 0 !important;
                box-shadow: none !important;
            }
            .card {
                box-shadow: none !important;
                border: 1px solid #000 !important;
                margin-bottom: 5px !important;
                padding: 5px !important;
                width: 100% !important;
            }
            .stats-grid {
                display: block !important;
            }
            .stat-card {
                border: 1px solid #000 !important;
                margin-bottom: 5px !important;
                padding: 5px !important;
            }
            table {
                font-size: 10px !important;
            }
            th, td {
                padding: 2px !important;
                border: 1px solid #000 !important;
            }
            canvas {
                max-width: 100% !important;
            }
        }
    `;
    document.head.appendChild(style);

    window.print();

    // Cleanup after print
    setTimeout(() => {
        if (document.getElementById('reportPageStyle')) {
            document.head.removeChild(style);
        }
    }, 1000);
}

