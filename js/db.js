// =============================================================================
// db.js — Database Module (sql.js / SQLite in WebAssembly)
// Keuangan Keluarga - Household Accounting App
// =============================================================================

import { showToast } from './utils.js';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------
let db = null;

const IDB_NAME = 'keuangan_keluarga_db';
const IDB_STORE = 'database';
const IDB_KEY = 'database';
const WASM_URL = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm';

// ---------------------------------------------------------------------------
// IndexedDB helpers (promise-based)
// ---------------------------------------------------------------------------

function openIDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, 1);
        request.onupgradeneeded = () => {
            const idb = request.result;
            if (!idb.objectStoreNames.contains(IDB_STORE)) {
                idb.createObjectStore(IDB_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('Gagal membuka IndexedDB: ' + request.error));
    });
}

function idbGet(idb) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(IDB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(new Error('Gagal membaca dari IndexedDB'));
    });
}

function idbPut(idb, data) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const req = store.put(data, IDB_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(new Error('Gagal menyimpan ke IndexedDB'));
    });
}

// ---------------------------------------------------------------------------
// Query result helpers
// ---------------------------------------------------------------------------

/**
 * Convert sql.js result [{columns, values}] to array of plain objects.
 */
function resultToObjects(result) {
    if (!result || result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj;
    });
}

/**
 * Run a SELECT query and return array of objects.
 */
function query(sql, params = []) {
    try {
        const result = db.exec(sql, params);
        return resultToObjects(result);
    } catch (err) {
        console.error('Query error:', sql, err);
        throw new Error('Gagal menjalankan query: ' + err.message);
    }
}

/**
 * Run an INSERT/UPDATE/DELETE statement.
 */
function run(sql, params = []) {
    try {
        db.run(sql, params);
    } catch (err) {
        console.error('Run error:', sql, err);
        throw new Error('Gagal menjalankan perintah: ' + err.message);
    }
}

/**
 * Get a single scalar value from a query.
 */
function scalar(sql, params = []) {
    const result = db.exec(sql, params);
    if (!result || result.length === 0 || result[0].values.length === 0) return null;
    return result[0].values[0][0];
}

