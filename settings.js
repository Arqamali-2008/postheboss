// ===== SETTINGS LOGIC =====

document.addEventListener('DOMContentLoaded', function () {
	bindSettingsForm();
	updatePreview();
	setupSyncEvents();
	setupMSAccessEvents();
	setupAdvancedSystemSettings();
	updateSyncStatus();
	loadSyncLog();
});

function bindSettingsForm() {
	const s = getSettings();
	document.getElementById('setStoreName').value = s.storeName || '';
	document.getElementById('setStoreAddress').value = s.storeAddress || '';
	document.getElementById('setStoreContact').value = s.storeContact || '';
	document.getElementById('setStoreWebsite').value = s.storeWebsite || '';
	document.getElementById('setReceiptHeader').value = s.receiptHeader || '';
	document.getElementById('setThanksMessage').value = s.thanksMessage || '';
	document.getElementById('setUsername').value = s.username || '';
	document.getElementById('setPasscode').value = s.passcode || '';
	document.getElementById('setDateFormat').value = s.dateFormat || 'DD-MM-YYYY';
	document.getElementById('setTimeFormat').value = s.timeFormat || '12h';
	document.getElementById('setUseManual').value = String(!!s.useManualDateTime);
	document.getElementById('setManualISO').value = s.manualDateTimeISO ? s.manualDateTimeISO.substring(0, 16) : '';
	document.getElementById('setCurrency').value = s.currency || 'LKR';
	document.getElementById('setDecimalMode').value = s.decimalMode || '2';
	document.getElementById('setInvoiceResetMode').value = s.invoiceResetMode || 'never';
	document.getElementById('setReceiptPaperWidthMm').value = String(s.receiptPaperWidthMm ?? 80);
	document.getElementById('setReceiptContentWidthMm').value = String(s.receiptContentWidthMm ?? 72);
	document.getElementById('setReceiptPaddingMm').value = String(s.receiptPaddingMm ?? 4);
	document.getElementById('setReceiptLogoMaxPx').value = String(s.receiptLogoMaxPx ?? 120);
	const indexMusicEnabled = document.getElementById('setIndexMusicEnabled');
	const indexMusicPaths = document.getElementById('setIndexMusicPaths');
	const indexMusicVolume = document.getElementById('setIndexMusicVolume');
	if (indexMusicEnabled) indexMusicEnabled.value = String(!!s.indexMusicEnabled);
	if (indexMusicPaths) {
		const list = Array.isArray(s.indexMusicPaths) && s.indexMusicPaths.length
			? s.indexMusicPaths
			: [(s.indexMusicPath || 'HAC/2.mp3')];
		indexMusicPaths.value = list.filter(Boolean).slice(0, 10).join('\n');
	}
	if (indexMusicVolume) indexMusicVolume.value = String(Math.round((s.indexMusicVolume ?? 0.2) * 100));

	// Auto-save handlers
	const inputs = [
		'setStoreName', 'setStoreAddress', 'setStoreContact', 'setStoreWebsite', 'setReceiptHeader', 'setThanksMessage',
		'setUsername', 'setPasscode', 'setDateFormat', 'setTimeFormat', 'setUseManual', 'setManualISO',
		'setCurrency', 'setDecimalMode', 'setInvoiceResetMode',
		'setReceiptPaperWidthMm', 'setReceiptContentWidthMm', 'setReceiptPaddingMm', 'setReceiptLogoMaxPx',
		'setIndexMusicEnabled', 'setIndexMusicPaths', 'setIndexMusicVolume'
	];
	inputs.forEach(id => {
		const el = document.getElementById(id);
		if (!el) return;
		el.addEventListener('input', handleSettingChange);
		el.addEventListener('change', handleSettingChange);
	});
}

