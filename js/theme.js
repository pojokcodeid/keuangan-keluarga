// =============================================================================
// theme.js — Mode tampilan: Terang / Gelap / Otomatis (ikut sistem)
// =============================================================================

const KEY = 'kk_theme';
const mq = window.matchMedia('(prefers-color-scheme: dark)');
let onChange = () => {};

export function getThemeMode() {
    try {
        const m = localStorage.getItem(KEY);
        return ['light', 'dark', 'auto'].includes(m) ? m : 'auto';
    } catch (_) { return 'auto'; }
}

export const isDark = () => document.documentElement.classList.contains('dark');

const ACTIVE = 'bg-indigo-50 border-indigo-300 text-indigo-600';
const IDLE = 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50';

function syncButtons() {
    const mode = getThemeMode();
    document.querySelectorAll('[data-theme-option]').forEach(btn => {
        const on = btn.dataset.themeOption === mode;
        btn.className = `min-h-[48px] rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${on ? ACTIVE : IDLE}`;
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const status = document.querySelector('#theme-status');
    if (status) {
        status.textContent = mode === 'auto'
            ? `Mengikuti pengaturan perangkat (saat ini ${mq.matches ? 'gelap' : 'terang'})`
            : mode === 'dark' ? 'Mode gelap aktif' : 'Mode terang aktif';
    }
}

export function applyTheme() {
    const mode = getThemeMode();
    const dark = mode === 'dark' || (mode === 'auto' && mq.matches);
    const changed = dark !== isDark();
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f172a' : '#4f46e5');
    syncButtons();
    if (changed) onChange(dark);   // mis. render ulang grafik agar warna menyesuaikan
}

export function setThemeMode(mode) {
    try { localStorage.setItem(KEY, mode); } catch (_) { /* mode privat: tetap berlaku sesi ini */ }
    applyTheme();
}

export function initTheme(callback) {
    if (typeof callback === 'function') onChange = callback;
    document.querySelectorAll('[data-theme-option]').forEach(btn =>
        btn.addEventListener('click', () => setThemeMode(btn.dataset.themeOption)));
    const onSystem = () => { if (getThemeMode() === 'auto') applyTheme(); else syncButtons(); };
    if (mq.addEventListener) mq.addEventListener('change', onSystem); else mq.addListener(onSystem);
    applyTheme();
}
