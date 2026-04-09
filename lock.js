// Lock System Logic
// Handles duration checking, locking visuals, and unlocking mechanisms

const LOCK_STORAGE_KEY = 'pos_lock_settings';
const DEFAULT_LOCK_SETTINGS = {
    expiryDate: null, // ISO string
    isLocked: false,
    adminPassword: 'admin' // Default password, should be changed
};

// Initial CSS for the lock overlay
const LOCK_STYLES = `
#lock-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.95);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: system-ui, -apple-system, sans-serif;
}

#lock-overlay h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: #ff4444;
}

#lock-overlay p {
    font-size: 1.2rem;
    margin-bottom: 2rem;
    color: #ccc;
}

#lock-overlay input {
    padding: 10px 15px;
    font-size: 1.2rem;
    border-radius: 5px;
    border: 1px solid #444;
    background: #222;
    color: white;
    margin-bottom: 1rem;
    width: 300px;
    max-width: 90vw;
    text-align: center;
}

#lock-overlay button {
    padding: 10px 30px;
    font-size: 1.2rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.2s;
}

#lock-overlay button:hover {
    background: #0056b3;
}

#lock-overlay .error-msg {
    color: #ff4444;
    margin-top: 10px;
    height: 20px;
}
`;

function getLockSettings() {
    try {
        const stored = localStorage.getItem(LOCK_STORAGE_KEY);
        return stored ? { ...DEFAULT_LOCK_SETTINGS, ...JSON.parse(stored) } : DEFAULT_LOCK_SETTINGS;
    } catch (e) {
        return DEFAULT_LOCK_SETTINGS;
    }
}

function saveLockSettings(settings) {
    localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(settings));
}

function createLockOverlay() {
    if (document.getElementById('lock-overlay')) return;

    // Inject Styles
    const styleSheet = document.createElement("style");
    styleSheet.textContent = LOCK_STYLES;
    document.head.appendChild(styleSheet);

    // Create Overlay
    const overlay = document.createElement('div');
    overlay.id = 'lock-overlay';
    overlay.innerHTML = `
        <h1>System Locked</h1>
        <p>The operating duration for this system has expired.</p>
        <input type="password" id="unlock-password" placeholder="Enter Admin Password" autofocus>
        <button id="unlock-btn">Unlock System</button>
        <div id="unlock-error" class="error-msg"></div>
    `;

    document.body.appendChild(overlay);

    // Initial input focus (ensure it grabs focus even if user clicks away)
    const input = overlay.querySelector('input');
    input.focus();

    // Event Listeners
    const btn = overlay.querySelector('button');
    const errorMsg = overlay.querySelector('#unlock-error');

    function attemptUnlock() {
        if (checkPassword(input.value)) {
            // Success - must set new duration to proceed
            const newDuration = prompt("Access Granted. Please enter new duration structure:\n- Number (e.g., 24 for 24 hours)\n- Date/Time (e.g., 2026-12-31 18:00)");

            if (newDuration) {
                setDuration(newDuration);
            } else {
                errorMsg.textContent = "Duration required to unlock!";
                input.value = '';
                input.focus();
            }
        } else {
            errorMsg.textContent = "Incorrect Password!";
            input.value = '';
            input.focus();
        }
    }

    btn.addEventListener('click', attemptUnlock);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') attemptUnlock();
    });

    // Prevent interaction with anything else
    overlay.addEventListener('click', (e) => e.stopPropagation());
}

function removeLockOverlay() {
    const overlay = document.getElementById('lock-overlay');
    if (overlay) overlay.remove();
}

