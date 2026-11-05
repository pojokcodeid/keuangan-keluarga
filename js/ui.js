// =============================================================================
// ui.js — UI Controller Module
// Keuangan Keluarga - Household Accounting App
// =============================================================================

import {
    getAllAccounts, getAccountById, getAccountBalance, getTotalBalance,
    addAccount, updateAccount, deleteAccount,
    getAllCategories, getCategoryById, addCategory, updateCategory, deleteCategory,
    getAllTransactions, getTransactionById, addTransaction, updateTransaction, deleteTransaction,
    getMonthlyIncome, getMonthlyExpense, getBudgetUsage, getMonthlySummary, getBudgetsForTransaction,
    exportDatabase, importDatabase
} from './db.js';

import {
    formatCurrency, formatDate, formatDateGroup, getMonthName,
    getCurrentMonth, getCurrentYear, showToast, showConfirm, $, $$,
    formatNumberString, attachNumberInputFormatter, parseAmount
} from './utils.js';

import { renderPieChart, renderBarChart, renderBudgetChart, destroyCharts } from './charts.js';
import { exportToExcel, ACCOUNT_TYPE_LABELS } from './export.js';
import { initTheme } from './theme.js';
import { iconBadge, emojiFor, createIconPicker, resolveBudgetIcon } from './icons.js';
import { initBudgetUI, renderBudgets, renderBudgetAlerts, openBudgetModal } from './budget.js';
import {
    isPinEnabled,
    setupNewPin,
    disablePin,
    verifyPin,
    getAutolockSetting,
    setAutolockSetting
} from './auth.js';

// ---------------------------------------------------------------------------
// Module State
// ---------------------------------------------------------------------------
let currentView = 'dashboard';
let currentReportTab = 'ringkasan';
let currentCategoryTab = 'income';

let editingTransactionId = null;
let editingAccountId = null;
let editingCategoryId = null;

// Category icon map fallback
const CATEGORY_ICONS = {
    briefcase: '💼',
    gift: '🎁',
    'trending-up': '📈',
    'plus-circle': '➕',
    'shopping-cart': '🛒',
    utensils: '🍽️',
    car: '🚗',
    zap: '⚡',
    wifi: '🌐',
    'heart-pulse': '🏥',
    'graduation-cap': '🎓',
    'gamepad-2': '🎮',
    landmark: '🏦',
    wallet: '💰',
    tag: '🏷️',
    'more-horizontal': '📦',
    default: '🏷️'
};

function getCategoryEmoji(icon) {
    return emojiFor(icon);   // dipakai di <option>; tampilan visual memakai iconBadge()
}

function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function currentYearMonthISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
}

function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initUI() {
    // 1. Navigation clicks (mobile bottom nav + desktop sidebar + in-app links)
    document.addEventListener('click', (e) => {
        const navBtn = e.target.closest('[data-nav]');
        if (navBtn) {
            e.preventDefault();
            const view = navBtn.getAttribute('data-nav');
            switchView(view);
        }
    });

    // 2. Modal close triggers
    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('[data-close-modal]');
        if (closeBtn) {
            const modalId = closeBtn.getAttribute('data-close-modal');
            closeModalById(modalId);
        }
    });

    // 3. FAB Add Transaction
    const fab = $('#fab-add-transaction');
    if (fab) {
        fab.addEventListener('click', () => {
            // Tombol bulat yang sama: di halaman Budget membuka form budget
            const active = document.querySelector('.view-section:not(.hidden)');
            if (active && active.id === 'view-budget') openBudgetModal(); else openTransactionModal();
        });
    }

    // 4. Transaction filter bar listeners
    const filterMonth = $('#filter-month');
    const filterAccount = $('#filter-account');
    const filterCategory = $('#filter-category');

    if (filterMonth) {
        filterMonth.value = currentYearMonthISO();
        filterMonth.addEventListener('change', () => renderTransactions());
    }
    if (filterAccount) filterAccount.addEventListener('change', () => renderTransactions());
    if (filterCategory) filterCategory.addEventListener('change', () => renderTransactions());

    // 5. Transaction Modal Event Listeners
    setupTransactionModalEvents();

    // 6. Report View Event Listeners
    setupReportEvents();

    // 7. Settings View Event Listeners
    setupSettingsEvents();

    // 7b. Budget (harian/mingguan/bulanan)
    initBudgetUI(() => rerenderCurrentView());
    catIconPicker = createIconPicker($('#cat-icon-picker'));
    initTheme(() => { try { rerenderCurrentView(); } catch (_) { /* belum siap */ } });
    ['#tx-amount', '#acc-balance', '#cat-budget'].forEach(sel => attachNumberInputFormatter($(sel)));

    // 8. Render Initial View
    switchView('dashboard');
}

// ============================================================================
// NAVIGATION & VIEW SWITCHING
// ============================================================================

export function switchView(viewName) {
    currentView = viewName;

    // Hide all view sections
    $$('.view-section').forEach(section => {
        section.classList.add('hidden');
    });

    // Show target section
    const targetSection = $(`#view-${viewName}`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }

    // Update Nav highlighting
    updateActiveNav(viewName);

    // FAB Visibility (only show on dashboard and transaksi)
    const fab = $('#fab-add-transaction');
    if (fab) {
        fab.style.display = (viewName === 'dashboard' || viewName === 'transaksi' || viewName === 'budget') ? 'flex' : 'none';
        fab.setAttribute('aria-label', viewName === 'budget' ? 'Buat budget' : 'Tambah transaksi');
    }

    // Render active view content
    switch (viewName) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'transaksi':
            populateTransactionFilterDropdowns();
            renderTransactions();
            break;
        case 'budget':
            renderBudgets();
            break;
        case 'laporan':
            renderReports();
            break;
        case 'pengaturan':
            renderSettings();
            break;
    }

    refreshIcons();
}

