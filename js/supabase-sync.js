// Supabase Cloud Sync Service
// Handles bidirectional sync between local storage and Supabase cloud database

class SupabaseSyncService {
    constructor() {
        this.supabase = null;
        this.isConnected = false;
        this.syncInterval = null;
        this.SYNC_INTERVAL_MS = 30000; // 30 seconds
        this.syncStatus = 'disconnected';
        this.lastSyncTime = null;
    }

    // Initialize Supabase client
    async init(supabaseUrl, supabaseKey, serviceKey = null) {
        try {
            if (!supabaseUrl || !supabaseKey) {
                throw new Error('Supabase URL and Key are required');
            }

            // Import Supabase client from CDN
            if (!window.supabase) {
                await this.loadSupabaseClient();
            }

            this.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

            // Check if tables exist
            const { data, error } = await this.supabase.from('products').select('count').limit(1);

            // If table doesn't exist, show setup modal
            if (error && (error.code === '42P01' || error.message.includes('does not exist'))) {
                console.log('⚠️ Tables not found - showing setup modal');

                // Show setup modal if SupabaseTableCreator is available
                if (window.SupabaseTableCreator) {
                    window.SupabaseTableCreator.showSetupModal(supabaseUrl, serviceKey);
                }

                return {
                    success: false,
                    needsSetup: true,
                    error: 'Database tables not found. Please run setup.'
                };
            }

            // PGRST116 = empty table (OK)
            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            this.isConnected = true;
            this.syncStatus = 'connected';
            this.updateSyncStatusUI('connected');

            // Save credentials
            this.saveCredentials(supabaseUrl, supabaseKey, serviceKey);

            // Start auto-sync
            this.startAutoSync();

            console.log('✅ Supabase connected successfully');
            return { success: true, message: 'Connected to Supabase' };
        } catch (error) {
            console.error('❌ Supabase connection failed:', error);
            this.isConnected = false;
            this.syncStatus = 'error';
            this.updateSyncStatusUI('error');
            return { success: false, error: error.message };
        }
    }

    // Load Supabase client from CDN
    async loadSupabaseClient() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Save credentials to localStorage
    saveCredentials(url, key, serviceKey = null) {
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_key', key);
        if (serviceKey) {
            localStorage.setItem('supabase_service_key', serviceKey);
        } else {
            localStorage.removeItem('supabase_service_key');
        }
        localStorage.setItem('supabase_enabled', 'true');
    }

    // Load saved credentials
    loadCredentials() {
        return {
            url: localStorage.getItem('supabase_url'),
            key: localStorage.getItem('supabase_key'),
            serviceKey: localStorage.getItem('supabase_service_key'),
            enabled: localStorage.getItem('supabase_enabled') === 'true'
        };
    }

    // Start automatic sync
    startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(() => {
            if (this.isConnected && navigator.onLine) {
                this.sync();
            }
        }, this.SYNC_INTERVAL_MS);

