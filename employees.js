// ===== EMPLOYEE MANAGEMENT FUNCTIONALITY =====

let editingEmployee = null;

// Initialize employees page
document.addEventListener('DOMContentLoaded', function() {
    loadEmployees();
});

// Load employees
function loadEmployees() {
    const employees = getEmployees();
    const sales = getSales();
    
    const tbody = document.getElementById('employeesTableBody');
    tbody.innerHTML = '';
    
    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No employees found</td></tr>';
        return;
    }
    
    employees.forEach(emp => {
        // Calculate employee sales stats
        const employeeSales = sales.filter(s => s.salesCode === emp.salesCode);
        const totalSales = employeeSales.reduce((sum, s) => sum + s.total, 0);
        const totalProfit = employeeSales.reduce((sum, s) => 
            sum + s.items.reduce((itemSum, item) => itemSum + (item.profit || 0), 0), 0
        );
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${emp.salesCode}</td>
            <td>${emp.name}</td>
            <td>${emp.role || '-'}</td>
            <td>${emp.contact || '-'}</td>
            <td>${formatCurrency(emp.salary || 0)}</td>
            <td>${formatCurrency(totalSales)}</td>
            <td>${formatCurrency(totalProfit)}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editEmployee('${emp.salesCode}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${emp.salesCode}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Open employee modal
function openEmployeeModal() {
    editingEmployee = null;
    document.getElementById('employeeModalTitle').textContent = 'Add Employee';
    document.getElementById('employeeForm').reset();
    document.getElementById('employeeModal').classList.add('active');
    document.getElementById('empSalesCode').disabled = false;
    document.getElementById('empSalesCode').focus();
}

// Close employee modal
function closeEmployeeModal() {
    document.getElementById('employeeModal').classList.remove('active');
    editingEmployee = null;
    document.getElementById('employeeForm').reset();
}

// Edit employee
function editEmployee(salesCode) {
    const employees = getEmployees();
    const emp = employees.find(e => e.salesCode === salesCode);
    
    if (!emp) {
        alert('Employee not found!');
        return;
    }
    
    editingEmployee = emp;
    document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
    document.getElementById('empSalesCode').value = emp.salesCode;
    document.getElementById('empSalesCode').disabled = true;
    document.getElementById('empName').value = emp.name || '';
    document.getElementById('empRole').value = emp.role || '';
    document.getElementById('empContact').value = emp.contact || '';
    document.getElementById('empSalary').value = emp.salary || '';
    document.getElementById('employeeModal').classList.add('active');
    document.getElementById('empName').focus();
}

// Save employee
function saveEmployee(event) {
    event.preventDefault();
    
    const employee = {
        salesCode: document.getElementById('empSalesCode').value.trim(),
        name: document.getElementById('empName').value.trim(),
        role: document.getElementById('empRole').value.trim(),
        contact: document.getElementById('empContact').value.trim(),
        salary: parseFloat(document.getElementById('empSalary').value) || 0
    };
    
    if (!employee.salesCode || !employee.name) {
        alert('Please fill in all required fields!');
        return;
    }
    
    // Check for duplicate sales code (only when adding new)
    if (!editingEmployee) {
        const existing = getEmployees().find(e => e.salesCode === employee.salesCode);
        if (existing) {
            alert('Sales Code already exists!');
            return;
        }
    }
    
    saveEmployeeData(employee);
    
    // Sync to EMS
    if (typeof autoSyncOnEmployeeSave === 'function') {
        autoSyncOnEmployeeSave(employee, 'POS');
    }
    
    loadEmployees();
    closeEmployeeModal();
    
    // Reload employees in POS page if it exists
    if (typeof loadEmployees === 'function' && window.location.pathname.includes('index.html')) {
        // This will be handled by the POS page itself
    }
}

// Delete employee
function deleteEmployee(salesCode) {
    if (!confirm(`Are you sure you want to delete employee ${salesCode}?`)) {
        return;
    }
    
    // Check if employee has sales
    const sales = getSales();
    const hasSales = sales.some(s => s.salesCode === salesCode);
    
    if (hasSales) {
        if (!confirm('This employee has sales records. Deleting will not remove sales data. Continue?')) {
            return;
        }
    }
    
    deleteEmployeeData(salesCode);
    loadEmployees();
}