export function updateActiveNav(viewName) {
    // 1. Mobile Bottom Nav
    $$('#bottom-nav .nav-item').forEach(btn => {
        const isActive = btn.getAttribute('data-nav') === viewName;
        btn.classList.toggle('active', isActive);

        const icon = btn.querySelector('.nav-icon');
        const label = btn.querySelector('.nav-label');
        const indicator = btn.querySelector('.nav-indicator');

        if (icon) {
            icon.classList.toggle('text-indigo-600', isActive);
            icon.classList.toggle('text-slate-400', !isActive);
        }
        if (label) {
            label.classList.toggle('text-indigo-600', isActive);
            label.classList.toggle('font-semibold', isActive);
            label.classList.toggle('text-slate-400', !isActive);
        }
        if (indicator) {
            indicator.classList.toggle('opacity-100', isActive);
            indicator.classList.toggle('scale-x-100', isActive);
            indicator.classList.toggle('opacity-0', !isActive);
            indicator.classList.toggle('scale-x-0', !isActive);
        }
    });

    // 2. Desktop Sidebar
    $$('#sidebar .sidebar-item').forEach(btn => {
        const isActive = btn.getAttribute('data-nav') === viewName;
        btn.classList.toggle('active', isActive);
        if (isActive) {
            btn.classList.add('bg-indigo-50', 'text-indigo-600', 'font-semibold', 'border-r-4', 'border-indigo-600');
            btn.classList.remove('text-slate-600');
        } else {
            btn.classList.remove('bg-indigo-50', 'text-indigo-600', 'font-semibold', 'border-r-4', 'border-indigo-600');
            btn.classList.add('text-slate-600');
        }
    });
}

// ============================================================================
// DASHBOARD
// ============================================================================

// Escape teks untuk disisipkan ke innerHTML (nama akun/kategori dsb.)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderDashboard() {
    const totalBalance = getTotalBalance();
    const curMonth = getCurrentMonth();
    const curYear = getCurrentYear();

    const monthlyIncome = getMonthlyIncome(curMonth, curYear);
    const monthlyExpense = getMonthlyExpense(curMonth, curYear);

    // 1. Sisa saldo tiap akun & dompet (bukan satu angka total)
    renderDashboardAccountBalances();

    const headerSaldo = $('#header-saldo-value');
    if (headerSaldo) headerSaldo.textContent = formatCurrency(totalBalance);

    // 2. Summary Cards
    const incomeEl = $('#dashboard-income');
    if (incomeEl) incomeEl.textContent = formatCurrency(monthlyIncome);

    const expenseEl = $('#dashboard-expense');
    if (expenseEl) expenseEl.textContent = formatCurrency(monthlyExpense);

    // 3. Peringatan Anggaran (Budget Alerts)
    renderDashboardBudgetAlerts(curMonth, curYear);

    // 4. Transaksi Terakhir (Last 5 transactions)
    renderDashboardRecentTransactions();

    refreshIcons();
}

/**
 * Rincian sisa saldo setiap item akun & dompet di kartu dashboard.
 * Saldo per akun = saldo awal + pemasukan − pengeluaran + transfer masuk − transfer keluar.
 */
function renderDashboardAccountBalances() {
    const container = $('#dashboard-account-balances');
    if (!container) return;

    const accounts = getAllAccounts();

    if (accounts.length === 0) {
        container.innerHTML = `
            <p class="text-xs text-indigo-200 mt-1">Belum ada akun atau dompet. Tambahkan lewat menu Pengaturan → Akun &amp; Dompet.</p>
        `;
        return;
    }

    container.innerHTML = accounts.map((acc, i) => {
        const balance = getAccountBalance(acc.id);
        const iconName = acc.type === 'bank' ? 'landmark' : (acc.type === 'e-wallet' ? 'smartphone' : 'wallet');
        const typeLabel = ACCOUNT_TYPE_LABELS[acc.type] || 'Akun';

        return `
            <div class="flex items-center justify-between gap-3 py-2.5 ${i > 0 ? 'border-t border-white/15' : ''}">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                        <i data-lucide="${iconName}" class="w-4 h-4"></i>
                    </span>
                    <div class="min-w-0">
                        <p class="text-sm font-bold truncate">${esc(acc.name)}</p>
                        <p class="text-[10px] text-indigo-200 truncate">${esc(typeLabel)}</p>
                    </div>
                </div>
                <p class="text-sm font-bold whitespace-nowrap">${formatCurrency(balance)}</p>
            </div>
        `;
    }).join('');
}

function renderDashboardBudgetAlerts() {
    renderBudgetAlerts($('#budget-alert-list'));
}

