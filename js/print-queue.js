// ================================================================
// 🖨️ POS THE BOSS - Cross-Device Print Queue System
// ================================================================
// Enables any POS device to send print jobs to any other device
// (typically the "server" PC that has a physical printer).
// Uses Supabase Realtime for instant push notifications.
// ================================================================

class PrintQueueService {
    constructor() {
        this.deviceId = this.getDeviceId();
        this.isServer = false;
        this.subscription = null;
        this.pendingJobs = [];
        this.isListening = false;
    }

    // Get or generate a unique device identifier
    getDeviceId() {
        let id = localStorage.getItem('pos_device_id');
        if (!id) {
            id = 'POS-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            localStorage.setItem('pos_device_id', id);
        }
        return id;
    }

    // Get device display name (user-customizable)
    getDeviceName() {
        return localStorage.getItem('pos_device_name') || this.deviceId;
    }

    // Set device display name
    setDeviceName(name) {
        localStorage.setItem('pos_device_name', name);
    }

    // Check if this device is the print server
    getIsServer() {
        return localStorage.getItem('pos_is_print_server') === 'true';
    }

    // Set this device as the print server
    setAsServer(isServer) {
        this.isServer = isServer;
        localStorage.setItem('pos_is_print_server', isServer ? 'true' : 'false');
        if (isServer) {
            this.startListening();
        } else {
            this.stopListening();
        }
    }

