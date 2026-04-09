// ===== POS / BILLING FUNCTIONALITY =====

let currentBill = {
    invoiceNumber: '',
    date: new Date().toISOString(),
    items: [],
    salesCode: '',
    subtotal: 0,
    discount: 0,
    total: 0,
    paidAmount: 0,
    balance: 0,
    paymentType: '',
    chequeNumber: '',
    chequeDate: '',
    customerId: '',
    customerName: '',
    customerContact: '',
    customerEmail: ''
};

let selectedPaymentType = 'cash';
let otherPaymentTypeText = '';

// Initialize POS page
document.addEventListener('DOMContentLoaded', function () {
    initPOS();
    loadEmployees();
    loadCustomers();
    loadRecentItems();
    loadRecentInvoices();
    const salesCodeField = document.getElementById('salesCode');
    if (salesCodeField) salesCodeField.focus();

    // Arrow keys navigation and Global shortcuts
    document.addEventListener('keydown', handleGlobalNavigation);

    // Auto-save draft every 5 seconds
    setInterval(autoSaveDraft, 5000);

    // Check for draft on load
    checkDraftRecovery();
});

// Auto-save draft
function autoSaveDraft() {
    // DO NOT save draft if payment is completed and we're showing share options
    if (typeof savedReceiptData !== 'undefined' && savedReceiptData !== null) return;
    
    if (currentBill.items.length > 0) {
        localStorage.setItem('posDraft', JSON.stringify(currentBill));
    }
}

function checkDraftRecovery() {
    const draft = localStorage.getItem('posDraft');
    if (draft && JSON.parse(draft).items.length > 0) {
        document.getElementById('recoveryModal').style.display = 'block';
    }
}

function restoreDraftBill() {
    const draft = localStorage.getItem('posDraft');
    if (draft) {
        currentBill = JSON.parse(draft);
        renderBillItems();
        calculateTotal();
        document.getElementById('recoveryModal').style.display = 'none';
        localStorage.removeItem('posDraft');
    }
}

function discardDraftBill() {
    localStorage.removeItem('posDraft');
    document.getElementById('recoveryModal').style.display = 'none';
}

// Arrow key navigation and key shortcuts
function handleGlobalNavigation(event) {
    const navIds = ['itemCode', 'itemQty', 'itemPrice', 'itemDiscount', 'addItemBtn'];
    const activeElement = document.activeElement;

    // Ctrl+Enter: Add Item instantly
    if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        addItemToBill();
        return;
    }

    // Ctrl+S: Process Payment
    if (event.ctrlKey && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        openPaymentModal();
        return;
    }

    // Escape: Clear row / Close suggestions
    if (event.key === 'Escape') {
        hideSuggestions();
        if (navIds.includes(activeElement.id)) {
            clearItemInputs();
            return;
        }
    }

    // + and - keys for Qty
    if (activeElement.id === 'itemQty') {
        if (event.key === '+') {
            event.preventDefault();
            activeElement.value = (parseFloat(activeElement.value) || 0) + 1;
            return;
        }
        if (event.key === '-') {
            event.preventDefault();
            const val = (parseFloat(activeElement.value) || 0) - 1;
            activeElement.value = Math.max(1, val);
            return;
        }
    }

    if (!activeElement || !navIds.includes(activeElement.id)) return;

    const currentIndex = navIds.indexOf(activeElement.id);
    let nextIndex = -1;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        // Only if it's NOT the itemCode field OR suggestions are hidden
        if (activeElement.id !== 'itemCode' || !document.getElementById('productSuggestions').style.display === 'block') {
            if (currentIndex < navIds.length - 1) {
                nextIndex = currentIndex + 1;
            }
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
}

// Product search logic
function handleItemCodeSearch(event) {
    const query = event.target.value.trim().toLowerCase();
    const suggestionsBox = document.getElementById('productSuggestions');

    if (query.length < 2) {
        hideSuggestions();
        return;
    }

    const products = getProducts();
    const matches = products.filter(p =>
        p.itemCode.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query)
    ).slice(0, 8);

    if (matches.length > 0) {
        suggestionsBox.innerHTML = '';
        matches.forEach(p => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `<strong>${p.itemCode}</strong> - ${p.name} (${formatCurrency(p.price)})`;
            div.onclick = () => selectSuggestion(p);
            suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = 'block';
    } else {
        hideSuggestions();
    }
}

function selectSuggestion(product) {
    document.getElementById('itemCode').value = product.itemCode;
    document.getElementById('itemName').value = product.name;
    document.getElementById('itemPrice').value = product.price;
    hideSuggestions();
    document.getElementById('itemQty').focus();
    document.getElementById('itemQty').select();
}

function hideSuggestions() {
    const div = document.getElementById('productSuggestions');
    if (div) div.style.display = 'none';
}

function handleItemInputKeyDown(event) {
    if (event.key === 'ArrowDown') {
        const first = document.querySelector('.suggestion-item');
        if (first) {
            event.preventDefault();
            // In a real advanced app we'd cycle through, but lets keep it simple: focus next field if no match selected
        }
    }
    if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (query) {
            event.preventDefault();
            event.stopPropagation();
            const product = getProductByCode(query.toUpperCase());
            if (product) {
                fillProductDetails();
                const qtyField = document.getElementById('itemQty');
                qtyField.focus();
                qtyField.select();
            } else {
                openQuickCreateModal(query);
            }
        }
    }
}

// Initialize POS
function initPOS() {
    currentBill.invoiceNumber = getNextInvoiceNumber();
    document.getElementById('invoiceNumber').textContent = currentBill.invoiceNumber;
    calculateTotal();

    // Focus on item code input
    // Focus on sales code first as requested
    const salesCodeField = document.getElementById('salesCode');
    if (salesCodeField) {
        salesCodeField.focus();
    } else {
        document.getElementById('itemCode').focus();
    }
}

// Load employees for sales code dropdown
function loadEmployees() {
    // Sync from EMS first (if sync manager available)
    if (typeof syncEmployeesFromEMS === 'function') {
        syncEmployeesFromEMS().catch(err => console.log('Sync error:', err));
    }

    const employees = getEmployees();
    const salesCodeSelect = document.getElementById('salesCode');
    const itemSalesCodeSelect = document.getElementById('itemSalesCode');

    if (salesCodeSelect) {
        salesCodeSelect.innerHTML = '<option value="">Select Employee</option>';

        employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.salesCode;
            option.textContent = `${emp.salesCode} - ${emp.name}`;
            salesCodeSelect.appendChild(option);
        });
    }

    if (itemSalesCodeSelect) {
        itemSalesCodeSelect.innerHTML = '<option value="">Bill Default</option>';

        employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.salesCode;
            option.textContent = `${emp.salesCode} - ${emp.name}`;
            itemSalesCodeSelect.appendChild(option);
        });
    }
}

