import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openStore, hashPassword } from '../server/store.js';

if (process.argv.includes('--help')) {
  console.log('npm run admin:account          Membuat akun admin melalui terminal.');
  console.log('npm run admin:account -- --reset  Mengganti kata sandi akun yang ada.');
  console.log('Kata sandi dimasukkan secara interaktif dan tidak ditampilkan.');
} else {
  if (!process.stdin.isTTY) throw new Error('Jalankan secara interaktif di terminal. Jangan kirim kata sandi melalui argumen atau chat.');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const directory = process.env.ASPAPI_DATA_DIR ? path.resolve(process.env.ASPAPI_DATA_DIR) : path.join(root, 'storage');
  const db = openStore(directory, path.join(root, 'content.seed.json'));
  let muted = false;
  const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
  const terminal = createInterface({ input: process.stdin, output, terminal: true });
  const askSecret = async prompt => { process.stdout.write(prompt); muted = true; try { return await terminal.question(''); } finally { muted = false; process.stdout.write('\n'); } };
  try {
    const username = (await terminal.question('Nama pengguna admin: ')).trim();
    if (!/^[a-zA-Z0-9_.-]{3,60}$/.test(username)) throw new Error('Nama pengguna harus 3-60 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.');
    const current = db.prepare('SELECT id FROM users WHERE username=?').get(username);
    const reset = process.argv.includes('--reset');
    if (current && !reset) throw new Error('Akun sudah ada. Gunakan --reset untuk mengganti kata sandi.');
    if (!current && reset) throw new Error('Akun tidak ditemukan.');
    const password = await askSecret('Kata sandi baru (12-128 karakter): ');
    if (password.length < 12 || password.length > 128) throw new Error('Panjang kata sandi harus 12-128 karakter.');
    const confirmation = await askSecret('Ulangi kata sandi: ');
    if (password !== confirmation) throw new Error('Konfirmasi kata sandi tidak cocok.');
    const hash = await hashPassword(password);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (current) {
        db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, current.id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(current.id);
      } else db.prepare('INSERT INTO users(username,password) VALUES (?,?)').run(username, hash);
      db.prepare('INSERT INTO audit(username,action,created) VALUES (?,?,?)').run(username, reset ? 'Memulihkan akun melalui terminal' : 'Membuat akun melalui terminal', new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    console.log(reset ? 'Kata sandi diperbarui dan sesi lama dihapus.' : 'Akun admin berhasil dibuat.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { terminal.close(); db.close(); }
}