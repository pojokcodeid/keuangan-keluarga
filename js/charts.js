// =============================================================================
// charts.js — Chart Rendering Module (Chart.js)
// Keuangan Keluarga - Household Accounting App
// =============================================================================

import { getExpenseByCategory, getIncomeVsExpense } from './db.js';
import { formatCurrency, getMonthName } from './utils.js';

// ---------------------------------------------------------------------------
// Module-level chart instances (for destroy before re-create)
// ---------------------------------------------------------------------------
let pieChartInstance = null;
let barChartInstance = null;

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
    Chart.defaults.font.size = 12;
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

            // Label
            c.font = "500 11px 'Inter', system-ui, sans-serif";
            c.fillStyle = '#9CA3AF';
            c.fillText('Total Pengeluaran', centerX, centerY - 12);

            // Amount
            c.font = "700 14px 'Inter', system-ui, sans-serif";
            c.fillStyle = '#1F2937';
            const formatted = formatCurrency(totalExpense);
            c.fillText(formatted, centerX, centerY + 10);

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
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        generateLabels(chart) {
                            const dataset = chart.data.datasets[0];
                            return chart.data.labels.map((label, i) => {
                                const value = dataset.data[i];
                                const pct = totalExpense > 0 ? ((value / totalExpense) * 100).toFixed(1) : 0;
                                return {
                                    text: `${label} (${pct}%)`,
                                    fillStyle: colors[i],
                                    strokeStyle: colors[i],
                                    hidden: false,
                                    index: i,
                                    pointStyle: 'circle',
                                };
                            });
                        }
                    }
                },
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

    const labels = data.map(d => getMonthName(d.month));
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
                    borderRadius: 6,
                    borderSkipped: false,
                },
                {
                    label: 'Pengeluaran',
                    data: expenseData,
                    backgroundColor: '#F43F5E',
                    borderColor: '#E11D48',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
                }
            ]
        },
        options: {
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'circle',
                    }
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
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback(value) {
                            return formatAxisLabel(value);
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
export function destroyCharts() {
    if (pieChartInstance) {
        pieChartInstance.destroy();
        pieChartInstance = null;
    }
    if (barChartInstance) {
        barChartInstance.destroy();
        barChartInstance = null;
    }
}
