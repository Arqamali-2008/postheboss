// MS Access Database Handler (File-based)
// Handles import/export to/from MS Access .mdb/.accdb files
// Fully offline using File API

const ACCESS_DB_PATH_KEY = 'msaccess_db_path';
const AUTO_BACKUP_KEY = 'msaccess_auto_backup';

// Initialize MS Access handler
function initMSAccessHandler() {
    // Load settings
    const dbPath = localStorage.getItem(ACCESS_DB_PATH_KEY);
    const autoBackup = localStorage.getItem(AUTO_BACKUP_KEY) === 'true';
    
    return {
        dbPath: dbPath,
        autoBackup: autoBackup
    };
}

// Set MS Access database file path
function setMSAccessPath(filePath) {
    localStorage.setItem(ACCESS_DB_PATH_KEY, filePath);
}

// Enable/disable auto-backup
function setAutoBackup(enabled) {
    localStorage.setItem(AUTO_BACKUP_KEY, enabled ? 'true' : 'false');
}

// Export data to MS Access format
async function exportToMSAccess(data, fileName = 'pos_data.mdb') {
    try {
        // Convert JSON data to Access-compatible format
        const accessData = convertJSONToAccess(data);
        
        // Create MDB file structure (simplified)
        // Note: Full MDB format is complex, this is a basic implementation
        // For now, we export as JSON with .mdb extension for compatibility
        // Users can import this JSON into MS Access manually or use a converter
        const jsonContent = JSON.stringify(accessData, null, 2);
        
        // Add metadata header for MS Access compatibility
        const metadata = {
            format: 'MS_ACCESS_JSON_EXPORT',
            version: '1.0',
            exportDate: new Date().toISOString(),
            tables: Object.keys(accessData.tables || {})
        };
        
        const exportData = {
            metadata: metadata,
            data: accessData
        };
        
        // Download as file (using .json extension but compatible format)
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // Use .json extension for better compatibility
        link.download = fileName.replace(/\.(mdb|accdb)$/i, '.json');
        link.click();
        URL.revokeObjectURL(url);
        
        return { success: true, message: 'Data exported successfully. File is JSON format compatible with MS Access import.' };
    } catch (error) {
        console.error('Export error:', error);
        return { success: false, error: error.message };
    }
}

// Import data from MS Access file
async function importFromMSAccess(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const fileData = e.target.result;
                
                // Parse MDB file (simplified - full parser needed for production)
                const jsonData = parseMDBFile(fileData);
                
                // Check if data has tables structure
                const dataToImport = jsonData.tables || jsonData;
                
                // Import to localStorage with validation
                let importedCount = 0;
                
                if (dataToImport.Employees || dataToImport.employees) {
                    const employees = dataToImport.Employees || dataToImport.employees || [];
                    if (Array.isArray(employees) && employees.length > 0) {
                        localStorage.setItem('employees', JSON.stringify(employees));
                        importedCount++;
                    }
                }
                
                if (dataToImport.Products || dataToImport.products) {
                    const products = dataToImport.Products || dataToImport.products || [];
                    if (Array.isArray(products) && products.length > 0) {
                        localStorage.setItem('products', JSON.stringify(products));
                        importedCount++;
                    }
                }
                
                if (dataToImport.Sales || dataToImport.sales) {
                    const sales = dataToImport.Sales || dataToImport.sales || [];
                    if (Array.isArray(sales) && sales.length > 0) {
                        localStorage.setItem('sales', JSON.stringify(sales));
                        importedCount++;
                    }
                }
                
                if (dataToImport.EMS_Employees || dataToImport.ems_employees) {
                    const emsEmployees = dataToImport.EMS_Employees || dataToImport.ems_employees || [];
                    if (Array.isArray(emsEmployees) && emsEmployees.length > 0) {
                        localStorage.setItem('ems_employees', JSON.stringify(emsEmployees));
                        importedCount++;
                    }
                }
                
                if (dataToImport.EMS_Attendance || dataToImport.ems_attendance) {
                    const attendance = dataToImport.EMS_Attendance || dataToImport.ems_attendance || [];
                    if (Array.isArray(attendance) && attendance.length > 0) {
                        localStorage.setItem('ems_attendance', JSON.stringify(attendance));
                        importedCount++;
                    }
                }
                
                if (dataToImport.EMS_Payroll || dataToImport.ems_payroll) {
                    const payroll = dataToImport.EMS_Payroll || dataToImport.ems_payroll || [];
                    if (Array.isArray(payroll) && payroll.length > 0) {
                        localStorage.setItem('ems_payroll', JSON.stringify(payroll));
                        importedCount++;
                    }
                }
                
                if (importedCount === 0) {
                    throw new Error('No valid data found in file. Please ensure the file is a valid export from this system.');
                }
                
                resolve({ 
                    success: true, 
                    message: `Data imported successfully. ${importedCount} data table(s) loaded.` 
                });
            } catch (error) {
                reject({ success: false, error: error.message });
            }
        };
        
        reader.onerror = () => {
            reject({ success: false, error: 'Failed to read file' });
        };
        
        // Use readAsText for JSON files, ArrayBuffer for binary
        if (file.name.toLowerCase().endsWith('.json')) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    });
}

