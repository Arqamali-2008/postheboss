// ===== DASHBOARD FUNCTIONALITY =====

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadDashboardStats();
});

// Load dashboard statistics
function loadDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sales = getSales();
    const todaySales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
    });
    
    // Calculate today's totals
    const todayTotalSales = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const todayTotalProfit = todaySales.reduce((sum, sale) => 
        sum + sale.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0), 0
    );
    const todayCount = todaySales.length;
    
    document.getElementById('todaySales').textContent = formatCurrency(todayTotalSales);
    document.getElementById('todayProfit').textContent = formatCurrency(todayTotalProfit);
    document.getElementById('todayCount').textContent = todayCount;
    
    // Calculate top employee
    const employeeSales = {};
    todaySales.forEach(sale => {
        if (!employeeSales[sale.salesCode]) {
            employeeSales[sale.salesCode] = 0;
        }
        employeeSales[sale.salesCode] += sale.total;
    });
    
    const topEmployeeCode = Object.keys(employeeSales).reduce((a, b) => 
        employeeSales[a] > employeeSales[b] ? a : b, Object.keys(employeeSales)[0]
    );
    
    if (topEmployeeCode) {
        const employees = getEmployees();
        const topEmp = employees.find(e => e.salesCode === topEmployeeCode);
        document.getElementById('topEmployee').textContent = topEmp ? `${topEmp.name} (${topEmployeeCode})` : topEmployeeCode;
    } else {
        document.getElementById('topEmployee').textContent = '-';
    }
    
    // Calculate top items
    const itemSales = {};
    todaySales.forEach(sale => {
        sale.items.forEach(item => {
            if (!itemSales[item.code]) {
                itemSales[item.code] = {
                    name: item.name,
                    qty: 0,
                    amount: 0
                };
            }
            itemSales[item.code].qty += item.qty;
            itemSales[item.code].amount += item.total;
        });
    });
    
    const topItems = Object.entries(itemSales)
        .sort((a, b) => b[1].qty - a[1].qty)
        .slice(0, 10);
    
    const tbody = document.getElementById('topItemsTableBody');
    tbody.innerHTML = '';
    
    if (topItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No sales today</td></tr>';
        return;
    }
    
    topItems.forEach(([code, data]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${code}</td>
            <td>${data.name}</td>
            <td>${data.qty}</td>
            <td>${formatCurrency(data.amount)}</td>
        `;
        tbody.appendChild(row);
    });
}

