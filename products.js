// ===== PRODUCT MANAGEMENT FUNCTIONALITY =====

let editingProduct = null;

// Initialize products page
document.addEventListener('DOMContentLoaded', function () {
    loadProducts();
    initBarcodePrintModal();
    populateSupportDropdowns();
});

// Initialize barcode print modal
function initBarcodePrintModal() {
    // Modal will be initialized when opened
}

// Open barcode print modal
function openBarcodePrintModal() {
    const products = getProducts();
    const productList = document.getElementById('barcodeProductList');
    if (!productList) return;

    productList.innerHTML = '';

    products.forEach(product => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px; border-bottom: 1px solid var(--border-color);';
        div.innerHTML = `
            <input type="checkbox" id="barcode_${product.itemCode}" value="${product.itemCode}" checked>
            <label for="barcode_${product.itemCode}" style="flex: 1; cursor: pointer;">
                <strong>${product.itemCode}</strong> - ${product.name} (${formatCurrency(product.price)})
            </label>
        `;
        productList.appendChild(div);
    });

    const modal = document.getElementById('barcodePrintModal');
    if (modal) modal.style.display = 'block';
}

// Close barcode print modal
function closeBarcodePrintModal() {
    const modal = document.getElementById('barcodePrintModal');
    if (modal) modal.style.display = 'none';
}

// Print selected barcodes
function printSelectedBarcodes() {
    const checkboxes = document.querySelectorAll('#barcodeProductList input[type="checkbox"]:checked');
    const format = document.getElementById('barcodeFormat').value;
    const quantity = parseInt(document.getElementById('barcodeQuantity').value) || 1;

    if (checkboxes.length === 0) {
        alert('Please select at least one product to print');
        return;
    }

    const products = getProducts();
    const selectedProducts = [];

    checkboxes.forEach(checkbox => {
        const product = products.find(p => p.itemCode === checkbox.value);
        if (product) {
            for (let i = 0; i < quantity; i++) {
                selectedProducts.push(product);
            }
        }
    });

    if (typeof printProductBarcodeReceipt === 'function') {
        if (format === 'receipt') {
            selectedProducts.forEach((product, index) => {
                setTimeout(() => {
                    printProductBarcodeReceipt(product);
                }, index * 500);
            });
        } else if (typeof printProductBarcodeLabel === 'function') {
            selectedProducts.forEach((product, index) => {
                setTimeout(() => {
                    printProductBarcodeLabel(product, format);
                }, index * 500);
            });
        }
    } else {
        alert('Barcode printer not initialized. Please refresh the page.');
    }

    closeBarcodePrintModal();
}

// Print single product barcode
function printProductBarcode(itemCode) {
    const product = getProductByCode(itemCode);
    if (!product) {
        alert('Product not found!');
        return;
    }

    if (typeof printProductBarcodeReceipt === 'function') {
        printProductBarcodeReceipt(product);
    } else {
        alert('Barcode printer not initialized. Please refresh the page.');
    }
}

