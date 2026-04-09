// ===== SALES HISTORY FUNCTIONALITY =====

let allSales = [];
let filteredSales = [];
let currentTab = 'all';
let loanEditId = null;

// Initialize sales page
document.addEventListener('DOMContentLoaded', function () {
    loadSales();
    loadEmployeesForFilter();
});

// Load all sales
function loadSales() {
    allSales = getSales();
    filteredSales = [...allSales];
    renderSales();
    updateSummary();
}

// Load employees for filter
function loadEmployeesForFilter() {
    const employees = getEmployees();
    const select = document.getElementById('filterSalesCode');
    select.innerHTML = '<option value="">All Employees</option>';

    employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.salesCode;
        option.textContent = `${emp.salesCode} - ${emp.name}`;
        select.appendChild(option);
    });
}

// Filter sales
function filterSales() {
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    const salesCode = document.getElementById('filterSalesCode').value;
    const paymentMethod = document.getElementById('filterPaymentMethod').value;

    filteredSales = getSalesByDateRange(fromDate, toDate);

    if (salesCode) {
        filteredSales = filteredSales.filter(sale => sale.salesCode === salesCode);
    }

    if (paymentMethod) {
        filteredSales = filteredSales.filter(sale => {
            const pt = sale.paymentType ? sale.paymentType.toLowerCase() : '';
            return pt.includes(paymentMethod.toLowerCase());
        });
    }

    renderSales();
    updateSummary();
}

// Clear filters
function clearFilters() {
    document.getElementById('filterFromDate').value = '';
    document.getElementById('filterToDate').value = '';
    document.getElementById('filterSalesCode').value = '';
    document.getElementById('filterPaymentMethod').value = '';
    filteredSales = [...allSales];
    renderSales();
    updateSummary();
}

