// POS-EMS Bidirectional Sync Manager
// Syncs employee data between POS and EMS systems

const SYNC_LOG_KEY = 'pos_sync_log';
const LAST_SYNC_KEY = 'pos_last_sync';

// Sync employees from POS to EMS
async function syncEmployeesToEMS() {
    // Priority: Supabase Cloud Sync
    if (window.SupabaseSyncService && window.SupabaseSyncService.isConnected) {
        console.log('☁️ Syncing employees to Supabase...');
        return await window.SupabaseSyncService.syncTable('employees');
    }

    // Fallback: Local Mock EMS
    try {
        const posEmployees = JSON.parse(localStorage.getItem('employees') || '[]');
        const emsEmployees = JSON.parse(localStorage.getItem('ems_employees') || '[]');

        let synced = 0;
        let created = 0;
        let updated = 0;

        posEmployees.forEach(posEmp => {
            // Find matching employee in EMS by code
            const emsIndex = emsEmployees.findIndex(emsEmp =>
                emsEmp.code === posEmp.salesCode ||
                emsEmp.salesCode === posEmp.salesCode ||
                (emsEmp.name === posEmp.name && emsEmp.contact === posEmp.contact)
            );

            if (emsIndex >= 0) {
                // Update existing employee
                emsEmployees[emsIndex] = {
                    ...emsEmployees[emsIndex],
                    name: posEmp.name,
                    contact: posEmp.contact,
                    phone: posEmp.contact,
                    role: posEmp.role || emsEmployees[emsIndex].role,
                    salary: posEmp.salary || emsEmployees[emsIndex].salary,
                    lastSynced: new Date().toISOString(),
                    syncedFrom: 'POS'
                };
                updated++;
            } else {
                // Create new employee in EMS
                emsEmployees.push({
                    id: 'EMP' + Date.now(),
                    code: posEmp.salesCode,
                    name: posEmp.name,
                    role: posEmp.role || 'Employee',
                    contact: posEmp.contact || '',
                    phone: posEmp.contact || '',
                    salary: posEmp.salary || 0,
                    department: '',
                    email: '',
                    joinDate: getCurrentDate(),
                    status: 'active',
                    lastSynced: new Date().toISOString(),
                    syncedFrom: 'POS'
                });
                created++;
            }
            synced++;
        });

        localStorage.setItem('ems_employees', JSON.stringify(emsEmployees));

        logSync('POS_TO_EMS', {
            synced: synced,
            created: created,
            updated: updated,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            synced: synced,
            created: created,
            updated: updated
        };
    } catch (error) {
        console.error('Error syncing to EMS:', error);
        logSync('POS_TO_EMS', {
            error: error.message,
            timestamp: new Date().toISOString()
        });
        return {
            success: false,
            error: error.message
        };
    }
}

// Sync employees from EMS to POS
async function syncEmployeesFromEMS() {
    // Priority: Supabase Cloud Sync
    if (window.SupabaseSyncService && window.SupabaseSyncService.isConnected) {
        console.log('☁️ Syncing employees from Supabase...');
        return await window.SupabaseSyncService.syncTable('employees');
    }

    // Fallback: Local Mock EMS
    try {
        const emsEmployees = JSON.parse(localStorage.getItem('ems_employees') || '[]');
        const posEmployees = JSON.parse(localStorage.getItem('employees') || '[]');

        let synced = 0;
        let created = 0;
        let updated = 0;

        emsEmployees.forEach(emsEmp => {
            // Find matching employee in POS by code
            const posIndex = posEmployees.findIndex(posEmp =>
                posEmp.salesCode === emsEmp.code ||
                posEmp.salesCode === emsEmp.salesCode ||
                posEmp.name === emsEmp.name
            );

            if (posIndex >= 0) {
                // Update existing employee
                posEmployees[posIndex] = {
                    salesCode: emsEmp.code || emsEmp.salesCode,
                    name: emsEmp.name,
                    role: emsEmp.role || 'Employee',
                    contact: emsEmp.contact || emsEmp.phone || '',
                    salary: emsEmp.salary || 0,
                    lastSynced: new Date().toISOString(),
                    syncedFrom: 'EMS'
                };
                updated++;
            } else {
                // Create new employee in POS
                posEmployees.push({
                    salesCode: emsEmp.code || emsEmp.salesCode,
                    name: emsEmp.name,
                    role: emsEmp.role || 'Employee',
                    contact: emsEmp.contact || emsEmp.phone || '',
                    salary: emsEmp.salary || 0,
                    lastSynced: new Date().toISOString(),
                    syncedFrom: 'EMS'
                });
                created++;
            }
            synced++;
        });

        localStorage.setItem('employees', JSON.stringify(posEmployees));

        logSync('EMS_TO_POS', {
            synced: synced,
            created: created,
            updated: updated,
            timestamp: new Date().toISOString()
        });

        return {
            success: true,
            synced: synced,
            created: created,
            updated: updated
        };
    } catch (error) {
        console.error('Error syncing from EMS:', error);
        logSync('EMS_TO_POS', {
            error: error.message,
            timestamp: new Date().toISOString()
        });
        return {
            success: false,
            error: error.message
        };
    }
}

// Bidirectional sync
async function syncEmployeesBidirectional() {
    const result1 = await syncEmployeesToEMS();
    const result2 = await syncEmployeesFromEMS();

    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

    return {
        toEMS: result1,
        fromEMS: result2,
        timestamp: new Date().toISOString()
    };
}

// Auto-sync on employee save
function autoSyncOnEmployeeSave(employee, source = 'POS') {
    if (source === 'POS') {
        syncEmployeesToEMS();
    } else {
        syncEmployeesFromEMS();
    }
}

// Get sync status
function getSyncStatus() {
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    const syncLog = JSON.parse(localStorage.getItem(SYNC_LOG_KEY) || '[]');
    const lastLog = syncLog[syncLog.length - 1];

    return {
        lastSync: lastSync,
        lastLog: lastLog,
        totalSyncs: syncLog.length
    };
}

// Get sync log
function getSyncLog(limit = 50) {
    const syncLog = JSON.parse(localStorage.getItem(SYNC_LOG_KEY) || '[]');
    return syncLog.slice(-limit).reverse();
}

// Log sync operation
function logSync(direction, data) {
    const syncLog = JSON.parse(localStorage.getItem(SYNC_LOG_KEY) || '[]');
    syncLog.push({
        direction: direction,
        ...data
    });

    // Keep only last 100 logs
    if (syncLog.length > 100) {
        syncLog.shift();
    }

    localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(syncLog));
}

// Clear sync log
function clearSyncLog() {
    localStorage.removeItem(SYNC_LOG_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
}

// Get current date helper
function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