// ---------------------------------------------------------------------------
// Schema & seed data
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'cash',
    initial_balance REAL DEFAULT 0.0,
    icon TEXT DEFAULT 'wallet',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
    budget_limit REAL DEFAULT 0.0,
    icon TEXT DEFAULT 'tag',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    to_account_id INTEGER,
    category_id INTEGER,
    type TEXT CHECK(type IN ('income', 'expense', 'transfer')) NOT NULL,
    amount REAL NOT NULL,
    transaction_date DATE NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (to_account_id) REFERENCES accounts(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER,
    period_type TEXT CHECK(period_type IN ('daily', 'weekly', 'monthly')) NOT NULL,
    amount_limit REAL NOT NULL,
    is_active INTEGER DEFAULT 1,
    icon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

// Instalasi budget versi awal belum punya kolom icon
function ensureBudgetColumns() {
    const cols = query('PRAGMA table_info(budgets)').map(c => c.name);
    if (!cols.includes('icon')) db.run('ALTER TABLE budgets ADD COLUMN icon TEXT');
}

// Migrasi satu kali: batas bulanan per kategori lama -> budget bulanan
function migrateCategoryBudgets() {
    run(`INSERT INTO budgets (name, category_id, period_type, amount_limit, is_active)
         SELECT 'Budget ' || name, id, 'monthly', budget_limit, 1
         FROM categories WHERE type = 'expense' AND budget_limit > 0`);
}

function seedData() {
    // Only seed if tables are empty
    const accountCount = scalar('SELECT COUNT(*) FROM accounts');
    const categoryCount = scalar('SELECT COUNT(*) FROM categories');

    if (accountCount === 0) {
        run("INSERT INTO accounts (name, type, icon, initial_balance) VALUES (?, ?, ?, ?)", ['Tunai', 'cash', 'wallet', 0]);
        run("INSERT INTO accounts (name, type, icon, initial_balance) VALUES (?, ?, ?, ?)", ['Bank BCA', 'bank', 'landmark', 0]);
    }

    if (categoryCount === 0) {
        // Income categories
        const incomeCategories = [
            ['Gaji', 'income', 0, 'briefcase'],
            ['Bonus', 'income', 0, 'gift'],
            ['Investasi', 'income', 0, 'trending-up'],
            ['Pendapatan Lain', 'income', 0, 'plus-circle'],
        ];
        for (const [name, type, budget, icon] of incomeCategories) {
            run("INSERT INTO categories (name, type, budget_limit, icon) VALUES (?, ?, ?, ?)", [name, type, budget, icon]);
        }

        // Expense categories
        const expenseCategories = [
            ['Belanja Harian', 'expense', 2000000, 'shopping-cart'],
            ['Makanan & Minuman', 'expense', 1500000, 'utensils'],
            ['Transportasi', 'expense', 500000, 'car'],
            ['Listrik & Air', 'expense', 500000, 'zap'],
            ['Internet & Telpon', 'expense', 300000, 'wifi'],
            ['Kesehatan', 'expense', 500000, 'heart-pulse'],
            ['Pendidikan', 'expense', 1000000, 'graduation-cap'],
            ['Hiburan', 'expense', 300000, 'gamepad-2'],
            ['Cicilan', 'expense', 0, 'landmark'],
            ['Lainnya', 'expense', 0, 'more-horizontal'],
        ];
        for (const [name, type, budget, icon] of expenseCategories) {
            run("INSERT INTO categories (name, type, budget_limit, icon) VALUES (?, ?, ?, ?)", [name, type, budget, icon]);
        }
    }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize sql.js, load existing DB from IndexedDB or create a new one.
 * @returns {Promise<object>} The sql.js database instance.
 */
export async function initDatabase() {
    const SQL = await window.initSqlJs({ locateFile: () => WASM_URL });

    let idb;
    try {
        idb = await openIDB();
        const savedData = await idbGet(idb);
        if (savedData) {
            db = new SQL.Database(new Uint8Array(savedData));
        } else {
            db = new SQL.Database();
        }
    } catch (err) {
        console.warn('IndexedDB tidak tersedia, menggunakan database baru:', err);
        db = new SQL.Database();
    }

    // Ensure schema exists
    const hadBudgets = scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='budgets'") > 0;
    db.run(SCHEMA_SQL);
    ensureBudgetColumns();

    // Seed default data
    seedData();
    if (!hadBudgets) migrateCategoryBudgets();

    // Persist
    await saveDatabase();

    return db;
}

/**
 * Save the current database state to IndexedDB.
 */
export async function saveDatabase() {
    if (!db) throw new Error('Database belum diinisialisasi');
    try {
        const data = db.export();
        const idb = await openIDB();
        await idbPut(idb, data.buffer);
    } catch (err) {
        console.error('Gagal menyimpan database:', err);
    }
}

/**
 * Get the current db instance.
 * @returns {object}
 */
export function getDB() {
    if (!db) throw new Error('Database belum diinisialisasi');
    return db;
}

// =============================================================================
// CRUD — Accounts
// =============================================================================

/**
 * Get all accounts.
 * @returns {Array<object>}
 */
export function getAllAccounts() {
    return query('SELECT * FROM accounts ORDER BY id ASC');
}

/**
 * Get a single account by ID.
 * @param {number} id
 * @returns {object|null}
 */
export function getAccountById(id) {
    const rows = query('SELECT * FROM accounts WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * Add a new account.
 * Supports both positional arguments: (name, type, initialBalance, icon)
 * or a single object: ({ name, type, initial_balance, initialBalance, icon })
 */
export async function addAccount(name, type, initialBalance, icon) {
    if (typeof name === 'object' && name !== null) {
        const obj = name;
        type = obj.type;
        initialBalance = obj.initial_balance ?? obj.initialBalance;
        icon = obj.icon;
        name = obj.name;
    }
    if (!name || !name.trim()) throw new Error('Nama akun tidak boleh kosong');
    run(
        'INSERT INTO accounts (name, type, initial_balance, icon) VALUES (?, ?, ?, ?)',
        [name.trim(), type || 'cash', initialBalance || 0, icon || 'wallet']
    );
    await saveDatabase();
}

/**
 * Update an existing account.
 * Supports both positional arguments: (id, name, type, initialBalance, icon)
 * or object payload: (id, { name, type, initial_balance, initialBalance, icon })
 */
export async function updateAccount(id, name, type, initialBalance, icon) {
    if (typeof name === 'object' && name !== null) {
        const obj = name;
        type = obj.type;
        initialBalance = obj.initial_balance ?? obj.initialBalance;
        icon = obj.icon;
        name = obj.name;
    }
    if (!name || !name.trim()) throw new Error('Nama akun tidak boleh kosong');
    const existing = getAccountById(id);
    if (!existing) throw new Error('Akun tidak ditemukan');
    run(
        'UPDATE accounts SET name = ?, type = ?, initial_balance = ?, icon = ? WHERE id = ?',
        [name.trim(), type || existing.type || 'cash', initialBalance !== undefined ? initialBalance : existing.initial_balance, icon || existing.icon || 'wallet', id]
    );
    await saveDatabase();
}

/**
 * Delete an account (only if no transactions reference it).
 */
export async function deleteAccount(id) {
    const refCount = scalar(
        'SELECT COUNT(*) FROM transactions WHERE account_id = ? OR to_account_id = ?',
        [id, id]
    );
    if (refCount > 0) {
        throw new Error('Akun tidak dapat dihapus karena masih memiliki transaksi terkait');
    }
    run('DELETE FROM accounts WHERE id = ?', [id]);
    await saveDatabase();
}

/**
 * Calculate the current balance of an account.
 * Balance = initial_balance
 *         + SUM(income to this account)
 *         - SUM(expense from this account)
 *         + SUM(transfer in)
 *         - SUM(transfer out)
 * @param {number} id
 * @returns {number}
 */
export function getAccountBalance(id) {
    const account = getAccountById(id);
    if (!account) throw new Error('Akun tidak ditemukan');

    const initial = account.initial_balance || 0;

    const income = scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = ? AND type = 'income'",
        [id]
    ) || 0;

    const expense = scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = ? AND type = 'expense'",
        [id]
    ) || 0;

    const transferIn = scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE to_account_id = ? AND type = 'transfer'",
        [id]
    ) || 0;

    const transferOut = scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = ? AND type = 'transfer'",
        [id]
    ) || 0;

    return initial + income - expense + transferIn - transferOut;
}