// Render sales table
function renderSales() {
    const tbody = document.getElementById('salesTableBody');
    tbody.innerHTML = '';

    if (filteredSales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center">No sales records found</td></tr>';
        return;
    }

    filteredSales.forEach(sale => {
        sale.items.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index === 0 ? sale.invoiceNumber : ''}</td>
                <td>${index === 0 ? formatDate(sale.date) : ''}</td>
                <td>${item.code}</td>
                <td>${item.name}</td>
                <td>${item.qty}</td>
                <td>${formatCurrency(item.total)}</td>
                <td>${formatCurrency(item.profit)}</td>
                <td>${index === 0 ? sale.salesCode : ''}</td>
                <td>${index === 0 ? `${(sale.paymentType || '').toUpperCase()}${sale.chequeNumber ? ' - ' + sale.chequeNumber : ''}` : ''}</td>
                <td>
                    ${index === 0 ? `
                        <select onchange="updateSaleStatus('${sale.invoiceNumber}', this.value)" style="padding: 4px; border-radius: 4px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);">
                            <option value="Paid" ${sale.status === 'Paid' || (!sale.status && sale.balance === 0) ? 'selected' : ''}>Paid</option>
                            <option value="Unpaid" ${sale.status === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                            <option value="Loan" ${sale.status === 'Loan' ? 'selected' : ''}>Loan</option>
                        </select>
                    ` : ''}
                </td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteSalesItem('${sale.invoiceNumber}', ${index})">❌ Item</button>
                    ${index === 0 ? `<button class="btn btn-danger btn-sm" style="margin-top:5px;" onclick="deleteSalesBill('${sale.invoiceNumber}')">❌ Bill</button>` : ''}
                </td>
            `;
            tbody.appendChild(row);
        });
    });
}

// Update summary
function updateSummary() {
    const totalSalesAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalProfitAmount = filteredSales.reduce((sum, sale) =>
        sum + sale.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0), 0
    );

    const totalItems = filteredSales.reduce((sum, sale) =>
        sum + sale.items.reduce((itemSum, item) => itemSum + (parseFloat(item.qty) || 0), 0), 0
    );

    let paidSalesAmount = 0;
    let unpaidSalesAmount = 0;

    filteredSales.forEach(sale => {
        const s = sale.status || (sale.balance > 0 ? 'Partial' : 'Paid');
        if (s.toLowerCase() === 'unpaid') {
            unpaidSalesAmount += sale.total;
        } else if (s.toLowerCase() === 'partial') {
            paidSalesAmount += sale.paidAmount || 0;
            unpaidSalesAmount += sale.balance || 0;
        } else {
            paidSalesAmount += sale.total;
        }
    });

    document.getElementById('totalSales').textContent = formatCurrency(totalSalesAmount);
    document.getElementById('totalItemsSold').textContent = totalItems.toString();
    document.getElementById('totalProfit').textContent = formatCurrency(totalProfitAmount);
    document.getElementById('paidSales').textContent = formatCurrency(paidSalesAmount);
    document.getElementById('unpaidSales').textContent = formatCurrency(unpaidSalesAmount);
}

// Export to JSON
function exportSalesJSON() {
    if (filteredSales.length === 0) {
        alert('No sales to export!');
        return;
    }

    const jsonStr = JSON.stringify(filteredSales, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_2026.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Delete Action
window.deleteSalesItem = function (invoiceNumber, itemIndex) {
    if (!confirm('Are you sure you want to delete this item from the bill?')) return;
    const sales = getSales();
    const saleIndex = sales.findIndex(s => s.invoiceNumber === invoiceNumber);
    if (saleIndex >= 0) {
        sales[saleIndex].items.splice(itemIndex, 1);

        // Recalculate totals
        sales[saleIndex].subtotal = sales[saleIndex].items.reduce((sum, item) => sum + item.total, 0);
        sales[saleIndex].total = sales[saleIndex].subtotal - (sales[saleIndex].discount || 0);

        if (sales[saleIndex].items.length === 0) {
            sales.splice(saleIndex, 1);
        }
        localStorage.setItem('sales', JSON.stringify(sales));
        allSales = sales;
        filterSales(); // re-runs UI update
        // Also trigger cloud sync if connected
        if (window.SupabaseSyncService && window.SupabaseSyncService.isConnected) {
            window.SupabaseSyncService.syncTable('sales').catch(console.error);
        }
    }
};

window.deleteSalesBill = function (invoiceNumber) {
    if (!confirm('Are you sure you want to delete this ENTIRE bill?')) return;
    const sales = getSales();
    const filtered = sales.filter(s => s.invoiceNumber !== invoiceNumber);
    localStorage.setItem('sales', JSON.stringify(filtered));
    allSales = filtered;
    filterSales(); // re-runs UI update
    // Also trigger cloud sync if connected
    if (window.SupabaseSyncService && window.SupabaseSyncService.isConnected) {
        window.SupabaseSyncService.syncTable('sales').catch(console.error);
    }
};

// Print sales report
function printSalesReport() {
    if (filteredSales.length === 0) {
        alert('No sales to print!');
        return;
    }

    const printDiv = document.getElementById('salesPrint');
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;

    let dateRange = 'All Time';
    if (fromDate || toDate) {
        dateRange = `${fromDate || 'Start'} to ${toDate || 'End'}`;
    }
    document.getElementById('printReportDateRange').textContent = dateRange;

    // Calculate totals
    const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalProfit = filteredSales.reduce((sum, sale) =>
        sum + sale.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0), 0
    );
    const totalCount = filteredSales.length;

    document.getElementById('printTotalSales').textContent = formatCurrency(totalSales);
    document.getElementById('printTotalProfit').textContent = formatCurrency(totalProfit);
    document.getElementById('printTotalCount').textContent = totalCount;

    // Create table HTML
    let tableHtml = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f0f0f0;">
                    <th style="border: 1px solid #000; padding: 8px;">Invoice</th>
                    <th style="border: 1px solid #000; padding: 8px;">Date</th>
                    <th style="border: 1px solid #000; padding: 8px;">Item Code</th>
                    <th style="border: 1px solid #000; padding: 8px;">Item</th>
                    <th style="border: 1px solid #000; padding: 8px;">Qty</th>
                    <th style="border: 1px solid #000; padding: 8px;">Amount</th>
                    <th style="border: 1px solid #000; padding: 8px;">Profit</th>
                    <th style="border: 1px solid #000; padding: 8px;">Sales Code</th>
                </tr>
            </thead>
            <tbody>
    `;

    filteredSales.forEach(sale => {
        sale.items.forEach((item, index) => {
            tableHtml += `
                <tr>
                    <td style="border: 1px solid #000; padding: 8px;">${index === 0 ? sale.invoiceNumber : ''}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${index === 0 ? formatDate(sale.date) : ''}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${item.code}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${item.name}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${item.qty}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${formatCurrency(item.total)}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${formatCurrency(item.profit)}</td>
                    <td style="border: 1px solid #000; padding: 8px;">${index === 0 ? sale.salesCode : ''}</td>
                </tr>
            `;
        });
    });

    tableHtml += '</tbody></table>';
    document.getElementById('printSalesTable').innerHTML = tableHtml;

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
            .navbar, .btn, .card-header, .page-header, .filters, .app-footer, .nav-actions { 
                display: none !important; 
            }
            #salesPrint {
                display: block !important;
                width: 80mm !important;
                padding: 3mm !important;
                margin: 0 !important;
                font-family: 'Roboto Mono', monospace !important;
            }
            table {
                font-size: 9px !important;
                width: 100% !important;
            }
            th, td {
                padding: 2px !important;
                border: 1px solid #000 !important;
            }
        }
    `;
    document.head.appendChild(style);

    printDiv.style.display = 'block';
    window.print();
    
    // Cleanup
    setTimeout(() => {
        printDiv.style.display = 'none';
        if (document.getElementById('reportPageStyle')) {
            document.head.removeChild(style);
        }
    }, 1000);
}

// Loans Tab
function showSalesTab(which) {
    currentTab = which;
    document.getElementById('loansCard').style.display = which === 'loans' ? 'block' : 'none';
    if (which === 'loans') renderLoans();
}

function renderLoans() {
    const tbody = document.getElementById('loansTableBody');
    tbody.innerHTML = '';
    const loans = allSales.filter(s => (s.balance || s.loanAmount || 0) > 0 || s.status === 'Loan');
    if (loans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No loans found</td></tr>';
        return;
    }
    loans.forEach(sale => {
        const row = document.createElement('tr');
        const loanAmt = sale.loanAmount != null ? sale.loanAmount : Math.max(0, (sale.total || 0) - (sale.paidAmount || 0));
        row.innerHTML = `
            <td>${sale.invoiceNumber}</td>
            <td>${formatDate(sale.date)}</td>
            <td>${sale.customerName || '-'}</td>
            <td>${sale.customerContact || '-'}</td>
            <td>${formatCurrency(loanAmt)}</td>
            <td>${sale.status || 'Partial'}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="openLoanEdit('${sale.invoiceNumber}')">Edit</button>
                <button class="btn btn-success btn-sm" onclick="markLoanCleared('${sale.invoiceNumber}')">Mark Cleared</button>
                <button class="btn btn-danger btn-sm" onclick="deleteLoan('${sale.invoiceNumber}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function markLoanCleared(invoiceId) {
    const sales = getSales();
    const idx = sales.findIndex(s => s.invoiceNumber === invoiceId);
    if (idx < 0) return;
    sales[idx].paidAmount = sales[idx].total;
    sales[idx].balance = 0;
    sales[idx].loanAmount = 0;
    sales[idx].status = 'Cleared';
    localStorage.setItem('sales', JSON.stringify(sales));
    loadSales();
    if (currentTab === 'loans') renderLoans();
}

