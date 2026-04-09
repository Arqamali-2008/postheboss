// ===== CORE UTILITIES & INITIALIZATION =====

// Import Lock System
// We assume lock.js is in the same directory (src)
if (!window.POSLock) {
	const script = document.createElement('script');
	script.src = 'lock.js';
	document.head.appendChild(script);
}


// Settings defaults
const DEFAULT_SETTINGS = {
	storeName: 'AMi STORE',
	storeAddress: '',
	storeContact: '',
	receiptHeader: '',
	thanksMessage: 'Thank you for shopping with us!',
	username: 'cp123',
	passcode: '2005',
	dateFormat: 'DD-MM-YYYY',
	timeFormat: '12h',
	useManualDateTime: false,
	manualDateTimeISO: '',
	currency: 'LKR',
	decimalMode: '2',
	invoiceResetMode: 'never', // options: 'daily', 'monthly', 'never'
	// Receipt print tuning (Epson 80mm defaults)
	receiptPaperWidthMm: 80,
	receiptContentWidthMm: 72,
	receiptPaddingMm: 4,
	receiptLogoMaxPx: 120,
	indexMusicEnabled: false,
	indexMusicPath: 'HAC/2.mp3',
	indexMusicVolume: 0.2
};

function getSettings() {
	const s = JSON.parse(localStorage.getItem('settings') || '{}');
	return { ...DEFAULT_SETTINGS, ...s };
}

function saveSettings(newSettings) {
	const merged = { ...getSettings(), ...newSettings };
	localStorage.setItem('settings', JSON.stringify(merged));
	return merged;
}

// Try autoplay for media throughout app pages; fallback on first interaction.
function ensureSystemMediaAutoplay() {
	const tryPlayAll = () => {
		const mediaEls = Array.from(document.querySelectorAll('audio, video'));
		mediaEls.forEach((el) => {
			try {
				// Do not force audio volume globally; pages/components control volume via settings.
				const p = el.play();
				if (p && p.catch) p.catch(() => { });
			} catch (_) { }
		});
	};

	tryPlayAll();
	window.addEventListener('pointerdown', tryPlayAll, { once: true });
	window.addEventListener('keydown', tryPlayAll, { once: true });
	window.addEventListener('focus', tryPlayAll);
	window.addEventListener('pageshow', tryPlayAll);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') tryPlayAll();
	});

	// If audio/video tags are added later, autoplay them too.
	try {
		const observer = new MutationObserver((mutations) => {
			for (const m of mutations) {
				for (const n of m.addedNodes) {
					if (!n || n.nodeType !== 1) continue;
					const el = n;
					if (el.matches && el.matches('audio, video')) {
						tryPlayAll();
						return;
					}
					if (el.querySelector && el.querySelector('audio, video')) {
						tryPlayAll();
						return;
					}
				}
			}
		});
		observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
	} catch (_) { }
}

// Check authentication
function checkAuth() {
	if (
		window.location.pathname.includes('login.html') ||
		window.location.pathname.includes('first-show.html') ||
		window.location.pathname.includes('boot.html') ||
		window.location.pathname.includes('access-granted.html')
	) {
		return;
	}
	const isLoggedIn = sessionStorage.getItem('isLoggedIn');
	if (!isLoggedIn) {
		window.location.href = 'first-show.html';
	}
}

// Logout function
function logout() {
	sessionStorage.removeItem('isLoggedIn');
	sessionStorage.removeItem('hacFirstShowDone');
	sessionStorage.removeItem('hacBootDone');
	sessionStorage.removeItem('hacLoginPassed');
	sessionStorage.removeItem('skipIndexSplash');
	window.location.href = 'first-show.html';
}

// Initialize theme
function initTheme() {
	const savedTheme = localStorage.getItem('theme') || 'dark';
	ensureThemeSelectHasHackerOption();
	document.documentElement.setAttribute('data-theme', savedTheme);

	const themeSelect = document.getElementById('themeSelect');
	if (themeSelect) themeSelect.value = savedTheme;

	updateThemeToggle();
}

