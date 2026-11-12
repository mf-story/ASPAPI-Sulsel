import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createApplication, attachFrontend } from '../server.js';

test('admin browser workflow, publication, media and responsive views', { timeout: 180000 }, async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const directory = mkdtempSync(path.join(tmpdir(), 'aspapi-browser-'));
  const { app, db } = createApplication({ dataDir: directory, seedPath: path.join(root, 'content.seed.json') });
  await attachFrontend(app, true);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ ...(process.platform === 'win32' ? { channel: 'msedge' } : {}), headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await context.route(/fonts\.(googleapis|gstatic)\.com|images\.unsplash\.com/, route => route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/admin`);
    await expect(page.getByRole('heading', { name: 'Buat Admin Pertama' })).toBeVisible();
    await page.getByLabel('Nama pengguna').fill('cms-test');
    await page.getByLabel('Kata sandi', { exact: true }).fill('TestOnly-Password-42');
    await page.getByRole('button', { name: 'Buat Admin', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ringkasan Website' })).toBeVisible();
    await page.locator('[data-view="profiles"]').click();
    await page.locator('[data-profile-edit="sejarah"]').click();
    await page.locator('.ql-editor').fill('Riwayat pengujian editor admin.');
    const png = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#bc2333' } }).png().toBuffer();
    const profileChooser = page.waitForEvent('filechooser');
    await page.locator('.ql-image').click();
    await (await profileChooser).setFiles({ name: 'profil.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('.ql-editor img')).toHaveAttribute('src', /^\/uploads\/.+\.webp$/);
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(page.locator('.profile-list')).toBeVisible();
    let publicContent = await (await fetch(origin + '/api/content')).json();
    assert.match(publicContent.data.profiles.find(item => item.id === 'sejarah').content, /Riwayat\s+pengujian\s+editor\s+admin/);
    assert.match(publicContent.data.profiles.find(item => item.id === 'sejarah').content, /<img src="\/uploads\//);
    await page.locator('[data-view="articles"]').click();
    await page.getByRole('button', { name: 'Tambah Informasi' }).click();
    await page.getByLabel('Judul', { exact: true }).fill('Berita Pengujian CMS');
    await page.getByLabel('Ringkasan', { exact: true }).fill('Ringkasan untuk uji publikasi.');
    await page.locator('.ql-editor').fill('Isi berita untuk menguji penyimpanan dan publikasi.');
    const fileChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Unggah Gambar', exact: true }).click();
    await (await fileChooser).setFiles({ name: 'uji.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('input[name="image"]')).toHaveValue(/^\/uploads\/.+\.webp$/);
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(page.locator('[data-edit="berita-pengujian-cms"]')).toBeVisible();
    publicContent = await (await fetch(origin + '/api/content')).json();
    assert.ok(!publicContent.data.articles.some(item => item.id === 'berita-pengujian-cms'));
    await page.locator('[data-edit="berita-pengujian-cms"]').click();
    await page.getByLabel('Terbitkan di website').check();
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(page.locator('[data-edit="berita-pengujian-cms"]')).toBeVisible();
    const publicPage = await context.newPage();
    publicPage.on('pageerror', error => errors.push(error.message));
    await publicPage.goto(origin + '/?artikel=berita-pengujian-cms');
    await expect(publicPage.locator('#article-page-title')).toHaveText('Berita Pengujian CMS');
    await expect(publicPage.locator('.article-detail-copy')).toContainText('Isi berita untuk menguji');
    await expect(publicPage.locator('dialog[open]')).toHaveCount(0);
    await page.locator('[data-edit="berita-pengujian-cms"]').click();
    await page.locator('input[name="image"]').fill('');
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(page.locator('[data-edit="berita-pengujian-cms"]')).toBeVisible();
    await publicPage.reload();
    await expect(publicPage.locator('#article-page-title')).toHaveText('Berita Pengujian CMS');
    await expect(publicPage.locator('.article-detail-image')).toHaveCount(0);
    await page.locator('[data-view="events"]').click();
    await page.locator('[data-edit="kongres-v-aspapi"]').click();
    await page.getByLabel('Tautan pendaftaran').fill('https://example.com/registrasi');
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(page.locator('[data-edit="kongres-v-aspapi"]')).toBeVisible();
    await publicPage.goto(origin + '/#agenda');
    await expect(publicPage.locator('.event-actions a').filter({ hasText: 'Daftar' })).toHaveAttribute('href', 'https://example.com/registrasi');
    const calendar = await (await fetch(origin + '/api/events/kongres-v-aspapi/calendar')).text();
    assert.match(calendar, /DTEND;VALUE=DATE:20261123/);
    await page.locator('[data-view="settings"]').click();
    await page.locator('[data-group="hero"]').click();
    await page.locator('textarea[name="heroDescription"]').fill('Deskripsi CMS yang berhasil diperbarui.');
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(page.locator('#save-state')).toHaveText('Semua perubahan tersimpan');
    await publicPage.reload();
    await expect(publicPage.locator('.hero-description')).toHaveText('Deskripsi CMS yang berhasil diperbarui.');
    await publicPage.route('https://aspapi.id/images/inisiator/**', route => route.fulfill({ contentType: 'image/png', body: png }));
    for (const width of [1440, 390, 320]) {
      await publicPage.setViewportSize({ width, height: 844 });
      if (width <= 940) await publicPage.locator('.menu-toggle').click();
      await publicPage.locator('.profile-toggle').click();
      await publicPage.locator('[data-profile="inisiator"]').click();
      const dialog = publicPage.locator('dialog[open]');
      await expect(dialog.locator('.profile-initiators img')).toHaveCount(17);
      const photos = await dialog.locator('.profile-initiators img').evaluateAll(images => images.map(image => {
        const { width, height } = image.getBoundingClientRect();
        return { width, height, alt: image.alt, name: image.parentElement.querySelector('strong').textContent };
      }));
      for (const photo of photos) {
        assert.equal(photo.width, 48);
        assert.equal(photo.height, 56);
        assert.equal(photo.alt, photo.name);
      }
      assert.equal(await dialog.evaluate(element => element.scrollWidth > element.clientWidth), false, `Initiators overflow: ${width}`);
      await publicPage.keyboard.press('Escape');
    }
    for (const width of [320, 390, 500, 640, 641, 940, 1440]) {
      await publicPage.setViewportSize({ width, height: 844 });
      await publicPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      const join = publicPage.locator('.header-join');
      await expect(join).toBeVisible();
      await expect(join).toHaveAttribute('href', 'https://aspapi.id/anggota/daftar');
      await join.click({ trial: true });
      const layout = await publicPage.evaluate(() => {
        const rect = selector => {
          const { left, right, top, bottom } = document.querySelector(selector).getBoundingClientRect();
          return { left, right, top, bottom };
        };
        return { join: rect('.header-join'), brand: rect('.site-header .brand'), toggle: rect('.menu-toggle'), header: rect('.site-header'), hero: rect('.hero') };
      });
      assert.ok(layout.join.left >= 0 && layout.join.right <= width, `Join button outside viewport: ${width}`);
      assert.ok(layout.join.top >= layout.header.top && layout.join.bottom <= layout.header.bottom, `Join button outside header: ${width}`);
      if (width <= 640) {
        assert.ok(layout.join.top >= Math.max(layout.brand.bottom, layout.toggle.bottom), `Mobile header overlap: ${width}`);
        assert.ok(layout.hero.top >= layout.header.bottom, `Hero overlaps header: ${width}`);
      }
      if (width <= 940) {
        await publicPage.locator('.menu-toggle').click();
        await expect(publicPage.locator('#main-nav')).toBeVisible();
        await expect(join).toBeVisible();
        await join.click({ trial: true });
        await publicPage.locator('.menu-toggle').click();
        await expect(publicPage.locator('#main-nav')).toBeHidden();
      }
    }
    await page.locator('[data-view="dashboard"]').click();
    const screenshots = path.join(root, 'test-results'); mkdirSync(screenshots, { recursive: true });
    await publicPage.setViewportSize({ width: 390, height: 844 });
    await publicPage.screenshot({ path: path.join(screenshots, 'home-mobile.png') });
    await page.screenshot({ path: path.join(screenshots, 'admin-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const view of ['dashboard', 'articles', 'events', 'settings', 'profiles', 'media', 'account']) {
      await page.locator(`[data-view="${view}"]`).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow: ${view}`);
    }
    await page.locator('[data-view="dashboard"]').click();
    await page.screenshot({ path: path.join(screenshots, 'admin-mobile.png'), fullPage: true });
    await page.locator('[data-view="articles"]').click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-delete="berita-pengujian-cms"]').click();
    await expect(page.locator('[data-edit="berita-pengujian-cms"]')).toHaveCount(0);
    await page.locator('[data-view="account"]').click();
    await page.getByLabel('Kata sandi saat ini', { exact: true }).fill('TestOnly-Password-42');
    await page.getByLabel('Kata sandi baru', { exact: true }).fill('NewTestOnly-Password-42');
    await page.getByLabel('Ulangi kata sandi baru', { exact: true }).fill('NewTestOnly-Password-42');
    await page.getByRole('button', { name: 'Ganti Kata Sandi', exact: true }).click();
    await expect(page.locator('#notice')).toContainText('Kata sandi berhasil diganti');
    await page.getByRole('button', { name: 'Keluar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Masuk Admin' })).toBeVisible();
    await page.getByLabel('Nama pengguna').fill('cms-test');
    await page.getByLabel('Kata sandi', { exact: true }).fill('NewTestOnly-Password-42');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.locator('#admin-shell')).toBeVisible();
    for (const route of ['/storage/aspapi.sqlite', '/content.seed.json', '/server.js', '/server/store.js', '/scripts/migrate-content.js', '/.env']) assert.equal((await fetch(origin + route)).status, 404, route);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve)); db.close(); rmSync(directory, { recursive: true, force: true });
  }
});