/**
 * Get the total balance across all accounts.
 * @returns {number}
 */
export function getTotalBalance() {
    const accounts = getAllAccounts();
    return accounts.reduce((sum, acc) => sum + getAccountBalance(acc.id), 0);
}

// =============================================================================
// CRUD — Categories
// =============================================================================

/**
 * Get all categories, optionally filtered by type.
 * @param {string} [type] - 'income' or 'expense'
 * @returns {Array<object>}
 */
export function getAllCategories(type) {
    if (type) {
        return query('SELECT * FROM categories WHERE type = ? ORDER BY id ASC', [type]);
    }
    return query('SELECT * FROM categories ORDER BY id ASC');
}

/**
 * Get a single category by ID.
 * @param {number} id
 * @returns {object|null}
 */
export function getCategoryById(id) {
    const rows = query('SELECT * FROM categories WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * Add a new category.
 * Supports both positional arguments: (name, type, budgetLimit, icon)
 * or a single object: ({ name, type, budget_limit, budgetLimit, icon })
 */
export async function addCategory(name, type, budgetLimit, icon) {
    if (typeof name === 'object' && name !== null) {
        const obj = name;
        type = obj.type;
        budgetLimit = obj.budget_limit ?? obj.budgetLimit;
        icon = obj.icon;
        name = obj.name;
    }
    if (!name || !name.trim()) throw new Error('Nama kategori tidak boleh kosong');
    if (!['income', 'expense'].includes(type)) throw new Error('Tipe kategori harus income atau expense');
    run(
        'INSERT INTO categories (name, type, budget_limit, icon) VALUES (?, ?, ?, ?)',
        [name.trim(), type, budgetLimit || 0, icon || 'tag']
    );
    await saveDatabase();
}

/**
 * Update an existing category.
 * Supports both positional arguments: (id, name, type, budgetLimit, icon)
 * or object payload: (id, { name, type, budget_limit, budgetLimit, icon })
 */
export async function updateCategory(id, name, type, budgetLimit, icon) {
    if (typeof name === 'object' && name !== null) {
        const obj = name;
        type = obj.type;
        budgetLimit = obj.budget_limit ?? obj.budgetLimit;
        icon = obj.icon;
        name = obj.name;
    }
    if (!name || !name.trim()) throw new Error('Nama kategori tidak boleh kosong');
    if (!['income', 'expense'].includes(type)) throw new Error('Tipe kategori harus income atau expense');
    const existing = getCategoryById(id);
    if (!existing) throw new Error('Kategori tidak ditemukan');
    run(
        'UPDATE categories SET name = ?, type = ?, budget_limit = ?, icon = ? WHERE id = ?',
        [name.trim(), type, budgetLimit !== undefined ? budgetLimit : existing.budget_limit, icon || existing.icon || 'tag', id]
    );
    await saveDatabase();
}

/**
 * Delete a category (only if no transactions reference it).
 */
export async function deleteCategory(id) {
    const refCount = scalar(
        'SELECT COUNT(*) FROM transactions WHERE category_id = ?',
        [id]
    );
    if (refCount > 0) {
        throw new Error('Kategori tidak dapat dihapus karena masih memiliki transaksi terkait');
    }
    run('DELETE FROM budgets WHERE category_id = ?', [id]);
    run('DELETE FROM categories WHERE id = ?', [id]);
    await saveDatabase();
}

// =============================================================================
// CRUD — Transactions
// =============================================================================

/**
 * Get all transactions with joined account/category names.
 * @param {object} [filters] - { month, year, accountId, categoryId, type }
 * @returns {Array<object>}
 */
export function getAllTransactions(filters = {}) {
    let sql = `
        SELECT
            t.*,
            a.name AS account_name,
            a.icon AS account_icon,
            ta.name AS to_account_name,
            c.name AS category_name,
            c.icon AS category_icon
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        LEFT JOIN accounts ta ON t.to_account_id = ta.id
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE 1=1
    `;
    const params = [];

    if (filters.month != null && filters.year != null) {
        sql += " AND CAST(strftime('%m', t.transaction_date) AS INTEGER) = ? AND CAST(strftime('%Y', t.transaction_date) AS INTEGER) = ?";
        params.push(filters.month, filters.year);
    } else if (filters.year != null) {
        sql += " AND CAST(strftime('%Y', t.transaction_date) AS INTEGER) = ?";
        params.push(filters.year);
    }

    if (filters.accountId != null) {
        sql += ' AND (t.account_id = ? OR t.to_account_id = ?)';
        params.push(filters.accountId, filters.accountId);
    }

    if (filters.categoryId != null) {
        sql += ' AND t.category_id = ?';
        params.push(filters.categoryId);
    }

    if (filters.type) {
        sql += ' AND t.type = ?';
        params.push(filters.type);
    }

    sql += ' ORDER BY t.transaction_date DESC, t.created_at DESC';

    return query(sql, params);
}

/**
 * Get a single transaction by ID.
 * @param {number} id
 * @returns {object|null}
 */
export function getTransactionById(id) {
    const rows = query(`
        SELECT
            t.*,
            a.name AS account_name,
            ta.name AS to_account_name,
            c.name AS category_name
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        LEFT JOIN accounts ta ON t.to_account_id = ta.id
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ?
    `, [id]);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * Add a new transaction.
 * Supports both positional arguments: (accountId, toAccountId, categoryId, type, amount, date, note)
 * or a single object: ({ account_id, to_account_id, category_id, type, amount, transaction_date, note })
 */
export async function addTransaction(accountId, toAccountId, categoryId, type, amount, date, note) {
    if (typeof accountId === 'object' && accountId !== null) {
        const obj = accountId;
        toAccountId = obj.to_account_id ?? obj.toAccountId;
        categoryId = obj.category_id ?? obj.categoryId;
        type = obj.type;
        amount = obj.amount;
        date = obj.transaction_date ?? obj.date;
        note = obj.note;
        accountId = obj.account_id ?? obj.accountId;
    }
    if (!accountId) throw new Error('Akun harus dipilih');
    if (!['income', 'expense', 'transfer'].includes(type)) throw new Error('Tipe transaksi tidak valid');
    if (!amount || amount <= 0) throw new Error('Jumlah harus lebih dari 0');
    if (!date) throw new Error('Tanggal harus diisi');
    if (type === 'transfer' && !toAccountId) throw new Error('Akun tujuan harus dipilih untuk transfer');
    if (type === 'transfer' && accountId === toAccountId) throw new Error('Akun asal dan tujuan tidak boleh sama');

    run(
        'INSERT INTO transactions (account_id, to_account_id, category_id, type, amount, transaction_date, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [accountId, toAccountId || null, categoryId || null, type, amount, date, note || null]
    );
    await saveDatabase();
}

/**
 * Update an existing transaction.
 * Supports both positional arguments: (id, accountId, toAccountId, categoryId, type, amount, date, note)
 * or object payload: (id, { account_id, to_account_id, category_id, type, amount, transaction_date, note })
 */
export async function updateTransaction(id, accountId, toAccountId, categoryId, type, amount, date, note) {
    const existing = getTransactionById(id);
    if (!existing) throw new Error('Transaksi tidak ditemukan');
    if (typeof accountId === 'object' && accountId !== null) {
        const obj = accountId;
        toAccountId = obj.to_account_id ?? obj.toAccountId;
        categoryId = obj.category_id ?? obj.categoryId;
        type = obj.type;
        amount = obj.amount;
        date = obj.transaction_date ?? obj.date;
        note = obj.note;
        accountId = obj.account_id ?? obj.accountId;
    }
    if (!accountId) throw new Error('Akun harus dipilih');
    if (!['income', 'expense', 'transfer'].includes(type)) throw new Error('Tipe transaksi tidak valid');
    if (!amount || amount <= 0) throw new Error('Jumlah harus lebih dari 0');
    if (!date) throw new Error('Tanggal harus diisi');

    run(
        'UPDATE transactions SET account_id = ?, to_account_id = ?, category_id = ?, type = ?, amount = ?, transaction_date = ?, note = ? WHERE id = ?',
        [accountId, toAccountId || null, categoryId || null, type, amount, date, note || null, id]
    );
    await saveDatabase();
}

/**
 * Delete a transaction.
 */
export async function deleteTransaction(id) {
    const existing = getTransactionById(id);
    if (!existing) throw new Error('Transaksi tidak ditemukan');
    run('DELETE FROM transactions WHERE id = ?', [id]);
    await saveDatabase();
}

// =============================================================================
// Reports
// =============================================================================

/**
 * Get total income for a given month/year.
 * @param {number} month 1-12
 * @param {number} year
 * @returns {number}
 */
export function getMonthlyIncome(month, year) {
    const result = scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'income' AND CAST(strftime('%m', transaction_date) AS INTEGER) = ? AND CAST(strftime('%Y', transaction_date) AS INTEGER) = ?",
        [month, year]
    );
    return result || 0;
}

/**
 * Get total expense for a given month/year.
 * @param {number} month 1-12
 * @param {number} year
 * @returns {number}
 */
export function getMonthlyExpense(month, year) {
    const result = scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND CAST(strftime('%m', transaction_date) AS INTEGER) = ? AND CAST(strftime('%Y', transaction_date) AS INTEGER) = ?",
        [month, year]
    );
    return result || 0;
}

/**
 * Get expense totals by category for a given month/year (for pie chart).
 * @param {number} month
 * @param {number} year
 * @returns {Array<{categoryName: string, total: number}>}
 */
export function getExpenseByCategory(month, year) {
    return query(
        `SELECT
            c.name AS categoryName,
            c.icon AS icon,
            COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.type = 'expense'
            AND CAST(strftime('%m', t.transaction_date) AS INTEGER) = ?
            AND CAST(strftime('%Y', t.transaction_date) AS INTEGER) = ?
        GROUP BY c.id, c.name, c.icon
        ORDER BY total DESC`,
        [month, year]
    );
}

/**
 * Get income vs expense for the last N months (for bar chart).
 * @param {number} [months=6]
 * @returns {Array<{month: number, year: number, income: number, expense: number}>}
 */
export function getIncomeVsExpense(months = 6) {
    const results = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();

        const income = getMonthlyIncome(m, y);
        const expense = getMonthlyExpense(m, y);

        results.push({ month: m, year: y, income, expense });
    }

    return results;
}

