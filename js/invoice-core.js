// ============================================================
// Invoice JSON Core Utilities
// ============================================================
// This module defines the compact invoice JSON format used for:
// - QR receipts (essential payload only)
// - Barcode receipts (invoice id / compact id)
// - Universal scanner (JSON scan vs Invoice ID scan)
//
// Required compact structure (minimal):
// {
//   "t":"bp",
//   "n":"SD1-INV-0040",
//   "d":"2026-03-27T05:37:58.392Z",
//   "s":"EMP-02",
//   "l":[["ITM-001",1,195,45]],
//   "ttl":150,
//   "pd":150,
//   "bal":0,
//   "pt":""
// }
//
// Note:
// - "l" discount is per-unit discount amount (not percent).
// - "ttl" is the final total after item-level discounts.

(function () {
  const INVOICE_CORE_TYPE_SALE = "bp";
  const INVOICE_CORE_TYPE_RETURN = "rt";

  function toNumberOrZero(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function djb2Hash(str) {
    // Simple non-crypto hash to shorten barcode payloads.
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
    }
    return hash >>> 0;
  }

  function buildEssentialInvoiceCoreFromSale(sale) {
    if (!sale) throw new Error("Missing sale for invoice core build");
    const items = Array.isArray(sale.items) ? sale.items : [];

    const l = items.map((it) => {
      const code = (it.code || it.itemCode || "").toString();
      const qty = toNumberOrZero(it.qty ?? it.quantity ?? 0);
      const price = toNumberOrZero(it.price ?? it.unit_price ?? 0);
      const discount = toNumberOrZero(it.discount ?? it.unitDiscount ?? 0);
      return [code, qty, price, discount];
    });

    return {
      t: sale.invoiceType || INVOICE_CORE_TYPE_SALE,
      n: sale.invoiceNumber || sale.n,
      d: sale.date ? new Date(sale.date).toISOString() : new Date().toISOString(),
      s: sale.salesCode || sale.s || "",
      l,
      ttl: toNumberOrZero(sale.total ?? sale.ttl ?? 0),
      pd: toNumberOrZero(sale.paidAmount ?? sale.pd ?? 0),
      bal: toNumberOrZero(sale.balance ?? sale.bal ?? 0),
      pt: sale.paymentType ?? sale.pt ?? ""
    };
  }

  function isInvoiceCoreObject(obj) {
    if (!obj || typeof obj !== "object") return false;
    if (obj.t !== INVOICE_CORE_TYPE_SALE && obj.t !== INVOICE_CORE_TYPE_RETURN) return false;
    if (typeof obj.n !== "string" || !obj.n) return false;
    if (!obj.d || typeof obj.d !== "string") return false;
    if (typeof obj.s !== "string") return false;
    if (!Array.isArray(obj.l)) return false;

    // Light validation: each line item must look like [code, qty, price, discount]
    for (let i = 0; i < obj.l.length; i++) {
      const row = obj.l[i];
      if (!Array.isArray(row) || row.length < 4) return false;
    }

    return Number.isFinite(Number(obj.ttl)) &&
      Number.isFinite(Number(obj.pd)) &&
      Number.isFinite(Number(obj.bal));
  }

  function normalizeInvoiceCoreNumbers(core) {
    // Ensure numeric fields are numbers, not strings.
    const normalized = { ...core };
    normalized.ttl = toNumberOrZero(core.ttl);
    normalized.pd = toNumberOrZero(core.pd);
    normalized.bal = toNumberOrZero(core.bal);

    normalized.l = (core.l || []).map((row) => [
      (row[0] ?? "").toString(),
      toNumberOrZero(row[1]),
      toNumberOrZero(row[2]),
      toNumberOrZero(row[3])
    ]);
    return normalized;
  }

  function buildSaleFromInvoiceCore(core) {
    // Converts compact invoice JSON → "sale" object compatible with your existing UI.
    if (!isInvoiceCoreObject(core)) throw new Error("Invalid invoice core");

    const normalized = normalizeInvoiceCoreNumbers(core);

    const getProductByCodeFn = typeof window.getProductByCode === "function" ? window.getProductByCode : null;
    const productsLookup = getProductByCodeFn;

    const items = normalized.l.map((row) => {
      const code = row[0];
      const qty = row[1];
      const unitPrice = row[2];
      const unitDiscount = row[3];
      const total = (unitPrice - unitDiscount) * qty;

      const product = productsLookup ? productsLookup(code) : null;
      const cost = toNumberOrZero(product?.cost ?? 0);
      const name = (product?.name || code).toString();

      const profit = (unitPrice - unitDiscount - cost) * qty;

      return {
        code,
        name,
        qty,
        price: unitPrice,
        discount: unitDiscount,
        cost,
        total,
        profit,
        // Keep track of original qty semantics for later recompute if needed.
        isNewAdded: false
      };
    });

    const sale = {
      invoiceNumber: normalized.n,
      date: normalized.d,
      salesCode: normalized.s,
      items,
      subtotal: toNumberOrZero(items.reduce((sum, it) => sum + toNumberOrZero(it.total), 0)),
      discount: 0,
      total: toNumberOrZero(normalized.ttl),
      paidAmount: toNumberOrZero(normalized.pd),
      balance: toNumberOrZero(normalized.bal),
      paymentType: normalized.pt || "",
      chequeNumber: "",
      chequeDate: "",
      customerId: "",
      customerName: "",
      customerContact: "",
      customerEmail: "",
      status: normalized.bal > 0 ? "Partial" : "Paid",
      invoiceType: normalized.t,
      // Store original compact payload for receipts and reprinting.
      invoiceCore: normalized
    };

    // Keep subtotal and total aligned for UI expectations.
    sale.total = toNumberOrZero(normalized.ttl);
    sale.balance = toNumberOrZero(normalized.bal);
    sale.paidAmount = toNumberOrZero(normalized.pd);
    return sale;
  }

  function buildCompactInvoiceBarcodeValue(core) {
    // Prefer invoice number (already concise), but allow a compact id if desired.
    // For now: use invoice number by default. Compact id is still available.
    if (isInvoiceCoreObject(core)) return core.n;
    return "";
  }

  function buildCompactInvoiceId(core) {
    if (!isInvoiceCoreObject(core)) return "";
    const essential = JSON.stringify(normalizeInvoiceCoreNumbers(core));
    const h = djb2Hash(essential);
    return `JID-${h.toString(36).toUpperCase()}`;
  }

  function compactInvoiceCoreForQR(core) {
    // Encode only essential payload in QR.
    const essential = {
      t: core.t,
      n: core.n,
      d: core.d,
      s: core.s,
      l: core.l,
      ttl: core.ttl,
      pd: core.pd,
      bal: core.bal,
      pt: core.pt
    };
    return essential;
  }

  window.InvoiceCore = {
    INVOICE_CORE_TYPE_SALE,
    INVOICE_CORE_TYPE_RETURN,
    buildEssentialInvoiceCoreFromSale,
    isInvoiceCoreObject,
    normalizeInvoiceCoreNumbers,
    buildSaleFromInvoiceCore,
    buildCompactInvoiceBarcodeValue,
    buildCompactInvoiceId,
    compactInvoiceCoreForQR,
    djb2Hash
  };
})();

