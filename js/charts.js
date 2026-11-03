// =============================================================================
// charts.js — Chart Rendering Module (Chart.js)
// Keuangan Keluarga - Household Accounting App
// =============================================================================

import { getExpenseByCategory, getIncomeVsExpense, getBudgetStatuses } from './db.js';
import { formatCurrency, getMonthName } from './utils.js';

// ---------------------------------------------------------------------------
// Module-level chart instances (for destroy before re-create)
// ---------------------------------------------------------------------------
let pieChartInstance = null;
let barChartInstance = null;
let budgetChartInstance = null;

const isMobile = () => window.innerWidth < 640;
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// ---------------------------------------------------------------------------
// Color palette for charts
// ---------------------------------------------------------------------------
const CHART_COLORS = [
    '#3B82F6', // blue
    '#EF4444', // red
    '#10B981', // emerald
    '#F59E0B', // amber
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#A855F7', // purple
    '#E11D48', // rose
    '#84CC16', // lime
    '#0EA5E9', // sky
    '#D946EF', // fuchsia
];

// ---------------------------------------------------------------------------
// Chart.js global defaults
// ---------------------------------------------------------------------------
function applyChartDefaults() {
    const Chart = window.Chart;
    if (!Chart) return;
    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.font.size = isMobile() ? 11 : 12;
    Chart.defaults.color = '#6B7280';
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
}

// ---------------------------------------------------------------------------
// Doughnut / Pie Chart — Expense by Category
// ---------------------------------------------------------------------------

/**
 * Render a doughnut chart of expense breakdown by category for a given month.
 * @param {number} month 1-12
 * @param {number} year
 */
function renderPieLegend(labels, amounts, colors, total) {
    const el = document.querySelector('#chart-expense-legend');
    if (!el) return;
    el.innerHTML = labels.map((l, i) => {
        const pct = total > 0 ? ((amounts[i] / total) * 100).toFixed(1) : '0.0';
        return `<div class="flex items-center gap-2 text-xs">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${colors[i]}"></span>
            <span class="flex-1 min-w-0 truncate text-slate-600">${esc(l)}</span>
            <span class="text-slate-400 shrink-0">${pct}%</span>
            <span class="font-semibold text-slate-700 shrink-0 w-24 text-right">${formatCurrency(amounts[i])}</span>
        </div>`;
    }).join('');
}

export function renderPieChart(month, year) {
    const Chart = window.Chart;
    if (!Chart) {
        console.warn('Chart.js not loaded');
        return;
    }
    applyChartDefaults();

    const canvas = document.querySelector('#chart-expense-category') || document.querySelector('#chart-pie');
    if (!canvas) return;

    const data = getExpenseByCategory(month, year);

    // Destroy previous instance
    if (pieChartInstance) {
        pieChartInstance.destroy();
        pieChartInstance = null;
    }

    // Empty state
    if (!data || data.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
        const lg = document.querySelector('#chart-expense-legend'); if (lg) lg.innerHTML = '';

        let emptyEl = canvas.parentElement.querySelector('.chart-empty-state');
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'chart-empty-state flex flex-col items-center justify-center py-10 text-gray-400';
            emptyEl.innerHTML = `
                <svg class="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                          d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                          d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/>
                </svg>
                <p class="text-sm font-medium">Belum ada data pengeluaran</p>
            `;
            canvas.parentElement.appendChild(emptyEl);
        }
        emptyEl.style.display = 'flex';
        return;
    }

    // Hide empty state if present
    const emptyEl = canvas.parentElement.querySelector('.chart-empty-state');
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';

    const labels = data.map(d => d.category_name || 'Tanpa Kategori');
    const amounts = data.map(d => d.total);
    const totalExpense = amounts.reduce((s, v) => s + v, 0);
    const colors = data.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

    const ctx = canvas.getContext('2d');

    // Center text plugin (inline)
    const centerTextPlugin = {
        id: 'centerText',
        afterDraw(chart) {
            const { ctx: c, chartArea } = chart;
            const centerX = (chartArea.left + chartArea.right) / 2;
            const centerY = (chartArea.top + chartArea.bottom) / 2;

            c.save();
            c.textAlign = 'center';
            c.textBaseline = 'middle';

            const inner = Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top) * 0.62;
            const formatted = formatCurrency(totalExpense);
            const f1 = Math.max(9, Math.min(11, inner / 11));
            const f2 = Math.max(10, Math.min(16, inner / (formatted.length * 0.62)));

            c.font = `500 ${f1}px 'Inter', system-ui, sans-serif`;
            c.fillStyle = '#9CA3AF';
            c.fillText('Total Pengeluaran', centerX, centerY - f2 * 0.8);

            c.font = `700 ${f2}px 'Inter', system-ui, sans-serif`;
            c.fillStyle = '#1F2937';
            c.fillText(formatted, centerX, centerY + f2 * 0.5);

            c.restore();
        }
    };

    pieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: amounts,
                backgroundColor: colors,
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 6,
            }]
        },
        options: {
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const value = context.parsed;
                            const pct = totalExpense > 0 ? ((value / totalExpense) * 100).toFixed(1) : 0;
                            return ` ${context.label}: ${formatCurrency(value)} (${pct}%)`;
                        }
                    }
                }
            }
        },
        plugins: [centerTextPlugin]
    });

    renderPieLegend(labels, amounts, colors, totalExpense);
}

// ---------------------------------------------------------------------------
// Bar Chart — Income vs Expense over months
// ---------------------------------------------------------------------------