function renderDashboardRecentTransactions() {
    const container = $('#dashboard-recent-transactions');
    if (!container) return;

    const allTx = getAllTransactions();
    const recent = allTx.slice(0, 5);

    if (recent.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center">
                <i data-lucide="inbox" class="w-10 h-10 text-slate-200 mx-auto mb-2"></i>
                <p class="text-sm text-slate-400">Belum ada transaksi</p>
                <p class="text-xs text-slate-300 mt-1">Ketuk tombol + untuk menambah transaksi pertama</p>
            </div>
        `;
        return;
    }

    container.innerHTML = recent.map(tx => renderTransactionRowHtml(tx, false)).join('');
}

// ============================================================================
// TRANSACTIONS VIEW
// ============================================================================

function populateTransactionFilterDropdowns() {
    const accSelect = $('#filter-account');
    const catSelect = $('#filter-category');

    if (accSelect) {
        const accounts = getAllAccounts();
        const currentVal = accSelect.value;
        accSelect.innerHTML = '<option value="">Semua Akun</option>' +
            accounts.map(a => `<option value="${a.id}" ${a.id == currentVal ? 'selected' : ''}>${a.name}</option>`).join('');
    }

    if (catSelect) {
        const categories = getAllCategories();
        const currentVal = catSelect.value;
        catSelect.innerHTML = '<option value="">Semua Kategori</option>' +
            categories.map(c => `<option value="${c.id}" ${c.id == currentVal ? 'selected' : ''}>${getCategoryEmoji(c.icon)} ${c.name} (${c.type === 'income' ? 'Masuk' : 'Keluar'})</option>`).join('');
    }
}

export function renderTransactions() {
    const listEl = $('#transaction-list');
    if (!listEl) return;

    const monthInput = $('#filter-month');
    const accInput = $('#filter-account');
    const catInput = $('#filter-category');

    const filters = {};
    if (monthInput && monthInput.value) {
        const [yyyy, mm] = monthInput.value.split('-');
        filters.year = parseInt(yyyy, 10);
        filters.month = parseInt(mm, 10);
    }
    if (accInput && accInput.value) {
        filters.account_id = parseInt(accInput.value, 10);
    }
    if (catInput && catInput.value) {
        filters.category_id = parseInt(catInput.value, 10);
    }

    const transactions = getAllTransactions(filters);

    if (transactions.length === 0) {
        listEl.innerHTML = `
            <div class="bg-white rounded-xl border border-slate-100 p-8 text-center">
                <i data-lucide="inbox" class="w-12 h-12 text-slate-200 mx-auto mb-3"></i>
                <p class="text-sm text-slate-500 font-medium">Tidak ada transaksi ditemukan</p>
                <p class="text-xs text-slate-400 mt-1">Coba sesuaikan filter atau tambahkan transaksi baru</p>
            </div>
        `;
        refreshIcons();
        return;
    }

    // Group transactions by date
    const groups = {};
    transactions.forEach(tx => {
        const dateKey = tx.transaction_date || 'Tanpa Tanggal';
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(tx);
    });

    let html = '';
    for (const [dateKey, txs] of Object.entries(groups)) {
        const groupLabel = formatDateGroup(dateKey);

        // Daily total calculation
        let dailyExpense = 0;
        let dailyIncome = 0;
        txs.forEach(t => {
            if (t.type === 'expense') dailyExpense += t.amount;
            if (t.type === 'income') dailyIncome += t.amount;
        });

        html += `
            <div class="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                <!-- Group Header -->
                <div class="bg-slate-50/80 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between text-xs">
                    <span class="font-bold text-slate-700">${groupLabel}</span>
                    <div class="flex items-center gap-3 text-[11px] font-semibold">
                        ${dailyIncome > 0 ? `<span class="text-emerald-600">+${formatCurrency(dailyIncome)}</span>` : ''}
                        ${dailyExpense > 0 ? `<span class="text-rose-600">-${formatCurrency(dailyExpense)}</span>` : ''}
                    </div>
                </div>
                <!-- Transactions in this group -->
                <div class="divide-y divide-slate-50">
                    ${txs.map(tx => renderTransactionRowHtml(tx, true)).join('')}
                </div>
            </div>
        `;
    }

    listEl.innerHTML = html;
    refreshIcons();
}

let catIconPicker = null;

function renderTransactionRowHtml(tx, showActions = true) {
    const isIncome = tx.type === 'income';
    const isExpense = tx.type === 'expense';
    const isTransfer = tx.type === 'transfer';

    let amountColor = 'text-blue-600';
    let amountPrefix = '';
    let typeBadge = '';
    let iconEmoji = '💸';

    if (isIncome) {
        amountColor = 'text-emerald-600';
        amountPrefix = '+';
        iconEmoji = getCategoryEmoji(tx.category_icon || 'briefcase');
        typeBadge = `<span class="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-medium">Pemasukan</span>`;
    } else if (isExpense) {
        amountColor = 'text-rose-600';
        amountPrefix = '-';
        iconEmoji = getCategoryEmoji(tx.category_icon || 'shopping-cart');
        typeBadge = `<span class="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-medium">Pengeluaran</span>`;
    } else if (isTransfer) {
        amountColor = 'text-blue-600';
        amountPrefix = '';
        iconEmoji = '🔄';
        typeBadge = `<span class="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Transfer</span>`;
    }

    const txBadge = isTransfer
        ? iconBadge('fa-solid fa-right-left|#3B82F6', { size: 36 })
        : iconBadge(tx.category_icon || (isIncome ? 'briefcase' : 'shopping-cart'), { size: 36 });

    const title = isTransfer
        ? `${tx.account_name || 'Akun'} → ${tx.to_account_name || 'Akun Tujuan'}`
        : (tx.category_name || 'Tanpa Kategori');

    const subInfo = isTransfer
        ? `Transfer Antar-Akun`
        : `${tx.account_name || ''}`;

    return `
        <div class="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
             onclick="window.appUI.openTransactionModal(${tx.id})">
            <div class="flex items-center gap-3 min-w-0 flex-1">
                ${txBadge}
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                        <p class="text-sm font-semibold text-slate-800 truncate">${title}</p>
                        ${typeBadge}
                    </div>
                    <div class="flex items-center gap-2 text-xs text-slate-400 mt-0.5 truncate">
                        <span>${subInfo}</span>
                        ${tx.note ? `<span class="truncate">· ${tx.note}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="text-right shrink-0 ml-3">
                <p class="text-sm font-bold ${amountColor}">${amountPrefix}${formatCurrency(tx.amount)}</p>
                <p class="text-[11px] text-slate-400">${formatDate(tx.transaction_date)}</p>
            </div>
        </div>
    `;
}

// ============================================================================
// TRANSACTION MODAL (ADD / EDIT)
// ============================================================================

function setupTransactionModalEvents() {
    const modal = $('#modal-transaction');
    if (!modal) return;

    // Type radio toggle buttons
    const typeRadios = modal.querySelectorAll('input[name="tx-type"]');
    typeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            updateTransactionModalFormByType(radio.value);
        });
    });

    // Form submit
    // Info budget real-time saat mengisi pengeluaran
    ['#tx-amount', '#tx-date'].forEach(sel => $(sel)?.addEventListener('input', updateTxBudgetInfo));
    $('#tx-category')?.addEventListener('change', updateTxBudgetInfo);
    $('#tx-date')?.addEventListener('change', updateTxBudgetInfo);

    const form = $('#form-transaction');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handleTransactionSubmit();
        });
    }
}

const BUDGET_PERIOD = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' };

function updateTxBudgetInfo() {
    const box = $('#tx-budget-info');
    if (!box) return;
    const type = document.querySelector('input[name="tx-type"]:checked')?.value;
    const date = $('#tx-date')?.value;
    if (type !== 'expense' || !date) { box.classList.add('hidden'); box.innerHTML = ''; return; }

    const catId = parseInt($('#tx-category')?.value, 10) || null;
    const list = getBudgetsForTransaction({ date, categoryId: catId, amount: parseAmount($('#tx-amount')?.value), excludeId: editingTransactionId });
    if (!list.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }

    box.classList.remove('hidden');
    box.innerHTML = '<p class="text-xs text-slate-500 font-medium flex items-center gap-1.5"><i data-lucide="target" class="w-3.5 h-3.5"></i>Dampak ke budget</p>' +
        list.map(b => {
            const pct = Math.round(b.percentage);
            const over = pct >= 100, warn = pct >= 75;
            const bar = over ? 'bg-rose-500' : warn ? 'bg-amber-500' : 'bg-emerald-500';
            const frame = over ? 'border-rose-200 bg-rose-50' : warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50';
            const msg = over ? `Melebihi budget ${formatCurrency(-b.remaining)}` : `Sisa ${formatCurrency(b.remaining)}`;
            return `<div class="rounded-xl border ${frame} p-3 space-y-1.5">
                <div class="flex items-center justify-between gap-2 text-xs">
                    <span class="flex items-center gap-2 min-w-0 font-semibold text-slate-700">${iconBadge(resolveBudgetIcon(b), { size: 22 })}<span class="truncate">${b.name} <span class="font-normal text-slate-400">· ${BUDGET_PERIOD[b.period_type]}</span></span></span>
                    <span class="font-bold ${over ? 'text-rose-600' : warn ? 'text-amber-600' : 'text-emerald-600'}">${pct}%</span>
                </div>
                <div class="w-full bg-white rounded-full h-2 overflow-hidden"><div class="${bar} h-2 rounded-full" style="width:${Math.min(pct, 100)}%"></div></div>
                <p class="text-[11px] text-slate-500">${formatCurrency(b.after)} / ${formatCurrency(b.amount_limit)} · ${msg}</p>
            </div>`;
        }).join('');
    refreshIcons();
}

function updateTransactionModalFormByType(type) {
    const toAccountGroup = $('#tx-account-to-group');
    const toAccountSelect = $('#tx-account-to');
    const categoryGroup = $('#tx-category-group');
    const categorySelect = $('#tx-category');

    if (type === 'transfer') {
        if (toAccountGroup) toAccountGroup.classList.remove('hidden');
        if (toAccountSelect) toAccountSelect.required = true;
        if (categoryGroup) categoryGroup.classList.add('hidden');
        if (categorySelect) {
            categorySelect.required = false;
            categorySelect.value = '';
        }
    } else {
        if (toAccountGroup) toAccountGroup.classList.add('hidden');
        if (toAccountSelect) {
            toAccountSelect.required = false;
            toAccountSelect.value = '';
        }
        if (categoryGroup) categoryGroup.classList.remove('hidden');
        if (categorySelect) categorySelect.required = true;

        // Populate category dropdown based on income / expense type
        populateCategoryModalDropdown(type);
    }
    updateTxBudgetInfo();
}

function populateCategoryModalDropdown(type, selectedId = null) {
    const select = $('#tx-category');
    if (!select) return;

    const categories = getAllCategories(type);
    select.innerHTML = '<option value="">Pilih Kategori</option>' +
        categories.map(c => `<option value="${c.id}" ${c.id == selectedId ? 'selected' : ''}>${getCategoryEmoji(c.icon)} ${c.name}</option>`).join('');
}

function populateAccountModalDropdowns(selectedFromId = null, selectedToId = null) {
    const fromSelect = $('#tx-account');
    const toSelect = $('#tx-account-to');
    const accounts = getAllAccounts();

    const options = '<option value="">Pilih Akun</option>' +
        accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(getAccountBalance(a.id))})</option>`).join('');

    if (fromSelect) {
        fromSelect.innerHTML = options;
        if (selectedFromId) fromSelect.value = selectedFromId;
    }
    if (toSelect) {
        toSelect.innerHTML = options;
        if (selectedToId) toSelect.value = selectedToId;
    }
}