// Global Theme Change
function changeTheme(theme) {
	ensureThemeSelectHasHackerOption();
	document.documentElement.setAttribute('data-theme', theme);
	localStorage.setItem('theme', theme);
	updateThemeToggle();
}

function ensureThemeSelectHasHackerOption() {
	const themeSelect = document.getElementById('themeSelect');
	if (!themeSelect) return;
	const exists = Array.from(themeSelect.options).some(opt => opt.value === 'hacker');
	if (!exists) {
		const opt = document.createElement('option');
		opt.value = 'hacker';
		opt.textContent = 'Hacker Green-Black';
		themeSelect.appendChild(opt);
	}
}

// Toggle theme
function toggleTheme() {
	const currentTheme = document.documentElement.getAttribute('data-theme');
	const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
	document.documentElement.setAttribute('data-theme', newTheme);
	localStorage.setItem('theme', newTheme);
	updateThemeToggle();
}

// Update theme toggle button
function updateThemeToggle() {
	const themeToggle = document.getElementById('themeToggle');
	if (themeToggle) {
		const currentTheme = document.documentElement.getAttribute('data-theme');
		themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
	}
}

// Initialize theme toggle on page load
document.addEventListener('DOMContentLoaded', function () {
	// Global fast-scan tracker (barcode/QR keyboard wedge scanners).
	// This allows scanner data entry in any focused input across the system.
	window.__globalScanner = {
		buffer: '',
		lastKeyTs: 0
	};

	document.addEventListener('keydown', function (e) {
		const scanner = window.__globalScanner;
		const now = Date.now();

		// Build scanner buffer from very fast key stream.
		if (e.key.length === 1) {
			if (now - scanner.lastKeyTs < 45) {
				scanner.buffer += e.key;
			} else {
				scanner.buffer = e.key;
			}
			scanner.lastKeyTs = now;
		}

		if (e.key === 'Enter') {
			const active = document.activeElement;
			const isInputLike = active && (
				active.tagName === 'INPUT' ||
				active.tagName === 'TEXTAREA'
			);

			// If this looks like scanner input, force-write into current input
			// and block focus-jump handlers.
			if (isInputLike && scanner.buffer.length > 3) {
				try {
					if (!active.readOnly && !active.disabled) {
						active.value = scanner.buffer;
						active.dispatchEvent(new Event('input', { bubbles: true }));
						active.dispatchEvent(new Event('change', { bubbles: true }));
					}
				} catch (_) { }

				scanner.buffer = '';
				scanner.lastKeyTs = now;
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			// Clear stale scan buffer after normal Enter handling.
			scanner.buffer = '';
		}
	}, true);

	checkAuth();
	ensureSystemMediaAutoplay();
	initTheme();
	const themeToggle = document.getElementById('themeToggle');
	if (themeToggle) {
		themeToggle.addEventListener('click', toggleTheme);
	}

	// Global Enter Key Handler
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Enter') {
			const active = document.activeElement;
			if (!active) return;

			// If it's a button, click it
			if (active.tagName === 'BUTTON') {
				// Don't intercept if it's already handling enter or something
				// active.click(); 
				return; // Buttons handle enter by default
			}

			// If it's an input/select, go to next
			if (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA') {
				// If the element has a custom enter handler (like handleInputEnter), let it be.
				// But user wants it for ALL pages.

				// Find all focusable elements
				const focusables = Array.from(document.querySelectorAll('input:not([readonly]):not([disabled]), select:not([disabled]), button:not([disabled]), textarea:not([disabled])'))
					.filter(el => el.offsetWidth > 0 || el.offsetHeight > 0);

				const index = focusables.indexOf(active);
				if (index > -1 && index < focusables.length - 1) {
					e.preventDefault();
					const next = focusables[index + 1];
					next.focus();
					if (next.tagName === 'INPUT') next.select();
				}
			}
		}
	});
});

// ===== DATA MANAGEMENT (LocalStorage) =====

