import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { contentSchema } from '../cms-model.js';
import { cleanContent } from '../server.js';

const digest = buffer => createHash('sha256').update(buffer).digest('hex');
const validName = name => /^[a-zA-Z0-9-]+\.(?:webp|png|jpe?g)$/.test(name);
export function exportTransfer(directory, destination) {
  const db = new DatabaseSync(path.join(directory, 'aspapi.sqlite'), { readOnly: true });
  let content;
  let users;
  try {
    db.exec('BEGIN');
    content = db.prepare('SELECT revision,data FROM content WHERE id=1').get();
    users = db.prepare('SELECT id,username,password FROM users').all();
    db.exec('COMMIT');
  } finally { db.close(); }
  const data = contentSchema.parse(JSON.parse(content.data));
  const paths = new Set();
  const collect = value => {
    if (Array.isArray(value)) return value.forEach(collect);
    if (value && typeof value === 'object') return Object.values(value).forEach(collect);
    if (typeof value !== 'string') return;
    if (value.startsWith('/uploads/')) paths.add(value);
    if (value.includes('<')) load(value)('img[src]').each((index, image) => { const source = image.attribs.src; if (source.startsWith('/uploads/')) paths.add(source); });
  };
  collect(data);
  const media = [...paths].map(url => {
    const name = url.slice('/uploads/'.length);
    if (!validName(name)) throw new Error('Nama media tidak valid.');
    const buffer = readFileSync(path.join(directory, 'uploads', name));
    return { name, sha256: digest(buffer), base64: buffer.toString('base64') };
  });
  const payload = { format: 1, createdAt: new Date().toISOString(), revision: content.revision, data, users, media };
  mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  writeFileSync(destination, JSON.stringify(payload), { flag: 'wx', mode: 0o600 });
  return { profiles: data.profiles.length, articles: data.articles.length, events: data.events.length, accounts: users.length, images: media.length };
}
export function importTransfer(directory, source) {
  const payload = JSON.parse(readFileSync(source, 'utf8'));
  if (payload.format !== 1 || !Array.isArray(payload.users) || !Array.isArray(payload.media) || !Number.isSafeInteger(payload.revision)) throw new Error('Format transfer tidak valid.');
  const data = cleanContent(contentSchema.parse(payload.data));
  for (const user of payload.users) {
    if (!Number.isSafeInteger(user.id) || user.id < 1 || !/^[a-zA-Z0-9_.-]{3,60}$/.test(user.username) || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(user.password)) throw new Error('Data akun tidak valid.');
  }
  const media = payload.media.map(item => {
    if (!validName(item.name)) throw new Error('Nama media tidak valid.');
    const buffer = Buffer.from(item.base64, 'base64');
    if (buffer.length > 10 * 1024 * 1024 || digest(buffer) !== item.sha256) throw new Error('Verifikasi media gagal.');
    const target = path.join(directory, 'uploads', item.name);
    if (existsSync(target) && digest(readFileSync(target)) !== item.sha256) throw new Error('Media tujuan sudah ada dengan isi berbeda.');
    return { buffer, target };
  });
  const db = new DatabaseSync(path.join(directory, 'aspapi.sqlite'));
  try {
    db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
    if (db.prepare('SELECT count(*) AS total FROM users').get().total || db.prepare('SELECT revision FROM content WHERE id=1').get().revision !== 1) throw new Error('Pemulihan hanya diizinkan pada instalasi baru tanpa akun admin.');
    mkdirSync(path.join(directory, 'uploads'), { recursive: true });
    media.forEach(item => { if (!existsSync(item.target)) writeFileSync(item.target, item.buffer, { flag: 'wx' }); });
    for (const user of payload.users) db.prepare('INSERT INTO users(id,username,password) VALUES (?,?,?)').run(user.id, user.username, user.password);
    db.prepare('UPDATE content SET data=?,revision=?,updated=? WHERE id=1').run(JSON.stringify(data), Math.max(payload.revision, 1) + 1, new Date().toISOString());
    db.prepare('INSERT INTO audit(username,action,created) VALUES (?,?,?)').run('migration', 'Memulihkan konten, media, dan akun dari instalasi lokal', new Date().toISOString());
    db.exec('COMMIT');
    return { profiles: data.profiles.length, articles: data.articles.length, events: data.events.length, accounts: payload.users.length, images: media.length };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const directory = process.env.ASPAPI_DATA_DIR ? path.resolve(process.env.ASPAPI_DATA_DIR) : path.join(root, 'storage');
  const [action, filename] = process.argv.slice(2);
  if (!['export', 'import'].includes(action) || !filename) throw new Error('Gunakan: node scripts/transfer.js export|import /path/private/transfer.json');
  const result = action === 'export' ? exportTransfer(directory, path.resolve(filename)) : importTransfer(directory, path.resolve(filename));
  console.log(JSON.stringify({ action, ...result }));
}