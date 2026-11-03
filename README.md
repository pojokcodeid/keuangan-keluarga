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

## Mode tampilan (Terang / Gelap / Otomatis)
- Pilih di **Pengaturan → Tampilan**. Mode *Otomatis* mengikuti pengaturan perangkat dan berubah langsung saat sistem berganti tema.
- Pilihan tersimpan di browser (`kk_theme`) dan diterapkan sebelum halaman tampil, jadi tidak berkedip. Warna grafik ikut menyesuaikan.
- Kode: `js/theme.js` + blok `html.dark` di `<style>` pada `index.html`.

## Ikon FontAwesome
- Kategori dan budget memakai picker ikon FontAwesome (9 grup, 100+ ikon) dengan 12 pilihan warna. Kategori lama (emoji / ikon lama) tetap tampil, otomatis dikonversi ke ikon berwarna.
- Budget: tiap budget punya ikon & warna sendiri; bila tidak dipilih, ikut ikon kategori atau ikon periode (harian = matahari, mingguan = kalender minggu, bulanan = kalender).
- Pie chart memakai warna ikon kategori. Kode: `js/icons.js`. Service worker kini juga menyimpan CDN (FontAwesome, Tailwind, Chart.js) untuk mode offline.
