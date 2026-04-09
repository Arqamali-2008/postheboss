// ===== VOICE CONTROL SYSTEM =====
// Comprehensive voice recognition module using Web Speech API

class VoiceControl {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.commands = new Map();
        this.onResultCallback = null;
        this.init();
    }

    init() {
        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported in this browser');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        // Setup event handlers
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateUI();
        };

        this.recognition.onend = () => {
            // Auto-restart if still in listening mode
            if (this.isListening && this.recognition) {
                try {
                    this.recognition.start();
                } catch (error) {
                    // Recognition already started or error occurred
                    console.log('Recognition restart:', error);
                }
            } else {
                this.isListening = false;
                this.updateUI();
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            
            // Auto-restart on certain errors if still in listening mode
            if (this.isListening) {
                if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'network') {
                    setTimeout(() => {
                        if (this.isListening && this.recognition) {
                            try {
                                this.recognition.start();
                            } catch (e) {
                                console.log('Auto-restart error:', e);
                            }
                        }
                    }, 1000);
                } else if (event.error === 'aborted') {
                    // User stopped or browser stopped - don't auto-restart
                    this.isListening = false;
                    this.updateUI();
                } else {
                    // Other errors - try to restart
                    setTimeout(() => {
                        if (this.isListening && this.recognition) {
                            try {
                                this.recognition.start();
                            } catch (e) {
                                console.log('Error restart:', e);
                            }
                        }
                    }, 2000);
                }
            } else {
                this.updateUI();
            }
            
            if (event.error === 'no-speech') {
                // Don't show error for no-speech in continuous mode
            } else if (event.error !== 'aborted') {
                this.showFeedback(`Voice error: ${event.error}. Retrying...`);
            }
        };

        this.recognition.onresult = (event) => {
            // Process all results (continuous mode)
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    const transcript = event.results[i][0].transcript.toLowerCase().trim();
                    this.processCommand(transcript);
                }
            }
        };

        // Initialize command mappings
        this.setupCommands();
    }

    setupCommands() {
        // POS Operations
        this.commands.set('new bill', () => {
            if (typeof newBill === 'function') newBill();
            return 'New bill created';
        });
        this.commands.set('create new bill', () => {
            if (typeof newBill === 'function') newBill();
            return 'New bill created';
        });
        this.commands.set('add item', () => {
            const codeField = document.getElementById('itemCode');
            if (codeField) codeField.focus();
            return 'Ready to add item. Please say the item code';
        });
        this.commands.set('process payment', () => {
            if (typeof openPaymentModal === 'function') openPaymentModal();
            return 'Opening payment modal';
        });
        this.commands.set('payment', () => {
            if (typeof openPaymentModal === 'function') openPaymentModal();
            return 'Opening payment modal';
        });
        this.commands.set('print receipt', () => {
            if (typeof printReceipt === 'function') printReceipt();
            return 'Printing receipt';
        });
        this.commands.set('print', () => {
            if (typeof printReceipt === 'function') printReceipt();
            return 'Printing receipt';
        });

        // Navigation Commands
        this.commands.set('go to dashboard', () => {
            window.location.href = 'dashboard.html';
            return 'Navigating to dashboard';
        });
        this.commands.set('open dashboard', () => {
            window.location.href = 'dashboard.html';
            return 'Opening dashboard';
        });
        this.commands.set('go to pos', () => {
            window.location.href = 'index.html';
            return 'Navigating to POS';
        });
        this.commands.set('open pos', () => {
            window.location.href = 'index.html';
            return 'Opening POS';
        });
        this.commands.set('go to products', () => {
            window.location.href = 'products.html';
            return 'Navigating to products';
        });
        this.commands.set('open products', () => {
            window.location.href = 'products.html';
            return 'Opening products';
        });
        this.commands.set('go to sales', () => {
            window.location.href = 'sales.html';
            return 'Navigating to sales';
        });
        this.commands.set('open sales', () => {
            window.location.href = 'sales.html';
            return 'Opening sales';
        });
        this.commands.set('go to employees', () => {
            window.location.href = 'employees.html';
            return 'Navigating to employees';
        });
        this.commands.set('open employees', () => {
            window.location.href = 'employees.html';
            return 'Opening employees';
        });
        this.commands.set('go to customers', () => {
            if (window.location.pathname.includes('customers.html')) return 'Already on customers page';
            window.location.href = 'customers.html';
            return 'Navigating to customers';
        });
        this.commands.set('open customers', () => {
            if (window.location.pathname.includes('customers.html')) return 'Already on customers page';
            window.location.href = 'customers.html';
            return 'Opening customers';
        });
        this.commands.set('go to reports', () => {
            if (window.location.pathname.includes('reports.html')) return 'Already on reports page';
            window.location.href = 'reports.html';
            return 'Navigating to reports';
        });
        this.commands.set('open reports', () => {
            if (window.location.pathname.includes('reports.html')) return 'Already on reports page';
            window.location.href = 'reports.html';
            return 'Opening reports';
        });
        this.commands.set('go to settings', () => {
            window.location.href = 'settings.html';
            return 'Navigating to settings';
        });
        this.commands.set('open settings', () => {
            window.location.href = 'settings.html';
            return 'Opening settings';
        });

        // EMS Navigation
        this.commands.set('go to ems', () => {
            window.location.href = 'emp/index.html';
            return 'Navigating to EMS';
        });
        this.commands.set('open ems', () => {
            window.location.href = 'emp/index.html';
            return 'Opening EMS';
        });
        this.commands.set('go to ems dashboard', () => {
            window.location.href = 'emp/Dashboard.html';
            return 'Navigating to EMS dashboard';
        });
        this.commands.set('go to attendance', () => {
            window.location.href = 'emp/Attendance.html';
            return 'Navigating to attendance';
        });
        this.commands.set('go to payroll', () => {
            window.location.href = 'emp/Payroll.html';
            return 'Navigating to payroll';
        });
        this.commands.set('mark attendance', () => {
            window.location.href = 'emp/Scanner.html';
            return 'Opening attendance scanner';
        });

        // Search Commands
        this.commands.set('search invoice', () => {
            const searchField = document.getElementById('invoiceSearch');
            if (searchField) {
                searchField.focus();
                return 'Ready to search invoice. Please say the invoice number';
            }
            return 'Invoice search not available on this page';
        });
        this.commands.set('find product', () => {
            const searchField = document.getElementById('productSearch');
            if (searchField) {
                searchField.focus();
                return 'Ready to search product. Please say the product name or code';
            }
            return 'Product search not available on this page';
        });
        this.commands.set('search product', () => {
            const searchField = document.getElementById('productSearch');
            if (searchField) {
                searchField.focus();
                return 'Ready to search product. Please say the product name or code';
            }
            return 'Product search not available on this page';
        });

        // Item Code Patterns
        this.commands.set(/^add item (.+)$/i, (match) => {
            const itemCode = match[1].trim().toUpperCase();
            const codeField = document.getElementById('itemCode');
            if (codeField) {
                codeField.value = itemCode;
                codeField.dispatchEvent(new Event('change'));
                if (typeof fillProductDetails === 'function') fillProductDetails();
                return `Adding item ${itemCode}`;
            }
            return 'Item code field not found';
        });

        // Invoice Search Pattern
        this.commands.set(/^search invoice (.+)$/i, (match) => {
            const invoiceId = match[1].trim().toUpperCase();
            const searchField = document.getElementById('invoiceSearch');
            if (searchField) {
                searchField.value = invoiceId;
                searchField.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter' }));
                return `Searching for invoice ${invoiceId}`;
            }
            if (typeof loadInvoiceById === 'function') {
                loadInvoiceById(invoiceId);
                return `Loading invoice ${invoiceId}`;
            }
            return 'Invoice search not available';
        });

        // Product Search Pattern
        this.commands.set(/^find product (.+)$/i, (match) => {
            const searchTerm = match[1].trim();
            const searchField = document.getElementById('productSearch');
            if (searchField) {
                searchField.value = searchTerm;
                searchField.dispatchEvent(new Event('input'));
                return `Searching for ${searchTerm}`;
            }
            return 'Product search not available';
        });

        // Quantity and Price Commands
        this.commands.set(/^quantity (\d+)$/i, (match) => {
            const qty = match[1];
            const qtyField = document.getElementById('itemQty');
            if (qtyField) {
                qtyField.value = qty;
                qtyField.focus();
                return `Quantity set to ${qty}`;
            }
            return 'Quantity field not found';
        });
        
        this.commands.set(/^set price (.+)$/i, (match) => {
            const price = match[1].trim();
            const priceField = document.getElementById('itemPrice');
            if (priceField) {
                priceField.value = price;
                return `Price set to ${price}`;
            }
            return 'Price field not found';
        });
        
        this.commands.set(/^discount (.+)$/i, (match) => {
            const discount = match[1].trim();
            const discountField = document.getElementById('discount');
            if (discountField) {
                discountField.value = discount;
                if (typeof calculateTotal === 'function') calculateTotal();
                return `Discount set to ${discount}`;
            }
            return 'Discount field not found';
        });
        
        // Payment Amount Commands
        this.commands.set(/^amount (.+)$/i, (match) => {
            const amount = match[1].trim();
            const amountField = document.getElementById('amountReceived');
            if (amountField) {
                amountField.value = amount;
                if (typeof calculatePaymentBalance === 'function') calculatePaymentBalance();
                return `Payment amount set to ${amount}`;
            }
            return 'Amount field not found';
        });
        
        this.commands.set(/^paid (.+)$/i, (match) => {
            const amount = match[1].trim();
            const amountField = document.getElementById('amountReceived');
            if (amountField) {
                amountField.value = amount;
                if (typeof calculatePaymentBalance === 'function') calculatePaymentBalance();
                return `Paid amount set to ${amount}`;
            }
            return 'Amount field not found';
        });
        
        // Payment Type Commands
        this.commands.set(/^payment (cash|card|cheque|digital|other)$/i, (match) => {
            const type = match[1].toLowerCase();
            if (typeof selectPaymentType === 'function') {
                selectPaymentType(type);
                return `Payment type set to ${type}`;
            }
            return 'Payment type selection not available';
        });
        
        // Confirm Commands
        this.commands.set('confirm payment', () => {
            if (typeof confirmPayment === 'function') {
                confirmPayment();
                return 'Confirming payment';
            }
            return 'Payment confirmation not available';
        });
        
        this.commands.set('confirm', () => {
            if (typeof confirmPayment === 'function') {
                confirmPayment();
                return 'Confirming';
            }
            return 'Confirmation not available';
        });
        
        // Voice Control Toggle
        this.commands.set('voice on', () => {
            if (!this.isListening) {
                this.startListening();
                return 'Voice control activated';
            }
            return 'Voice control already active';
        });
        
        this.commands.set('voice off', () => {
            if (this.isListening) {
                this.stopListening();
                return 'Voice control deactivated';
            }
            return 'Voice control already inactive';
        });
        
        this.commands.set('stop listening', () => {
            if (this.isListening) {
                this.stopListening();
                return 'Stopped listening';
            }
            return 'Not listening';
        });
        
        // Help Command
        this.commands.set('help', () => {
            this.showHelpModal();
            return 'Showing voice commands help';
        });
        this.commands.set('voice help', () => {
            this.showHelpModal();
            return 'Showing voice commands help';
        });
        this.commands.set('what can you do', () => {
            this.showHelpModal();
            return 'Showing voice commands help';
        });
    }

    processCommand(transcript) {
        console.log('Voice command:', transcript);
        
        // Try exact match first
        if (this.commands.has(transcript)) {
            const result = this.commands.get(transcript)();
            this.showFeedback(result);
            return;
        }

        // Try regex patterns
        for (const [pattern, handler] of this.commands.entries()) {
            if (pattern instanceof RegExp) {
                const match = transcript.match(pattern);
                if (match) {
                    const result = handler(match);
                    this.showFeedback(result);
                    return;
                }
            }
        }

        // No match found
        this.showFeedback(`Command not recognized: "${transcript}". Say "help" for available commands.`);
    }

    startListening() {
        if (!this.recognition) {
            this.showFeedback('Voice recognition not supported in this browser');
            return;
        }

        if (this.isListening) {
            this.stopListening();
            return;
        }

        try {
            this.recognition.start();
            this.showFeedback('Listening...');
        } catch (error) {
            console.error('Error starting recognition:', error);
            this.showFeedback('Error starting voice recognition');
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.isListening = false; // Set flag first to prevent auto-restart
            this.recognition.stop();
            this.updateUI();
        }
    }

    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    updateUI() {
        const micButton = document.getElementById('voiceControlBtn');
        const micIndicator = document.getElementById('voiceIndicator');
        
        if (micButton) {
            if (this.isListening) {
                micButton.classList.add('listening');
                micButton.title = 'Stop listening (click again)';
            } else {
                micButton.classList.remove('listening');
                micButton.title = 'Start voice control';
            }
        }

        if (micIndicator) {
            if (this.isListening) {
                micIndicator.style.display = 'block';
                micIndicator.textContent = '🎤 Listening...';
            } else {
                micIndicator.style.display = 'none';
            }
        }
    }

    showFeedback(message) {
        // Create or update feedback element
        let feedback = document.getElementById('voiceFeedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.id = 'voiceFeedback';
            feedback.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(52, 152, 219, 0.95);
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-size: 14px;
                max-width: 400px;
                text-align: center;
                animation: slideUp 0.3s ease;
            `;
            document.body.appendChild(feedback);
        }

        feedback.textContent = message;
        feedback.style.display = 'block';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (feedback) {
                feedback.style.display = 'none';
            }
        }, 3000);
    }

    showHelpModal() {
        // Create help modal if it doesn't exist
        let helpModal = document.getElementById('voiceHelpModal');
        if (!helpModal) {
            helpModal = document.createElement('div');
            helpModal.id = 'voiceHelpModal';
            helpModal.className = 'modal';
            helpModal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>Voice Commands Help</h3>
                        <span class="close" onclick="document.getElementById('voiceHelpModal').style.display='none'">&times;</span>
                    </div>
                    <div class="modal-body">
                        <h4>POS Operations</h4>
                        <ul>
                            <li>"new bill" or "create new bill"</li>
                            <li>"add item" or "add item [code]"</li>
                            <li>"process payment" or "payment"</li>
                            <li>"print receipt" or "print"</li>
                        </ul>
                        <h4>Navigation</h4>
                        <ul>
                            <li>"go to dashboard" or "open dashboard"</li>
                            <li>"go to pos" or "open pos"</li>
                            <li>"go to products" or "open products"</li>
                            <li>"go to sales" or "open sales"</li>
                            <li>"go to employees" or "open employees"</li>
                            <li>"go to customers" or "open customers"</li>
                            <li>"go to reports" or "open reports"</li>
                            <li>"go to settings" or "open settings"</li>
                        </ul>
                        <h4>Search</h4>
                        <ul>
                            <li>"search invoice" or "search invoice [number]"</li>
                            <li>"find product" or "find product [name]"</li>
                        </ul>
                        <h4>EMS</h4>
                        <ul>
                            <li>"go to ems" or "open ems"</li>
                            <li>"go to attendance"</li>
                            <li>"go to payroll"</li>
                            <li>"mark attendance"</li>
                        </ul>
                        <h4>Help</h4>
                        <ul>
                            <li>"help" or "voice help"</li>
                        </ul>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="document.getElementById('voiceHelpModal').style.display='none'">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(helpModal);

            // Close on outside click
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) {
                    helpModal.style.display = 'none';
                }
            });
        }

        helpModal.style.display = 'flex';
    }
}

// Initialize voice control globally
let voiceControl = null;

document.addEventListener('DOMContentLoaded', function() {
    voiceControl = new VoiceControl();
    
    // Create voice control button if it doesn't exist
    if (!document.getElementById('voiceControlBtn')) {
        const navActions = document.querySelector('.nav-actions');
        if (navActions) {
            const voiceBtn = document.createElement('button');
            voiceBtn.id = 'voiceControlBtn';
            voiceBtn.className = 'btn btn-secondary btn-sm';
            voiceBtn.innerHTML = '🎤';
            voiceBtn.title = 'Voice Control (Click to start)';
            voiceBtn.style.cssText = 'font-size: 1.2rem; padding: 8px 12px; cursor: pointer;';
            voiceBtn.onclick = () => voiceControl.toggleListening();
            navActions.insertBefore(voiceBtn, navActions.firstChild);
        }
    }

    // Create voice indicator
    if (!document.getElementById('voiceIndicator')) {
        const indicator = document.createElement('div');
        indicator.id = 'voiceIndicator';
        indicator.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: rgba(231, 76, 60, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            z-index: 9999;
            font-weight: bold;
            display: none;
            animation: pulse 1s infinite;
        `;
        document.body.appendChild(indicator);
    }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceControl;
}

