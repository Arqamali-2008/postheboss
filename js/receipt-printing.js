// ============================================================
// Receipt Rendering (Normal / QR / Barcode)
// ============================================================
// Builds thermal 80mm receipts from either:
// - existing "sale" objects in your app, or
// - compact "invoice core" JSON used for QR/share.

(function () {
  // #region agent log helpers
  function __dbg(hypothesisId, location, message, data) {
    try {
      const payload = {
        sessionId: '7bec1d',
        runId: 'pre-fix',
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now()
      };
      const body = JSON.stringify(payload);
      const url = 'http://127.0.0.1:7929/ingest/84521e1c-be37-4945-8616-6e9d7af141d9';

      // sendBeacon is more reliable during print/unload
      if (navigator.sendBeacon) {
        try {
          const ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
          if (ok) return;
        } catch (_) { }
      }

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7bec1d' },
        body
      }).catch(() => { });
    } catch (_) { }
  }
  // #endregion

  function ensureReceiptPrintSection() {
    let receiptDiv = document.getElementById("receiptPrint");
    if (!receiptDiv) {
      receiptDiv = document.createElement("div");
      receiptDiv.id = "receiptPrint";
      receiptDiv.className = "thermal-receipt print-section";
      receiptDiv.style.display = "none";
      document.body.appendChild(receiptDiv);
    }
    return receiptDiv;
  }

  function injectThermalPrintStyle() {
    const s = typeof window.getSettings === "function" ? window.getSettings() : {};
    const paperWidthMm = Math.max(58, Math.min(90, parseInt(s.receiptPaperWidthMm ?? 80, 10) || 80));
    const contentWidthMm = Math.max(48, Math.min(84, parseInt(s.receiptContentWidthMm ?? 72, 10) || 72));
    const paddingMm = Math.max(0, Math.min(10, parseInt(s.receiptPaddingMm ?? 4, 10) || 4));

    // Avoid stacking duplicate styles.
    const existing = document.getElementById("receiptPageStyle");
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = "receiptPageStyle";
    style.media = "print";
    style.textContent = `
      @page { 
        size: ${paperWidthMm}mm auto;
        margin: 0; 
      }
      @media print {
        body * { visibility: hidden; }
        .print-section,
        .print-section * { visibility: visible; }
        .print-section {
          position: absolute;
          left: 0; top: 0;
          width: ${contentWidthMm}mm;
          margin: 0;
          padding: ${paddingMm}mm;
          background: #fff !important;
          color: #000 !important;
        }
      }
    `;
    document.head.appendChild(style);

    __dbg('H1', 'js/receipt-printing.js:injectThermalPrintStyle', 'Injected print style', {
      styleId: style.id,
      hasExisting: !!existing
    });
  }

  function fmtCurrency(amount) {
    if (typeof window.formatCurrency === "function") return window.formatCurrency(amount);
    const value = Number.isFinite(Number(amount)) ? Number(amount).toFixed(2) : "0.00";
    return `LKR ${value}`;
  }

  function fmtDiscount(amount) {
    const n = Number(amount || 0);
    if (n > 0) return `- ${fmtCurrency(n)}`;
    return fmtCurrency(0);
  }

  function fmtDateTime(dateInput) {
    if (typeof window.formatDateTime === "function") return window.formatDateTime(dateInput);
    return new Date(dateInput || Date.now()).toISOString();
  }

  function normalReceiptHTMLFromSale(sale) {
    const settings = typeof window.getSettings === "function" ? window.getSettings() : {};
    const items = Array.isArray(sale.items) ? sale.items : [];

    __dbg('H2', 'js/receipt-printing.js:normalReceiptHTMLFromSale', 'Build receipt HTML from sale', {
      invoiceNumber: sale?.invoiceNumber,
      subtotal: sale?.subtotal,
      discount: sale?.discount,
      total: sale?.total,
      paidAmount: sale?.paidAmount,
      balance: sale?.balance,
      itemsCount: items.length,
      settings: {
        storeName: settings?.storeName,
        storeAddress: settings?.storeAddress,
        storeContact: settings?.storeContact,
        storeWebsite: settings?.storeWebsite,
        receiptHeader: settings?.receiptHeader
      }
    });

    let totalSavings = 0;
    let itemsHtml = "";
    items.forEach((item) => {
      const qty = Number(item.qty ?? 0);
      const discTotal = Number(item.discount ?? 0) * qty;
      totalSavings += Math.max(0, discTotal);
      itemsHtml += `
        <div class="receipt-item" style="display: block; margin-bottom: 4px;">
          <div style="font-weight: 600; text-transform: uppercase;">${escapeHtml(item.name || item.code || "")}</div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <div>${qty} x ${fmtCurrency(item.price ?? 0)}</div>
            <div>${fmtCurrency(item.total ?? 0)}</div>
          </div>
        </div>
      `;
    });

    totalSavings += Number(sale.discount ?? 0) || 0;

    const savingsContainer = totalSavings > 0
      ? `<div id="printSavingsContainer" class="text-center" style="margin-top: 10px; font-weight: 700; border: 1px dashed #000; padding: 5px; display: block;">
           <span>YOU ARE SAVING: </span><span id="printSavingsAmount">${fmtCurrency(totalSavings)}</span>
         </div>`
      : `<div id="printSavingsContainer" class="text-center" style="margin-top: 10px; font-weight: 700; border: 1px dashed #000; padding: 5px; display: none;">
           <span>YOU ARE SAVING: </span><span id="printSavingsAmount">${fmtCurrency(0)}</span>
         </div>`;

    const logoMaxPx = Math.max(60, Math.min(220, parseInt(settings.receiptLogoMaxPx ?? 120, 10) || 120));
    const logoBase64 = localStorage.getItem("pos_logo");
    const logoHtml = logoBase64
      ? `<img id="printLogo" src="${logoBase64}" style="max-width: ${logoMaxPx}px; max-height: ${logoMaxPx}px; display: block; margin: 0 auto 10px;">`
      : `<div id="printLogoSpacer" style="height: 10px;"></div>`;

    return `
      <div class="receipt-header" style="text-align: center;">
        ${logoHtml}
        <div id="printStoreName" class="receipt-store-line">${escapeHtml(settings.storeName || "AMi STORE")}</div>
        <div id="printStoreDetails" class="receipt-subline">
          ${[
            settings.storeAddress ? escapeHtml(settings.storeAddress) : "",
            settings.storeContact ? escapeHtml(settings.storeContact) : "",
            settings.receiptHeader ? escapeHtml(settings.receiptHeader) : ""
          ].filter(Boolean).join("<br>")}
        </div>
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-info">
        <div style="display: flex; justify-content: space-between;"><span>Invoice:</span><span>${escapeHtml(sale.invoiceNumber || "")}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Date:</span><span>${escapeHtml(fmtDateTime(sale.date || Date.now()))}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Sales Code:</span><span>${escapeHtml(sale.salesCode || "")}</span></div>
      </div>

      <div class="receipt-divider"></div>

      <div id="printItems" class="receipt-items">${itemsHtml}</div>

      <div class="receipt-divider"></div>

      <div class="receipt-summary">
        <div class="receipt-summary-row"><span>Subtotal:</span><span>${fmtCurrency(sale.subtotal ?? 0)}</span></div>
        <div class="receipt-summary-row receipt-discount-row"><span>Discount:</span><span>${fmtDiscount(sale.discount ?? 0)}</span></div>
        <div class="receipt-total"><span>TOTAL:</span><span>${fmtCurrency(sale.total ?? 0)}</span></div>
        <div class="receipt-divider"></div>
        <div class="receipt-summary-row" style="display:flex; justify-content: space-between;">
          <span>Payment : ${(sale.paymentType || "cash").toString().toUpperCase()} :</span>
          <span>${fmtCurrency(sale.paidAmount ?? 0)}</span>
        </div>
        <div class="receipt-summary-row" style="display:flex; justify-content: space-between;">
          <span>Balance:</span><span>${fmtCurrency(sale.balance ?? 0)}</span>
        </div>
      </div>

      ${savingsContainer}

      <div class="receipt-footer">
        <div id="printFooterMessage">${escapeHtml(settings.thanksMessage || "Thank you for shopping with us!")}</div>
        <div class="dev-credit" style="font-size: 10px; margin-top: 4px;">Designed and Devolped By AMi</div>
      </div>
    `;
  }

  function qrReceiptHTMLFromSale(sale) {
    const invoiceCore = sale.invoiceCore || (window.InvoiceCore?.buildEssentialInvoiceCoreFromSale ? window.InvoiceCore.buildEssentialInvoiceCoreFromSale(sale) : null);
    if (!invoiceCore) throw new Error("Missing invoiceCore for QR receipt");

    const essentialCore = window.InvoiceCore.compactInvoiceCoreForQR(invoiceCore);
    const payload = JSON.stringify(essentialCore);

    // QR placeholder. qrcode.js will render into the div.
    return `
      <div class="receipt-header" style="text-align: center;">
        <div class="receipt-store-line">${escapeHtml((window.getSettings?.().storeName) || "AMi STORE")}</div>
        <div class="receipt-subline">Scan to reprint / sync (mobile optimized)</div>
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-info">
        <div style="display: flex; justify-content: space-between;"><span>Invoice:</span><span>${escapeHtml(sale.invoiceNumber || "")}</span></div>
      </div>
      <div class="receipt-divider"></div>

      <div style="display:flex; justify-content:center; margin: 8px 0;">
        <div id="receiptQR"></div>
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-summary">
        <div class="receipt-summary-row"><span>Total:</span><span>${fmtCurrency(sale.total ?? 0)}</span></div>
        <div class="receipt-summary-row"><span>Paid:</span><span>${fmtCurrency(sale.paidAmount ?? 0)}</span></div>
        <div class="receipt-summary-row"><span>Balance:</span><span>${fmtCurrency(sale.balance ?? 0)}</span></div>
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-footer">
        <div id="printFooterMessage">${escapeHtml(window.getSettings?.().thanksMessage || "Thank you!")}</div>
      </div>
    `;
  }

  function barcodeReceiptHTMLFromSale(sale) {
    const invoiceCore = sale.invoiceCore || (window.InvoiceCore?.buildEssentialInvoiceCoreFromSale ? window.InvoiceCore.buildEssentialInvoiceCoreFromSale(sale) : null);
    if (!invoiceCore) throw new Error("Missing invoiceCore for Barcode receipt");

    const barcodeValue = window.InvoiceCore.buildCompactInvoiceBarcodeValue(invoiceCore) || sale.invoiceNumber;

    return `
      <div class="receipt-header" style="text-align: center;">
        <div class="receipt-store-line">${escapeHtml((window.getSettings?.().storeName) || "AMi STORE")}</div>
        <div class="receipt-subline">Scan barcode to print</div>
      </div>
      <div class="receipt-divider"></div>
      <div style="text-align:center; margin: 6px 0;">
        <div style="font-weight: 700;">${escapeHtml(sale.invoiceNumber || "")}</div>
      </div>
      <div style="display:flex; justify-content:center; margin: 8px 0;">
        <svg id="receiptBarcode" width="220" height="60"></svg>
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-summary">
        <div class="receipt-summary-row"><span>Total:</span><span>${fmtCurrency(sale.total ?? 0)}</span></div>
        <div class="receipt-summary-row"><span>Paid:</span><span>${fmtCurrency(sale.paidAmount ?? 0)}</span></div>
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-footer">
        <div id="printFooterMessage">${escapeHtml(window.getSettings?.().thanksMessage || "Thank you!")}</div>
      </div>
    `;
  }

  function escapeHtml(str) {
    return (str ?? "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function renderQRIntoReceiptDiv(payload, qrHostEl) {
    if (!window.QRCode) throw new Error("qrcode.js not loaded");

    // Clear previous QR.
    qrHostEl.innerHTML = "";

    // Larger QR with lower correction level scans more reliably on phones.
    const width = 220;
    const qr = new window.QRCode(qrHostEl, {
      text: payload,
      width,
      height: width,
      correctLevel: window.QRCode.CorrectLevel.L,
      colorDark: "#000000",
      colorLight: "#ffffff"
    });
    // Give the QR library a moment to finish drawing into the DOM.
    // Without this, `window.print()` can capture an incomplete QR.
    await new Promise(resolve => setTimeout(resolve, 60));
    return qr;
  }

  function buildBestEffortQRPayload(invoiceCore) {
    const essentialCore = window.InvoiceCore.compactInvoiceCoreForQR(invoiceCore);
    const jsonPayload = JSON.stringify(essentialCore);
    // Mobile scanners struggle when payload is too dense.
    // Use invoice ID fallback for large payloads.
    const maxLen = 420;
    if (jsonPayload.length <= maxLen) {
      return { text: jsonPayload, mode: "full" };
    }
    return { text: (essentialCore.n || "").toString(), mode: "invoiceId" };
  }

  function renderBarcodeIntoReceiptDiv(barcodeValue, targetScope = document) {
    if (!window.JsBarcode) throw new Error("JsBarcode not loaded");

    const svg = typeof targetScope.querySelector === "function"
      ? targetScope.querySelector("#receiptBarcode")
      : document.getElementById("receiptBarcode");
    if (!svg) return;

    // Reset inner content for repeated prints.
    svg.innerHTML = "";

    window.JsBarcode(svg, barcodeValue, {
      format: "CODE128",
      displayValue: false,
      width: 2,
      height: 55,
      margin: 0,
      marginBottom: 0,
      fontSize: 10
    });
  }

  function openReceiptPreviewWindow(title, html, afterRender) {
    let panel = document.getElementById("receiptPreviewPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "receiptPreviewPanel";
      panel.style.cssText = [
        "position:fixed",
        "right:18px",
        "bottom:18px",
        "width:320px",
        "max-height:70vh",
        "background:#0b0b0b",
        "border:1px solid rgba(0,255,136,0.45)",
        "border-radius:10px",
        "box-shadow:0 8px 28px rgba(0,0,0,0.45)",
        "z-index:99999",
        "display:none",
        "overflow:hidden"
      ].join(";");

      panel.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid rgba(0,255,136,0.35);background:#101010;color:#eafff2;font-size:12px;font-weight:700;">
          <span id="receiptPreviewTitle">Receipt Preview</span>
          <button id="receiptPreviewClose" type="button" style="border:none;background:#1f1f1f;color:#fff;padding:4px 8px;border-radius:6px;cursor:pointer;">Close</button>
        </div>
        <div id="receiptPreviewBody" style="padding:10px;overflow:auto;max-height:calc(70vh - 42px);background:#efefef;"></div>
      `;

      document.body.appendChild(panel);
      const closeBtn = document.getElementById("receiptPreviewClose");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          panel.style.display = "none";
        });
      }
    }

    const titleEl = document.getElementById("receiptPreviewTitle");
    const body = document.getElementById("receiptPreviewBody");
    if (!body) return;

    if (titleEl) titleEl.textContent = title || "Receipt Preview";
    body.innerHTML = `<div id="previewReceipt" class="thermal-receipt" style="width:80mm;margin:0 auto;padding:5mm;background:#fff;color:#000;border:none;box-shadow:0 0 8px rgba(0,0,0,0.18);">${html}</div>`;

    panel.style.display = "block";
    const previewRoot = body.querySelector("#previewReceipt");

    setTimeout(async () => {
      try {
        if (!afterRender) return;
        await afterRender(previewRoot || document);
      } catch (_) { }
    }, 0);
  }

  function showReceiptAndPrint(html, afterRender, shouldPrint = true) {
    const receiptDiv = ensureReceiptPrintSection();
    injectThermalPrintStyle();
    receiptDiv.innerHTML = html;
    receiptDiv.style.display = "block";
    receiptDiv.classList.add("print-section");
    // Ensure the user can actually see the preview on the POS screen.
    try {
      receiptDiv.scrollIntoView({ block: "center", behavior: "auto" });
    } catch (_) {
      // scrollIntoView options not supported; ignore.
      receiptDiv.scrollIntoView();
    }

    // Capture computed style evidence (border/font color issues).
    try {
      const cs = window.getComputedStyle(receiptDiv);
      __dbg('H3', 'js/receipt-printing.js:showReceiptAndPrint', 'Receipt DOM ready', {
        border: cs.border,
        borderColor: cs.borderColor,
        boxShadow: cs.boxShadow,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        theme: document.documentElement?.getAttribute('data-theme') || null,
        storeNameText: document.getElementById('printStoreName')?.textContent || null,
        storeDetailsHtml: document.getElementById('printStoreDetails')?.innerHTML || null,
        discountLineText: receiptDiv.querySelector('.receipt-summary-row:nth-child(2) span:last-child')?.textContent || null
      });
    } catch (_) { }

    // Optionally render QR/barcode before print.
    const doPrint = async () => {
      try {
        if (afterRender) await afterRender();
        // Wait for a couple paint cycles so QR/barcode drawings are visible
        // before the print dialog opens.
        await new Promise(resolve => {
          const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
          raf(() => raf(resolve));
        });
      } finally {
        if (!shouldPrint) {
          // Preview-only mode: keep receipt visible, do not open print dialog.
          return;
        }
        // Give the cashier time to see the preview before printing.
        const previewDelayMs = Math.min(
          Math.max(parseInt(localStorage.getItem("receipt_preview_delay_ms") || "700", 10), 0),
          3000
        );
        setTimeout(() => {
          __dbg('H4', 'js/receipt-printing.js:showReceiptAndPrint', 'Calling window.print()', {
            visible: receiptDiv.style.display,
            hasPrintSectionClass: receiptDiv.classList.contains('print-section')
          });
          window.print();
          setTimeout(() => {
            receiptDiv.style.display = "none";
            receiptDiv.classList.remove("print-section");
          }, 150);
        }, previewDelayMs);
      }
    };

    doPrint();
  }

  // Public API
  function printSaleNormalReceipt(sale) {
    __dbg('H2', 'js/receipt-printing.js:printSaleNormalReceipt', 'printSaleNormalReceipt called', {
      invoiceNumber: sale?.invoiceNumber,
      discount: sale?.discount,
      subtotal: sale?.subtotal,
      total: sale?.total
    });
    const html = normalReceiptHTMLFromSale(sale);
    showReceiptAndPrint(html);
  }

  function printSaleQRReceipt(sale) {
    const invoiceCore = sale.invoiceCore || window.InvoiceCore?.buildEssentialInvoiceCoreFromSale?.(sale);
    if (!invoiceCore) throw new Error("Missing invoiceCore for QR receipt");
    const payloadInfo = buildBestEffortQRPayload(invoiceCore);
    const payload = payloadInfo.text;

    const html = qrReceiptHTMLFromSale(sale);
    // QR mode: preview in a separate window.
    openReceiptPreviewWindow("QR Receipt Preview", html, async (targetScope = document) => {
      const host = typeof targetScope.querySelector === "function"
        ? targetScope.querySelector("#receiptQR")
        : document.getElementById("receiptQR");
      if (!host) return;
      await renderQRIntoReceiptDiv(payload, host);
      const subline = typeof targetScope.querySelector === "function"
        ? targetScope.querySelector(".receipt-subline")
        : null;
      if (subline && payloadInfo.mode === "invoiceId") {
        subline.textContent = "Large bill: QR contains invoice ID for better mobile scan";
      }
    });
  }

  function printSaleBarcodeReceipt(sale) {
    const html = barcodeReceiptHTMLFromSale(sale);
    // Barcode mode: preview in a separate window.
    openReceiptPreviewWindow("Barcode Receipt Preview", html, async (targetScope = document) => {
      const invoiceCore = sale.invoiceCore || window.InvoiceCore?.buildEssentialInvoiceCoreFromSale?.(sale);
      const barcodeValue = window.InvoiceCore.buildCompactInvoiceBarcodeValue(invoiceCore) || sale.invoiceNumber;
      renderBarcodeIntoReceiptDiv(barcodeValue, targetScope);
    });
  }

  // Expose globally for index.html button handlers.
  window.ReceiptPrinting = {
    printSaleNormalReceipt,
    printSaleQRReceipt,
    printSaleBarcodeReceipt,
    ensureReceiptPrintSection
  };
})();

