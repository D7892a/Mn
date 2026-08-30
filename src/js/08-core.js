/* ============================================================================
   08) إطار عام للشاشات (CRUD + فلاتر) + لوحة التحكم والتنبيهات والمهام
   ========================================================================== */
const Views = {};
const CRUD = { defs: {} };

/* ---------------- الفلاتر المشتركة ---------------- */
const F = {
  get(route){
    if (!App.filters[route]) App.filters[route] = { q: '', from: U.startOfMonth(U.today()), to: U.today(), chip: '', page: 1, sort: '' };
    return App.filters[route];
  },
  inRange(date, route){
    const f = F.get(route);
    if (f.from && date < f.from) return false;
    if (f.to && date > f.to) return false;
    return true;
  },
  match(row, route, keys){
    const q = F.get(route).q.trim();
    if (!q) return true;
    return keys.some((k) => U.has(typeof k === 'function' ? k(row) : row[k], q));
  },
  bar(route, opt){
    opt = opt || {};
    const f = F.get(route);
    const chips = (opt.chips || []).map((c) =>
      '<button class="chip ' + (f.chip === c.id ? 'on' : '') + '" data-act="chip" data-route="' + route + '" data-v="' + c.id + '">' +
      U.esc(c.label) + (c.count != null ? ' <span class="n">' + c.count + '</span>' : '') + '</button>').join('');
    return '<div class="toolbar">' +
      '<div class="search"><span class="s-ic">🔍</span><input data-act="search" data-route="' + route + '" value="' + U.attr(f.q) + '" placeholder="' + U.attr(opt.placeholder || 'بحث…') + '"></div>' +
      (opt.dateRange === false ? '' :
        '<input class="input" style="max-width:160px" type="date" data-act="from" data-route="' + route + '" value="' + f.from + '">' +
        '<span class="dim">→</span>' +
        '<input class="input" style="max-width:160px" type="date" data-act="to" data-route="' + route + '" value="' + f.to + '">' +
        '<button class="btn sm ghost" data-act="quick-range" data-route="' + route + '" data-v="today">اليوم</button>' +
        '<button class="btn sm ghost" data-act="quick-range" data-route="' + route + '" data-v="month">الشهر</button>') +
      (chips ? '<div class="chips">' + chips + '</div>' : '') +
      '<div class="spacer"></div>' + (opt.extra || '') + '</div>';
  },
  set(route, patch){ Object.assign(F.get(route), patch); App.render(); },
  pager(total, route, per){
    per = per || 25;
    const f = F.get(route);
    const pages = Math.max(1, Math.ceil(total / per));
    if (pages <= 1) return '<div class="pager"><span>' + total + ' سجل</span></div>';
    let btns = '';
    for (let i = 1; i <= pages; i++){
      if (pages > 9 && Math.abs(i - f.page) > 2 && i !== 1 && i !== pages) { if (Math.abs(i - f.page) === 3) btns += '<span class="dim">…</span>'; continue; }
      btns += '<button class="btn xs ' + (i === f.page ? 'primary' : '') + '" data-act="page" data-route="' + route + '" data-v="' + i + '">' + i + '</button>';
    }
    return '<div class="pager"><span>' + total + ' سجل — صفحة ' + f.page + ' من ' + pages + '</span><div class="spacer"></div>' +
      '<button class="btn xs" data-act="page" data-route="' + route + '" data-v="' + Math.max(1, f.page - 1) + '">السابق</button>' + btns +
      '<button class="btn xs" data-act="page" data-route="' + route + '" data-v="' + Math.min(pages, f.page + 1) + '">التالي</button></div>';
  },
  slice(rows, route, per){
    per = per || 25;
    const f = F.get(route);
    const start = (Math.max(1, f.page) - 1) * per;
    return rows.slice(start, start + per);
  }
};

/* ---------------- تعريف كيان (CRUD) ---------------- */
CRUD.def = function(key, d){ CRUD.defs[key] = d; CRUD.defs[key].key = key; };