/**
 * Get budget usage for categories with budget > 0 for a given month/year.
 * @param {number} month
 * @param {number} year
 * @returns {Array<{categoryName: string, budgetLimit: number, spent: number, percentage: number}>}
 */
export function getBudgetUsage(month, year) {
    return query(
        `SELECT
            c.name AS categoryName,
            c.budget_limit AS budgetLimit,
            COALESCE(SUM(t.amount), 0) AS spent,
            CASE
                WHEN c.budget_limit > 0 THEN ROUND((COALESCE(SUM(t.amount), 0) / c.budget_limit) * 100, 1)
                ELSE 0
            END AS percentage
        FROM categories c
        LEFT JOIN transactions t ON t.category_id = c.id
            AND t.type = 'expense'
            AND CAST(strftime('%m', t.transaction_date) AS INTEGER) = ?
            AND CAST(strftime('%Y', t.transaction_date) AS INTEGER) = ?
        WHERE c.type = 'expense' AND c.budget_limit > 0
        GROUP BY c.id, c.name, c.budget_limit
        ORDER BY percentage DESC`,
        [month, year]
    );
}

/**
 * Get a monthly summary: totals, net, and transaction count.
 * @param {number} month
 * @param {number} year
 * @returns {{totalIncome: number, totalExpense: number, net: number, transactionCount: number}}
 */
