import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApplication } from '../server.js';
import { hashPassword, openStore } from '../server/store.js';
import sharp from 'sharp';
import { createBackup } from '../scripts/backup.js';
import { exportTransfer, importTransfer } from '../scripts/transfer.js';

test('admin authentication, CSRF, content persistence and safe publication', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'aspapi-test-'));
  const { app, db } = createApplication({ dataDir: directory, seedPath: null });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  let csrf = '';
  const request = (url, method = 'GET', data, extra = {}) => fetch(origin + url, { method, headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, ...extra }, ...(data ? { body: JSON.stringify(data) } : {}) });
  try {
    assert.equal((await request('/api/admin/content')).status, 401);
    const setup = await (await request('/api/auth')).json();
    assert.equal(setup.setupAvailable, true);
    assert.equal((await request('/api/auth/setup', 'POST', { username: 'tester', password: 'TestOnly-Password-42' })).status, 403);
    const created = await request('/api/auth/setup', 'POST', { username: 'tester', password: 'TestOnly-Password-42' }, { 'X-Setup-Token': setup.setupToken });
    assert.equal(created.status, 201);
    cookie = created.headers.get('set-cookie').split(';')[0];
    csrf = (await created.json()).csrfToken;
    assert.match(created.headers.get('set-cookie'), /HttpOnly/);
    assert.match(created.headers.get('set-cookie'), /SameSite=Strict/);
    const content = await (await request('/api/admin/content')).json();
    content.data.settings.brand = 'ASPAPI Test';
    content.data.profiles[0].content = '<p>Safe</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a>';
    content.data.profiles.find(item => item.id === 'inisiator').content = '<ol class="profile-initiators"><li><img src="https://aspapi.id/images/inisiator/prof-dr-muhyadi.png" alt="Prof. Dr. Muhyadi" width="48" height="56" onerror="alert(1)"><strong>Prof. Dr. Muhyadi</strong><br>Universitas Negeri Yogyakarta</li></ol>';
    content.data.articles.push({ id: 'draft', title: 'Draft', category: 'Berita', topic: '', summary: '', content: '<p>draft</p>', image: '', imageAlt: '', readMinutes: 3, publishedAt: '', published: false });
    assert.equal((await request('/api/admin/content', 'PUT', content, { 'X-CSRF-Token': '' })).status, 403);
    assert.equal((await request('/api/admin/content', 'PUT', content, { Origin: 'https://evil.example' })).status, 403);
    const saved = await request('/api/admin/content', 'PUT', content);
    assert.equal(saved.status, 200);
    const result = await saved.json();
    assert.equal(result.revision, content.revision + 1);
    assert.ok(!result.data.profiles[0].content.includes('<script'));
    assert.ok(!result.data.profiles[0].content.includes('javascript:'));
    const initiators = result.data.profiles.find(item => item.id === 'inisiator').content;
    assert.match(initiators, /class="profile-initiators"/);
    assert.match(initiators, /width="48" height="56"/);
    assert.ok(!initiators.includes('onerror'));
    assert.equal((await request('/api/admin/content', 'PUT', content)).status, 409);
    const published = await (await request('/api/content')).json();
    assert.equal(published.data.settings.brand, 'ASPAPI Test');
    assert.equal(published.data.articles.length, 0);
    assert.equal(JSON.parse(db.prepare('SELECT data FROM content WHERE id=1').get().data).articles.length, 1);
    const malicious = structuredClone(result);
    malicious.data.settings.registrationUrl = '/\\example.com';
    assert.equal((await request('/api/admin/content', 'PUT', malicious)).status, 400);
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#bc2333' } }).png().toBuffer();
    const imageData = new FormData(); imageData.append('image', new Blob([png], { type: 'image/png' }), 'valid.png');
    const uploaded = await fetch(origin + '/api/admin/uploads', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'X-CSRF-Token': csrf }, body: imageData });
    assert.equal(uploaded.status, 201);
    const media = await uploaded.json();
    assert.match(media.url, /^\/uploads\/.+\.webp$/);
    result.data.settings.logo = media.url;
    const withLogo = await request('/api/admin/content', 'PUT', result);
    assert.equal(withLogo.status, 200);
    assert.equal((await request('/api/admin/uploads/' + media.name, 'DELETE')).status, 409);
    const invalidImage = new FormData(); invalidImage.append('image', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'fake.png');
    assert.equal((await fetch(origin + '/api/admin/uploads', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'X-CSRF-Token': csrf }, body: invalidImage })).status, 400);
    const oversized = new FormData(); oversized.append('image', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png');
    assert.equal((await fetch(origin + '/api/admin/uploads', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'X-CSRF-Token': csrf }, body: oversized })).status, 400);
    assert.equal((await request('/api/auth/setup', 'POST', { username: 'other', password: 'TestOnly-Password-42' }, { 'X-Setup-Token': setup.setupToken })).status, 403);
    assert.equal((await request('/api/auth/logout', 'POST', {})).status, 200);
    assert.equal((await request('/api/admin/content')).status, 401);
    assert.equal((await request('/api/auth/login', 'POST', { username: 'tester', password: 'Incorrect-Password-42' })).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('production setup is disabled, secure cookies and persistence survive restart', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'aspapi-production-'));
  const { app, db } = createApplication({ dataDir: directory, seedPath: null, production: true, publicOrigin: 'https://aspapi.example', trustProxy: 1 });
  db.prepare('INSERT INTO users(username,password) VALUES (?,?)').run('production-test', await hashPassword('Only-Test-Password-123'));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(origin + '/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    assert.equal((await (await fetch(origin + '/api/auth')).json()).setupAvailable, false);
    assert.equal((await fetch(origin + '/api/auth/setup', { method: 'POST', headers: { Origin: 'https://aspapi.example' } })).status, 403);
    const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: 'https://aspapi.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'production-test', password: 'Only-Test-Password-123' }) });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /Secure/);
    db.prepare('UPDATE sessions SET expires=0').run();
    assert.equal((await fetch(origin + '/api/admin/content', { headers: { Cookie: response.headers.get('set-cookie').split(';')[0] } })).status, 401);
    for (const route of ['/storage/aspapi.sqlite', '/content.seed.json', '/server.js', '/.env']) assert.equal((await fetch(origin + route)).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve)); db.close();
    const reopened = openStore(directory, null);
    assert.equal(reopened.prepare('SELECT username FROM users').get().username, 'production-test');
    assert.ok(reopened.prepare('SELECT data FROM content WHERE id=1').get());
    reopened.close(); rmSync(directory, { recursive: true, force: true });
  }
});

