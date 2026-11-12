import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { emptyContent, contentSchema } from '../cms-model.js';

const scrypt = promisify(scryptCallback);
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
export function openStore(directory, seedPath) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, 'aspapi.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, data TEXT NOT NULL, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, username TEXT NOT NULL, action TEXT NOT NULL, created TEXT NOT NULL);`);
  if (!db.prepare('SELECT id FROM content WHERE id=1').get()) {
    const initial = contentSchema.parse(seedPath && existsSync(seedPath) ? JSON.parse(readFileSync(seedPath, 'utf8')) : emptyContent());
    db.prepare('INSERT INTO content VALUES (1,1,?,?)').run(JSON.stringify(initial), new Date().toISOString());
  }
  if (seedPath) {
    const original = path.join(path.dirname(seedPath), 'Logo ASPAPI SULSEL.jpg');
    const target = path.join(directory, 'uploads', 'logo-aspapi-sulsel.jpg');
    if (existsSync(original) && !existsSync(target)) { mkdirSync(path.dirname(target), { recursive: true }); copyFileSync(original, target); }
  }
  return db;
}