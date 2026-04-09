// ============================================================
// Device Management (Primary / Secondary)
// ============================================================

(function () {
  const KEY_ROLE = "pos_device_role";
  const KEY_CODE = "pos_device_code";
  const KEY_PREFIX = "pos_invoice_prefix";

  function derivePrefix(role, code) {
    if (role === "primary") return "INV";
    const safe = (code || "SD1").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return `${safe}-INV`;
  }

  function loadDeviceConfig() {
    const role = localStorage.getItem(KEY_ROLE) || "primary";
    const code = localStorage.getItem(KEY_CODE) || (role === "primary" ? "PRIMARY" : "SD1");
    const prefix = localStorage.getItem(KEY_PREFIX) || derivePrefix(role, code);
    return { role, code, prefix };
  }

  function saveDeviceConfig(role, code) {
    const normalizedRole = role === "secondary" ? "secondary" : "primary";
    const normalizedCode = (code || (normalizedRole === "primary" ? "PRIMARY" : "SD1")).toUpperCase();
    const prefix = derivePrefix(normalizedRole, normalizedCode);

    localStorage.setItem(KEY_ROLE, normalizedRole);
    localStorage.setItem(KEY_CODE, normalizedCode);
    localStorage.setItem(KEY_PREFIX, prefix);
    return { role: normalizedRole, code: normalizedCode, prefix };
  }

  function bindSettingsFields() {
    const roleEl = document.getElementById("deviceRole");
    const codeEl = document.getElementById("deviceCode");
    const prefixEl = document.getElementById("devicePrefix");
    const saveBtn = document.getElementById("saveDeviceConfigBtn");
    if (!roleEl || !codeEl || !prefixEl || !saveBtn) return;

    const cfg = loadDeviceConfig();
    roleEl.value = cfg.role;
    codeEl.value = cfg.code;
    prefixEl.value = cfg.prefix;

    roleEl.addEventListener("change", () => {
      const p = derivePrefix(roleEl.value, codeEl.value);
      prefixEl.value = p;
    });
    codeEl.addEventListener("input", () => {
      const p = derivePrefix(roleEl.value, codeEl.value);
      prefixEl.value = p;
    });

    saveBtn.addEventListener("click", () => {
      const out = saveDeviceConfig(roleEl.value, codeEl.value);
      prefixEl.value = out.prefix;
      alert(`Device saved. Invoice prefix: ${out.prefix}`);
    });
  }

  window.DeviceManager = {
    loadDeviceConfig,
    saveDeviceConfig,
    derivePrefix,
    bindSettingsFields
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindSettingsFields();
  });
})();