test('backup snapshots database and media; account CLI help needs no credentials', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'aspapi-backup-'));
  const storage = path.join(directory, 'storage');
  const db = openStore(storage, null);
  try {
    mkdirSync(path.join(storage, 'uploads'));
    writeFileSync(path.join(storage, 'uploads', 'test.webp'), Buffer.from('backup-test'));
    const destination = createBackup(storage, path.join(directory, 'backups'));
    const restored = openStore(destination, null);
    assert.deepEqual(restored.prepare('SELECT data FROM content').get(), db.prepare('SELECT data FROM content').get());
    restored.close();
    assert.equal(readFileSync(path.join(destination, 'uploads', 'test.webp'), 'utf8'), 'backup-test');
    const script = fileURLToPath(new URL('../scripts/admin-account.js', import.meta.url));
    const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
    assert.equal(help.status, 0);
    assert.match(help.stdout, /--reset/);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('private transfer restores content and accounts once without sessions', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'aspapi-transfer-'));
  const source = path.join(directory, 'source');
  const target = path.join(directory, 'target');
  const original = openStore(source, null);
  const destination = openStore(target, null);
  destination.close();
  try {
    const password = await hashPassword('TestOnly-Transfer-42');
    original.prepare('INSERT INTO users(username,password) VALUES (?,?)').run('transfer-test', password);
    original.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run('test-session', 1, 'test-csrf', Date.now() + 10000);
    const filename = path.join(directory, 'private-transfer.json');
    const exported = exportTransfer(source, filename);
    assert.equal(exported.accounts, 1);
    assert.ok(!readFileSync(filename, 'utf8').includes('test-session'));
    const imported = importTransfer(target, filename);
    assert.equal(imported.accounts, 1);
    const restored = openStore(target, null);
    assert.equal(restored.prepare('SELECT count(*) AS total FROM sessions').get().total, 0);
    assert.equal(restored.prepare('SELECT password FROM users').get().password, password);
    restored.close();
    assert.throws(() => importTransfer(target, filename), /instalasi baru/);
  } finally { original.close(); rmSync(directory, { recursive: true, force: true }); }
});