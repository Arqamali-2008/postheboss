// ============================================================
// QR / Barcode Data Export-Import (chunked backup)
// ============================================================

(function () {
  const CHUNK_SIZE = 900; // keep QR payload scannable
  const IMPORT_BUFFER_KEY = "qr_import_chunk_buffer";

  function buildBackupPayload() {
    return {
      t: "bk-pos-v1",
      d: new Date().toISOString(),
      sales: window.getSales ? window.getSales() : [],
      products: window.getProducts ? window.getProducts() : []
    };
  }

  function chunkString(str, size) {
    const out = [];
    for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
    return out;
  }

  function generateChunksForPayload(payloadObj) {
    const json = JSON.stringify(payloadObj);
    const parts = chunkString(json, CHUNK_SIZE);
    const total = parts.length;
    return parts.map((part, idx) => ({
      t: "bk-chunk-v1",
      i: idx + 1,
      c: total,
      d: part
    }));
  }

  function renderChunkList(chunks) {
    const host = document.getElementById("qrBackupChunksList");
    if (!host) return;
    host.innerHTML = "";
    chunks.forEach((ch, idx) => {
      const block = document.createElement("div");
      block.style.cssText = "display:flex; gap:10px; align-items:center; margin-bottom:10px; flex-wrap:wrap;";
      block.innerHTML = `
        <div style="min-width:120px; font-weight:600;">Chunk ${idx + 1}/${chunks.length}</div>
        <div id="qrChunk_${idx}" style="background:#fff; padding:6px; border-radius:6px;"></div>
      `;
      host.appendChild(block);
      if (window.QRCode) {
        const text = JSON.stringify(ch);
        new window.QRCode(document.getElementById(`qrChunk_${idx}`), {
          text,
          width: 180,
          height: 180,
          correctLevel: window.QRCode.CorrectLevel.M
        });
      }
    });
  }

  function exportBackupAsQRChunks() {
    const payload = buildBackupPayload();
    const chunks = generateChunksForPayload(payload);
    renderChunkList(chunks);
    alert(`Backup prepared: ${chunks.length} QR chunk(s).`);
  }

  function readBuffer() {
    try {
      const parsed = JSON.parse(localStorage.getItem(IMPORT_BUFFER_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeBuffer(v) {
    localStorage.setItem(IMPORT_BUFFER_KEY, JSON.stringify(v));
  }

  function resetImportBuffer() {
    localStorage.removeItem(IMPORT_BUFFER_KEY);
    const el = document.getElementById("qrImportProgress");
    if (el) el.textContent = "No chunks scanned yet.";
  }

  function mergeBackupData(data) {
    if (!data || !data.t || data.t !== "bk-pos-v1") throw new Error("Invalid backup type");

    const sales = window.getSales ? window.getSales() : [];
    const products = window.getProducts ? window.getProducts() : [];

    const salesMap = new Map(sales.map((s) => [s.invoiceNumber, s]));
    (data.sales || []).forEach((s) => {
      if (!s?.invoiceNumber) return;
      const local = salesMap.get(s.invoiceNumber);
      const lts = new Date(local?.updated_at || local?.date || 0).getTime();
      const rts = new Date(s.updated_at || s.date || 0).getTime();
      if (!local || rts > lts) salesMap.set(s.invoiceNumber, s);
    });
    localStorage.setItem("sales", JSON.stringify(Array.from(salesMap.values())));

    const productMap = new Map(products.map((p) => [p.itemCode, p]));
    (data.products || []).forEach((p) => {
      if (!p?.itemCode) return;
      const local = productMap.get(p.itemCode);
      const lts = new Date(local?.updated_at || 0).getTime();
      const rts = new Date(p.updated_at || 0).getTime();
      if (!local || rts > lts) productMap.set(p.itemCode, p);
    });
    localStorage.setItem("products", JSON.stringify(Array.from(productMap.values())));
  }

  function importChunk(chunkObj) {
    if (!chunkObj || chunkObj.t !== "bk-chunk-v1") throw new Error("Invalid chunk");
    const buf = readBuffer();
    const key = "active";
    if (!buf[key]) {
      buf[key] = { total: chunkObj.c, parts: {} };
    }
    buf[key].total = chunkObj.c;
    buf[key].parts[String(chunkObj.i)] = chunkObj.d;
    writeBuffer(buf);

    const doneCount = Object.keys(buf[key].parts).length;
    const progress = document.getElementById("qrImportProgress");
    if (progress) progress.textContent = `Scanned ${doneCount}/${buf[key].total} chunks`;

    if (doneCount === buf[key].total) {
      let joined = "";
      for (let i = 1; i <= buf[key].total; i++) joined += buf[key].parts[String(i)] || "";
      const parsed = JSON.parse(joined);
      mergeBackupData(parsed);
      resetImportBuffer();
      alert("QR backup import complete and merged.");
    }
  }

  function importChunkFromInputField() {
    const input = document.getElementById("qrImportInput");
    if (!input || !input.value.trim()) return;
    const raw = input.value.trim();
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) { }
    if (!parsed) {
      alert("Invalid chunk JSON");
      return;
    }
    importChunk(parsed);
    input.value = "";
  }

  function bindUI() {
    const exp = document.getElementById("exportQrBackupBtn");
    const imp = document.getElementById("importQrChunkBtn");
    const reset = document.getElementById("resetQrImportBtn");
    if (exp) exp.addEventListener("click", exportBackupAsQRChunks);
    if (imp) imp.addEventListener("click", importChunkFromInputField);
    if (reset) reset.addEventListener("click", resetImportBuffer);
  }

  window.QRBackupImporter = {
    importChunk
  };

  window.QRBackup = {
    exportBackupAsQRChunks,
    importChunkFromInputField,
    resetImportBuffer
  };

  document.addEventListener("DOMContentLoaded", bindUI);
})();

