/* بناء index.html (ملف واحد يعمل بنقرة مزدوجة) من أجزاء src/ */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');

const parts = [
  '00-head.html',
  ...readdirSync(join(src, 'css')).filter((f) => f.endsWith('.css')).sort().map((f) => 'css/' + f),
  '10-mid.html',
  ...readdirSync(join(src, 'js')).filter((f) => f.endsWith('.js')).sort().map((f) => 'js/' + f),
  '99-tail.html'
];

let out = '';
const sizes = [];
for (const p of parts){
  const txt = readFileSync(join(src, p), 'utf8');
  sizes.push([p, txt.length]);
  if (!p.endsWith('.html')) out += '\n/* ==================== ' + p + ' ==================== */\n';
  out += txt.replace(/\s+$/, '') + '\n';
}

writeFileSync(join(root, 'index.html'), out, 'utf8');

/* فحص سلامة صياغة الجافاسكربت المجمّعة */
import { execFileSync } from 'node:child_process';
import { writeFileSync as wf, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const s0 = out.lastIndexOf('<script>');
const s1 = out.lastIndexOf('</script>');
const jsBody = out.slice(s0 + 8, s1);
const tmp = join(mkdtempSync(join(tmpdir(), 'bayti-')), 'check.js');
wf(tmp, jsBody, 'utf8');
try{
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
}catch(e){
  console.error('\n❌ خطأ صياغة في الجافاسكربت:\n' + String(e.stderr || e.message));
  process.exit(1);
}
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('✅ تم بناء index.html');
sizes.forEach(([p, n]) => console.log('   ' + p.padEnd(26) + kb(n)));
console.log('   ' + '-'.repeat(32));
console.log('   ' + 'index.html'.padEnd(26) + kb(out.length) + '  (' + out.split('\n').length + ' سطر)');
