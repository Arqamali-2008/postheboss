// ===== CUSTOMER MANAGEMENT FUNCTIONALITY =====

let editingCustomer = null;

// Initialize customers page
document.addEventListener('DOMContentLoaded', function() {
    loadCustomers();
    initCustomerStorage();
});

// Initialize customer storage
function initCustomerStorage() {
    if (!localStorage.getItem('customers')) {
        localStorage.setItem('customers', JSON.stringify([]));
    }
}

// Get all customers
function getCustomers() {
    return JSON.parse(localStorage.getItem('customers') || '[]');
}

// Save customer
function saveCustomerData(customer) {
    const customers = getCustomers();
    const index = customers.findIndex(c => c.id === customer.id);
    if (index >= 0) {
        customers[index] = customer;
    } else {
        customers.push(customer);
    }
    localStorage.setItem('customers', JSON.stringify(customers));
    return customers;
}

// Delete customer
function deleteCustomerData(customerId) {
    const customers = getCustomers();
    const filtered = customers.filter(c => c.id !== customerId);
    localStorage.setItem('customers', JSON.stringify(filtered));
    return filtered;
}

// Get customer by ID
function getCustomerById(customerId) {
    return getCustomers().find(c => c.id === customerId);
}

// Get customer purchase history
function getCustomerPurchases(customerId) {
    const sales = getSales();
    return sales.filter(sale => 
        sale.customerId === customerId || 
        (sale.customerName && sale.customerContact && 
         getCustomers().find(c => c.id === customerId && 
         c.name === sale.customerName && c.phone === sale.customerContact))
    );
}

// Calculate customer outstanding loan
function getCustomerLoan(customerId) {
    const purchases = getCustomerPurchases(customerId);
    return purchases.reduce((total, sale) => {
        return total + (sale.balance || 0);
    }, 0);
}