// Load customers for customer dropdown
function loadCustomers() {
    if (typeof getCustomers === 'undefined') {
        // Customers.js not loaded, skip
        return;
    }

    const customers = getCustomers();
    const customerSelect = document.getElementById('customerSelect');
    if (customerSelect) {
        customerSelect.innerHTML = '<option value="">Walk-in Customer</option>';

        customers.filter(c => c.status === 'active').forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = `${customer.name} (${customer.phone})`;
            customerSelect.appendChild(option);
        });
    }
}

// Update customer selection
function updateCustomer() {
    const customerSelect = document.getElementById('customerSelect');
    if (!customerSelect) return;

    const customerId = customerSelect.value;
    if (!customerId) {
        currentBill.customerId = '';
        currentBill.customerName = '';
        currentBill.customerContact = '';
        return;
    }

    if (typeof getCustomerById === 'undefined') return;

    const customer = getCustomerById(customerId);
    if (customer) {
        currentBill.customerId = customer.id;
        currentBill.customerName = customer.name;
        currentBill.customerContact = customer.phone;
    }
}

// Open customer select modal
function openCustomerSelectModal() {
    if (typeof getCustomers === 'undefined') {
        window.location.href = 'customers.html';
        return;
    }

    loadCustomersModal();
    document.getElementById('customerSelectModal').style.display = 'block';
}

// Close customer select modal
function closeCustomerSelectModal() {
    document.getElementById('customerSelectModal').style.display = 'none';
}

// Load customers in modal
function loadCustomersModal() {
    if (typeof getCustomers === 'undefined') return;

    const customers = getCustomers().filter(c => c.status === 'active');
    const tbody = document.getElementById('customerSelectTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No customers found. <a href="customers.html">Add one</a></td></tr>';
        return;
    }

    customers.forEach(customer => {
        const loan = typeof getCustomerLoan !== 'undefined' ? getCustomerLoan(customer.id) : 0;
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.onclick = () => selectCustomer(customer.id);
        row.innerHTML = `
            <td><strong>${customer.name}</strong></td>
            <td>${customer.phone}</td>
            <td>${loan > 0 ? `<span style="color: var(--danger);">${formatCurrency(loan)}</span>` : formatCurrency(0)}</td>
            <td><button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); selectCustomer('${customer.id}')">Select</button></td>
        `;
        tbody.appendChild(row);
    });
}

// Filter customers in modal
function filterCustomersModal() {
    const searchTerm = document.getElementById('customerSearchModal').value.toLowerCase();
    if (typeof getCustomers === 'undefined') return;

    const customers = getCustomers().filter(c => c.status === 'active');
    const tbody = document.getElementById('customerSelectTableBody');
    if (!tbody) return;

    const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm) ||
        customer.phone.toLowerCase().includes(searchTerm)
    );

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No customers found</td></tr>';
        return;
    }

    filtered.forEach(customer => {
        const loan = typeof getCustomerLoan !== 'undefined' ? getCustomerLoan(customer.id) : 0;
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.onclick = () => selectCustomer(customer.id);
        row.innerHTML = `
            <td><strong>${customer.name}</strong></td>
            <td>${customer.phone}</td>
            <td>${loan > 0 ? `<span style="color: var(--danger);">${formatCurrency(loan)}</span>` : formatCurrency(0)}</td>
            <td><button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); selectCustomer('${customer.id}')">Select</button></td>
        `;
        tbody.appendChild(row);
    });
}

// Select customer
function selectCustomer(customerId) {
    if (typeof getCustomerById === 'undefined') return;

    const customer = getCustomerById(customerId);
    if (!customer) return;

    const customerSelect = document.getElementById('customerSelect');
    if (customerSelect) {
        customerSelect.value = customerId;
        updateCustomer();
    }

    closeCustomerSelectModal();
}

// Update sales code
function updateSalesCode() {
    currentBill.salesCode = document.getElementById('salesCode').value;
}

// Helper for Enter Key Navigation
function handleInputEnter(event, nextFieldId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();

        // Special case for itemCode: we need to populate details first if it's not empty
        if (event.target.id === 'itemCode') {
            const field = document.getElementById('itemCode');
            const itemCode = field.value.trim().toUpperCase();
            field.value = itemCode;
            if (itemCode) {
                const product = getProductByCode(itemCode);
                if (product) {
                    document.getElementById('itemName').value = product.name;
                    document.getElementById('itemPrice').value = product.price;
                    const qtyField = document.getElementById('itemQty');
                    qtyField.focus();
                    qtyField.select();
                } else {
                    alert('Product not found!');
                    return; 
                }
            } else {
                return; 
            }
        } else {
            const nextField = document.getElementById(nextFieldId === 'itemSalesCode' ? 'addItemBtn' : nextFieldId);
            if (nextField) {
                nextField.focus();
                if (nextField.tagName === 'INPUT') {
                    nextField.select();
                }
            }
        }
    }
}

function handleAddButtonEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        addItemToBill();
    }
}

function handleItemCodeChange(event) {
    const value = event.target.value.trim().toUpperCase();
    if (event.key === 'Enter') return; // handled elsewhere
    event.target.value = value;
    if (!value) {
        document.getElementById('itemName').value = '';
        document.getElementById('itemPrice').value = '';
        return;
    }
    const product = getProductByCode(value);
    if (product) {
        document.getElementById('itemName').value = product.name;
        document.getElementById('itemPrice').value = product.price;
    }
}

function fillProductDetails() {
    const field = document.getElementById('itemCode');
    const itemCode = field.value.trim().toUpperCase();
    field.value = itemCode;
    if (!itemCode) return;
    const product = getProductByCode(itemCode);
    if (product) {
        document.getElementById('itemName').value = product.name;
        document.getElementById('itemPrice').value = product.price;
    } else {
        document.getElementById('itemName').value = '';
        document.getElementById('itemPrice').value = '';
    }
}

// Handle quantity key press
function handleQtyKeyPress(event) {
    if (event.key === 'Enter') {
        addItemToBill();
    }
}

