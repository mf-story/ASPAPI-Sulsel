import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import sharp from 'sharp';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { emptyContent } from '../cms-model.js';
import { socialMetadata, injectSocialMetadata, renderSocialImage } from '../server/social.js';
import { createApplication, attachFrontend } from '../server.js';
import { once } from 'node:events';

test('social metadata is server-rendered, canonical and draft-safe', async () => {
  const data = emptyContent();
  data.settings.brand = 'ASPAPI'; data.settings.region = 'Sulawesi Selatan';
  data.settings.pageTitle = 'ASPAPI Sulawesi Selatan'; data.settings.description = 'Wadah profesi administrasi perkantoran.';
  data.articles = [{ id: 'berita', published: true, title: 'Kegiatan "ASPAPI" <2026>', summary: 'Berita & informasi terbaru.', image: '/uploads/berita.webp', imageAlt: 'Kegiatan ASPAPI', publishedAt: '2026-11-12' }, { id: 'rahasia', published: false, title: 'Draf internal', summary: 'Jangan tampilkan' }];
  const snapshot = { revision: 5, data };
  const template = '<html><head><title>Lama</title><meta name="description" content="Lama"></head><body></body></html>';
  const home = socialMetadata(snapshot, '/?utm_source=wa#tentang', 'https://aspapi.example');
  assert.equal(home.canonical, 'https://aspapi.example/');
  const article = socialMetadata(snapshot, '/?artikel=berita&utm_source=wa', 'https://aspapi.example');
  const document = load(injectSocialMetadata(template, article));
  assert.equal(document('meta[property="og:title"]').attr('content'), data.articles[0].title);
  assert.equal(document('meta[property="og:type"]').attr('content'), 'article');
  assert.equal(document('link[rel="canonical"]').attr('href'), 'https://aspapi.example/?artikel=berita');
  assert.equal(document('meta[name="description"]').length, 1);
  assert.equal(document('meta[property="og:image:width"]').attr('content'), '1200');
  assert.match(document('meta[property="og:image"]').attr('content'), /^https:\/\/aspapi.example\/share\/preview.jpg\?artikel=berita&v=5$/);
  const missing = socialMetadata(snapshot, '/?artikel=rahasia', 'https://aspapi.example');
  const hidden = injectSocialMetadata(template, missing);
  assert.equal(missing.missing, true); assert.ok(!hidden.includes('Draf internal')); assert.ok(!hidden.includes('og:image'));
  const directory = mkdtempSync(path.join(tmpdir(), 'aspapi-social-'));
  try {
    mkdirSync(path.join(directory, 'uploads'));
    const image = await sharp({ create: { width: 100, height: 200, channels: 3, background: '#bc2333' } }).webp().toBuffer();
    writeFileSync(path.join(directory, 'uploads', 'berita.webp'), image);
    for (const metadata of [home, article]) {
      const jpeg = await renderSocialImage(metadata, path.join(directory, 'uploads'), path.join(directory, 'missing.jpg'));
      const dimensions = await sharp(jpeg).metadata();
      assert.equal(dimensions.width, 1200); assert.equal(dimensions.height, 630); assert.equal(dimensions.format, 'jpeg');
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('WhatsApp receives metadata and JPEG directly from HTTP without JavaScript', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'aspapi-social-http-'));
  const { app, db } = createApplication({ dataDir: directory, seedPath: null, production: true, publicOrigin: 'https://aspapi.example' });
  const data = emptyContent();
  data.settings.brand = 'ASPAPI'; data.settings.region = 'Sulawesi Selatan'; data.settings.pageTitle = 'ASPAPI Sulsel'; data.settings.description = 'Profil organisasi.';
  data.articles = [{ id: 'home', published: true, title: 'Berita Publik', summary: 'Ringkasan berita publik.', image: '/uploads/test.webp', imageAlt: '', publishedAt: '2026-11-12' }, { id: 'draf', published: false, title: 'Rahasia' }];
  writeFileSync(path.join(directory, 'uploads', 'test.webp'), await sharp({ create: { width: 200, height: 100, channels: 3, background: '#bc2333' } }).webp().toBuffer());
  db.prepare('UPDATE content SET data=? WHERE id=1').run(JSON.stringify(data));
  await attachFrontend(app, true);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const homeImage = Buffer.from(await (await fetch(origin + '/share/preview.jpg')).arrayBuffer());
    const response = await fetch(origin + '/?artikel=home', { headers: { 'User-Agent': 'WhatsApp/2.26' } });
    assert.equal(response.status, 200);
    const document = load(await response.text());
    assert.equal(document('meta[property="og:title"]').attr('content'), 'Berita Publik');
    const imageUrl = new URL(document('meta[property="og:image"]').attr('content'));
    const image = await fetch(origin + imageUrl.pathname + imageUrl.search);
    assert.equal(image.status, 200); assert.match(image.headers.get('content-type'), /image\/jpeg/);
    const articleImage = Buffer.from(await image.arrayBuffer());
    assert.notDeepEqual(articleImage, homeImage);
    const dimensions = await sharp(articleImage).metadata();
    assert.equal(dimensions.width, 1200); assert.equal(dimensions.height, 630);
    assert.equal((await fetch(origin + '/?artikel=draf')).status, 404);
    assert.equal((await fetch(origin + '/share/preview.jpg?artikel=draf')).status, 404);
    const index = load(await (await fetch(origin + '/index.html')).text());
    assert.equal(index('meta[property="og:type"]').attr('content'), 'website');
  } finally { await new Promise(resolve => server.close(resolve)); db.close(); rmSync(directory, { recursive: true, force: true }); }
});