export function getMonthlySummary(month, year) {
    const totalIncome = getMonthlyIncome(month, year);
    const totalExpense = getMonthlyExpense(month, year);

    const transactionCount = scalar(
        "SELECT COUNT(*) FROM transactions WHERE CAST(strftime('%m', transaction_date) AS INTEGER) = ? AND CAST(strftime('%Y', transaction_date) AS INTEGER) = ?",
        [month, year]
    ) || 0;

    return {
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
        transactionCount
    };
}

/**
 * Get monthly summaries for all recorded months in transactions.
 * Returns array of { year, month, income, expense }.
 * @returns {Array<{year: number, month: number, income: number, expense: number}>}
 */
export function getAllMonthlySummaries() {
    return query(`
        SELECT 
            CAST(strftime('%Y', transaction_date) AS INTEGER) AS year,
            CAST(strftime('%m', transaction_date) AS INTEGER) AS month,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
        FROM transactions
        GROUP BY year, month
        ORDER BY year DESC, month DESC
    `);
}

// =============================================================================
// Backup & Restore
// =============================================================================

/**
 * Export the database as a Uint8Array.
 * @returns {Uint8Array}
 */
export function exportDatabase() {
    if (!db) throw new Error('Database belum diinisialisasi');
    return db.export();
}

/**
 * Import a database from a Uint8Array, replacing the current one.
 * @param {Uint8Array} uint8Array
 */