CRUD.list = function(key){
  const d = CRUD.defs[key];
  let rows = DB.c(d.coll).slice();
  if (d.filterBranch !== false) rows = rows.filter((r) => DB.inBranch(r));
  const route = d.route || key;
  if (d.searchKeys) rows = rows.filter((r) => F.match(r, route, d.searchKeys));
  if (d.dateField && F.get(route).from) rows = rows.filter((r) => F.inRange(String(r[d.dateField] || '').slice(0, 10), route));
  if (d.chipFilter && F.get(route).chip) rows = rows.filter((r) => d.chipFilter(r, F.get(route).chip));
  rows.sort(d.sort || ((a, b) => String(b.createdAt || b.id).localeCompare(String(a.createdAt || a.id))));
  return rows;
};

CRUD.page = function(key){
  const d = CRUD.defs[key];
  const route = d.route || key;
  const all = CRUD.list(key);
  const total = all.length;
  const rows = F.slice(all, route, d.per || 25);
  const chips = (d.chips || []).map((c) => ({ ...c, count: DB.c(d.coll).filter((r) => !c.id || (d.chipFilter && d.chipFilter(r, c.id))).length }));
  const body = UI.table({
    columns: d.columns,
    rows,
    empty: UI.empty(d.emptyIcon || '🗂️', d.emptyTitle || 'لا توجد بيانات', d.emptyText || '', d.emptyAction || ''),
    rowAttrs: (r) => 'data-id="' + r.id + '"'
  });
  const canAdd = d.allowAdd !== false && (!d.perm || Auth.can(d.perm));
  return UI.page({
    icon: d.icon, title: d.title, sub: d.sub ? d.sub(all.length) : (total + ' سجل'),
    actions: (opt_actions(d, canAdd)) ,
    body: F.bar(route, { placeholder: d.searchPlaceholder, chips, dateRange: d.dateField ? true : false, extra: d.toolbarExtra || '' }) +
      '<div class="card pad-0">' + body + F.pager(total, route, d.per || 25) + '</div>'
  });
};
function opt_actions(d, canAdd){
  let h = '';
  if (d.exportSheet) h += '<button class="btn sm" data-act="crud-export" data-k="' + d.key + '">📥 Excel</button>';
  if (d.printType) h += '<button class="btn sm" data-act="crud-print" data-k="' + d.key + '">🖨️ طباعة</button>';
  if (canAdd) h += '<button class="btn primary sm" data-act="crud-new" data-k="' + d.key + '">＋ ' + U.esc(d.addLabel || 'إضافة') + '</button>';
  return h;
}

CRUD.fields = function(key, rec){
  const d = CRUD.defs[key];
  return typeof d.fields === 'function' ? d.fields(rec) : d.fields;
};

CRUD.openNew = function(key){
  const d = CRUD.defs[key];
  if (d.perm && !Auth.ensure(d.perm)) return;
  CRUD.openEdit(key, null);
};

