// =============================================================================
// app.js — Main Application Entry Point with PIN Security / Login Screen
// Keuangan Keluarga - Household Accounting Single Page Web App
// =============================================================================

import { initDatabase } from './db.js';
import {
    initUI,
    openTransactionModal,
    openAccountModal,
    openCategoryModal,
    handleAccountDelete,
    handleCategoryDelete
} from './ui.js';

import {
    isPinEnabled,
    isSessionUnlocked,
    lockSession,
    verifyPin,
    touchActivity,
    getAutolockSetting
} from './auth.js';

// Expose UI functions to global window for inline click handlers
window.appUI = {
    openTransactionModal,
    openAccountModal,
    openCategoryModal,
    handleAccountDelete,
    handleCategoryDelete,
    lockApp: () => {
        lockSession();
        showLockScreen();
    }
};

// ---------------------------------------------------------------------------
// Lock Screen State & Logic
// ---------------------------------------------------------------------------
let pinBuffer = '';
const MAX_PIN_LENGTH = 6;

function showLockScreen() {
    const lockScreen = document.getElementById('lock-screen');
    if (!lockScreen) return;

    pinBuffer = '';
    updateLockDots();
    clearLockError();

    lockScreen.classList.remove('hidden');
    lockScreen.classList.add('flex');

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function hideLockScreen() {
    const lockScreen = document.getElementById('lock-screen');
    if (!lockScreen) return;

    lockScreen.classList.add('hidden');
    lockScreen.classList.remove('flex');
    pinBuffer = '';
    clearLockError();
}

function updateLockDots() {
    const dots = document.querySelectorAll('#lock-dots [data-dot]');
    dots.forEach((dot, index) => {
        const isFilled = index < pinBuffer.length;
        if (isFilled) {
            dot.classList.add('bg-indigo-500', 'border-indigo-400', 'scale-110');
            dot.classList.remove('border-slate-600');
        } else {
            dot.classList.remove('bg-indigo-500', 'border-indigo-400', 'scale-110');
            dot.classList.add('border-slate-600');
        }
    });
}

function showLockError(message) {
    const errorEl = document.getElementById('lock-error-msg');
    const dotsContainer = document.getElementById('lock-dots');

    if (errorEl) errorEl.textContent = message;

    if (dotsContainer) {
        dotsContainer.classList.add('animate-shake');
        setTimeout(() => {
            dotsContainer.classList.remove('animate-shake');
        }, 400);
    }
}

function clearLockError() {
    const errorEl = document.getElementById('lock-error-msg');
    if (errorEl) errorEl.textContent = '';
}

async function handlePinInput(key) {
    clearLockError();

    if (key === 'clear') {
        pinBuffer = '';
        updateLockDots();
        return;
    }

    if (key === 'backspace') {
        if (pinBuffer.length > 0) {
            pinBuffer = pinBuffer.slice(0, -1);
            updateLockDots();
        }
        return;
    }

    // Number input (0-9)
    if (/^[0-9]$/.test(key)) {
        if (pinBuffer.length < MAX_PIN_LENGTH) {
            pinBuffer += key;
            updateLockDots();

            // Auto-check if length reaches at least 4 digits
            if (pinBuffer.length >= 4) {
                // If it reaches maximum length or delay verification slightly for smooth UX
                const currentAttempt = pinBuffer;
                const isValid = await verifyPin(currentAttempt);
                if (isValid) {
                    hideLockScreen();
                } else if (currentAttempt.length >= MAX_PIN_LENGTH) {
                    showLockError('PIN salah, silakan coba lagi');
                    pinBuffer = '';
                    setTimeout(updateLockDots, 200);
                }
            }
        }
    }
}

function setupLockScreenEvents() {
    // 1. Keypad button clicks
    const lockScreen = document.getElementById('lock-screen');
    if (lockScreen) {
        lockScreen.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-key]');
            if (btn) {
                const key = btn.getAttribute('data-key');
                handlePinInput(key);
            }
        });
    }

    // 2. Hardware keyboard support
    window.addEventListener('keydown', (e) => {
        const lockScreen = document.getElementById('lock-screen');
        if (!lockScreen || lockScreen.classList.contains('hidden')) return;

        if (/^[0-9]$/.test(e.key)) {
            handlePinInput(e.key);
        } else if (e.key === 'Backspace') {
            handlePinInput('backspace');
        } else if (e.key === 'Escape' || e.key === 'Delete') {
            handlePinInput('clear');
        }
    });

    // 3. User activity tracking for auto-lock
    const activityEvents = ['pointerdown', 'keydown', 'touchstart'];
    activityEvents.forEach(evt => {
        window.addEventListener(evt, () => {
            touchActivity();
        }, { passive: true });
    });

    // 4. Inactivity check interval (every 15 seconds)
    setInterval(() => {
        if (isPinEnabled() && !isSessionUnlocked()) {
            const lockScreen = document.getElementById('lock-screen');
            if (lockScreen && lockScreen.classList.contains('hidden')) {
                showLockScreen();
            }
        }
    }, 15000);

    // 5. Lock buttons in header & sidebar
    const btnHeaderLock = document.getElementById('btn-header-lock');
    if (btnHeaderLock) {
        btnHeaderLock.addEventListener('click', () => {
            window.appUI.lockApp();
        });
    }

    const btnSidebarLock = document.getElementById('btn-sidebar-lock');
    if (btnSidebarLock) {
        btnSidebarLock.addEventListener('click', () => {
            window.appUI.lockApp();
        });
    }
}

// ---------------------------------------------------------------------------
// Bootstrap Application
// ---------------------------------------------------------------------------
async function bootstrap() {
    const splashScreen = document.getElementById('splash-screen');

    try {
        // 1. Initialize SQLite Database via WebAssembly & IndexedDB
        await initDatabase();

        // 2. Initialize UI controllers & event listeners
        initUI();

        // 3. Setup Lock Screen Events & Auth
        setupLockScreenEvents();

        // 4. Check Authentication / PIN Lock State
        if (isPinEnabled() && !isSessionUnlocked()) {
            showLockScreen();
        }

        // 5. Render Lucide icons
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }

        // 6. Register Service Worker for offline PWA support if supported
        if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            navigator.serviceWorker.register('./sw.js').catch(err => {
                console.info('Service Worker registration skipped or failed:', err);
            });
        }

        // 7. Dismiss splash screen smoothly
        if (splashScreen) {
            splashScreen.classList.add('fade-out');
            setTimeout(() => {
                splashScreen.style.display = 'none';
            }, 400);
        }

    } catch (err) {
        console.error('Fatal initialization error:', err);
        if (splashScreen) {
            splashScreen.innerHTML = `
                <div class="p-6 max-w-sm mx-auto text-center bg-white rounded-2xl shadow-xl text-slate-800">
                    <div class="text-4xl mb-3">⚠️</div>
                    <h2 class="text-lg font-bold text-rose-600 mb-2">Gagal Memuat Aplikasi</h2>
                    <p class="text-xs text-slate-500 mb-4">${err.message || 'Terjadi kesalahan saat menginisialisasi database SQLite lokal.'}</p>
                    <button onclick="window.location.reload()"
                            class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors">
                        Muat Ulang Halaman
                    </button>
                </div>
            `;
        }
    }
}

// Start app once DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
