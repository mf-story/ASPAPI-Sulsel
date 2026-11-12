import { contentFields } from './cms-model.js';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
function updateText(element, value, type) {
  if (type === 'leading') {
    const nodes = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
    if (nodes.map(node => node.textContent).join('').trim() === value) return;
    nodes.forEach(node => node.remove());
    element.prepend(document.createTextNode(`${value} `));
    return;
  }
  const clone = element.cloneNode(true);
  clone.querySelectorAll('br').forEach(line => line.replaceWith('\n'));
  if (clone.textContent.trim() === value) return;
  element.textContent = value;
  if (type === 'multiline') element.style.whiteSpace = 'pre-line';
}
function renderArticles(items) {
  const grid = document.querySelector('#informasi .article-grid');
  grid.innerHTML = items.map(item => `<article class="article" data-category="${escapeHtml(item.category)}"><a class="article-open" href="?artikel=${encodeURIComponent(item.id)}" data-article="${escapeHtml(item.id)}"><div class="article-image">${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy">` : ''}<span><i data-lucide="arrow-up-right"></i></span></div><div class="article-meta"><span>${escapeHtml(item.category.toUpperCase())}</span><span>${item.readMinutes} menit baca</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></a></article>`).join('');
  const empty = document.querySelector('#information-empty');
  empty.hidden = items.length > 0;
  empty.textContent = 'Belum ada informasi yang dipublikasikan.';
}
function formatDate(value) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
function renderEvents(items, settings) {
  const old = document.querySelector('.agenda-event, .agenda-empty');
  const wrapper = document.createElement('div');
  wrapper.className = 'agenda-events';
  wrapper.innerHTML = items.length ? items.map(item => `<article class="agenda-event" aria-labelledby="event-${escapeHtml(item.id)}"><div class="agenda-event-top"><span class="eyebrow">${escapeHtml(item.label)}</span>${settings.logo ? `<img src="${escapeHtml(settings.logo)}" alt="Logo ${escapeHtml(settings.brand)}" width="48" height="48" loading="lazy">` : ''}</div>${item.image ? `<img class="event-poster" src="${escapeHtml(item.image)}" alt="Poster ${escapeHtml(item.title)}" loading="lazy">` : ''}<h3 id="event-${escapeHtml(item.id)}">${escapeHtml(item.title)}</h3><div class="event-date"><i data-lucide="calendar-days" aria-hidden="true"></i><span><time datetime="${item.startDate}">${formatDate(item.startDate)}</time>${item.startDate !== item.endDate ? ` &ndash; <time datetime="${item.endDate}">${formatDate(item.endDate)}</time>` : ''}</span></div><div class="event-venue"><i data-lucide="map-pin" aria-hidden="true"></i><div><strong>${escapeHtml(item.venue)}</strong><p>${escapeHtml(item.address)}</p></div></div>${item.activities.length ? `<h4>Rangkaian Kegiatan</h4><ol class="event-activities">${item.activities.map(activity => `<li>${escapeHtml(activity)}</li>`).join('')}</ol>` : ''}<div class="event-actions">${item.registrationUrl ? `<a class="button button-red" href="${escapeHtml(item.registrationUrl)}" target="_blank" rel="noopener noreferrer">Daftar <i data-lucide="arrow-up-right"></i></a>` : '<button class="button button-red" disabled title="Tautan pendaftaran belum tersedia">Daftar <i data-lucide="arrow-up-right"></i></button>'}<a class="button button-red" href="/api/events/${encodeURIComponent(item.id)}/calendar" download><i data-lucide="calendar-days"></i> Simpan ke Kalender</a>${item.mapUrl ? `<a class="text-link" href="${escapeHtml(item.mapUrl)}" target="_blank" rel="noopener noreferrer">Lihat Lokasi <i data-lucide="arrow-up-right"></i></a>` : ''}</div></article>`).join('') : '<div class="agenda-empty"><h3>Belum ada agenda dipublikasikan</h3></div>';
  old.replaceWith(wrapper);
}
export async function hydrateWebsite() {
  try {
    const response = await fetch('/api/content', { cache: 'no-store' });
    if (!response.ok) return null;
    const { data } = await response.json();
    if (!data?.settings || !Array.isArray(data.articles)) return null;
    for (const field of contentFields) {
      const value = data.settings[field.key];
      if (typeof value !== 'string') continue;
      document.querySelectorAll(field.selector).forEach(element => {
        if (field.attribute) {
          if (field.type === 'image') element.hidden = !value;
          if (value || field.type !== 'image') element.setAttribute(field.attribute, value);
        } else updateText(element, value, field.type);
      });
    }
    if (data.settings.logo) { const favicon = document.querySelector('link[rel="icon"]'); favicon.href = data.settings.logo; favicon.removeAttribute('type'); }
    renderArticles(data.articles);
    renderEvents(data.events, data.settings);
    data.profiles.forEach(profile => {
      const button = [...document.querySelectorAll('[data-profile]')].find(item => item.dataset.profile === profile.id);
      if (button) button.textContent = profile.title;
    });
    return data;
  } catch (error) {
    console.warn('Data CMS belum tersedia:', error.message);
    return null;
  }
}