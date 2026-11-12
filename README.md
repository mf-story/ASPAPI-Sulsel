# ASPAPI Sulawesi Selatan

Website dan CMS Asosiasi Sarjana dan Praktisi Administrasi Perkantoran daerah Sulawesi Selatan. Frontend Vite/JavaScript, backend Express, database SQLite, editor Quill, dan ikon Lucide. Gunakan Node.js 24 LTS (minimum 22.13).

## Menjalankan

```sh
npm install
npm run dev
```

Website lokal: http://127.0.0.1:5174/ dan admin: http://127.0.0.1:5174/admin. Pada penggunaan lokal pertama, buat nama pengguna dan kata sandi sendiri melalui formulir **Buat Admin Pertama**. Tidak ada akun atau kata sandi bawaan. Jangan membagikan kata sandi melalui chat.

## Mengelola Konten

- **Pengaturan & Beranda:** 69 field untuk identitas, kontak, navigasi, teks/gambar beranda, bidang kegiatan, informasi, dan ajakan keanggotaan.
- **Profil Organisasi:** tujuh bagian profil dengan editor teks dan penyisipan gambar.
- **Berita & Informasi:** tambah, edit, hapus, pencarian, kategori, gambar, draf, dan terbit. ID artikel yang sudah dibuat dipertahankan agar tautannya tidak berubah.
- **Agenda Kegiatan:** tanggal, tempat, kegiatan pendamping, poster, peta, dan URL pendaftaran. URL kosong membuat tombol Daftar nonaktif. Kalender otomatis mengikuti data tersimpan.
- **Pustaka Gambar:** unggah JPG/PNG/WebP hingga 5 MB; server mengubahnya menjadi WebP. Gambar yang masih digunakan tidak dapat dihapus.
- **Akun & Keamanan:** ganti kata sandi dan keluarkan sesi lain. Semua akun memiliki hak admin yang sama.
- **Ringkasan:** statistik, aktivitas admin, ekspor JSON konten, dan muat ulang jika ada konflik revisi.

Klik **Simpan Perubahan** untuk menerapkan perubahan. Draf hanya terlihat di admin. Perubahan baru tampil saat pengunjung membuka atau memuat ulang halaman. Field tanggal publikasi adalah metadata, bukan penjadwalan otomatis.

## Validasi

```sh
npm run check
npm test
npm run test:browser
npm run build
```

Uji browser memakai Edge headless pada Windows; pada Linux jalankan `npx playwright install chromium` terlebih dahulu. Uji menggunakan database sementara dan tidak mengubah konten asli. Tangkapan layar tersimpan di `test-results/`.

`dist/` berisi frontend, tetapi CMS memerlukan backend Node.js. Jangan memakai hosting statis atau `vite preview` untuk pengelolaan admin.

## Menjalankan di VPS

Untuk deployment container melalui Coolify, ikuti [COOLIFY.md](COOLIFY.md). Dockerfile sudah menyiapkan host container, port 5174, dan health check; pasang volume persisten sebelum deployment pertama.

1. Gunakan Node.js 24 LTS dan akun sistem non-root. Tempatkan proyek, misalnya di `/opt/aspapi`.
2. Pasang dependensi dengan `npm ci`, lalu jalankan `npm run build`.
3. Siapkan `.env` berdasarkan `.env.example`. Isi `NODE_ENV=production`, `PUBLIC_ORIGIN` dengan origin HTTPS persis tanpa garis miring akhir, dan `PORT=5174`. `ASPAPI_DATA_DIR` dapat menunjuk direktori data persisten di luar kode.
4. Jalankan `npm run admin:account` langsung pada terminal VPS untuk membuat admin pertama. Kata sandi tidak ditampilkan. Pembuatan akun dari browser **dinonaktifkan** dalam mode produksi.
5. Jalankan `npm start` melalui systemd atau pengelola proses. Backend hanya mendengarkan `127.0.0.1`; pasang reverse proxy HTTPS seperti Nginx di depannya.

Contoh blok proxy di dalam server HTTPS Nginx yang sudah memiliki sertifikat valid:

```nginx
location / {
	proxy_pass http://127.0.0.1:5174;
	proxy_http_version 1.1;
	proxy_set_header Host $host;
	proxy_set_header X-Real-IP $remote_addr;
	proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	proxy_set_header X-Forwarded-Proto $scheme;
	client_max_body_size 6m;
}
```

Seluruh permintaan, termasuk `/api`, `/uploads`, dan `/admin`, harus diteruskan ke backend. Jangan menjadikan direktori proyek atau `storage/` sebagai document root Nginx. Mode development hanya untuk komputer lokal, jangan diproksikan ke internet.

Untuk pemulihan kata sandi: `npm run admin:account -- --reset`. Perintah meminta nama pengguna dan kata sandi secara interaktif, kemudian mencabut sesi lama. Lindungi akses SSH dan berkas `.env`.

## Data dan Cadangan

- `content.seed.json` merupakan konten awal hasil migrasi. Server hanya membacanya saat database belum ada; perubahan admin tersimpan di `storage/aspapi.sqlite`, bukan di seed.
- Media tersimpan di `storage/uploads/`. Direktori data ini harus dipertahankan saat deploy ulang. Jangan menjalankan ulang migrasi untuk memperbarui konten.
- Sebelum mencadangkan, hentikan sementara server agar database dan media konsisten. Jalankan `npm run backup`; hasilnya masuk `backups/<timestamp>/`. Simpan salinan cadangan di lokasi terpisah yang aman.
- Ekspor JSON dari dashboard hanya berisi konten, **bukan** gambar, akun, atau database lengkap.
- Untuk pemulihan: hentikan server, arsipkan direktori data saat ini, pulihkan `aspapi.sqlite` dan `uploads/` dari cadangan ke direktori data kosong, lalu jalankan server. Jangan mencampur database hasil pemulihan dengan berkas WAL/SHM lama. Gunakan `admin:account -- --reset` untuk mencabut sesi akun setelah pemulihan.
- Database/cadangan memuat hash kata sandi dan sesi; jangan unggah ke repositori atau web publik. Atur izin direktori data hanya untuk akun layanan.

## Sebelum dipublikasikan

- Logo pada header, footer, dan ikon tab menggunakan [Logo ASPAPI SULSEL.jpg](Logo%20ASPAPI%20SULSEL.jpg). Berkas sumber ditampilkan utuh tanpa pemotongan.
- Konfirmasikan narasi profil dan bidang kegiatan dengan pengurus.
- Tambahkan kontak resmi, susunan pengurus, ketentuan keanggotaan, serta agenda terverifikasi.
- Tiga bacaan adalah materi pengantar, bukan laporan kegiatan atau kebijakan resmi organisasi.
- Foto Unsplash adalah ilustrasi, bukan dokumentasi ASPAPI. Font dimuat melalui Google Fonts. Ganti dengan aset organisasi dan pertimbangkan penyimpanan lokal sebelum peluncuran.
- Tautan keanggotaan awal menuju https://aspapi.id/anggota/daftar dan dapat diubah melalui pengaturan admin.
- Website daerah tidak mengumpulkan atau menyimpan data pendaftaran. Registrasi dan iuran dikelola melalui situs resmi ASPAPI.

Backend menggunakan hash scrypt, cookie HttpOnly/SameSite (Secure di produksi), CSRF, rate limit login, sanitasi HTML, validasi URL/unggahan, dan pemeriksaan revisi. Fitur pemulihan lewat email, MFA, dan peran admin bertingkat belum tersedia. Situs belum dideploy ke VPS.