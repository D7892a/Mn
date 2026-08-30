/* ============================================================================
   بيتي POS — Bayti POS
   نظام إدارة محلات المواد والأجهزة المنزلية (ملف واحد، يعمل بدون إنترنت)
   ---------------------------------------------------------------------------
   الأجزاء:
     01 أدوات عامة      02 قاعدة البيانات    03 محرّك الحسابات
     04 إكسل            05 الطباعة          06 الواجهة
     07 الصلاحيات       08..13 الشاشات      99 الإقلاع
   ========================================================================== */
'use strict';

/* ============================================================================
   01) أدوات عامة
   ========================================================================== */
const U = {
  /* ---- DOM ---- */
  $(s, r){ return (r || document).querySelector(s); },
  $$(s, r){ return Array.from((r || document).querySelectorAll(s)); },
  esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
      { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
    ));
  },
  attr(v){ return U.esc(v).replace(/`/g, '&#96;'); },
  h(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; },
  on(el, ev, fn, opt){ if (el) el.addEventListener(ev, fn, opt); },
  debounce(fn, ms){ let t; return function(){ const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms || 220); }; },
  copy(txt){
    try{
      if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(txt); return true; }
    }catch(e){}
    try{
      const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true;
    }catch(e){ return false; }
  },

  /* ---- أرقام ---- */
  num(v, d){
    const n = Number(v); if (!isFinite(n)) return '0';
    const dec = d == null ? (Math.round(n) === n ? 0 : 2) : d;
    return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  },
  money(v, opt){
    opt = opt || {};
    const n = Math.round(Number(v) || 0);
    const s = U.num(Math.abs(n), 0);
    const sym = opt.sym === false ? '' : (S().currencySymbol || 'د.ع');
    const body = sym ? s + ' ' + sym : s;
    return n < 0 ? '(' + body + ')' : body;
  },
  shortMoney(v){
    const n = Number(v) || 0, a = Math.abs(n);
    if (a >= 1e9) return U.num(n / 1e9, 1) + ' مليار';
    if (a >= 1e6) return U.num(n / 1e6, 1) + ' مليون';
    if (a >= 1e3) return U.num(n / 1e3, 1) + ' ألف';
    return U.num(n, 0);
  },
  pct(v, d){ return U.num(Number(v) || 0, d == null ? 1 : d) + '%'; },
  round(n, step){
    n = Number(n) || 0; step = Number(step) || 0;
    if (!step) return Math.round(n);
    return Math.round(n / step) * step;
  },
  clamp(n, a, b){ return Math.min(b, Math.max(a, n)); },
  sum(arr, f){ return arr.reduce((t, x) => t + (f ? Number(f(x)) || 0 : Number(x) || 0), 0); },
  groupBy(arr, f){
    const m = {};
    arr.forEach((x) => { const k = f(x); (m[k] = m[k] || []).push(x); });
    return m;
  },
  uniq(arr){ return Array.from(new Set(arr)); },

  /* ---- تواريخ ---- */
  WD: ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],
  MO: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
  pad(n){ return String(n).padStart(2, '0'); },
  iso(d){
    d = d ? new Date(d) : new Date();
    if (isNaN(d)) d = new Date();
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  },
  parse(s){
    if (!s) return null;
    if (s instanceof Date) return isNaN(s) ? null : s;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(s); return isNaN(d) ? null : d;
  },
  today(){ return U.iso(new Date()); },
  now(){ return new Date().toISOString().slice(0, 16); },
  addDays(s, n){ const d = U.parse(s) || new Date(); d.setDate(d.getDate() + Number(n || 0)); return U.iso(d); },
  addMonths(s, n, day){
    const d = U.parse(s) || new Date();
    const target = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + Number(n || 0));
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day || target, last));
    return U.iso(d);
  },
  startOfMonth(s){ const d = U.parse(s) || new Date(); return U.iso(new Date(d.getFullYear(), d.getMonth(), 1)); },
  endOfMonth(s){ const d = U.parse(s) || new Date(); return U.iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); },
  monthKey(s){ const d = U.parse(s) || new Date(); return d.getFullYear() + '-' + U.pad(d.getMonth() + 1); },
  startOfWeek(s){ const d = U.parse(s) || new Date(); const w = (d.getDay() + 1) % 7; d.setDate(d.getDate() - w); return U.iso(d); },
  startOfYear(s){ const d = U.parse(s) || new Date(); return d.getFullYear() + '-01-01'; },
  dayNum(s){ return Math.floor((U.parse(s) - U.parse(U.today())) / 86400000); },
  diffDays(a, b){ return Math.round((U.parse(a) - U.parse(b)) / 86400000); },
  dateAr(s, opt){
    opt = opt || {};
    const d = U.parse(s); if (!d) return '—';
    let out = d.getDate() + ' ' + U.MO[d.getMonth()] + ' ' + d.getFullYear();
    if (opt.wd) out = U.WD[d.getDay()] + ' ' + out;
    if (opt.short) out = U.pad(d.getDate()) + '/' + U.pad(d.getMonth() + 1) + (opt.year === false ? '' : '/' + String(d.getFullYear()).slice(2));
    return out;
  },
  monthAr(key){
    const p = String(key).split('-');
    return (U.MO[+p[1] - 1] || '') + ' ' + (p[0] || '');
  },
  timeAr(s){
    const d = U.parse(s) || (typeof s === 'string' && s.length > 11 ? new Date(s.replace(' ', 'T')) : null);
    if (!d || isNaN(d)) return String(s || '').slice(11, 16) || '—';
    let h = d.getHours(); const ap = h < 12 ? 'ص' : 'م'; h = h % 12 || 12;
    return h + ':' + U.pad(d.getMinutes()) + ' ' + ap;
  },
  dateTimeAr(s){ const d = U.parse(s); return d ? U.dateAr(s) + ' — ' + U.timeAr(s) : '—'; },
  stampAr(s){
    const d = new Date(String(s).replace(' ', 'T'));
    if (isNaN(d)) return String(s || '');
    return U.dateAr(U.iso(d), { wd: false }) + ' — ' + U.timeAr(d);
  },
  greeting(){
    const h = new Date().getHours();
    if (h < 5) return 'طابت ليلتك';
    if (h < 12) return 'صباح الخير';
    if (h < 17) return 'نهارك سعيد';
    if (h < 21) return 'مساء الخير';
    return 'مساء الخير';
  },
  rel(s){
    const d = U.parse(s); if (!d) return '—';
    const n = U.diffDays(U.today(), U.iso(d));
    if (n === 0) return 'اليوم';
    if (n === 1) return 'غداً';
    if (n === -1) return 'أمس';
    if (n > 1) return 'بعد ' + n + ' يوم';
    return 'قبل ' + Math.abs(n) + ' يوم';
  },
  ageDays(s){ return U.diffDays(U.today(), U.iso(U.parse(s))); },

  /* ---- نص ---- */
  norm(s){
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[\u064B-\u0652\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/\s+/g, ' ').trim();
  },
  has(hay, needle){ return U.norm(hay).includes(U.norm(needle)); },
  initials(name){
    const p = String(name || '').trim().split(/\s+/);
    return ((p[0] || '?')[0] || '?') + ((p[1] || '')[0] || '');
  },
  words(n){
    /* تفقيط الأرقام إلى كلمات عربية (لغاية الملايين) */
    n = Math.abs(Math.round(Number(n) || 0));
    if (n === 0) return 'صفر';
    const ones = ['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة',
      'أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
    const tens = ['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
    const hund = ['','مئة','مئتان','ثلاثمئة','أربعمئة','خمسمئة','ستمئة','سبعمئة','ثمانمئة','تسعمئة'];
    const part = (x) => {
      const out = [];
      const h = Math.floor(x / 100), r = x % 100;
      if (h) out.push(hund[h]);
      if (r) out.push(r < 20 ? ones[r] : (r % 10 ? ones[r % 10] + ' و' + tens[Math.floor(r / 10)] : tens[Math.floor(r / 10)]));
      return out.join(' و');
    };
    const res = [];
    const mil = Math.floor(n / 1000000), th = Math.floor((n % 1000000) / 1000), rest = n % 1000;
    if (mil) res.push(mil === 1 ? 'مليون' : mil === 2 ? 'مليونان' : mil < 11 ? part(mil) + ' ملايين' : part(mil) + ' مليون');
    if (th) res.push(th === 1 ? 'ألف' : th === 2 ? 'ألفان' : th < 11 ? part(th) + ' آلاف' : part(th) + ' ألف');
    if (rest) res.push(part(rest));
    return res.join(' و');
  },
  plural(n, one, few, many){
    if (n === 1) return one;
    if (n === 2) return 'اث' + (few === 'نتان' ? 'نتان' : 'نان');
    if (n >= 3 && n <= 10) return n + ' ' + few;
    return n + ' ' + many;
  },

  /* ---- معرّفات وترقيم ---- */
  id(p){ return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
  seq(prefix, n, width){ return prefix + String(n).padStart(width || 4, '0'); },
  uid(){ return Math.random().toString(36).slice(2, 8).toUpperCase(); },

  /* ---- ملفات ---- */
  download(name, blob){
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
  },
  blob(data, type){ return new Blob([data], { type: type || 'application/octet-stream' }); },
  readText(file){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file, 'utf-8'); }); },
  readDataUrl(file){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); },
  pickFile(accept, cb){
    const i = document.createElement('input'); i.type = 'file'; if (accept) i.accept = accept;
    i.onchange = () => { if (i.files && i.files[0]) cb(i.files[0]); };
    i.click();
  },

  /* ---- باركود EAN-13 (حقيقي وقابل للمسح) ---- */
  EAN_L: ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'],
  EAN_PARITY: ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'],
  eanDigits(input){
    let d = String(input || '').replace(/\D/g, '');
    if (!d) d = '0';
    d = d.slice(0, 12).padStart(12, '0');
    let s = 0;
    for (let i = 0; i < 12; i++) s += (+d[i]) * (i % 2 === 0 ? 1 : 3);
    return d + String((10 - (s % 10)) % 10);
  },
  eanPattern(code13){
    const L = U.EAN_L;
    const R = L.map((p) => p.split('').map((c) => (c === '0' ? '1' : '0')).join(''));
    const G = R.map((p) => p.split('').reverse().join(''));
    const par = U.EAN_PARITY[+code13[0]];
    let bits = '101';
    for (let i = 0; i < 6; i++) bits += (par[i] === 'L' ? L : G)[+code13[i + 1]];
    bits += '01010';
    for (let i = 7; i < 13; i++) bits += R[+code13[i]];
    return bits + '101';
  },
  barcodeSvg(input, opt){
    opt = opt || {};
    const code = U.eanDigits(input);
    const bits = U.eanPattern(code);
    const w = opt.module || 2, hgt = opt.height || 52;
    const W = bits.length * w;
    let bars = '';
    for (let i = 0; i < bits.length; i++){
      if (bits[i] === '1') bars += '<rect x="' + (i * w) + '" y="0" width="' + w + '" height="' + hgt + '"/>';
    }
    const fs = opt.fontSize || 11;
    const text = opt.showText === false ? '' :
      '<text x="' + (W / 2) + '" y="' + (hgt + fs + 3) + '" text-anchor="middle" font-size="' + fs +
      '" font-family="ui-monospace,monospace" letter-spacing="1.5">' + code + '</text>';
    return '<svg class="ean" viewBox="0 0 ' + W + ' ' + (hgt + fs + 7) + '" width="' + (opt.width || W) +
      '" height="' + (hgt + fs + 7) + '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">' +
      '<g fill="#000">' + bars + '</g>' + text + '</svg>';
  },

  /* ---- متفرقات ---- */
  parseList(s){ return String(s || '').split(/[,،\n]+/).map((x) => x.trim()).filter(Boolean); },
  toCsv(rows){
    if (!rows.length) return '';
    const head = Object.keys(rows[0]);
    const q = (v) => {
      v = v == null ? '' : String(v);
      return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    return '\ufeff' + head.join(',') + '\n' + rows.map((r) => head.map((h) => q(r[h])).join(',')).join('\n');
  },
  parseCsv(text){
    const t = String(text || '').replace(/^\ufeff/, '');
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < t.length; i++){
      const c = t[i];
      if (q){
        if (c === '"'){ if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',' || c === ';'){ row.push(cur); cur = ''; }
      else if (c === '\n'){ row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* skip */ }
      else cur += c;
    }
    if (cur !== '' || row.length){ row.push(cur); rows.push(row); }
    const out = rows.filter((r) => r.some((c) => String(c).trim() !== ''));
    if (!out.length) return [];
    const head = out[0].map((x) => String(x).trim());
    return out.slice(1).map((r) => { const o = {}; head.forEach((h, i) => { o[h] = (r[i] || '').trim(); }); return o; });
  },
  /* تحويل جدول Excel (XLSX) إلى صفوف — يقرأ ورقة sharedStrings + sheet1 */
  parseXlsx(buf){ return XLSX.parse(buf); }
};