// Add item to bill
function addItemToBill() {
    const codeField = document.getElementById('itemCode');
    const itemCode = codeField.value.trim().toUpperCase();
    codeField.value = itemCode;
    const itemName = document.getElementById('itemName').value.trim();
    const qty = parseFloat(document.getElementById('itemQty').value) || 1;
    const price = parseFloat(document.getElementById('itemPrice').value) || 0;

    // Parse Discount
    const discStr = document.getElementById('itemDiscount').value.trim();
    let unitDiscount = 0;
    if (discStr) {
        if (discStr.endsWith('%')) {
            const pct = parseFloat(discStr.replace('%', '')) || 0;
            unitDiscount = price * (pct / 100);
        } else {
            unitDiscount = parseFloat(discStr) || 0;
        }
    }

    // Parse Sales Code
    let itemSalesCode = document.getElementById('itemSalesCode').value;
    if (!itemSalesCode) {
        const mainSalesCode = document.getElementById('salesCode').value;
        const firstEmployee = document.getElementById('salesCode').options[1] ? document.getElementById('salesCode').options[1].value : '';
        itemSalesCode = mainSalesCode || firstEmployee || 'N/A';
    }

    if (!itemCode || !itemName || price <= 0 || qty <= 0) {
        alert('Please enter valid item details!');
        return;
    }

    const product = getProductByCode(itemCode);
    if (!product) {
        alert('Product not found!');
        return;
    }

    const itemCost = product.cost || 0;
    const itemTotal = (price - unitDiscount) * qty;
    const itemProfit = ((price - unitDiscount) - itemCost) * qty;

    const item = {
        code: itemCode,
        name: itemName,
        cost: itemCost,
        price: price,
        qty: qty,
        discount: unitDiscount,
        salesCode: itemSalesCode,
        total: itemTotal,
        profit: itemProfit,
        isNewAdded: true // Used for saving sales record
    };

    // Note: For simplicity with different discounts/codes, we won't merge items anymore
    // We add them as separate rows
    currentBill.items.push(item);

    // Automatic Sales Entry
    saveCurrentBillAsUnpaid();

    renderBillItems();
    calculateTotal();
    clearItemInputs();

    // Focus back on Item Code
    codeField.focus();

    // Update recent items
    addToRecentItems(itemCode);
    loadRecentItems();
}

// Render bill items
function renderBillItems() {
    const container = document.getElementById('billItemsList');
    container.innerHTML = '';

    currentBill.items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'bill-item hacker-typed';
        row.style.animation = 'fadeIn 0.3s ease-in-out';
        row.innerHTML = `
            <div>${index + 1}</div>
            <div>${item.name}</div>
            <div>${item.code}</div>
            <div>
                <input type="number" step="0.01" value="${item.qty}" style="width: 60px; text-align:center; background:#fff; color:#000;" onchange="updateItemQty(${index}, this.value)">
            </div>
            <div>
                <input type="number" step="0.01" value="${item.price}" style="width: 70px; text-align:right; background:#fff; color:#000;" onchange="updateItemPrice(${index}, this.value)">
            </div>
            <div>${formatCurrency(item.discount || 0)}</div>
            <div>${item.salesCode || ''}</div>
            <div style="font-weight:bold; color:var(--accent-primary);">${formatCurrency(item.total)}</div>
            <div>
                <button class="btn btn-danger btn-sm" onclick="removeBillItemWrapper(${index})" title="Remove Item">×</button>
            </div>
        `;
        container.appendChild(row);
    });
}

function updateItemPrice(index, value) {
    const price = parseFloat(value) || 0;
    const item = currentBill.items[index];
    if (!item) return;
    item.price = price;
    item.total = (item.price - (item.discount || 0)) * item.qty;
    item.profit = (item.price - (item.discount || 0) - (item.cost || 0)) * item.qty;
    renderBillItems();
    calculateTotal();
}

function updateItemQty(index, value) {
    const qty = parseFloat(value) || 1;
    const item = currentBill.items[index];
    if (!item) return;
    item.qty = qty;
    item.total = (item.price - (item.discount || 0)) * item.qty;
    item.profit = (item.price - (item.discount || 0) - (item.cost || 0)) * item.qty;
    renderBillItems();
    calculateTotal();
}

// Remove item from bill
function removeBillItem(index) {
    currentBill.items.splice(index, 1);
    renderBillItems();
    calculateTotal();
}

function removeBillItemWrapper(index) {
    removeBillItem(index);
    // Auto sync removal to sales record
    if (currentBill.items.length > 0) {
        saveCurrentBillAsUnpaid();
    } else {
        // If all items are removed, we remove the unpaid sales record?
        const sales = getSales();
        const saleIndex = sales.findIndex(s => s.invoiceNumber === currentBill.invoiceNumber);
        if (saleIndex >= 0) {
            sales.splice(saleIndex, 1);
            localStorage.setItem('sales', JSON.stringify(sales));
        }
    }
}

// Auto-save bill as Unpaid
function saveCurrentBillAsUnpaid() {
    currentBill.status = 'Unpaid';
    currentBill.date = new Date().toISOString();
    // Update subtotal etc
    let subtotal = 0;
    currentBill.items.forEach(i => subtotal += i.total);
    currentBill.subtotal = subtotal;
    const globalDisc = parseFloat(document.getElementById('discount').value) || 0;
    currentBill.total = subtotal - globalDisc;

    saveSale({ ...currentBill });
}

// Calculate total
function calculateTotal() {
    currentBill.subtotal = currentBill.items.reduce((sum, item) => sum + item.total, 0);
    currentBill.discount = parseFloat(document.getElementById('discount').value) || 0;
    currentBill.total = currentBill.subtotal - currentBill.discount;
    currentBill.balance = currentBill.total - currentBill.paidAmount;

    document.getElementById('subtotal').textContent = formatCurrency(currentBill.subtotal);
    document.getElementById('total').textContent = formatCurrency(currentBill.total);
    document.getElementById('paidAmount').textContent = formatCurrency(currentBill.paidAmount);
    document.getElementById('balance').textContent = formatCurrency(currentBill.balance);
}

// Clear item inputs
function clearItemInputs() {
    document.getElementById('itemCode').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemPrice').value = '';
    document.getElementById('itemQty').value = '1';
    document.getElementById('itemCode').focus();
}

// New Bill
function newBill() {
    if (currentBill.items.length > 0) {
        if (!confirm('Create a new bill? Current bill will be cleared.')) {
            return;
        }
    }
    // Alert if unpaid invoices exist
    try {
        const sales = getSales();
        const unpaid = sales.filter(s => (s.balance || 0) > 0).length;
        if (unpaid > 0) {
            alert(`${unpaid} unpaid invoice(s) pending.`);
        }
    } catch (_) { }

    currentBill = {
        invoiceNumber: getNextInvoiceNumber(),
        date: new Date().toISOString(),
        items: [],
        salesCode: document.getElementById('salesCode').value || '',
        subtotal: 0,
        discount: 0,
        total: 0,
        paidAmount: 0,
        balance: 0,
        paymentType: '',
        chequeNumber: '',
        chequeDate: '',
        customerId: document.getElementById('customerSelect')?.value || '',
        customerName: '',
        customerContact: '',
        customerEmail: ''
    };

    // Update customer info if customer is selected
    if (currentBill.customerId && typeof getCustomerById !== 'undefined') {
        const customer = getCustomerById(currentBill.customerId);
        if (customer) {
            currentBill.customerName = customer.name;
            currentBill.customerContact = customer.phone;
        }
    }

    document.getElementById('invoiceNumber').textContent = currentBill.invoiceNumber;
    document.getElementById('discount').value = '';
    document.getElementById('billItemsList').innerHTML = '';
    calculateTotal();
    clearItemInputs();
    
    // Focus on sales code for the new bill
    const salesCodeField = document.getElementById('salesCode');
    if (salesCodeField) {
        salesCodeField.focus();
    }
}

