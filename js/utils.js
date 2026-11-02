// =============================================================================
// utils.js — Utility / Helper Functions
// Keuangan Keluarga - Household Accounting App
// =============================================================================

/**
 * Shorthand for document.querySelector
 * @param {string} selector
 * @returns {Element|null}
 */
export function $(selector) {
    return document.querySelector(selector);
}

/**
 * Shorthand for document.querySelectorAll
 * @param {string} selector
 * @returns {NodeListOf<Element>}
 */
export function $$(selector) {
    return document.querySelectorAll(selector);
}

// ---------------------------------------------------------------------------
// Indonesian locale data
// ---------------------------------------------------------------------------
const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_NAMES_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const DAY_NAMES = [
    'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];

// ---------------------------------------------------------------------------
// Currency & number formatting
// ---------------------------------------------------------------------------

/**
 * Format a number to Indonesian Rupiah: "Rp 1.234.567"
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
    if (amount == null || isNaN(amount)) return 'Rp 0';
    const isNegative = amount < 0;
    const abs = Math.abs(Math.round(amount));
    const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (isNegative ? '-Rp ' : 'Rp ') + formatted;
}

/**
 * Format raw number string or number into thousand-separated string: "1.234.567"
 * @param {string|number} val
 * @returns {string}
 */
export function formatNumberString(val) {
    if (val == null || val === '') return '';
    const clean = String(val).replace(/\D/g, '');
    if (!clean) return '';
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Attach live number formatting to an input element (e.g. typing 1000000 becomes 1.000.000)
 * Maintains cursor position properly.
 * @param {HTMLInputElement} inputEl
 */
export function attachNumberInputFormatter(inputEl) {
    if (!inputEl) return;

    inputEl.addEventListener('input', () => {
        const cursorPosition = inputEl.selectionStart || 0;
        const originalLength = inputEl.value.length;

        // Strip non-digits
        const digits = inputEl.value.replace(/\D/g, '');
        if (!digits) {
            inputEl.value = '';
            return;
        }

        // Format with thousand dots
        const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        inputEl.value = formatted;

        // Recalculate cursor position
        const newLength = formatted.length;
        const newPosition = cursorPosition + (newLength - originalLength);
        inputEl.setSelectionRange(Math.max(0, newPosition), Math.max(0, newPosition));
    });
}

/**
 * Parse a currency input string to a number.
 * Handles Indonesian thousand-separator format "1.000.000" → 1000000
 * Also handles plain numbers and comma-decimal "1.000,50" → 1000.50
 * @param {string} str
 * @returns {number}
 */
export function parseAmount(str) {
    if (str == null) return 0;
    let s = String(str).trim();
    // Remove currency prefix
    s = s.replace(/^Rp\s*/i, '');
    // Remove spaces
    s = s.replace(/\s/g, '');

    // Detect if comma is used as decimal separator: "1.000,50"
    if (s.includes(',') && s.includes('.')) {
        // Assume dot is thousand separator, comma is decimal
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
        // Comma-only could be decimal
        s = s.replace(',', '.');
    } else {
        // Dot-only: determine if it's a thousand separator or decimal
        // If pattern like "1.000" or "1.000.000", treat dots as thousand separators
        const dotParts = s.split('.');
        if (dotParts.length > 2) {
            // Multiple dots → thousand separators
            s = s.replace(/\./g, '');
        } else if (dotParts.length === 2 && dotParts[1].length === 3) {
            // "1.000" → treat as thousand separator
            s = s.replace(/\./g, '');
        }
        // Otherwise "1.5" stays as 1.5
    }

    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Parse a date string to a Date object (handles "YYYY-MM-DD")
 * @param {string} dateStr
 * @returns {Date}
 */
function parseDate(dateStr) {
    if (!dateStr) return new Date();
    // Split to avoid timezone offset issues with new Date("YYYY-MM-DD")
    const [y, m, d] = String(dateStr).split('-').map(Number);
    return new Date(y, m - 1, d);
}

/**
 * Format "2024-01-15" → "15 Jan 2024"
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
    const dt = parseDate(dateStr);
    const day = dt.getDate();
    const month = MONTH_NAMES_SHORT[dt.getMonth()];
    const year = dt.getFullYear();
    return `${day} ${month} ${year}`;
}

/**
 * Format "2024-01-15" → "Senin, 15 Januari 2024"
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDateFull(dateStr) {
    const dt = parseDate(dateStr);
    const dayName = DAY_NAMES[dt.getDay()];
    const day = dt.getDate();
    const month = MONTH_NAMES[dt.getMonth()];
    const year = dt.getFullYear();
    return `${dayName}, ${day} ${month} ${year}`;
}

/**
 * Format for transaction grouping.
 * Returns "Hari Ini", "Kemarin", or "15 Januari 2024"
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDateGroup(dateStr) {
    const dt = parseDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dt.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - dt.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hari Ini';
    if (diffDays === 1) return 'Kemarin';

    const day = dt.getDate();
    const month = MONTH_NAMES[dt.getMonth()];
    const year = dt.getFullYear();
    return `${day} ${month} ${year}`;
}

/**
 * Get Indonesian month name (1-indexed: 1 = Januari)
 * @param {number} month 1-12
 * @returns {string}
 */
export function getMonthName(month) {
    return MONTH_NAMES[(month - 1 + 12) % 12];
}

/**
 * Returns "Januari 2024" format for a Date object or the current date
 * @param {Date} [date]
 * @returns {string}
 */
export function getMonthYear(date) {
    const dt = date instanceof Date ? date : new Date();
    return `${MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`;
}

/**
 * Get current month (1-12)
 * @returns {number}
 */
export function getCurrentMonth() {
    return new Date().getMonth() + 1;
}

/**
 * Get current year
 * @returns {number}
 */
export function getCurrentYear() {
    return new Date().getFullYear();
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 */
export function showToast(message, type = 'info') {
    // Ensure container exists
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }

    const colorMap = {
        success: 'bg-emerald-600 text-white',
        error: 'bg-red-600 text-white',
        warning: 'bg-amber-500 text-white',
        info: 'bg-sky-600 text-white'
    };

    const iconMap = {
        success: `<svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
        error: `<svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
        warning: `<svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M12 3l9.66 16.5H2.34L12 3z"/></svg>`,
        info: `<svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01"/></svg>`
    };

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm transform transition-all duration-300 translate-x-full opacity-0 ${colorMap[type] || colorMap.info}`;
    toast.innerHTML = `${iconMap[type] || iconMap.info}<span>${message}</span>`;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    });

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('translate-x-0', 'opacity-100');
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Show a confirmation modal dialog.
 * Returns a Promise that resolves to true (confirm) or false (cancel).
 * @param {string} title
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function showConfirm(title, message) {
    return new Promise((resolve) => {
        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200 opacity-0';

        // Dialog
        const dialog = document.createElement('div');
        dialog.className = 'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full transform transition-all duration-200 scale-95 opacity-0';
        dialog.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">${title}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-6">${message}</p>
            <div class="flex gap-3 justify-end">
                <button id="confirm-cancel-btn" class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Batal</button>
                <button id="confirm-ok-btn" class="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">Ya, Lanjutkan</button>
            </div>
        `;

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        // Animate in
        requestAnimationFrame(() => {
            backdrop.classList.remove('opacity-0');
            backdrop.classList.add('opacity-100');
            dialog.classList.remove('scale-95', 'opacity-0');
            dialog.classList.add('scale-100', 'opacity-100');
        });

        function close(result) {
            backdrop.classList.remove('opacity-100');
            backdrop.classList.add('opacity-0');
            dialog.classList.remove('scale-100', 'opacity-100');
            dialog.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                backdrop.remove();
                resolve(result);
            }, 200);
        }

        dialog.querySelector('#confirm-cancel-btn').addEventListener('click', () => close(false));
        dialog.querySelector('#confirm-ok-btn').addEventListener('click', () => close(true));
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) close(false);
        });
    });
}

// ---------------------------------------------------------------------------
// Misc utilities
// ---------------------------------------------------------------------------

/**
 * Standard debounce utility.
 * @param {Function} fn
 * @param {number} [delay=300]
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Simple unique ID generator (timestamp + random).
 * @returns {string}
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
