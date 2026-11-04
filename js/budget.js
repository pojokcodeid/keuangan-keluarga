// =============================================================================
// budget.js — Fitur Budget (harian / mingguan / bulanan) dengan ikon berwarna
// =============================================================================

import {
    getAllCategories, getBudgetById, getBudgetStatuses, getMonthlyIncome, getMonthlyExpense,
    addBudget, updateBudget, deleteBudget
} from './db.js';
import {
    formatCurrency, formatDate, formatNumberString, attachNumberInputFormatter,
    parseAmount, showToast, showConfirm, getCurrentMonth, getCurrentYear, $
} from './utils.js';
import { iconBadge, createIconPicker, resolveBudgetIcon, periodIcon, hexA } from './icons.js';

const PERIOD = {
    daily: { label: 'Harian', fa: 'fa-sun', c: '#F59E0B' },
    weekly: { label: 'Mingguan', fa: 'fa-calendar-week', c: '#3B82F6' },
    monthly: { label: 'Bulanan', fa: 'fa-calendar-days', c: '#8B5CF6' }
};
let onChange = () => {};
let picker = null;
let userPicked = false;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const faBadge = (fa, color, size = 32) => iconBadge(`fa-solid ${fa}|${color}`, { size });
const chip = (text, fa, color) => `<span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style="background:${hexA(color, 0.15)};color:${color}"><i class="fa-solid ${fa}"></i>${text}</span>`;

// Hijau < 75%, kuning 75-99%, merah >= 100% (sesuai SRS)
function tone(pct) {
    if (pct >= 100) return { c1: '#F43F5E', c2: '#FB7185', fa: 'fa-circle-xmark', label: 'Melebihi budget' };
    if (pct >= 75) return { c1: '#F59E0B', c2: '#FBBF24', fa: 'fa-triangle-exclamation', label: 'Mendekati batas' };
    return { c1: '#10B981', c2: '#34D399', fa: 'fa-circle-check', label: 'Aman' };
}
const grad = (t) => `linear-gradient(90deg,${t.c1},${t.c2})`;

function tile(fa, color, label, val) {
    return `<div class="rounded-xl bg-slate-50 p-2.5 text-center">
        <div class="text-[10px] text-slate-400 flex items-center justify-center gap-1"><i class="fa-solid ${fa}" style="color:${color}"></i>${label}</div>
        <p class="text-xs font-bold text-slate-800 mt-0.5 break-words">${val}</p></div>`;
}

// ---------------------------------------------------------------------------
// Ringkasan pemasukan / pengeluaran / budget bulan berjalan
// ---------------------------------------------------------------------------
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
    const cell = (fa, color, label, val, cls, sub) => `
        <div class="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm flex items-start gap-2.5">
            ${faBadge(fa, color, 32)}
            <div class="min-w-0"><p class="text-[10px] text-slate-400 uppercase tracking-wider">${label}</p>
            <p class="text-sm font-bold ${cls} break-words">${val}</p>${sub ? `<p class="text-[10px] text-slate-400">${sub}</p>` : ''}</div>
        </div>`;
    el.innerHTML = `
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            ${cell('fa-arrow-trend-up', '#10B981', 'Pemasukan', formatCurrency(income), 'text-emerald-600', 'Bulan ini')}
            ${cell('fa-arrow-trend-down', '#F43F5E', 'Pengeluaran', formatCurrency(expense), 'text-rose-600', spentPct === null ? 'Bulan ini' : `${spentPct}% dari pemasukan`)}
            ${cell('fa-bullseye', '#6366F1', 'Total budget', formatCurrency(alloc), 'text-indigo-600', allocPct === null ? 'Bulanan' : `${allocPct}% dari pemasukan`)}
            ${cell('fa-scale-balanced', free >= 0 ? '#14B8A6' : '#F43F5E', 'Belum dialokasi', formatCurrency(free), free >= 0 ? 'text-slate-800' : 'text-rose-600', 'Pemasukan − budget')}
        </div>
        ${income > 0 && alloc > income ? '<p class="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-2.5"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Total budget bulanan melebihi pemasukan bulan ini.</p>' : ''}`;
}