// Open payment modal
function openPaymentModal() {
    if (currentBill.items.length === 0) {
        alert('Please add items to the bill first!');
        return;
    }

    if (!currentBill.salesCode) {
        alert('Please select a sales code!');
        return;
    }

    calculateTotal();
    selectedPaymentType = 'cash';
    otherPaymentTypeText = '';
    updatePaymentOptions();

    // Reset form fields
    document.getElementById('amountReceived').value = currentBill.total.toFixed(2);
    document.getElementById('chequeNumber').value = '';
    document.getElementById('chequeDate').value = '';
    document.getElementById('otherPaymentType').value = '';
    document.getElementById('paymentCustomerName').value = currentBill.customerName || '';
    document.getElementById('paymentCustomerMobile').value = currentBill.customerContact || '';
    document.getElementById('paymentCustomerEmail').value = '';

    // Hide/show relevant fields
    document.getElementById('chequeDetailsGroup').style.display = 'none';
    document.getElementById('otherPaymentTypeGroup').style.display = 'none';
    document.getElementById('amountReceivedGroup').style.display = 'block';

    // Update display
    document.getElementById('paymentTotalAmount').textContent = formatCurrency(currentBill.total);

    document.getElementById('paymentModal').classList.add('active');
    const amtReceivedField = document.getElementById('amountReceived');
    amtReceivedField.focus();
    amtReceivedField.select();
    calculatePaymentBalance();
}

// Close payment modal
function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

// Select payment type
function selectPaymentType(type) {
    selectedPaymentType = type;
    currentBill.paymentType = type;
    updatePaymentOptions();

    const chequeGroup = document.getElementById('chequeDetailsGroup');
    const otherGroup = document.getElementById('otherPaymentTypeGroup');
    const amountGroup = document.getElementById('amountReceivedGroup');

    // Hide all conditional groups first
    chequeGroup.style.display = 'none';
    otherGroup.style.display = 'none';

    // Show relevant groups based on payment type
    if (type === 'cheque') {
        chequeGroup.style.display = 'block';
        amountGroup.style.display = 'block';
    } else if (type === 'other') {
        otherGroup.style.display = 'block';
        amountGroup.style.display = 'block';
    } else if (type === 'card' || type === 'digital') {
        // Card and Digital Pay: auto-set amount to total, hide amount input
        document.getElementById('amountReceived').value = currentBill.total.toFixed(2);
        amountGroup.style.display = 'block';
    } else {
        // Cash: show amount input
        amountGroup.style.display = 'block';
    }

    calculatePaymentBalance();
}

// Update payment options UI
function updatePaymentOptions() {
    document.querySelectorAll('.payment-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.type === selectedPaymentType) {
            option.classList.add('selected');
        }
    });
}

// Calculate payment balance
function calculatePaymentBalance() {
    let amountReceived = 0;

    if (selectedPaymentType === 'card' || selectedPaymentType === 'digital') {
        // Card and Digital Pay: full amount paid
        amountReceived = currentBill.total;
        currentBill.paidAmount = amountReceived;
        currentBill.balance = 0;
    } else {
        // Cash, Cheque, Other: use entered amount
        amountReceived = parseFloat(document.getElementById('amountReceived').value) || 0;
        currentBill.paidAmount = amountReceived;
        currentBill.balance = currentBill.total - amountReceived;
    }

    // Update display
    document.getElementById('paymentPaidAmount').textContent = formatCurrency(currentBill.paidAmount);

    // Show balance or loan based on calculation
    const balanceRow = document.getElementById('paymentBalanceRow');
    const loanRow = document.getElementById('paymentLoanRow');

    if (currentBill.balance > 0) {
        // Amount paid is less than total - show loan
        balanceRow.style.display = 'none';
        loanRow.style.display = 'flex';
        document.getElementById('paymentLoanAmount').textContent = formatCurrency(currentBill.balance);
    } else if (currentBill.balance < 0) {
        // Amount paid is more than total - show balance (change)
        balanceRow.style.display = 'flex';
        loanRow.style.display = 'none';
        document.getElementById('paymentBalance').textContent = formatCurrency(Math.abs(currentBill.balance));
        document.getElementById('paymentBalance').style.color = 'var(--accent-success)';
    } else {
        // Exact payment
        balanceRow.style.display = 'flex';
        loanRow.style.display = 'none';
        document.getElementById('paymentBalance').textContent = formatCurrency(0);
        document.getElementById('paymentBalance').style.color = 'var(--accent-success)';
    }
}