function handleSettingChange() {
	const rawPaths = (document.getElementById('setIndexMusicPaths')?.value || '')
		.split(/\r?\n/)
		.map(s => s.trim())
		.filter(Boolean)
		.slice(0, 10);

	const newSettings = {
		storeName: document.getElementById('setStoreName').value.trim(),
		storeAddress: document.getElementById('setStoreAddress').value.trim(),
		storeContact: document.getElementById('setStoreContact').value.trim(),
		storeWebsite: document.getElementById('setStoreWebsite').value.trim(),
		receiptHeader: document.getElementById('setReceiptHeader').value.trim(),
		thanksMessage: document.getElementById('setThanksMessage').value.trim(),
		username: document.getElementById('setUsername').value.trim(),
		passcode: document.getElementById('setPasscode').value,
		dateFormat: document.getElementById('setDateFormat').value,
		timeFormat: document.getElementById('setTimeFormat').value,
		useManualDateTime: document.getElementById('setUseManual').value === 'true',
		manualDateTimeISO: document.getElementById('setManualISO').value ? new Date(document.getElementById('setManualISO').value).toISOString() : '',
		currency: document.getElementById('setCurrency').value,
		decimalMode: document.getElementById('setDecimalMode').value,
		invoiceResetMode: document.getElementById('setInvoiceResetMode').value,
		receiptPaperWidthMm: Math.max(58, Math.min(90, parseInt(document.getElementById('setReceiptPaperWidthMm').value || '80', 10) || 80)),
		receiptContentWidthMm: Math.max(48, Math.min(84, parseInt(document.getElementById('setReceiptContentWidthMm').value || '72', 10) || 72)),
		receiptPaddingMm: Math.max(0, Math.min(10, parseInt(document.getElementById('setReceiptPaddingMm').value || '4', 10) || 4)),
		receiptLogoMaxPx: Math.max(60, Math.min(220, parseInt(document.getElementById('setReceiptLogoMaxPx').value || '120', 10) || 120)),
		indexMusicEnabled: (document.getElementById('setIndexMusicEnabled')?.value || 'false') === 'true',
		indexMusicPaths: rawPaths,
		// Backward compatibility for any older code paths
		indexMusicPath: (rawPaths[0] || 'HAC/2.mp3').trim() || 'HAC/2.mp3',
		indexMusicVolume: Math.max(0, Math.min(1, (parseFloat(document.getElementById('setIndexMusicVolume')?.value || '20') || 20) / 100))
	};
	saveSettings(newSettings);
	updatePreview();
}

function updatePreview() {
	const s = getSettings();
	document.getElementById('prevStoreName').textContent = s.storeName || 'AMI STORE';

	const detailsEl = document.getElementById('prevStoreDetails');
	if (detailsEl) {
		let details = [];
		if (s.storeAddress) details.push(s.storeAddress);
		if (s.storeContact) details.push(s.storeContact);
		if (s.receiptHeader) details.push(s.receiptHeader);
		detailsEl.innerHTML = details.join('<br>') || 'Address Line 1<br>Contact Info';
	}

	document.getElementById('prevThanks').textContent = s.thanksMessage || 'Thank you for shopping with us!';
	document.getElementById('prevDate').textContent = formatDateTime(new Date());

	// Monetary preview
	const unit = formatCurrency(100);
	const total = formatCurrency(100);
	const zero = formatCurrency(0);
	const payment = `CASH: ${total}`;
	document.getElementById('prevUnit').textContent = unit;
	document.getElementById('prevLineTotal').textContent = total;
	document.getElementById('prevSubtotal').textContent = total;
	document.getElementById('prevDiscount').textContent = zero;
	document.getElementById('prevTotal').textContent = total;
	document.getElementById('prevPayment').textContent = payment;
	document.getElementById('prevBalance').textContent = zero;
}