CRUD.openEdit = function(key, id){
  const d = CRUD.defs[key];
  const rec = id ? DB.get(d.coll, id) : null;
  if (id && !rec) { UI.toast('السجل غير موجود', 'err'); return; }
  const fields = CRUD.fields(key, rec);
  const base = Object.assign({}, d.defaults ? (typeof d.defaults === 'function' ? d.defaults() : d.defaults) : {}, rec || {});
  UI.modal({
    title: (rec ? 'تعديل ' : 'إضافة ') + (d.one || d.title),
    icon: d.icon, wide: !!d.wide,
    body: UI.form(fields, base, { extra: d.formExtra ? d.formExtra(rec) : '' }) + (d.notes ? '<div class="hint-box mt-12">' + d.notes + '</div>' : ''),
    actions: [
      { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
      { label: rec ? '💾 حفظ التعديلات' : '💾 حفظ', cls: 'primary', handler: (ctx) => CRUD.save(key, id, ctx) }
    ],
    data: { key, id, items: rec && Array.isArray(rec.items) ? rec.items.map((i) => ({ ...i })) : (d.defaults && typeof d.defaults === 'function' ? (d.defaults().items || []) : []) },
    onOpen: (ctx) => { if (d.onOpen) d.onOpen(ctx); }
  });
};

CRUD.save = function(key, id, ctx){
  const d = CRUD.defs[key];
  const fields = CRUD.fields(key, id ? DB.get(d.coll, id) : null);
  const root = ctx.slot;
  const data = UI.readForm(root, fields);
  const errs = UI.validate(fields, data);
  if (errs.length){ UI.toast('حقول ناقصة', 'err', 'يرجى تعبئة: ' + errs.join('، ')); return; }
  if (d.beforeSave){
    const res = d.beforeSave(data, id ? DB.get(d.coll, id) : null);
    if (res && res.error){ UI.toast('تعذّر الحفظ', 'err', res.error); return; }
  }
  let rec;
  if (id){
    rec = DB.update(d.coll, id, data);
    DB.log('تعديل ' + (d.one || d.title), (rec && (rec.name || rec.no)) || id, '', 'info');
    UI.toast('تم الحفظ', 'ok');
  } else {
    rec = DB.add(d.coll, data);
    DB.log('إضافة ' + (d.one || d.title), rec.name || rec.no || rec.id, '', 'info');
    UI.toast('تمت الإضافة', 'ok');
  }
  if (d.afterSave) d.afterSave(rec, id, ctx ? ctx.data : null);
  UI.closeModal();
  App.render();
};

CRUD.remove = async function(key, id){
  const d = CRUD.defs[key];
  if (!Auth.ensure('act.delete', 'الحذف يتطلب صلاحية حذف السجلات')) return;
  const rec = DB.get(d.coll, id);
  if (!rec) return;
  if (d.beforeDelete){
    const msg = d.beforeDelete(rec);
    if (msg){ UI.toast('لا يمكن الحذف', 'err', msg); return; }
  }
  const ok = await UI.confirm('تأكيد الحذف', 'سيتم حذف «' + (rec.name || rec.no || 'السجل') + '» نهائياً. لا يمكن التراجع.', { danger: true, okLabel: '🗑️ حذف' });
  if (!ok) return;
  if (d.onDelete) d.onDelete(rec);
  DB.remove(d.coll, id);
  DB.log('حذف ' + (d.one || d.title), rec.name || rec.no || id, '', 'warn');
  UI.toast('تم الحذف', 'ok');
  App.render();
};

/* ---------------- أدوات عرض مشتركة ---------------- */
const V = {
  customerLink(id, name){
    if (!id) return '<span class="dim">زبون نقدي</span>';
    return '<a href="#/customers" data-act="open-customer" data-id="' + id + '"><b>' + U.esc(name || '') + '</b></a>';
  },
  productThumb(p){
    if (!p) return '<div class="thumb">📦</div>';
    return '<div class="thumb">' + (p.image ? '<img src="' + U.esc(p.image) + '">' : (p.icon || '📦')) + '</div>';
  },
  productIcon(p){ return p.image ? '<img src="' + U.esc(p.image) + '" style="width:100%;height:100%;object-fit:cover">' : (p.icon || '📦'); },
  money(v){ return '<span class="num">' + U.money(v) + '</span>'; },
  dateCell(d){ return '<span class="nowrap">' + U.dateAr(String(d || '').slice(0, 10)) + '</span>'; },
  rowMenu(items){
    return '<div class="row-actions">' + items.filter(Boolean).map((a) =>
      '<button class="btn xs ' + (a.cls || 'ghost icon') + '" data-act="' + a.act + '"' + (a.id ? ' data-id="' + a.id + '"' : '') +
      (a.k ? ' data-k="' + a.k + '"' : '') + ' title="' + U.attr(a.title || '') + '">' + (a.icon || '⋯') + '</button>').join('') + '</div>';
  },
  kpi(opt){
    return '<div class="kpi ' + (opt.route ? 'click' : '') + '" style="--k:' + (opt.color || 'var(--accent)') + '"' +
      (opt.route ? ' data-act="go" data-route="' + opt.route + '"' : '') + '>' +
      '<div class="k-top"><div class="k-ic">' + opt.icon + '</div><div class="k-label">' + U.esc(opt.label) + '</div></div>' +
      '<div class="k-val num" data-count="' + (opt.raw != null ? opt.raw : 0) + '" data-suffix="' + U.attr(opt.suffix || '') + '">' + U.esc(opt.value || '0') + '</div>' +
      (opt.foot ? '<div class="k-foot">' + opt.foot + '</div>' : '') +
      (opt.bar != null ? '<div class="k-bar"><i style="width:' + U.clamp(opt.bar, 0, 100) + '%"></i></div>' : '') +
      '</div>';
  },
  rangeLabel(from, to){ return U.dateAr(from) + ' → ' + U.dateAr(to); }
};

/* ============================================================================
   لوحة التحكم
   ========================================================================== */
Views.dashboard = function(params){
  const today = U.today();
  const k = Engine.kpis(DB.state, today);
  const st = DB.state;
  const range = (params && params.range) || 'month';
  const ranges = { today: ['day', U.addDays(today, -13), today, 'آخر 14 يوم'], week: ['day', U.startOfWeek(today), today, 'هذا الأسبوع'], month: ['day', U.startOfMonth(today), today, 'هذا الشهر'], year: ['month', U.startOfYear(today), today, 'هذه السنة'] };
  const r = ranges[range] || ranges.month;
  const series = Engine.salesSeries(st, r[1], r[2], r[0]);
  const mStart = U.startOfMonth(today), prevStart = U.addMonths(mStart, -1);
  const cur = Engine.profitReport(st, mStart, today);
  const prev = Engine.profitReport(st, prevStart, U.addDays(mStart, -1));
  const cats = Engine.byCategory(st, U.addDays(today, -29), today);
  const alerts = Engine.alerts(st, today);
  const insights = Engine.insights(st, today).slice(0, 4);
  const recent = st.invoices.filter((v) => v.status !== 'void').sort((a, b) => String(b.date + (b.time || '')).localeCompare(String(a.date + (a.time || '')))).slice(0, 6);
  const cMap = DB.byId('customers');
  const u = Auth.user() || { name: '' };
  const firstName = String(u.name || '').split(' ')[0] || '';

  const kpis = [
    V.kpi({ icon: '💰', label: 'مبيعات اليوم', value: U.money(k.sales), raw: k.sales, color: 'var(--accent)', foot: '<span>' + k.invoices + ' فاتورة</span>', route: 'sales' }),
    V.kpi({ icon: '💵', label: 'المقبوض اليوم', value: U.money(k.collected), raw: k.collected, color: 'var(--ok)', foot: '<span>رصيد الصندوق ' + U.shortMoney(k.cash) + '</span>', route: 'cashbox' }),
    V.kpi({ icon: '📈', label: 'ربح اليوم', value: U.money(k.netProfit), raw: k.netProfit, color: 'var(--violet)', foot: '<span>مصاريف ' + U.shortMoney(k.expenses) + '</span>', route: 'profits' }),
    V.kpi({ icon: '💳', label: 'أقساط مستحقة اليوم', value: U.money(k.dueTodayAmt), raw: k.dueTodayAmt, color: 'var(--warn)', foot: '<span>' + k.dueToday + ' قسط</span>', route: 'installments' }),
    V.kpi({ icon: '🔴', label: 'أقساط متأخرة', value: U.money(k.overdue), raw: k.overdue, color: 'var(--danger)', foot: '<span>' + k.overdueCount + ' قسط متأخر</span>', route: 'installments' }),
    V.kpi({ icon: '📦', label: 'مخزون منخفض', value: U.num(k.lowStock), raw: k.lowStock, color: 'var(--warn)', foot: '<span>يحتاج إعادة طلب</span>', route: 'stock' }),
    V.kpi({ icon: '👥', label: 'عدد الزبائن', value: U.num(k.customers), raw: k.customers, color: 'var(--teal)', foot: '<span>+' + k.newCustomers + ' اليوم</span>', route: 'customers' }),
    V.kpi({ icon: '🧾', label: 'فواتير اليوم', value: U.num(k.invoices), raw: k.invoices, color: 'var(--info)', foot: '<span>إجمالي الدين ' + U.shortMoney(k.totalDebt) + '</span>', route: 'sales' })
  ].join('');

  const quick = [
    { r: 'pos', ic: '🛒', t: 'بيع جديد', cls: 'primary' },
    { r: null, ic: '👤', t: 'زبون', act: 'crud-new', k: 'customers' },
    { r: null, ic: '📦', t: 'منتج', act: 'crud-new', k: 'products' },
    { r: null, ic: '💳', t: 'تسديد', act: 'payment-new' },
    { r: null, ic: '💸', t: 'مصروف', act: 'crud-new', k: 'expenses' },
    { r: 'print', ic: '🖨️', t: 'طباعة' }
  ].map((q) => '<button class="quick" data-act="' + (q.act || 'go') + '"' + (q.r ? ' data-route="' + q.r + '"' : '') + (q.k ? ' data-k="' + q.k + '"' : '') + '><span class="ic">' + q.ic + '</span>' + q.t + '</button>').join('');

  const growth = prev.revenue > 0 ? ((cur.revenue - prev.revenue) / prev.revenue) * 100 : (cur.revenue ? 100 : 0);

  return UI.page({
    icon: '📊', title: U.greeting() + (firstName ? '، ' + firstName : '') + ' 👋',
    sub: U.dateAr(today, { wd: true }) + ' — ' + (st.branches.length > 1 ? 'فرع: ' + U.esc(DB.branchName(DB.state.currentBranch === 'all' ? '' : DB.state.currentBranch)) : U.esc(ST().subtitle || '')),
    actions: '<button class="btn sm" data-act="go" data-route="day-close">🔒 إغلاق اليوم</button>' +
      '<button class="btn primary sm" data-act="go" data-route="pos">＋ بيع جديد</button>',
    body:
      '<div class="grid g-4">' + kpis + '</div>' +
      '<div class="section-title"><h2>⚡ إجراءات سريعة</h2><div class="line"></div></div>' +
      '<div class="quick-grid">' + quick + '</div>' +
      '<div class="grid g-3 mt-16" style="grid-template-columns:2fr 1fr">' +
        '<section class="card">' +
          '<div class="card-h"><h3>📊 المبيعات</h3><span class="sub">' + r[3] + '</span>' +
          '<div class="acts"><div class="btn-group">' +
          Object.keys(ranges).map((kk) => '<button data-act="dash-range" data-v="' + kk + '" class="' + (kk === range ? 'on' : '') + '">' + ({ today: 'اليوم', week: 'الأسبوع', month: 'الشهر', year: 'السنة' }[kk]) + '</button>').join('') +
          '</div></div></div>' +
          UI.lineChart(series.map((s) => ({ label: s.label, value: s.sales })), { height: 230 }) +
          '<div class="row gap-16 mt-12 wrap"><div class="tiny muted">الإجمالي: <b class="num">' + U.money(U.sum(series, (s) => s.sales)) + '</b></div>' +
          '<div class="tiny muted">الربح: <b class="num" style="color:var(--ok)">' + U.money(U.sum(series, (s) => s.profit)) + '</b></div>' +
          '<div class="tiny muted">الفواتير: <b class="num">' + U.num(U.sum(series, (s) => s.count)) + '</b></div></div>' +
        '</section>' +
        '<section class="card">' +
          '<div class="card-h"><h3>📈 الأرباح</h3><span class="sub">مقارنة شهرية</span></div>' +
          UI.barChart([
            { label: U.MO[+prevStart.slice(5, 7) - 1], value: prev.revenue, value2: prev.gross },
            { label: U.MO[+mStart.slice(5, 7) - 1], value: cur.revenue, value2: cur.gross }
          ], { dual: true, height: 180, label2: 'ربح' }) +
          '<div class="legend mt-8"><div class="lg-i"><span class="lg-c" style="background:var(--accent)"></span>المبيعات<span class="lg-v">' + U.shortMoney(cur.revenue) + '</span></div>' +
          '<div class="lg-i"><span class="lg-c" style="background:var(--ok)"></span>الربح الإجمالي<span class="lg-v">' + U.shortMoney(cur.gross) + '</span></div>' +
          '<div class="lg-i"><span class="lg-c" style="background:var(--danger)"></span>المصاريف<span class="lg-v">' + U.shortMoney(cur.expenses) + '</span></div>' +
          '<div class="lg-i"><span class="lg-c" style="background:var(--violet)"></span>صافي الربح<span class="lg-v">' + U.shortMoney(cur.net) + '</span></div></div>' +
          '<div class="hint-box ' + (growth >= 0 ? 'ok' : 'danger') + ' mt-12">' + (growth >= 0 ? '📈' : '📉') + ' ' +
          (growth >= 0 ? 'نمو ' : 'انخفاض ') + U.pct(Math.abs(growth), 0) + ' مقارنة بالشهر السابق</div>' +
        '</section>' +
      '</div>' +
      '<div class="grid g-3 mt-16" style="grid-template-columns:1fr 1fr 1fr">' +
        '<section class="card"><div class="card-h"><h3>🧩 المبيعات حسب الأقسام</h3><span class="sub">30 يوم</span></div>' +
          (cats.length ? UI.donut(cats.slice(0, 6)) : UI.empty('🧩', 'لا مبيعات بعد')) + '</section>' +
        '<section class="card"><div class="card-h"><h3>🔔 مركز التنبيهات</h3>' +
          '<div class="acts"><button class="btn xs ghost" data-act="go" data-route="alerts">الكل</button></div></div>' +
          '<div class="col gap-8">' + (alerts.length ? alerts.slice(0, 5).map((a) =>
            '<div class="alert-item lv-' + a.level + '" data-act="go" data-route="' + a.route + '">' +
            '<div class="a-ic">' + a.icon + '</div><div class="grow"><div class="b small">' + U.esc(a.title) + '</div>' +
            '<div class="tiny dim">' + U.esc(a.msg) + '</div></div>' +
            (a.count ? '<span class="pill">' + a.count + '</span>' : '') + '</div>').join('') :
            '<div class="hint-box ok">✅ لا توجد تنبيهات — كل شيء تحت السيطرة</div>') + '</div></section>' +
        '<section class="card"><div class="card-h"><h3>🧠 ذكاء النظام</h3><div class="acts"><button class="btn xs ghost" data-act="go" data-route="insights">التفاصيل</button></div></div>' +
          '<div class="col gap-8">' + (insights.length ? insights.map((i) =>
            '<div class="alert-item lv-' + (i.tone === 'accent' ? 'info' : i.tone) + '"><div class="a-ic">' + i.icon + '</div>' +
            '<div class="grow"><div class="b small">' + U.esc(i.title) + '</div><div class="tiny dim">' + U.esc(i.text) + '</div></div></div>').join('') :
            '<div class="hint-box">ابدأ بإضافة منتجات ومبيعات ليحلّل النظام أداءك.</div>') + '</div></section>' +
      '</div>' +
      '<div class="grid g-2 mt-16" style="grid-template-columns:1.6fr 1fr">' +
        '<section class="card pad-0"><div class="card-h" style="padding:16px 16px 0"><h3>🧾 آخر الفواتير</h3>' +
          '<div class="acts"><button class="btn xs ghost" data-act="go" data-route="sales">عرض الكل</button></div></div>' +
          '<div style="padding:12px">' + UI.table({
            compact: true,
            columns: [
              { title: 'الرقم', render: (v) => '<a href="#" data-act="invoice-view" data-id="' + v.id + '" class="mono b">' + U.esc(v.no) + '</a>' },
              { title: 'الزبون', render: (v) => V.customerLink(v.customerId, (cMap[v.customerId] || {}).name) },
              { title: 'الدفع', render: (v) => '<span class="badge ' + (v.method === 'installment' ? 'warn' : 'ok') + '">' + App.payLabel(v.method) + '</span>' },
              { title: 'الإجمالي', cls: 'num', render: (v) => V.money(v.total) },
              { title: 'التاريخ', render: (v) => '<span class="tiny dim">' + U.dateAr(v.date, { short: true }) + '</span>' }
            ],
            rows: recent,
            empty: UI.empty('🧾', 'لا فواتير بعد', 'ابدأ أول عملية بيع من نقطة البيع.', '<button class="btn primary sm mt-8" data-act="go" data-route="pos">🛒 فتح نقطة البيع</button>')
          }) + '</div></section>' +
        '<section class="card pad-0"><div class="card-h" style="padding:16px 16px 0"><h3>🕵️ سجل النشاط</h3>' +
          '<div class="acts"><button class="btn xs ghost" data-act="go-admin" data-tab="audit">السجل</button></div></div>' +
          '<div style="padding:14px"><div class="timeline">' +
          (DB.c('audit').slice(0, 8).map((a) => '<div class="tl-i"><div class="tl-t">' + U.esc(a.action) + ' — ' + U.esc(a.target || '') + '</div>' +
            '<div class="tl-s">' + U.esc(a.userName) + ' • ' + U.stampAr(a.at) + '</div></div>').join('') || '<div class="dim small">لا يوجد نشاط بعد</div>') +
          '</div></div></section>' +
      '</div>'
  });
};

/* ============================================================================
   التنبيهات
   ========================================================================== */
Views.alerts = function(){
  const alerts = Engine.alerts(DB.state, U.today());
  const body = alerts.length ? '<div class="col gap-10">' + alerts.map((a) =>
    '<div class="alert-item lv-' + a.level + '" data-act="go" data-route="' + a.route + '">' +
    '<div class="a-ic">' + a.icon + '</div><div class="grow"><div class="b">' + U.esc(a.title) + '</div>' +
    '<div class="small muted">' + U.esc(a.msg) + '</div></div>' +
    (a.count ? '<span class="pill">' + a.count + '</span>' : '') + '<span class="dim">‹</span></div>').join('') + '</div>'
    : UI.empty('🔔', 'لا توجد تنبيهات', 'النظام لا يجد ما يستدعي انتباهك الآن.');
  return UI.page({ icon: '🔔', title: 'مركز التنبيهات', sub: alerts.length + ' تنبيه نشط', body: '<div class="card">' + body + '</div>' });
};

/* ============================================================================
   مهام اليوم
   ========================================================================== */
CRUD.def('tasks', {
  title: 'مهام اليوم', one: 'مهمة', icon: '✅', coll: 'tasks', perm: 'tasks',
  addLabel: 'مهمة جديدة',
  fields: (rec) => [
    { key: 'title', label: 'المهمة', required: true, full: true },
    { key: 'due', label: 'تاريخ الاستحقاق', type: 'date', value: U.today() },
    { key: 'priority', label: 'الأولوية', type: 'select', value: 'normal', options: [{ value: 'low', label: 'منخفضة' }, { value: 'normal', label: 'عادية' }, { value: 'high', label: 'عالية' }] },
    { key: 'done', label: '', type: 'check', checkLabel: 'مهمة منجزة' },
    { key: 'notes', label: 'ملاحظات', type: 'textarea', full: true }
  ],
  columns: [
    { title: 'الحالة', width: '70px', render: (t) => t.done ? '<span class="badge ok">✓ منجزة</span>' : '<span class="badge warn">قيد التنفيذ</span>' },
    { title: 'المهمة', render: (t) => '<b>' + U.esc(t.title) + '</b>' + (t.notes ? '<div class="tiny dim">' + U.esc(t.notes) + '</div>' : '') },
    { title: 'الأولوية', render: (t) => ({ high: '<span class="badge danger">عالية</span>', normal: '<span class="badge info">عادية</span>', low: '<span class="badge">منخفضة</span>' }[t.priority] || '') },
    { title: 'الاستحقاق', render: (t) => V.dateCell(t.due) + ' <span class="tiny dim">' + U.rel(t.due) + '</span>' },
    { title: '', cls: 'acts', render: (t) => V.rowMenu([
      { act: 'task-toggle', id: t.id, icon: t.done ? '↩️' : '✓', title: t.done ? 'إعادة فتح' : 'إنجاز', cls: 'btn xs ghost' },
      { act: 'crud-edit', k: 'tasks', id: t.id, icon: '✏️', title: 'تعديل', cls: 'btn xs ghost' },
      { act: 'crud-del', k: 'tasks', id: t.id, icon: '🗑️', title: 'حذف', cls: 'btn xs ghost' }
    ]) }
  ],
  sort: (a, b) => (a.done - b.done) || String(a.due).localeCompare(String(b.due)),
  searchKeys: ['title', 'notes'],
  filterBranch: false
});
Views.tasks = () => CRUD.page('tasks');

/* ============================================================================
   التقويم المالي — الأقساط المستحقة يوماً بيوم
   ========================================================================== */
Views.calendar = function(){
  const today = U.today();
  const cMap = DB.byId('customers');
  const map = {};
  const days = [];
  for (let i = -7; i <= 30; i++) days.push(U.addDays(today, i));
  days.forEach((d) => { map[d] = []; });
  DB.c('plans').filter((p) => p.status !== 'void').forEach((pl) => {
    (pl.items || []).forEach((it) => {
      if (it.paid >= it.amount) return;
      if (map[it.due]) map[it.due].push({ plan: pl, item: it, who: (cMap[pl.customerId] || {}).name || '—' });
    });
  });
  const body = '<div class="grid g-4">' + days.map((d) => {
    const list = map[d];
    const amt = U.sum(list, (x) => Math.max(0, x.item.amount - (x.item.paid || 0)));
    const isToday = d === today, past = d < today;
    return '<div class="card ' + (isToday ? '' : 'flat') + '" style="' + (isToday ? 'border-color:var(--accent);box-shadow:var(--shadow)' : '') + '">' +
      '<div class="row gap-8"><div class="grow"><div class="b small">' + U.dateAr(d, { short: true }) + '</div>' +
      '<div class="tiny dim">' + U.WD[U.parse(d).getDay()] + (isToday ? ' — اليوم' : past ? ' — ' + U.rel(d) : '') + '</div></div>' +
      (list.length ? '<span class="pill ' + (past ? '' : '') + '" style="' + (past ? 'background:var(--danger-soft);color:var(--danger)' : '') + '">' + list.length + '</span>' : '') + '</div>' +
      (amt ? '<div class="tiny b mt-4" style="color:' + (past ? 'var(--danger)' : 'var(--accent)') + '">' + U.money(amt) + '</div>' : '') +
      (list.length ? '<div class="mt-8 col gap-4">' + list.slice(0, 4).map((x) =>
        '<div class="tiny row gap-6"><span class="dim">' + x.item.no + '</span><span class="grow ellip">' + U.esc(x.who) + '</span>' +
        '<button class="btn xs soft" data-act="payment-new" data-customer="' + x.plan.customerId + '" data-plan="' + x.plan.id + '">تسديد</button></div>').join('') +
        (list.length > 4 ? '<div class="tiny dim">+ ' + (list.length - 4) + ' أخرى</div>' : '') + '</div>' : '<div class="tiny dim mt-4">لا استحقاقات</div>') +
      '</div>';
  }).join('') + '</div>';
  return UI.page({ icon: '📅', title: 'التقويم المالي', sub: 'الأقساط المستحقة يوماً بيوم (من 7 أيام سابقة إلى 30 يوماً قادمة)', body });
};