// Confirm payment
function confirmPayment() {
    try {
        if (currentBill.items.length === 0) {
            alert('Please add items to the bill!');
            return;
        }

        if (!currentBill.salesCode) {
            alert('Please select a sales code!');
            return;
        }

        // Get customer details from payment modal (all optional)
        const customerName = document.getElementById('paymentCustomerName').value.trim();
        const customerMobile = document.getElementById('paymentCustomerMobile').value.trim();
        const customerEmail = document.getElementById('paymentCustomerEmail').value.trim();

        // Get payment amount
        let amountReceived = 0;
        if (selectedPaymentType === 'card' || selectedPaymentType === 'digital') {
            amountReceived = currentBill.total;
        } else {
            amountReceived = parseFloat(document.getElementById('amountReceived').value) || 0;
        }

        // Validate payment amount
        if (amountReceived <= 0) {
            alert('Please enter a valid payment amount!');
            document.getElementById('amountReceived').focus();
            return;
        }

        // Handle cheque details
        if (selectedPaymentType === 'cheque') {
            currentBill.chequeNumber = document.getElementById('chequeNumber').value.trim();
            currentBill.chequeDate = document.getElementById('chequeDate').value;
            if (!currentBill.chequeNumber) {
                alert('Please enter cheque number!');
                document.getElementById('chequeNumber').focus();
                return;
            }
        }

        // Handle other payment type
        if (selectedPaymentType === 'other') {
            otherPaymentTypeText = document.getElementById('otherPaymentType').value.trim();
            if (!otherPaymentTypeText) {
                alert('Please specify the payment type!');
                document.getElementById('otherPaymentType').focus();
                return;
            }
            currentBill.paymentType = `other: ${otherPaymentTypeText}`;
        }

        // Calculate balance
        currentBill.paidAmount = amountReceived;
        currentBill.balance = currentBill.total - amountReceived;

        // Update customer details
        currentBill.customerName = customerName;
        currentBill.customerContact = customerMobile;
        if (customerEmail) {
            currentBill.customerEmail = customerEmail;
        }

        // If partial payment (balance > 0), show confirmation
        if (currentBill.balance > 0) {
            if (!confirm(`Amount received (${formatCurrency(amountReceived)}) is less than total (${formatCurrency(currentBill.total)}).\nBalance of ${formatCurrency(currentBill.balance)} will be added as loan. Continue?`)) {
                return;
            }
        }

        // Save sale
        const sale = {
            invoiceNumber: currentBill.invoiceNumber,
            date: new Date().toISOString(),
            salesCode: currentBill.salesCode,
            items: currentBill.items.map(item => ({
                code: item.code,
                name: item.name,
                qty: item.qty,
                price: item.price,
                discount: item.discount,
                salesCode: item.salesCode,
                cost: item.cost,
                total: item.total,
                profit: item.profit
            })),
            subtotal: currentBill.subtotal,
            discount: currentBill.discount,
            total: currentBill.total,
            paidAmount: currentBill.paidAmount,
            balance: currentBill.balance,
            paymentType: selectedPaymentType === 'other' ? `other: ${otherPaymentTypeText}` : selectedPaymentType,
            chequeNumber: currentBill.chequeNumber || '',
            chequeDate: currentBill.chequeDate || '',
            customerId: currentBill.customerId || '',
            customerName: currentBill.customerName,
            customerContact: currentBill.customerContact,
            customerEmail: currentBill.customerEmail || '',
            status: currentBill.balance > 0 ? 'Partial' : 'Paid'
        };

        saveSale(sale);
        addRecentInvoice(sale.invoiceNumber, sale.total, sale.date);

        // Update product stocks
        currentBill.items.forEach(item => {
            updateProductStock(item.code, item.qty);
        });

        closePaymentModal();

        // Show receipt actions modal (sale is already saved)
        showReceiptActionsModal();

    } catch (error) {
        console.error('Payment Error:', error);
        alert('An error occurred during payment. Please check your connection and try again.\nError: ' + error.message);
    }
}

// Loan modal actions
function closeLoanModal() {
    document.getElementById('loanModal').classList.remove('active');
}

function confirmLoanDetails() {
    try {
        currentBill.customerName = document.getElementById('customerName').value.trim();
        currentBill.customerContact = document.getElementById('customerContact').value.trim();

        const sale = {
            invoiceNumber: currentBill.invoiceNumber,
            date: new Date().toISOString(),
            salesCode: currentBill.salesCode,
            items: currentBill.items.map(item => ({
                code: item.code,
                name: item.name,
                qty: item.qty,
                price: item.price,
                cost: item.cost,
                total: item.total,
                profit: item.profit
            })),
            subtotal: currentBill.subtotal,
            discount: currentBill.discount,
            total: currentBill.total,
            paidAmount: currentBill.paidAmount,
            balance: currentBill.balance,
            loanAmount: currentBill.balance,
            paymentType: selectedPaymentType,
            chequeNumber: currentBill.chequeNumber,
            chequeDate: currentBill.chequeDate,
            customerId: currentBill.customerId || '',
            customerName: currentBill.customerName,
            customerContact: currentBill.customerContact,
            status: 'Partial'
        };
        saveSale(sale);
        addRecentInvoice(sale.invoiceNumber, sale.total, sale.date);
        currentBill.items.forEach(item => updateProductStock(item.code, item.qty));
        closeLoanModal();
        closePaymentModal();
        alert('Partial payment saved.');
        printReceipt(true); // mark as customer copy
        setTimeout(() => { newBill(); }, 1000);
    } catch (error) {
        console.error('Loan Error:', error);
        alert('An error occurred during loan processing. Please try again.\nError: ' + error.message);
    }
}

