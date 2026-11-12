import { z } from 'zod';

const field = (key, label, selector, type = 'text', attribute = '') => ({ key, label, selector, type, attribute });
export const contentGroups = [
  { id: 'identity', title: 'Identitas & Kontak', fields: [
    field('brand', 'Nama singkat', '.brand-name', 'leading'),
    field('region', 'Nama daerah', '.brand-name small'),
    field('logo', 'Logo', '.brand-logo', 'image', 'src'),
    field('tagline', 'Slogan bagian atas', '.topline-motto'),
    field('location', 'Lokasi bagian atas', '.topline .container > span:last-child', 'leading'),
    field('pageTitle', 'Judul tab beranda', 'title'),
    field('description', 'Deskripsi mesin pencari', 'meta[name="description"]', 'textarea', 'content'),
    field('registrationUrl', 'Tautan keanggotaan', '.header-join, .membership-action a, .field:last-child, .footer-main .text-link', 'url', 'href'),
    field('footerIdentity', 'Nama organisasi pada footer', '.footer-about > p', 'multiline'),
    field('footerLocation', 'Alamat sekretariat', '.footer-main > div:last-child > p:first-of-type', 'multiline'),
    field('footerContact', 'Informasi kontak', '.contact-note', 'multiline'),
    field('footerContactHeading', 'Judul kontak', '.footer-main > div:last-child h3'),
    field('footerRegistration', 'Label tautan registrasi footer', '.footer-main .text-link', 'leading')
  ] },
  { id: 'navigation', title: 'Menu Navigasi', fields: [
    field('navHome', 'Beranda', '#main-nav > a[href="#beranda"]'),
    field('navProfile', 'Profil', '.profile-toggle', 'leading'),
    field('navFields', 'Bidang kegiatan', '#main-nav > a[href="#bidang"], .footer-main a[href="#bidang"]'),
    field('navAgenda', 'Agenda', '#main-nav > a[href="#agenda"], .footer-main a[href="#agenda"]'),
    field('navInformation', 'Informasi', '#main-nav > a[href="#informasi"], .footer-main a[href="#informasi"]'),
    field('navJoin', 'Tombol keanggotaan', '.header-join', 'leading'),
    field('footerExplore', 'Judul tautan footer', '.footer-main > div:nth-child(2) h3'),
    field('footerAbout', 'Tautan tentang kami', '.footer-main a[href="#tentang"]')
  ] },
  { id: 'hero', title: 'Bagian Utama Beranda', fields: [
    field('heroLabel', 'Label atas', '.hero .eyebrow', 'leading'),
    field('heroTitle', 'Judul utama', '#hero-heading', 'leading'),
    field('heroRegion', 'Judul daerah', '.hero-region'),
    field('heroDescription', 'Deskripsi', '.hero-description', 'textarea'),
    field('heroImage', 'Foto latar', '.hero-photo', 'image', 'src'),
    field('heroImageAlt', 'Deskripsi foto untuk aksesibilitas', '.hero-photo', 'text', 'alt'),
    field('heroCaption', 'Keterangan foto', '.photo-note'),
    field('heroButton', 'Label tombol', '.hero-actions a', 'leading'),
    field('heroButtonUrl', 'Tujuan tombol', '.hero-actions a', 'url', 'href'),
    field('communityLine', 'Teks pita komunitas', '.identity-inner > p', 'multiline'),
    ...['Akademisi', 'Praktisi', 'Pendidik', 'Mahasiswa'].map((label, index) => field(`audience${index + 1}`, label, `.identity-inner > div > span:nth-child(${index + 1})`, 'leading'))
  ] },
  { id: 'about', title: 'Tentang Kami', fields: [
    field('aboutLabel', 'Label bagian', '.about-content .eyebrow'),
    field('aboutTitle', 'Judul bagian', '#about-heading'),
    ...[1, 2, 3].map(index => field(`aboutParagraph${index}`, `Paragraf ${index}`, `.about-content > p:nth-of-type(${index})`, 'textarea')),
    ...[1, 2, 3].flatMap(index => [field(`valueTitle${index}`, `Nilai ${index}: judul`, `.about-pillar:nth-child(${index}) h3`), field(`valueText${index}`, `Nilai ${index}: deskripsi`, `.about-pillar:nth-child(${index}) p`, 'textarea')])
  ] },
  { id: 'fields', title: 'Bidang Kegiatan', fields: [
    field('fieldsLabel', 'Label bagian', '#bidang .eyebrow', 'leading'),
    field('fieldsTitle', 'Judul bagian', '#fields-heading'),
    field('fieldsDescription', 'Deskripsi', '#bidang .section-head > p', 'multiline'),
    ...[1, 2, 3].flatMap(index => [field(`fieldTitle${index}`, `Bidang ${index}: judul`, `.field:nth-child(${index}) h3`), field(`fieldText${index}`, `Bidang ${index}: deskripsi`, `.field:nth-child(${index}) p`, 'textarea'), field(`fieldLink${index}`, `Bidang ${index}: label tautan`, `.field:nth-child(${index}) .field-link`, 'leading')])
  ] },
  { id: 'sections', title: 'Agenda & Informasi', fields: [
    field('agendaLabel', 'Label agenda', '.agenda-intro .eyebrow', 'leading'),
    field('agendaTitle', 'Judul agenda', '#agenda-heading', 'multiline'),
    field('agendaDescription', 'Deskripsi agenda', '.agenda-intro > p', 'multiline'),
    field('informationLabel', 'Label informasi', '#informasi .eyebrow', 'leading'),
    field('informationTitle', 'Judul informasi', '#information-heading'),
    field('informationSubtitle', 'Keterangan informasi', '.editorial-label', 'leading')
  ] },
  { id: 'membership', title: 'Ajakan Keanggotaan', fields: [
    field('membershipLabel', 'Label bagian', '.membership .eyebrow', 'leading'),
    field('membershipTitle', 'Judul', '.membership h2', 'multiline'),
    field('membershipDescription', 'Deskripsi', '.membership p', 'textarea'),
    field('membershipButton', 'Label tombol', '.membership-action a', 'leading'),
    field('membershipAudience', 'Keterangan anggota', '.membership-action > span')
  ] }
];
export const contentFields = contentGroups.flatMap(group => group.fields);
export const profileIds = ['visi-misi', 'sejarah', 'inisiator', 'kongres', 'penasihat', 'pakar', 'pengurus'];
const text = z.string().max(1000);
const resourceUrl = z.string().max(2048).refine(value => {
  if (!value) return true;
  if (/[\u0000-\u001f\\]/.test(value)) return false;
  if (/^\/(?!\/)/.test(value) || /^#[a-z0-9-]+$/i.test(value)) return true;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}, 'Gunakan URL http/https, jalur /, atau tautan #bagian.');
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Tanggal tidak valid.');
const html = z.string().max(150000);
export const contentSchema = z.object({
  settings: z.object(Object.fromEntries(contentFields.map(item => [item.key, ['url', 'image'].includes(item.type) ? resourceUrl : z.string().max(10000)]))),
  profiles: z.array(z.object({ id: z.enum(profileIds), title: text.min(1), content: html })).length(7).refine(items => new Set(items.map(item => item.id)).size === 7, 'Profil tidak boleh duplikat.'),
  articles: z.array(z.object({ id, title: text.min(1), category: z.enum(['Berita', 'Pengumuman', 'Artikel']), topic: text, summary: z.string().max(5000), content: html, image: resourceUrl, imageAlt: text, readMinutes: z.number().int().min(1).max(180), publishedAt: z.union([date, z.literal('')]), published: z.boolean() })).max(500),
  events: z.array(z.object({ id, title: text.min(1), label: text, startDate: date, endDate: date, venue: text, address: text, activities: z.array(text.min(1)).max(30), registrationUrl: resourceUrl, mapUrl: resourceUrl, image: resourceUrl, published: z.boolean() }).refine(item => item.endDate >= item.startDate, 'Tanggal selesai mendahului tanggal mulai.')).max(200)
}).superRefine((data, context) => {
  for (const key of ['articles', 'events']) if (new Set(data[key].map(item => item.id)).size !== data[key].length) context.addIssue({ code: 'custom', path: [key], message: 'ID tidak boleh duplikat.' });
});
export function emptyContent() {
  return { settings: Object.fromEntries(contentFields.map(item => [item.key, ''])), profiles: profileIds.map(profileId => ({ id: profileId, title: profileId, content: '' })), articles: [], events: [] };
}