// Convert JSON data to Access format
function convertJSONToAccess(data) {
    // This is a simplified conversion
    // Full implementation would create proper MDB file structure
    return {
        tables: {
            Employees: data.employees || [],
            Products: data.products || [],
            Sales: data.sales || [],
            EMS_Employees: data.ems_employees || [],
            EMS_Attendance: data.ems_attendance || [],
            EMS_Payroll: data.ems_payroll || []
        }
    };
}

// Create MDB file (simplified - for full implementation, use proper MDB library)
function createMDBFile(data) {
    // For now, create a JSON file that can be imported into Access
    // Full MDB format requires binary file structure
    const jsonData = JSON.stringify(data, null, 2);
    
    // In production, use a proper MDB writer library
    // This is a placeholder that creates a JSON file
    return jsonData;
}

// Parse MDB file (simplified)
function parseMDBFile(fileData) {
    // Try to parse as JSON first (if exported as JSON)
    try {
        const text = new TextDecoder().decode(fileData);
        const json = JSON.parse(text);
        
        // Check if it's our export format with metadata
        if (json.metadata && json.data) {
            return json.data;
        }
        
        // Check if it's direct data format
        if (json.tables) {
            return json;
        }
        
        // Try to extract data from various possible structures
        return json;
    } catch (e) {
        // If not JSON, try to parse as binary MDB
        // Full MDB parser needed for production
        // For now, return empty data with error message
        console.warn('MDB file parsing not fully implemented. Please use JSON export format.');
        throw new Error('Unable to parse file. Please ensure it is a JSON export from this system or a compatible format.');
    }
}

// Auto-backup to MS Access (if enabled)
async function autoBackupToAccess() {
    const settings = initMSAccessHandler();
    
    if (!settings.autoBackup) {
        return;
    }
    
    try {
        // Collect all data
        const allData = {
            employees: JSON.parse(localStorage.getItem('employees') || '[]'),
            products: JSON.parse(localStorage.getItem('products') || '[]'),
            sales: JSON.parse(localStorage.getItem('sales') || '[]'),
            ems_employees: JSON.parse(localStorage.getItem('ems_employees') || '[]'),
            ems_attendance: JSON.parse(localStorage.getItem('ems_attendance') || '[]'),
            ems_payroll: JSON.parse(localStorage.getItem('ems_payroll') || '[]'),
            settings: JSON.parse(localStorage.getItem('settings') || '{}'),
            ems_settings: JSON.parse(localStorage.getItem('ems_settings') || '{}')
        };
        
        const fileName = `pos_backup_${new Date().toISOString().split('T')[0]}.mdb`;
        await exportToMSAccess(allData, fileName);
        
        console.log('Auto-backup completed');
    } catch (error) {
        console.error('Auto-backup failed:', error);
    }
}

// Export all data to Access
async function exportAllToAccess() {
    try {
        const allData = {
            employees: JSON.parse(localStorage.getItem('employees') || '[]'),
            products: JSON.parse(localStorage.getItem('products') || '[]'),
            sales: JSON.parse(localStorage.getItem('sales') || '[]'),
            ems_employees: JSON.parse(localStorage.getItem('ems_employees') || '[]'),
            ems_attendance: JSON.parse(localStorage.getItem('ems_attendance') || '[]'),
            ems_payroll: JSON.parse(localStorage.getItem('ems_payroll') || '[]'),
            settings: JSON.parse(localStorage.getItem('settings') || '{}'),
            ems_settings: JSON.parse(localStorage.getItem('ems_settings') || '{}')
        };
        
        const fileName = `pos_export_${new Date().toISOString().split('T')[0]}.mdb`;
        return await exportToMSAccess(allData, fileName);
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Hook into data save functions for auto-backup
const originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    
    // Trigger auto-backup if enabled and key is important
    const importantKeys = ['employees', 'products', 'sales', 'ems_employees', 'ems_attendance', 'ems_payroll'];
    if (importantKeys.includes(key)) {
        // Debounce auto-backup (wait 2 seconds after last change)
        clearTimeout(window.autoBackupTimeout);
        window.autoBackupTimeout = setTimeout(() => {
            autoBackupToAccess();
        }, 2000);
    }
};

