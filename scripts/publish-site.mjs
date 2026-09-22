// Обновить сайт на GitHub Pages: пересобрать веб-версию и отправить её в репозиторий сайта.
//
//   npm run site                 # сборка → ../mz-pages → git push
//   SITE_DIR=<путь> npm run site # если папка сайта лежит в другом месте
//
// В репозитории сайта лежит только сборка (исходники остаются здесь).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'game', 'web', 'dist');
const SITE = process.env.SITE_DIR ?? join(ROOT, '..', 'mz-pages');
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

if (!existsSync(join(SITE, '.git'))) {
  console.error(`Нет репозитория сайта в ${SITE}. Склонируйте его или укажите SITE_DIR.`);
  process.exit(1);
}

console.log('· собираем веб-версию (режим P2P, как на Pages)');
rmSync(DIST, { recursive: true, force: true });
run('npm', ['--prefix', join(ROOT, 'game', 'web'), 'run', 'build'], ROOT);

console.log(`· переносим сборку в ${SITE}`);
for (const name of readdirSync(SITE)) {
  if (name === '.git' || name === 'README.md' || name === '.nojekyll') continue;
  rmSync(join(SITE, name), { recursive: true, force: true });
}
cpSync(DIST, SITE, { recursive: true });
mkdirSync(SITE, { recursive: true });

console.log('· отправляем');
run('git', ['add', '-A'], SITE);
try {
  run('git', ['commit', '-m', `МОЩНЫЕ ЗЕМЛИ v${version}: обновление сборки`], SITE);
} catch {
  console.log('  нечего коммитить — сборка не изменилась');
}
run('git', ['push'], SITE);
console.log('Готово. Pages обновятся за минуту.');