// Print receipt
function printReceipt() {
    if (currentBill.items.length === 0) {
        alert('No items in the bill to print!');
        return;
    }

    // Use the new renderer if available (prevents receiptPrint DOM coupling).
    if (window.ReceiptPrinting?.printSaleNormalReceipt && window.InvoiceCore?.buildEssentialInvoiceCoreFromSale) {
        // #region agent log
        (function () {
            try {
                const payload = { sessionId: '7bec1d', runId: 'pre-fix', hypothesisId: 'H2', location: 'pos.js:printReceipt', message: 'POS printReceipt uses ReceiptPrinting', data: { invoiceNumber: currentBill?.invoiceNumber, subtotal: currentBill?.subtotal, discount: currentBill?.discount, total: currentBill?.total, settings: { storeName: (window.getSettings?.().storeName), storeAddress: (window.getSettings?.().storeAddress), storeContact: (window.getSettings?.().storeContact), storeWebsite: (window.getSettings?.().storeWebsite) } }, timestamp: Date.now() };
                const body = JSON.stringify(payload);
                const url = 'http://127.0.0.1:7929/ingest/84521e1c-be37-4945-8616-6e9d7af141d9';
                if (navigator.sendBeacon) {
                    try {
                        const ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
                        if (ok) return;
                    } catch (_) { }
                }
                fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7bec1d' }, body }).catch(() => { });
            } catch (_) { }
        })();
        // #endregion
        const sale = { ...currentBill };
        sale.invoiceCore = window.InvoiceCore.buildEssentialInvoiceCoreFromSale(sale);
        window.ReceiptPrinting.printSaleNormalReceipt(sale);
        return;
    }

    const settings = getSettings();
    const receiptDiv = document.getElementById('receiptPrint');

    // Header
    const logoBase64 = localStorage.getItem('pos_logo');
    const printLogo = document.getElementById('printLogo');
    if (printLogo) {
        if (logoBase64) {
            printLogo.src = logoBase64;
            printLogo.style.display = 'block';
        } else {
            printLogo.style.display = 'none';
        }
    }

    const storeNameEl = document.getElementById('printStoreName');
    const storeDetailsEl = document.getElementById('printStoreDetails');
    if (storeNameEl) storeNameEl.textContent = settings.storeName || 'AMi STORE';
    if (storeDetailsEl) {
        let details = [];
        if (settings.storeAddress) details.push(settings.storeAddress);
        if (settings.storeContact) details.push(settings.storeContact);
        if (settings.storeWebsite) details.push(settings.storeWebsite);
        if (settings.receiptHeader) details.push(settings.receiptHeader);
        storeDetailsEl.innerHTML = details.join('<br>');
    }

    // Info
    document.getElementById('printInvoiceNumber').textContent = currentBill.invoiceNumber;
    document.getElementById('printDate').textContent = formatDateTime(new Date());
    document.getElementById('printSalesCode').textContent = currentBill.salesCode || 'N/A';

    // Items
    let itemsHtml = '';
    let totalSavings = 0;
    currentBill.items.forEach(item => {
        const itemDisc = (item.discount || 0) * item.qty;
        totalSavings += itemDisc;
        itemsHtml += `
            <div class="receipt-item" style="display: block; margin-bottom: 4px;">
                <div style="font-weight: 600; text-transform: uppercase;">${item.name}</div>
                <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <div>${item.qty} x ${formatCurrency(item.price)}</div>
                    <div>${formatCurrency(item.total)}</div>
                </div>
            </div>
        `;
    });
    // Add bill level discount to savings
    totalSavings += (currentBill.discount || 0);
    document.getElementById('printItems').innerHTML = itemsHtml;

    // Summary
    document.getElementById('printSubtotal').textContent = formatCurrency(currentBill.subtotal);
    document.getElementById('printDiscount').textContent = formatCurrency(currentBill.discount);
    document.getElementById('printTotal').textContent = formatCurrency(currentBill.total);
    document.getElementById('printPaymentType').textContent = (selectedPaymentType || 'CASH').toUpperCase();
    document.getElementById('printPaid').textContent = formatCurrency(currentBill.paidAmount);
    document.getElementById('printBalance').textContent = formatCurrency(currentBill.balance);

    // Savings line
    const savingsEl = document.getElementById('printSavingsAmount');
    const savingsContainer = document.getElementById('printSavingsContainer');
    if (totalSavings > 0) {
        savingsEl.textContent = formatCurrency(totalSavings);
        savingsContainer.style.display = 'block';
    } else {
        savingsContainer.style.display = 'none';
    }

    // Footer
    const footerMsg = document.getElementById('printFooterMessage');
    if (footerMsg) {
        const msg = settings.thanksMessage || 'Thank you for shopping with us!';
        footerMsg.innerHTML = msg.replace(/\n/g, '<br>');
        footerMsg.style.textAlign = 'center';
    }

    const note = document.getElementById('customerCopyNote');
    if (note) note.textContent = currentBill.balance > 0 ? 'Customer Copy / Partial Payment' : '';

    // Inject 80mm @page for Epson thermal receipt printer
    const style = document.createElement('style');
    style.id = 'receiptPageStyle';
    style.media = 'print';
    style.textContent = `
        @page { 
            size: 80mm auto; 
            margin: 0; 
        }
        @media print {
            body * {
                visibility: hidden;
            }
            .print-section,
            .print-section * {
                visibility: visible;
            }
            .print-section {
                position: absolute;
                left: 0;
                top: 0;
                width: 80mm;
                margin: 0;
                padding: 5mm;
                background: #fff !important;
                color: #000 !important;
            }
        }
    `;
    document.head.appendChild(style);

    // Show receipt and trigger print
    receiptDiv.style.display = 'block';
    receiptDiv.classList.add('print-section');

    // Small delay to ensure rendering
    setTimeout(() => {
        window.print();
        // Hide after print
        setTimeout(() => {
            receiptDiv.style.display = 'none';
            receiptDiv.classList.remove('print-section');
            // Cleanup
            if (document.getElementById('receiptPageStyle')) {
                document.head.removeChild(style);
            }
        }, 100);
    }, 100);
}

// Global Barcode Handling
// If user scans a barcode, we try to be smart about where it goes
let barcodeBuffer = '';
let lastKeyTime = Date.now();

document.addEventListener('keydown', function (e) {
    const active = document.activeElement;
    const now = Date.now();

    // If typing is very fast (scanner speed < 50ms per char)
    if (now - lastKeyTime < 50 && e.key.length === 1) {
        barcodeBuffer += e.key;
    } else if (now - lastKeyTime > 200) {
        barcodeBuffer = e.key.length === 1 ? e.key : '';
    }
    lastKeyTime = now;

    if (e.key === 'Enter') {
        // If we have a buffer and it looks like a barcode, and we aren't specifically in an input that needs Enter
        if (barcodeBuffer.length > 5 && (active.tagName !== 'INPUT' || active.id === 'itemCode')) {
            const product = getProductByCode(barcodeBuffer.toUpperCase());
            if (product) {
                // If we are in POS, add it
                if (typeof addItemToBillByProduct === 'function') {
                    addItemToBillByProduct(product);
                    barcodeBuffer = '';
                    return;
                }
            }
        }
        barcodeBuffer = '';

        // Standard Navigation: Enter moves to next field
        if (active.tagName === 'INPUT' || active.tagName === 'SELECT') {
            // Exceptions: don't jump if it's a textarea or specific multi-line
            if (active.id === 'itemCode' && active.value.trim().length > 0) {
                // handleInputEnter already handles this (jumps to Qty)
            } else if (
                active.id === 'invoiceSearch' ||
                active.id === 'universalScannerInput' ||
                active.id === 'receiptScanInput' ||
                active.id === 'sharePhoneNumber' ||
                active.id === 'addItemBtn' ||
                active.id === 'confirmPaymentBtn'
            ) {
                e.preventDefault(); // Stop global jump and stop browser defaults
                return;
            } else {
                const formInputs = Array.from(document.querySelectorAll('input:not([readonly]), select, .payment-option'));
                const index = formInputs.indexOf(active);
                if (index > -1 && index < formInputs.length - 1) {
                    e.preventDefault();
                    formInputs[index + 1].focus();
                    if (formInputs[index + 1].tagName === 'INPUT') formInputs[index + 1].select();
                }
            }
        }
    }
});

// Helper to add by product object (for scanner)
function addItemToBillByProduct(product) {
    const itemCodeField = document.getElementById('itemCode');
    if (!itemCodeField) return;

    itemCodeField.value = product.itemCode;
    document.getElementById('itemName').value = product.name;
    document.getElementById('itemPrice').value = product.price;
    document.getElementById('itemQty').value = 1;

    addItemToBill();

    itemCodeField.focus();
    itemCodeField.select();
}

// Invoice search
function handleInvoiceSearchKey(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        let id = e.target.value.trim().toUpperCase();
        if (id) {
            // Auto-format if user enters just a number (e.g. "36" -> "INV-00036")
            if (/^\d+$/.test(id)) {
                id = `INV-${id.padStart(5, '0')}`;
            }
            loadInvoiceById(id);
        }
    }
}