// ---------------------------------------------------------------------------
// Halaman Budget
// ---------------------------------------------------------------------------
export function renderBudgets() {
    const list = $('#budget-list');
    if (!list) return;
    const items = getBudgetStatuses();
    renderBudgetSummary(items);

    if (!items.length) {
        list.innerHTML = `
            <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <div class="flex justify-center gap-2 mb-3">${faBadge('fa-sun', '#F59E0B', 36)}${faBadge('fa-calendar-week', '#3B82F6', 36)}${faBadge('fa-calendar-days', '#8B5CF6', 36)}</div>
                <p class="text-sm text-slate-600 font-semibold">Belum ada budget</p>
                <p class="text-xs text-slate-400 mt-1">Buat budget harian, mingguan, atau bulanan untuk mengontrol pengeluaran.</p>
            </div>`;
        return;
    }

    list.innerHTML = items.map(b => {
        const pct = Math.round(b.percentage), t = tone(b.percentage), P = PERIOD[b.period_type];
        const scope = b.category_id
            ? `<span class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">${iconBadge(b.category_icon, { size: 16 })}${esc(b.category_name || 'Kategori')}</span>`
            : chip('Semua pengeluaran', 'fa-receipt', '#64748B');
        const t3 = b.period_type === 'daily'
            ? tile('fa-flag-checkered', '#6366F1', 'Batas', formatCurrency(b.amount_limit))
            : tile('fa-hourglass-half', '#6366F1', `Aman/hari`, formatCurrency(b.dailySafe));
        return `
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${b.is_active ? '' : 'opacity-60'}">
            <div class="h-1.5" style="background:${grad(t)}"></div>
            <div class="p-4 space-y-3">
                <div class="flex items-start gap-3">
                    ${iconBadge(resolveBudgetIcon(b), { size: 40 })}
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-bold text-slate-800 truncate">${esc(b.name)}</p>
                        <div class="flex flex-wrap items-center gap-1.5 mt-1">${chip(P.label, P.fa, P.c)}${scope}</div>
                    </div>
                    <div class="flex shrink-0">
                        <button data-budget-edit="${b.id}" class="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600" title="Edit"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button data-budget-delete="${b.id}" class="w-8 h-8 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500" title="Hapus"><i class="fa-solid fa-trash text-xs"></i></button>
                    </div>
                </div>
                <div>
                    <div class="flex items-end justify-between mb-1">
                        <span class="text-xl font-extrabold leading-none" style="color:${t.c1}">${pct}%</span>
                        <span class="text-[11px] text-slate-400">${formatCurrency(b.spent)} / ${formatCurrency(b.amount_limit)}</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden"><div class="h-3 rounded-full progress-bar-fill" style="width:${Math.min(pct, 100)}%;background:${grad(t)}"></div></div>
                </div>
                <div class="grid grid-cols-3 gap-2">
                    ${tile('fa-wallet', '#F43F5E', 'Terpakai', formatCurrency(b.spent))}
                    ${b.remaining >= 0 ? tile('fa-piggy-bank', '#10B981', 'Sisa', formatCurrency(b.remaining)) : tile('fa-fire', '#F43F5E', 'Lebih', formatCurrency(-b.remaining))}
                    ${t3}
                </div>
                <div class="flex items-center justify-between gap-2">
                    ${b.is_active ? chip(t.label, t.fa, t.c1) : chip('Nonaktif', 'fa-pause', '#64748B')}
                    <span class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar mr-1"></i>${b.period_type === 'daily' ? formatDate(b.start) : `${formatDate(b.start)} – ${formatDate(b.end)}`}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

// Peringatan di Dashboard
export function renderBudgetAlerts(container) {
    if (!container) return;
    const active = getBudgetStatuses(true);
    const alerts = active.filter(b => b.percentage >= 75).sort((a, b) => b.percentage - a.percentage);

    if (!active.length) {
        container.innerHTML = `<div class="bg-white rounded-xl p-4 border border-slate-100 flex items-center gap-3">${faBadge('fa-bullseye', '#6366F1', 32)}<p class="text-xs text-slate-400">Belum ada budget. Buat di menu Budget.</p></div>`;
        return;
    }
    if (!alerts.length) {
        container.innerHTML = `
            <div class="bg-white rounded-xl p-4 border border-slate-100 flex items-center gap-3">
                ${faBadge('fa-shield-heart', '#10B981', 32)}
                <div><p class="text-xs font-semibold text-slate-700">Semua Budget Aman</p>
                <p class="text-[11px] text-slate-400">Pengeluaran masih di bawah 75% dari batas.</p></div>
            </div>`;
        return;
    }
    container.innerHTML = alerts.map(b => {
        const pct = Math.round(b.percentage), t = tone(b.percentage);
        return `
        <div class="bg-white rounded-xl p-3.5 border border-slate-100 space-y-2">
            <div class="flex items-center gap-2.5">
                ${iconBadge(resolveBudgetIcon(b), { size: 32 })}
                <div class="min-w-0 flex-1"><p class="text-xs font-bold text-slate-800 truncate">${esc(b.name)}</p>
                <p class="text-[10px] text-slate-400">${PERIOD[b.period_type].label}</p></div>
                ${chip(`${pct}% ${b.percentage >= 100 ? 'Melebihi' : 'Hampir habis'}`, t.fa, t.c1)}
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div class="h-2 rounded-full" style="width:${Math.min(pct, 100)}%;background:${grad(t)}"></div></div>
            <div class="flex items-center justify-between text-[11px] text-slate-500">
                <span>Terpakai: ${formatCurrency(b.spent)}</span><span>Batas: ${formatCurrency(b.amount_limit)}</span>
            </div>
        </div>`;
    }).join('');
}

// ---------------------------------------------------------------------------
// Modal tambah / edit
// ---------------------------------------------------------------------------
const selectedPeriod = () => document.querySelector('input[name="budget-period"]:checked')?.value || 'monthly';

// Selama user belum memilih ikon sendiri, ikuti kategori (atau periode)
function autoIcon() {
    if (userPicked || !picker) return;
    const catId = parseInt($('#budget-category').value, 10);
    const cat = catId ? getAllCategories('expense').find(c => c.id === catId) : null;
    picker.set(cat ? cat.icon : periodIcon(selectedPeriod()));
}

export function openBudgetModal(id = null) {
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

    const radio = document.querySelector(`input[name="budget-period"][value="${b ? b.period_type : 'monthly'}"]`);
    if (radio) radio.checked = true;

    $('#budget-category').innerHTML = `<option value="">Semua pengeluaran (global)</option>` +
        getAllCategories('expense').map(c => `<option value="${c.id}" ${b && b.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

    userPicked = !!(b && b.icon);
    if (userPicked) picker?.set(b.icon); else autoIcon();

    modal.classList.remove('hidden');
}

function closeBudgetModal() { $('#modal-budget')?.classList.add('hidden'); }

async function handleBudgetSubmit() {
    const id = $('#budget-id').value ? parseInt($('#budget-id').value, 10) : null;
    const name = $('#budget-name').value.trim();
    const amount = parseAmount($('#budget-amount').value);
    const categoryId = $('#budget-category').value ? parseInt($('#budget-category').value, 10) : null;

    if (!name) return showToast('Nama budget harus diisi', 'warning');
    if (!(amount > 0)) return showToast('Batas budget harus lebih dari 0', 'warning');

    try {
        const payload = {
            name, categoryId, periodType: selectedPeriod(), amountLimit: amount,
            isActive: $('#budget-active').checked ? 1 : 0,
            icon: userPicked && picker ? picker.get() : null
        };
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
export function initBudgetUI(rerender) {
    if (typeof rerender === 'function') onChange = rerender;
    attachNumberInputFormatter($('#budget-amount'));
    picker = createIconPicker($('#budget-icon-picker'), { onChange: () => { userPicked = true; } });

    $('#btn-add-budget')?.addEventListener('click', () => openBudgetModal());
    $('#form-budget')?.addEventListener('submit', (e) => { e.preventDefault(); handleBudgetSubmit(); });
    $('#budget-category')?.addEventListener('change', autoIcon);
    document.querySelectorAll('input[name="budget-period"]').forEach(r => r.addEventListener('change', autoIcon));
    $('#budget-list')?.addEventListener('click', (e) => {
        const edit = e.target.closest('[data-budget-edit]');
        const del = e.target.closest('[data-budget-delete]');
        if (edit) openBudgetModal(parseInt(edit.dataset.budgetEdit, 10));
        else if (del) handleBudgetDelete(parseInt(del.dataset.budgetDelete, 10));
    });
}
