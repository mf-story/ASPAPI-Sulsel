import { load } from 'cheerio';
import sharp from 'sharp';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const escapeXml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
export function socialMetadata(snapshot, requestUrl, origin) {
  const url = new URL(requestUrl, origin);
  const id = url.searchParams.get('artikel');
  const article = id === null ? null : snapshot.data.articles.find(item => item.id === id && item.published);
  const missing = id !== null && !article;
  const settings = snapshot.data.settings;
  const siteName = `${settings.brand || 'ASPAPI'} ${settings.region || 'Sulawesi Selatan'}`.trim();
  const title = missing ? 'Informasi tidak ditemukan' : article?.title || settings.pageTitle || siteName;
  const description = missing ? 'Informasi yang diminta tidak tersedia.' : article ? article.summary || load(article.content).text().slice(0, 220) : settings.description || settings.heroDescription || siteName;
  const canonical = new URL('/', origin);
  if (article) canonical.searchParams.set('artikel', article.id);
  const preview = new URL('/share/preview.jpg', origin);
  if (article) preview.searchParams.set('artikel', article.id);
  preview.searchParams.set('v', String(snapshot.revision));
  const externalImage = article?.image && /^https:\/\//i.test(article.image) ? article.image : null;
  return { article, missing, settings, siteName, title, description, revision: snapshot.revision, canonical: canonical.href, image: externalImage || preview.href, generatedImage: !externalImage, imageAlt: article?.imageAlt || siteName };
}
export function injectSocialMetadata(html, metadata) {
  const document = load(html);
  document('title').text(metadata.title);
  document('meta[name="description"]').remove();
  document('meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], meta[name="robots"]').remove();
  const head = document('head');
  const add = (attribute, name, content) => head.append(document('<meta>').attr(attribute, name).attr('content', content));
  add('name', 'description', metadata.description);
  head.append(document('<link>').attr('rel', 'canonical').attr('href', metadata.canonical));
  if (metadata.missing) { add('name', 'robots', 'noindex,nofollow'); return document.html(); }
  for (const [key, value] of Object.entries({ type: metadata.article ? 'article' : 'website', locale: 'id_ID', site_name: metadata.siteName, title: metadata.title, description: metadata.description, url: metadata.canonical, image: metadata.image, 'image:secure_url': metadata.image.startsWith('https:') ? metadata.image : '', 'image:alt': metadata.imageAlt })) if (value) add('property', `og:${key}`, value);
  if (metadata.generatedImage) for (const [key, value] of Object.entries({ type: 'image/jpeg', width: '1200', height: '630' })) add('property', `og:image:${key}`, value);
  for (const [key, value] of Object.entries({ card: 'summary_large_image', title: metadata.title, description: metadata.description, image: metadata.image, 'image:alt': metadata.imageAlt })) add('name', `twitter:${key}`, value);
  if (metadata.article?.publishedAt) add('property', 'article:published_time', `${metadata.article.publishedAt}T00:00:00+08:00`);
  return document.html();
}
function localImage(value, uploads) {
  if (!value?.startsWith('/uploads/')) return null;
  const name = value.slice('/uploads/'.length);
  if (!/^[a-zA-Z0-9-]+\.(?:webp|png|jpe?g)$/i.test(name)) return null;
  const filename = path.join(uploads, name);
  return existsSync(filename) ? filename : null;
}
export async function renderSocialImage(metadata, uploads, fallbackLogo) {
  const image = localImage(metadata.article?.image, uploads);
  if (image) return sharp(readFileSync(image), { limitInputPixels: 25000000 }).rotate().resize(1200, 630, { fit: 'contain', background: '#f4f6f5' }).jpeg({ quality: 88 }).toBuffer();
  const words = (metadata.settings.region || 'Sulawesi Selatan').split(/\s+/);
  const lines = [(metadata.settings.brand || 'ASPAPI').slice(0, 24)];
  let current = '';
  for (const word of words) { if (`${current} ${word}`.trim().length > 20 && current) { lines.push(current); current = ''; } current = `${current} ${word}`.trim(); }
  if (current) lines.push(current);
  const titleLines = lines.slice(0, 3).map((line, index) => `<text x="400" y="${230 + index * 72}" font-size="${index ? 46 : 64}" font-weight="700" fill="${index ? '#252727' : '#bc2333'}">${escapeXml(line)}</text>`).join('');
  const tagline = (metadata.settings.tagline || 'Competent - Competitive - Collaborative').slice(0, 76);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#ffffff"/><rect width="1200" height="16" fill="#bc2333"/><rect x="50" y="126" width="290" height="290" rx="8" fill="#f4f6f5"/><g font-family="DejaVu Sans, Arial, sans-serif">${titleLines}<text x="70" y="535" font-size="25" font-weight="700" fill="#bc2333">${escapeXml(tagline)}</text><text x="70" y="580" font-size="21" fill="#5a6663">Asosiasi Sarjana dan Praktisi Administrasi Perkantoran</text></g></svg>`;
  const layers = [];
  const logo = localImage(metadata.settings.logo, uploads) || (existsSync(fallbackLogo) ? fallbackLogo : null);
  if (logo) layers.push({ input: await sharp(readFileSync(logo)).resize(246, 246, { fit: 'contain', background: '#ffffff' }).png().toBuffer(), left: 72, top: 148 });
  return sharp(Buffer.from(svg)).composite(layers).jpeg({ quality: 88 }).toBuffer();
}