function loadInvoiceById(invoiceId) {
    const sales = getSales();
    let sale = sales.find(s => s.invoiceNumber === invoiceId);
    
    // Fallback: If not found exactly, try partial match
    if (!sale) {
        sale = sales.find(s => s.invoiceNumber.includes(invoiceId));
    }
    
    if (!sale) { alert('Invoice not found'); return; }
    currentBill = {
        invoiceNumber: sale.invoiceNumber,
        date: sale.date,
        items: sale.items.map(it => ({ ...it })),
        salesCode: sale.salesCode || '',
        subtotal: sale.subtotal || 0,
        discount: sale.discount || 0,
        total: sale.total || 0,
        paidAmount: sale.paidAmount || 0,
        balance: sale.balance || 0,
        paymentType: sale.paymentType || '',
        chequeNumber: sale.chequeNumber || '',
        chequeDate: sale.chequeDate || '',
        customerId: sale.customerId || '',
        customerName: sale.customerName || '',
        customerContact: sale.customerContact || ''
    };

    // Update customer select dropdown
    const customerSelect = document.getElementById('customerSelect');
    if (customerSelect && currentBill.customerId) {
        customerSelect.value = currentBill.customerId;
    }
    document.getElementById('invoiceNumber').textContent = currentBill.invoiceNumber;
    document.getElementById('discount').value = currentBill.discount;
    const salesCodeSel = document.getElementById('salesCode');
    if (salesCodeSel) salesCodeSel.value = currentBill.salesCode || '';
    renderBillItems();
    calculateTotal();
    addRecentInvoice(invoiceId, currentBill.total, sale.date);
}

function addRecentInvoice(id, total, date) {
    let rec = JSON.parse(localStorage.getItem('recentInvoices') || '[]');
    rec = rec.filter(r => r.id !== id);
    rec.unshift({ id, total, date });
    rec = rec.slice(0, 10);
    localStorage.setItem('recentInvoices', JSON.stringify(rec));
    loadRecentInvoices();
}

function loadRecentInvoices() {
    const container = document.getElementById('recentInvoices');
    if (!container) return;
    const rec = JSON.parse(localStorage.getItem('recentInvoices') || '[]');
    container.innerHTML = '';
    rec.forEach(r => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer; display:flex; justify-content:space-between; gap:8px;';
        div.innerHTML = `<span>${r.id}</span><span style="color:var(--text-secondary)">${formatDateTime(r.date)} · ${formatCurrency(r.total)}</span>`;
        div.onclick = () => loadInvoiceById(r.id);
        container.appendChild(div);
    });
    if (container.children.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">No recent invoices</p>';
    }
}

// Recent items
function addToRecentItems(itemCode) {
    let recent = JSON.parse(localStorage.getItem('recentItems') || '[]');
    recent = recent.filter(code => code !== itemCode);
    recent.unshift(itemCode);
    recent = recent.slice(0, 10); // Keep last 10
    localStorage.setItem('recentItems', JSON.stringify(recent));
}

function loadRecentItems() {
    const recent = JSON.parse(localStorage.getItem('recentItems') || '[]');
    const container = document.getElementById('recentItems');
    if (!container) return;

    container.innerHTML = '';
    const products = getProducts();

    recent.forEach(code => {
        const product = products.find(p => p.itemCode === code);
        if (product) {
            const div = document.createElement('div');
            div.style.cssText = 'padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer;';
            div.innerHTML = `
                <div style="font-weight: 600;">${product.name}</div>
                <div style="font-size: 0.9em; color: var(--text-secondary);">${product.itemCode} - ${formatCurrency(product.price)}</div>
            `;
            div.onclick = () => {
                document.getElementById('itemCode').value = product.itemCode;
                document.getElementById('itemName').value = product.name;
                document.getElementById('itemPrice').value = product.price;
                document.getElementById('itemQty').focus();
            };
            container.appendChild(div);
        }
    });

    if (container.children.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No recent items</p>';
    }
}

// ===== HOLD BILL SYSTEM =====
function holdCurrentBill() {
    if (currentBill.items.length === 0) {
        alert('Cannot hold an empty bill.');
        return;
    }

    let heldBills = JSON.parse(localStorage.getItem('heldBills') || '[]');
    const heldBill = {
        id: 'HB-' + Date.now(),
        data: { ...currentBill },
        timestamp: new Date().toISOString()
    };
    heldBills.push(heldBill);
    localStorage.setItem('heldBills', JSON.stringify(heldBills));

    newBill(); // Clear current
    alert('Bill put on hold.');
}

