// =============================================================================
// budget.js — Fitur Budget (harian / mingguan / bulanan)
// Keuangan Keluarga - Household Accounting App
// =============================================================================

import {
    getAllCategories, getBudgetById, getBudgetStatuses, getMonthlyIncome, getMonthlyExpense,
    addBudget, updateBudget, deleteBudget
} from './db.js';
import {
    formatCurrency, formatDate, formatNumberString, attachNumberInputFormatter,
    parseAmount, showToast, showConfirm, getCurrentMonth, getCurrentYear, $
} from './utils.js';

const PERIOD_LABEL = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' };
let onChange = () => {};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const emoji = (icon) => (icon && /\p{Extended_Pictographic}/u.test(icon)) ? icon : '🏷️';
const refreshIcons = () => { if (window.lucide?.createIcons) window.lucide.createIcons(); };

// Warna sesuai SRS: hijau < 75%, kuning 75-99%, merah >= 100%
function tone(pct) {
    if (pct >= 100) return { bar: 'bg-rose-500', text: 'text-rose-600', badge: 'bg-rose-50 text-rose-600 border-rose-200', label: 'Melebihi budget' };
    if (pct >= 75) return { bar: 'bg-amber-500', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-600 border-amber-200', label: 'Mendekati batas' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200', label: 'Aman' };
}

function rangeLabel(b) {
    return b.period_type === 'daily' ? formatDate(b.start) : `${formatDate(b.start)} – ${formatDate(b.end)}`;
}

// ---------------------------------------------------------------------------
// Halaman Budget
// ---------------------------------------------------------------------------
// Ringkasan: hubungan budget bulanan dengan pemasukan & pengeluaran bulan berjalan
function renderBudgetSummary(items) {
    const el = $('#budget-summary');
    if (!el) return;
    const m = getCurrentMonth(), y = getCurrentYear();
    const income = getMonthlyIncome(m, y), expense = getMonthlyExpense(m, y);
    const monthly = items.filter(b => b.is_active && b.period_type === 'monthly');
    const perCat = monthly.filter(b => b.category_id);
    const alloc = (perCat.length ? perCat : monthly).reduce((s, b) => s + b.amount_limit, 0);
    const spentPct = income > 0 ? Math.round(expense / income * 100) : null;
    const allocPct = income > 0 ? Math.round(alloc / income * 100) : null;
    const free = income - alloc;
    const cell = (label, val, cls = 'text-slate-800', sub = '') => `
        <div class="bg-white rounded-xl border border-slate-100 p-3">
            <p class="text-[10px] text-slate-400 uppercase tracking-wider">${label}</p>
            <p class="text-sm font-bold mt-0.5 ${cls} break-words">${val}</p>${sub ? `<p class="text-[10px] text-slate-400 mt-0.5">${sub}</p>` : ''}
        </div>`;
    el.innerHTML = `
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            ${cell('Pemasukan bulan ini', formatCurrency(income), 'text-emerald-600')}
            ${cell('Pengeluaran bulan ini', formatCurrency(expense), 'text-rose-600', spentPct === null ? '' : `${spentPct}% dari pemasukan`)}
            ${cell('Total budget bulanan', formatCurrency(alloc), 'text-indigo-600', allocPct === null ? '' : `${allocPct}% dari pemasukan`)}
            ${cell('Belum dialokasikan', formatCurrency(free), free >= 0 ? 'text-slate-800' : 'text-rose-600', 'Pemasukan − budget bulanan')}
        </div>
        ${income > 0 && alloc > income ? '<p class="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-2.5">Total budget bulanan melebihi pemasukan bulan ini.</p>' : ''}`;
}