function showAdminMenu() {
    // Simple modal to let user choose next action
    // In a real app, this might be a nice UI component.
    // We will use a standard prompt/confirm flow or build a small modal for "Extend Duration"

    // For now, let's inject a small Admin Toolbar at the bottom right
    const toolbar = document.createElement('div');
    toolbar.id = 'admin-duration-toolbar';
    toolbar.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #333;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 99998;
        display: flex;
        gap: 10px;
        color: white;
    `;

    toolbar.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 5px;">
            <div style="font-weight: bold; border-bottom: 1px solid #555; padding-bottom: 5px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                <span>Admin Mode</span>
                <span id="lock-countdown-timer" style="color: #00ff00; font-family: monospace; font-size: 1.1em; background: #000; padding: 2px 6px; border-radius: 4px;">--:--:--</span>
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="lockNow()" style="background: #dc3545;">Lock Now</button>
                <button onclick="openDurationSettings()">Set Duration</button>
                <button onclick="changeAdminPassword()">Change Password</button>
                <button onclick="closeAdminToolbar()">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(toolbar);
    updateCountdownDisplay();
}

function formatTimeRemaining(expiryStr) {
    if (!expiryStr) return "Not Set";
    const now = new Date();
    const expiry = new Date(expiryStr);
    const diff = expiry - now;

    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateCountdownDisplay() {
    const settings = getLockSettings();
    const timeStr = formatTimeRemaining(settings.expiryDate);

    // Update toolbar timer if exists
    const tbTimer = document.getElementById('lock-countdown-timer');
    if (tbTimer) tbTimer.textContent = timeStr;

    // Update settings page timer if exists
    const settingsTimer = document.getElementById('settings-lock-timer');
    if (settingsTimer) settingsTimer.textContent = timeStr;
}

window.lockNow = function () {
    const settings = getLockSettings();
    // Set expiry to a past date to trigger lock
    const pastDate = new Date();
    pastDate.setMinutes(pastDate.getMinutes() - 1);
    settings.expiryDate = pastDate.toISOString();
    saveLockSettings(settings);

    closeAdminToolbar();
    createLockOverlay();
}

// Make globally available
window.closeAdminToolbar = function () {
    const t = document.getElementById('admin-duration-toolbar');
    if (t) t.remove();
}

window.openDurationSettings = function () {
    // This could open the existing Settings page or a specific modal
    // Let's create a dynamic modal for quick access
    const newDuration = prompt("Enter new duration in hours (e.g., 24) or 'YYYY-MM-DD HH:MM' for a specific date/time:");
    if (newDuration) {
        setDuration(newDuration);
    }
}

window.changeAdminPassword = function () {
    const RECOVERY_PASSWORD = "0703990932";
    const settings = getLockSettings();

    const oldPass = prompt("🔐 Just checking it's you.\n\nPlease enter the OLD admin password:");

    if (oldPass === null) return; // Users cancelled

    if (oldPass !== settings.adminPassword && oldPass !== RECOVERY_PASSWORD) {
        alert("❌ Incorrect old password.\n\nPlease try again or use the recovery password.");
        return;
    }

    const newPass = prompt("🆕 Enter NEW admin password:");

    if (newPass) {
        if (newPass.trim() === "") {
            alert("❌ Password cannot be empty.");
            return;
        }
        settings.adminPassword = newPass;
        saveLockSettings(settings);
        alert("✅ Password updated successfully! Do not forget it.");
    }
}


function checkPassword(inputPassword) {
    const RECOVERY_PASSWORD = "0703990932";
    const settings = getLockSettings();
    return inputPassword === settings.adminPassword || inputPassword === RECOVERY_PASSWORD;
}

function setDuration(input) {
    if (!input) return;
    const cleanInput = input.trim();
    let expiry;

    const hours = parseFloat(cleanInput);

    // If it's a pure number, treat as hours
    if (!isNaN(hours) && /^\d*\.?\d+$/.test(cleanInput)) {
        expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + (hours * 60)); // Use minutes for higher precision
    } else {
        // Try parsing as a full date string
        expiry = new Date(cleanInput);
    }

    if (isNaN(expiry.getTime())) {
        alert("Invalid date or duration format!");
        return;
    }

    const settings = getLockSettings();
    settings.expiryDate = expiry.toISOString();
    settings.isLocked = false;
    saveLockSettings(settings);

    alert(`System unlocked until: ${expiry.toLocaleString()}`);
    location.reload();
}

function checkLockStatus() {
    const settings = getLockSettings();

    // If no expiry is set, default to UNLOCKED for now (so first run works)
    if (!settings.expiryDate) return;

    const now = new Date();
    const expiry = new Date(settings.expiryDate);

    if (now > expiry) {
        // Time is up!
        createLockOverlay();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkLockStatus();

    // Inject Lock Button into Navbar
    const navActions = document.querySelector('.nav-actions');
    if (navActions) {
        const lockBtn = document.createElement('button');
        lockBtn.className = 'btn btn-danger btn-sm';
        lockBtn.style.marginRight = '10px';
        lockBtn.innerHTML = '🔒 Lock';
        lockBtn.title = 'Lock System';
        lockBtn.onclick = () => {
            if (confirm("Lock system now?")) lockNow();
        };
        // Insert before logout button if possible, or just append
        const logoutBtn = navActions.querySelector('[onclick*="logout"]');
        if (logoutBtn) {
            navActions.insertBefore(lockBtn, logoutBtn);
        } else {
            navActions.appendChild(lockBtn);
        }
    }

    // Update countdown every second
    setInterval(() => {
        checkLockStatus();
        updateCountdownDisplay();
    }, 1000);
});