// Load customers
function loadCustomers() {
    const customers = getCustomers();
    const tbody = document.getElementById('customersTableBody');
    tbody.innerHTML = '';
    
    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No customers found</td></tr>';
        return;
    }
    
    customers.forEach(customer => {
        const loan = getCustomerLoan(customer.id);
        const purchases = getCustomerPurchases(customer.id);
        const totalPurchases = purchases.reduce((sum, sale) => sum + sale.total, 0);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${customer.id}</td>
            <td><strong>${customer.name}</strong></td>
            <td>${customer.phone}</td>
            <td>${customer.email || '-'}</td>
            <td>${formatCurrency(totalPurchases)}</td>
            <td>${loan > 0 ? `<span style="color: var(--danger);">${formatCurrency(loan)}</span>` : formatCurrency(0)}</td>
            <td><span class="badge ${customer.status === 'active' ? 'badge-success' : 'badge-secondary'}">${customer.status || 'active'}</span></td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="viewCustomer('${customer.id}')" title="View Details">👁️</button>
                <button class="btn btn-success btn-sm" onclick="editCustomer('${customer.id}')" title="Edit">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${customer.id}')" title="Delete">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Filter customers
function filterCustomers() {
    const searchTerm = document.getElementById('customerSearch').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const customers = getCustomers();
    const tbody = document.getElementById('customersTableBody');
    tbody.innerHTML = '';
    
    const filtered = customers.filter(customer => {
        const matchesSearch = !searchTerm || 
            customer.name.toLowerCase().includes(searchTerm) ||
            customer.phone.toLowerCase().includes(searchTerm) ||
            (customer.email && customer.email.toLowerCase().includes(searchTerm));
        
        const matchesStatus = !statusFilter || 
            customer.status === statusFilter ||
            (statusFilter === 'hasLoan' && getCustomerLoan(customer.id) > 0);
        
        return matchesSearch && matchesStatus;
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No customers found</td></tr>';
        return;
    }
    
    filtered.forEach(customer => {
        const loan = getCustomerLoan(customer.id);
        const purchases = getCustomerPurchases(customer.id);
        const totalPurchases = purchases.reduce((sum, sale) => sum + sale.total, 0);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${customer.id}</td>
            <td><strong>${customer.name}</strong></td>
            <td>${customer.phone}</td>
            <td>${customer.email || '-'}</td>
            <td>${formatCurrency(totalPurchases)}</td>
            <td>${loan > 0 ? `<span style="color: var(--danger);">${formatCurrency(loan)}</span>` : formatCurrency(0)}</td>
            <td><span class="badge ${customer.status === 'active' ? 'badge-success' : 'badge-secondary'}">${customer.status || 'active'}</span></td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="viewCustomer('${customer.id}')" title="View Details">👁️</button>
                <button class="btn btn-success btn-sm" onclick="editCustomer('${customer.id}')" title="Edit">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${customer.id}')" title="Delete">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Open customer modal
function openCustomerModal() {
    editingCustomer = null;
    document.getElementById('customerModalTitle').textContent = 'Add Customer';
    document.getElementById('customerForm').reset();
    document.getElementById('customerModal').style.display = 'block';
}

// Close customer modal
function closeCustomerModal() {
    document.getElementById('customerModal').style.display = 'none';
    editingCustomer = null;
}

// Save customer
function saveCustomer(e) {
    e.preventDefault();
    
    const customer = {
        id: editingCustomer ? editingCustomer.id : 'CUST-' + Date.now(),
        name: document.getElementById('custName').value.trim(),
        phone: document.getElementById('custPhone').value.trim(),
        email: document.getElementById('custEmail').value.trim() || '',
        address: document.getElementById('custAddress').value.trim() || '',
        status: document.getElementById('custStatus').value || 'active',
        notes: document.getElementById('custNotes').value.trim() || '',
        createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    saveCustomerData(customer);
    loadCustomers();
    closeCustomerModal();
    alert('Customer saved successfully!');
}

// Edit customer
function editCustomer(customerId) {
    const customer = getCustomerById(customerId);
    if (!customer) {
        alert('Customer not found!');
        return;
    }
    
    editingCustomer = customer;
    document.getElementById('customerModalTitle').textContent = 'Edit Customer';
    document.getElementById('custName').value = customer.name;
    document.getElementById('custPhone').value = customer.phone;
    document.getElementById('custEmail').value = customer.email || '';
    document.getElementById('custAddress').value = customer.address || '';
    document.getElementById('custStatus').value = customer.status || 'active';
    document.getElementById('custNotes').value = customer.notes || '';
    document.getElementById('customerModal').style.display = 'block';
}

// Delete customer
function deleteCustomer(customerId) {
    if (!confirm('Are you sure you want to delete this customer?')) {
        return;
    }
    
    const loan = getCustomerLoan(customerId);
    if (loan > 0) {
        if (!confirm(`This customer has an outstanding loan of ${formatCurrency(loan)}. Are you sure you want to delete?`)) {
            return;
        }
    }
    
    deleteCustomerData(customerId);
    loadCustomers();
    alert('Customer deleted successfully!');
}

// View customer details
function viewCustomer(customerId) {
    const customer = getCustomerById(customerId);
    if (!customer) {
        alert('Customer not found!');
        return;
    }
    
    const purchases = getCustomerPurchases(customerId);
    const loan = getCustomerLoan(customerId);
    const totalPurchases = purchases.reduce((sum, sale) => sum + sale.total, 0);
    const totalItems = purchases.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
    
    const content = document.getElementById('customerDetailsContent');
    content.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label>Customer ID</label>
                <input type="text" value="${customer.id}" readonly>
            </div>
            <div class="form-group">
                <label>Status</label>
                <input type="text" value="${customer.status || 'active'}" readonly>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" value="${customer.name}" readonly>
            </div>
            <div class="form-group">
                <label>Phone Number</label>
                <input type="text" value="${customer.phone}" readonly>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Email</label>
                <input type="text" value="${customer.email || '-'}" readonly>
            </div>
            <div class="form-group">
                <label>Address</label>
                <input type="text" value="${customer.address || '-'}" readonly>
            </div>
        </div>
        <div class="form-group">
            <label>Notes</label>
            <textarea readonly rows="2">${customer.notes || '-'}</textarea>
        </div>
        <hr style="margin: 20px 0; border-color: var(--border-color);">
        <h3 style="margin-bottom: 15px;">Purchase Statistics</h3>
        <div class="stats-grid" style="margin-bottom: 20px;">
            <div class="stat-card">
                <div class="stat-label">Total Purchases</div>
                <div class="stat-value">${formatCurrency(totalPurchases)}</div>
            </div>
            <div class="stat-card ${loan > 0 ? 'warning' : 'success'}">
                <div class="stat-label">Outstanding Loan</div>
                <div class="stat-value">${formatCurrency(loan)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Transactions</div>
                <div class="stat-value">${purchases.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Items Purchased</div>
                <div class="stat-value">${totalItems}</div>
            </div>
        </div>
        <h3 style="margin-bottom: 15px;">Recent Purchases</h3>
        <div class="table-container" style="max-height: 300px; overflow-y: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Invoice</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${purchases.length === 0 ? '<tr><td colspan="4" class="text-center">No purchases found</td></tr>' : 
                        purchases.slice(0, 10).map(sale => `
                            <tr>
                                <td>${sale.invoiceNumber}</td>
                                <td>${formatDate(sale.date)}</td>
                                <td>${formatCurrency(sale.total)}</td>
                                <td><span class="badge ${sale.balance > 0 ? 'badge-warning' : 'badge-success'}">${sale.balance > 0 ? 'Partial' : 'Paid'}</span></td>
                            </tr>
                        `).join('')
                    }
                </tbody>
            </table>
        </div>
    `;
    
    document.getElementById('customerDetailsTitle').textContent = `Customer Details - ${customer.name}`;
    document.getElementById('customerDetailsModal').style.display = 'block';
}

// Close customer details modal
function closeCustomerDetailsModal() {
    document.getElementById('customerDetailsModal').style.display = 'none';
}

// Close modal on outside click
window.addEventListener('click', function(event) {
    const customerModal = document.getElementById('customerModal');
    const detailsModal = document.getElementById('customerDetailsModal');
    
    if (event.target === customerModal) {
        closeCustomerModal();
    }
    if (event.target === detailsModal) {
        closeCustomerDetailsModal();
    }
});