export async function importDatabase(uint8Array) {
    if (!uint8Array || !(uint8Array instanceof Uint8Array)) {
        throw new Error('Data database tidak valid');
    }
    const SQL = await window.initSqlJs({ locateFile: () => WASM_URL });
    if (db) {
        db.close();
    }
    db = new SQL.Database(uint8Array);
    // Backup lama mungkin belum punya tabel budgets
    const hadBudgets = scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='budgets'") > 0;
    db.run(SCHEMA_SQL);
    ensureBudgetColumns();
    if (!hadBudgets) migrateCategoryBudgets();
    await saveDatabase();
}

/**
 * Clear the database: drop all tables and recreate with seed data.
 */
export async function clearDatabase() {
    if (!db) throw new Error('Database belum diinisialisasi');
    run('DROP TABLE IF EXISTS budgets');
    run('DROP TABLE IF EXISTS transactions');
    run('DROP TABLE IF EXISTS categories');
    run('DROP TABLE IF EXISTS accounts');
    db.run(SCHEMA_SQL);
    seedData();
    migrateCategoryBudgets();
    await saveDatabase();
}

// =============================================================================
// Budget (harian / mingguan / bulanan)
// =============================================================================

const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Rentang periode kalender: harian = hari ini, mingguan = Senin-Minggu, bulanan = 1 s/d akhir bulan.
 * Budget otomatis "berulang" karena rentang selalu dihitung dari tanggal hari ini.
 */