// Load products
function loadProducts() {
    const products = getProducts();
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = '';

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No products found</td></tr>';
        return;
    }

    products.forEach(product => {
        const row = document.createElement('tr');
        const stockStatus = product.stock <= 10 ? '<span class="badge badge-danger">Low Stock</span>' : '<span class="badge badge-success">In Stock</span>';

        row.innerHTML = `
            <td>${product.itemCode}</td>
            <td>${product.name}</td>
            <td>${formatCurrency(product.cost || 0)}</td>
            <td>${formatCurrency(product.price || 0)}</td>
            <td>${product.category1 || '-'}</td>
            <td>${product.stock || 0}</td>
            <td>${stockStatus}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editProduct('${product.itemCode}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct('${product.itemCode}')">Delete</button>
                <button class="btn btn-success btn-sm" onclick="printProductBarcode('${product.itemCode}')" title="Print Barcode">📄</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Filter products
function filterProducts() {
    const searchTerm = document.getElementById('productSearch').value.toLowerCase();
    const products = getProducts();
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = '';

    const filtered = products.filter(p =>
        p.itemCode.toLowerCase().includes(searchTerm) ||
        p.name.toLowerCase().includes(searchTerm)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No products found</td></tr>';
        return;
    }

    filtered.forEach(product => {
        const row = document.createElement('tr');
        const stockStatus = product.stock <= 10 ? '<span class="badge badge-danger">Low Stock</span>' : '<span class="badge badge-success">In Stock</span>';

        row.innerHTML = `
            <td>${product.itemCode}</td>
            <td>${product.name}</td>
            <td>${formatCurrency(product.cost || 0)}</td>
            <td>${formatCurrency(product.price || 0)}</td>
            <td>${product.category1 || '-'}</td>
            <td>${product.stock || 0}</td>
            <td>${stockStatus}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editProduct('${product.itemCode}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct('${product.itemCode}')">Delete</button>
                <button class="btn btn-success btn-sm" onclick="printProductBarcode('${product.itemCode}')" title="Print Barcode">📄</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Show low stock items
function showLowStock() {
    const products = getProducts();
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = '';

    const lowStock = products.filter(p => (p.stock || 0) <= 10);

    if (lowStock.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No low stock items</td></tr>';
        return;
    }

    lowStock.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.itemCode}</td>
            <td>${product.name}</td>
            <td>${formatCurrency(product.cost || 0)}</td>
            <td>${formatCurrency(product.price || 0)}</td>
            <td>${product.category1 || '-'}</td>
            <td><span class="badge badge-danger">${product.stock || 0}</span></td>
            <td><span class="badge badge-danger">Low Stock</span></td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editProduct('${product.itemCode}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct('${product.itemCode}')">Delete</button>
                <button class="btn btn-success btn-sm" onclick="printProductBarcode('${product.itemCode}')" title="Print Barcode">📄</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Open product modal
function openProductModal() {
    editingProduct = null;
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('productForm').reset();
    populateSupportDropdowns();
    document.getElementById('productModal').classList.add('active');
    document.getElementById('prodItemCode').disabled = false;
    document.getElementById('prodItemCode').focus();
}

// Close product modal
function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    editingProduct = null;
    document.getElementById('productForm').reset();
}

// Edit product
function editProduct(itemCode) {
    const products = getProducts();
    const product = products.find(p => p.itemCode === itemCode);

    if (!product) {
        alert('Product not found!');
        return;
    }

    editingProduct = product;
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('prodItemCode').value = product.itemCode;
    document.getElementById('prodItemCode').disabled = true;
    document.getElementById('prodName').value = product.name || '';
    document.getElementById('prodCost').value = product.cost || 0;
    document.getElementById('prodPrice').value = product.price || 0;
    document.getElementById('prodStock').value = product.stock || 0;
    populateSupportDropdowns();
    document.getElementById('prodCompany').value = product.company || '';
    document.getElementById('prodCategory1').value = product.category1 || '';
    document.getElementById('prodCategory2').value = product.category2 || '';
    document.getElementById('prodDescription').value = product.description || '';
    document.getElementById('productModal').classList.add('active');
    document.getElementById('prodName').focus();
}

// Save product
function saveProduct(event) {
    event.preventDefault();

    const product = {
        itemCode: document.getElementById('prodItemCode').value.trim(),
        name: document.getElementById('prodName').value.trim(),
        cost: parseFloat(document.getElementById('prodCost').value) || 0,
        price: parseFloat(document.getElementById('prodPrice').value) || 0,
        stock: parseInt(document.getElementById('prodStock').value) || 0,
        company: document.getElementById('prodCompany').value || '',
        category1: document.getElementById('prodCategory1').value || '',
        category2: document.getElementById('prodCategory2').value || '',
        description: document.getElementById('prodDescription').value.trim()
    };

    if (!product.itemCode || !product.name) {
        alert('Please fill in all required fields!');
        return;
    }

    if (product.cost < 0 || product.price < 0 || product.stock < 0) {
        alert('Cost, Price, and Stock must be non-negative!');
        return;
    }

    // Check for duplicate item code (only when adding new)
    if (!editingProduct) {
        const existing = getProducts().find(p => p.itemCode === product.itemCode);
        if (existing) {
            alert('Item Code already exists!');
            return;
        }
    } else {
        // Preserve existing stock if editing (unless explicitly changed)
        // Actually, we want to allow stock updates, so we use the form value
    }

    saveProductData(product);
    loadProducts();
    closeProductModal();

    // Clear search to show all products
    document.getElementById('productSearch').value = '';
}

// Delete product
function deleteProduct(itemCode) {
    if (!confirm(`Are you sure you want to delete product ${itemCode}?`)) {
        return;
    }

    // Check if product is used in sales
    const sales = getSales();
    const isUsed = sales.some(sale =>
        sale.items.some(item => item.code === itemCode)
    );

    if (isUsed) {
        if (!confirm('This product is used in sales records. Deleting will not remove sales data. Continue?')) {
            return;
        }
    }

    deleteProductData(itemCode);
    loadProducts();
}

// ==== SUPPORTING DATA FUNCTIONS ====
function populateSupportDropdowns() {
    const companies = JSON.parse(localStorage.getItem('support_company') || '[]');
    const cat1 = JSON.parse(localStorage.getItem('support_category1') || '[]');
    const cat2 = JSON.parse(localStorage.getItem('support_category2') || '[]');

    function fillOptions(elId, list, type) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.innerHTML = '<option value="">Select ' + type + '</option>';
        list.forEach(item => {
            el.innerHTML += `<option value="${item.name}">${item.name}</option>`;
        });
    }
    fillOptions('prodCompany', companies, 'Company');
    fillOptions('prodCategory1', cat1, 'Category 1');
    fillOptions('prodCategory2', cat2, 'Category 2');
}

window.openSupportModal = function (type) {
    document.getElementById('supportDataType').value = type;
    document.getElementById('supportName').value = '';
    document.getElementById('supportLocation').value = '';
    document.getElementById('supportDesc').value = '';
    document.getElementById('supportProducts').value = '';

    document.getElementById('supportGroupLocation').style.display = 'none';
    document.getElementById('supportGroupProducts').style.display = 'none';

    let title = '';
    if (type === 'company') {
        title = 'Add Company';
        document.getElementById('supportGroupLocation').style.display = 'block';
        document.getElementById('supportGroupProducts').style.display = 'block';
    } else if (type === 'category1') {
        title = 'Add Category 1';
    } else if (type === 'category2') {
        title = 'Add Category 2';
    }

    document.getElementById('supportDataTitle').textContent = title;
    document.getElementById('supportDataModal').classList.add('active');
};

window.closeSupportModal = function () {
    document.getElementById('supportDataModal').classList.remove('active');
};

window.saveSupportData = function () {
    const type = document.getElementById('supportDataType').value;
    const name = document.getElementById('supportName').value.trim();
    if (!name) { alert('Name is required!'); return; }

    const storeKey = `support_${type}`;
    const list = JSON.parse(localStorage.getItem(storeKey) || '[]');

    if (list.find(i => i.name.toLowerCase() === name.toLowerCase())) {
        alert(name + ' already exists!');
        return;
    }

    const obj = { name: name, description: document.getElementById('supportDesc').value.trim() };
    if (type === 'company') {
        obj.location = document.getElementById('supportLocation').value.trim();
        obj.products = document.getElementById('supportProducts').value.trim();
    }

    list.push(obj);
    localStorage.setItem(storeKey, JSON.stringify(list));

    // Refresh dropdowns and auto-select new item
    populateSupportDropdowns();

    if (type === 'company') document.getElementById('prodCompany').value = name;
    if (type === 'category1') document.getElementById('prodCategory1').value = name;
    if (type === 'category2') document.getElementById('prodCategory2').value = name;

    closeSupportModal();
};