/**
 * Format axis label for compact rupiah display.
 * @param {number} value
 * @returns {string}
 */
function formatAxisLabel(value) {
    if (value === 0) return 'Rp 0';
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
    if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`;
    if (abs >= 1_000) return `Rp ${(value / 1_000).toFixed(0)} rb`;
    return `Rp ${value}`;
}

/**
 * Render grouped bar chart comparing income vs expense over the last N months.
 * @param {number} [months=6]
 */
export function renderBarChart(months = 6) {
    const Chart = window.Chart;
    if (!Chart) {
        console.warn('Chart.js not loaded');
        return;
    }
    applyChartDefaults();

    const canvas = document.querySelector('#chart-income-expense') || document.querySelector('#chart-bar');
    if (!canvas) return;

    const data = getIncomeVsExpense(months);

    // Destroy previous instance
    if (barChartInstance) {
        barChartInstance.destroy();
        barChartInstance = null;
    }

    // Empty state
    if (!data || data.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';

        let emptyEl = canvas.parentElement.querySelector('.chart-empty-state');
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'chart-empty-state flex flex-col items-center justify-center py-10 text-gray-400';
            emptyEl.innerHTML = `
                <svg class="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
                <p class="text-sm font-medium">Belum ada data transaksi</p>
            `;
            canvas.parentElement.appendChild(emptyEl);
        }
        emptyEl.style.display = 'flex';
        return;
    }

    // Hide empty state if present
    const emptyEl = canvas.parentElement.querySelector('.chart-empty-state');
    if (emptyEl) emptyEl.style.display = 'none';
    canvas.style.display = 'block';

    const labels = data.map(d => SHORT_MONTHS[d.month - 1]);
    const incomeData = data.map(d => d.income || 0);
    const expenseData = data.map(d => d.expense || 0);

    const ctx = canvas.getContext('2d');

    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Pemasukan',
                    data: incomeData,
                    backgroundColor: '#10B981',
                    borderColor: '#059669',
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                    maxBarThickness: 28,
                },
                {
                    label: 'Pengeluaran',
                    data: expenseData,
                    backgroundColor: '#F43F5E',
                    borderColor: '#E11D48',
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                    maxBarThickness: 28,
                }
            ]
        },
        options: {
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 10, boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            return ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true },
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        maxTicksLimit: 5,
                        font: { size: 10 },
                        callback(value) {
                            const t = formatAxisLabel(value);
                            return isMobile() ? t.replace('Rp ', '') : t;
                        }
                    },
                    grid: {
                        color: '#F3F4F6',
                    }
                }
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Destroy all charts
// ---------------------------------------------------------------------------

/**
 * Destroy existing chart instances to prevent memory leaks.
 */
export function renderBudgetChart() {
    const Chart = window.Chart;
    const canvas = document.querySelector('#chart-budget-usage');
    if (!Chart || !canvas) return;
    applyChartDefaults();
    if (budgetChartInstance) { budgetChartInstance.destroy(); budgetChartInstance = null; }

    const wrap = document.querySelector('#chart-budget-wrap');
    const empty = document.querySelector('#chart-budget-empty');
    const items = getBudgetStatuses(true);
    if (!items.length) {
        if (wrap) wrap.style.display = 'none';
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (wrap) { wrap.style.display = 'block'; wrap.style.height = Math.max(150, items.length * 44 + 40) + 'px'; }
    if (empty) empty.classList.add('hidden');

    const PER = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan' };
    const maxLen = isMobile() ? 16 : 28;
    const labels = items.map(b => {
        const n = `${b.name} · ${PER[b.period_type]}`;
        return n.length > maxLen ? n.slice(0, maxLen - 1) + '…' : n;
    });
    const pcts = items.map(b => Math.round(b.percentage));
    const colors = pcts.map(p => p >= 100 ? '#F43F5E' : p >= 75 ? '#F59E0B' : '#10B981');

    const pctLabel = {
        id: 'pctLabel',
        afterDatasetsDraw(chart) {
            const c = chart.ctx;
            c.save();
            c.font = "600 10px 'Inter', system-ui, sans-serif";
            c.fillStyle = '#475569';
            c.textBaseline = 'middle';
            c.textAlign = 'left';
            chart.getDatasetMeta(0).data.forEach((bar, i) => c.fillText(pcts[i] + '%', bar.x + 4, bar.y));
            c.restore();
        }
    };

    budgetChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: [{ data: pcts, backgroundColor: colors, borderRadius: 4, maxBarThickness: 18 }] },
        options: {
            indexAxis: 'y',
            layout: { padding: { right: 34 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (ctx) => items[ctx[0].dataIndex].name,
                        label: (ctx) => {
                            const b = items[ctx.dataIndex];
                            return [` Terpakai: ${formatCurrency(b.spent)}`, ` Batas: ${formatCurrency(b.amount_limit)} (${pcts[ctx.dataIndex]}%)`];
                        }
                    }
                }
            },
            scales: {
                x: { beginAtZero: true, suggestedMax: 100, ticks: { callback: v => v + '%', maxTicksLimit: 5, font: { size: 10 } }, grid: { color: '#F3F4F6' } },
                y: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        },
        plugins: [pctLabel]
    });
}

export function destroyCharts() {
    if (budgetChartInstance) { budgetChartInstance.destroy(); budgetChartInstance = null; }
    if (pieChartInstance) {
        pieChartInstance.destroy();
        pieChartInstance = null;
    }
    if (barChartInstance) {
        barChartInstance.destroy();
        barChartInstance = null;
    }
}