export function openTransactionModal(id = null) {
    editingTransactionId = id;
    const modal = $('#modal-transaction');
    if (!modal) return;

    const modalTitle = $('#modal-transaction-title');
    const submitBtnText = $('#btn-tx-submit-text');
    const idInput = $('#tx-id');
    const amountInput = $('#tx-amount');
    const dateInput = $('#tx-date');
    const noteInput = $('#tx-note');

    if (id) {
        // Edit Mode
        const tx = getTransactionById(id);
        if (!tx) {
            showToast('Transaksi tidak ditemukan', 'error');
            return;
        }

        if (modalTitle) modalTitle.textContent = 'Edit Transaksi';
        if (submitBtnText) submitBtnText.textContent = 'Perbarui Transaksi';
        if (idInput) idInput.value = tx.id;
        if (amountInput) amountInput.value = formatNumberString(Math.round(tx.amount));
        if (dateInput) dateInput.value = tx.transaction_date;
        if (noteInput) noteInput.value = tx.note || '';

        // Set radio type
        const radio = modal.querySelector(`input[name="tx-type"][value="${tx.type}"]`);
        if (radio) radio.checked = true;

        populateAccountModalDropdowns(tx.account_id, tx.to_account_id);
        updateTransactionModalFormByType(tx.type);

        if (tx.type !== 'transfer') {
            populateCategoryModalDropdown(tx.type, tx.category_id);
        }
    } else {
        // New Mode
        if (modalTitle) modalTitle.textContent = 'Tambah Transaksi';
        if (submitBtnText) submitBtnText.textContent = 'Simpan Transaksi';
        if (idInput) idInput.value = '';
        if (amountInput) amountInput.value = '';
        if (dateInput) dateInput.value = todayISO();
        if (noteInput) noteInput.value = '';

        // Default to expense
        const defaultRadio = modal.querySelector('input[name="tx-type"][value="expense"]');
        if (defaultRadio) defaultRadio.checked = true;

        populateAccountModalDropdowns();
        updateTransactionModalFormByType('expense');
    }

    modal.classList.remove('hidden');
    updateTxBudgetInfo();
    refreshIcons();
}

export function closeTransactionModal() {
    closeModalById('modal-transaction');
    editingTransactionId = null;
}

export async function handleTransactionSubmit() {
    const idInput = $('#tx-id');
    const id = idInput && idInput.value ? parseInt(idInput.value, 10) : null;

    const typeRadio = document.querySelector('input[name="tx-type"]:checked');
    const type = typeRadio ? typeRadio.value : 'expense';

    const amountInput = $('#tx-amount');
    const amount = amountInput ? parseAmount(amountInput.value) : 0;

    const dateInput = $('#tx-date');
    const date = dateInput ? dateInput.value : '';

    const accountSelect = $('#tx-account');
    const accountId = accountSelect && accountSelect.value ? parseInt(accountSelect.value, 10) : null;

    const toAccountSelect = $('#tx-account-to');
    const toAccountId = (type === 'transfer' && toAccountSelect && toAccountSelect.value)
        ? parseInt(toAccountSelect.value, 10)
        : null;

    const categorySelect = $('#tx-category');
    const categoryId = (type !== 'transfer' && categorySelect && categorySelect.value)
        ? parseInt(categorySelect.value, 10)
        : null;

    const noteInput = $('#tx-note');
    const note = noteInput ? noteInput.value.trim() : '';

    // Validation
    if (!amount || amount <= 0) {
        showToast('Nominal transaksi harus lebih dari 0', 'warning');
        return;
    }
    if (!date) {
        showToast('Pilih tanggal transaksi', 'warning');
        return;
    }
    if (!accountId) {
        showToast('Pilih akun', 'warning');
        return;
    }
    if (type === 'transfer') {
        if (!toAccountId) {
            showToast('Pilih akun tujuan untuk transfer', 'warning');
            return;
        }
        if (accountId === toAccountId) {
            showToast('Akun asal dan akun tujuan tidak boleh sama', 'warning');
            return;
        }
    } else {
        if (!categoryId) {
            showToast('Pilih kategori transaksi', 'warning');
            return;
        }
    }

    try {
        if (id) {
            await updateTransaction(id, accountId, toAccountId, categoryId, type, amount, date, note);
            showToast('Transaksi berhasil diperbarui', 'success');
        } else {
            await addTransaction(accountId, toAccountId, categoryId, type, amount, date, note);
            showToast('Transaksi berhasil dicatat', 'success');
        }

        closeTransactionModal();
        rerenderCurrentView();

        // Peringatan budget setelah pengeluaran tersimpan
        if (type === 'expense') {
            const hit = getBudgetsForTransaction({ date, categoryId }).filter(b => b.percentage >= 75);
            const over = hit.filter(b => b.percentage >= 100);
            if (over.length) showToast('Budget terlampaui: ' + over.map(b => b.name).join(', '), 'warning');
            else if (hit.length) showToast('Budget hampir habis: ' + hit.map(b => b.name).join(', '), 'warning');
        }
    } catch (err) {
        showToast('Gagal menyimpan transaksi: ' + err.message, 'error');
    }
}

