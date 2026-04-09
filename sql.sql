-- ================================================================
-- 🔥 POS THE BOSS - COMPLETE DATABASE SETUP
-- ================================================================
-- Run this ENTIRE script in your Supabase SQL Editor.
-- It creates all tables, indexes, RLS policies, triggers,
-- and the print_queue table for cross-device printing.
-- ================================================================

-- 0. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. PRODUCTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code       VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    cost            DECIMAL(10, 2) DEFAULT 0,
    price           DECIMAL(10, 2) NOT NULL,
    stock           INTEGER DEFAULT 0,
    category1       VARCHAR(100),
    category2       VARCHAR(100),
    barcode         VARCHAR(100),
    unit            VARCHAR(50) DEFAULT 'pcs',
    min_stock       INTEGER DEFAULT 0,
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    deleted         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 2. EMPLOYEES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS employees (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_code      VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(100),
    contact         VARCHAR(50),
    email           VARCHAR(255),
    address         TEXT,
    salary          DECIMAL(10, 2) DEFAULT 0,
    commission_rate DECIMAL(5, 2) DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    deleted         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 3. CUSTOMERS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    phone           VARCHAR(50),
    email           VARCHAR(255),
    address         TEXT,
    loyalty_points  INTEGER DEFAULT 0,
    total_purchases DECIMAL(12, 2) DEFAULT 0,
    total_loan      DECIMAL(12, 2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'active',
    notes           TEXT,
    deleted         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 4. SALES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS sales (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number    VARCHAR(50) UNIQUE NOT NULL,
    date              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    sales_code        VARCHAR(50),
    items             JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal          DECIMAL(12, 2) DEFAULT 0,
    discount          DECIMAL(12, 2) DEFAULT 0,
    total             DECIMAL(12, 2) NOT NULL DEFAULT 0,
    paid_amount       DECIMAL(12, 2) DEFAULT 0,
    balance           DECIMAL(12, 2) DEFAULT 0,
    payment_type      VARCHAR(50),
    cheque_number     VARCHAR(100),
    cheque_date       DATE,
    customer_id       UUID REFERENCES customers(id),
    customer_name     VARCHAR(255),
    customer_phone    VARCHAR(50),
    customer_email    VARCHAR(255),
    loan_amount       DECIMAL(12, 2) DEFAULT 0,
    status            VARCHAR(20) DEFAULT 'Unpaid',
    notes             TEXT,
    deleted           BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 5. SALES ITEMS TABLE (Normalized individual line items)
-- ================================================================
CREATE TABLE IF NOT EXISTS sales_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    invoice_number  VARCHAR(50) NOT NULL,
    item_code       VARCHAR(50) NOT NULL,
    item_name       VARCHAR(255) NOT NULL,
    quantity        DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit_price      DECIMAL(10, 2) NOT NULL DEFAULT 0,
    unit_cost       DECIMAL(10, 2) DEFAULT 0,
    discount        DECIMAL(10, 2) DEFAULT 0,
    total           DECIMAL(12, 2) NOT NULL DEFAULT 0,
    profit          DECIMAL(12, 2) DEFAULT 0,
    sales_code      VARCHAR(50),
    deleted         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 6. SALES HISTORY / DAILY SUMMARY TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS sales_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    summary_date    DATE NOT NULL,
    total_sales     DECIMAL(12, 2) DEFAULT 0,
    total_profit    DECIMAL(12, 2) DEFAULT 0,
    total_discount  DECIMAL(12, 2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    items_sold      INTEGER DEFAULT 0,
    cash_sales      DECIMAL(12, 2) DEFAULT 0,
    card_sales      DECIMAL(12, 2) DEFAULT 0,
    cheque_sales    DECIMAL(12, 2) DEFAULT 0,
    digital_sales   DECIMAL(12, 2) DEFAULT 0,
    other_sales     DECIMAL(12, 2) DEFAULT 0,
    loan_total      DECIMAL(12, 2) DEFAULT 0,
    top_product     VARCHAR(255),
    top_employee    VARCHAR(100),
    deleted         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(summary_date)
);

-- ================================================================
-- 7. ANALYSIS DATA TABLE (Custom KPIs & Metrics)
-- ================================================================
CREATE TABLE IF NOT EXISTS analysis_data (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name     VARCHAR(100) NOT NULL,
    metric_value    DECIMAL(14, 2) DEFAULT 0,
    metric_type     VARCHAR(50),
    period_start    DATE,
    period_end      DATE,
    category        VARCHAR(100),
    metadata        JSONB DEFAULT '{}'::jsonb,
    deleted         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 8. REPORTS TABLE (Saved / generated reports)
-- ================================================================
CREATE TABLE IF NOT EXISTS reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_name     VARCHAR(255) NOT NULL,
    report_type     VARCHAR(50) NOT NULL,
    date_from       DATE,
    date_to         DATE,
    generated_by    VARCHAR(100),
    parameters      JSONB DEFAULT '{}'::jsonb,
    report_data     JSONB DEFAULT '{}'::jsonb,
    file_url        TEXT,
    status          VARCHAR(20) DEFAULT 'generated',
    deleted         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 9. SETTINGS TABLE (Store configuration)
-- ================================================================
CREATE TABLE IF NOT EXISTS settings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key             VARCHAR(100) UNIQUE NOT NULL,
    value           JSONB,
    deleted         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 10. INVENTORY LOG TABLE (Stock movement tracking)
-- ================================================================
CREATE TABLE IF NOT EXISTS inventory_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code       VARCHAR(50) NOT NULL,
    change_type     VARCHAR(20) NOT NULL,  -- 'sale', 'restock', 'adjustment', 'return'
    quantity_change INTEGER NOT NULL,
    quantity_before INTEGER,
    quantity_after  INTEGER,
    reference       VARCHAR(100),
    notes           TEXT,
    performed_by    VARCHAR(100),
    deleted         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 11. PRINT QUEUE TABLE (Cross-device receipt printing)
-- ================================================================
-- This powers the "Print in Server" feature.
-- Any POS device can insert a print job here.
-- The server PC (with the printer) listens via Supabase Realtime
-- and prints the receipt when a new row appears.
-- ================================================================
CREATE TABLE IF NOT EXISTS print_queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_device   VARCHAR(100) NOT NULL,
    target_device   VARCHAR(100) NOT NULL DEFAULT 'server',
    invoice_number  VARCHAR(50) NOT NULL,
    receipt_data    JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    printed_at      TIMESTAMP WITH TIME ZONE,
    error_message   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 12. HELD BILLS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS held_bills (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id       VARCHAR(100),
    bill_data       JSONB NOT NULL,
    status          VARCHAR(20) DEFAULT 'held',
    deleted         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 13. EXPENSES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(255) NOT NULL,
    amount          DECIMAL(12, 2) NOT NULL DEFAULT 0,
    category        VARCHAR(100),
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    paid_by         VARCHAR(100),
    payment_method  VARCHAR(50),
    receipt_url     TEXT,
    notes           TEXT,
    deleted         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ================================================================
-- 14. INDEXES (Performance Optimization)
-- ================================================================

-- Products
CREATE INDEX IF NOT EXISTS idx_products_item_code ON products(item_code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category1 ON products(category1);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);

-- Employees
CREATE INDEX IF NOT EXISTS idx_employees_sales_code ON employees(sales_code);
CREATE INDEX IF NOT EXISTS idx_employees_updated_at ON employees(updated_at);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers(updated_at);

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_sales_code ON sales(sales_code);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_updated_at ON sales(updated_at);

-- Sales Items
CREATE INDEX IF NOT EXISTS idx_sales_items_sale_id ON sales_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_invoice ON sales_items(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_items_item_code ON sales_items(item_code);
CREATE INDEX IF NOT EXISTS idx_sales_items_updated_at ON sales_items(updated_at);

-- Sales History
CREATE INDEX IF NOT EXISTS idx_sales_history_date ON sales_history(summary_date);
CREATE INDEX IF NOT EXISTS idx_sales_history_updated_at ON sales_history(updated_at);

-- Analysis
CREATE INDEX IF NOT EXISTS idx_analysis_metric ON analysis_data(metric_name);
CREATE INDEX IF NOT EXISTS idx_analysis_period ON analysis_data(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analysis_updated_at ON analysis_data(updated_at);

-- Reports
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_dates ON reports(date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_reports_updated_at ON reports(updated_at);

-- Settings
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);

-- Inventory Log
CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory_log(item_code);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_log(change_type);
CREATE INDEX IF NOT EXISTS idx_inventory_updated_at ON inventory_log(updated_at);

-- Print Queue
CREATE INDEX IF NOT EXISTS idx_print_queue_status ON print_queue(status);
CREATE INDEX IF NOT EXISTS idx_print_queue_target ON print_queue(target_device);
CREATE INDEX IF NOT EXISTS idx_print_queue_created ON print_queue(created_at);

-- Held Bills
CREATE INDEX IF NOT EXISTS idx_held_bills_status ON held_bills(status);
CREATE INDEX IF NOT EXISTS idx_held_bills_device ON held_bills(device_id);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);


-- ================================================================
-- 15. ROW LEVEL SECURITY (RLS)
-- ================================================================
-- Allow full public access via the anon key for this POS system.
-- Restrict policies in production for sensitive data.

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_products" ON products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_employees" ON employees FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_customers" ON customers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_sales" ON sales FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sales_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_sales_items" ON sales_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sales_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_sales_history" ON sales_history FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE analysis_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_analysis_data" ON analysis_data FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reports" ON reports FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_settings" ON settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE inventory_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_inventory_log" ON inventory_log FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE print_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_print_queue" ON print_queue FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE held_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_held_bills" ON held_bills FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);


-- ================================================================
-- 16. AUTOMATIC TIMESTAMP TRIGGER
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'products', 'employees', 'customers', 'sales',
            'sales_items', 'sales_history', 'analysis_data',
            'reports', 'settings', 'inventory_log', 'print_queue',
            'held_bills', 'expenses'
        ])
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS update_%I_updated_at ON %I; CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            t, t, t, t
        );
    END LOOP;
END;
$$;


-- ================================================================
-- 17. ENABLE REALTIME FOR PRINT QUEUE
-- ================================================================
-- This is CRITICAL for the cross-device printing feature.
-- Supabase Realtime will push new print_queue rows to listening clients.
ALTER PUBLICATION supabase_realtime ADD TABLE print_queue;


-- ================================================================
-- 18. DAILY SUMMARY FUNCTION (Optional utility)
-- ================================================================
CREATE OR REPLACE FUNCTION generate_daily_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    v_total_sales     DECIMAL(12,2);
    v_total_profit    DECIMAL(12,2);
    v_total_discount  DECIMAL(12,2);
    v_tx_count        INTEGER;
    v_items_sold      INTEGER;
    v_cash            DECIMAL(12,2);
    v_card            DECIMAL(12,2);
    v_cheque          DECIMAL(12,2);
    v_digital         DECIMAL(12,2);
    v_other           DECIMAL(12,2);
    v_loan            DECIMAL(12,2);
    v_top_product     VARCHAR(255);
    v_top_employee    VARCHAR(100);
BEGIN
    SELECT
        COALESCE(SUM(total), 0),
        COALESCE(SUM(discount), 0),
        COUNT(*),
        COALESCE(SUM(balance), 0)
    INTO v_total_sales, v_total_discount, v_tx_count, v_loan
    FROM sales
    WHERE date::date = target_date AND deleted = FALSE;

    -- Payment breakdown
    SELECT COALESCE(SUM(total), 0) INTO v_cash FROM sales WHERE date::date = target_date AND payment_type = 'cash' AND deleted = FALSE;
    SELECT COALESCE(SUM(total), 0) INTO v_card FROM sales WHERE date::date = target_date AND payment_type = 'card' AND deleted = FALSE;
    SELECT COALESCE(SUM(total), 0) INTO v_cheque FROM sales WHERE date::date = target_date AND payment_type = 'cheque' AND deleted = FALSE;
    SELECT COALESCE(SUM(total), 0) INTO v_digital FROM sales WHERE date::date = target_date AND payment_type = 'digital' AND deleted = FALSE;
    SELECT COALESCE(SUM(total), 0) INTO v_other FROM sales WHERE date::date = target_date AND payment_type NOT IN ('cash','card','cheque','digital') AND deleted = FALSE;

    -- Profit from JSONB items
    SELECT COALESCE(SUM((item->>'profit')::decimal), 0), COALESCE(SUM((item->>'qty')::integer), 0)
    INTO v_total_profit, v_items_sold
    FROM sales, jsonb_array_elements(items) AS item
    WHERE date::date = target_date AND deleted = FALSE;

    -- Top product
    SELECT item->>'name' INTO v_top_product
    FROM sales, jsonb_array_elements(items) AS item
    WHERE date::date = target_date AND deleted = FALSE
    GROUP BY item->>'name'
    ORDER BY SUM((item->>'qty')::decimal) DESC
    LIMIT 1;

    -- Top employee
    SELECT sales_code INTO v_top_employee
    FROM sales
    WHERE date::date = target_date AND deleted = FALSE
    GROUP BY sales_code
    ORDER BY SUM(total) DESC
    LIMIT 1;

    -- Upsert summary
    INSERT INTO sales_history (
        summary_date, total_sales, total_profit, total_discount,
        transaction_count, items_sold, cash_sales, card_sales,
        cheque_sales, digital_sales, other_sales, loan_total,
        top_product, top_employee
    ) VALUES (
        target_date, v_total_sales, v_total_profit, v_total_discount,
        v_tx_count, v_items_sold, v_cash, v_card,
        v_cheque, v_digital, v_other, v_loan,
        v_top_product, v_top_employee
    )
    ON CONFLICT (summary_date) DO UPDATE SET
        total_sales = EXCLUDED.total_sales,
        total_profit = EXCLUDED.total_profit,
        total_discount = EXCLUDED.total_discount,
        transaction_count = EXCLUDED.transaction_count,
        items_sold = EXCLUDED.items_sold,
        cash_sales = EXCLUDED.cash_sales,
        card_sales = EXCLUDED.card_sales,
        cheque_sales = EXCLUDED.cheque_sales,
        digital_sales = EXCLUDED.digital_sales,
        other_sales = EXCLUDED.other_sales,
        loan_total = EXCLUDED.loan_total,
        top_product = EXCLUDED.top_product,
        top_employee = EXCLUDED.top_employee,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- ================================================================
-- ✅ SETUP COMPLETE!
-- ================================================================
-- Tables created:
--   1.  products          - Product catalog
--   2.  employees         - Staff & sales codes
--   3.  customers         - Customer registry
--   4.  sales             - Transaction headers
--   5.  sales_items       - Transaction line items
--   6.  sales_history     - Daily summaries
--   7.  analysis_data     - Custom KPIs
--   8.  reports           - Saved reports
--   9.  settings          - Store configuration
--   10. inventory_log     - Stock movements
--   11. print_queue       - Cross-device printing
--   12. held_bills        - Held/parked bills
--   13. expenses          - Business expenses
--
-- Features enabled:
--   ✅ UUID auto-generation
--   ✅ Auto-updating timestamps
--   ✅ Row Level Security (public access)
--   ✅ Performance indexes
--   ✅ Realtime for print_queue
--   ✅ Daily summary function
-- ================================================================