// Setup sync events
function setupSyncEvents() {
	const syncNowBtn = document.getElementById('syncNowBtn');
	const syncToEMSBtn = document.getElementById('syncToEMSBtn');
	const syncFromEMSBtn = document.getElementById('syncFromEMSBtn');
	const syncBidirectionalBtn = document.getElementById('syncBidirectionalBtn');
	const clearSyncLogBtn = document.getElementById('clearSyncLogBtn');
	const autoSyncEnabled = document.getElementById('autoSyncEnabled');

	if (syncNowBtn) {
		syncNowBtn.addEventListener('click', async () => {
			if (typeof syncEmployeesBidirectional === 'function') {
				syncNowBtn.disabled = true;
				syncNowBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';

				try {
					const result = await syncEmployeesBidirectional();
					alert(`Sync completed! Created: ${result.toEMS.created + result.fromEMS.created}, Updated: ${result.toEMS.updated + result.fromEMS.updated}`);
					updateSyncStatus();
					loadSyncLog();
				} catch (error) {
					alert('Sync failed: ' + error.message);
				} finally {
					syncNowBtn.disabled = false;
					syncNowBtn.innerHTML = '<i class="fas fa-sync"></i> Sync Now';
				}
			}
		});
	}

	if (syncToEMSBtn) {
		syncToEMSBtn.addEventListener('click', async () => {
			if (typeof syncEmployeesToEMS === 'function') {
				try {
					const result = await syncEmployeesToEMS();
					alert(`Synced to EMS: ${result.created} created, ${result.updated} updated`);
					updateSyncStatus();
					loadSyncLog();
				} catch (error) {
					alert('Sync failed: ' + error.message);
				}
			}
		});
	}

	if (syncFromEMSBtn) {
		syncFromEMSBtn.addEventListener('click', async () => {
			if (typeof syncEmployeesFromEMS === 'function') {
				try {
					const result = await syncEmployeesFromEMS();
					alert(`Synced from EMS: ${result.created} created, ${result.updated} updated`);
					updateSyncStatus();
					loadSyncLog();
				} catch (error) {
					alert('Sync failed: ' + error.message);
				}
			}
		});
	}

	if (syncBidirectionalBtn) {
		syncBidirectionalBtn.addEventListener('click', async () => {
			if (typeof syncEmployeesBidirectional === 'function') {
				try {
					const result = await syncEmployeesBidirectional();
					alert(`Bidirectional sync completed!`);
					updateSyncStatus();
					loadSyncLog();
				} catch (error) {
					alert('Sync failed: ' + error.message);
				}
			}
		});
	}

	if (clearSyncLogBtn) {
		clearSyncLogBtn.addEventListener('click', () => {
			if (confirm('Clear sync log?')) {
				if (typeof clearSyncLog === 'function') {
					clearSyncLog();
				} else {
					localStorage.removeItem('pos_sync_log');
					localStorage.removeItem('pos_last_sync');
				}
				loadSyncLog();
				alert('Sync log cleared');
			}
		});
	}

	if (autoSyncEnabled) {
		autoSyncEnabled.addEventListener('change', (e) => {
			localStorage.setItem('pos_autoSync', e.target.checked ? 'true' : 'false');
		});
		autoSyncEnabled.checked = localStorage.getItem('pos_autoSync') !== 'false';
	}
}

// Update sync status
function updateSyncStatus() {
	if (typeof getSyncStatus === 'function') {
		const status = getSyncStatus();
		const statusText = document.getElementById('syncStatusText');
		if (statusText) {
			if (status.lastSync) {
				const lastSyncDate = new Date(status.lastSync);
				statusText.textContent = `Last sync: ${lastSyncDate.toLocaleString()}`;
			} else {
				statusText.textContent = 'Last sync: Never';
			}
		}
	}
}