// ============================================================================
// REPORTS VIEW
// ============================================================================

function setupReportEvents() {
    // Tab selector (Ringkasan vs Grafik)
    const tabRingkasan = $('#tab-ringkasan');
    const tabGrafik = $('#tab-grafik');

    if (tabRingkasan) {
        tabRingkasan.addEventListener('click', () => {
            currentReportTab = 'ringkasan';
            updateReportTabs();
        });
    }
    if (tabGrafik) {
        tabGrafik.addEventListener('click', () => {
            currentReportTab = 'grafik';
            updateReportTabs();
        });
    }

    // Month filter
    const reportMonth = $('#report-month');
    if (reportMonth) {
        reportMonth.value = currentYearMonthISO();
        reportMonth.addEventListener('change', () => renderReports());
    }

    // Download Excel Button
    const btnDownloadExcel = $('#btn-download-excel');
    if (btnDownloadExcel) {
        btnDownloadExcel.addEventListener('click', () => handleExcelExport());
    }
}

function updateReportTabs() {
    const tabRingkasan = $('#tab-ringkasan');
    const tabGrafik = $('#tab-grafik');
    const contentRingkasan = $('#content-ringkasan');
    const contentGrafik = $('#content-grafik');

    const isRingkasan = currentReportTab === 'ringkasan';

    if (tabRingkasan) {
        tabRingkasan.className = `report-tab flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${isRingkasan ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`;
    }
    if (tabGrafik) {
        tabGrafik.className = `report-tab flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${!isRingkasan ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`;
    }

    if (contentRingkasan) contentRingkasan.classList.toggle('hidden', !isRingkasan);
    if (contentGrafik) contentGrafik.classList.toggle('hidden', isRingkasan);

    if (!isRingkasan) {
        renderReportCharts();
    }
    refreshIcons();
}

export function renderReports() {
    const reportMonthInput = $('#report-month');
    let month = getCurrentMonth();
    let year = getCurrentYear();

    if (reportMonthInput && reportMonthInput.value) {
        const [yyyy, mm] = reportMonthInput.value.split('-');
        year = parseInt(yyyy, 10);
        month = parseInt(mm, 10);
    }

    // 1. Monthly Summary Cards
    const summary = getMonthlySummary(month, year);

    const totalIncomeEl = $('#report-total-income');
    if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(summary.totalIncome);

    const totalExpenseEl = $('#report-total-expense');
    if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(summary.totalExpense);

    const netEl = $('#report-net');
    if (netEl) {
        netEl.textContent = formatCurrency(summary.net);
        netEl.className = `text-sm lg:text-base font-bold mt-1 ${summary.net >= 0 ? 'text-indigo-600' : 'text-rose-600'}`;
    }

    // 2. Budget Usage Progress Bars
    renderBudgetBars(month, year);

    // 3. Render charts if currently on Grafik tab
    if (currentReportTab === 'grafik') {
        renderReportCharts();
    }

    refreshIcons();
}