export function getPeriodRange(type, ref = new Date()) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    let s = new Date(d), e = new Date(d);
    if (type === 'weekly') {
        s.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        e = new Date(s); e.setDate(s.getDate() + 6);
    } else if (type === 'monthly') {
        s = new Date(d.getFullYear(), d.getMonth(), 1);
        e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    }
    return { start: toISO(s), end: toISO(e), endDate: e };
}

export function getAllBudgets() {
    return query(`SELECT b.*, c.name AS category_name, c.icon AS category_icon
        FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
        ORDER BY b.is_active DESC,
                 CASE b.period_type WHEN 'daily' THEN 1 WHEN 'weekly' THEN 2 ELSE 3 END, b.id DESC`);
}

export function getBudgetById(id) {
    const rows = query('SELECT * FROM budgets WHERE id = ?', [id]);
    return rows.length ? rows[0] : null;
}

function validateBudget({ name, periodType, amountLimit }) {
    if (!name || !name.trim()) throw new Error('Nama budget tidak boleh kosong');
    if (!['daily', 'weekly', 'monthly'].includes(periodType)) throw new Error('Periode budget tidak valid');
    if (!(amountLimit > 0)) throw new Error('Batas budget harus lebih dari 0');
}

export async function addBudget(b) {
    validateBudget(b);
    run('INSERT INTO budgets (name, category_id, period_type, amount_limit, is_active, icon) VALUES (?, ?, ?, ?, ?, ?)',
        [b.name.trim(), b.categoryId || null, b.periodType, b.amountLimit, b.isActive === 0 ? 0 : 1, b.icon || null]);
    await saveDatabase();
}

export async function updateBudget(id, b) {
    validateBudget(b);
    run('UPDATE budgets SET name = ?, category_id = ?, period_type = ?, amount_limit = ?, is_active = ?, icon = ? WHERE id = ?',
        [b.name.trim(), b.categoryId || null, b.periodType, b.amountLimit, b.isActive === 0 ? 0 : 1, b.icon || null, id]);
    await saveDatabase();
}

export async function deleteBudget(id) {
    run('DELETE FROM budgets WHERE id = ?', [id]);
    await saveDatabase();
}

/**
 * Status real-time setiap budget pada periode berjalan:
 * terpakai, persentase, sisa, dan batas aman per hari.
 */
export function getBudgetStatuses(onlyActive = false) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return getAllBudgets().filter(b => !onlyActive || b.is_active).map(b => {
        const { start, end, endDate } = getPeriodRange(b.period_type, now);
        const sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND transaction_date BETWEEN ? AND ?"
            + (b.category_id ? ' AND category_id = ?' : '');
        const spent = scalar(sql, b.category_id ? [start, end, b.category_id] : [start, end]) || 0;
        const remaining = b.amount_limit - spent;
        const daysLeft = Math.max(1, Math.round((endDate - today) / 864e5) + 1);
        return {
            ...b, start, end, spent, remaining, daysLeft,
            percentage: b.amount_limit > 0 ? (spent / b.amount_limit) * 100 : 0,
            dailySafe: Math.max(0, remaining) / daysLeft
        };
    });
}

/**
 * Budget yang terdampak oleh sebuah pengeluaran (global + kategori yang sama),
 * dihitung pada periode yang memuat tanggal transaksi.
 * `amount` ditambahkan ke terpakai (simulasi); `excludeId` dipakai saat edit transaksi.
 */
export function getBudgetsForTransaction({ date, categoryId = null, amount = 0, excludeId = null }) {
    const [y, m, d] = date.split('-').map(Number);
    const ref = new Date(y, m - 1, d);
    return getAllBudgets()
        .filter(b => b.is_active && (!b.category_id || b.category_id === categoryId))
        .map(b => {
            const { start, end } = getPeriodRange(b.period_type, ref);
            let sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND transaction_date BETWEEN ? AND ?";
            const p = [start, end];
            if (b.category_id) { sql += ' AND category_id = ?'; p.push(b.category_id); }
            if (excludeId) { sql += ' AND id != ?'; p.push(excludeId); }
            const spent = scalar(sql, p) || 0;
            const after = spent + (amount || 0);
            return { ...b, start, end, spent, after, remaining: b.amount_limit - after, percentage: (after / b.amount_limit) * 100 };
        });
}
