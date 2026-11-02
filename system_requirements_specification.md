# System Requirements Specification (SRS)
## Aplikasi Web Akuntansi Rumah Tangga (Single-Page Web App)

---

## 1. Pendahuluan

### 1.1 Tujuan Document
Dokumen ini menjelaskan kebutuhan fungsional, non-fungsional, arsitektur teknis, serta batasan sistem untuk aplikasi **Akuntansi Rumah Tangga Mandiri**. Aplikasi ini dirancang berbasis web (*Client-side Only*) untuk memudahkan pengelolaan keuangan keluarga dengan tampilan yang responsif di perangkat *mobile* maupun *desktop*, serta dapat dihosting secara gratis di **GitHub Pages**.

### 1.2 Cakupan Aplikasi
- Pencatatan transaksi Pemasukan, Pengeluaran, dan Transfer Antar-Rekening/Dompet.
- Pengelolaan kategori transaksi dan daftar akun (Kas, Rekening Bank, E-Wallet).
- Visualisasi data keuangan berupa grafik dan ringkasan anggaran bulanan.
- Fitur ekspor laporan ke format **Microsoft Excel (`.xlsx`)**.
- Penyimpanan data berbasis **SQLite (WebAssembly/sql.js)** yang tersimpan secara lokal pada browser pengguna.

---

## 2. Arsitektur Teknis & Perangkat lunak (Tech Stack)

Karena aplikasi akan di-deploy ke **GitHub Pages**, aplikasi harus murni berjalan di sisi klien (*Client-Side Rendering*):

| Komponen | Teknologi / Library yang Digunakan | Keterangan |
| :--- | :--- | :--- |
| **Frontend Base** | HTML5, CSS3, JavaScript (ES6+) | Tanpa framework berat (Vanillajs / Alpine.js) agar cepat dan ringan |
| **Styling & Responsive** | Tailwind CSS / Bootstrap 5 | Desain berbasis *Mobile-First*, responsif di HP & Laptop |
| **Database Engine** | `sql.js` (SQLite via WebAssembly) | Menjalankan database SQLite langsung di dalam browser |
| **Data Persistence** | Browser `IndexedDB` / `localStorage` | Menyimpan database SQLite agar tidak hilang saat tab ditutup |
| **Grafik / Chart** | `Chart.js` | Menampilkan visualisasi ringkasan & tren keuangan |
| **Ekspor Excel** | `SheetJS` (`xlsx.full.min.js`) | Memproses dan mengunduh data transaksi ke format `.xlsx` |
| **Icon Set** | Lucide Icons / FontAwesome | Ikon antarmuka aplikasi |
| **Hosting** | GitHub Pages | Hosting gratis tanpa perlu server/backend |

---

## 3. Kebutuhan Fungsional (Functional Requirements)

### 3.1 Manajemen Akun & Dompet (Account Management)
- **FR-01**: Pengguna dapat menambahkan akun penyimpanan baru (Contoh: *Tunai, Bank BCA, Mandiri, GoPay, OVO*).
- **FR-02**: Pengguna dapat menentukan saldo awal pada masing-masing akun.
- **FR-03**: Sistem menampilkan total akumulasi saldo dari seluruh akun.

### 3.2 Manajemen Kategori (Category Management)
- **FR-04**: Pengguna dapat mengelola kategori Pemasukan (Gaji, Bonus, Investasi) dan Pengeluaran (Belanja, Listrik, Hiburan, Cicilan).
- **FR-05**: Pengguna dapat menetapkan batas anggaran (*budget limit*) bulanan pada kategori pengeluaran tertentu.

### 3.3 Pencatatan Transaksi (Transaction Ledger)
- **FR-06**: Pengguna dapat mencatat transaksi baru:
  - Jenis: Pemasukan / Pengeluaran / Transfer Antar-Akun.
  - Nominal (Rupiah).
  - Akun Asal / Tujuan.
  - Kategori Transaksi.
  - Tanggal Transaksi.
  - Catatan/Keterangan Opsional.
- **FR-07**: Pengguna dapat melihat daftar histori transaksi dengan fitur filter berdasarkan bulan, tahun, akun, atau kategori.
- **FR-08**: Pengguna dapat menghapus atau mengedit transaksi yang sudah dicatat.

