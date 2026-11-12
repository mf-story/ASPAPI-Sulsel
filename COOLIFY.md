# Deployment ASPAPI di Coolify

## Sumber dan Build

1. Hubungkan repositori GitHub/GitLab proyek ke Coolify, lalu buat Application baru.
2. Pilih build pack **Dockerfile**. Dockerfile path: `/Dockerfile`.
3. Base Directory adalah direktori yang berisi `package.json` dan `Dockerfile`: `/` jika repositori khusus ASPAPI, atau `/ASPAPI` bila kode berada dalam subfolder itu.
4. Ports Exposes: `5174`. Jangan menambahkan host port mapping publik; akses aplikasi melalui proxy Coolify saja.
5. Generate domain sementara, aktifkan HTTPS, dan masukkan origin HTTPS tersebut pada `PUBLIC_ORIGIN` tanpa garis miring akhir. Domain sementara harus dapat diakses internet dan mendapatkan sertifikat TLS valid. Bila sertifikat belum berhasil, perbaiki domain/DNS/port proxy; jangan menonaktifkan cookie Secure.

## Environment Variables

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=5174
ASPAPI_DATA_DIR=/app/storage
TRUST_PROXY=1
PUBLIC_ORIGIN=https://DOMAIN-SEMENTARA-DARI-COOLIFY
```

`PUBLIC_ORIGIN` harus sama persis dengan domain website pada Coolify. Nilai lain sudah menjadi default pada Dockerfile. `TRUST_PROXY=1` mengasumsikan satu reverse proxy Coolify di depan container; jangan mengekspos port container secara langsung atau menambahkan proxy lain tanpa menyesuaikan kebijakan kepercayaan.

## Penyimpanan Persisten

Tambahkan **Volume Mount** di Coolify sebelum deployment pertama:

| Nama volume | Destination Path |
| --- | --- |
| aspapi-data | /app/storage |
| aspapi-backups | /app/backups |

Container berjalan sebagai pengguna `node` (UID/GID 1000). Volume harus dapat ditulis oleh pengguna tersebut. Named volume baru umumnya mewarisi kepemilikan direktori image; jika memakai bind mount, atur kepemilikan direktori host ke `1000:1000` terlebih dahulu.

SQLite dan unggahan harus berada pada volume yang sama dan tidak boleh hilang saat redeploy. Gunakan **satu replica**, bukan horizontal scaling. Nonaktifkan rolling/overlapping deployment yang membuat dua container menulis volume yang sama; sediakan jendela redeploy singkat.

Health check tersedia di `/api/health` pada port `5174` dan sudah didefinisikan dalam Dockerfile. Setelah environment, domain, dan volume benar, jalankan Deploy.

## Memindahkan Data Lokal

Jangan memasukkan `storage/`, `backups/`, kata sandi, atau `.env` ke repositori. Docker build juga mengecualikannya.

Untuk mempertahankan perubahan admin dan gambar lokal:

1. Hentikan server lokal sementara, lalu jalankan `npm run backup` dari folder ASPAPI. Cadangan berisi `aspapi.sqlite` dan `uploads/`.
2. Transfer cadangan secara privat ke VPS (misalnya SCP/SFTP melalui koneksi SSH milik Anda), bukan ke repositori Git.
3. Hentikan aplikasi Coolify. Cadangkan isi volume server terlebih dahulu bila sudah ada data.
4. Pulihkan `aspapi.sqlite` dan seluruh `uploads/` ke volume `/app/storage`. Jangan mencampur database cadangan dengan berkas `aspapi.sqlite-wal` atau `aspapi.sqlite-shm` dari database lama. Pemulihan harus dilakukan pada direktori data yang bersih, setelah data lama diarsipkan.
5. Pastikan UID/GID pemilik adalah `1000:1000`, lalu mulai aplikasi.

Tanpa langkah transfer ini, deployment pertama memakai konten awal `content.seed.json`, bukan perubahan terbaru yang disimpan melalui admin lokal.

## Akun Admin

Untuk instalasi baru, buka Terminal aplikasi di Coolify setelah container sehat:

```sh
npm run admin:account
```

Masukkan nama pengguna dan kata sandi langsung pada terminal. Jangan mengirimkan kredensial melalui chat atau menaruhnya di Dockerfile. Setup admin melalui browser sengaja dinonaktifkan pada mode produksi.

Jika memindahkan database lokal, akun lokal ikut terbawa. Untuk mengganti kata sandi dan mencabut sesi lama:

```sh
npm run admin:account -- --reset
```

Admin dapat dibuka di `https://DOMAIN/admin`. Uji login, simpan satu perubahan, unggah gambar, serta kalender agenda. Lakukan satu redeploy dan pastikan konten/gambar tetap ada. Simpan cadangan di lokasi terpisah dari VPS.