    // ============================================================
    // SEND PRINT JOB (from any device to the server)
    // ============================================================
    async sendPrintJob(receiptData, targetDevice = 'server') {
        if (!window.SupabaseSyncService || !window.SupabaseSyncService.isConnected) {
            this.showToast('❌ Not connected to Supabase! Cannot send print job.', 'error');
            return { success: false, error: 'Not connected to Supabase' };
        }

        try {
            const supabase = window.SupabaseSyncService.supabase;

            const printJob = {
                source_device: this.getDeviceName(),
                target_device: targetDevice,
                invoice_number: receiptData.invoiceNumber || 'N/A',
                receipt_data: receiptData,
                status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('print_queue')
                .insert([printJob])
                .select();

            if (error) throw error;

            this.showToast('🖨️ Print job sent to server!', 'success');
            console.log('✅ Print job sent:', data);
            return { success: true, data };
        } catch (error) {
            console.error('❌ Failed to send print job:', error);
            this.showToast('❌ Failed to send print job: ' + error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    // ============================================================
    // BUILD RECEIPT DATA from current bill
    // ============================================================
    buildReceiptData() {
        if (typeof currentBill === 'undefined' || !currentBill) {
            return null;
        }

        const settings = typeof getSettings === 'function' ? getSettings() : {};

        return {
            invoiceNumber: currentBill.invoiceNumber,
            date: new Date().toISOString(),
            salesCode: currentBill.salesCode || 'N/A',
            items: currentBill.items.map(item => ({
                code: item.code,
                name: item.name,
                qty: item.qty,
                price: item.price,
                discount: item.discount || 0,
                total: item.total,
                salesCode: item.salesCode
            })),
            subtotal: currentBill.subtotal,
            discount: currentBill.discount,
            total: currentBill.total,
            paidAmount: currentBill.paidAmount,
            balance: currentBill.balance,
            paymentType: currentBill.paymentType || 'cash',
            customerName: currentBill.customerName || '',
            customerContact: currentBill.customerContact || '',
            storeName: settings.storeName || 'AMi STORE',
            storeAddress: settings.storeAddress || '',
            storeContact: settings.storeContact || '',
            receiptHeader: settings.receiptHeader || '',
            thanksMessage: settings.thanksMessage || 'Thank you for shopping with us!',
            currency: settings.currency || 'LKR',
            sourceDevice: this.getDeviceName()
        };
    }

    // ============================================================
    // START LISTENING (Server mode - listens for incoming jobs)
    // ============================================================
    async startListening() {
        if (this.isListening) return;
        if (!window.SupabaseSyncService || !window.SupabaseSyncService.isConnected) {
            console.warn('⚠️ Cannot start print queue listener - not connected');
            return;
        }

        try {
            const supabase = window.SupabaseSyncService.supabase;

            // Subscribe to new print jobs targeting this device or 'server'
            this.subscription = supabase
                .channel('print-queue-realtime')
                .on('postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'print_queue',
                        filter: `status=eq.pending`
                    },
                    (payload) => {
                        console.log('🖨️ New print job received:', payload);
                        const job = payload.new;
                        // Check if this job is for us
                        if (job.target_device === 'server' || job.target_device === this.getDeviceName()) {
                            this.handleIncomingJob(job);
                        }
                    }
                )
                .subscribe((status) => {
                    console.log('📡 Print queue subscription status:', status);
                    if (status === 'SUBSCRIBED') {
                        this.isListening = true;
                        this.updateServerUI();
                    }
                });

            // Also load any pending jobs
            await this.loadPendingJobs();

            console.log('🖨️ Print queue listener started for device:', this.getDeviceName());
        } catch (error) {
            console.error('❌ Failed to start print queue listener:', error);
        }
    }

    // Stop listening
    stopListening() {
        if (this.subscription) {
            const supabase = window.SupabaseSyncService?.supabase;
            if (supabase) {
                supabase.removeChannel(this.subscription);
            }
            this.subscription = null;
        }
        this.isListening = false;
        this.updateServerUI();
    }

    // ============================================================
    // HANDLE INCOMING PRINT JOB
    // ============================================================
    handleIncomingJob(job) {
        this.pendingJobs.unshift(job);
        this.updatePrintQueueUI();

        // Show notification
        this.showPrintNotification(job);

        // Play notification sound
        this.playNotificationSound();
    }

    // ============================================================
    // LOAD PENDING JOBS from Supabase
    // ============================================================
    async loadPendingJobs() {
        if (!window.SupabaseSyncService?.isConnected) return;

        try {
            const supabase = window.SupabaseSyncService.supabase;
            const { data, error } = await supabase
                .from('print_queue')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            // Filter jobs for this device
            this.pendingJobs = (data || []).filter(
                job => job.target_device === 'server' || job.target_device === this.getDeviceName()
            );

            this.updatePrintQueueUI();
        } catch (error) {
            console.error('❌ Failed to load pending jobs:', error);
        }
    }

    // ============================================================
    // PRINT A QUEUED RECEIPT
    // ============================================================
    async printQueuedReceipt(jobId) {
        const job = this.pendingJobs.find(j => j.id === jobId);
        if (!job) {
            this.showToast('❌ Print job not found', 'error');
            return;
        }

        try {
            // Build and print the receipt HTML
            this.printReceiptFromData(job.receipt_data);

            // Mark as printed in Supabase
            if (window.SupabaseSyncService?.isConnected) {
                const supabase = window.SupabaseSyncService.supabase;
                await supabase
                    .from('print_queue')
                    .update({
                        status: 'printed',
                        printed_at: new Date().toISOString()
                    })
                    .eq('id', jobId);
            }

            // Remove from pending list
            this.pendingJobs = this.pendingJobs.filter(j => j.id !== jobId);
            this.updatePrintQueueUI();

            this.showToast('✅ Receipt printed successfully!', 'success');
        } catch (error) {
            console.error('❌ Print failed:', error);
            this.showToast('❌ Print failed: ' + error.message, 'error');
        }
    }

    // ============================================================
    // PRINT RECEIPT FROM DATA (renders and triggers browser print)
    // ============================================================
    printReceiptFromData(data) {
        // Find or create the print container
        let receiptDiv = document.getElementById('receiptPrint');
        if (!receiptDiv) {
            receiptDiv = document.createElement('div');
            receiptDiv.id = 'receiptPrint';
            receiptDiv.className = 'thermal-receipt print-section';
            receiptDiv.style.display = 'none';
            document.body.appendChild(receiptDiv);
        }

        const fmtCurrency = (amt) => {
            const value = Number.isFinite(+amt) ? (+amt).toFixed(2) : '0.00';
            return `${data.currency || 'LKR'} ${value}`;
        };

        const fmtDate = (dateStr) => {
            const d = new Date(dateStr || Date.now());
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            let h = d.getHours();
            const min = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${dd}-${mm}-${yyyy} ${String(h).padStart(2, '0')}:${min} ${ampm}`;
        };

        // Build items HTML
        let itemsHtml = '';
        let totalSavings = 0;
        (data.items || []).forEach(item => {
            const itemDisc = (item.discount || 0) * (item.qty || 1);
            totalSavings += itemDisc;
            itemsHtml += `
                <div class="receipt-item" style="display: block; margin-bottom: 4px;">
                    <div style="font-weight: 600; text-transform: uppercase;">${item.name}</div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px;">
                        <div>${item.qty} x ${fmtCurrency(item.price)}</div>
                        <div>${fmtCurrency(item.total)}</div>
                    </div>
                </div>
            `;
        });
        totalSavings += (data.discount || 0);

        // Store details
        let storeDetails = [];
        if (data.storeAddress) storeDetails.push(data.storeAddress);
        if (data.storeContact) storeDetails.push(data.storeContact);
        if (data.receiptHeader) storeDetails.push(data.receiptHeader);

        // Savings section
        const savingsHtml = totalSavings > 0
            ? `<div class="text-center" style="margin-top: 10px; font-weight: 700; border: 1px dashed #000; padding: 5px;">
                   <span>YOU ARE SAVING: </span><span>${fmtCurrency(totalSavings)}</span>
               </div>`
            : '';

        // Source device label
        const sourceLabel = data.sourceDevice ? `<div style="text-align:center; font-size:10px; margin-top:4px; border-top: 1px dashed #000; padding-top:4px;">Printed from: ${data.sourceDevice}</div>` : '';

        receiptDiv.innerHTML = `
            <div class="receipt-header">
                <div class="receipt-store-line">${data.storeName || 'AMi STORE'}</div>
                <div class="receipt-subline">${storeDetails.join('<br>')}</div>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-info">
                <div style="display: flex; justify-content: space-between;"><span>Invoice:</span><span>${data.invoiceNumber}</span></div>
                <div style="display: flex; justify-content: space-between;"><span>Date:</span><span>${fmtDate(data.date)}</span></div>
                <div style="display: flex; justify-content: space-between;"><span>Sales Code:</span><span>${data.salesCode}</span></div>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-items">${itemsHtml}</div>
            <div class="receipt-divider"></div>
            <div class="receipt-summary">
                <div class="receipt-summary-row"><span>Subtotal:</span><span>${fmtCurrency(data.subtotal)}</span></div>
                <div class="receipt-summary-row"><span>Discount:</span><span>${fmtCurrency(data.discount)}</span></div>
                <div class="receipt-total"><span>TOTAL:</span><span>${fmtCurrency(data.total)}</span></div>
                <div class="receipt-divider"></div>
                <div class="receipt-summary-row" style="display: flex; justify-content: space-between;">
                    <span>Payment : ${(data.paymentType || 'CASH').toUpperCase()} :</span>
                    <span>${fmtCurrency(data.paidAmount)}</span>
                </div>
                <div class="receipt-summary-row" style="display: flex; justify-content: space-between;">
                    <span>Balance:</span><span>${fmtCurrency(data.balance)}</span>
                </div>
            </div>
            ${savingsHtml}
            ${sourceLabel}
            <div class="receipt-footer">
                <div>${data.thanksMessage || 'Thank you for shopping with us!'}</div>
            </div>
        `;

        // Inject print style
        let style = document.getElementById('receiptPageStyle');
        if (!style) {
            style = document.createElement('style');
            style.id = 'receiptPageStyle';
            style.media = 'print';
            document.head.appendChild(style);
        }
        style.textContent = `
            @page { size: 80mm auto; margin: 0; }
            @media print {
                body * { visibility: hidden; }
                .print-section, .print-section * { visibility: visible; }
                .print-section {
                    position: absolute; left: 0; top: 0;
                    width: 80mm; margin: 0; padding: 5mm;
                    background: #fff !important; color: #000 !important;
                }
            }
        `;

        receiptDiv.style.display = 'block';
        receiptDiv.classList.add('print-section');

        setTimeout(() => {
            window.print();
            setTimeout(() => {
                receiptDiv.style.display = 'none';
                receiptDiv.classList.remove('print-section');
            }, 100);
        }, 150);
    }

    // ============================================================
    // DISMISS a print job without printing
    // ============================================================
    async dismissJob(jobId) {
        try {
            if (window.SupabaseSyncService?.isConnected) {
                const supabase = window.SupabaseSyncService.supabase;
                await supabase
                    .from('print_queue')
                    .update({ status: 'dismissed' })
                    .eq('id', jobId);
            }
            this.pendingJobs = this.pendingJobs.filter(j => j.id !== jobId);
            this.updatePrintQueueUI();
            this.showToast('🗑️ Print job dismissed', 'info');
        } catch (error) {
            console.error('❌ Failed to dismiss job:', error);
        }
    }

    // ============================================================
    // UI UPDATES
    // ============================================================

    // Update print queue panel
    updatePrintQueueUI() {
        const container = document.getElementById('printQueueList');
        const badge = document.getElementById('printQueueBadge');

        if (badge) {
            badge.textContent = this.pendingJobs.length;
            badge.style.display = this.pendingJobs.length > 0 ? 'flex' : 'none';
        }

        if (!container) return;

        if (this.pendingJobs.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding: 30px 15px; color: var(--text-secondary);">
                    <div style="font-size: 2.5em; margin-bottom: 10px; opacity: 0.5;">🖨️</div>
                    <p>No pending print jobs</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        this.pendingJobs.forEach(job => {
            const timeAgo = this.getTimeAgo(new Date(job.created_at));
            const div = document.createElement('div');
            div.className = 'print-queue-item animate-slide-in';
            div.innerHTML = `
                <div class="pq-info">
                    <div class="pq-invoice">📄 ${job.invoice_number}</div>
                    <div class="pq-meta">
                        <span class="pq-device">From: <strong>${job.source_device}</strong></span>
                        <span class="pq-time">${timeAgo}</span>
                    </div>
                </div>
                <div class="pq-actions">
                    <button class="btn btn-success btn-sm pq-btn-print" onclick="window.PrintQueue.printQueuedReceipt('${job.id}')" title="Print this receipt">
                        🖨️ Print
                    </button>
                    <button class="btn btn-secondary btn-sm pq-btn-dismiss" onclick="window.PrintQueue.dismissJob('${job.id}')" title="Dismiss">
                        ✕
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    // Update server toggle UI
    updateServerUI() {
        const toggle = document.getElementById('serverModeToggle');
        const status = document.getElementById('serverModeStatus');

        if (toggle) {
            toggle.checked = this.getIsServer();
        }
        if (status) {
            if (this.getIsServer() && this.isListening) {
                status.innerHTML = '<span class="server-badge listening">🟢 Listening for print jobs...</span>';
            } else if (this.getIsServer()) {
                status.innerHTML = '<span class="server-badge connecting">🟡 Connecting...</span>';
            } else {
                status.innerHTML = '<span class="server-badge off">⚪ Server mode off</span>';
            }
        }
    }

    // Show print notification (floating toast with action)
    showPrintNotification(job) {
        const notif = document.createElement('div');
        notif.className = 'print-notification animate-bounce-in';
        notif.innerHTML = `
            <div class="pn-icon">🖨️</div>
            <div class="pn-content">
                <div class="pn-title">New Print Job!</div>
                <div class="pn-detail">${job.invoice_number} from ${job.source_device}</div>
            </div>
            <div class="pn-actions">
                <button class="btn btn-success btn-sm" onclick="window.PrintQueue.printQueuedReceipt('${job.id}'); this.closest('.print-notification').remove();">Print Now</button>
                <button class="btn btn-secondary btn-sm" onclick="this.closest('.print-notification').remove();">Later</button>
            </div>
        `;
        document.body.appendChild(notif);

        // Auto-remove after 15 seconds
        setTimeout(() => {
            if (notif.parentNode) {
                notif.classList.add('animate-fade-out');
                setTimeout(() => notif.remove(), 500);
            }
        }, 15000);
    }

    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `pos-toast pos-toast-${type} animate-slide-up`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('animate-fade-out');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    // Play notification sound
    playNotificationSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
        } catch (e) {
            // Audio not available, that's ok
        }
    }

    // Time ago helper
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 10) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
}

// ============================================================
// CREATE GLOBAL INSTANCE
// ============================================================
window.PrintQueue = new PrintQueueService();

// Auto-start listening if this device is configured as server
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for SupabaseSyncService to initialize
    setTimeout(() => {
        if (window.PrintQueue.getIsServer()) {
            window.PrintQueue.setAsServer(true);
        }
    }, 3000);
});