// Load sync log
function loadSyncLog() {
	const container = document.getElementById('syncLogContainer');
	if (!container) return;

	if (typeof getSyncLog === 'function') {
		const log = getSyncLog(20);
		if (log.length === 0) {
			container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No sync history</p>';
		} else {
			container.innerHTML = log.map(entry => {
				const direction = entry.direction === 'EMS_TO_POS' ? 'EMS → POS' :
					entry.direction === 'POS_TO_EMS' ? 'POS → EMS' :
						'Bidirectional';
				const time = new Date(entry.timestamp).toLocaleString();
				const status = entry.error ? '❌' : '✅';
				return `<div style="padding: 5px; border-bottom: 1px solid var(--border-color);">
					${status} <strong>${direction}</strong> - ${time}
					${entry.synced ? ` (${entry.created || 0} created, ${entry.updated || 0} updated)` : ''}
					${entry.error ? `<br><small style="color: var(--danger);">${entry.error}</small>` : ''}
				</div>`;
			}).join('');
		}
	} else {
		// Fallback: read from localStorage
		const syncLog = JSON.parse(localStorage.getItem('pos_sync_log') || '[]');
		if (syncLog.length === 0) {
			container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No sync history</p>';
		} else {
			const recentLogs = syncLog.slice(-20).reverse();
			container.innerHTML = recentLogs.map(entry => {
				const direction = entry.direction === 'EMS_TO_POS' ? 'EMS → POS' :
					entry.direction === 'POS_TO_EMS' ? 'POS → EMS' :
						'Bidirectional';
				const time = new Date(entry.timestamp).toLocaleString();
				const status = entry.error ? '❌' : '✅';
				return `<div style="padding: 5px; border-bottom: 1px solid var(--border-color);">
					${status} <strong>${direction}</strong> - ${time}
					${entry.synced ? ` (${entry.created || 0} created, ${entry.updated || 0} updated)` : ''}
					${entry.error ? `<br><small style="color: var(--danger);">${entry.error}</small>` : ''}
				</div>`;
			}).join('');
		}
	}
}

// Setup MS Access events
function setupMSAccessEvents() {
	const exportToAccessBtn = document.getElementById('exportToAccessBtn');
	const importFromAccessBtn = document.getElementById('importFromAccessBtn');
	const msAccessAutoBackup = document.getElementById('msAccessAutoBackup');

	if (exportToAccessBtn) {
		exportToAccessBtn.addEventListener('click', async () => {
			try {
				if (typeof exportAllToAccess === 'function') {
					const result = await exportAllToAccess();
					if (result.success) {
						alert('Data exported to MS Access format successfully!');
					} else {
						alert('Export failed: ' + result.error);
					}
				} else {
					// Fallback: export as JSON
					alert('MS Access export function not available. Please use backup feature.');
				}
			} catch (error) {
				alert('Export failed: ' + error.message);
			}
		});
	}

	if (importFromAccessBtn) {
		importFromAccessBtn.addEventListener('click', async () => {
			const fileInput = document.getElementById('importAccessFile');
			if (!fileInput.files.length) {
				alert('Please select a file first!');
				return;
			}

			const file = fileInput.files[0];
			try {
				if (typeof importFromMSAccess === 'function') {
					const result = await importFromMSAccess(file);
					if (result.success) {
						alert('Data imported from MS Access successfully!');
					} else {
						alert('Import failed: ' + result.error);
					}
				} else {
					// Fallback: treat as JSON
					alert('MS Access import function not available. Please use restore feature.');
				}
				fileInput.value = '';
			} catch (error) {
				alert('Import failed: ' + error.message);
			}
		});
	}

	if (msAccessAutoBackup) {
		msAccessAutoBackup.addEventListener('change', (e) => {
			if (typeof setAutoBackup === 'function') {
				setAutoBackup(e.target.checked);
			} else {
				localStorage.setItem('msaccess_auto_backup', e.target.checked ? 'true' : 'false');
			}
		});
		msAccessAutoBackup.checked = localStorage.getItem('msaccess_auto_backup') === 'true';
	}
}

