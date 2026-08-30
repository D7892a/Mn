/* ============================================================================
   11) الخدمات (ضمان، صيانة، توصيل، استبدال) + المالية (صندوق، مصاريف، أرباح)
   ========================================================================== */
const EXPENSE_CATS = ['إيجار', 'كهرباء', 'مولدة', 'نقل', 'صيانة', 'رواتب', 'ضيافة', 'مصاريف أخرى'];

CRUD.def('expenses', {
  title: 'المصاريف', one: 'مصروف', icon: '💸', coll: 'expenses', perm: 'expenses',
  addLabel: 'مصروف جديد', dateField: 'date', searchKeys: ['note', 'category'],
  chips: EXPENSE_CATS.map((c) => ({ id: c, label: c })),
  chipFilter: (e, chip) => e.category === chip,
  defaults: () => ({ date: U.today(), category: EXPENSE_CATS[0], amount: 0 }),
  fields: () => [
    { key: 'date', label: 'التاريخ', type: 'date', value: U.today() },
    { key: 'category', label: 'البند', type: 'select', required: true, options: EXPENSE_CATS.map((c) => ({ value: c, label: c })) },
    { key: 'amount', label: 'المبلغ', type: 'money', required: true, value: 0 },
    { key: 'note', label: 'البيان', full: true, placeholder: 'مثال: إيجار المحل — شهر أغسطس' }
  ],
  sort: (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
  columns: [
    { title: 'التاريخ', render: (e) => V.dateCell(e.date) },
    { title: 'البند', render: (e) => '<span class="badge warn">' + U.esc(e.category) + '</span>' },
    { title: 'البيان', render: (e) => U.esc(e.note || '—') },
    { title: 'المبلغ', cls: 'num', render: (e) => '<b style="color:var(--danger)">' + U.money(e.amount) + '</b>' },
    { title: 'بواسطة', render: (e) => '<span class="tiny dim">' + U.esc((DB.get('users', e.userId) || {}).name || '—') + '</span>' },
    { title: '', cls: 'acts', render: (e) => V.rowMenu([
      { act: 'crud-edit', k: 'expenses', id: e.id, icon: '✏️', title: 'تعديل' },
      { act: 'crud-del', k: 'expenses', id: e.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ],
  exportSheet: true,
  emptyIcon: '💸', emptyTitle: 'لا مصاريف مسجّلة', emptyText: 'سجّل الإيجار والكهرباء والنقل والرواتب ليحسب النظام صافي الربح الحقيقي.'
});
Views.expenses = () => CRUD.page('expenses');

/* ---------------------------------------------------------------- الصندوق */
Views.cashbox = function(){
  const route = 'cashbox';
  const f = F.get(route);
  const date = f.date || U.today();
  f.date = date;
  const box = Engine.cashboxDay(DB.state, date);
  let rows = [];
  DB.c('invoices').filter((v) => v.date === date && v.status !== 'void' && (v.method === 'cash' || v.method === 'card')).forEach((v) => {
    rows.push({ at: v.date + ' ' + (v.time || '00:00'), type: 'in', cat: v.method === 'cash' ? 'مبيعات نقدية' : 'مبيعات بطاقة', ref: v.no, amount: Number(v.paid) || 0, note: '' });
  });
  DB.c('payments').filter((p) => p.date === date).forEach((p) => {
    rows.push({ at: p.date + ' ' + (p.time || '00:00'), type: Number(p.amount) >= 0 ? 'in' : 'out', cat: Number(p.amount) >= 0 ? 'تسديدات' : 'مرتجع', ref: p.no, amount: Math.abs(Number(p.amount)), note: (DB.get('customers', p.customerId) || {}).name || '' });
  });
  DB.c('expenses').filter((e) => e.date === date).forEach((e) => rows.push({ at: e.date, type: 'out', cat: e.category, ref: '', amount: Number(e.amount) || 0, note: e.note || '' }));
  DB.c('supplierPayments').filter((e) => e.date === date).forEach((e) => rows.push({ at: e.date, type: 'out', cat: 'دفعة مورد', ref: e.no || '', amount: Number(e.amount) || 0, note: (DB.get('suppliers', e.supplierId) || {}).name || '' }));
  DB.c('returns').filter((r) => r.date === date).forEach((r) => rows.push({ at: r.date, type: 'out', cat: 'مرتجع', ref: r.no, amount: Number(r.amount) || 0, note: r.reason || '' }));
  DB.c('cashbox').filter((c) => c.date === date).forEach((c) => rows.push({ at: c.date + ' ' + (c.time || '00:00'), type: c.type, cat: c.category, ref: c.ref || '', amount: Number(c.amount) || 0, note: c.note || '', id: c.id }));
  rows.sort((a, b) => String(a.at).localeCompare(String(b.at)));

  return UI.page({
    icon: '💰', title: 'الصندوق', sub: 'يوم ' + U.dateAr(date, { wd: true }) + (box.closed ? ' — مغلق' : ''),
    actions: '<input class="input" type="date" value="' + date + '" data-act="cashbox-date" style="max-width:170px">' +
      '<button class="btn sm" data-act="cashbox-in">＋ إيداع</button>' +
      '<button class="btn sm" data-act="cashbox-out">− سحب</button>' +
      (box.closed ? '' : '<button class="btn primary sm" data-act="go" data-route="day-close">🔒 إغلاق اليوم</button>'),
    body: '<div class="grid g-6 mb-16">' +
      V.kpi({ icon: '🌅', label: 'رصيد البداية', value: U.money(box.opening), raw: box.opening, color: 'var(--info)' }) +
      V.kpi({ icon: '💵', label: 'مبيعات نقدية', value: U.money(box.cashSales), raw: box.cashSales, color: 'var(--ok)' }) +
      V.kpi({ icon: '💳', label: 'تسديدات', value: U.money(box.cashPayments), raw: box.cashPayments, color: 'var(--accent)' }) +
      V.kpi({ icon: '💸', label: 'مصاريف', value: U.money(box.expenses + box.supplierPaid), color: 'var(--danger)' }) +
      V.kpi({ icon: '↩️', label: 'مرتجعات', value: U.money(box.returns), color: 'var(--warn)' }) +
      V.kpi({ icon: '🧮', label: 'الرصيد المتوقع', value: U.money(box.expected), raw: box.expected, color: 'var(--violet)', foot: box.closed ? '<span>المعدود ' + U.money(box.counted) + '</span>' : '<span>لم يُغلق بعد</span>' }) +
      '</div>' +
      '<div class="card pad-0"><div class="card-h" style="padding:14px 16px 0"><h3>📒 دفتر النقدية</h3><span class="sub">' + rows.length + ' حركة</span>' +
      '<div class="acts"><button class="btn xs ghost" data-act="print-cashbox">🖨️ طباعة</button></div></div>' +
      '<div style="padding:12px">' + UI.table({
        compact: true,
        columns: [
          { title: 'الوقت', render: (r) => '<span class="tiny">' + U.timeAr(String(r.at).length > 11 ? r.at : r.at + ' 00:00') + '</span>' },
          { title: 'البيان', render: (r) => '<b>' + U.esc(r.cat) + '</b>' + (r.note ? '<div class="tiny dim">' + U.esc(r.note) + '</div>' : '') },
          { title: 'المرجع', render: (r) => '<span class="mono tiny">' + U.esc(r.ref || '—') + '</span>' },
          { title: 'وارد', cls: 'num', render: (r) => r.type === 'in' ? '<span style="color:var(--ok)">+' + U.money(r.amount) + '</span>' : '' },
          { title: 'منصرف', cls: 'num', render: (r) => r.type === 'out' ? '<span style="color:var(--danger)">-' + U.money(r.amount) + '</span>' : '' },
          { title: '', cls: 'acts', render: (r) => r.id ? V.rowMenu([{ act: 'crud-del', k: 'cashbox', id: r.id, icon: '🗑️', title: 'حذف' }]) : '' }
        ],
        rows,
        empty: UI.empty('💰', 'لا حركات في هذا اليوم'),
        footer: ['الإجمالي', '', '', '<span style="color:var(--ok)">' + U.money(U.sum(rows.filter((r) => r.type === 'in'), (r) => r.amount)) + '</span>', '<span style="color:var(--danger)">' + U.money(U.sum(rows.filter((r) => r.type === 'out'), (r) => r.amount)) + '</span>', '']
      }) + '</div></div>'
  });
};

CRUD.def('cashbox', {
  title: 'حركات الصندوق', one: 'حركة', icon: '💰', coll: 'cashbox', perm: 'cashbox', route: 'cashbox-entries',
  defaults: () => ({ date: U.today(), type: 'in', amount: 0 }),
  fields: () => [
    { key: 'date', label: 'التاريخ', type: 'date', value: U.today() },
    { key: 'type', label: 'النوع', type: 'select', value: 'in', options: [{ value: 'in', label: 'وارد (إيداع)' }, { value: 'out', label: 'منصرف (سحب)' }] },
    { key: 'category', label: 'البند', required: true },
    { key: 'amount', label: 'المبلغ', type: 'money', required: true, value: 0 },
    { key: 'note', label: 'ملاحظة', full: true }
  ],
  columns: [
    { title: 'التاريخ', render: (c) => V.dateCell(c.date) },
    { title: 'النوع', render: (c) => c.type === 'in' ? '<span class="badge ok">وارد</span>' : '<span class="badge danger">منصرف</span>' },
    { title: 'البند', render: (c) => U.esc(c.category) },
    { title: 'المبلغ', cls: 'num', render: (c) => U.money(c.amount) },
    { title: '', cls: 'acts', render: (c) => V.rowMenu([{ act: 'crud-del', k: 'cashbox', id: c.id, icon: '🗑️', title: 'حذف' }]) }
  ]
});
Views['cashbox-entries'] = () => CRUD.page('cashbox');

/* ---------------------------------------------------------------- الأرباح */
Views.profits = function(){
  const route = 'profits';
  const f = F.get(route);
  const p = Engine.profitReport(DB.state, f.from, f.to);
  const series = Engine.salesSeries(DB.state, f.from, f.to, U.diffDays(f.to, f.from) > 62 ? 'month' : 'day');
  const cats = Engine.byCategory(DB.state, f.from, f.to);
  const exp = Engine.expensesSummary(DB.state, f.from, f.to);
  const days = Math.max(1, U.diffDays(f.to, f.from) + 1);
  return UI.page({
    icon: '📈', title: 'الأرباح', sub: V.rangeLabel(f.from, f.to) + ' (' + days + ' يوم)',
    actions: '<button class="btn sm" data-act="print-range" data-type="daily">🖨️ تقرير</button><button class="btn sm" data-act="export-profits">📥 Excel</button>',
    body: F.bar(route, { placeholder: 'بحث…', extra: '<button class="btn sm" data-act="quick-range" data-route="profits" data-v="prevmonth">الشهر السابق</button>' }) +
      '<div class="grid g-4 mb-16">' +
      V.kpi({ icon: '💰', label: 'المبيعات', value: U.money(p.revenue), raw: p.revenue, color: 'var(--accent)', foot: '<span>' + p.invoices + ' فاتورة</span>' }) +
      (Auth.can('act.cost') ? V.kpi({ icon: '📈', label: 'الربح الإجمالي', value: U.money(p.gross), raw: p.gross, color: 'var(--ok)', foot: '<span>هامش ' + U.pct(p.margin, 1) + '</span>', bar: p.margin }) : '') +
      V.kpi({ icon: '💸', label: 'المصاريف', value: U.money(p.expenses), raw: p.expenses, color: 'var(--danger)' }) +
      V.kpi({ icon: '🏦', label: 'صافي الربح', value: U.money(p.net), raw: p.net, color: 'var(--violet)', foot: '<span>معدل يومي ' + U.money(p.net / days) + '</span>' }) +
      '</div>' +
      '<div class="grid g-3" style="grid-template-columns:2fr 1fr">' +
      UI.card('المبيعات مقابل الربح', UI.barChart(series.map((s) => ({ label: s.label, value: s.sales, value2: s.profit })), { dual: true, height: 240, label2: 'ربح' }) +
        '<div class="legend mt-8"><div class="lg-i"><span class="lg-c" style="background:var(--accent)"></span>المبيعات</div><div class="lg-i"><span class="lg-c" style="background:var(--ok)"></span>الربح</div></div>') +
      UI.card('توزيع المصاريف', exp.cats.length ? UI.donut(exp.cats.slice(0, 6).map((c, i) => ({ name: c.name, value: c.amount, color: ['var(--danger)', 'var(--warn)', 'var(--accent)', 'var(--violet)', 'var(--teal)', 'var(--info)'][i % 6] }))) : UI.empty('💸', 'لا مصاريف')) +
      '</div>' +
      '<div class="grid g-2 mt-16">' +
      UI.card('الربح حسب الأقسام', UI.table({
        compact: true,
        columns: [
          { title: 'القسم', render: (c) => (c.icon || '') + ' ' + U.esc(c.name) },
          { title: 'الكمية', cls: 'num', render: (c) => U.num(c.qty) },
          { title: 'المبيعات', cls: 'num', render: (c) => U.money(c.sales) },
          ...(Auth.can('act.cost') ? [{ title: 'الربح', cls: 'num', render: (c) => '<span style="color:var(--ok)">' + U.money(c.profit) + '</span>' }] : []),
          { title: 'النسبة', render: (c) => UI.progress(p.revenue ? (c.sales / p.revenue) * 100 : 0) }
        ], rows: cats, empty: UI.empty('🧩', 'لا مبيعات')
      })) +
      UI.card('المصاريف حسب البند', UI.table({
        compact: true,
        columns: [
          { title: 'البند', render: (c) => U.esc(c.name) },
          { title: 'المبلغ', cls: 'num', render: (c) => U.money(c.amount) },
          { title: 'من المبيعات', render: (c) => U.pct(p.revenue ? (c.amount / p.revenue) * 100 : 0, 1) }
        ], rows: exp.cats, empty: UI.empty('💸', 'لا مصاريف'),
        footer: ['الإجمالي', U.money(exp.total), '']
      })) +
      '</div>'
  });
};

/* ---------------------------------------------------------------- إغلاق اليوم */
Views['day-close'] = function(){
  const date = U.today();
  const box = Engine.cashboxDay(DB.state, date);
  const p = Engine.profitReport(DB.state, date, date);
  const closes = DB.c('dayCloses').slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
  return UI.page({
    icon: '🔒', title: 'إغلاق اليوم', sub: U.dateAr(date, { wd: true }),
    body: (box.closed ? '<div class="hint-box ok mb-16">✅ تم إغلاق هذا اليوم الساعة ' + U.timeAr(box.close.closedAt) + ' بواسطة ' + U.esc(box.close.userName || '') + ' — لا يمكن تعديل عمليات اليوم إلا بصلاحية المدير.</div>' :
      '<div class="hint-box warn mb-16">⚠️ بعد الإغلاق لا يسمح النظام بتعديل عمليات هذا اليوم إلا بصلاحية المدير.</div>') +
      '<div class="grid g-2" style="grid-template-columns:1.3fr 1fr">' +
      UI.card('ملخّص اليوم', '<div class="stat-line"><div class="sl-ic">💰</div><div><div class="sl-t">إجمالي المبيعات</div><div class="sl-s">' + box.invoices + ' فاتورة</div></div><div class="sl-v">' + U.money(p.revenue) + '</div></div>' +
        '<div class="stat-line"><div class="sl-ic">💵</div><div><div class="sl-t">النقد في الصندوق</div></div><div class="sl-v">' + U.money(box.cashSales + box.cashPayments) + '</div></div>' +
        '<div class="stat-line"><div class="sl-ic">💳</div><div><div class="sl-t">التسديدات</div><div class="sl-s">' + box.payments + ' عملية</div></div><div class="sl-v">' + U.money(box.cashPayments) + '</div></div>' +
        '<div class="stat-line"><div class="sl-ic">💸</div><div><div class="sl-t">المصاريف</div></div><div class="sl-v">' + U.money(box.expenses + box.supplierPaid) + '</div></div>' +
        '<div class="stat-line"><div class="sl-ic">↩️</div><div><div class="sl-t">المرتجعات</div></div><div class="sl-v">' + U.money(box.returns) + '</div></div>' +
        (Auth.can('act.cost') ? '<div class="stat-line"><div class="sl-ic">📈</div><div><div class="sl-t">الربح</div><div class="sl-s">بعد خصم المصاريف</div></div><div class="sl-v" style="color:var(--ok)">' + U.money(p.net) + '</div></div>' : '') +
        '<div class="stat-line"><div class="sl-ic">🧮</div><div><div class="sl-t">الرصيد المتوقع للصندوق</div></div><div class="sl-v b">' + U.money(box.expected) + '</div></div>') +
      UI.card('تسوية الصندوق', box.closed ?
        '<div class="stat-line"><div class="sl-t">المتوقع</div><div class="sl-v">' + U.money(box.expected) + '</div></div>' +
        '<div class="stat-line"><div class="sl-t">المعدود فعلياً</div><div class="sl-v">' + U.money(box.counted) + '</div></div>' +
        '<div class="stat-line"><div class="sl-t">الفرق</div><div class="sl-v" style="color:' + (box.diff === 0 ? 'var(--ok)' : 'var(--danger)') + '">' + U.money(box.diff) + '</div></div>' +
        (box.close.note ? '<div class="note-box mt-8">' + U.esc(box.close.note) + '</div>' : '')
        : '<div class="field mb-12"><label>الرصيد المتوقع</label><input class="input" value="' + U.num(box.expected) + '" disabled></div>' +
        '<div class="field mb-12"><label>المبلغ المعدود فعلياً <span class="req">*</span></label><input class="input" id="closeCounted" type="number" value="' + box.expected + '" inputmode="numeric"></div>' +
        '<div class="field mb-12"><label>الفرق</label><input class="input" id="closeDiff" value="0" disabled></div>' +
        '<div class="field mb-12"><label>ملاحظات</label><input class="input" id="closeNote" placeholder="مثال: لا يوجد فرق"></div>' +
        '<button class="btn dark lg block" data-act="day-close-do">🔒 إغلاق اليوم وحفظ التسوية</button>') +
      '</div>' +
      '<div class="section-title"><h2>📚 الأيام المغلقة</h2><div class="line"></div></div>' +
      '<div class="card pad-0">' + UI.table({
        columns: [
          { title: 'التاريخ', render: (d) => V.dateCell(d.date) + ' <span class="tiny dim">' + U.WD[U.parse(d.date).getDay()] + '</span>' },
          { title: 'المبيعات', cls: 'num', render: (d) => U.money(d.sales) },
          { title: 'المتوقع', cls: 'num', render: (d) => U.money(d.expected) },
          { title: 'المعدود', cls: 'num', render: (d) => U.money(d.counted) },
          { title: 'الفرق', cls: 'num', render: (d) => { const df = (Number(d.counted) || 0) - (Number(d.expected) || 0); return '<span style="color:' + (df === 0 ? 'var(--ok)' : 'var(--danger)') + '">' + U.money(df) + '</span>'; } },
          { title: 'أُغلق بواسطة', render: (d) => '<span class="tiny dim">' + U.esc(d.userName || '') + ' • ' + U.timeAr(d.closedAt) + '</span>' },
          { title: '', cls: 'acts', render: (d) => V.rowMenu([{ act: 'print-daily', id: d.date, icon: '🖨️', title: 'تقرير اليوم' }]) }
        ], rows: closes, empty: UI.empty('🔒', 'لم يُغلق أي يوم بعد')
      }) + '</div>'
  });
};

/* ============================================================================
   الضمان
   ========================================================================== */
CRUD.def('warranties', {
  title: 'الضمان', one: 'ضمان', icon: '🛡️', coll: 'warranties', perm: 'warranties',
  addLabel: 'ضمان جديد', searchKeys: ['serial', 'no'],
  chips: [{ id: '', label: 'الكل' }, { id: 'active', label: '🟢 ساري' }, { id: 'soon', label: '🟠 قريب الانتهاء' }, { id: 'expired', label: '🔴 منتهي' }],
  chipFilter: (w, chip) => Engine.warrantyStatus(w).key === (chip === 'active' ? 'active' : chip),
  defaults: () => ({ start: U.today(), months: S().warranty.defaultMonths || 12, end: U.addMonths(U.today(), S().warranty.defaultMonths || 12), status: 'active' }),
  fields: () => [
    { key: 'no', label: 'رقم الضمان', value: 'W-' + String((DB.state.counters.warranty || 0) + 1).padStart(4, '0') },
    { key: 'productId', label: 'المنتج', type: 'select', required: true, placeholder: '— اختر —', options: DB.c('products').map((p) => ({ value: p.id, label: p.name })) },
    { key: 'customerId', label: 'الزبون', type: 'select', required: true, placeholder: '— اختر —', options: DB.c('customers').map((c) => ({ value: c.id, label: c.name })) },
    { key: 'serial', label: 'الرقم التسلسلي' },
    { key: 'start', label: 'بداية الضمان', type: 'date', value: U.today() },
    { key: 'months', label: 'المدة (شهر)', type: 'number', value: 12 },
    { key: 'end', label: 'نهاية الضمان', type: 'date' },
    { key: 'notes', label: 'ملاحظات', type: 'textarea', full: true }
  ],
  beforeSave: (data) => {
    if (data.start && data.months) data.end = U.addMonths(data.start, Number(data.months));
    return null;
  },
  sort: (a, b) => String(a.end).localeCompare(String(b.end)),
  columns: [
    { title: 'الرقم', render: (w) => '<span class="mono b">' + U.esc(w.no || '') + '</span>' },
    { title: 'الجهاز', render: (w) => '<a href="#" data-act="product-open" data-id="' + w.productId + '" class="b">' + U.esc((DB.get('products', w.productId) || {}).name || '—') + '</a><div class="tiny dim mono">' + U.esc(w.serial || '') + '</div>' },
    { title: 'الزبون', render: (w) => V.customerLink(w.customerId, (DB.get('customers', w.customerId) || {}).name) },
    { title: 'البداية', render: (w) => V.dateCell(w.start) },
    { title: 'النهاية', render: (w) => V.dateCell(w.end) },
    { title: 'المدة', cls: 'num', render: (w) => (w.months || 0) + ' شهر' },
    { title: 'الحالة', render: (w) => { const s = Engine.warrantyStatus(w); return '<span class="badge ' + s.cls + '"><span class="d"></span>' + s.label + '</span>' + (s.days >= 0 ? '<div class="tiny dim">باقي ' + s.days + ' يوم</div>' : '<div class="tiny dim">منتهي منذ ' + Math.abs(s.days) + ' يوم</div>'); } },
    { title: '', cls: 'acts', render: (w) => V.rowMenu([
      { act: 'doc-preview', id: w.id, k: 'warranty', icon: '🖨️', title: 'شهادة الضمان' },
      { act: 'crud-edit', k: 'warranties', id: w.id, icon: '✏️', title: 'تعديل' },
      { act: 'crud-del', k: 'warranties', id: w.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ],
  exportSheet: true
});
Views.warranties = () => CRUD.page('warranties');

/* ============================================================================
   الصيانة
   ========================================================================== */
const MAINT_FLOW = [['received', 'استلام'], ['inspect', 'فحص'], ['waiting', 'بانتظار قطعة'], ['repair', 'إصلاح'], ['ready', 'جاهز'], ['delivered', 'تم التسليم']];
CRUD.def('maintenance', {
  title: 'الصيانة', one: 'طلب صيانة', icon: '🔧', coll: 'maintenance', perm: 'maintenance',
  addLabel: 'طلب صيانة', wide: true, searchKeys: ['no', 'device', 'problem', 'serial'],
  chips: [{ id: '', label: 'الكل' }].concat(MAINT_FLOW.map((m) => ({ id: m[0], label: m[1] }))),
  chipFilter: (m, chip) => m.status === chip,
  defaults: () => ({ date: U.today(), status: 'received', cost: 0 }),
  fields: () => [
    { key: 'no', label: 'رقم الطلب', value: 'M-' + String((DB.state.counters.maintenance || 0) + 1).padStart(4, '0') },
    { key: 'customerId', label: 'الزبون', type: 'select', required: true, placeholder: '— اختر —', options: DB.c('customers').map((c) => ({ value: c.id, label: c.name + (c.phone ? ' — ' + c.phone : '') })) },
    { key: 'date', label: 'تاريخ الاستلام', type: 'date', value: U.today() },
    { key: 'device', label: 'الجهاز', required: true, placeholder: 'مثال: ثلاجة سامسونج 18 قدم' },
    { key: 'serial', label: 'الرقم التسلسلي' },
    { key: 'techId', label: 'الفني', type: 'select', placeholder: '— اختر —', options: DB.c('techs').map((t) => ({ value: t.id, label: t.name })) },
    { key: 'status', label: 'الحالة', type: 'select', value: 'received', options: MAINT_FLOW.map((m) => ({ value: m[0], label: m[1] })) },
    { key: 'cost', label: 'التكلفة', type: 'money', value: 0 },
    { key: 'underWarranty', label: '', type: 'check', checkLabel: 'ضمن الضمان (بدون أجر)' },
    { key: 'problem', label: 'وصف المشكلة', type: 'textarea', full: true },
    { key: 'notes', label: 'ملاحظات / قطع الغيار', type: 'textarea', full: true }
  ],
  columns: [
    { title: 'الرقم', render: (m) => '<span class="mono b">' + U.esc(m.no) + '</span>' },
    { title: 'الزبون', render: (m) => { const c = DB.get('customers', m.customerId) || {}; return V.customerLink(m.customerId, c.name) + '<div class="tiny dim mono">' + U.esc(c.phone || '') + '</div>'; } },
    { title: 'الجهاز', render: (m) => '<b>' + U.esc(m.device) + '</b><div class="tiny dim mono">' + U.esc(m.serial || '') + '</div>' },
    { title: 'المشكلة', render: (m) => '<span class="tiny">' + U.esc(m.problem || '—') + '</span>' },
    { title: 'الفني', render: (m) => U.esc((DB.get('techs', m.techId) || {}).name || '—') },
    { title: 'التكلفة', cls: 'num', render: (m) => m.underWarranty ? '<span class="badge info">ضمان</span>' : V.money(m.cost) },
    { title: 'الحالة', render: (m) => UI.statusBadge(m.status) },
    { title: '', cls: 'acts', render: (m) => V.rowMenu([
      { act: 'maint-next', id: m.id, icon: '⏭️', title: 'المرحلة التالية' },
      { act: 'doc-preview', id: m.id, k: 'receipt_in', icon: '🖨️', title: 'وصل استلام' },
      { act: 'crud-edit', k: 'maintenance', id: m.id, icon: '✏️', title: 'تعديل' },
      { act: 'crud-del', k: 'maintenance', id: m.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ],
  exportSheet: true
});
Views.maintenance = function(){
  const route = 'maintenance';
  const f = F.get(route);
  const all = CRUD.list('maintenance');
  if (f.chip === 'kanban' || !f.chip){
    const cols = MAINT_FLOW.map((st) => {
      const items = all.filter((m) => m.status === st[0]);
      return '<div class="kb-col"><h4>' + U.esc(st[1]) + ' <span class="pill">' + items.length + '</span></h4>' +
        (items.length ? items.map((m) => {
          const c = DB.get('customers', m.customerId) || {};
          return '<div class="kb-card" data-act="crud-edit" data-k="maintenance" data-id="' + m.id + '">' +
            '<div class="row gap-6"><span class="mono tiny dim">' + U.esc(m.no) + '</span><div class="spacer"></div>' +
            (m.underWarranty ? '<span class="badge info">ضمان</span>' : '') + '</div>' +
            '<div class="b small mt-4">' + U.esc(m.device) + '</div>' +
            '<div class="tiny dim">' + U.esc(c.name || '') + ' • ' + U.esc(c.phone || '') + '</div>' +
            '<div class="tiny muted mt-4 ellip">' + U.esc(m.problem || '') + '</div>' +
            '<div class="row gap-6 mt-8"><span class="tiny dim grow">' + U.dateAr(m.date, { short: true }) + '</span>' +
            (Number(m.cost) ? '<span class="b tiny num">' + U.money(m.cost) + '</span>' : '') + '</div></div>';
        }).join('') : '<div class="tiny dim mid" style="padding:16px">لا طلبات</div>') + '</div>';
    }).join('');
    return UI.page({
      icon: '🔧', title: 'الصيانة (الورشة)', sub: all.length + ' طلب',
      actions: '<button class="btn sm" data-act="chip" data-route="maintenance" data-v="list">📋 عرض جدولي</button>' +
        '<button class="btn primary sm" data-act="crud-new" data-k="maintenance">＋ طلب صيانة</button>',
      body: '<div class="kanban">' + cols + '</div>'
    });
  }
  return CRUD.page('maintenance');
};

/* ============================================================================
   التوصيل
   ========================================================================== */
const DEL_FLOW = [['new', 'جديد'], ['scheduled', 'مجدول'], ['onway', 'بالطريق'], ['done', 'منجز'], ['cancelled', 'ملغى']];
CRUD.def('deliveries', {
  title: 'التوصيل', one: 'طلب توصيل', icon: '🚚', coll: 'deliveries', perm: 'deliveries',
  addLabel: 'طلب توصيل', searchKeys: ['no', 'address', 'customerName'],
  chips: [{ id: '', label: 'الكل' }].concat(DEL_FLOW.map((d) => ({ id: d[0], label: d[1] }))),
  chipFilter: (d, chip) => d.status === chip,
  defaults: () => ({ date: U.today(), status: 'new', fee: 0 }),
  fields: () => [
    { key: 'no', label: 'رقم الطلب', value: 'D-' + String((DB.state.counters.delivery || 0) + 1).padStart(4, '0') },
    { key: 'customerId', label: 'الزبون', type: 'select', placeholder: '— اختر —', options: DB.c('customers').map((c) => ({ value: c.id, label: c.name + (c.phone ? ' — ' + c.phone : '') })) },
    { key: 'customerName', label: 'اسم المستلم' },
    { key: 'phone', label: 'الهاتف' },
    { key: 'driverId', label: 'الموصّل', type: 'select', placeholder: '— اختر —', options: DB.c('drivers').map((d) => ({ value: d.id, label: d.name })) },
    { key: 'fee', label: 'أجرة التوصيل', type: 'money', value: 0 },
    { key: 'scheduleAt', label: 'الموعد', type: 'date', value: U.today() },
    { key: 'status', label: 'الحالة', type: 'select', value: 'new', options: DEL_FLOW.map((d) => ({ value: d[0], label: d[1] })) },
    { key: 'address', label: 'العنوان', full: true, required: true },
    { key: 'items', label: 'الأصناف', full: true, placeholder: 'مثال: ثلاجة + غسالة' }
  ],
  afterSave: (rec) => { const c = DB.get('customers', rec.customerId); if (c) DB.update('deliveries', rec.id, { customerName: rec.customerName || c.name, phone: rec.phone || c.phone }); },
  columns: [
    { title: 'الرقم', render: (d) => '<span class="mono b">' + U.esc(d.no) + '</span>' },
    { title: 'الزبون', render: (d) => { const c = DB.get('customers', d.customerId) || {}; return '<b>' + U.esc(d.customerName || c.name || '—') + '</b><div class="tiny dim mono">' + U.esc(d.phone || c.phone || '') + '</div>'; } },
    { title: 'العنوان', render: (d) => '<span class="tiny">' + U.esc(d.address || '—') + '</span>' },
    { title: 'الأصناف', render: (d) => '<span class="tiny muted">' + U.esc(typeof d.items === 'string' ? d.items : (d.items || []).map((i) => i.name).join('، ')) + '</span>' },
    { title: 'الموعد', render: (d) => V.dateCell(d.scheduleAt) },
    { title: 'الموصّل', render: (d) => U.esc((DB.get('drivers', d.driverId) || {}).name || '—') },
    { title: 'الأجرة', cls: 'num', render: (d) => V.money(d.fee) },
    { title: 'الحالة', render: (d) => UI.statusBadge(d.status) },
    { title: '', cls: 'acts', render: (d) => V.rowMenu([
      { act: 'del-next', id: d.id, icon: '⏭️', title: 'المرحلة التالية' },
      { act: 'crud-edit', k: 'deliveries', id: d.id, icon: '✏️', title: 'تعديل' },
      { act: 'crud-del', k: 'deliveries', id: d.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ],
  exportSheet: true
});
Views.deliveries = function(){
  const route = 'deliveries';
  const f = F.get(route);
  const all = CRUD.list('deliveries');
  if (f.chip === 'kanban' || !f.chip){
    return UI.page({
      icon: '🚚', title: 'التوصيل والتركيب', sub: all.length + ' طلب',
      actions: '<button class="btn sm" data-act="chip" data-route="deliveries" data-v="list">📋 عرض جدولي</button>' +
        '<button class="btn sm" data-act="print-deliveries">🖨️ جدول اليوم</button>' +
        '<button class="btn primary sm" data-act="crud-new" data-k="deliveries">＋ طلب توصيل</button>',
      body: '<div class="kanban">' + DEL_FLOW.map((st) => {
        const items = all.filter((d) => d.status === st[0]);
        return '<div class="kb-col"><h4>' + U.esc(st[1]) + ' <span class="pill">' + items.length + '</span></h4>' +
          (items.length ? items.map((d) => {
            const c = DB.get('customers', d.customerId) || {};
            return '<div class="kb-card" data-act="crud-edit" data-k="deliveries" data-id="' + d.id + '">' +
              '<div class="row gap-6"><span class="mono tiny dim">' + U.esc(d.no) + '</span><div class="spacer"></div>' +
              '<button class="btn xs ghost" data-act="del-next" data-id="' + d.id + '">⏭️</button></div>' +
              '<div class="b small mt-4">' + U.esc(d.customerName || c.name || '—') + '</div>' +
              '<div class="tiny dim mono">' + U.esc(d.phone || c.phone || '') + '</div>' +
              '<div class="tiny muted mt-4 ellip">📍 ' + U.esc(d.address || '') + '</div>' +
              '<div class="row gap-6 mt-8"><span class="tiny dim grow">' + U.dateAr(d.scheduleAt, { short: true }) + '</span>' +
              (Number(d.fee) ? '<span class="b tiny num">' + U.money(d.fee) + '</span>' : '') + '</div></div>';
          }).join('') : '<div class="tiny dim mid" style="padding:16px">لا طلبات</div>') + '</div>';
      }).join('') + '</div>'
    });
  }
  return CRUD.page('deliveries');
};

/* ============================================================================
   الاستبدال
   ========================================================================== */
CRUD.def('exchanges', {
  title: 'الاستبدال', one: 'عملية استبدال', icon: '🔄', coll: 'exchanges', perm: 'returns',
  addLabel: 'استبدال جديد', searchKeys: ['no'], dateField: 'date',
  defaults: () => ({ date: U.today(), status: 'done', diff: 0 }),
  fields: () => [
    { key: 'no', label: 'رقم العملية', value: 'EX-' + String((DB.state.counters.exchange || 0) + 1).padStart(4, '0') },
    { key: 'customerId', label: 'الزبون', type: 'select', required: true, placeholder: '— اختر —', options: DB.c('customers').map((c) => ({ value: c.id, label: c.name })) },
    { key: 'date', label: 'التاريخ', type: 'date', value: U.today() },
    { key: 'outItem', label: 'الصنف المستلم من الزبون', required: true },
    { key: 'outValue', label: 'قيمته', type: 'money', value: 0 },
    { key: 'inProductId', label: 'الصنف المسلَّم للزبون', type: 'select', placeholder: '— اختر —', options: DB.c('products').map((p) => ({ value: p.id, label: p.name + ' — ' + U.num(p.price) })) },
    { key: 'diff', label: 'فرق السعر', type: 'money', value: 0, hint: 'موجب = يدفع الزبون، سالب = يستلم' },
    { key: 'reason', label: 'سبب الاستبدال', full: true },
    { key: 'status', label: 'الحالة', type: 'select', value: 'done', options: [{ value: 'done', label: 'منجز' }, { value: 'pending', label: 'قيد الانتظار' }, { value: 'cancelled', label: 'ملغى' }] }
  ],
  columns: [
    { title: 'الرقم', render: (e) => '<span class="mono b">' + U.esc(e.no) + '</span>' },
    { title: 'التاريخ', render: (e) => V.dateCell(e.date) },
    { title: 'الزبون', render: (e) => V.customerLink(e.customerId, (DB.get('customers', e.customerId) || {}).name) },
    { title: 'مستلم من الزبون', render: (e) => U.esc(e.outItem || '—') + '<div class="tiny dim">' + U.money(e.outValue) + '</div>' },
    { title: 'مسلَّم للزبون', render: (e) => U.esc((DB.get('products', e.inProductId) || {}).name || '—') },
    { title: 'الفرق', cls: 'num', render: (e) => '<b style="color:' + (Number(e.diff) >= 0 ? 'var(--ok)' : 'var(--danger)') + '">' + U.money(e.diff) + '</b>' },
    { title: 'الحالة', render: (e) => UI.statusBadge(e.status) },
    { title: '', cls: 'acts', render: (e) => V.rowMenu([
      { act: 'crud-edit', k: 'exchanges', id: e.id, icon: '✏️', title: 'تعديل' },
      { act: 'crud-del', k: 'exchanges', id: e.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ],
  exportSheet: true
});
Views.exchanges = () => CRUD.page('exchanges');
