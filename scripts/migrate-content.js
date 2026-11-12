import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { load } from 'cheerio';
import { contentFields, contentSchema } from '../cms-model.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'content.seed.json');
if (existsSync(output)) throw new Error('content.seed.json sudah ada; migrasi tidak akan menimpa konten.');
const html = load(readFileSync(path.join(root, 'index.html'), 'utf8'));
const source = readFileSync(path.join(root, 'app.js'), 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function object(name) {
  const declaration = ast.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations).find(node => node.id.name === name);
  const node = declaration.init.type === 'ConditionalExpression' ? declaration.init.alternate : declaration.init;
  return runInNewContext(`(${source.slice(node.start, node.end)})`, Object.create(null), { timeout: 1000 });
}
const settings = {};
for (const field of contentFields) {
  const element = html(field.selector).first();
  if (!element.length) throw new Error(`Elemen tidak ditemukan: ${field.key}`);
  if (field.attribute) settings[field.key] = element.attr(field.attribute) || '';
  else if (field.type === 'leading') settings[field.key] = element.contents().filter((index, node) => node.type === 'text').text().trim();
  else { const clone = element.clone(); clone.find('br').replaceWith('\n'); settings[field.key] = clone.text().trim(); }
}
const originalArticles = object('articles');
const articles = Object.entries(originalArticles).map(([id, article]) => {
  const card = html(`[data-article="${id}"]`);
  return { id, title: article.title, topic: article.category, category: 'Artikel', summary: card.find('p').text().trim(), content: article.content, image: card.find('img').attr('src'), imageAlt: card.find('img').attr('alt'), readMinutes: 3, publishedAt: '', published: true };
});
const profiles = Object.entries(object('profiles')).map(([id, profile]) => ({ id, title: profile.title, content: profile.content || `<p>${profile.description}</p>` }));
const events = [{ id: 'kongres-v-aspapi', title: html('#kongres-title').text(), label: html('.agenda-event-top .eyebrow').text(), startDate: '2026-11-20', endDate: '2026-11-22', venue: html('.event-venue strong').text(), address: html('.event-venue p').text(), activities: html('.event-activities li').toArray().map(element => html(element).text()), registrationUrl: '', mapUrl: html('.event-actions a[target="_blank"]').attr('href'), image: '', published: true }];
const uploads = path.join(root, 'storage', 'uploads');
mkdirSync(uploads, { recursive: true });
copyFileSync(path.join(root, 'Logo ASPAPI SULSEL.jpg'), path.join(uploads, 'logo-aspapi-sulsel.jpg'));
settings.logo = '/uploads/logo-aspapi-sulsel.jpg';
const data = contentSchema.parse({ settings, profiles, articles, events });
writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
console.log(`Migrasi: ${Object.keys(settings).length} pengaturan, ${profiles.length} profil, ${articles.length} artikel, ${events.length} agenda.`);