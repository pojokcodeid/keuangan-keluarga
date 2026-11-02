// =============================================================================
// auth.js — Client-Side Security & PIN Authentication Module
// Keuangan Keluarga - Household Accounting Web App
// =============================================================================

const STORAGE_KEYS = {
    ENABLED: 'keuangan_auth_enabled',
    HASH: 'keuangan_auth_hash',
    SALT: 'keuangan_auth_salt',
    AUTOLOCK: 'keuangan_auth_autolock', // 'immediate' | '5' | '15' | 'never'
    SESSION_UNLOCKED: 'keuangan_session_unlocked',
    LAST_ACTIVITY: 'keuangan_last_activity'
};

// ---------------------------------------------------------------------------
// Crypto Helpers (Web Crypto API SHA-256 + Salt)
// ---------------------------------------------------------------------------

function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function generateSalt() {
    const saltBytes = new Uint8Array(16);
    window.crypto.getRandomValues(saltBytes);
    return bufferToHex(saltBytes);
}

async function hashPinWithSalt(pin, saltHex) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + saltHex);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return bufferToHex(hashBuffer);
}

// ---------------------------------------------------------------------------
// Authentication State
// ---------------------------------------------------------------------------

/**
 * Check if PIN security is enabled
 * @returns {boolean}
 */
export function isPinEnabled() {
    return localStorage.getItem(STORAGE_KEYS.ENABLED) === 'true' && !!localStorage.getItem(STORAGE_KEYS.HASH);
}

/**
 * Check if the current session is unlocked and not timed out
 * @returns {boolean}
 */
export function isSessionUnlocked() {
    if (!isPinEnabled()) return true;

    const unlocked = sessionStorage.getItem(STORAGE_KEYS.SESSION_UNLOCKED) === 'true';
    if (!unlocked) return false;

    // Check inactivity auto-lock
    const autolockSetting = getAutolockSetting();
    if (autolockSetting === 'never') return true;

    const lastActivity = parseInt(sessionStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY) || '0', 10);
    if (!lastActivity) return true;

    const timeoutMinutes = parseInt(autolockSetting, 10) || 5;
    const elapsedMinutes = (Date.now() - lastActivity) / (1000 * 60);

    if (elapsedMinutes > timeoutMinutes) {
        lockSession();
        return false;
    }

    return true;
}

/**
 * Record user activity to refresh auto-lock timer
 */
export function touchActivity() {
    sessionStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
}

/**
 * Lock the current session
 */
export function lockSession() {
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_UNLOCKED);
    sessionStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);
}

/**
 * Unlock the session
 */
function setSessionUnlocked() {
    sessionStorage.setItem(STORAGE_KEYS.SESSION_UNLOCKED, 'true');
    touchActivity();
}

/**
 * Verify if provided PIN matches stored hash
 * @param {string} pin
 * @returns {Promise<boolean>}
 */
export async function verifyPin(pin) {
    if (!isPinEnabled()) return true;

    const saltHex = localStorage.getItem(STORAGE_KEYS.SALT) || '';
    const storedHash = localStorage.getItem(STORAGE_KEYS.HASH) || '';

    const computedHash = await hashPinWithSalt(pin.trim(), saltHex);
    const isValid = computedHash === storedHash;

    if (isValid) {
        setSessionUnlocked();
    }
    return isValid;
}

/**
 * Set a new PIN and enable security
 * @param {string} newPin
 * @returns {Promise<void>}
 */
export async function setupNewPin(newPin) {
    if (!newPin || newPin.length < 4) {
        throw new Error('PIN minimal harus 4 digit angka/karakter');
    }

    const saltHex = generateSalt();
    const hash = await hashPinWithSalt(newPin.trim(), saltHex);

    localStorage.setItem(STORAGE_KEYS.SALT, saltHex);
    localStorage.setItem(STORAGE_KEYS.HASH, hash);
    localStorage.setItem(STORAGE_KEYS.ENABLED, 'true');

    if (!localStorage.getItem(STORAGE_KEYS.AUTOLOCK)) {
        localStorage.setItem(STORAGE_KEYS.AUTOLOCK, 'immediate');
    }

    setSessionUnlocked();
}

/**
 * Disable PIN security (requires current PIN verification)
 * @param {string} currentPin
 * @returns {Promise<boolean>}
 */
export async function disablePin(currentPin) {
    const isValid = await verifyPin(currentPin);
    if (!isValid) {
        throw new Error('PIN saat ini salah');
    }

    localStorage.setItem(STORAGE_KEYS.ENABLED, 'false');
    localStorage.removeItem(STORAGE_KEYS.HASH);
    localStorage.removeItem(STORAGE_KEYS.SALT);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_UNLOCKED);
    return true;
}

/**
 * Get autolock configuration setting ('immediate', '5', '15', 'never')
 */
export function getAutolockSetting() {
    return localStorage.getItem(STORAGE_KEYS.AUTOLOCK) || 'immediate';
}

/**
 * Set autolock configuration setting
 */
export function setAutolockSetting(val) {
    localStorage.setItem(STORAGE_KEYS.AUTOLOCK, val);
}

