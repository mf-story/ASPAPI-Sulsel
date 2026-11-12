import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { createIcons, ArrowRight, LayoutDashboard, SlidersHorizontal, Building2, Newspaper, CalendarDays, Images, ShieldCheck, ExternalLink, LogOut, Save, Plus, Pencil, Trash2, Upload, Download, Copy, RefreshCw } from 'lucide';
import { contentGroups } from './cms-model.js';

const icons = { ArrowRight, LayoutDashboard, SlidersHorizontal, Building2, Newspaper, CalendarDays, Images, ShieldCheck, ExternalLink, LogOut, Save, Plus, Pencil, Trash2, Upload, Download, Copy, RefreshCw };
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const main = document.querySelector('#admin-main');
const shell = document.querySelector('#admin-shell');
const authScreen = document.querySelector('#auth-screen');
let auth = {};
let snapshot;
let dirty = false;
let busy = false;
let activeView = 'dashboard';
let noticeTimer;
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const drawIcons = () => createIcons({ icons });
function notify(message, error = false) {
  const notice = document.querySelector('#notice');
  notice.textContent = message; notice.classList.toggle('error', error); notice.hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.hidden = true; }, error ? 15000 : 5000);
}
function setDirty(value) {
  dirty = value;
  const state = document.querySelector('#save-state');
  state.textContent = value ? 'Ada perubahan belum disimpan' : 'Semua perubahan tersimpan';
  state.classList.toggle('dirty', value);
}
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(auth.csrfToken ? { 'X-CSRF-Token': auth.csrfToken } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !url.includes('/auth/login')) {
      shell.hidden = true; authScreen.hidden = false; auth = {};
      document.querySelector('#auth-title').textContent = 'Masuk Admin';
      document.querySelector('#auth-submit').innerHTML = `Masuk ${icon('arrow-right')}`; drawIcons();
    }
    throw new Error(data.error || 'Permintaan gagal.');
  }
  return data;
}
async function saveData(data) {
  if (busy) return false;
  busy = true;
  main.querySelectorAll('button[type="submit"]').forEach(button => { button.disabled = true; });
  try {
    snapshot = await api('/api/admin/content', { method: 'PUT', body: JSON.stringify({ revision: snapshot.revision, data }) });
    setDirty(false); notify('Perubahan tersimpan. Website publik sudah diperbarui.'); return true;
  } catch (error) { notify(error.message, true); return false; }
  finally { busy = false; main.querySelectorAll('button[type="submit"]').forEach(button => { button.disabled = false; }); }
}
const allowedToLeave = () => !busy && (!dirty || confirm('Ada perubahan belum disimpan. Tinggalkan halaman ini?'));
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
for (const name of ['input', 'change']) main.addEventListener(name, event => { if (event.target.closest('form[data-editor]')) setDirty(true); });
const heading = (title, actions = '') => `<div class="view-heading"><div><span class="overline">PENGELOLAAN KONTEN</span><h1>${esc(title)}</h1></div><div class="view-actions">${actions}</div></div>`;
const footer = () => `<div class="form-footer"><button type="button" class="btn" data-cancel>Batal</button><button type="submit" class="btn primary">${icon('save')} Simpan Perubahan</button></div>`;
function field(name, label, value = '', type = 'text', required = false, full = false) {
  if (type === 'textarea') return `<label class="${full ? 'span-all' : ''}">${esc(label)}<textarea name="${name}" ${required ? 'required' : ''}>${esc(value)}</textarea></label>`;
  if (type === 'image') return `<div class="image-field ${full ? 'span-all' : ''}"><label>${esc(label)}<div class="image-line"><input name="${name}" value="${esc(value)}" placeholder="/uploads/gambar.webp atau https://..."><button type="button" class="btn" data-upload-for="${name}">${icon('upload')} Unggah Gambar</button></div></label><img class="image-preview" data-preview="${name}" ${value ? `src="${esc(value)}"` : 'hidden'} alt="Pratinjau gambar"></div>`;
  return `<label class="${full ? 'span-all' : ''}">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${type === 'number' ? 'min="1" max="180"' : ''}></label>`;
}
const richMarkup = () => '<div class="rich-field span-all"><span class="rich-label" id="content-label">Isi Konten</span><div id="rich-editor" class="rich-editor"></div></div>';
function initRich(html) {
  const editor = new Quill('#rich-editor', { theme: 'snow', modules: { toolbar: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['blockquote', 'link', 'image', 'clean']] } });
  editor.clipboard.dangerouslyPasteHTML(html);
  editor.root.setAttribute('aria-labelledby', 'content-label');
  let value = html;
  editor.on('text-change', (delta, old, source) => { if (source === 'user') { value = editor.getSemanticHTML(); setDirty(true); } });
  editor.getModule('toolbar').addHandler('image', () => {
    const index = editor.getSelection()?.index ?? editor.getLength() - 1;
    chooseImage(result => { if (editor.root.isConnected) editor.insertEmbed(index, 'image', result.url, 'user'); });
  });
  const labels = { bold: 'Tebal', italic: 'Miring', underline: 'Garis bawah', blockquote: 'Kutipan', link: 'Tautan', image: 'Unggah gambar ke konten', clean: 'Hapus format', list: 'Daftar' };
  main.querySelectorAll('.ql-toolbar button').forEach(button => { const name = [...button.classList].find(item => item.startsWith('ql-'))?.slice(3); button.title = labels[name] || 'Format'; button.setAttribute('aria-label', button.title); });
  return () => value;
}
async function uploadImage(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 5 MB.');
  const form = new FormData(); form.append('image', file);
  return api('/api/admin/uploads', { method: 'POST', body: form });
}
function chooseImage(callback) {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
  input.addEventListener('change', async () => { if (!input.files[0]) return; try { notify('Mengunggah gambar...'); const result = await uploadImage(input.files[0]); await callback(result); notify('Gambar berhasil diunggah.'); } catch (error) { notify(error.message, true); } });
  input.click();
}
function bindForm(form, cancelView) {
  form.querySelector('[data-cancel]').onclick = () => navigate(cancelView);
  form.querySelectorAll('[data-upload-for]').forEach(button => button.onclick = () => chooseImage(result => { if (!form.isConnected) return; form.elements.namedItem(button.dataset.uploadFor).value = result.url; const preview = form.querySelector(`[data-preview="${button.dataset.uploadFor}"]`); preview.src = result.url; preview.hidden = false; setDirty(true); }));
  form.querySelectorAll('[data-preview]').forEach(preview => form.elements.namedItem(preview.dataset.preview).addEventListener('change', event => { const value = event.target.value; const valid = /^(https?:\/\/|\/(?!\/))/.test(value); if (valid) preview.src = value; else preview.removeAttribute('src'); preview.hidden = !valid; }));
  drawIcons();
}
async function navigate(view, force = false) {
  if (!force && !allowedToLeave()) return;
  setDirty(false); activeView = view; history.replaceState(null, '', `#${view}`);
  document.querySelectorAll('[data-view]').forEach(button => { button.classList.toggle('active', button.dataset.view === view); if (button.dataset.view === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  try {
    if (view === 'settings') renderSettings('identity');
    else if (view === 'profiles') renderProfiles();
    else if (view === 'articles' || view === 'events') renderCollection(view);
    else if (view === 'media') await renderMedia();
    else if (view === 'account') renderAccount();
    else await renderDashboard();
    drawIcons();
  } catch (error) { notify(error.message, true); }
}
async function renderDashboard() {
  const data = snapshot.data;
  main.innerHTML = heading('Ringkasan Website', `<button class="btn" id="export-content">${icon('download')} Ekspor Konten</button><button class="btn" id="reload-content">${icon('refresh-cw')} Muat Ulang</button>`) + `<div class="metrics"><div class="metric"><strong>${data.articles.filter(item => item.published).length}</strong><span>Informasi Terbit</span></div><div class="metric"><strong>${data.articles.filter(item => !item.published).length}</strong><span>Draf Informasi</span></div><div class="metric"><strong>${data.events.length}</strong><span>Agenda Kegiatan</span></div><div class="metric"><strong>${data.profiles.length}</strong><span>Bagian Profil</span></div></div><div class="dashboard-bottom"><section><h2>Akses Cepat</h2><div class="quick-actions"><button class="btn" data-quick="articles">${icon('plus')} Tulis Informasi Baru</button><button class="btn" data-quick="events">${icon('calendar-days')} Tambah Agenda</button><button class="btn" data-quick="settings">${icon('sliders-horizontal')} Perbarui Beranda</button></div></section><section><h2>Aktivitas Admin</h2><ul id="audit-list" class="activity-list"></ul></section></div>`;
  main.querySelectorAll('[data-quick]').forEach(button => button.onclick = async () => { await navigate(button.dataset.quick); if (['articles', 'events'].includes(button.dataset.quick)) editCollection(button.dataset.quick); });
  document.querySelector('#reload-content').onclick = async () => { try { snapshot = await api('/api/admin/content'); await navigate('dashboard', true); notify('Konten terbaru dimuat.'); } catch (error) { notify(error.message, true); } };
  document.querySelector('#export-content').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot.data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `aspapi-konten-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const logs = await api('/api/admin/audit'); const list = document.querySelector('#audit-list');
  if (list) list.innerHTML = logs.map(item => `<li>${esc(item.action)}<span>${esc(item.username)} &middot; ${new Date(item.created).toLocaleString('id-ID')}</span></li>`).join('') || '<li>Belum ada aktivitas.</li>';
}
function renderSettings(groupId) {
  const group = contentGroups.find(item => item.id === groupId);
  main.innerHTML = heading('Pengaturan & Beranda') + `<div class="section-tabs" role="group" aria-label="Bagian pengaturan">${contentGroups.map(item => `<button data-group="${item.id}" class="${item.id === groupId ? 'active' : ''}">${esc(item.title)}</button>`).join('')}</div><form data-editor><section class="form-section"><h2>${esc(group.title)}</h2><div class="form-grid">${group.fields.map(item => field(item.key, item.label, snapshot.data.settings[item.key], ['textarea', 'multiline'].includes(item.type) ? 'textarea' : item.type === 'image' ? 'image' : 'text', false, ['textarea', 'multiline', 'image'].includes(item.type))).join('')}</div></section>${footer()}</form>`;
  main.querySelectorAll('[data-group]').forEach(button => button.onclick = () => { if (allowedToLeave()) { setDirty(false); renderSettings(button.dataset.group); } });
  const form = main.querySelector('form'); bindForm(form, 'dashboard');
  form.onsubmit = async event => { event.preventDefault(); const data = structuredClone(snapshot.data); for (const item of group.fields) data.settings[item.key] = form.elements.namedItem(item.key).value.trim(); if (await saveData(data)) renderSettings(groupId); };
}
function renderProfiles() {
  main.innerHTML = heading('Profil Organisasi') + `<div class="profile-list">${snapshot.data.profiles.map((item, index) => `<div class="profile-row"><div><span>PROFIL ${String(index + 1).padStart(2, '0')}</span><h2>${esc(item.title)}</h2></div><button class="btn" data-profile-edit="${item.id}">${icon('pencil')} Edit Profil</button></div>`).join('')}</div>`;
  main.querySelectorAll('[data-profile-edit]').forEach(button => button.onclick = () => editProfile(button.dataset.profileEdit));
}
function editProfile(id) {
  const item = snapshot.data.profiles.find(profile => profile.id === id);
  main.innerHTML = heading(item.title) + `<form data-editor><div class="form-grid">${field('title', 'Judul Profil', item.title, 'text', true, true)}${richMarkup()}</div>${footer()}</form>`;
  const readRich = initRich(item.content); const form = main.querySelector('form'); bindForm(form, 'profiles');
  form.onsubmit = async event => { event.preventDefault(); const data = structuredClone(snapshot.data); Object.assign(data.profiles.find(profile => profile.id === id), { title: form.elements.title.value.trim(), content: readRich() }); if (await saveData(data)) await navigate('profiles', true); };
}
function renderCollection(kind) {
  const isArticle = kind === 'articles';
  main.innerHTML = heading(isArticle ? 'Berita & Informasi' : 'Agenda Kegiatan', `<button class="btn primary" id="add-item">${icon('plus')} ${isArticle ? 'Tambah Informasi' : 'Tambah Agenda'}</button>`) + '<div class="filters"><label class="visually-hidden" for="list-search">Cari judul</label><input id="list-search" type="search" placeholder="Cari judul..."><label class="visually-hidden" for="list-status">Status</label><select id="list-status"><option value="all">Semua Status</option><option value="published">Terbit</option><option value="draft">Draf</option></select></div><div class="table-wrap"><table><thead><tr><th>JUDUL</th><th>KATEGORI / TANGGAL</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody id="list-body"></tbody></table></div>';
  const draw = () => {
    const query = document.querySelector('#list-search').value.toLowerCase(); const status = document.querySelector('#list-status').value;
    const items = snapshot.data[kind].filter(item => item.title.toLowerCase().includes(query) && (status === 'all' || item.published === (status === 'published')));
    document.querySelector('#list-body').innerHTML = items.map(item => `<tr><td><strong>${esc(item.title)}</strong><small>${esc(item.id)}</small></td><td>${esc(isArticle ? item.category : `${item.startDate} - ${item.endDate}`)}</td><td><span class="status-badge ${item.published ? '' : 'draft'}">${item.published ? 'Terbit' : 'Draf'}</span></td><td><div class="row-actions">${isArticle && item.published ? `<a class="icon-btn" href="/?artikel=${encodeURIComponent(item.id)}" target="_blank" rel="noopener noreferrer" title="Lihat artikel" aria-label="Lihat artikel">${icon('external-link')}</a>` : ''}<button class="icon-btn" data-edit="${esc(item.id)}" title="Edit" aria-label="Edit ${esc(item.title)}">${icon('pencil')}</button><button class="icon-btn danger" data-delete="${esc(item.id)}" title="Hapus" aria-label="Hapus ${esc(item.title)}">${icon('trash-2')}</button></div></td></tr>`).join('') || '<tr><td colspan="4" class="empty-state">Tidak ada konten yang sesuai.</td></tr>';
    main.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => editCollection(kind, button.dataset.edit));
    main.querySelectorAll('[data-delete]').forEach(button => button.onclick = async () => { const item = snapshot.data[kind].find(entry => entry.id === button.dataset.delete); if (!confirm(`Hapus "${item.title}"? Tindakan ini tidak dapat dibatalkan.`)) return; const data = structuredClone(snapshot.data); data[kind] = data[kind].filter(entry => entry.id !== item.id); if (await saveData(data)) renderCollection(kind); });
    drawIcons();
  };
  document.querySelector('#list-search').oninput = draw; document.querySelector('#list-status').onchange = draw; document.querySelector('#add-item').onclick = () => editCollection(kind); draw();
}
function editCollection(kind, itemId) {
  const isArticle = kind === 'articles'; const today = new Date().toISOString().slice(0, 10);
  const item = snapshot.data[kind].find(entry => entry.id === itemId) || (isArticle ? { id: '', title: '', category: 'Berita', topic: '', summary: '', content: '', image: '', imageAlt: '', readMinutes: 3, publishedAt: today, published: false } : { id: '', title: '', label: '', startDate: today, endDate: today, venue: '', address: '', activities: [], registrationUrl: '', mapUrl: '', image: '', published: false });
  main.innerHTML = heading(`${itemId ? 'Edit' : 'Tambah'} ${isArticle ? 'Informasi' : 'Agenda'}`) + `<form data-editor><div class="form-grid">${field('title', 'Judul', item.title, 'text', true, true)}${field('id', 'ID / Slug', item.id, 'text', true)}${isArticle ? `<label>Kategori<select name="category">${['Berita', 'Pengumuman', 'Artikel'].map(category => `<option ${item.category === category ? 'selected' : ''}>${category}</option>`).join('')}</select></label>${field('topic', 'Topik', item.topic)}${field('publishedAt', 'Tanggal publikasi', item.publishedAt, 'date')}${field('readMinutes', 'Waktu baca (menit)', item.readMinutes, 'number', true)}${field('summary', 'Ringkasan', item.summary, 'textarea', false, true)}${field('image', 'Gambar utama', item.image, 'image', false, true)}${field('imageAlt', 'Deskripsi gambar', item.imageAlt, 'text', false, true)}${richMarkup()}` : `${field('label', 'Label kegiatan', item.label)}${field('startDate', 'Tanggal mulai', item.startDate, 'date', true)}${field('endDate', 'Tanggal selesai', item.endDate, 'date', true)}${field('venue', 'Tempat', item.venue)}${field('address', 'Alamat', item.address)}${field('activities', 'Rangkaian kegiatan (satu kegiatan per baris)', item.activities.join('\n'), 'textarea', false, true)}${field('registrationUrl', 'Tautan pendaftaran', item.registrationUrl, 'url', false, true)}${field('mapUrl', 'Tautan lokasi / peta', item.mapUrl, 'url', false, true)}${field('image', 'Poster kegiatan', item.image, 'image', false, true)}`}<label class="check-label span-all"><input type="checkbox" name="published" ${item.published ? 'checked' : ''}> Terbitkan di website</label></div>${footer()}</form>`;
  const readRich = isArticle ? initRich(item.content) : null; const form = main.querySelector('form'); bindForm(form, kind);
  form.elements.id.pattern = '[a-z0-9]+(?:-[a-z0-9]+)*'; form.elements.id.maxLength = 80;
  if (itemId) form.elements.id.readOnly = true;
  else form.elements.title.addEventListener('input', () => { if (!form.elements.id.dataset.manual) form.elements.id.value = form.elements.title.value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); });
  form.elements.id.addEventListener('input', () => { form.elements.id.dataset.manual = 'true'; });
  form.onsubmit = async event => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(form)); const next = { ...item, ...values, published: form.elements.published.checked };
    if (isArticle) { next.content = readRich(); next.readMinutes = Number(values.readMinutes); } else next.activities = values.activities.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    const data = structuredClone(snapshot.data);
    if (!itemId && data[kind].some(entry => entry.id === next.id)) { notify('ID sudah digunakan. Pilih ID lain.', true); return; }
    if (itemId) data[kind] = data[kind].map(entry => entry.id === itemId ? next : entry); else data[kind].unshift(next);
    if (await saveData(data)) await navigate(kind, true);
  };
}
async function renderMedia() {
  const items = await api('/api/admin/uploads'); if (activeView !== 'media') return;
  main.innerHTML = heading('Pustaka Gambar', `<button class="btn primary" id="upload-media">${icon('upload')} Unggah Gambar</button>`) + `<div class="media-grid">${items.map(item => `<article class="media-item"><img src="${esc(item.url)}" alt="${esc(item.name)}" loading="lazy"><div><p>${esc(item.name)}</p><div class="row-actions"><small>${Math.round(item.size / 1024)} KB</small><div><button class="icon-btn" data-copy="${esc(item.url)}" title="Salin URL gambar" aria-label="Salin URL gambar">${icon('copy')}</button> <button class="icon-btn danger" data-remove="${esc(item.name)}" title="Hapus gambar" aria-label="Hapus gambar">${icon('trash-2')}</button></div></div></div></article>`).join('')}</div>${items.length ? '' : '<p class="empty-state">Belum ada gambar diunggah.</p>'}`;
  document.querySelector('#upload-media').onclick = () => chooseImage(async () => { await renderMedia(); drawIcons(); });
  main.querySelectorAll('[data-copy]').forEach(button => button.onclick = async () => { try { await navigator.clipboard.writeText(button.dataset.copy); notify('URL gambar disalin.'); } catch { notify('Browser tidak mengizinkan penyalinan otomatis.', true); } });
  main.querySelectorAll('[data-remove]').forEach(button => button.onclick = async () => { if (!confirm('Hapus gambar ini secara permanen?')) return; try { await api(`/api/admin/uploads/${encodeURIComponent(button.dataset.remove)}`, { method: 'DELETE' }); await renderMedia(); drawIcons(); notify('Gambar dihapus.'); } catch (error) { notify(error.message, true); } });
}
function renderAccount() {
  main.innerHTML = heading('Akun & Keamanan') + `<form id="password-form" class="account-form"><h2>Ganti Kata Sandi</h2><label>Kata sandi saat ini<input type="password" name="currentPassword" autocomplete="current-password" required maxlength="128"></label><label>Kata sandi baru<input type="password" name="newPassword" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="Minimal 12 karakter"></label><label>Ulangi kata sandi baru<input type="password" name="confirmPassword" autocomplete="new-password" required minlength="12" maxlength="128"></label><div class="form-footer"><button type="submit" class="btn primary">${icon('shield-check')} Ganti Kata Sandi</button></div></form>`;
  document.querySelector('#password-form').onsubmit = async event => { event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form)); if (values.newPassword !== values.confirmPassword) { notify('Konfirmasi kata sandi tidak cocok.', true); return; } const submit = form.querySelector('button'); submit.disabled = true; try { auth = { ...auth, ...await api('/api/auth/password', { method: 'POST', body: JSON.stringify(values) }) }; form.reset(); notify('Kata sandi berhasil diganti. Sesi lain telah dikeluarkan.'); } catch (error) { notify(error.message, true); } finally { submit.disabled = false; } };
}
async function enterAdmin() {
  snapshot = await api('/api/admin/content'); authScreen.hidden = true; shell.hidden = false;
  document.querySelector('#admin-user').textContent = auth.username;
  if (snapshot.data.settings.logo) document.querySelector('#admin-logo').src = snapshot.data.settings.logo;
  await navigate(location.hash.slice(1) || 'dashboard', true);
}
document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => navigate(button.dataset.view));
document.querySelector('#logout').onclick = async () => { if (!allowedToLeave()) return; try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); setDirty(false); location.reload(); } catch (error) { notify(error.message, true); } };
document.querySelector('#auth-form').onsubmit = async event => {
  event.preventDefault(); const form = event.currentTarget; const submit = document.querySelector('#auth-submit'); submit.disabled = true; document.querySelector('#auth-message').textContent = '';
  try { const values = Object.fromEntries(new FormData(form)); const setup = auth.setupAvailable; auth = await api(setup ? '/api/auth/setup' : '/api/auth/login', { method: 'POST', headers: setup ? { 'X-Setup-Token': auth.setupToken } : {}, body: JSON.stringify(values) }); form.reset(); await enterAdmin(); } catch (error) { document.querySelector('#auth-message').textContent = error.message; } finally { submit.disabled = false; }
};
drawIcons();
try {
  auth = await api('/api/auth'); document.querySelector('#boot-status').hidden = true;
  if (auth.authenticated) await enterAdmin();
  else { authScreen.hidden = false; if (auth.setupAvailable) { document.querySelector('#auth-title').textContent = 'Buat Admin Pertama'; document.querySelector('#auth-submit').innerHTML = `Buat Admin ${icon('arrow-right')}`; document.querySelector('[name="password"]').autocomplete = 'new-password'; drawIcons(); } }
} catch (error) { document.querySelector('#boot-status').hidden = false; document.querySelector('#boot-status').textContent = 'Admin belum dapat terhubung ke server. Muat ulang halaman setelah server tersedia.'; }