// Initialize data storage
function initStorage() {
	if (!localStorage.getItem('invoiceCounter')) {
		localStorage.setItem('invoiceCounter', '1');
	}
	if (!localStorage.getItem('employees')) {
		localStorage.setItem('employees', JSON.stringify([]));
	}
	if (!localStorage.getItem('products')) {
		localStorage.setItem('products', JSON.stringify([]));
	}
	if (!localStorage.getItem('sales')) {
		localStorage.setItem('sales', JSON.stringify([]));
	}
	// Ensure settings exist
	if (!localStorage.getItem('settings')) {
		localStorage.setItem('settings', JSON.stringify(DEFAULT_SETTINGS));
	}

	// Seed demo data if empty
	try {
		const emp = JSON.parse(localStorage.getItem('employees') || '[]');
		if (!emp || emp.length === 0) {
			localStorage.setItem('employees', JSON.stringify([
				{ salesCode: 'EMP-01', name: 'AMi', role: 'Cashier', contact: '0700000000', salary: 0 },
				{ salesCode: 'EMP-02', name: 'Zara', role: 'Cashier', contact: '0711111111', salary: 0 }
			]));
		}
		const prods = JSON.parse(localStorage.getItem('products') || '[]');
		if (!prods || prods.length === 0) {
			localStorage.setItem('products', JSON.stringify([
				{ itemCode: 'ITM-001', name: 'Sample Item A', cost: 80, price: 100, stock: 50 },
				{ itemCode: 'ITM-002', name: 'Sample Item B', cost: 45, price: 60, stock: 100 },
				{ itemCode: 'ITM-003', name: 'Sample Item C', cost: 120, price: 150, stock: 30 }
			]));
		}
	} catch (_) { }
}

// Get next invoice number with reset logic
function getNextInvoiceNumber() {
	const s = getSettings();
	let counter = parseInt(localStorage.getItem('invoiceCounter') || '1');
	const lastReset = localStorage.getItem('lastInvoiceResetDate'); // YYYY-MM-DD
	const today = new Date().toISOString().split('T')[0];

	if (s.invoiceResetMode === 'daily' && lastReset !== today) {
		counter = 1;
		localStorage.setItem('lastInvoiceResetDate', today);
	} else if (s.invoiceResetMode === 'monthly' && lastReset && lastReset.substring(0, 7) !== today.substring(0, 7)) {
		counter = 1;
		localStorage.setItem('lastInvoiceResetDate', today);
	}

	const devicePrefix = localStorage.getItem('pos_invoice_prefix') || 'INV';
	const invoiceNumber = `${devicePrefix}-${String(counter).padStart(6, '0')}`;
	localStorage.setItem('invoiceCounter', String(counter + 1));
	return invoiceNumber;
}

// Get all employees
function getEmployees() { return JSON.parse(localStorage.getItem('employees') || '[]'); }

// Save employee
function saveEmployeeData(employee) {
	const employees = getEmployees();
	const index = employees.findIndex(emp => emp.salesCode === employee.salesCode);
	const updated = { ...employee, updated_at: new Date().toISOString() };
	if (index >= 0) employees[index] = updated; else employees.push(updated);
	localStorage.setItem('employees', JSON.stringify(employees));
	if (window.TursoSyncService?.queueLocalMutation) {
		window.TursoSyncService.queueLocalMutation('employees', updated);
	}
	return employees;
}

// Delete employee
function deleteEmployeeData(salesCode) {
	const employees = getEmployees();
	const filtered = employees.filter(emp => emp.salesCode !== salesCode);
	localStorage.setItem('employees', JSON.stringify(filtered));
	return filtered;
}

// Get all products
function getProducts() { return JSON.parse(localStorage.getItem('products') || '[]'); }

// Get product by code
function getProductByCode(code) { return getProducts().find(p => p.itemCode === code); }

// Save product
function saveProductData(product) {
	const products = getProducts();
	const index = products.findIndex(p => p.itemCode === product.itemCode);
	const updated = { ...product, updated_at: new Date().toISOString() };
	if (index >= 0) products[index] = updated; else products.push(updated);
	localStorage.setItem('products', JSON.stringify(products));
	if (window.TursoSyncService?.queueLocalMutation) {
		window.TursoSyncService.queueLocalMutation('products', updated);
	}
	return products;
}

