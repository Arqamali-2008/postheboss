// ============================================================
// Universal Scanner System
// ============================================================
// Single text input receives keystrokes from:
// - keyboard wedge barcode scanners
// - manual entry
// - (optional) webcam QR scanning (fills the same input)
//
// On ENTER:
// - detect JSON (invoice core / backup chunk) vs Invoice ID
// - show modal actions

(function () {
  const STORE_APPLIED_INVOICE_IDS = "applied_invoice_ids";
  const STORE_APPLIED_INVOICE_IDS_TS = "applied_invoice_ids_ts";

  let pendingScan = null;
  let lastProcessMs = 0;

  function ensureAppliedInvoiceIndexSeeded() {
    try {
      const applied = readAppliedInvoiceIds();
      const sales = typeof window.getSales === "function" ? window.getSales() : [];
      let changed = false;
      sales.forEach((s) => {
        const n = s.invoiceNumber;
        if (n && !applied.has(n)) {
          applied.add(n);
          changed = true;
        }
      });
      if (changed) writeAppliedInvoiceIds(applied);
    } catch (_) {
      // Non-fatal.
    }
  }

  function readAppliedInvoiceIds() {
    const raw = localStorage.getItem(STORE_APPLIED_INVOICE_IDS);
    if (!raw) return new Set();
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    } catch (_) {}
    return new Set();
  }

  function writeAppliedInvoiceIds(set) {
    localStorage.setItem(STORE_APPLIED_INVOICE_IDS, JSON.stringify(Array.from(set)));
    localStorage.setItem(STORE_APPLIED_INVOICE_IDS_TS, new Date().toISOString());
  }

  function getUniversalScannerInput() {
    return document.getElementById("universalScannerInput");
  }

  function getScanActionsModal() {
    let modal = document.getElementById("scanActionsModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "scanActionsModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <h2 class="modal-title">Scan Result</h2>
          <button class="modal-close" onclick="window.closeScanActionsModal?.()">&times;</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 10px; color: var(--text-secondary);" id="scanActionSubTitle"></div>
          <div style="margin-bottom: 15px; font-size: 0.95em;">
            <div><strong>Invoice:</strong> <span id="scanActionInvoice"></span></div>
            <div><strong>Type:</strong> <span id="scanActionType"></span></div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;">
            <button class="btn btn-warning btn-lg" id="scanBtnPrint" onclick="window.scanBtnPrintHandler?.()">🧾 Print Receipt</button>
            <button class="btn btn-primary btn-lg" id="scanBtnAdd" onclick="window.scanBtnAddHandler?.()">➕ Add Sale</button>
            <button class="btn btn-success btn-lg" id="scanBtnBoth" onclick="window.scanBtnBothHandler?.()">✅ Both</button>
            <button class="btn btn-secondary btn-lg" onclick="window.closeScanActionsModal?.()">Cancel</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    window.closeScanActionsModal = closeScanActionsModal;
    window.scanBtnPrintHandler = scanBtnPrintHandler;
    window.scanBtnAddHandler = scanBtnAddHandler;
    window.scanBtnBothHandler = scanBtnBothHandler;
    return modal;
  }

  function closeScanActionsModal() {
    const modal = document.getElementById("scanActionsModal");
    if (modal) modal.classList.remove("active");
    pendingScan = null;
  }

  function showScanActionsModal({ invoiceNumber, invoiceType, subtitle }) {
    const modal = getScanActionsModal();
    const sub = document.getElementById("scanActionSubTitle");
    const inv = document.getElementById("scanActionInvoice");
    const type = document.getElementById("scanActionType");

    if (sub) sub.textContent = subtitle || "";
    if (inv) inv.textContent = invoiceNumber || "-";
    if (type) type.textContent = invoiceType || "-";

    modal.classList.add("active");
    return modal;
  }

  function looksLikeInvoiceId(raw) {
    // Examples: INV-0040, SD1-INV-0040, SD2-INV-000123
    const s = (raw || "").trim().toUpperCase();
    if (!s) return false;
    if (/^INV-\d+$/.test(s)) return true;
    if (/^SD\d+-INV-\d+$/.test(s)) return true;
    return false;
  }

  function parsePotentialJSON(raw) {
    const trimmed = (raw || "").trim();
    if (!trimmed.startsWith("{")) return null;
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return null;
    }
  }

  function detectPayload(raw) {
    const json = parsePotentialJSON(raw);
    if (json && typeof json === "object") {
      // Invoice core
      if (window.InvoiceCore?.isInvoiceCoreObject?.(json)) {
        return { kind: "invoiceCore", core: json };
      }

      // Backup chunk route (if module exists)
      if (json.t && json.t.startsWith("bk")) {
        return { kind: "backupChunk", chunk: json };
      }

      // Might be an essential QR receipt core wrapper
      // Try: if has {invoice:{...}} etc (best-effort)
      if (json.invoiceCore && window.InvoiceCore?.isInvoiceCoreObject?.(json.invoiceCore)) {
        return { kind: "invoiceCore", core: json.invoiceCore };
      }
    }

    // Invoice ID
    const s = (raw || "").trim().toUpperCase();
    if (looksLikeInvoiceId(s)) return { kind: "invoiceId", invoiceId: s };
    return { kind: "unknown" };
  }

  function triggerUniversalScanner(value, autoEnter = true) {
    const input = getUniversalScannerInput();
    if (!input) return;
    input.value = value;
    if (autoEnter) {
      // Run handler directly (faster + avoids global handlers).
      handleUniversalScannerValue(value);
    }
  }

  function showAlert(msg) {
    // Reuse app alerts pattern.
    alert(msg);
  }

  function buildSaleForPrintingFromInvoiceCore(core) {
    // Uses InvoiceCore module which also computes profit based on local product data.
    return window.InvoiceCore.buildSaleFromInvoiceCore(core);
  }

  function restoreProductStock(itemCode, qty) {
    // Inventory restoration for returns.
    const products = typeof window.getProducts === "function" ? window.getProducts() : [];
    const idx = products.findIndex((p) => p.itemCode === itemCode);
    if (idx < 0) return;
    const before = Number(products[idx].stock ?? 0);
    products[idx].stock = before + qty;
    localStorage.setItem("products", JSON.stringify(products));
  }

  function applyInvoiceCoreToSystem(core, opts = {}) {
    // Idempotency:
    // - if invoice already in sales list => skip everything
    // - also guard stock via appliedInvoiceIds index
    if (!window.InvoiceCore?.isInvoiceCoreObject?.(core)) throw new Error("Invalid invoice core");

    const invoiceNumber = core.n;
    if (!invoiceNumber) throw new Error("Missing invoiceNumber");

    const sales = typeof window.getSales === "function" ? window.getSales() : [];
    if (sales.some((s) => s.invoiceNumber === invoiceNumber)) {
      return { applied: false, duplicate: true, invoiceNumber };
    }

    const applied = readAppliedInvoiceIds();
    if (applied.has(invoiceNumber)) {
      // Inventory should already have been applied; still avoid re-inserting.
      return { applied: false, duplicate: true, invoiceNumber };
    }

    const sale = buildSaleForPrintingFromInvoiceCore(core);
    if (opts.updatedAt) sale.updated_at = opts.updatedAt;

    // Update inventory
    const isReturn = core.t === window.InvoiceCore.INVOICE_CORE_TYPE_RETURN;
    const items = Array.isArray(sale.items) ? sale.items : [];

    items.forEach((item) => {
      const qty = Number(item.qty ?? 0);
      if (!qty) return;
      if (isReturn) {
        restoreProductStock(item.code, qty);
      } else {
        // Existing function reduces stock only.
        if (typeof window.updateProductStock === "function") {
          window.updateProductStock(item.code, qty);
        }
      }
    });

    // Save sales history (your existing data model).
    if (typeof window.saveSale === "function") {
      window.saveSale(sale);
    } else {
      // Fallback: direct localStorage insert
      const existing = typeof window.getSales === "function" ? window.getSales() : [];
      existing.push(sale);
      localStorage.setItem("sales", JSON.stringify(existing));
    }

    applied.add(invoiceNumber);
    writeAppliedInvoiceIds(applied);

    // Optional: if Turso sync exists, queue changes.
    if (window.TursoSyncService?.queueLocalMutation) {
      // Queue sale first; product stock updates are already in products table.
      window.TursoSyncService.queueLocalMutation?.("sales", sale);
      window.TursoSyncService.queueLocalMutation?.("products", null);
    }

    return { applied: true, duplicate: false, invoiceNumber };
  }

  // Button handlers (global callbacks for inline onclick).
  function scanBtnPrintHandler() {
    if (!pendingScan) return;
    try {
      if (pendingScan.kind === "invoiceCore") {
        const sale = buildSaleForPrintingFromInvoiceCore(pendingScan.core);
        window.ReceiptPrinting?.printSaleNormalReceipt?.(sale);
        closeScanActionsModal();
        return;
      }
      if (pendingScan.kind === "invoiceId") {
        const sale = (window.getSales?.() || []).find((s) => s.invoiceNumber === pendingScan.invoiceId);
        if (!sale) throw new Error("Invoice not found in local sales");
        window.ReceiptPrinting?.printSaleNormalReceipt?.(sale);
        closeScanActionsModal();
        return;
      }
    } catch (e) {
      showAlert("Print failed: " + e.message);
    }
    closeScanActionsModal();
  }

  function scanBtnAddHandler() {
    if (!pendingScan) return;
    try {
      if (pendingScan.kind === "invoiceCore") {
        applyInvoiceCoreToSystem(pendingScan.core);
        closeScanActionsModal();
        return;
      }
      if (pendingScan.kind === "invoiceId") {
        // "Add Sale" with invoiceId is redundant if it already exists.
        // We'll just no-op if duplicate.
        closeScanActionsModal();
        return;
      }
    } catch (e) {
      showAlert("Add sale failed: " + e.message);
    }
    closeScanActionsModal();
  }

  function scanBtnBothHandler() {
    if (!pendingScan) return;
    try {
      if (pendingScan.kind === "invoiceCore") {
        applyInvoiceCoreToSystem(pendingScan.core);
        const sale = buildSaleForPrintingFromInvoiceCore(pendingScan.core);
        window.ReceiptPrinting?.printSaleNormalReceipt?.(sale);
        closeScanActionsModal();
        return;
      }
      if (pendingScan.kind === "invoiceId") {
        const sale = (window.getSales?.() || []).find((s) => s.invoiceNumber === pendingScan.invoiceId);
        if (sale) window.ReceiptPrinting?.printSaleNormalReceipt?.(sale);
        closeScanActionsModal();
        return;
      }
    } catch (e) {
      showAlert("Operation failed: " + e.message);
    }
    closeScanActionsModal();
  }

  function handleInvoiceCoreScan(core) {
    pendingScan = { kind: "invoiceCore", core };
    const invoiceNumber = core.n;
    const invoiceType = core.t;
    showScanActionsModal({
      invoiceNumber,
      invoiceType,
      subtitle: "JSON detected. Choose: Print / Add Sale / Both."
    });
  }

  function handleInvoiceIdScan(invoiceId) {
    pendingScan = { kind: "invoiceId", invoiceId };
    const sale = (window.getSales?.() || []).find((s) => s.invoiceNumber === invoiceId);
    showScanActionsModal({
      invoiceNumber: invoiceId,
      invoiceType: sale?.invoiceType || "invoice",
      subtitle: sale ? "Invoice found in local sales. Choose an action." : "Invoice not found locally yet."
    });
  }

  function handleBackupChunkScan(chunk) {
    // If backup chunk importer exists, route it.
    if (window.QRBackupImporter?.importChunk) {
      window.QRBackupImporter.importChunk(chunk);
    } else {
      showAlert("Backup chunk scanned, but importer is not loaded.");
    }
  }

  function handleUniversalScannerValue(rawValue) {
    const now = Date.now();
    if (now - lastProcessMs < 350) return; // avoid double-triggering on some scanners
    lastProcessMs = now;

    const payload = detectPayload(rawValue);
    if (payload.kind === "invoiceCore") return handleInvoiceCoreScan(payload.core);
    if (payload.kind === "invoiceId") return handleInvoiceIdScan(payload.invoiceId);
    if (payload.kind === "backupChunk") return handleBackupChunkScan(payload.chunk);

    showAlert("Unrecognized scan. Scan an invoice JSON or invoice ID.");
  }

  function onScannerInputKeyDownCapture(event) {
    const input = getUniversalScannerInput();
    if (!input) return;
    if (event.target !== input) return;
    if (event.key !== "Enter") return;

    event.preventDefault();
    event.stopPropagation();

    const val = (input.value || "").trim();
    if (!val) return;
    input.blur();

    // Run handler and clear input for next scan.
    handleUniversalScannerValue(val);
    input.value = "";
  }

  async function startWebcamScanner() {
    const input = getUniversalScannerInput();
    if (!input) return;

    // Prefer BarcodeDetector when available.
    const Detector = window.BarcodeDetector;
    if (!Detector) {
      showAlert("Webcam QR scanning not supported (BarcodeDetector missing in this browser).");
      return;
    }

    let video = document.getElementById("universalScannerVideo");
    if (!video) {
      video = document.createElement("video");
      video.id = "universalScannerVideo";
      video.autoplay = true;
      video.playsInline = true;
      video.style.cssText = `
        position: fixed; left: -99999px; top: -99999px;
        width: 1px; height: 1px; opacity: 0;
      `;
      document.body.appendChild(video);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      video.srcObject = stream;

      const detector = new Detector({ formats: ["qr_code", "code_128"] });

      const loop = async () => {
        if (!video.srcObject) return;
        const results = await detector.detect(video).catch(() => []);
        if (results && results.length > 0) {
          const value = results[0]?.rawValue;
          if (value) {
            // Stop camera
            const tracks = stream.getTracks();
            tracks.forEach((t) => t.stop());
            video.srcObject = null;

            // Fill input and handle.
            input.value = value;
            input.blur();
            handleUniversalScannerValue(value);
            input.value = "";
            return;
          }
        }
        setTimeout(loop, 250);
      };

      loop();
    } catch (e) {
      showAlert("Camera scan failed: " + e.message);
    }
  }

  function initUniversalScanner() {
    ensureAppliedInvoiceIndexSeeded();

    const input = getUniversalScannerInput();
    if (!input) return;

    // Capture phase to beat global Enter-to-focus logic in script.js.
    document.addEventListener("keydown", onScannerInputKeyDownCapture, true);

    // Focus input on load for scanner speed.
    setTimeout(() => {
      try {
        input.focus();
        input.select?.();
      } catch (_) {}
    }, 100);

    // Optional: attach camera start button.
    const camBtn = document.getElementById("universalCameraBtn");
    if (camBtn && !camBtn.dataset.bound) {
      camBtn.dataset.bound = "true";
      camBtn.addEventListener("click", () => startWebcamScanner());
    }
  }

  window.UniversalScanner = {
    initUniversalScanner,
    handleUniversalScannerValue
  };

  // Export for sync/backup modules.
  window.InvoiceCoreApply = {
    applyInvoiceCoreToSystem
  };

  // Auto-init if module is loaded after DOM ready.
  document.addEventListener("DOMContentLoaded", () => {
    initUniversalScanner();
  });
})();

