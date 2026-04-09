// Supabase Table Creator Service
// Provides SQL script for table creation and setup assistance

class SupabaseTableCreator {
    constructor() {
        this.setupSQL = null;
    }

    // Get the complete setup SQL script
    getSetupSQL() {
        return `-- ===================================================
-- SUPABASE AUTO-SETUP FOR POS THE BOSS
-- ===================================================
-- Run this script in the Supabase SQL Editor to set up your database.
-- ===================================================

-- 1. Enable UUID extension (Required for generating unique IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================
-- 2. CREATE TABLES
-- ===================================================

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    cost DECIMAL(10, 2) DEFAULT 0,
    price DECIMAL(10, 2) NOT NULL,
    stock INTEGER DEFAULT 0,
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    contact VARCHAR(50),
    salary DECIMAL(10, 2) DEFAULT 0,
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    items JSONB NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    payment_type VARCHAR(50),
    sales_code VARCHAR(50),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings Table (for store config)
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB,
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================================
-- 3. CREATE INDEXES (For Performance)
-- ===================================================

CREATE INDEX IF NOT EXISTS idx_products_item_code ON products(item_code);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);

CREATE INDEX IF NOT EXISTS idx_employees_sales_code ON employees(sales_code);
CREATE INDEX IF NOT EXISTS idx_employees_updated_at ON employees(updated_at);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_updated_at ON sales(updated_at);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers(updated_at);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);

-- ===================================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ===================================================
-- This allows appropriate access control.
-- For this POS system, we allow public access with the Anon Key.
-- Should be restricted in production if handling sensitive data.

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on products" ON products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on employees" ON employees FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on sales" ON sales FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on customers" ON customers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- ===================================================
-- 5. AUTOMATIC TIMESTAMP UPDATES
-- ===================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================
-- SETUP COMPLETE!
-- ===================================================`;
    }

    // Copy SQL to clipboard
    async copySetupSQL() {
        try {
            const sql = this.getSetupSQL();
            await navigator.clipboard.writeText(sql);
            return { success: true, message: 'SQL copied to clipboard!' };
        } catch (error) {
            console.error('Failed to copy SQL:', error);
            return { success: false, error: error.message };
        }
    }

    // Open Supabase SQL Editor
    openSQLEditor(supabaseUrl) {
        try {
            // Extract project reference from URL
            const url = supabaseUrl.replace('https://', '').replace('http://', '');
            const projectRef = url.split('.')[0];

            // Open SQL Editor in new tab
            const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
            window.open(sqlEditorUrl, '_blank');

            return { success: true };
        } catch (error) {
            console.error('Failed to open SQL Editor:', error);
            return { success: false, error: error.message };
        }
    }

    // Check if tables exist
    async checkTablesExist(supabaseClient) {
        try {
            const { error } = await supabaseClient.from('products').select('count').limit(1);

            if (error) {
                // Error code 42P01 = table doesn't exist
                if (error.code === '42P01' || error.message.includes('does not exist')) {
                    return { exist: false, needsSetup: true };
                }
                // PGRST116 = empty table (table exists but no data) - This logic is slightly wrong in some client versions but safe here
                if (error.code === 'PGRST116') {
                    return { exist: true, needsSetup: false };
                }
                throw error;
            }

            return { exist: true, needsSetup: false };
        } catch (error) {
            console.error('Error checking tables:', error);
            return { exist: false, needsSetup: true, error: error.message };
        }
    }

    // Show setup modal with instructions
    showSetupModal(supabaseUrl, serviceKey = null) {
        // Remove existing modal if any
        const existing = document.getElementById('supabase-setup-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'supabase-setup-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;

        const autoSetupMessage = serviceKey
            ? `<div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; margin-bottom: 20px; text-align: left; font-size: 0.9em; border: 1px solid #ffeeba;">
                 <strong>⚠️ Service Key Detected:</strong> Browser security prevents automatic table creation. 
                 <br>Please use the <strong>One-Click Copy</strong> method below. It is safe and fast.
               </div>`
            : '';

        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 12px; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 40px; margin-bottom: 10px;">🚀</div>
                    <h2 style="margin: 0; color: #2c3e50;">One-Time Database Setup</h2>
                    <p style="color: #7f8c8d; margin-top: 5px;">We need to create the tables to sync your data.</p>
                </div>
                
                ${autoSetupMessage}

                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 5px solid #3498db;">
                    <h3 style="margin-top: 0; color: #2c3e50;">Step 1: Copy Installation Script</h3>
                    <button id="copy-sql-btn" style="width: 100%; padding: 15px; background: #3498db; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: bold; transition: all 0.2s;">
                        📋 Copy SQL Script
                    </button>
                    <p style="margin: 8px 0 0 0; font-size: 13px; color: #7f8c8d;">
                        Contains all tables, indexes, and security policies.
                    </p>
                </div>

                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 5px solid #9b59b6;">
                    <h3 style="margin-top: 0; color: #2c3e50;">Step 2: Run in Supabase</h3>
                    <button id="open-sql-editor-btn" style="width: 100%; padding: 15px; background: #9b59b6; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: bold; transition: all 0.2s;">
                        ↗️ Open SQL Editor
                    </button>
                    <div style="margin-top: 10px; font-size: 14px; color: #2c3e50; text-align: left;">
                        <ol style="margin: 5px 0; padding-left: 20px;">
                            <li>Wait for the new tab to open</li>
                            <li>Paste the code (<strong>Ctrl+V</strong>)</li>
                            <li>Click the green <strong>Run</strong> button</li>
                        </ol>
                    </div>
                </div>

                <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; text-align: center;">
                    <p style="margin-bottom: 15px; font-weight: bold; color: #27ae60;">Done running the script?</p>
                    <div style="display: flex; gap: 10px;">
                        <button id="setup-done-btn" style="flex: 2; padding: 12px; background: #27ae60; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: bold;">
                            ✅ Yes, I'm Done! Connect Now
                        </button>
                        <button id="setup-cancel-btn" style="flex: 1; padding: 12px; background: #ecf0f1; color: #7f8c8d; border: 1px solid #bdc3c7; border-radius: 6px; font-size: 16px; cursor: pointer;">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        const copyBtn = document.getElementById('copy-sql-btn');
        const openBtn = document.getElementById('open-sql-editor-btn');
        const doneBtn = document.getElementById('setup-done-btn');
        const cancelBtn = document.getElementById('setup-cancel-btn');

        if (copyBtn) copyBtn.addEventListener('click', async () => {
            const result = await this.copySetupSQL();
            if (result.success) {
                copyBtn.innerHTML = '✅ Copied to Clipboard!';
                copyBtn.style.background = '#2ecc71';
                setTimeout(() => {
                    copyBtn.innerHTML = '📋 Copy SQL Script';
                    copyBtn.style.background = '#3498db';
                }, 3000);
            } else {
                alert('Failed to copy: ' + result.error);
            }
        });

        if (openBtn) openBtn.addEventListener('click', () => {
            this.openSQLEditor(supabaseUrl);
            openBtn.innerHTML = '✅ Opening...';
        });

        if (doneBtn) doneBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            // Trigger connection retry
            if (window.connectToSupabase) {
                window.connectToSupabase();
            }
        });

        if (cancelBtn) cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }
}

// Create global instance
window.SupabaseTableCreator = new SupabaseTableCreator();
