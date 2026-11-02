// =============================================================================
// export.js — Excel Export Module (SheetJS / XLSX)
// Keuangan Keluarga - Household Accounting Web App
// =============================================================================

import {
    getAllTransactions,
    getAllMonthlySummaries,
    getAllAccounts,
    getAccountBalance
} from './db.js';

import { getMonthName, getCurrentMonth, getCurrentYear } from './utils.js';

// ---------------------------------------------------------------------------
// Type label mapping (Indonesian)
// ---------------------------------------------------------------------------
const TYPE_LABELS = {
    income: 'Pemasukan',
    expense: 'Pengeluaran',
    transfer: 'Transfer Antar-Akun'
};

const ACCOUNT_TYPE_LABELS = {
    cash: 'Dompet / Kas Tunai',
    wallet: 'Dompet / Kas Tunai',
    bank: 'Rekening Bank',
    'e-wallet': 'E-Wallet',
    savings: 'Tabungan',
    other: 'Lainnya'
};

/**
 * Helper to trigger file download via Blob (Universal & Mobile Friendly)
 */
function downloadWorkbook(wb, filename) {
    const XLSX = window.XLSX;

    try {
        // Generate XLSX binary as ArrayBuffer
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (fallbackErr) {
        // Fallback to built-in SheetJS writeFile if Blob array fails
        console.warn('Blob export failed, trying XLSX.writeFile:', fallbackErr);
        XLSX.writeFile(wb, filename);
    }
}

/**
 * Export financial data to an Excel (.xlsx) workbook with multiple worksheets.
 * @param {object} [filters] - Optional filters { month, year, account_id, category_id, type }
 */
export function exportToExcel(filters) {
    const XLSX = window.XLSX;
    if (!XLSX) {
        throw new Error('Pustaka SheetJS (XLSX) belum siap atau gagal dimuat dari CDN. Periksa koneksi internet Anda.');
    }

    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // ==================================================================
    // Worksheet 1: Detail Transaksi
    // ==================================================================
    const transactions = getAllTransactions(filters);

    const txHeaders = ['No', 'Tanggal', 'Jenis', 'Akun Asal', 'Akun Tujuan', 'Kategori', 'Nominal (Rp)', 'Catatan'];
    let txRows = [];

    if (transactions.length === 0) {
        txRows = [
            ['-', '-', 'Belum ada data transaksi', '-', '-', '-', 0, '-']
        ];
    } else {
        txRows = transactions.map((tx, idx) => [
            idx + 1,
            tx.transaction_date || '',
            TYPE_LABELS[tx.type] || tx.type,
            tx.account_name || '-',
            tx.to_account_name || '-',
            tx.category_name || (tx.type === 'transfer' ? 'Transfer' : 'Tanpa Kategori'),
            Number(tx.amount) || 0,
            tx.note || ''
        ]);
    }

    const txData = [txHeaders, ...txRows];
    const wsTransactions = XLSX.utils.aoa_to_sheet(txData);

    // Column widths
    wsTransactions['!cols'] = [
        { wch: 6 },   // No
        { wch: 15 },  // Tanggal
        { wch: 20 },  // Jenis
        { wch: 20 },  // Akun Asal
        { wch: 20 },  // Akun Tujuan
        { wch: 22 },  // Kategori
        { wch: 18 },  // Nominal
        { wch: 35 }   // Catatan
    ];

    // Auto-filter on header row if there are rows
    if (transactions.length > 0) {
        wsTransactions['!autofilter'] = {
            ref: XLSX.utils.encode_range({
                s: { r: 0, c: 0 },
                e: { r: txRows.length, c: txHeaders.length - 1 }
            })
        };
    }

    XLSX.utils.book_append_sheet(wb, wsTransactions, 'Detail Transaksi');

    // ==================================================================
    // Worksheet 2: Ringkasan Bulanan
    // ==================================================================
    let monthlySummaries = getAllMonthlySummaries();

    if (!monthlySummaries || monthlySummaries.length === 0) {
        monthlySummaries = [{
            year: getCurrentYear(),
            month: getCurrentMonth(),
            income: 0,
            expense: 0
        }];
    }

    const msHeaders = ['Bulan', 'Tahun', 'Total Pemasukan (Rp)', 'Total Pengeluaran (Rp)', 'Selisih Bersih (Rp)'];
    let totalAllIncome = 0;
    let totalAllExpense = 0;

    const msRows = monthlySummaries.map(row => {
        const monthName = getMonthName(row.month);
        const income = Number(row.income) || 0;
        const expense = Number(row.expense) || 0;
        const net = income - expense;

        totalAllIncome += income;
        totalAllExpense += expense;

        return [monthName, row.year, income, expense, net];
    });

    // Add TOTAL summary row
    const totalAllNet = totalAllIncome - totalAllExpense;
    msRows.push(['TOTAL KESELURUHAN', '', totalAllIncome, totalAllExpense, totalAllNet]);

    const msData = [msHeaders, ...msRows];
    const wsSummary = XLSX.utils.aoa_to_sheet(msData);

    wsSummary['!cols'] = [
        { wch: 22 },  // Bulan
        { wch: 10 },  // Tahun
        { wch: 24 },  // Total Pemasukan
        { wch: 24 },  // Total Pengeluaran
        { wch: 24 }   // Selisih Bersih
    ];

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Bulanan');

    // ==================================================================
    // Worksheet 3: Saldo Akun & Dompet
    // ==================================================================
    const accounts = getAllAccounts();

    const acHeaders = ['No', 'Nama Akun / Rekening', 'Jenis Akun', 'Saldo Awal (Rp)', 'Saldo Saat Ini (Rp)'];
    let acRows = [];
    let totalInitial = 0;
    let totalCurrent = 0;

    if (accounts.length === 0) {
        acRows = [['-', 'Belum ada akun', '-', 0, 0]];
    } else {
        acRows = accounts.map((acc, idx) => {
            const currentBalance = getAccountBalance(acc.id);
            const initial = Number(acc.initial_balance) || 0;
            totalInitial += initial;
            totalCurrent += currentBalance;

            return [
                idx + 1,
                acc.name || '',
                ACCOUNT_TYPE_LABELS[acc.type] || acc.type || 'Umum',
                initial,
                currentBalance
            ];
        });

        acRows.push(['TOTAL SALDO', '', '', totalInitial, totalCurrent]);
    }

    const acData = [acHeaders, ...acRows];
    const wsAccounts = XLSX.utils.aoa_to_sheet(acData);

    wsAccounts['!cols'] = [
        { wch: 6 },   // No
        { wch: 26 },  // Nama Akun
        { wch: 22 },  // Jenis Akun
        { wch: 20 },  // Saldo Awal
        { wch: 20 }   // Saldo Saat Ini
    ];

    XLSX.utils.book_append_sheet(wb, wsAccounts, 'Saldo Akun');

    // ==================================================================
    // Generate & Trigger Download
    // ==================================================================
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const filename = `Laporan_Keuangan_${yyyy}-${mm}-${dd}.xlsx`;

    downloadWorkbook(wb, filename);
}
