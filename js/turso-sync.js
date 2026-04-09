// ============================================================
// Turso Sync Service (offline-first + timestamp merge)
// ============================================================

(function () {
  const KEY_ENABLED = "turso_enabled";
  const KEY_URL = "turso_url";
  const KEY_TOKEN = "turso_token";
  const KEY_PENDING = "turso_pending_tables";
  const KEY_LAST_SYNC = "turso_last_sync";
  const KEY_STATUS = "turso_sync_status";
  const DEFAULT_INTERVAL = 30000;

  class TursoSyncService {
    constructor() {
      this.url = "";
      this.token = "";
      this.enabled = false;
      this.isConnected = false;
      this.syncTimer = null;
      this.syncing = false;
    }

    loadConfig() {
      this.url = localStorage.getItem(KEY_URL) || "";
      this.token = localStorage.getItem(KEY_TOKEN) || "";
      this.enabled = localStorage.getItem(KEY_ENABLED) === "true";
      return {
        url: this.url,
        token: this.token,
        enabled: this.enabled
      };
    }

    saveConfig(url, token, enabled = true) {
      localStorage.setItem(KEY_URL, (url || "").trim());
      localStorage.setItem(KEY_TOKEN, (token || "").trim());
      localStorage.setItem(KEY_ENABLED, enabled ? "true" : "false");
      this.loadConfig();
    }

    queueLocalMutation(tableName) {
      const pending = this.readPendingTables();
      if (!pending.includes(tableName)) pending.push(tableName);
      localStorage.setItem(KEY_PENDING, JSON.stringify(pending));
    }

    readPendingTables() {
      try {
        const parsed = JSON.parse(localStorage.getItem(KEY_PENDING) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }

    clearPendingTable(tableName) {
      const pending = this.readPendingTables().filter((t) => t !== tableName);
      localStorage.setItem(KEY_PENDING, JSON.stringify(pending));
    }

    async executeSQLStatements(sqlList) {
      if (!this.url || !this.token) {
        throw new Error("Missing Turso config");
      }

      const requests = sqlList.map((sql) => ({ type: "execute", stmt: { sql } }));
      requests.push({ type: "close" });

      const res = await fetch(`${this.url.replace(/\/$/, "")}/v2/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ requests })
      });

      if (!res.ok) {
        throw new Error(`Turso HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data?.error) {
        throw new Error(data.error.message || "Turso pipeline error");
      }
      return data;
    }

    async executeSQLSingle(sql) {
      const out = await this.executeSQLStatements([sql]);
      return out;
    }

    sqlEscape(value) {
      if (value === null || value === undefined) return "NULL";
      return `'${String(value).replace(/'/g, "''")}'`;
    }

    async ensureSchema() {
      const sql = [
        `CREATE TABLE IF NOT EXISTS pos_sales (invoice_number TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS pos_products (item_code TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS pos_employees (sales_code TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS print_queue (
          id TEXT PRIMARY KEY,
          source_device TEXT,
          target_device TEXT,
          invoice_number TEXT,
          receipt_data TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT,
          updated_at TEXT,
          printed_at TEXT
        )`
      ];
      await this.executeSQLStatements(sql);
    }

    async connect() {
      this.loadConfig();
      if (!this.enabled) return { success: false, error: "Turso disabled" };
      if (!this.url || !this.token) return { success: false, error: "Missing Turso URL/token" };

      try {
        await this.ensureSchema();
        this.isConnected = true;
        this.setStatus("connected");
        this.startAutoSync();
        return { success: true };
      } catch (e) {
        this.isConnected = false;
        this.setStatus("error");
        return { success: false, error: e.message };
      }
    }

    disconnect() {
      this.stopAutoSync();
      this.isConnected = false;
      this.setStatus("disconnected");
    }

    startAutoSync() {
      this.stopAutoSync();
      this.syncTimer = setInterval(() => {
        if (navigator.onLine) this.sync().catch(() => { });
      }, DEFAULT_INTERVAL);
    }

    stopAutoSync() {
      if (this.syncTimer) clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    setStatus(status) {
      localStorage.setItem(KEY_STATUS, status);
      const badge = document.getElementById("tursoSyncStatus");
      const txt = document.getElementById("tursoSyncStatusText");
      if (badge) badge.textContent = status;
      if (txt) txt.textContent = status;
    }

    getUpdatedAt(item) {
      return item?.updated_at || item?.updatedAt || item?.date || new Date(0).toISOString();
    }

    async pushLocalTable(tableName) {
      if (tableName === "sales") {
        const sales = (window.getSales?.() || []);
        const stmts = sales.map((s) => {
          const invoice = s.invoiceNumber;
          const updatedAt = this.getUpdatedAt(s);
          const payload = JSON.stringify(s);
          return `INSERT INTO pos_sales (invoice_number, payload, updated_at)
                  VALUES (${this.sqlEscape(invoice)}, ${this.sqlEscape(payload)}, ${this.sqlEscape(updatedAt)})
                  ON CONFLICT(invoice_number) DO UPDATE SET
                    payload=excluded.payload,
                    updated_at=excluded.updated_at
                  WHERE excluded.updated_at > pos_sales.updated_at`;
        });
        if (stmts.length) await this.executeSQLStatements(stmts);
      }

      if (tableName === "products") {
        const products = (window.getProducts?.() || []);
        const stmts = products.map((p) => {
          const key = p.itemCode;
          const updatedAt = this.getUpdatedAt(p);
          const payload = JSON.stringify(p);
          return `INSERT INTO pos_products (item_code, payload, updated_at)
                  VALUES (${this.sqlEscape(key)}, ${this.sqlEscape(payload)}, ${this.sqlEscape(updatedAt)})
                  ON CONFLICT(item_code) DO UPDATE SET
                    payload=excluded.payload,
                    updated_at=excluded.updated_at
                  WHERE excluded.updated_at > pos_products.updated_at`;
        });
        if (stmts.length) await this.executeSQLStatements(stmts);
      }

      if (tableName === "employees") {
        const employees = (window.getEmployees?.() || []);
        const stmts = employees.map((e) => {
          const key = e.salesCode;
          const updatedAt = this.getUpdatedAt(e);
          const payload = JSON.stringify(e);
          return `INSERT INTO pos_employees (sales_code, payload, updated_at)
                  VALUES (${this.sqlEscape(key)}, ${this.sqlEscape(payload)}, ${this.sqlEscape(updatedAt)})
                  ON CONFLICT(sales_code) DO UPDATE SET
                    payload=excluded.payload,
                    updated_at=excluded.updated_at
                  WHERE excluded.updated_at > pos_employees.updated_at`;
        });
        if (stmts.length) await this.executeSQLStatements(stmts);
      }
    }

    extractRows(result) {
      try {
        // Turso pipeline result shape can vary by release.
        const arr = result?.results || result?.response || [];
        const lastExec = Array.isArray(arr) ? arr.find((x) => x?.type !== "close") || arr[0] : null;
        return lastExec?.response?.result?.rows || lastExec?.result?.rows || [];
      } catch (_) {
        return [];
      }
    }

    async pullRemoteAndMerge() {
      const pullSales = await this.executeSQLSingle(`SELECT invoice_number, payload, updated_at FROM pos_sales`);
      const pullProducts = await this.executeSQLSingle(`SELECT item_code, payload, updated_at FROM pos_products`);
      const pullEmployees = await this.executeSQLSingle(`SELECT sales_code, payload, updated_at FROM pos_employees`);

      const salesRows = this.extractRows(pullSales);
      const productRows = this.extractRows(pullProducts);
      const employeeRows = this.extractRows(pullEmployees);

      this.mergeRowsIntoLocalSales(salesRows);
      this.mergeRowsIntoLocalProducts(productRows);
      this.mergeRowsIntoLocalEmployees(employeeRows);
    }

    parseRow(row) {
      // row usually array-form [col1, col2, col3]
      if (Array.isArray(row)) return row;
      return [];
    }

    mergeRowsIntoLocalSales(rows) {
      const local = window.getSales?.() || [];
      const byId = new Map(local.map((s) => [s.invoiceNumber, s]));
      rows.forEach((r) => {
        const [invoice, payload, updatedAt] = this.parseRow(r);
        if (!invoice || !payload) return;
        let remote;
        try { remote = JSON.parse(payload); } catch (_) { return; }
        const localRow = byId.get(invoice);
        const localTs = new Date(this.getUpdatedAt(localRow)).getTime();
        const remoteTs = new Date(updatedAt || this.getUpdatedAt(remote)).getTime();
        if (!localRow || remoteTs > localTs) {
          byId.set(invoice, { ...remote, updated_at: updatedAt || remote.updated_at || new Date().toISOString() });
        }
      });
      localStorage.setItem("sales", JSON.stringify(Array.from(byId.values())));
    }

    mergeRowsIntoLocalProducts(rows) {
      const local = window.getProducts?.() || [];
      const byId = new Map(local.map((p) => [p.itemCode, p]));
      rows.forEach((r) => {
        const [itemCode, payload, updatedAt] = this.parseRow(r);
        if (!itemCode || !payload) return;
        let remote;
        try { remote = JSON.parse(payload); } catch (_) { return; }
        const localRow = byId.get(itemCode);
        const localTs = new Date(this.getUpdatedAt(localRow)).getTime();
        const remoteTs = new Date(updatedAt || this.getUpdatedAt(remote)).getTime();
        if (!localRow || remoteTs > localTs) {
          byId.set(itemCode, { ...remote, updated_at: updatedAt || remote.updated_at || new Date().toISOString() });
        }
      });
      localStorage.setItem("products", JSON.stringify(Array.from(byId.values())));
    }

    mergeRowsIntoLocalEmployees(rows) {
      const local = window.getEmployees?.() || [];
      const byId = new Map(local.map((e) => [e.salesCode, e]));
      rows.forEach((r) => {
        const [salesCode, payload, updatedAt] = this.parseRow(r);
        if (!salesCode || !payload) return;
        let remote;
        try { remote = JSON.parse(payload); } catch (_) { return; }
        const localRow = byId.get(salesCode);
        const localTs = new Date(this.getUpdatedAt(localRow)).getTime();
        const remoteTs = new Date(updatedAt || this.getUpdatedAt(remote)).getTime();
        if (!localRow || remoteTs > localTs) {
          byId.set(salesCode, { ...remote, updated_at: updatedAt || remote.updated_at || new Date().toISOString() });
        }
      });
      localStorage.setItem("employees", JSON.stringify(Array.from(byId.values())));
    }

    async sync() {
      if (!this.enabled) return { success: false, error: "disabled" };
      if (!navigator.onLine) return { success: false, error: "offline" };
      if (this.syncing) return { success: false, error: "busy" };
      if (!this.isConnected) {
        const c = await this.connect();
        if (!c.success) return c;
      }

      this.syncing = true;
      this.setStatus("syncing");
      try {
        const pending = this.readPendingTables();
        const toPush = pending.length ? pending : ["sales", "products", "employees"];

        for (const t of toPush) {
          await this.pushLocalTable(t);
          this.clearPendingTable(t);
        }

        await this.pullRemoteAndMerge();
        localStorage.setItem(KEY_LAST_SYNC, new Date().toISOString());
        this.setStatus("synced");
        this.syncing = false;
        return { success: true };
      } catch (e) {
        this.setStatus("error");
        this.syncing = false;
        return { success: false, error: e.message };
      }
    }

    async enqueuePrintJob(receiptData, targetDevice = "server") {
      if (!this.enabled) throw new Error("Turso disabled");
      if (!this.isConnected) {
        const c = await this.connect();
        if (!c.success) throw new Error(c.error || "Turso connect failed");
      }
      const id = `pq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = new Date().toISOString();
      const sourceDevice = localStorage.getItem("pos_device_name") || localStorage.getItem("pos_invoice_prefix") || "INV";

      const sql = `INSERT INTO print_queue (id, source_device, target_device, invoice_number, receipt_data, status, created_at, updated_at)
                   VALUES (${this.sqlEscape(id)}, ${this.sqlEscape(sourceDevice)}, ${this.sqlEscape(targetDevice)},
                           ${this.sqlEscape(receiptData?.invoiceNumber || "")}, ${this.sqlEscape(JSON.stringify(receiptData))},
                           'pending', ${this.sqlEscape(createdAt)}, ${this.sqlEscape(createdAt)})`;
      await this.executeSQLSingle(sql);
      return { success: true, id };
    }

    async fetchPendingPrintJobs(targetDevice = "server") {
      if (!this.isConnected) {
        const c = await this.connect();
        if (!c.success) return [];
      }
      const sql = `SELECT id, receipt_data, status FROM print_queue
                   WHERE status='pending' AND (target_device=${this.sqlEscape(targetDevice)} OR target_device='server')
                   ORDER BY created_at ASC LIMIT 50`;
      const out = await this.executeSQLSingle(sql);
      return this.extractRows(out).map((r) => {
        const [id, receiptData, status] = this.parseRow(r);
        let parsed = null;
        try { parsed = JSON.parse(receiptData); } catch (_) { }
        return { id, receipt_data: parsed, status };
      });
    }

    async markPrintJobPrinted(id) {
      const ts = new Date().toISOString();
      const sql = `UPDATE print_queue SET status='printed', printed_at=${this.sqlEscape(ts)}, updated_at=${this.sqlEscape(ts)}
                   WHERE id=${this.sqlEscape(id)}`;
      await this.executeSQLSingle(sql);
    }
  }

  window.TursoSyncService = new TursoSyncService();

  document.addEventListener("DOMContentLoaded", async () => {
    window.TursoSyncService.loadConfig();
    if (window.TursoSyncService.enabled && navigator.onLine) {
      await window.TursoSyncService.connect();
      await window.TursoSyncService.sync();
    }
  });

  window.addEventListener("online", () => {
    if (window.TursoSyncService.enabled) window.TursoSyncService.sync().catch(() => { });
  });
})();