function deleteLoan(invoiceId) {
    if (!confirm('Delete this loan record? This deletes the entire sale entry.')) return;
    let sales = getSales();
    sales = sales.filter(s => s.invoiceNumber !== invoiceId);
    localStorage.setItem('sales', JSON.stringify(sales));
    loadSales();
    if (currentTab === 'loans') renderLoans();
}

function openLoanEdit(invoiceId) {
    const sales = getSales();
    const sale = sales.find(s => s.invoiceNumber === invoiceId);
    if (!sale) return;
    loanEditId = invoiceId;
    document.getElementById('loanEditCustomer').value = sale.customerName || '';
    document.getElementById('loanEditContact').value = sale.customerContact || '';
    const loanAmt = sale.loanAmount != null ? sale.loanAmount : Math.max(0, (sale.total || 0) - (sale.paidAmount || 0));
    document.getElementById('loanEditAmount').value = loanAmt;
    document.getElementById('loanEditStatus').value = sale.status || 'Partial';
    document.getElementById('loanEditModal').classList.add('active');
}

function closeLoanEditModal() {
    loanEditId = null;
    document.getElementById('loanEditModal').classList.remove('active');
}

function saveLoanEdit() {
    if (!loanEditId) return;
    const sales = getSales();
    const idx = sales.findIndex(s => s.invoiceNumber === loanEditId);
    if (idx < 0) return;
    const loanAmount = parseFloat(document.getElementById('loanEditAmount').value) || 0;
    const status = document.getElementById('loanEditStatus').value;
    sales[idx].customerName = document.getElementById('loanEditCustomer').value.trim();
    sales[idx].customerContact = document.getElementById('loanEditContact').value.trim();
    sales[idx].loanAmount = loanAmount;
    if (status === 'Cleared') {
        sales[idx].paidAmount = sales[idx].total;
        sales[idx].balance = 0;
        sales[idx].loanAmount = 0;
    } else {
        sales[idx].balance = loanAmount;
    }
    sales[idx].status = status;
    localStorage.setItem('sales', JSON.stringify(sales));
    closeLoanEditModal();
    loadSales();
    if (currentTab === 'loans') renderLoans();
}

// Update sale status
window.updateSaleStatus = function (invoiceNumber, newStatus) {
    const sales = getSales();
    const idx = sales.findIndex(s => s.invoiceNumber === invoiceNumber);
    if (idx < 0) return;

    sales[idx].status = newStatus;

    if (newStatus === 'Loan') {
        if (!sales[idx].balance) sales[idx].balance = sales[idx].total - (sales[idx].paidAmount || 0);
        setTimeout(() => {
            openLoanEdit(invoiceNumber);
        }, 100);
    } else if (newStatus === 'Paid') {
        sales[idx].balance = 0;
        sales[idx].paidAmount = sales[idx].total;
        sales[idx].loanAmount = 0;
    } else if (newStatus === 'Unpaid') {
        sales[idx].balance = sales[idx].total;
        sales[idx].paidAmount = 0;
        sales[idx].loanAmount = 0;
    }

    localStorage.setItem('sales', JSON.stringify(sales));
    loadSales();
    if (currentTab === 'loans') renderLoans();

    if (window.SupabaseSyncService && window.SupabaseSyncService.isConnected) {
        window.SupabaseSyncService.syncTable('sales').catch(console.error);
    }

    alert(`Status updated to ${newStatus}`);
}
