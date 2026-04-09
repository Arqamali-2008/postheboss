// analysis.js

let charts = {};
let currentAnalysisItems = [];

document.addEventListener('DOMContentLoaded', () => {
    populateFilters();
    handleTimeFilterChange(); // this will set default dates and call runAnalysis()
});

function populateFilters() {
    const products = getProducts();
    const employees = getEmployees();
    const companies = JSON.parse(localStorage.getItem('support_company') || '[]');
    const cat1 = JSON.parse(localStorage.getItem('support_category1') || '[]');
    const cat2 = JSON.parse(localStorage.getItem('support_category2') || '[]');

    const pSelect = document.getElementById('analysisProduct');
    const eSelect = document.getElementById('analysisEmployee');
    const cSelect = document.getElementById('analysisCompany');
    const c1Select = document.getElementById('analysisCategory1');
    const c2Select = document.getElementById('analysisCategory2');

    products.forEach(p => pSelect.add(new Option(p.name, p.itemCode)));
    employees.forEach(e => eSelect.add(new Option(e.name, e.salesCode)));
    companies.forEach(c => cSelect.add(new Option(c.name, c.name)));
    cat1.forEach(c => c1Select.add(new Option(c.name, c.name)));
    cat2.forEach(c => c2Select.add(new Option(c.name, c.name)));
}

