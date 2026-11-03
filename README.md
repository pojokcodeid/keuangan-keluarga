# keuangan-keluarga


## Fitur Budget (menu baru)
- Budget **harian, mingguan, atau bulanan** sesuai pilihan user; berulang otomatis (harian = per hari, mingguan = Senin-Minggu, bulanan = per bulan kalender).
- Cakupan **global** (semua pengeluaran) atau **per kategori**; bisa dinonaktifkan.
- Progress bar hijau (<75%), kuning (75-99%), merah (>=100%), sisa budget, dan batas aman per hari.
- Peringatan budget tampil di Dashboard. Data tersimpan di tabel SQLite `budgets` (dibuat otomatis, backup lama tetap bisa di-restore).
- Batas bulanan per kategori yang sudah ada otomatis dibuatkan budget bulanan satu kali.

## Budget terhubung ke transaksi & grafik mobile
- Form pengeluaran menampilkan dampak ke budget secara real-time (budget global + kategori terpilih, pada periode yang memuat tanggal transaksi), dan memberi peringatan setelah tersimpan jika budget >= 75% / terlampaui.
- Halaman Budget menampilkan ringkasan pemasukan, pengeluaran, total budget bulanan, dan sisa yang belum dialokasikan.
- Grafik: tinggi tetap & legenda HTML untuk pie, label bulan singkat dan sumbu ringkas untuk bar, serta grafik baru "Budget vs Realisasi".
- Semua input nominal (transaksi, saldo awal akun, batas kategori, budget) memakai format titik ribuan.