export function renderBudgets() {
    const list = $('#budget-list');
    if (!list) return;
    const items = getBudgetStatuses();
    renderBudgetSummary(items);

    if (!items.length) {
        list.innerHTML = `
            <div class="bg-white rounded-xl border border-slate-100 p-8 text-center">
                <i data-lucide="target" class="w-12 h-12 text-slate-200 mx-auto mb-3"></i>
                <p class="text-sm text-slate-500 font-medium">Belum ada budget</p>
                <p class="text-xs text-slate-400 mt-1">Buat budget harian, mingguan, atau bulanan untuk mengontrol pengeluaran.</p>
            </div>`;
        refreshIcons();
        return;
    }

    list.innerHTML = items.map(b => {
        const pct = Math.round(b.percentage);
        const t = tone(b.percentage);
        const scope = b.category_id ? `${emoji(b.category_icon)} ${esc(b.category_name || 'Kategori')}` : '🧾 Semua pengeluaran';
        const sisa = b.remaining >= 0
            ? `Sisa <b class="${t.text}">${formatCurrency(b.remaining)}</b>`
            : `Lebih <b class="text-rose-600">${formatCurrency(-b.remaining)}</b>`;
        const safe = b.period_type !== 'daily' && b.is_active
            ? `<p class="text-[11px] text-slate-400">Aman dibelanjakan ± <b>${formatCurrency(b.dailySafe)}</b>/hari (${b.daysLeft} hari tersisa)</p>` : '';
        return `
        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-2.5 ${b.is_active ? '' : 'opacity-60'}">
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-sm font-bold text-slate-800 truncate">${esc(b.name)}</p>
                    <p class="text-[11px] text-slate-400">${scope} · ${rangeLabel(b)}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">${PERIOD_LABEL[b.period_type]}</span>
                    <button data-budget-edit="${b.id}" class="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400" title="Edit"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    <button data-budget-delete="${b.id}" class="w-8 h-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-slate-400 hover:text-rose-500" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div class="${t.bar} h-2.5 rounded-full progress-bar-fill" style="width:${Math.min(pct, 100)}%"></div>
            </div>
            <div class="flex items-center justify-between text-xs">
                <span class="text-slate-600">${formatCurrency(b.spent)} <span class="text-slate-400">/ ${formatCurrency(b.amount_limit)}</span></span>
                <span class="font-bold ${t.text}">${pct}%</span>
            </div>
            <div class="flex items-center justify-between text-xs text-slate-500">
                <span>${sisa}</span>
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${t.badge}">${b.is_active ? t.label : 'Nonaktif'}</span>
            </div>
            ${safe}
        </div>`;
    }).join('');
    refreshIcons();
}

// Peringatan di Dashboard (menggantikan peringatan lama berbasis kategori)
export function renderBudgetAlerts(container) {
    if (!container) return;
    const active = getBudgetStatuses(true);
    const alerts = active.filter(b => b.percentage >= 75).sort((a, b) => b.percentage - a.percentage);

    if (!active.length) {
        container.innerHTML = `<div class="bg-white rounded-xl p-4 border border-slate-100 text-center"><p class="text-xs text-slate-400">Belum ada budget. Buat di menu Budget.</p></div>`;
        return;
    }
    if (!alerts.length) {
        container.innerHTML = `
            <div class="bg-white rounded-xl p-4 border border-slate-100 flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><i data-lucide="shield-check" class="w-4 h-4"></i></div>
                <div><p class="text-xs font-semibold text-slate-700">Semua Budget Aman</p>
                <p class="text-[11px] text-slate-400">Pengeluaran masih di bawah 75% dari batas.</p></div>
            </div>`;
        return;
    }
    container.innerHTML = alerts.map(b => {
        const pct = Math.round(b.percentage), t = tone(b.percentage);
        return `
        <div class="bg-white rounded-xl p-3.5 border ${t.badge} space-y-2">
            <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-slate-800 truncate">${esc(b.name)} <span class="font-normal text-slate-400">· ${PERIOD_LABEL[b.period_type]}</span></span>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full border ${t.badge} shrink-0">${pct}% ${b.percentage >= 100 ? 'Melebihi' : 'Hampir Habis'}</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div class="${t.bar} h-2 rounded-full" style="width:${Math.min(pct, 100)}%"></div></div>
            <div class="flex items-center justify-between text-[11px] text-slate-500">
                <span>Terpakai: ${formatCurrency(b.spent)}</span><span>Batas: ${formatCurrency(b.amount_limit)}</span>
            </div>
        </div>`;
    }).join('');
}