// Delete product
function deleteProductData(itemCode) {
	const products = getProducts();
	const filtered = products.filter(p => p.itemCode !== itemCode);
	localStorage.setItem('products', JSON.stringify(filtered));
	return filtered;
}

// Update product stock
function updateProductStock(itemCode, qty) {
	const products = getProducts();
	const product = products.find(p => p.itemCode === itemCode);
	if (product) {
		product.stock = Math.max(0, (product.stock || 0) - qty);
		product.updated_at = new Date().toISOString();
		localStorage.setItem('products', JSON.stringify(products));
		if (window.TursoSyncService?.queueLocalMutation) {
			window.TursoSyncService.queueLocalMutation('products', product);
		}
	}
}

// Get all sales
function getSales() { return JSON.parse(localStorage.getItem('sales') || '[]'); }

// Save sale
function saveSale(sale) {
	// Keep invoiceCore for QR/Barcode receipts (optional if invoice-core module is loaded).
	if (!sale.invoiceCore && window.InvoiceCore?.buildEssentialInvoiceCoreFromSale) {
		try {
			sale.invoiceCore = window.InvoiceCore.buildEssentialInvoiceCoreFromSale(sale);
		} catch (_) { }
	}

	// updated_at drives conflict resolution during Turso sync.
	sale.updated_at = new Date().toISOString();

	const sales = getSales();
	const index = sales.findIndex(existing => existing.invoiceNumber === sale.invoiceNumber);
	if (index >= 0) {
		sales[index] = sale;
	} else {
		sales.push(sale);
	}
	localStorage.setItem('sales', JSON.stringify(sales));

	// Trigger Cloud Sync if available
	if (window.SupabaseSyncService && window.SupabaseSyncService.isConnected) {
		// Run in background, don't await (UI shouldn't freeze)
		window.SupabaseSyncService.syncTable('sales').catch(console.error);
	}
	if (window.TursoSyncService?.queueLocalMutation) {
		window.TursoSyncService.queueLocalMutation('sales', sale);
	}

	return sales;
}

// Get sales by date range
function getSalesByDateRange(fromDate, toDate) {
	const sales = getSales();
	if (!fromDate && !toDate) return sales;
	return sales.filter(sale => {
		const saleDate = new Date(sale.date);
		if (fromDate && saleDate < new Date(fromDate)) return false;
		if (toDate && saleDate > new Date(toDate + 'T23:59:59')) return false;
		return true;
	});
}

// Format currency
function formatCurrency(amount) {
	const s = getSettings();
	const decimals = s.decimalMode === '0' ? 0 : 2;
	const value = Number.isFinite(+amount) ? (+amount).toFixed(decimals) : (0).toFixed(decimals);
	const symbolMap = {
		LKR: 'LKR ',
		Rs: 'Rs ',
		USD: '$',
		AUD: 'A$ ',
		SAR: 'SAR ',
		QAR: 'QAR ',
		AED: 'AED ',
		EUR: '€',
		GBP: '£',
		INR: '₹',
		NONE: ''
	};
	const sym = symbolMap[s.currency] != null ? symbolMap[s.currency] : (s.currency + ' ');
	return `${sym}${value}`.trim();
}

// Date/time formatting per settings
function formatDateTime(dateInput) {
	const s = getSettings();
	let dateObj;
	if (s.useManualDateTime && s.manualDateTimeISO) {
		dateObj = new Date(s.manualDateTimeISO);
	} else {
		dateObj = new Date(dateInput || new Date());
	}
	const dd = String(dateObj.getDate()).padStart(2, '0');
	const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
	const yyyy = dateObj.getFullYear();
	let datePart = s.dateFormat === 'MM-DD-YYYY' ? `${mm}-${dd}-${yyyy}` : `${dd}-${mm}-${yyyy}`;
	let hours = dateObj.getHours();
	const minutes = String(dateObj.getMinutes()).padStart(2, '0');
	let ampm = '';
	if (s.timeFormat === '12h') {
		ampm = hours >= 12 ? 'PM' : 'AM';
		hours = hours % 12 || 12;
	}
	const hh = String(hours).padStart(2, '0');
	const timePart = s.timeFormat === '12h' ? `${hh}:${minutes} ${ampm}` : `${hh}:${minutes}`;
	return `${datePart} ${timePart}`.trim();
}