export function renderBudgetBars(month, year) {
    const container = $('#report-budget-usage');
    if (!container) return;

    const usageList = getBudgetUsage(month, year);
    const withBudget = usageList.filter(u => u.budget_limit > 0);

    if (withBudget.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center">
                <i data-lucide="target" class="w-8 h-8 text-slate-200 mx-auto mb-2"></i>
                <p class="text-xs text-slate-400">Belum ada kategori pengeluaran dengan batas anggaran</p>
                <p class="text-[11px] text-slate-300 mt-1">Atur batas anggaran di menu Pengaturan → Kategori</p>
            </div>
        `;
        return;
    }

    container.innerHTML = withBudget.map(item => {
        const pct = Math.round(item.percentage);
        let barColor = 'bg-emerald-500';
        let textColor = 'text-emerald-700';

        if (pct > 100) {
            barColor = 'bg-rose-500';
            textColor = 'text-rose-600';
        } else if (pct > 75) {
            barColor = 'bg-amber-500';
            textColor = 'text-amber-600';
        }

        return `
            <div class="p-4 space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold text-slate-700">${item.category_name}</span>
                    <span class="text-xs font-bold ${textColor}">${pct}%</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div class="${barColor} h-2.5 rounded-full progress-bar-fill" style="width: ${Math.min(pct, 100)}%"></div>
                </div>
                <div class="flex items-center justify-between text-xs text-slate-400">
                    <span>Terpakai: <strong class="text-slate-600">${formatCurrency(item.spent)}</strong></span>
                    <span>Batas: <strong class="text-slate-600">${formatCurrency(item.budget_limit)}</strong></span>
                </div>
            </div>
        `;
    }).join('');
}

function renderReportCharts() {
    const reportMonthInput = $('#report-month');
    let month = getCurrentMonth();
    let year = getCurrentYear();

    if (reportMonthInput && reportMonthInput.value) {
        const [yyyy, mm] = reportMonthInput.value.split('-');
        year = parseInt(yyyy, 10);
        month = parseInt(mm, 10);
    }

    destroyCharts();
    renderPieChart(month, year);
    renderBudgetChart();
    renderBarChart(6);
}

// ============================================================================
// SETTINGS VIEW (PENGATURAN)
// ============================================================================

function setupSettingsEvents() {
    // Add Account Button
    const btnAddAccount = $('#btn-add-account');
    if (btnAddAccount) {
        btnAddAccount.addEventListener('click', () => openAccountModal());
    }

    // Account Form Submit
    const formAccount = $('#form-account');
    if (formAccount) {
        formAccount.addEventListener('submit', (e) => {
            e.preventDefault();
            handleAccountSubmit();
        });
    }

    // Category Tabs (Income vs Expense)
    const tabCatIncome = $('#tab-cat-income');
    const tabCatExpense = $('#tab-cat-expense');

    if (tabCatIncome) {
        tabCatIncome.addEventListener('click', () => {
            currentCategoryTab = 'income';
            updateCategoryTabs();
        });
    }
    if (tabCatExpense) {
        tabCatExpense.addEventListener('click', () => {
            currentCategoryTab = 'expense';
            updateCategoryTabs();
        });
    }

    // Add Category Button
    const btnAddCategory = $('#btn-add-category');
    if (btnAddCategory) {
        btnAddCategory.addEventListener('click', () => openCategoryModal(null, currentCategoryTab));
    }

    // Category Form Submit
    const formCategory = $('#form-category');
    if (formCategory) {
        formCategory.addEventListener('submit', (e) => {
            e.preventDefault();
            handleCategorySubmit();
        });
    }

    // Category Type Radio Change in Modal (toggle budget input)
    const catTypeRadios = document.querySelectorAll('input[name="cat-type"]');
    catTypeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const budgetGroup = $('#cat-budget-group');
            if (budgetGroup) {
                budgetGroup.style.display = radio.value === 'expense' ? 'block' : 'none';
            }
        });
    });

    // Backup & Restore
    const btnBackupDownload = $('#btn-backup-download');
    if (btnBackupDownload) {
        btnBackupDownload.addEventListener('click', () => handleBackupDownload());
    }

    const inputRestoreBackup = $('#input-restore-backup');
    if (inputRestoreBackup) {
        inputRestoreBackup.addEventListener('change', (e) => handleRestoreUpload(e));
    }

    const btnExportExcel = $('#btn-export-excel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => handleExcelExport());
    }

    // Security & PIN Events
    setupSecurityEvents();
}

function setupSecurityEvents() {
    // 1. Manage PIN Button (Atur PIN / Ubah PIN)
    const btnManagePin = $('#btn-manage-pin');
    if (btnManagePin) {
        btnManagePin.addEventListener('click', () => {
            openPinModal();
        });
    }

    // 2. Set/Change PIN Form Submit
    const formSetPin = $('#form-set-pin');
    if (formSetPin) {
        formSetPin.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handlePinSubmit();
        });
    }

    // 3. Disable PIN Button
    const btnDisablePin = $('#btn-disable-pin');
    if (btnDisablePin) {
        btnDisablePin.addEventListener('click', () => {
            openDisablePinModal();
        });
    }

    // 4. Disable PIN Form Submit
    const formDisablePin = $('#form-disable-pin');
    if (formDisablePin) {
        formDisablePin.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleDisablePinSubmit();
        });
    }

    // 5. Auto-lock Select Change
    const selectAutolock = $('#select-autolock');
    if (selectAutolock) {
        selectAutolock.addEventListener('change', (e) => {
            setAutolockSetting(e.target.value);
            showToast('Pengaturan kunci otomatis disimpan', 'success');
        });
    }

    // 6. Lock Now Button
    const btnLockNow = $('#btn-lock-now');
    if (btnLockNow) {
        btnLockNow.addEventListener('click', () => {
            if (window.appUI && window.appUI.lockApp) {
                window.appUI.lockApp();
            }
        });
    }
}

export function renderSettings() {
    renderSecuritySettings();
    renderAccounts();
    renderCategories();
    refreshIcons();
}

export function renderSecuritySettings() {
    const isEnabled = isPinEnabled();
    const pinStatusText = $('#pin-status-text');
    const btnManagePin = $('#btn-manage-pin');
    const btnDisablePin = $('#btn-disable-pin');
    const selectAutolock = $('#select-autolock');

    if (pinStatusText) {
        pinStatusText.innerHTML = isEnabled
            ? '<span class="text-emerald-600 font-medium">Aktif · Terlindungi PIN</span>'
            : '<span class="text-amber-600 font-medium">Nonaktif · Aplikasi Terbuka Bebas</span>';
    }

    if (btnManagePin) {
        btnManagePin.textContent = isEnabled ? 'Ubah PIN' : 'Atur PIN';
    }

    if (btnDisablePin) {
        btnDisablePin.classList.toggle('hidden', !isEnabled);
    }

    if (selectAutolock) {
        selectAutolock.value = getAutolockSetting();
    }
}

function openPinModal() {
    const modal = $('#modal-set-pin');
    if (!modal) return;

    const isEnabled = isPinEnabled();
    const modalTitle = $('#modal-pin-title');
    const btnSubmitText = $('#btn-pin-submit-text');
    const currentGroup = $('#pin-current-group');
    const currentInput = $('#input-current-pin');
    const newInput = $('#input-new-pin');
    const confirmInput = $('#input-confirm-pin');

    if (currentInput) currentInput.value = '';
    if (newInput) newInput.value = '';
    if (confirmInput) confirmInput.value = '';

    if (isEnabled) {
        if (modalTitle) modalTitle.textContent = 'Ubah PIN Keamanan';
        if (btnSubmitText) btnSubmitText.textContent = 'Perbarui PIN';
        if (currentGroup) currentGroup.classList.remove('hidden');
        if (currentInput) currentInput.required = true;
    } else {
        if (modalTitle) modalTitle.textContent = 'Atur PIN Keamanan';
        if (btnSubmitText) btnSubmitText.textContent = 'Simpan PIN';
        if (currentGroup) currentGroup.classList.add('hidden');
        if (currentInput) currentInput.required = false;
    }

    modal.classList.remove('hidden');
    refreshIcons();
}

async function handlePinSubmit() {
    const isEnabled = isPinEnabled();
    const currentInput = $('#input-current-pin');
    const newInput = $('#input-new-pin');
    const confirmInput = $('#input-confirm-pin');

    const currentPin = currentInput ? currentInput.value.trim() : '';
    const newPin = newInput ? newInput.value.trim() : '';
    const confirmPin = confirmInput ? confirmInput.value.trim() : '';

    if (isEnabled) {
        if (!currentPin) {
            showToast('Masukkan PIN saat ini', 'warning');
            return;
        }
        const isCurrentValid = await verifyPin(currentPin);
        if (!isCurrentValid) {
            showToast('PIN saat ini tidak cocok', 'error');
            return;
        }
    }

    if (!newPin || newPin.length < 4) {
        showToast('PIN baru minimal harus 4 digit angka', 'warning');
        return;
    }

    if (newPin !== confirmPin) {
        showToast('Konfirmasi PIN baru tidak cocok', 'warning');
        return;
    }

    try {
        await setupNewPin(newPin);
        showToast('PIN keamanan berhasil disimpan! Aplikasi kini terlindungi.', 'success');
        closeModalById('modal-set-pin');
        renderSecuritySettings();
    } catch (err) {
        showToast('Gagal mengatur PIN: ' + err.message, 'error');
    }
}

function openDisablePinModal() {
    const modal = $('#modal-disable-pin');
    const input = $('#input-verify-disable-pin');
    if (input) input.value = '';
    if (modal) {
        modal.classList.remove('hidden');
        refreshIcons();
    }
}

async function handleDisablePinSubmit() {
    const input = $('#input-verify-disable-pin');
    const pin = input ? input.value.trim() : '';

    if (!pin) {
        showToast('Masukkan PIN untuk konfirmasi', 'warning');
        return;
    }

    try {
        await disablePin(pin);
        showToast('Proteksi PIN telah dinonaktifkan', 'info');
        closeModalById('modal-disable-pin');
        renderSecuritySettings();
    } catch (err) {
        showToast('Gagal mematikan PIN: ' + err.message, 'error');
    }
}

// --- Accounts Management ---

export function renderAccounts() {
    const listEl = $('#account-list');
    if (!listEl) return;

    const accounts = getAllAccounts();

    if (accounts.length === 0) {
        listEl.innerHTML = `
            <div class="p-6 text-center">
                <i data-lucide="wallet" class="w-8 h-8 text-slate-200 mx-auto mb-2"></i>
                <p class="text-xs text-slate-400">Belum ada akun dompet atau rekening</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = accounts.map(acc => {
        const balance = getAccountBalance(acc.id);
        const iconEmoji = iconBadge(acc.type === 'bank' ? 'fa-solid fa-building-columns|#3B82F6' : (acc.type === 'e-wallet' ? 'fa-solid fa-mobile-screen-button|#A855F7' : 'fa-solid fa-wallet|#10B981'), { size: 40 });

        return `
            <div class="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div class="flex items-center gap-3">
                    ${iconEmoji}
                    <div>
                        <p class="text-sm font-bold text-slate-800">${acc.name}</p>
                        <p class="text-xs text-slate-400">Saldo: <strong class="text-indigo-600 font-semibold">${formatCurrency(balance)}</strong></p>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button class="p-2 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                            onclick="window.appUI.openAccountModal(${acc.id})" title="Edit Akun">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button class="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                            onclick="window.appUI.handleAccountDelete(${acc.id})" title="Hapus Akun">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

export function openAccountModal(id = null) {
    editingAccountId = id;
    const modal = $('#modal-account');
    if (!modal) return;

    const modalTitle = $('#modal-account-title');
    const submitBtnText = $('#btn-acc-submit-text');
    const idInput = $('#acc-id');
    const nameInput = $('#acc-name');
    const balanceInput = $('#acc-balance');
    const iconSelect = $('#acc-icon');

    if (id) {
        const acc = getAccountById(id);
        if (!acc) return;
        if (modalTitle) modalTitle.textContent = 'Edit Akun';
        if (submitBtnText) submitBtnText.textContent = 'Perbarui Akun';
        if (idInput) idInput.value = acc.id;
        if (nameInput) nameInput.value = acc.name;
        if (balanceInput) balanceInput.value = formatNumberString(Math.round(acc.initial_balance)) || '0';
        if (iconSelect) iconSelect.value = acc.type || 'wallet';
    } else {
        if (modalTitle) modalTitle.textContent = 'Tambah Akun';
        if (submitBtnText) submitBtnText.textContent = 'Simpan Akun';
        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        if (balanceInput) balanceInput.value = '0';
        if (iconSelect) iconSelect.value = 'wallet';
    }

    modal.classList.remove('hidden');
    refreshIcons();
}

export function closeAccountModal() {
    closeModalById('modal-account');
    editingAccountId = null;
}

export async function handleAccountSubmit() {
    const idInput = $('#acc-id');
    const id = idInput && idInput.value ? parseInt(idInput.value, 10) : null;

    const nameInput = $('#acc-name');
    const name = nameInput ? nameInput.value.trim() : '';

    const balanceInput = $('#acc-balance');
    const initialBalance = balanceInput ? (parseAmount(balanceInput.value) || 0) : 0;

    const iconSelect = $('#acc-icon');
    const type = iconSelect ? iconSelect.value : 'cash';

    if (!name) {
        showToast('Nama akun harus diisi', 'warning');
        return;
    }

    try {
        if (id) {
            await updateAccount(id, name, type, initialBalance, type);
            showToast('Akun berhasil diperbarui', 'success');
        } else {
            await addAccount(name, type, initialBalance, type);
            showToast('Akun berhasil ditambahkan', 'success');
        }

        closeAccountModal();
        renderSettings();
        if (currentView === 'dashboard') renderDashboard();
    } catch (err) {
        showToast('Gagal menyimpan akun: ' + err.message, 'error');
    }
}

export async function handleAccountDelete(id) {
    const confirmed = await showConfirm('Hapus Akun', 'Apakah Anda yakin ingin menghapus akun ini? Akun yang memiliki riwayat transaksi tidak dapat dihapus.');
    if (!confirmed) return;

    try {
        await deleteAccount(id);
        showToast('Akun berhasil dihapus', 'success');
        renderSettings();
        if (currentView === 'dashboard') renderDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- Categories Management ---

function updateCategoryTabs() {
    const tabCatIncome = $('#tab-cat-income');
    const tabCatExpense = $('#tab-cat-expense');
    const listIncome = $('#category-income-list');
    const listExpense = $('#category-expense-list');

    const isIncome = currentCategoryTab === 'income';

    if (tabCatIncome) {
        tabCatIncome.className = `category-tab flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${isIncome ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-700'}`;
    }
    if (tabCatExpense) {
        tabCatExpense.className = `category-tab flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!isIncome ? 'bg-rose-500 text-white' : 'text-slate-500 hover:text-slate-700'}`;
    }

    if (listIncome) listIncome.classList.toggle('hidden', !isIncome);
    if (listExpense) listExpense.classList.toggle('hidden', isIncome);

    renderCategories();
}

export function renderCategories() {
    const listIncome = $('#category-income-list');
    const listExpense = $('#category-expense-list');

    const incomeCategories = getAllCategories('income');
    const expenseCategories = getAllCategories('expense');

    if (listIncome) {
        if (incomeCategories.length === 0) {
            listIncome.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Belum ada kategori pemasukan</div>`;
        } else {
            listIncome.innerHTML = incomeCategories.map(cat => renderCategoryRowHtml(cat)).join('');
        }
    }

    if (listExpense) {
        if (expenseCategories.length === 0) {
            listExpense.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Belum ada kategori pengeluaran</div>`;
        } else {
            listExpense.innerHTML = expenseCategories.map(cat => renderCategoryRowHtml(cat)).join('');
        }
    }

    refreshIcons();
}

function renderCategoryRowHtml(cat) {
    const isExpense = cat.type === 'expense';
    const budgetInfo = (isExpense && cat.budget_limit > 0)
        ? `<span class="text-xs text-slate-400">Anggaran: <strong class="text-slate-600">${formatCurrency(cat.budget_limit)}</strong>/bln</span>`
        : `<span class="text-xs text-slate-300">Tanpa batas anggaran</span>`;

    return `
        <div class="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div class="flex items-center gap-3">
                ${iconBadge(cat.icon, { size: 36 })}
                <div>
                    <p class="text-sm font-semibold text-slate-800">${cat.name}</p>
                    ${budgetInfo}
                </div>
            </div>
            <div class="flex items-center gap-1">
                <button class="p-2 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                        onclick="window.appUI.openCategoryModal(${cat.id})" title="Edit Kategori">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                </button>
                <button class="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                        onclick="window.appUI.handleCategoryDelete(${cat.id})" title="Hapus Kategori">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;
}

export function openCategoryModal(id = null, defaultType = 'expense') {
    editingCategoryId = id;
    const modal = $('#modal-category');
    if (!modal) return;

    const modalTitle = $('#modal-category-title');
    const submitBtnText = $('#btn-cat-submit-text');
    const idInput = $('#cat-id');
    const nameInput = $('#cat-name');
    const emojiInput = $('#cat-emoji');
    const budgetInput = $('#cat-budget');
    const budgetGroup = $('#cat-budget-group');

    if (id) {
        const cat = getCategoryById(id);
        if (!cat) return;
        if (modalTitle) modalTitle.textContent = 'Edit Kategori';
        if (submitBtnText) submitBtnText.textContent = 'Perbarui Kategori';
        if (idInput) idInput.value = cat.id;
        if (nameInput) nameInput.value = cat.name;
        if (catIconPicker) catIconPicker.set(cat.icon);
        if (budgetInput) budgetInput.value = cat.budget_limit ? formatNumberString(Math.round(cat.budget_limit)) : '';

        const radio = modal.querySelector(`input[name="cat-type"][value="${cat.type}"]`);
        if (radio) radio.checked = true;

        if (budgetGroup) budgetGroup.style.display = cat.type === 'expense' ? 'block' : 'none';
    } else {
        if (modalTitle) modalTitle.textContent = 'Tambah Kategori';
        if (submitBtnText) submitBtnText.textContent = 'Simpan Kategori';
        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        if (catIconPicker) catIconPicker.set('');
        if (budgetInput) budgetInput.value = '';

        const radio = modal.querySelector(`input[name="cat-type"][value="${defaultType}"]`);
        if (radio) radio.checked = true;

        if (budgetGroup) budgetGroup.style.display = defaultType === 'expense' ? 'block' : 'none';
    }

    modal.classList.remove('hidden');
    refreshIcons();
}

export function closeCategoryModal() {
    closeModalById('modal-category');
    editingCategoryId = null;
}

export async function handleCategorySubmit() {
    const idInput = $('#cat-id');
    const id = idInput && idInput.value ? parseInt(idInput.value, 10) : null;

    const typeRadio = document.querySelector('input[name="cat-type"]:checked');
    const type = typeRadio ? typeRadio.value : 'expense';

    const nameInput = $('#cat-name');
    const name = nameInput ? nameInput.value.trim() : '';

    const emojiInput = $('#cat-emoji');
    const icon = catIconPicker ? catIconPicker.get() : 'fa-solid fa-tag|#6366F1';

    const budgetInput = $('#cat-budget');
    const budgetLimit = (type === 'expense' && budgetInput) ? (parseAmount(budgetInput.value) || 0) : 0;

    if (!name) {
        showToast('Nama kategori harus diisi', 'warning');
        return;
    }

    try {
        if (id) {
            await updateCategory(id, name, type, budgetLimit, icon);
            showToast('Kategori berhasil diperbarui', 'success');
        } else {
            await addCategory(name, type, budgetLimit, icon);
            showToast('Kategori berhasil ditambahkan', 'success');
        }

        closeCategoryModal();
        renderCategories();
    } catch (err) {
        showToast('Gagal menyimpan kategori: ' + err.message, 'error');
    }
}

export async function handleCategoryDelete(id) {
    const confirmed = await showConfirm('Hapus Kategori', 'Apakah Anda yakin ingin menghapus kategori ini? Kategori yang memiliki transaksi tidak dapat dihapus.');
    if (!confirmed) return;

    try {
        await deleteCategory(id);
        showToast('Kategori berhasil dihapus', 'success');
        renderCategories();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- Data & Backup ---

export function handleBackupDownload() {
    try {
        const data = exportDatabase();
        if (!data) {
            showToast('Gagal membuat berkas backup', 'error');
            return;
        }

        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');

        a.href = url;
        a.download = `keuangan_keluarga_${yyyy}-${mm}-${dd}.sqlite`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Backup database SQLite berhasil diunduh', 'success');
    } catch (err) {
        showToast('Gagal membuat backup: ' + err.message, 'error');
    }
}

export function handleRestoreUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const arrayBuffer = event.target.result;
            const uint8 = new Uint8Array(arrayBuffer);
            await importDatabase(uint8);
            showToast('Database berhasil dipulihkan!', 'success');
            rerenderCurrentView();
        } catch (err) {
            showToast('Gagal memulihkan database: ' + err.message, 'error');
        }
    };
    reader.onerror = () => {
        showToast('Gagal membaca berkas restore', 'error');
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
}

export function handleExcelExport() {
    try {
        exportToExcel();
        showToast('Laporan Excel berhasil diunduh', 'success');
    } catch (err) {
        showToast('Gagal mengekspor Excel: ' + err.message, 'error');
    }
}

// ============================================================================
// GENERAL MODAL HELPERS
// ============================================================================

function closeModalById(modalId) {
    const modal = $(`#${modalId}`);
    if (modal) {
        modal.classList.add('hidden');
    }
}

function rerenderCurrentView() {
    switch (currentView) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'transaksi':
            renderTransactions();
            break;
        case 'budget':
            renderBudgets();
            break;
        case 'laporan':
            renderReports();
            break;
        case 'pengaturan':
            renderSettings();
            break;
    }
    refreshIcons();
}