function setupAdvancedSystemSettings() {
	// Turso config
	const tursoUrl = document.getElementById('tursoUrl');
	const tursoToken = document.getElementById('tursoToken');
	const saveTursoBtn = document.getElementById('saveTursoBtn');
	if (tursoUrl) tursoUrl.value = localStorage.getItem('turso_url') || '';
	if (tursoToken) tursoToken.value = localStorage.getItem('turso_token') || '';

	if (saveTursoBtn) {
		saveTursoBtn.addEventListener('click', async () => {
			const url = (tursoUrl?.value || '').trim();
			const token = (tursoToken?.value || '').trim();
			if (!url || !token) {
				alert('Please enter Turso URL and token');
				return;
			}
			localStorage.setItem('turso_url', url);
			localStorage.setItem('turso_token', token);
			localStorage.setItem('turso_enabled', 'true');
			if (window.TursoSyncService?.saveConfig) {
				window.TursoSyncService.saveConfig(url, token, true);
				const result = await window.TursoSyncService.connect();
				if (!result.success) {
					alert('Turso connect failed: ' + result.error);
					return;
				}
				await window.TursoSyncService.sync();
			}
			localStorage.setItem('print_provider', 'turso');
			localStorage.setItem('server_mode_enabled', 'true');
			localStorage.setItem('pos_is_print_server', 'true');
			appendSystemLog('Turso config saved and sync triggered');
			alert('Turso config saved.');
		});
	}

	// Print provider toggle (Turso/Supabase)
	const printProvider = document.getElementById('printProvider');
	if (printProvider) {
		printProvider.value = localStorage.getItem('print_provider') || 'turso';
		printProvider.addEventListener('change', () => {
			localStorage.setItem('print_provider', printProvider.value);
			appendSystemLog('Print provider set to ' + printProvider.value);
		});
	}

	// Server mode toggle
	const serverModeEnabled = document.getElementById('serverModeEnabled');
	if (serverModeEnabled) {
		serverModeEnabled.value = localStorage.getItem('server_mode_enabled') || 'false';
		serverModeEnabled.addEventListener('change', () => {
			localStorage.setItem('server_mode_enabled', serverModeEnabled.value);
			appendSystemLog('Server mode: ' + serverModeEnabled.value);
		});
	}
}

function appendSystemLog(line) {
	const box = document.getElementById('systemLogsBox');
	if (!box) return;
	const now = new Date().toISOString();
	const current = box.textContent && box.textContent !== 'No logs yet.' ? box.textContent + '\n' : '';
	box.textContent = `${current}[${now}] ${line}`;
}

// ===== SUPABASE CLOUD SYNC FUNCTIONS =====

// Connect to Supabase
async function connectToSupabase() {
	const urlInput = document.getElementById('supabaseUrl');
	const keyInput = document.getElementById('supabaseKey');
	const connectBtn = document.getElementById('connectSupabaseBtn');

	const url = urlInput.value.trim();
	const key = keyInput.value.trim();
	const serviceKey = document.getElementById('supabaseServiceKey').value.trim();

	if (!url || !key) {
		alert('Please enter both Supabase URL and Anon Key');
		return;
	}

	// Validate URL format
	if (!url.includes('supabase.co')) {
		alert('Invalid Supabase URL. Should be like: https://xyz.supabase.co');
		return;
	}

	connectBtn.disabled = true;
	connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';

	try {
		const result = await window.SupabaseSyncService.init(url, key, serviceKey);

		if (result.success) {
			localStorage.setItem('print_provider', 'supabase');
			localStorage.setItem('server_mode_enabled', 'true');
			localStorage.setItem('pos_is_print_server', 'true');
			alert('✅ Connected to Supabase successfully!\n\nYour data will now sync automatically every 30 seconds.');
			loadSupabaseCredentials();
		} else {
			alert('❌ Connection failed:\n\n' + result.error + '\n\nPlease check your credentials and try again.');
		}
	} catch (error) {
		alert('❌ Connection error:\n\n' + error.message);
	} finally {
		connectBtn.disabled = false;
		connectBtn.innerHTML = '<i class="fas fa-plug"></i> Save & Connect';
	}
}

// Disconnect from Supabase
function disconnectFromSupabase() {
	if (!confirm('Disconnect from Supabase?\n\nAuto-sync will stop, but your local data will remain safe.')) {
		return;
	}

	window.SupabaseSyncService.disconnect();
	document.getElementById('supabaseUrl').value = '';
	document.getElementById('supabaseKey').value = '';
	document.getElementById('supabaseServiceKey').value = '';
	alert('📵 Disconnected from Supabase.\n\nYou can reconnect anytime.');
}