function openHoldBillsModal() {
    const modal = document.getElementById('holdBillsModal');
    const container = document.getElementById('holdBillsList');
    const heldBills = JSON.parse(localStorage.getItem('heldBills') || '[]');

    container.innerHTML = '';

    if (heldBills.length === 0) {
        container.innerHTML = '<p class="text-center">No held bills found.</p>';
    } else {
        heldBills.forEach(hb => {
            const div = document.createElement('div');
            div.className = 'held-bill-item';
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 10px;';
            div.innerHTML = `
                <div>
                    <strong>${hb.data.invoiceNumber}</strong> (${hb.data.items.length} items) - 
                    <span style="color:var(--accent-primary); font-weight:bold;">${formatCurrency(hb.data.total)}</span>
                    <br><small style="color:var(--text-secondary);">${new Date(hb.timestamp).toLocaleString()}</small>
                </div>
                <div>
                    <button class="btn btn-primary btn-sm" onclick="resumeHeldBill('${hb.id}')">Resume</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteHeldBill('${hb.id}')">×</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    modal.style.display = 'block';
}

function closeHoldBillsModal() {
    document.getElementById('holdBillsModal').style.display = 'none';
}

function resumeHeldBill(id) {
    let heldBills = JSON.parse(localStorage.getItem('heldBills') || '[]');
    const hb = heldBills.find(item => item.id === id);
    if (!hb) return;

    if (currentBill.items.length > 0) {
        if (!confirm('Current active bill will be replaced. Continue?')) return;
    }

    currentBill = hb.data;
    renderBillItems();
    calculateTotal();

    // Remove from held
    heldBills = heldBills.filter(item => item.id !== id);
    localStorage.setItem('heldBills', JSON.stringify(heldBills));

    closeHoldBillsModal();
}

function deleteHeldBill(id) {
    if (!confirm('Delete this held bill?')) return;
    let heldBills = JSON.parse(localStorage.getItem('heldBills') || '[]');
    heldBills = heldBills.filter(item => item.id !== id);
    localStorage.setItem('heldBills', JSON.stringify(heldBills));
    openHoldBillsModal(); // refresh
}

// ===== QUICK CREATE PRODUCT =====
function openQuickCreateModal(code) {
    document.getElementById('quickCreateCode').textContent = code;
    document.getElementById('quickCreateForm').reset();

    // Populate categories
    const cat1 = JSON.parse(localStorage.getItem('support_category1') || '[]');
    const catSel = document.getElementById('quickProdCategory');
    catSel.innerHTML = '<option value="">None</option>';
    cat1.forEach(c => catSel.innerHTML += `<option value="${c.name}">${c.name}</option>`);

    document.getElementById('quickCreateModal').style.display = 'block';
    document.getElementById('quickProdName').focus();
}

function closeQuickCreateModal() {
    document.getElementById('quickCreateModal').style.display = 'none';
}

function handleQuickCreate(event) {
    event.preventDefault();
    const code = document.getElementById('quickCreateCode').textContent;
    const name = document.getElementById('quickProdName').value;
    const price = parseFloat(document.getElementById('quickProdPrice').value);
    const cat = document.getElementById('quickProdCategory').value;

    const newProd = {
        itemCode: code,
        name: name,
        price: price,
        cost: price * 0.7, // Estimate cost
        category1: cat,
        stock: 100
    };

    saveProductData(newProd);

    // Fill POS row
    document.getElementById('itemCode').value = code;
    document.getElementById('itemName').value = name;
    document.getElementById('itemPrice').value = price;

    closeQuickCreateModal();
    document.getElementById('itemQty').focus();
}

// THEME SWITCHER
function changeTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// ============================================================
// RECEIPT ACTIONS (WhatsApp, SMS, Print, Done)
// ============================================================

let savedReceiptData = null;

function showReceiptActionsModal() {
    // Save current bill data for sharing/printing before creating a new bill
    savedReceiptData = { ...currentBill };
    
    // Clear the recovery draft immediately so reloading doesn't prompt to restore it
    localStorage.removeItem('posDraft');
    
    // Add calculated savings
    let totalSavings = 0;
    savedReceiptData.items.forEach(item => {
        totalSavings += (item.discount || 0) * item.qty;
    });
    totalSavings += (savedReceiptData.discount || 0);
    savedReceiptData.totalSavings = totalSavings;

    // Display basic info in modal
    document.getElementById('receiptActionInvoice').textContent = savedReceiptData.invoiceNumber;
    document.getElementById('receiptActionTotal').textContent = formatCurrency(savedReceiptData.total);
    
    // Pre-fill customer phone if available
    const phoneInput = document.getElementById('sharePhoneNumber');
    if (savedReceiptData.customerContact) {
        phoneInput.value = savedReceiptData.customerContact.replace(/[^0-9]/g, '');
    } else {
        phoneInput.value = '';
    }

    document.getElementById('receiptActionsModal').classList.add('active');
}

function generatePlainTextReceipt() {
    if (!savedReceiptData) return '';
    const settings = getSettings();
    const storeName = settings.storeName || 'AMi STORE';
    const currency = settings.currency || 'LKR';
    
    let text = `========================\n`;
    text += `       *${storeName.toUpperCase()}*\n`;
    if (settings.storeAddress) text += `   ${settings.storeAddress}\n`;
    if (settings.storeContact) text += `   Tel: ${settings.storeContact}\n`;
    if (settings.storeWebsite) text += `   ${settings.storeWebsite}\n`;
    text += `========================\n`;
    text += `Invoice : ${savedReceiptData.invoiceNumber}\n`;
    text += `Date    : ${formatDateTime(new Date(savedReceiptData.date || Date.now()))}\n`;
    text += `SC      : ${savedReceiptData.salesCode || 'N/A'}\n`;
    text += `------------------------\n`;
    
    savedReceiptData.items.forEach(item => {
        text += `${item.name.toUpperCase()}\n`;
        text += `${item.qty} x ${item.price} = ${item.total}\n`;
        if (item.discount > 0) {
            text += `  Item Disc: -${item.discount * item.qty}\n`;
        }
    });
    
    text += `------------------------\n`;
    text += `Subtotal :      ${currency} ${savedReceiptData.subtotal}\n`;
    if (savedReceiptData.discount > 0) {
        text += `Discount :     -${currency} ${savedReceiptData.discount}\n`;
    }
    text += `*TOTAL    :      ${currency} ${savedReceiptData.total}*\n`;
    text += `Payment  :      ${currency} ${savedReceiptData.paidAmount}\n`;
    text += `Balance  :      ${currency} ${savedReceiptData.balance}\n`;
    
    if (savedReceiptData.totalSavings > 0) {
        text += `------------------------\n`;
        text += `✨ YOU SAVED: ${currency} ${savedReceiptData.totalSavings} ✨\n`;
    }
    
    text += `========================\n`;
    if (settings.thanksMessage) {
        const lines = settings.thanksMessage.split('\n');
        lines.forEach(line => {
            text += `   ${line.trim()}\n`; // centering simulated by spaces
        });
    } else {
        text += `   Thank you for shopping!\n`;
    }
    text += `------------------------\n`;
    text += `   Automated Receipt\n`;
    text += `Designed and Devolped By AMi\n`;
    text += `========================`;
    
    return encodeURIComponent(text);
}

function getSharePhoneNumber() {
    let phone = document.getElementById('sharePhoneNumber').value.trim();
    // Basic cleanup: remove spaces, -, +, (, )
    phone = phone.replace(/[^\d+]/g, '');
    if (!phone) {
        alert('Please enter a phone number to share.');
        return null;
    }
    return phone;
}

function receiptActionWhatsApp() {
    const phone = getSharePhoneNumber();
    if (!phone) return;
    const text = generatePlainTextReceipt();
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
}

function receiptActionSMS() {
    const phone = getSharePhoneNumber();
    if (!phone) return;
    const text = generatePlainTextReceipt();
    // Use sms: scheme (varies slightly by OS, but this is the standard web approach)
    window.open(`sms:${phone}?body=${text}`, '_self');
}

function receiptActionPrint() {
    if (!window.ReceiptPrinting || !window.InvoiceCore) {
        // Fallback to legacy printReceipt if new modules are missing.
        const oldBill = { ...currentBill };
        currentBill = { ...savedReceiptData };
        printReceipt();
        currentBill = oldBill;
        return;
    }

    savedReceiptData.invoiceCore = window.InvoiceCore.buildEssentialInvoiceCoreFromSale(savedReceiptData);
    window.ReceiptPrinting.printSaleNormalReceipt(savedReceiptData);
}

function receiptActionPrintServer() {
    if (!window.PrintQueue) {
        alert('Print queue not available.');
        return;
    }
    
    if (typeof sendToServerPrint === 'function') {
        const oldBill = { ...currentBill };
        currentBill = { ...savedReceiptData };
        sendToServerPrint();
        currentBill = oldBill;
    } else {
        alert('Server printing function not found.');
    }
}

function receiptActionDone() {
    document.getElementById('receiptActionsModal').classList.remove('active');
    savedReceiptData = null;
    document.getElementById('sharePhoneNumber').value = '';
    // Start fresh
    newBill();
}