function handleTimeFilterChange() {
    const val = document.getElementById('analysisTimeFilter').value;
    const fromG = document.getElementById('customDateFromGroup');
    const toG = document.getElementById('customDateToGroup');

    if (val === 'custom') {
        fromG.style.display = 'block';
        toG.style.display = 'block';
        return; // wait for user to input dates and change
    } else {
        fromG.style.display = 'none';
        toG.style.display = 'none';
    }

    const today = new Date();
    let fromDate = new Date();
    let toDate = new Date();

    if (val === 'today') {
        // already today
    } else if (val === '7days') {
        fromDate.setDate(today.getDate() - 7);
    } else if (val === 'this_month') {
        fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (val === 'last_month') {
        fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        toDate = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (val === 'this_year') {
        fromDate = new Date(today.getFullYear(), 0, 1);
    }

    document.getElementById('analysisFromDate').value = fromDate.toISOString().split('T')[0];
    document.getElementById('analysisToDate').value = toDate.toISOString().split('T')[0];
    runAnalysis();
}

function clearAnalysisFilters() {
    document.getElementById('analysisTimeFilter').value = 'this_month';
    document.getElementById('analysisEmployee').value = '';
    document.getElementById('analysisProduct').value = '';
    document.getElementById('analysisCompany').value = '';
    document.getElementById('analysisCategory1').value = '';
    document.getElementById('analysisCategory2').value = '';
    handleTimeFilterChange();
}

function runAnalysis() {
    let sales = getSales();
    const products = getProducts();

    const fromDate = document.getElementById('analysisFromDate').value;
    const toDate = document.getElementById('analysisToDate').value;
    const emp = document.getElementById('analysisEmployee').value;
    const prod = document.getElementById('analysisProduct').value;
    const comp = document.getElementById('analysisCompany').value;
    const cat1 = document.getElementById('analysisCategory1').value;
    const cat2 = document.getElementById('analysisCategory2').value;

    // Filter by dates
    if (fromDate) {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        sales = sales.filter(s => new Date(s.date) >= from);
    }
    if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        sales = sales.filter(s => new Date(s.date) <= to);
    }

    // Filter by employee
    if (emp) sales = sales.filter(s => s.salesCode === emp);

    // Expand items and apply product filters
    let expandedItems = [];
    sales.forEach(sale => {
        sale.items.forEach(item => {
            const productDef = products.find(p => p.itemCode === item.code) || {};
            expandedItems.push({
                ...item,
                date: sale.date,
                salesCode: sale.salesCode,
                company: productDef.company || '',
                category1: productDef.category1 || '',
                category2: productDef.category2 || ''
            });
        });
    });

    if (prod) expandedItems = expandedItems.filter(i => i.code === prod);
    if (comp) expandedItems = expandedItems.filter(i => i.company === comp);
    if (cat1) expandedItems = expandedItems.filter(i => i.category1 === cat1);
    if (cat2) expandedItems = expandedItems.filter(i => i.category2 === cat2);

    // Now build data for graphs
    drawGraphs(expandedItems, sales, products);
    renderHeatmap(sales);
    renderTopProducts(expandedItems);

    currentAnalysisItems = expandedItems;
    renderAnalysisTable();
}

function renderAnalysisTable() {
    const search = (document.getElementById('analysisTableSearch')?.value || '').toLowerCase();

    let grouped = {};
    currentAnalysisItems.forEach(i => {
        const key = i.code + '_' + i.salesCode;
        if (!grouped[key]) {
            grouped[key] = {
                code: i.code,
                name: i.name || '',
                company: i.company || '',
                category1: i.category1 || '',
                category2: i.category2 || '',
                salesCode: i.salesCode || '',
                qty: 0,
                sales: 0,
                profit: 0
            };
        }
        grouped[key].qty += i.qty || 0;
        grouped[key].sales += i.total || 0;
        grouped[key].profit += i.profit || 0;
    });

    let tableItems = Object.values(grouped);

    const employees = getEmployees();
    tableItems.forEach(t => {
        const emp = employees.find(e => e.salesCode === t.salesCode);
        t.empName = emp ? emp.name : 'Unknown';
    });

    if (search) {
        tableItems = tableItems.filter(t =>
            (t.code && t.code.toLowerCase().includes(search)) ||
            (t.name && t.name.toLowerCase().includes(search)) ||
            (t.company && t.company.toLowerCase().includes(search)) ||
            (t.category1 && t.category1.toLowerCase().includes(search)) ||
            (t.category2 && t.category2.toLowerCase().includes(search)) ||
            (t.salesCode && t.salesCode.toLowerCase().includes(search)) ||
            (t.empName && t.empName.toLowerCase().includes(search))
        );
    }

    const tbody = document.getElementById('analysisDataBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let totQty = 0;
    let totSales = 0;
    let totProfit = 0;

    tableItems.forEach(t => {
        totQty += t.qty;
        totSales += t.sales;
        totProfit += t.profit;

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        tr.innerHTML = `
            <td style="padding: 10px;">${t.code}</td>
            <td style="padding: 10px;">${t.name}</td>
            <td style="padding: 10px;">${t.company}</td>
            <td style="padding: 10px;">${t.category1}</td>
            <td style="padding: 10px;">${t.category2}</td>
            <td style="padding: 10px;">${t.empName} (${t.salesCode})</td>
            <td style="padding: 10px; text-align: right;">${t.qty}</td>
            <td style="padding: 10px; text-align: right;">${formatCurrency(t.sales)}</td>
            <td style="padding: 10px; text-align: right; color: ${t.profit < 0 ? 'var(--accent-danger)' : 'inherit'}">${formatCurrency(t.profit)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('totQty').innerText = totQty;
    document.getElementById('totSales').innerText = formatCurrency(totSales);
    document.getElementById('totProfit').innerText = formatCurrency(totProfit);
}

function createChart(ctxId, type, data, options) {
    if (charts[ctxId]) charts[ctxId].destroy();
    const ctx = document.getElementById(ctxId).getContext('2d');
    charts[ctxId] = new Chart(ctx, { type, data, options });
}

function drawGraphs(items, sales, products) {
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#2c3e50';
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#dcdde1';

    const bgColors = ['rgba(54, 162, 235, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)', 'rgba(255, 99, 132, 0.6)'];

    // --- Employee Analysis ---
    let empStats = {};
    items.forEach(i => {
        const e = i.salesCode || 'Unknown';
        if (!empStats[e]) empStats[e] = { qty: 0, sales: 0, profit: 0, cat1: {}, cat2: {} };
        empStats[e].qty += i.qty;
        empStats[e].sales += i.total;
        empStats[e].profit += (i.profit || 0);
        const c1 = i.category1 || 'Uncategorized';
        const c2 = i.category2 || 'Uncategorized';
        empStats[e].cat1[c1] = (empStats[e].cat1[c1] || 0) + i.qty;
        empStats[e].cat2[c2] = (empStats[e].cat2[c2] || 0) + i.qty;
    });
    const empLabels = Object.keys(empStats);

    createChart('empProdChart', 'line', {
        labels: empLabels,
        datasets: [{ label: 'Products Sold (Qty)', data: empLabels.map(e => empStats[e].qty), borderColor: bgColors[0], fill: true, backgroundColor: 'rgba(54, 162, 235, 0.1)' }]
    });
    createChart('empSalesChart', 'line', {
        labels: empLabels,
        datasets: [{ label: 'Total Sales (₹)', data: empLabels.map(e => empStats[e].sales), borderColor: bgColors[1], fill: true, backgroundColor: 'rgba(75, 192, 192, 0.1)' }]
    });
    createChart('empProfitChart', 'line', {
        labels: empLabels,
        datasets: [{ label: 'Profit (₹)', data: empLabels.map(e => empStats[e].profit), borderColor: bgColors[2], fill: true, backgroundColor: 'rgba(153, 102, 255, 0.1)' }]
    });

    // Employee vs Category 1 (Stacked Bar)
    let cat1Keys = new Set();
    empLabels.forEach(e => Object.keys(empStats[e].cat1).forEach(c => cat1Keys.add(c)));
    cat1Keys = Array.from(cat1Keys);
    const cat1Datasets = cat1Keys.map((c, idx) => ({
        label: c,
        data: empLabels.map(e => empStats[e].cat1[c] || 0),
        backgroundColor: bgColors[idx % bgColors.length]
    }));
    createChart('empCat1Chart', 'bar', {
        labels: empLabels,
        datasets: cat1Datasets,
        options: { scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    // Employee vs Category 2
    let cat2Keys = new Set();
    empLabels.forEach(e => Object.keys(empStats[e].cat2).forEach(c => cat2Keys.add(c)));
    cat2Keys = Array.from(cat2Keys);
    const cat2Datasets = cat2Keys.map((c, idx) => ({
        label: c,
        data: empLabels.map(e => empStats[e].cat2[c] || 0),
        backgroundColor: bgColors[idx % bgColors.length]
    }));
    createChart('empCat2Chart', 'bar', {
        labels: empLabels,
        datasets: cat2Datasets,
        options: { scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    // --- Product Analysis ---
    let prodStats = {};
    items.forEach(i => {
        const p = i.name;
        if (!prodStats[p]) prodStats[p] = { qty: 0, sales: 0, profit: 0 };
        prodStats[p].qty += i.qty;
        prodStats[p].sales += i.total;
        prodStats[p].profit += (i.profit || 0);
    });
    const prodLabels = Object.keys(prodStats);

    createChart('prodProfitChart', 'line', {
        labels: prodLabels,
        datasets: [{ label: 'Profit (₹)', data: prodLabels.map(p => prodStats[p].profit), borderColor: bgColors[3], fill: true, backgroundColor: 'rgba(255, 159, 64, 0.1)' }]
    });
    createChart('prodSalesChart', 'line', {
        labels: prodLabels,
        datasets: [{ label: 'Total Sales (₹)', data: prodLabels.map(p => prodStats[p].sales), borderColor: bgColors[4], fill: true, backgroundColor: 'rgba(255, 99, 132, 0.1)' }]
    });

    // Product vs Category 1 & 2
    let cat1Stats = {};
    let cat2Stats = {};
    items.forEach(i => {
        const c1 = i.category1 || 'Uncategorized';
        const c2 = i.category2 || 'Uncategorized';
        cat1Stats[c1] = (cat1Stats[c1] || 0) + i.qty;
        cat2Stats[c2] = (cat2Stats[c2] || 0) + i.qty;
    });

    createChart('prodCat1Chart', 'line', {
        labels: Object.keys(cat1Stats),
        datasets: [{ label: 'Qty Sold', data: Object.values(cat1Stats), borderColor: bgColors[0], fill: true, backgroundColor: 'rgba(54, 162, 235, 0.1)' }]
    });

    createChart('prodCat2Chart', 'line', {
        labels: Object.keys(cat2Stats),
        datasets: [{ label: 'Qty Sold', data: Object.values(cat2Stats), borderColor: bgColors[1], fill: true, backgroundColor: 'rgba(75, 192, 192, 0.1)' }]
    });

    // Performance (Top 20)
    let topProds = [...prodLabels].sort((a, b) => prodStats[b].qty - prodStats[a].qty).slice(0, 20);
    createChart('topProdChart', 'bar', {
        labels: topProds,
        datasets: [{ label: 'Qty Sold', data: topProds.map(p => prodStats[p].qty), backgroundColor: bgColors[0] }],
        options: { indexAxis: 'y' }
    });

    let topEmps = [...empLabels].sort((a, b) => empStats[b].sales - empStats[a].sales).slice(0, 20);
    createChart('topEmpChart', 'bar', {
        labels: topEmps,
        datasets: [{ label: 'Total Sales', data: topEmps.map(e => empStats[e].sales), backgroundColor: bgColors[1] }],
        options: { indexAxis: 'y' }
    });

    // Trend Analysis
    let dayStats = {};
    let monthStats = {};
    items.forEach(i => {
        const dStr = i.date.split('T')[0];
        const mStr = dStr.substring(0, 7);
        dayStats[dStr] = (dayStats[dStr] || 0) + i.total;
        monthStats[mStr] = (monthStats[mStr] || 0) + i.total;
    });
    const dKeys = Object.keys(dayStats).sort();
    createChart('trendDayChart', 'line', {
        labels: dKeys,
        datasets: [{ label: 'Sales by Day', data: dKeys.map(k => dayStats[k]), borderColor: bgColors[0], fill: false }]
    });
    const mKeys = Object.keys(monthStats).sort();
    createChart('trendMonthChart', 'bar', {
        labels: mKeys,
        datasets: [{ label: 'Sales by Month', data: mKeys.map(k => monthStats[k]), backgroundColor: bgColors[2] }]
    });

    // Advanced Analysis
    const metric = document.getElementById('advMetric').value;
    const getValue = (i) => metric === 'sales' ? i.total : (i.profit || 0);

    // Advanced Month-to-Month Day 1-31
    const advAllSales = getSales(); // need all sales to compare past
    let advItems = [];
    advAllSales.forEach(sale => sale.items.forEach(i => advItems.push({ ...i, date: sale.date })));

    const now = new Date();
    const currM = now.getMonth();
    const currY = now.getFullYear();
    const prevM = currM === 0 ? 11 : currM - 1;
    const prevY = currM === 0 ? currY - 1 : currY;

    let currData = Array(31).fill(0);
    let prevData = Array(31).fill(0);

    advItems.forEach(i => {
        const d = new Date(i.date);
        const dayIdx = d.getDate() - 1;
        if (d.getMonth() === currM && d.getFullYear() === currY) currData[dayIdx] += getValue(i);
        if (d.getMonth() === prevM && d.getFullYear() === prevY) prevData[dayIdx] += getValue(i);
    });

    createChart('advMonth2MonthChart', 'line', {
        labels: Array.from({ length: 31 }, (_, i) => i + 1),
        datasets: [
            { label: 'Current Month', data: currData, borderColor: bgColors[0] },
            { label: 'Previous Month', data: prevData, borderColor: bgColors[1] }
        ]
    });

    // This Year Day vs Last Year Same Day (Let's use current month's days)
    let tyDay = Array(31).fill(0);
    let lyDay = Array(31).fill(0);
    advItems.forEach(i => {
        const d = new Date(i.date);
        const dayIdx = d.getDate() - 1;
        if (d.getMonth() === currM && d.getFullYear() === currY) tyDay[dayIdx] += getValue(i);
        if (d.getMonth() === currM && d.getFullYear() === currY - 1) lyDay[dayIdx] += getValue(i);
    });
    createChart('advYearDayChart', 'line', {
        labels: Array.from({ length: 31 }, (_, i) => i + 1),
        datasets: [
            { label: 'This Year (Same Month)', data: tyDay, borderColor: bgColors[2] },
            { label: 'Last Year (Same Month)', data: lyDay, borderColor: bgColors[3] }
        ]
    });

    // This Year Month vs Last Year Month (All months)
    let tyMonth = Array(12).fill(0);
    let lyMonth = Array(12).fill(0);
    advItems.forEach(i => {
        const d = new Date(i.date);
        const mIdx = d.getMonth();
        if (d.getFullYear() === currY) tyMonth[mIdx] += getValue(i);
        if (d.getFullYear() === currY - 1) lyMonth[mIdx] += getValue(i);
    });
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    createChart('advYearMonthChart', 'line', {
        labels: months,
        datasets: [
            { label: 'This Year', data: tyMonth, borderColor: bgColors[4] },
            { label: 'Last Year', data: lyMonth, borderColor: bgColors[0] }
        ]
    });

    // Full Year Comparison
    createChart('advFullYearChart', 'bar', {
        labels: months,
        datasets: [
            { label: 'This Year', data: tyMonth, backgroundColor: bgColors[1] },
            { label: 'Last Year', data: lyMonth, backgroundColor: bgColors[2] }
        ]
    });
}

function renderHeatmap(sales) {
    const container = document.getElementById('salesHeatmap');
    if (!container) return;
    container.innerHTML = '';

    // Group sales by day of week (0-6)
    const dayStats = Array(7).fill(0);
    sales.forEach(s => {
        const d = new Date(s.date).getDay(); // 0 is Sun, 1 is Mon...
        dayStats[d] += s.total;
    });

    // Reorder to Mon-Sun (1, 2, 3, 4, 5, 6, 0)
    const monToSun = [1, 2, 3, 4, 5, 6, 0];
    const maxVal = Math.max(...dayStats, 1);

    monToSun.forEach(d => {
        const val = dayStats[d];
        const intensity = (val / maxVal) * 100;
        const color = `rgba(52, 152, 219, ${0.1 + (val / maxVal) * 0.9})`;

        const segment = document.createElement('div');
        segment.className = 'heatmap-day';
        segment.style.flex = '1';
        segment.innerHTML = `
            <div class="heatmap-bar" style="height: ${Math.max(20, intensity)}px; background: ${color}; width: 100%; border-radius: 4px;" data-value="${formatCurrency(val)}"></div>
        `;
        container.appendChild(segment);
    });
}

function renderTopProducts(items) {
    const container = document.getElementById('topProductsWidget');
    if (!container) return;
    container.innerHTML = '';

    const prodCounts = {};
    items.forEach(i => {
        const name = i.name || 'Unknown';
        prodCounts[name] = (prodCounts[name] || 0) + i.qty;
    });

    const sorted = Object.entries(prodCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

    if (sorted.length === 0) {
        container.innerHTML = '<p class="text-center" style="padding: 20px;">No sales data available for this range.</p>';
        return;
    }

    sorted.forEach(([name, qty], idx) => {
        const item = document.createElement('div');
        item.className = 'top-product-item';
        item.style.cssText = 'display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);';
        item.innerHTML = `
            <span><strong>${idx + 1}.</strong> ${name}</span>
            <span style="color:var(--accent-success); font-weight:bold;">${qty} sold</span>
        `;
        container.appendChild(item);
    });
}