### 3.4 Laporan & Visualisasi Grafik (Reports & Analytics)
- **FR-09**: **Grafik Pie Chart**: Menampilkan rasio pengeluaran per kategori pada bulan berjalan.
- **FR-10**: **Grafik Bar Chart**: Menampilkan perbandingan Pemasukan vs Pengeluaran dalam 6-12 bulan terakhir.
- **FR-11**: Indikator Batas Anggaran: Menampilkan persentase pemakaian anggaran bulanan (Hijau: Aman, Kuning: >75%, Merah: Over-budget).

### 3.5 Ekspor Data ke Excel (Data Export)
- **FR-12**: Pengguna dapat mengunduh (*download*) seluruh atau sebagian riwayat transaksi dalam format berkas Excel (`.xlsx`).
- **FR-13**: Berkas Excel yang dihasilkan berisi lembar kerja (*worksheet*):
  1. *Detail Transaksi* (Tanggal, Jenis, Akun, Kategori, Nominal, Catatan).
  2. *Ringkasan Bulanan* (Total Pemasukan, Total Pengeluaran, Saldo Akhir).

### 3.6 Backup & Restore Database
- **FR-14**: Pengguna dapat mendownload file `.sqlite` utuh untuk dijadikan *backup*.
- **FR-15**: Pengguna dapat melakukan *restore* / *import* file `.sqlite` dari komputer/HP ke dalam aplikasi.

---

## 4. Kebutuhan Non-Fungsional (Non-Functional Requirements)

### 4.1 Desain & Antarmuka Mobile (Responsive UX/UI)
- **NFR-01**: Antarmuka menerapkan pendekatan **Mobile-First Design**.
- **NFR-02**: Memiliki navigasi bawah (*Bottom Navigation Bar*) saat dibuka di perangkat *mobile* untuk akses cepat (Dashboard, Transaksi, Laporan, Pengaturan).
- **NFR-03**: *Touch-friendly*: Tombol dan form input berukuran ideal untuk pengoperasian dengan jari di layar sentuh.

### 4.2 Privasi & Keamanan Data
- **NFR-04**: **100% Offline & Private**. Tidak ada data finansial pengguna yang dikirim ke server luar atau cloud mana pun. Seluruh data tersimpan aman di perangkat pengguna.

### 4.3 Kinerja & Performa
- **NFR-05**: Aplikasi dapat diakses dan digunakan secara penuh tanpa koneksi internet (PWA / Progressive Web App friendly).
- **NFR-06**: *Waktu Muat (< 2 detik)* saat pertama kali aplikasi dibuka dari GitHub Pages.

---

## 5. Struktur Tabel Database (SQLite Schema)

```sql
-- Tabel 1: Akun / Dompet
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    initial_balance REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel 2: Kategori Transaksi
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
    budget_limit REAL DEFAULT 0.0,
    icon TEXT DEFAULT 'default'
);

-- Tabel 3: Transaksi
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    to_account_id INTEGER, -- Diisi jika transaksi berjenis 'transfer'
    category_id INTEGER,   -- Opsional jika transfer
    type TEXT CHECK(type IN ('income', 'expense', 'transfer')) NOT NULL,
    amount REAL NOT NULL,
    transaction_date DATE NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (to_account_id) REFERENCES accounts(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

---

## 6. Alur Pengoperasian Sistem (User Workflow)

1. **Akses Pertama Kali:**
   - Pengguna membuka URL GitHub Pages (`https://username.github.io/nama-repo/`).
   - Sistem melakukan inisialisasi database SQLite di memori browser.
   - Pengguna mengisi saldo awal dompet/rekening.

2. **Pencatatan Transaksi:**
   - Pengguna menekan tombol **`+ Transaksi`** di bagian navigasi mobile.
   - Mengisi form (Nominal, Kategori, Dompet, Catatan) lalu simpan.
   - Sistem mengupdate saldo dompet dan menyimpan record ke SQLite + Sync ke IndexedDB.

3. **Melihat Laporan & Ekspor:**
   - Pengguna masuk ke menu **Laporan**.
   - Sistem membaca data SQLite dan merender grafik Chart.js.
   - Pengguna menekan tombol **"Download Excel"**, library SheetJS memproses data SQLite menjadi file `.xlsx` dan otomatis terdownload ke perangkat HP/Komputer.