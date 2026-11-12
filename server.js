import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import sharp from 'sharp';
import sanitizeHtml from 'sanitize-html';
import { parseCookie, stringifySetCookie } from 'cookie';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readdirSync, statSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { contentSchema } from './cms-model.js';
import { openStore, hashPassword, verifyPassword, hashToken } from './server/store.js';
import { socialMetadata, injectSocialMetadata, renderSocialImage } from './server/social.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const credentials = z.object({ username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9_.-]+$/), password: z.string().min(12).max(128) });
const same = (left, right) => typeof left === 'string' && typeof right === 'string' && Buffer.byteLength(left) === Buffer.byteLength(right) && timingSafeEqual(Buffer.from(left), Buffer.from(right));
export function cleanContent(data) {
  const clean = html => sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4', 'ol', 'ul', 'li', 'blockquote', 'a', 'time', 'span', 'img'],
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height'], time: ['datetime'], '*': ['class'] },
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowedClasses: { '*': ['profile-vision', 'profile-mission-list', 'profile-history-list', 'reading-note', 'ql-align-center', 'ql-align-right', 'ql-align-justify'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'], allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }) }
  });
  return { ...data, profiles: data.profiles.map(item => ({ ...item, content: clean(item.content) })), articles: data.articles.map(item => ({ ...item, content: clean(item.content) })) };
}
export function createApplication({ dataDir = path.join(root, 'storage'), seedPath = path.join(root, 'content.seed.json'), production = false, publicOrigin = '', allowSetup = !production, trustProxy = 'loopback' } = {}) {
  const db = openStore(dataDir, seedPath);
  const uploads = path.join(dataDir, 'uploads');
  mkdirSync(uploads, { recursive: true });
  const app = express();
  app.disable('x-powered-by');
  if (production) app.set('trust proxy', trustProxy);
  app.use((req, res, next) => {
    let pathname;
    try { pathname = decodeURIComponent(req.path).replace(/\\/g, '/'); } catch { return res.sendStatus(400); }
    if (/(?:^|\/)(?:storage|server|scripts|tests|backups|\.git)(?:\/|$)|(?:^|\/)(?:server\.js|content\.seed\.json|\.env[^/]*|[^/]+\.sqlite(?:-wal|-shm)?)(?:$|\/)/i.test(pathname)) return res.sendStatus(404);
    if (!production && !['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname)) return res.sendStatus(403);
    next();
  });
  const setupToken = randomBytes(32).toString('hex');
  const secure = production;
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'], imgSrc: ["'self'", 'https:', 'http:', 'data:', 'blob:'],
    connectSrc: production ? ["'self'"] : ["'self'", 'ws://127.0.0.1:*', 'ws://localhost:*'], upgradeInsecureRequests: production ? [] : null
  } }, crossOriginEmbedderPolicy: false, strictTransportSecurity: production ? undefined : false }));
  app.use(express.json({ limit: '3mb' }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const expected = publicOrigin || `http://${req.get('host')}`;
      if (req.get('origin') !== expected) return res.status(403).json({ error: 'Asal permintaan tidak diizinkan.' });
    }
    next();
  });
  const sessionCookie = token => stringifySetCookie({ name: 'aspapi_session', value: token, httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: token ? 28800 : 0 });
  const audit = (username, action) => db.prepare('INSERT INTO audit(username,action,created) VALUES (?,?,?)').run(username, action, new Date().toISOString());
  const getContent = () => { const row = db.prepare('SELECT * FROM content WHERE id=1').get(); return { revision: row.revision, updatedAt: row.updated, data: JSON.parse(row.data) }; };
  app.locals.shareMetadata = req => socialMetadata(getContent(), req.originalUrl, publicOrigin || `http://${req.get('host')}`);
  const previewCache = new Map();
  app.get('/share/preview.jpg', async (req, res) => {
    const metadata = app.locals.shareMetadata(req);
    if (metadata.missing) return res.sendStatus(404);
    const cacheKey = `${metadata.revision}:${metadata.article ? `article:${metadata.article.id}` : 'website'}`;
    if (!previewCache.has(cacheKey)) {
      if (previewCache.size >= 24) previewCache.delete(previewCache.keys().next().value);
      previewCache.set(cacheKey, renderSocialImage(metadata, uploads, path.join(root, 'Logo ASPAPI SULSEL.jpg')).catch(error => { previewCache.delete(cacheKey); throw error; }));
    }
    const image = await previewCache.get(cacheKey);
    res.set('Cache-Control', 'public, max-age=3600').type('jpeg').send(image);
  });
  const isLocal = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const hasUsers = () => !!db.prepare('SELECT id FROM users LIMIT 1').get();
  app.use('/api', (req, res, next) => {
    const token = parseCookie(req.headers.cookie || '').aspapi_session;
    if (token && /^[a-f0-9]{64}$/.test(token)) req.session = db.prepare('SELECT s.*,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=? AND expires>?').get(hashToken(token), Date.now());
    next();
  });
  const authenticated = (req, res, next) => req.session ? next() : res.status(401).json({ error: 'Silakan masuk sebagai admin.' });
  const csrf = (req, res, next) => ['GET', 'HEAD'].includes(req.method) || same(req.get('x-csrf-token'), req.session?.csrf) ? next() : res.status(403).json({ error: 'Token keamanan tidak valid. Muat ulang halaman.' });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' } });
  async function startSession(user, res) {
    const token = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(hashToken(token), user.id, csrfToken, Date.now() + 28800000);
    res.setHeader('Set-Cookie', sessionCookie(token));
    return { username: user.username, csrfToken };
  }
  app.get('/api/auth', (req, res) => res.json(req.session ? { authenticated: true, username: req.session.username, csrfToken: req.session.csrf } : { authenticated: false, setupAvailable: allowSetup && isLocal(req) && !hasUsers(), ...(allowSetup && isLocal(req) && !hasUsers() ? { setupToken } : {}) }));
  app.post('/api/auth/setup', authLimiter, async (req, res) => {
    if (!allowSetup || !isLocal(req) || hasUsers() || !same(req.get('x-setup-token'), setupToken)) return res.status(403).json({ error: 'Pembuatan admin awal tidak tersedia.' });
    const input = credentials.parse(req.body);
    const password = await hashPassword(input.password);
    if (hasUsers()) return res.status(409).json({ error: 'Admin sudah dibuat.' });
    const result = db.prepare('INSERT INTO users(username,password) VALUES (?,?)').run(input.username, password);
    audit(input.username, 'Membuat admin pertama');
    res.status(201).json(await startSession({ id: result.lastInsertRowid, username: input.username }, res));
  });
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const input = credentials.parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE username=?').get(input.username);
    const verified = await verifyPassword(input.password, user?.password || `${'0'.repeat(32)}:${'0'.repeat(128)}`);
    if (!user || !verified) return res.status(401).json({ error: 'Nama pengguna atau kata sandi salah.' });
    audit(user.username, 'Masuk admin');
    res.json(await startSession(user, res));
  });
  app.post('/api/auth/logout', authenticated, csrf, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token=?').run(req.session.token);
    res.setHeader('Set-Cookie', sessionCookie(''));
    res.json({ ok: true });
  });
  app.post('/api/auth/password', authLimiter, authenticated, csrf, async (req, res) => {
    const input = z.object({ currentPassword: z.string().max(128), newPassword: z.string().min(12).max(128) }).parse(req.body);
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.user_id);
    if (!await verifyPassword(input.currentPassword, user.password)) return res.status(400).json({ error: 'Kata sandi saat ini salah.' });
    db.prepare('UPDATE users SET password=? WHERE id=?').run(await hashPassword(input.newPassword), user.id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    audit(user.username, 'Mengganti kata sandi');
    res.json(await startSession(user, res));
  });
  app.get('/api/health', (req, res) => {
    try { db.prepare('SELECT 1').get(); res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'unavailable' }); }
  });
  app.get('/api/content', (req, res) => {
    const result = getContent();
    result.data.articles = result.data.articles.filter(item => item.published);
    result.data.events = result.data.events.filter(item => item.published);
    res.json(result);
  });
  app.use('/api/admin', authenticated, csrf);
  app.get('/api/admin/content', (req, res) => res.json(getContent()));
  app.put('/api/admin/content', (req, res) => {
    const input = z.object({ revision: z.number().int().positive(), data: contentSchema }).parse(req.body);
    const data = cleanContent(input.data);
    const updatedAt = new Date().toISOString();
    const result = db.prepare('UPDATE content SET data=?,revision=revision+1,updated=? WHERE id=1 AND revision=?').run(JSON.stringify(data), updatedAt, input.revision);
    if (!result.changes) return res.status(409).json({ error: 'Data telah berubah di tab lain. Muat ulang sebelum menyimpan kembali.' });
    audit(req.session.username, 'Memperbarui konten website');
    res.json({ revision: input.revision + 1, updatedAt, data });
  });
  app.get('/api/admin/audit', (req, res) => res.json(db.prepare('SELECT username,action,created FROM audit ORDER BY id DESC LIMIT 30').all()));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  app.post('/api/admin/uploads', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Pilih gambar JPG, PNG, atau WebP.' });
    try {
      const image = sharp(req.file.buffer, { limitInputPixels: 25000000 });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format)) return res.status(400).json({ error: 'Hanya gambar JPG, PNG, atau WebP yang didukung.' });
      const filename = `${randomUUID()}.webp`;
      const buffer = await image.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
      writeFileSync(path.join(uploads, filename), buffer, { flag: 'wx' });
      audit(req.session.username, 'Mengunggah gambar');
      res.status(201).json({ url: `/uploads/${filename}`, name: filename, size: buffer.length });
    } catch { res.status(400).json({ error: 'Berkas gambar tidak valid atau terlalu besar.' }); }
  });
  app.get('/api/admin/uploads', (req, res) => res.json(readdirSync(uploads).filter(name => /\.(webp|png|jpe?g)$/i.test(name)).map(name => ({ name, url: `/uploads/${name}`, size: statSync(path.join(uploads, name)).size }))));
  app.delete('/api/admin/uploads/:name', (req, res) => {
    if (!/^[a-zA-Z0-9-]+\.(webp|png|jpg|jpeg)$/.test(req.params.name)) return res.status(400).json({ error: 'Nama berkas tidak valid.' });
    if (JSON.stringify(getContent().data).includes(`/uploads/${req.params.name}`)) return res.status(409).json({ error: 'Gambar masih dipakai di website. Ganti gambar tersebut terlebih dahulu.' });
    try { unlinkSync(path.join(uploads, req.params.name)); } catch { return res.status(404).json({ error: 'Berkas tidak ditemukan.' }); }
    audit(req.session.username, 'Menghapus gambar');
    res.json({ ok: true });
  });
  app.get('/api/events/:id/calendar', (req, res) => {
    const event = getContent().data.events.find(item => item.id === req.params.id && item.published);
    if (!event) return res.status(404).json({ error: 'Agenda tidak ditemukan.' });
    const end = new Date(`${event.endDate}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
    const escape = value => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const compact = value => value.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ASPAPI Sulsel//Agenda//ID', 'BEGIN:VEVENT', `UID:${event.id}@aspapi-sulsel`, `DTSTAMP:${compact(new Date().toISOString())}`, `DTSTART;VALUE=DATE:${compact(event.startDate)}`, `DTEND;VALUE=DATE:${compact(end.toISOString().slice(0, 10))}`, `SUMMARY:${escape(event.title)}`, `LOCATION:${escape(`${event.venue}, ${event.address}`)}`, `DESCRIPTION:${escape(event.activities.join('\n'))}`, 'END:VEVENT', 'END:VCALENDAR'];
    const fold = line => { let output = ''; let bytes = 0; for (const character of line) { const size = Buffer.byteLength(character); if (bytes + size > 73) { output += '\r\n '; bytes = 1; } output += character; bytes += size; } return output; };
    res.type('text/calendar').attachment(`${event.id}.ics`).send(lines.map(fold).join('\r\n') + '\r\n');
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));
  app.use('/uploads', express.static(uploads, { dotfiles: 'deny', index: false, setHeaders: res => res.setHeader('X-Content-Type-Options', 'nosniff') }));
  app.use((error, req, res, next) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('\n') });
    if (error instanceof multer.MulterError) return res.status(400).json({ error: 'Unggahan maksimal 5 MB dan satu gambar per permintaan.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Data melebihi batas ukuran.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Format JSON tidak valid.' });
    console.error('Server error:', error.message);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  });
  return { app, db };
}
export async function attachFrontend(app, production = false) {
  app.get('/admin', (req, res) => res.redirect('/admin.html'));
  if (production) {
    const template = readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
    app.get(['/', '/index.html'], (req, res) => {
      const metadata = app.locals.shareMetadata(req);
      res.status(metadata.missing ? 404 : 200).set('Cache-Control', 'no-cache').type('html').send(injectSocialMetadata(template, metadata));
    });
    app.use(express.static(path.join(root, 'dist')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ root, server: { middlewareMode: true, fs: { allow: [root], deny: ['**/.env*', '**/.git/**', '**/storage/**', '**/server/**', '**/scripts/**', '**/tests/**', '**/backups/**', '**/server.js', '**/content.seed.json', '**/*.sqlite*'] } }, appType: 'mpa' });
    app.get(['/', '/index.html'], async (req, res, next) => {
      try {
        const metadata = app.locals.shareMetadata(req);
        const template = await vite.transformIndexHtml(req.originalUrl, readFileSync(path.join(root, 'index.html'), 'utf8'));
        res.status(metadata.missing ? 404 : 200).set('Cache-Control', 'no-cache').type('html').send(injectSocialMetadata(template, metadata));
      } catch (error) { next(error); }
    });
    app.use(vite.middlewares);
    return vite;
  }
  return null;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const production = process.env.NODE_ENV === 'production';
  if (production && !/^https:\/\/[^/]+$/.test(process.env.PUBLIC_ORIGIN || '')) throw new Error('PUBLIC_ORIGIN=https://domain-anda wajib di produksi.');
  if (process.env.TRUST_PROXY && !['1', 'loopback'].includes(process.env.TRUST_PROXY)) throw new Error('TRUST_PROXY hanya boleh 1 atau loopback.');
  const { app, db } = createApplication({ production, publicOrigin: process.env.PUBLIC_ORIGIN || '', trustProxy: process.env.TRUST_PROXY === '1' ? 1 : 'loopback', ...(process.env.ASPAPI_DATA_DIR ? { dataDir: path.resolve(process.env.ASPAPI_DATA_DIR) } : {}) });
  const vite = await attachFrontend(app, production);
  const port = Number(process.env.PORT || 5174);
  const host = process.env.HOST || '127.0.0.1';
  const server = app.listen(port, host, () => console.log(`ASPAPI listening on ${host}:${port} | Admin: /admin`));
  const shutdown = () => server.close(async () => { if (vite) await vite.close(); db.close(); process.exit(0); });
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}