// ---------------------------------------------------------------------------
// Modal tambah / edit
// ---------------------------------------------------------------------------
function openBudgetModal(id = null) {
    const modal = $('#modal-budget');
    if (!modal) return;
    const b = id ? getBudgetById(id) : null;
    if (id && !b) return;

    $('#budget-id').value = b ? b.id : '';
    $('#modal-budget-title').textContent = b ? 'Edit Budget' : 'Buat Budget';
    $('#btn-budget-submit-text').textContent = b ? 'Perbarui Budget' : 'Simpan Budget';
    $('#budget-name').value = b ? b.name : '';
    $('#budget-amount').value = b ? formatNumberString(Math.round(b.amount_limit)) : '';
    $('#budget-active').checked = b ? !!b.is_active : true;

    const period = b ? b.period_type : 'monthly';
    const radio = document.querySelector(`input[name="budget-period"][value="${period}"]`);
    if (radio) radio.checked = true;

    const cats = getAllCategories('expense');
    $('#budget-category').innerHTML = `<option value="">Semua pengeluaran (global)</option>` +
        cats.map(c => `<option value="${c.id}" ${b && b.category_id === c.id ? 'selected' : ''}>${emoji(c.icon)} ${esc(c.name)}</option>`).join('');

    modal.classList.remove('hidden');
    refreshIcons();
}

function closeBudgetModal() { $('#modal-budget')?.classList.add('hidden'); }

async function handleBudgetSubmit() {
    const id = $('#budget-id').value ? parseInt($('#budget-id').value, 10) : null;
    const name = $('#budget-name').value.trim();
    const amount = parseAmount($('#budget-amount').value);
    const periodType = document.querySelector('input[name="budget-period"]:checked')?.value || 'monthly';
    const categoryId = $('#budget-category').value ? parseInt($('#budget-category').value, 10) : null;
    const isActive = $('#budget-active').checked ? 1 : 0;

    if (!name) return showToast('Nama budget harus diisi', 'warning');
    if (!(amount > 0)) return showToast('Batas budget harus lebih dari 0', 'warning');

    try {
        const payload = { name, categoryId, periodType, amountLimit: amount, isActive };
        if (id) await updateBudget(id, payload); else await addBudget(payload);
        showToast(id ? 'Budget diperbarui' : 'Budget dibuat', 'success');
        closeBudgetModal();
        onChange();
    } catch (err) {
        showToast('Gagal menyimpan budget: ' + err.message, 'error');
    }
}

async function handleBudgetDelete(id) {
    const ok = await showConfirm('Hapus Budget', 'Budget ini akan dihapus. Transaksi tidak terpengaruh.');
    if (!ok) return;
    try { await deleteBudget(id); showToast('Budget dihapus', 'success'); onChange(); }
    catch (err) { showToast(err.message, 'error'); }
}

// ---------------------------------------------------------------------------
// Init (dipanggil dari ui.js)
// ---------------------------------------------------------------------------
export function initBudgetUI(rerender) {
    if (typeof rerender === 'function') onChange = rerender;
    attachNumberInputFormatter($('#budget-amount'));

    $('#btn-add-budget')?.addEventListener('click', () => openBudgetModal());
    $('#form-budget')?.addEventListener('submit', (e) => { e.preventDefault(); handleBudgetSubmit(); });
    $('#budget-list')?.addEventListener('click', (e) => {
        const edit = e.target.closest('[data-budget-edit]');
        const del = e.target.closest('[data-budget-delete]');
        if (edit) openBudgetModal(parseInt(edit.dataset.budgetEdit, 10));
        else if (del) handleBudgetDelete(parseInt(del.dataset.budgetDelete, 10));
    });
}