// Manual cloud sync
async function manualCloudSync() {
	const syncBtn = document.getElementById('manualSyncBtn');

	if (!window.SupabaseSyncService.isConnected) {
		alert('⚠️ Not connected to Supabase.\n\nPlease connect first.');
		return;
	}

	syncBtn.disabled = true;
	syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';

	try {
		const result = await window.SupabaseSyncService.sync();

		if (result.success) {
			const summary = Object.values(result.results)
				.map(r => `${r.table}: ⬆️${r.pushed} ⬇️${r.pulled}`)
				.join('\n');

			alert('✅ Sync completed!\n\n' + summary);
		} else {
			alert('❌ Sync failed:\n\n' + result.error);
		}
	} catch (error) {
		alert('❌ Sync error:\n\n' + error.message);
	} finally {
		syncBtn.disabled = false;
		syncBtn.innerHTML = '<i class="fas fa-sync"></i> Sync Now';
	}
}

// Load saved Supabase credentials
function loadSupabaseCredentials() {
	const credentials = window.SupabaseSyncService.loadCredentials();

	if (credentials.url) {
		document.getElementById('supabaseUrl').value = credentials.url;
	}

	if (credentials.key) {
		document.getElementById('supabaseKey').value = credentials.key;
	}

	if (credentials.serviceKey) {
		document.getElementById('supabaseServiceKey').value = credentials.serviceKey;
	}
}

// Initialize Supabase UI on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSupabaseCredentials();

    // Update sync status every 5 seconds
    setInterval(() => {
        if (window.SupabaseSyncService && window.SupabaseSyncService.isConnected) {
            const stats = window.SupabaseSyncService.getSyncStats();
            const statusDiv = document.getElementById('cloud-sync-status');
            if (statusDiv) {
                statusDiv.className = `sync-status sync-${stats.status}`;
            }
        }
    }, 5000);
});

// Scroll to section
function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
        window.scrollTo({
            top: el.offsetTop - 80,
            behavior: 'smooth'
        });
    }
}

// Logo Handling
document.getElementById('setStoreLogo')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 500000) { // 500KB limit
        alert('Logo file is too large! Please use a smaller image (max 500KB).');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const base64 = event.target.result;
        localStorage.setItem('pos_logo', base64);
        updatePreview();
    };
    reader.readAsDataURL(file);
});

function removeLogo() {
    if (confirm('Are you sure you want to remove the store logo?')) {
        localStorage.removeItem('pos_logo');
        const fileInput = document.getElementById('setStoreLogo');
        if (fileInput) fileInput.value = '';
        updatePreview();
    }
}

// Overwrite updatePreview in settings.js
function updatePreview() {
	const s = getSettings();
    const logo = localStorage.getItem('pos_logo');
    
    const prevLogo = document.getElementById('prevLogo');
    if (prevLogo) {
        if (logo) {
            prevLogo.src = logo;
            prevLogo.style.display = 'block';
        } else {
            prevLogo.style.display = 'none';
        }
    }

	document.getElementById('prevStoreName').textContent = s.storeName || 'AMI STORE';

	const detailsEl = document.getElementById('prevStoreDetails');
	if (detailsEl) {
		let details = [];
		if (s.storeAddress) details.push(s.storeAddress);
		if (s.storeContact) details.push(s.storeContact);
        if (s.storeWebsite) details.push(s.storeWebsite);
		if (s.receiptHeader) details.push(s.receiptHeader);
		detailsEl.innerHTML = details.join('<br>') || 'Address Line 1<br>Contact Info';
	}

    const thanksEl = document.getElementById('prevThanks');
    if (thanksEl) {
        // Convert \n to <br> for multiline support
        thanksEl.innerHTML = (s.thanksMessage || 'Thank you for shopping with us!').replace(/\n/g, '<br>');
        thanksEl.style.textAlign = 'center';
    }
	
	document.getElementById('prevDate').textContent = formatDateTime(new Date());

	// Monetary preview
	const unit = formatCurrency(100);
	const total = formatCurrency(100);
	const zero = formatCurrency(0);
	const payment = `CASH: ${total}`;
	document.getElementById('prevUnit').textContent = unit;
	document.getElementById('prevLineTotal').textContent = total;
	document.getElementById('prevSubtotal').textContent = total;
	document.getElementById('prevDiscount').textContent = zero;
	document.getElementById('prevTotal').textContent = total;
	document.getElementById('prevPayment').textContent = payment;
	document.getElementById('prevBalance').textContent = zero;
}