        console.log(`🔄 Auto-sync started (every ${this.SYNC_INTERVAL_MS / 1000}s)`);
    }

    // Stop automatic sync
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('⏸️ Auto-sync stopped');
        }
    }

    // Main sync function (bidirectional)
    async sync() {
        if (!this.isConnected) {
            console.warn('⚠️ Not connected to Supabase');
            return { success: false, error: 'Not connected' };
        }

        try {
            this.updateSyncStatusUI('syncing');
            console.log('🔄 Starting sync...');

            const results = {
                products: await this.syncTable('products'),
                employees: await this.syncTable('employees'),
                sales: await this.syncTable('sales'),
                customers: await this.syncTable('customers'),
                settings: await this.syncTable('settings')
            };

            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('last_cloud_sync', this.lastSyncTime);

            this.updateSyncStatusUI('synced');
            console.log('✅ Sync completed', results);

            return { success: true, results, timestamp: this.lastSyncTime };
        } catch (error) {
            console.error('❌ Sync failed:', error);
            this.updateSyncStatusUI('error');
            return { success: false, error: error.message };
        }
    }

    // Sync individual table
    async syncTable(tableName) {
        try {
            // 1. Push local changes to cloud (Upload)
            const pushResult = await this.pushToCloud(tableName);

            // 2. Pull cloud changes to local (Download)
            const pullResult = await this.pullFromCloud(tableName);

            return {
                table: tableName,
                pushed: pushResult.count,
                pulled: pullResult.count,
                success: true
            };
        } catch (error) {
            console.error(`❌ Error syncing ${tableName}:`, error);
            return {
                table: tableName,
                success: false,
                error: error.message
            };
        }
    }

    // Push local data to cloud
    async pushToCloud(tableName) {
        const localKey = this.getLocalStorageKey(tableName);
        let localData = JSON.parse(localStorage.getItem(localKey) || (tableName === 'settings' ? '{}' : '[]'));

        if (tableName === 'settings') {
            // Settings is a special case (object, not array)
            const settingsRow = this.prepareForCloud(localData, 'settings');
            settingsRow.id = 'global_settings';
            const { error } = await this.supabase
                .from('settings')
                .upsert([settingsRow], { onConflict: 'id' });
            if (error) throw error;
            return { count: 1 };
        }

        // Filter unsynced items
        const unsyncedItems = localData.filter(item => !item.synced || item.updated_at > item.synced_at);

        if (unsyncedItems.length === 0) {
            return { count: 0 };
        }

        // Prepare data for Supabase
        const dataToSync = unsyncedItems.map(item => this.prepareForCloud(item, tableName));

        // Upsert to Supabase (insert or update)
        const { data, error } = await this.supabase
            .from(tableName)
            .upsert(dataToSync, { onConflict: 'id' });

        if (error) throw error;

        // Mark as synced in local storage
        unsyncedItems.forEach(item => {
            item.synced = true;
            item.synced_at = new Date().toISOString();
        });
        localStorage.setItem(localKey, JSON.stringify(localData));

        console.log(`⬆️ Pushed ${unsyncedItems.length} items to ${tableName}`);
        return { count: unsyncedItems.length };
    }

    // Pull cloud data to local
    async pullFromCloud(tableName) {
        const localKey = this.getLocalStorageKey(tableName);
        
        if (tableName === 'settings') {
            const { data, error } = await this.supabase
                .from('settings')
                .select('*')
                .eq('id', 'global_settings')
                .maybeSingle();
            
            if (error) throw error;
            if (data) {
                const cloudSettings = this.prepareForLocal(data, 'settings');
                const localSettings = JSON.parse(localStorage.getItem(localKey) || '{}');
                
                // Merge if cloud is newer
                if (new Date(data.updated_at) > new Date(localSettings.updated_at || 0)) {
                    localStorage.setItem(localKey, JSON.stringify(cloudSettings));
                    console.log(`⬇️ Pulled global settings from cloud`);
                    return { count: 1 };
                }
            }
            return { count: 0 };
        }

        const localData = JSON.parse(localStorage.getItem(localKey) || '[]');

        // Get last sync time for this table
        const lastSync = localStorage.getItem(`last_sync_${tableName}`) || '1970-01-01T00:00:00Z';

        // Fetch updated items from cloud
        const { data: cloudData, error } = await this.supabase
            .from(tableName)
            .select('*')
            .gte('updated_at', lastSync)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        if (!cloudData || cloudData.length === 0) {
            return { count: 0 };
        }

        // Merge cloud data with local (Last-Write-Wins)
        cloudData.forEach(cloudItem => {
            const localIndex = localData.findIndex(item => item.id === cloudItem.id);

            if (localIndex >= 0) {
                // Update existing item (if cloud is newer)
                const localItem = localData[localIndex];
                if (new Date(cloudItem.updated_at) > new Date(localItem.updated_at || 0)) {
                    localData[localIndex] = this.prepareForLocal(cloudItem, tableName);
                }
            } else {
                // Add new item
                localData.push(this.prepareForLocal(cloudItem, tableName));
            }
        });

        // Save updated local data
        localStorage.setItem(localKey, JSON.stringify(localData));
        localStorage.setItem(`last_sync_${tableName}`, new Date().toISOString());

        console.log(`⬇️ Pulled ${cloudData.length} items from ${tableName}`);
        return { count: cloudData.length };
    }

    // Get localStorage key for table
    getLocalStorageKey(tableName) {
        const keyMap = {
            'products': 'products',
            'employees': 'employees',
            'sales': 'sales',
            'customers': 'customers',
            'settings': 'pos_settings'
        };
        return keyMap[tableName] || tableName;
    }

    // Prepare data for cloud (transform local format to Supabase format)
    prepareForCloud(item, tableName) {
        const baseData = {
            id: item.id || this.generateUUID(),
            updated_at: item.updated_at || new Date().toISOString(),
            created_at: item.created_at || new Date().toISOString(),
            deleted: item.deleted || false
        };

        switch (tableName) {
            case 'products':
                return {
                    ...baseData,
                    item_code: item.itemCode,
                    name: item.name,
                    cost: parseFloat(item.cost || 0),
                    price: parseFloat(item.price || 0),
                    stock: parseInt(item.stock || 0)
                };
            case 'employees':
                return {
                    ...baseData,
                    sales_code: item.salesCode,
                    name: item.name,
                    role: item.role,
                    contact: item.contact,
                    salary: parseFloat(item.salary || 0)
                };
            case 'sales':
                return {
                    ...baseData,
                    invoice_number: item.invoiceNumber,
                    date: item.date,
                    items: item.items,
                    total: parseFloat(item.total || 0),
                    payment_type: item.paymentType,
                    sales_code: item.salesCode
                };
            case 'customers':
                return {
                    ...baseData,
                    name: item.name,
                    phone: item.phone,
                    email: item.email,
                    address: item.address
                };
            case 'settings':
                return {
                    ...baseData,
                    key: 'global_settings',
                    value: item // The whole settings object
                };
            default:
                return { ...baseData, ...item };
        }
    }

    // Prepare data for local (transform Supabase format to local format)
    prepareForLocal(item, tableName) {
        const baseData = {
            id: item.id,
            updated_at: item.updated_at,
            created_at: item.created_at,
            synced: true,
            synced_at: new Date().toISOString()
        };

        switch (tableName) {
            case 'products':
                return {
                    ...baseData,
                    itemCode: item.item_code,
                    name: item.name,
                    cost: item.cost,
                    price: item.price,
                    stock: item.stock
                };
            case 'employees':
                return {
                    ...baseData,
                    salesCode: item.sales_code,
                    name: item.name,
                    role: item.role,
                    contact: item.contact,
                    salary: item.salary
                };
            case 'sales':
                return {
                    ...baseData,
                    invoiceNumber: item.invoice_number,
                    date: item.date,
                    items: item.items,
                    total: item.total,
                    paymentType: item.payment_type,
                    salesCode: item.sales_code
                };
            case 'customers':
                return {
                    ...baseData,
                    name: item.name,
                    phone: item.phone,
                    email: item.email,
                    address: item.address
                };
            case 'settings':
                return {
                    ...item.value,
                    updated_at: item.updated_at,
                    synced: true,
                    synced_at: new Date().toISOString()
                };
            default:
                return { ...baseData, ...item };
        }
    }

    // Update sync status UI
    updateSyncStatusUI(status) {
        this.syncStatus = status;

        const statusElement = document.getElementById('cloud-sync-status');
        const statusText = document.getElementById('cloud-sync-status-text');
        const lastSyncElement = document.getElementById('last-cloud-sync-time');

        if (statusElement) {
            statusElement.className = `sync-status sync-${status}`;
        }

        if (statusText) {
            const statusMessages = {
                'connected': '☁️ Connected',
                'syncing': '🔄 Syncing...',
                'synced': '✅ Synced',
                'error': '❌ Error',
                'disconnected': '📵 Disconnected'
            };
            statusText.textContent = statusMessages[status] || status;
        }

        if (lastSyncElement && this.lastSyncTime) {
            const timeAgo = this.getTimeAgo(new Date(this.lastSyncTime));
            lastSyncElement.textContent = `Last sync: ${timeAgo}`;
        }
    }

    // Get time ago string
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    // Generate UUID
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Disconnect from Supabase
    disconnect() {
        this.stopAutoSync();
        this.isConnected = false;
        this.syncStatus = 'disconnected';
        this.updateSyncStatusUI('disconnected');
        localStorage.setItem('supabase_enabled', 'false');
        // We don't clear keys so user doesn't have to re-enter if they just want to reconnect
        // But we clear loaded service key if we want stricter security
        // localStorage.removeItem('supabase_service_key'); 
        console.log('📵 Disconnected from Supabase');
    }

    // Get sync statistics
    getSyncStats() {
        return {
            isConnected: this.isConnected,
            status: this.syncStatus,
            lastSync: this.lastSyncTime,
            autoSyncEnabled: this.syncInterval !== null,
            syncInterval: this.SYNC_INTERVAL_MS
        };
    }
}

// Create global instance
window.SupabaseSyncService = new SupabaseSyncService();

// Auto-initialize if credentials exist
document.addEventListener('DOMContentLoaded', () => {
    const credentials = window.SupabaseSyncService.loadCredentials();
    if (credentials.enabled && credentials.url && credentials.key) {
        window.SupabaseSyncService.init(credentials.url, credentials.key);
    }
});

// Handle online/offline events
window.addEventListener('online', () => {
    console.log('🌐 Back online - syncing...');
    if (window.SupabaseSyncService.isConnected) {
        window.SupabaseSyncService.sync();
    }
});

window.addEventListener('offline', () => {
    console.log('📵 Offline - sync paused');
    window.SupabaseSyncService.updateSyncStatusUI('disconnected');
});
