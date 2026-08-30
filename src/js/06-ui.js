/* ============================================================================
   06) الواجهة — نوافذ، تنبيهات، قوائم، رسوم بيانية، جداول
   ========================================================================== */
const UI = {
  _handlers: {},
  _hid: 0,
  on: (el, ev, fn, opt) => U.on(el, ev, fn, opt),
  $: (s, r) => U.$(s, r),
  $$: (s, r) => U.$$(s, r),

  /* ------------------------------------------------------------- Toasts */
  toast(title, kind, msg, ms){
    const wrap = document.getElementById('toasts');
    if (!wrap) return;
    const icons = { ok: '✅', err: '⛔', warn: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'info');
    el.innerHTML = '<div class="t-ic">' + (icons[kind] || 'ℹ️') + '</div><div class="t-b">' +
      '<div class="t-t">' + U.esc(title) + '</div>' + (msg ? '<div class="t-m">' + U.esc(msg) + '</div>' : '') + '</div>';
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, ms || (kind === 'err' ? 5200 : 3200));
  },

  /* -------------------------------------------------------------- Modal */
  modal(opt){
    const root = document.getElementById('modalRoot');
    const slot = document.getElementById('modalSlot');
    const acts = opt.actions || [];
    const hid = 'm' + (++UI._hid);
    UI._handlers[hid] = acts.map((a) => a.handler || null);
    const actsHtml = acts.map((a, i) =>
      '<button class="btn ' + (a.cls || '') + '" data-act="modal-act" data-h="' + hid + '" data-i="' + i + '">' + U.esc(a.label) + '</button>'
    ).join('');
    slot.innerHTML = '<div class="modal ' + (opt.wide ? 'wide' : '') + (opt.narrow ? ' narrow' : '') + '" data-hid="' + hid + '" role="dialog" aria-modal="true">' +
      '<div class="modal-h"><h3>' + (opt.icon ? opt.icon + ' ' : '') + U.esc(opt.title || '') + '</h3>' +
      (opt.sub ? '<span class="muted small">' + U.esc(opt.sub) + '</span>' : '') +
      '<button class="btn ghost icon sm x" data-act="close-modal">✕</button></div>' +
      '<div class="modal-b">' + (opt.body || '') + '</div>' +
      (acts.length ? '<div class="modal-f">' + (opt.prependActions || '') + '<div class="spacer"></div>' + actsHtml + '</div>' : '') +
      '</div>';
    root.classList.add('on');
    document.body.style.overflow = 'hidden';
    UI.modalCtx = { root, slot, hid, data: opt.data || {}, opt };
    const first = slot.querySelector('input,select,textarea,button.primary');
    if (first) setTimeout(() => { try { first.focus(); } catch(e){} }, 60);
    if (opt.onOpen) opt.onOpen(UI.modalCtx);
    return UI.modalCtx;
  },
  closeModal(){
    const root = document.getElementById('modalRoot');
    if (root){ root.classList.remove('on'); }
    document.getElementById('modalSlot').innerHTML = '';
    document.body.style.overflow = '';
    UI.modalCtx = null;
  },
  modalAct(h, i, ev){
    const list = UI._handlers[h] || [];
    const fn = list[i];
    if (fn) fn(UI.modalCtx, ev);
  },
  confirm(title, msg, opt){
    opt = opt || {};
    return new Promise((resolve) => {
      UI.modal({
        title, icon: opt.icon || '❓', narrow: true,
        body: '<p style="margin:0">' + U.esc(msg || '') + '</p>' + (opt.html || ''),
        actions: [
          { label: 'إلغاء', cls: 'ghost', handler: (ctx) => { UI.closeModal(); resolve(false); } },
          { label: opt.okLabel || 'تأكيد', cls: opt.danger ? 'danger' : 'primary', handler: (ctx) => { UI.closeModal(); resolve(true); } }
        ]
      });
    });
  },
  /* نموذج عام داخل نافذة: fields = [{key,label,type,options,required,value,hint,min,max,step,full}] */
  form(fields, data, opt){
    opt = opt || {};
    const html = fields.map((f) => {
      const v = data && data[f.key] != null ? data[f.key] : (f.value != null ? f.value : '');
      let input = '';
      const id = 'f_' + f.key;
      if (f.type === 'select'){
        input = '<select class="select" id="' + id + '" data-k="' + f.key + '">' +
          (f.placeholder ? '<option value="">' + U.esc(f.placeholder) + '</option>' : '') +
          (f.options || []).map((o) => '<option value="' + U.attr(o.value) + '" ' + (String(o.value) === String(v) ? 'selected' : '') + '>' + U.esc(o.label) + '</option>').join('') +
          '</select>';
      } else if (f.type === 'textarea'){
        input = '<textarea class="textarea" id="' + id + '" data-k="' + f.key + '" placeholder="' + U.attr(f.placeholder || '') + '">' + U.esc(v) + '</textarea>';
      } else if (f.type === 'check'){
        input = '<label class="check"><input type="checkbox" id="' + id + '" data-k="' + f.key + '" ' + (v ? 'checked' : '') + '><span>' + U.esc(f.checkLabel || 'نعم') + '</span></label>';
      } else if (f.type === 'switch'){
        input = '<label class="switch"><input type="checkbox" id="' + id + '" data-k="' + f.key + '" ' + (v ? 'checked' : '') + '><i></i></label>';
      } else if (f.type === 'image'){
        input = '<div class="row gap-8"><div class="thumb lg" id="imgPrev_' + f.key + '">' + (v ? '<img src="' + U.esc(v) + '">' : '🖼️') + '</div>' +
          '<input type="hidden" data-k="' + f.key + '" id="' + id + '" value="' + U.attr(v) + '">' +
          '<button type="button" class="btn sm" data-act="pick-image" data-k="' + f.key + '">📷 اختيار صورة</button>' +
          (v ? '<button type="button" class="btn sm ghost" data-act="clear-image" data-k="' + f.key + '">حذف</button>' : '') + '</div>';
      } else {
        const type = f.type === 'money' || f.type === 'number' ? 'number' : f.type || 'text';
        input = '<input class="input" id="' + id + '" data-k="' + f.key + '" type="' + type + '" value="' + U.attr(v) + '"' +
          (f.placeholder ? ' placeholder="' + U.attr(f.placeholder) + '"' : '') +
          (f.required ? ' required' : '') + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') +
          (f.step != null ? ' step="' + f.step + '"' : '') + (f.type === 'money' ? ' inputmode="numeric"' : '') + '>';
        if (f.type === 'money') input = '<div class="input-group">' + input + '<span class="addon">' + U.esc(S().locale.currencySymbol) + '</span></div>';
      }
      return '<div class="field ' + (f.full ? 'full' : '') + '">' +
        (f.type === 'switch' || f.type === 'check' ? '' : '<label for="' + id + '">' + U.esc(f.label) + (f.required ? ' <span class="req">*</span>' : '') + '</label>') +
        input + (f.hint ? '<span class="hint">' + U.esc(f.hint) + '</span>' : '') + '</div>';
    }).join('');
    return '<form class="form-grid" id="' + (opt.id || 'mForm') + '" onsubmit="return false">' + html + '</form>' + (opt.extra || '');
  },
  readForm(rootEl, fields){
    const out = {};
    (fields || []).forEach((f) => {
      const el = rootEl.querySelector('[data-k="' + f.key + '"]');
      if (!el) return;
      if (f.type === 'check' || f.type === 'switch') out[f.key] = !!el.checked;
      else if (f.type === 'money' || f.type === 'number') out[f.key] = el.value === '' ? 0 : Number(el.value) || 0;
      else out[f.key] = el.value;
    });
    return out;
  },
  validate(fields, data){
    const errs = [];
    fields.forEach((f) => {
      if (f.required && (data[f.key] === '' || data[f.key] == null)) errs.push(f.label);
    });
    return errs;
  },

  /* ---------------------------------------------------------- Dropdown */
  dropdown(anchor, items){
    const root = document.getElementById('ddRoot');
    const slot = document.getElementById('ddSlot');
    slot.innerHTML = items.map((it, i) => {
      if (it.sep) return '<div class="sep"></div>';
      if (it.title) return '<div class="dd-t">' + U.esc(it.title) + '</div>';
      return '<button data-act="dd-item" data-i="' + i + '" class="' + (it.danger ? 'danger' : '') + '">' +
        (it.icon ? '<span class="ic">' + it.icon + '</span>' : '') + '<span>' + U.esc(it.label) + '</span>' +
        (it.hint ? '<span class="muted tiny" style="margin-inline-start:auto">' + U.esc(it.hint) + '</span>' : '') + '</button>';
    }).join('');
    root.classList.add('on');
    root._items = items;
    const isDesktop = window.innerWidth > 640;
    if (isDesktop && anchor){
      const r = anchor.getBoundingClientRect();
      slot.style.position = 'fixed';
      slot.style.minWidth = Math.max(210, r.width) + 'px';
      const left = Math.min(window.innerWidth - 240, r.left);
      slot.style.left = Math.max(8, left) + 'px';
      const below = r.bottom + 6;
      if (below + 300 > window.innerHeight){ slot.style.top = 'auto'; slot.style.bottom = (window.innerHeight - r.top + 6) + 'px'; }
      else { slot.style.top = below + 'px'; slot.style.bottom = 'auto'; }
    } else {
      slot.style.position = ''; slot.style.left = ''; slot.style.top = ''; slot.style.bottom = ''; slot.style.minWidth = '';
    }
  },
  closeDropdown(){
    const root = document.getElementById('ddRoot');
    if (root){ root.classList.remove('on'); root._items = null; }
  },

  /* -------------------------------------------------------------- تخطيط */
  page(opt){
    return '<div class="view-in">' +
      '<div class="page-head">' +
        '<div><h1>' + (opt.icon ? opt.icon + ' ' : '') + U.esc(opt.title) + '</h1>' +
        (opt.sub ? '<div class="sub">' + opt.sub + '</div>' : '') + '</div>' +
        (opt.actions ? '<div class="page-actions">' + opt.actions + '</div>' : '') +
      '</div>' + (opt.body || '') + '</div>';
  },
  card(title, body, opt){
    opt = opt || {};
    return '<section class="card ' + (opt.cls || '') + (opt.span ? ' span-' + opt.span : '') + '">' +
      (title ? '<div class="card-h"><h3>' + (opt.icon ? opt.icon + ' ' : '') + U.esc(title) + '</h3>' +
        (opt.sub ? '<span class="sub">' + U.esc(opt.sub) + '</span>' : '') +
        (opt.acts ? '<div class="acts">' + opt.acts + '</div>' : '') + '</div>' : '') +
      body + '</section>';
  },
  empty(icon, title, sub, actionHtml){
    return '<div class="empty"><div class="e-ic">' + icon + '</div><div class="e-t">' + U.esc(title) + '</div>' +
      (sub ? '<div class="e-s">' + sub + '</div>' : '') + (actionHtml || '') + '</div>';
  },
  skeleton(n){
    let h = '';
    for (let i = 0; i < (n || 4); i++) h += '<div class="sk" style="height:38px;margin-bottom:8px"></div>';
    return h;
  },

  /* ------------------------------------------------------------- الجداول */
  table(opt){
    const cols = opt.columns || [];
    const rows = opt.rows || [];
    if (!rows.length) return opt.empty || UI.empty('🗂️', 'لا توجد بيانات', 'ابدأ بإضافة أول عنصر أو غيّر الفلاتر.');
    const head = '<tr>' + cols.map((c) => '<th class="' + (c.cls || '') + '"' + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + U.esc(c.title) + '</th>').join('') + '</tr>';
    const body = rows.map((r, ri) => {
      const attrs = opt.rowAttrs ? opt.rowAttrs(r, ri) : '';
      return '<tr ' + (attrs || '') + '>' + cols.map((c) => {
        const val = c.render ? c.render(r, ri) : U.esc(r[c.key]);
        return '<td class="' + (c.cls || '') + '">' + val + '</td>';
      }).join('') + '</tr>';
    }).join('');
    const foot = opt.footer ? '<tfoot><tr>' + cols.map((c, i) => '<td class="' + (c.cls || '') + '">' + (opt.footer[i] != null ? opt.footer[i] : '') + '</td>').join('') + '</tr></tfoot>' : '';
    return '<div class="table-wrap' + (opt.wrapCls ? ' ' + opt.wrapCls : '') + '"' + (opt.maxHeight ? ' style="max-height:' + opt.maxHeight + '"' : '') + '>' +
      '<table class="tbl' + (opt.compact ? ' compact' : '') + '"><thead>' + head + '</thead><tbody>' + body + '</tbody>' + foot + '</table></div>';
  },

  /* -------------------------------------------------------- الرسوم */
  barChart(data, opt){
    opt = opt || {};
    const W = opt.width || 720, H = opt.height || 220, pad = { t: 16, r: 8, b: 26, l: 8 };
    const max = Math.max(1, ...data.map((d) => Math.max(d.value || 0, d.value2 || 0)));
    const n = data.length || 1;
    const slot = (W - pad.l - pad.r) / n;
    const bw = Math.min(opt.barWidth || 26, slot * (opt.dual ? 0.34 : 0.6));
    const h = H - pad.t - pad.b;
    let g = '';
    for (let i = 0; i <= 3; i++){
      const y = pad.t + (h / 3) * i;
      g += '<line class="grid-l" x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '"/>';
    }
    let bars = '';
    data.forEach((d, i) => {
      const x = pad.l + slot * i + slot / 2;
      const v = Number(d.value) || 0;
      const bh = (v / max) * h;
      bars += '<rect class="bar" x="' + (x - (opt.dual ? bw + 1 : bw / 2)) + '" y="' + (pad.t + h - bh) + '" width="' + bw + '" height="' + Math.max(1, bh) + '" rx="4"><title>' +
        U.esc(d.label) + ': ' + U.num(v) + '</title></rect>';
      if (opt.dual){
        const v2 = Number(d.value2) || 0;
        const bh2 = (v2 / max) * h;
        bars += '<rect class="bar bar2" x="' + (x + 1) + '" y="' + (pad.t + h - bh2) + '" width="' + bw + '" height="' + Math.max(1, bh2) + '" rx="4"><title>' +
          U.esc(opt.label2 || '') + ' ' + U.esc(d.label) + ': ' + U.num(v2) + '</title></rect>';
      }
      bars += '<text class="lbl" x="' + x + '" y="' + (H - 8) + '" text-anchor="middle">' + U.esc(d.label) + '</text>';
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="height:' + H + 'px">' + g + bars + '</svg>';
  },
  lineChart(data, opt){
    opt = opt || {};
    const W = opt.width || 720, H = opt.height || 220, pad = { t: 16, r: 10, b: 26, l: 10 };
    const vals = data.map((d) => Number(d.value) || 0);
    const max = Math.max(1, ...vals);
    const n = Math.max(1, data.length - 1);
    const h = H - pad.t - pad.b;
    const stepX = (W - pad.l - pad.r) / n;
    const pts = data.map((d, i) => [pad.l + stepX * i, pad.t + h - ((Number(d.value) || 0) / max) * h]);
    let grid = '';
    for (let i = 0; i <= 3; i++){ const y = pad.t + (h / 3) * i; grid += '<line class="grid-l" x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '"/>'; }
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (pad.t + h) + ' L' + pts[0][0].toFixed(1) + ' ' + (pad.t + h) + ' Z';
    const dots = pts.map((p, i) => '<circle class="pt" cx="' + p[0] + '" cy="' + p[1] + '" r="3"><title>' + U.esc(data[i].label) + ': ' + U.num(data[i].value) + '</title></circle>').join('');
    const every = Math.ceil(data.length / 8);
    const labels = data.map((d, i) => (i % every === 0 ? '<text class="lbl" x="' + pts[i][0] + '" y="' + (H - 8) + '" text-anchor="middle">' + U.esc(d.label) + '</text>' : '')).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" style="height:' + H + 'px"><defs><linearGradient id="gAr" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>' +
      grid + '<path class="ar" d="' + area + '"/><path class="ln" d="' + line + '"/>' + dots + labels + '</svg>';
  },
  donut(items, opt){
    opt = opt || {};
    const total = U.sum(items, (i) => i.value) || 1;
    const R = 54, C = 2 * Math.PI * R;
    let off = 0;
    const rings = items.map((it) => {
      const frac = (Number(it.value) || 0) / total;
      const seg = '<circle r="' + R + '" cx="70" cy="70" fill="none" stroke="' + it.color + '" stroke-width="22" stroke-dasharray="' +
        (frac * C).toFixed(2) + ' ' + (C - frac * C).toFixed(2) + '" stroke-dashoffset="' + (-off * C).toFixed(2) + '" transform="rotate(-90 70 70)"><title>' +
        U.esc(it.name) + ': ' + U.num(it.value) + ' (' + U.pct(frac * 100, 0) + ')</title></circle>';
      off += frac;
      return seg;
    }).join('');
    const legend = '<div class="legend">' + items.map((it) =>
      '<div class="lg-i"><span class="lg-c" style="background:' + it.color + '"></span><span>' + U.esc(it.name) + '</span>' +
      '<span class="lg-v">' + U.shortMoney(it.value) + '</span></div>').join('') + '</div>';
    return '<div class="donut"><svg width="140" height="140" viewBox="0 0 140 140">' + rings +
      '<text x="70" y="66" text-anchor="middle" class="val" style="font-size:13px;font-weight:800">' + U.shortMoney(total) + '</text>' +
      '<text x="70" y="84" text-anchor="middle" class="lbl" style="font-size:9px">الإجمالي</text></svg>' + legend + '</div>';
  },
  sparkline(values, color){
    const W = 120, H = 34;
    const max = Math.max(1, ...values), n = Math.max(1, values.length - 1);
    const pts = values.map((v, i) => [(i / n) * W, H - (v / max) * (H - 4) - 2]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><path d="' + d + '" fill="none" stroke="' + (color || 'var(--accent)') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  },

  /* ------------------------------------------------------ أرقام متحركة */
  animateNumbers(root){
    U.$$('[data-count]', root || document).forEach((el) => {
      const to = Number(el.getAttribute('data-count')) || 0;
      const dec = Number(el.getAttribute('data-dec')) || 0;
      const prefix = el.getAttribute('data-prefix') || '';
      const suffix = el.getAttribute('data-suffix') || '';
      const dur = 700; const t0 = performance.now();
      const tick = (t) => {
        const p = U.clamp((t - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + U.num(to * eased, dec) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  },

  /* --------------------------------------------------------- مؤشرات */
  statusBadge(status){
    const map = {
      paid: ['ok', 'مسدّد'], overdue: ['danger', 'متأخر'], due: ['warn', 'مستحق اليوم'], upcoming: ['info', 'قادم'],
      partial: ['warn', 'جزئي'], active: ['ok', 'نشط'], closed: ['accent', 'مغلق'], suspended: ['warn', 'موقوف'],
      void: ['danger', 'ملغاة'], returned: ['warn', 'مرتجعة'], draft: ['info', 'مسودة'], sent: ['info', 'مُرسل'],
      accepted: ['ok', 'مقبول'], rejected: ['danger', 'مرفوض'], new: ['info', 'جديد'], scheduled: ['info', 'مجدول'],
      onway: ['warn', 'بالطريق'], done: ['ok', 'منجز'], delivered: ['ok', 'تم التسليم'], cancelled: ['danger', 'ملغى'],
      received: ['info', 'استلام'], inspecting: ['warn', 'فحص'], repairing: ['warn', 'إصلاح'], ready: ['ok', 'جاهز'],
      waiting: ['info', 'بانتظار قطعة'], vip: ['violet', 'VIP'], normal: ['info', 'عادي'], expired: ['danger', 'منتهي'],
      soon: ['warn', 'قريب الانتهاء'], pending: ['warn', 'قيد الانتظار'], paid_full: ['ok', 'مسدد بالكامل']
    };
    const m = map[status] || ['', status || '—'];
    return '<span class="badge ' + m[0] + '"><span class="d"></span>' + U.esc(m[1]) + '</span>';
  },
  moneyCell(v, cls){
    const n = Number(v) || 0;
    const c = cls || (n < 0 ? 'danger' : n > 0 ? '' : 'dim');
    return '<span class="num" ' + (c ? 'style="color:var(--' + c + ')";font-weight:700' : '') + '>' + U.money(n) + '</span>';
  },
  progress(pct, cls){
    return '<div class="progress ' + (cls || '') + '"><i style="width:' + U.clamp(pct, 0, 100).toFixed(1) + '%"></i></div>';
  }
};