// Backward compatibility
function formatDate(date) { return formatDateTime(date); }

// ===== KEYBOARD SHORTCUTS =====

document.addEventListener('keydown', function (e) {
	if (e.ctrlKey && e.key === 'F1') { e.preventDefault(); if (typeof newBill === 'function') newBill(); }
	if (e.ctrlKey && e.key === 'F2') { e.preventDefault(); if (typeof openPaymentModal === 'function') openPaymentModal(); }
	if (e.ctrlKey && e.key === 'F3') { e.preventDefault(); window.location.href = 'sales.html'; }
	if (e.ctrlKey && e.key === 'F4') { e.preventDefault(); window.location.href = 'index.html'; }
	if (e.ctrlKey && e.key === 'F5') { e.preventDefault(); if (typeof printReceipt === 'function') printReceipt(); }
	if (e.ctrlKey && e.key === 'F6') { e.preventDefault(); window.location.href = 'products.html'; }
	// Ctrl+I focus invoice search
	if (e.ctrlKey && (e.key === 'i' || e.key === 'I')) {
		e.preventDefault();
		const search = document.getElementById('invoiceSearch');
		if (search) { search.focus(); search.select(); }
	}
});

// ===== BACKUP & RESTORE =====

function downloadBackup() {
	const backup = {
		employees: getEmployees(),
		products: getProducts(),
		sales: getSales(),
		invoiceCounter: localStorage.getItem('invoiceCounter'),
		settings: getSettings(),
		exportDate: new Date().toISOString()
	};
	const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `AMi-pos-backup-${new Date().toISOString().split('T')[0]}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

function restoreBackup() {
	const fileInput = document.getElementById('backupFileInput');
	if (fileInput) fileInput.click();
}

function handleBackupUpload(event) {
	const file = event.target.files[0];
	if (!file) return;
	const reader = new FileReader();
	reader.onload = function (e) {
		try {
			const backup = JSON.parse(e.target.result);
			if (confirm('This will replace all current data. Are you sure?')) {
				if (backup.employees) localStorage.setItem('employees', JSON.stringify(backup.employees));
				if (backup.products) localStorage.setItem('products', JSON.stringify(backup.products));
				if (backup.sales) localStorage.setItem('sales', JSON.stringify(backup.sales));
				if (backup.invoiceCounter) localStorage.setItem('invoiceCounter', backup.invoiceCounter);
				if (backup.settings) localStorage.setItem('settings', JSON.stringify({ ...DEFAULT_SETTINGS, ...backup.settings }));
				alert('Backup restored successfully!');
				window.location.reload();
			}
		} catch (error) {
			alert('Error restoring backup: ' + error.message);
		}
	};
	reader.readAsText(file);
	event.target.value = '';
}

function factoryReset() {
	if (confirm('This will delete ALL data. Are you sure? This cannot be undone!')) {
		if (confirm('Final confirmation: Delete ALL data?')) {
			localStorage.clear();
			sessionStorage.clear();
			alert('Factory reset complete. Redirecting to login...');
			window.location.href = 'first-show.html';
		}
	}
}

// Initialize storage on load
initStorage();

// POS input Enter navigation (progressive focus)
document.addEventListener('keydown', function (e) {
	if (e.key !== 'Enter') return;
	const active = document.activeElement;
	if (!active) return;
	const order = ['discount']; // Allow enter on global discount to open payment modal
	const idx = order.indexOf(active.id);
	if (idx >= 0 && idx < order.length - 1) {
		const next = document.getElementById(order[idx + 1]);
		if (next) { e.preventDefault(); next.focus(); next.select && next.select(); }
	} else if (idx === order.length - 1) {
		e.preventDefault();
		if (typeof openPaymentModal === 'function') openPaymentModal();
	}
});

// ===== DATABASE BACKUP SYSTEM =====
function exportBackup() {
	// Category & time/date filters (for sales-focused backups).
	const catEl = document.getElementById('backupCategory');
	const timeEl = document.getElementById('backupTimeRange');
	const fromEl = document.getElementById('backupFromDate');
	const toEl = document.getElementById('backupToDate');

	const category = catEl ? (catEl.value || 'all') : 'all';
	const timeRange = timeEl ? (timeEl.value || 'all') : 'all';
	let fromDate = fromEl?.value || '';
	let toDate = toEl?.value || '';

	// Derive dates from timeRange if not custom
	if (timeRange !== 'all' && timeRange !== 'custom') {
		const now = new Date();
		const pad = (n) => String(n).padStart(2, '0');
		const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
		switch (timeRange) {
			case 'today':
				fromDate = todayStr;
				toDate = todayStr;
				break;
			case '7d': {
				const d = new Date(now);
				d.setDate(d.getDate() - 7);
				fromDate = d.toISOString().slice(0, 10);
				toDate = todayStr;
				break;
			}
			case '30d': {
				const d = new Date(now);
				d.setDate(d.getDate() - 30);
				fromDate = d.toISOString().slice(0, 10);
				toDate = todayStr;
				break;
			}
			case 'thisMonth': {
				const first = new Date(now.getFullYear(), now.getMonth(), 1);
				fromDate = first.toISOString().slice(0, 10);
				toDate = todayStr;
				break;
			}
		}
	}

	// Base datasets
	let employees = getEmployees();
	let products = getProducts();
	let sales = getSales();
	let customers = JSON.parse(localStorage.getItem('customers') || '[]');
	const settings = getSettings();
	const heldBills = JSON.parse(localStorage.getItem('heldBills') || '[]');

	// Apply date filter to sales only
	if (fromDate || toDate) {
		const from = fromDate ? new Date(fromDate) : null;
		const to = toDate ? new Date(toDate + 'T23:59:59') : null;
		sales = sales.filter((sale) => {
			const d = new Date(sale.date || sale.created_at || sale.updated_at || Date.now());
			if (from && d < from) return false;
			if (to && d > to) return false;
			return true;
		});
	}

	// Build filtered backup payload
	const data = {
		exportedAt: new Date().toISOString(),
		category,
		timeRange,
		fromDate: fromDate || null,
		toDate: toDate || null
	};

	if (category === 'all' || category === 'products') data.products = products;
	if (category === 'all' || category === 'employees') data.employees = employees;
	if (category === 'all' || category === 'sales') data.sales = sales;
	if (category === 'all' || category === 'customers') data.customers = customers;
	if (category === 'all' || category === 'settings') {
		data.settings = settings;
		data.heldBills = heldBills;
		data.invoiceCounter = localStorage.getItem('invoiceCounter');
	}

	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `pos_full_backup_${new Date().toISOString().split('T')[0]}.json`;
	a.click();
}

async function importBackup() {
	const fileInput = document.getElementById('importJsonFile');
	if (!fileInput || !fileInput.files.length) {
		alert('Please select a backup file (.json) first.');
		return;
	}

	if (!confirm('This will DELETE all current data and replace it with the backup. Are you sure?')) return;

	const file = fileInput.files[0];
	const reader = new FileReader();
	reader.onload = function (e) {
		try {
			const data = JSON.parse(e.target.result);
			if (data.products) localStorage.setItem('products', JSON.stringify(data.products));
			if (data.employees) localStorage.setItem('employees', JSON.stringify(data.employees));
			if (data.sales) localStorage.setItem('sales', JSON.stringify(data.sales));
			if (data.customers) localStorage.setItem('customers', JSON.stringify(data.customers));
			if (data.settings) localStorage.setItem('settings', JSON.stringify(data.settings));
			if (data.heldBills) localStorage.setItem('heldBills', JSON.stringify(data.heldBills));
			if (data.invoiceCounter) localStorage.setItem('invoiceCounter', data.invoiceCounter);

			alert('Database restored successfully! The page will now reload.');
			location.reload();
		} catch (err) {
			alert('Error importing backup: ' + err.message);
		}
	};
	reader.readAsText(file);
}
