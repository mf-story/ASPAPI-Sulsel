import { existsSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function createBackup(directory, backupRoot) {
	if (!existsSync(path.join(directory, 'aspapi.sqlite'))) throw new Error('Database belum tersedia. Jalankan server terlebih dahulu.');
	const destination = path.join(backupRoot, new Date().toISOString().replace(/[:.]/g, '-'));
	mkdirSync(destination, { recursive: true, mode: 0o700 });
	const db = new DatabaseSync(path.join(directory, 'aspapi.sqlite'));
	try { db.prepare('VACUUM INTO ?').run(path.join(destination, 'aspapi.sqlite')); } finally { db.close(); }
	if (existsSync(path.join(directory, 'uploads'))) cpSync(path.join(directory, 'uploads'), path.join(destination, 'uploads'), { recursive: true });
	writeFileSync(path.join(destination, 'backup.json'), JSON.stringify({ createdAt: new Date().toISOString(), format: 1 }, null, 2), { mode: 0o600 });
	return destination;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
	const directory = process.env.ASPAPI_DATA_DIR ? path.resolve(process.env.ASPAPI_DATA_DIR) : path.join(root, 'storage');
	console.log(`Cadangan database dan media: ${createBackup(directory, path.join(root, 'backups'))}`);
}