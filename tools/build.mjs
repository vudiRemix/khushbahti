// Собирает игру в один HTML-файл: dist/khaos-doska.html
// Запуск: node tools/build.mjs
// С флагом --fragment (и путём вывода) собирает вариант без <html>/<head>/<body> —
// для площадок, которые сами оборачивают страницу.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = args.find((a) => !a.startsWith('--')) || join(root, 'dist', 'khaos-doska.html');

let html = readFileSync(join(root, 'index.html'), 'utf8');
const scripts = [];
html = html.replace(/<script src="([^"]+)"><\/script>\n?/g, (_, src) => {
  scripts.push(`// ---- ${src} ----\n` + readFileSync(join(root, src), 'utf8'));
  return '';
});
const bundle = `<script>\n${scripts.join('\n')}\n</script>\n`;
// Замена через функцию: иначе последовательности вроде `$$` в коде игры испортятся.
html = html.replace('</body>', () => bundle + '</body>');

if (fragment) {
  html = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<\/?html[^>]*>\s*/gi, '')
    .replace(/<\/?head>\s*/gi, '')
    .replace(/<\/?body>\s*/gi, '')
    .replace(/<meta charset="utf-8">\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '');
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Готово: ${out} (${(html.length / 1024).toFixed(1)} КБ, скриптов: ${scripts.length})`);
