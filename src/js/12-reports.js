/* ============================================================================
   12) مركز التقارير + مركز Excel + مركز الطباعة + الذكاء
   ========================================================================== */
const Reports = { defs: {} };

Reports.def = function(id, d){ d.id = id; Reports.defs[id] = d; };

/* تعريف التقارير — تُستخدم أيضاً في مركز Excel */
Reports.def('sales', {
  title: 'المبيعات', icon: '🧾', group: 'المبيعات',
  rows: (from, to, q) => DB.c('invoices').filter((v) => Engine.inRange(v.date, from, to) && (!q || U.has(v.no, q) || U.has((DB.get('customers', v.customerId) || {}).name, q))),
  columns: () => [
    { key: 'no', title: 'رقم الفاتورة', width: 14 },
    { key: 'date', title: 'التاريخ', width: 13 },
    { key: 'customer', title: 'الزبون', width: 22 },
    { key: 'phone', title: 'الهاتف', width: 15 },
    { key: 'items', title: 'عدد الأصناف', type: 'number', width: 12 },
    { key: 'method', title: 'طريقة الدفع', width: 13 },
    { key: 'discount', title: 'الخصم', type: 'money', width: 12 },
    { key: 'total', title: 'الإجمالي', type: 'money', width: 15 },
    { key: 'paid', title: 'المدفوع', type: 'money', width: 15 },
    { key: 'profit', title: 'الربح', type: 'money', width: 14 },
    { key: 'status', title: 'الحالة', width: 11 }
  ],
  map: (v) => {
    const c = DB.get('customers', v.customerId) || {};
    return { no: v.no, date: v.date, customer: c.name || 'زبون نقدي', phone: c.phone || '', items: U.sum(v.items, (i) => i.qty), method: App.payLabel(v.method), discount: Number(v.discount) || 0, total: Number(v.total) || 0, paid: Number(v.paid) || 0, profit: Math.round(Engine.invoiceProfit(v)), status: v.status === 'void' ? 'ملغاة' : 'نشطة' };
  },
  summary: (rows) => [
    { k: 'عدد الفواتير', v: rows.length },
    { k: 'إجمالي المبيعات', v: U.sum(rows, (r) => r.total) },
    { k: 'إجمالي الخصم', v: U.sum(rows, (r) => r.discount) },
    { k: 'إجمالي الربح', v: U.sum(rows, (r) => r.profit) }
  ]
});

Reports.def('profits', {
  title: 'الأرباح', icon: '📈', group: 'المالية',
  rows: (from, to) => {
    const days = [];
    const d = U.parse(from), e = U.parse(to);
    let guard = 0;
    while (d <= e && guard++ < 400){
      const iso = U.iso(d);
      const p = Engine.profitReport(DB.state, iso, iso);
      days.push({ date: iso, revenue: p.revenue, cost: p.cost, gross: p.gross, expenses: p.expenses, net: p.net, invoices: p.invoices });
      d.setDate(d.getDate() + 1);
    }
    return days;
  },
  columns: () => [
    { key: 'date', title: 'التاريخ', width: 13 }, { key: 'invoices', title: 'الفواتير', type: 'number', width: 11 },
    { key: 'revenue', title: 'المبيعات', type: 'money', width: 15 }, { key: 'cost', title: 'الكلفة', type: 'money', width: 15 },
    { key: 'gross', title: 'الربح الإجمالي', type: 'money', width: 16 }, { key: 'expenses', title: 'المصاريف', type: 'money', width: 14 },
    { key: 'net', title: 'صافي الربح', type: 'money', width: 16 }
  ],
  map: (r) => r,
  summary: (rows) => [
    { k: 'إجمالي المبيعات', v: U.sum(rows, (r) => r.revenue) }, { k: 'إجمالي الكلفة', v: U.sum(rows, (r) => r.cost) },
    { k: 'الربح الإجمالي', v: U.sum(rows, (r) => r.gross) }, { k: 'المصاريف', v: U.sum(rows, (r) => r.expenses) },
    { k: 'صافي الربح', v: U.sum(rows, (r) => r.net) }
  ]
});

Reports.def('customers', {
  title: 'الزبائن', icon: '👥', group: 'العملاء',
  rows: (from, to, q) => DB.c('customers').filter((c) => !q || U.has(c.name, q) || U.has(c.phone, q)),
  columns: () => [
    { key: 'code', title: 'الرقم', width: 12 }, { key: 'name', title: 'الاسم', width: 24 }, { key: 'phone', title: 'الهاتف', width: 15 },
    { key: 'address', title: 'العنوان', width: 26 }, { key: 'tier', title: 'التصنيف', width: 11 },
    { key: 'invoices', title: 'عدد الفواتير', type: 'number', width: 12 }, { key: 'purchased', title: 'إجمالي المشتريات', type: 'money', width: 17 },
    { key: 'paid', title: 'المدفوع', type: 'money', width: 15 }, { key: 'remaining', title: 'المتبقي', type: 'money', width: 15 },
    { key: 'last', title: 'آخر شراء', width: 13 }
  ],
  map: (c) => {
    const b = Engine.customerBalance(DB.state, c.id);
    const invs = DB.c('invoices').filter((v) => v.customerId === c.id && v.status !== 'void').sort((a, x) => String(x.date).localeCompare(String(a.date)));
    return { code: c.code || '', name: c.name, phone: c.phone || '', address: c.address || '', tier: c.tier === 'vip' ? 'VIP' : 'عادي', invoices: b.invoices, purchased: b.purchased, paid: b.paid, remaining: b.remaining, last: invs.length ? invs[0].date : '' };
  },
  summary: (rows) => [{ k: 'عدد الزبائن', v: rows.length }, { k: 'إجمالي المشتريات', v: U.sum(rows, (r) => r.purchased) }, { k: 'إجمالي المتبقي', v: U.sum(rows, (r) => r.remaining) }]
});

Reports.def('installments', {
  title: 'الأقساط', icon: '💳', group: 'العملاء',
  rows: (from, to, q) => DB.c('plans').filter((p) => p.status !== 'void' && (!q || U.has((DB.get('customers', p.customerId) || {}).name, q))),
  columns: () => [
    { key: 'no', title: 'رقم العقد', width: 14 }, { key: 'customer', title: 'الزبون', width: 24 }, { key: 'phone', title: 'الهاتف', width: 15 },
    { key: 'total', title: 'قيمة العقد', type: 'money', width: 15 }, { key: 'down', title: 'الدفعة الأولى', type: 'money', width: 15 },
    { key: 'months', title: 'عدد الأقساط', type: 'number', width: 12 }, { key: 'paid', title: 'المدفوع', type: 'money', width: 15 },
    { key: 'remaining', title: 'المتبقي', type: 'money', width: 15 }, { key: 'overdue', title: 'المتأخر', type: 'money', width: 14 },
    { key: 'next', title: 'أقرب استحقاق', width: 13 }, { key: 'status', title: 'الحالة', width: 12 }
  ],
  map: (p) => {
    const s = Engine.planSummary(p), c = DB.get('customers', p.customerId) || {};
    return { no: p.no, customer: c.name || '', phone: c.phone || '', total: s.total, down: s.down, months: s.count, paid: s.paidAll, remaining: s.remaining, overdue: s.overdue, next: s.next ? s.next.due : '', status: s.remaining <= 0 ? 'مسدّد' : s.overdue ? 'متأخر' : 'نشط' };
  },
  summary: (rows) => [{ k: 'عدد العقود', v: rows.length }, { k: 'إجمالي الديون', v: U.sum(rows, (r) => r.remaining) }, { k: 'إجمالي المتأخر', v: U.sum(rows, (r) => r.overdue) }]
});

Reports.def('payments', {
  title: 'التسديدات', icon: '💰', group: 'العملاء',
  rows: (from, to, q) => DB.c('payments').filter((p) => Engine.inRange(p.date, from, to) && (!q || U.has((DB.get('customers', p.customerId) || {}).name, q) || U.has(p.no, q))),
  columns: () => [
    { key: 'no', title: 'رقم الوصل', width: 14 }, { key: 'date', title: 'التاريخ', width: 13 },
    { key: 'customer', title: 'الزبون', width: 24 }, { key: 'amount', title: 'المبلغ', type: 'money', width: 15 },
    { key: 'method', title: 'الطريقة', width: 12 }, { key: 'note', title: 'ملاحظة', width: 26 }
  ],
  map: (p) => ({ no: p.no, date: p.date, customer: (DB.get('customers', p.customerId) || {}).name || '', amount: Number(p.amount) || 0, method: App.payLabel(p.method), note: p.note || '' }),
  summary: (rows) => [{ k: 'عدد الوصولات', v: rows.length }, { k: 'إجمالي المقبوض', v: U.sum(rows, (r) => r.amount) }]
});

Reports.def('stock', {
  title: 'المخزون', icon: '📦', group: 'المخزون',
  rows: (from, to, q) => DB.c('products').filter((p) => !q || U.has(p.name, q) || U.has(p.code, q)),
  columns: () => [
    { key: 'code', title: 'الكود', width: 12 }, { key: 'name', title: 'المنتج', width: 28 }, { key: 'category', title: 'القسم', width: 16 },
    { key: 'barcode', title: 'الباركود', width: 16 }, { key: 'qty', title: 'الكمية', type: 'number', width: 10 },
    { key: 'min', title: 'الحد الأدنى', type: 'number', width: 12 }, { key: 'cost', title: 'الكلفة', type: 'money', width: 14 },
    { key: 'price', title: 'سعر البيع', type: 'money', width: 14 }, { key: 'value', title: 'قيمة المخزون', type: 'money', width: 16 },
    { key: 'margin', title: 'الهامش %', type: 'number', width: 11 }, { key: 'status', title: 'الحالة', width: 12 }
  ],
  map: (p) => ({
    code: p.code || '', name: p.name, category: (DB.get('categories', p.categoryId) || {}).name || '', barcode: p.barcode || '',
    qty: Number(p.qty) || 0, min: Number(p.minQty) || 0, cost: Number(p.cost) || 0, price: Number(p.price) || 0,
    value: (Number(p.qty) || 0) * (Number(p.cost) || 0), margin: Math.round(Engine.marginOf(p) * 10) / 10,
    status: Number(p.qty) <= 0 ? 'نافد' : Number(p.qty) <= Number(p.minQty || 0) ? 'منخفض' : 'متوفر'
  }),
  summary: (rows) => [{ k: 'عدد الأصناف', v: rows.length }, { k: 'إجمالي القطع', v: U.sum(rows, (r) => r.qty) }, { k: 'قيمة المخزون', v: U.sum(rows, (r) => r.value) }]
});

Reports.def('products', {
  title: 'حركة المنتجات', icon: '📊', group: 'المخزون',
  rows: (from, to) => DB.c('products').map((p) => {
    const s = Engine.productSales(DB.state, p.id, from, to);
    return { p, ...s };
  }),
  columns: () => [
    { key: 'code', title: 'الكود', width: 12 }, { key: 'name', title: 'المنتج', width: 28 }, { key: 'qty', title: 'المبيع', type: 'number', width: 10 },
    { key: 'revenue', title: 'الإيراد', type: 'money', width: 15 }, { key: 'profit', title: 'الربح', type: 'money', width: 15 },
    { key: 'stock', title: 'الرصيد الحالي', type: 'number', width: 14 }, { key: 'last', title: 'آخر بيع', width: 13 }
  ],
  map: (r) => ({ code: r.p.code || '', name: r.p.name, qty: r.qty, revenue: Math.round(r.revenue), profit: Math.round(r.profit), stock: Number(r.p.qty) || 0, last: r.last || '' }),
  summary: (rows) => [{ k: 'عدد الأصناف', v: rows.length }, { k: 'إجمالي المبيع', v: U.sum(rows, (r) => r.qty) }, { k: 'الإيراد', v: U.sum(rows, (r) => r.revenue) }, { k: 'الربح', v: U.sum(rows, (r) => r.profit) }]
});

Reports.def('purchases', {
  title: 'المشتريات', icon: '📥', group: 'المشتريات',
  rows: (from, to, q) => DB.c('purchases').filter((p) => Engine.inRange(p.date, from, to) && (!q || U.has(p.no, q) || U.has((DB.get('suppliers', p.supplierId) || {}).name, q))),
  columns: () => [
    { key: 'no', title: 'الرقم', width: 14 }, { key: 'date', title: 'التاريخ', width: 13 }, { key: 'supplier', title: 'المورد', width: 24 },
    { key: 'items', title: 'عدد الأصناف', type: 'number', width: 12 }, { key: 'total', title: 'الإجمالي', type: 'money', width: 15 },
    { key: 'paid', title: 'المدفوع', type: 'money', width: 15 }, { key: 'remaining', title: 'المتبقي', type: 'money', width: 15 }
  ],
  map: (p) => ({ no: p.no, date: p.date, supplier: (DB.get('suppliers', p.supplierId) || {}).name || '', items: U.sum(p.items, (i) => i.qty), total: Number(p.total) || 0, paid: Number(p.paid) || 0, remaining: Math.max(0, (Number(p.total) || 0) - (Number(p.paid) || 0)) }),
  summary: (rows) => [{ k: 'عدد الفواتير', v: rows.length }, { k: 'إجمالي المشتريات', v: U.sum(rows, (r) => r.total) }, { k: 'المتبقي للموردين', v: U.sum(rows, (r) => r.remaining) }]
});

Reports.def('suppliers', {
  title: 'الموردين', icon: '🏭', group: 'المشتريات',
  rows: () => DB.c('suppliers'),
  columns: () => [
    { key: 'name', title: 'المورد', width: 26 }, { key: 'phone', title: 'الهاتف', width: 15 }, { key: 'company', title: 'الشركة', width: 20 },
    { key: 'bought', title: 'المشتريات', type: 'money', width: 16 }, { key: 'paid', title: 'المدفوع', type: 'money', width: 15 }, { key: 'remaining', title: 'المتبقي', type: 'money', width: 15 }
  ],
  map: (s) => { const b = Engine.supplierBalance(DB.state, s.id); return { name: s.name, phone: s.phone || '', company: s.company || '', bought: b.bought, paid: b.paid, remaining: b.remaining }; },
  summary: (rows) => [{ k: 'عدد الموردين', v: rows.length }, { k: 'إجمالي المشتريات', v: U.sum(rows, (r) => r.bought) }, { k: 'المستحق', v: U.sum(rows, (r) => r.remaining) }]
});

Reports.def('expenses', {
  title: 'المصاريف', icon: '💸', group: 'المالية',
  rows: (from, to, q) => DB.c('expenses').filter((e) => Engine.inRange(e.date, from, to) && (!q || U.has(e.note, q) || U.has(e.category, q))),
  columns: () => [
    { key: 'date', title: 'التاريخ', width: 13 }, { key: 'category', title: 'البند', width: 16 },
    { key: 'note', title: 'البيان', width: 30 }, { key: 'amount', title: 'المبلغ', type: 'money', width: 15 }, { key: 'by', title: 'بواسطة', width: 16 }
  ],
  map: (e) => ({ date: e.date, category: e.category, note: e.note || '', amount: Number(e.amount) || 0, by: (DB.get('users', e.userId) || {}).name || '' }),
  summary: (rows) => [{ k: 'عدد القيود', v: rows.length }, { k: 'إجمالي المصاريف', v: U.sum(rows, (r) => r.amount) }]
});

Reports.def('warranties', {
  title: 'الضمانات', icon: '🛡️', group: 'الخدمات',
  rows: (from, to, q) => DB.c('warranties').filter((w) => !q || U.has(w.serial, q) || U.has((DB.get('customers', w.customerId) || {}).name, q)),
  columns: () => [
    { key: 'no', title: 'الرقم', width: 13 }, { key: 'product', title: 'الجهاز', width: 26 }, { key: 'serial', title: 'السيريال', width: 18 },
    { key: 'customer', title: 'الزبون', width: 24 }, { key: 'start', title: 'البداية', width: 13 }, { key: 'end', title: 'النهاية', width: 13 },
    { key: 'days', title: 'الأيام المتبقية', type: 'number', width: 14 }, { key: 'status', title: 'الحالة', width: 14 }
  ],
  map: (w) => { const s = Engine.warrantyStatus(w); return { no: w.no || '', product: (DB.get('products', w.productId) || {}).name || '', serial: w.serial || '', customer: (DB.get('customers', w.customerId) || {}).name || '', start: w.start, end: w.end, days: s.days, status: s.label }; },
  summary: (rows) => [{ k: 'عدد الضمانات', v: rows.length }, { k: 'السارية', v: rows.filter((r) => r.status === 'ساري').length }, { k: 'المنتهية', v: rows.filter((r) => r.status === 'منتهي').length }]
});

Reports.def('maintenance', {
  title: 'الصيانة', icon: '🔧', group: 'الخدمات',
  rows: (from, to, q) => DB.c('maintenance').filter((m) => Engine.inRange(m.date, from, to) && (!q || U.has(m.device, q) || U.has(m.no, q))),
  columns: () => [
    { key: 'no', title: 'الرقم', width: 13 }, { key: 'date', title: 'التاريخ', width: 13 }, { key: 'customer', title: 'الزبون', width: 24 },
    { key: 'device', title: 'الجهاز', width: 26 }, { key: 'tech', title: 'الفني', width: 16 },
    { key: 'cost', title: 'التكلفة', type: 'money', width: 14 }, { key: 'status', title: 'الحالة', width: 14 }
  ],
  map: (m) => ({ no: m.no, date: m.date, customer: (DB.get('customers', m.customerId) || {}).name || '', device: m.device || '', tech: (DB.get('techs', m.techId) || {}).name || '', cost: Number(m.cost) || 0, status: (MAINT_FLOW.find((x) => x[0] === m.status) || [])[1] || m.status }),
  summary: (rows) => [{ k: 'عدد الطلبات', v: rows.length }, { k: 'إجمالي الأجور', v: U.sum(rows, (r) => r.cost) }]
});

Reports.def('deliveries', {
  title: 'التوصيل', icon: '🚚', group: 'الخدمات',
  rows: (from, to, q) => DB.c('deliveries').filter((d) => Engine.inRange(d.scheduleAt || d.date, from, to) && (!q || U.has(d.address, q) || U.has(d.customerName, q))),
  columns: () => [
    { key: 'no', title: 'الرقم', width: 13 }, { key: 'date', title: 'الموعد', width: 13 }, { key: 'customer', title: 'الزبون', width: 24 },
    { key: 'address', title: 'العنوان', width: 30 }, { key: 'driver', title: 'الموصّل', width: 16 },
    { key: 'fee', title: 'الأجرة', type: 'money', width: 13 }, { key: 'status', title: 'الحالة', width: 13 }
  ],
  map: (d) => ({ no: d.no, date: d.scheduleAt || d.date, customer: d.customerName || (DB.get('customers', d.customerId) || {}).name || '', address: d.address || '', driver: (DB.get('drivers', d.driverId) || {}).name || '', fee: Number(d.fee) || 0, status: (DEL_FLOW.find((x) => x[0] === d.status) || [])[1] || d.status }),
  summary: (rows) => [{ k: 'عدد الطلبات', v: rows.length }, { k: 'إجمالي الأجور', v: U.sum(rows, (r) => r.fee) }]
});

/* توليد صفوف التقرير جاهزة للتصدير/العرض */
Reports.build = function(id, from, to, q){
  const d = Reports.defs[id];
  if (!d) return { columns: [], rows: [], summary: [] };
  const raw = (d.rows(from, to, q) || []);
  const rows = raw.map(d.map);
  return { def: d, columns: d.columns(), rows, summary: d.summary ? d.summary(rows) : [], raw };
};

/* ---------------------------------------------------------------- شاشة التقارير */
Views.reports = function(params){
  const route = 'reports';
  const f = F.get(route);
  const id = (params && params.id) || App.reportId || 'sales';
  App.reportId = id;
  const data = Reports.build(id, f.from, f.to, f.q);
  const defs = Object.values(Reports.defs);
  const groups = U.uniq(defs.map((d) => d.group));
  const cols = data.columns.map((c) => ({
    title: c.title, cls: c.type === 'money' || c.type === 'number' ? 'num' : '',
    render: (r) => c.type === 'money' ? U.money(r[c.key]) : c.type === 'number' ? U.num(r[c.key]) : U.esc(r[c.key] == null ? '' : r[c.key])
  }));
  const footer = data.columns.map((c) => {
    if (c.type !== 'money' && c.type !== 'number') return '';
    if (!['total', 'amount', 'revenue', 'profit', 'net', 'gross', 'remaining', 'paid', 'purchased', 'value', 'cost', 'expenses', 'discount', 'fee', 'bought'].includes(c.key)) return '';
    return U.money(U.sum(data.rows, (r) => Number(r[c.key]) || 0));
  });
  return UI.page({
    icon: '📊', title: 'مركز التقارير', sub: V.rangeLabel(f.from, f.to),
    actions: '<button class="btn sm" data-act="report-print">🖨️ طباعة</button>' +
      '<button class="btn sm" data-act="report-pdf">📄 PDF</button>' +
      '<button class="btn primary sm" data-act="report-excel">📥 Excel</button>',
    body: '<div class="card mb-16" style="padding:12px"><div class="chips">' +
      groups.map((g) => '<span class="tiny dim" style="align-self:center;margin-inline-end:4px">' + U.esc(g) + ':</span>' +
        defs.filter((d) => d.group === g).map((d) => '<button class="chip ' + (d.id === id ? 'on' : '') + '" data-act="report-set" data-v="' + d.id + '">' + d.icon + ' ' + U.esc(d.title) + '</button>').join('')).join('') +
      '</div></div>' +
      F.bar(route, { placeholder: 'بحث داخل التقرير…' }) +
      '<div class="grid g-4 mb-16">' + (data.summary || []).slice(0, 4).map((s, i) =>
        V.kpi({ icon: data.def.icon, label: s.k, value: typeof s.v === 'number' ? (String(s.k).includes('عدد') ? U.num(s.v) : U.money(s.v)) : String(s.v), color: ['var(--accent)', 'var(--ok)', 'var(--danger)', 'var(--violet)'][i % 4] })).join('') + '</div>' +
      '<div class="card pad-0">' + UI.table({ columns: cols, rows: F.slice(data.rows, route, 50), footer, empty: UI.empty('📊', 'لا بيانات في هذه الفترة') }) + F.pager(data.rows.length, route, 50) + '</div>'
  });
};

/* ---------------------------------------------------------------- مركز Excel */
Views.excel = function(){
  const route = 'excel';
  const f = F.get(route);
  const defs = Object.values(Reports.defs);
  const counts = {};
  defs.forEach((d) => { counts[d.id] = Reports.build(d.id, f.from, f.to, f.q).rows.length; });
  return UI.page({
    icon: '📥', title: 'مركز التصدير (Excel)', sub: 'ملفات .xlsx حقيقية بأرقام قابلة للجمع والفلترة',
    actions: '<button class="btn primary sm" data-act="excel-all">📦 تصدير الكل</button>',
    body: '<div class="card mb-16" style="padding:14px"><div class="row gap-10 wrap">' +
      '<span class="b small">الفترة:</span>' +
      '<input class="input" style="max-width:170px" type="date" data-act="from" data-route="' + route + '" value="' + f.from + '">' +
      '<span class="dim">→</span>' +
      '<input class="input" style="max-width:170px" type="date" data-act="to" data-route="' + route + '" value="' + f.to + '">' +
      '<button class="btn sm" data-act="quick-range" data-route="' + route + '" data-v="today">اليوم</button>' +
      '<button class="btn sm" data-act="quick-range" data-route="' + route + '" data-v="month">الشهر</button>' +
      '<button class="btn sm" data-act="quick-range" data-route="' + route + '" data-v="year">السنة</button>' +
      '<button class="btn sm" data-act="quick-range" data-route="' + route + '" data-v="all">كل الفترات</button>' +
      '<div class="spacer"></div><span class="tiny dim">' + U.dateAr(f.from) + ' → ' + U.dateAr(f.to) + '</span>' +
      '</div></div>' +
      '<div class="grid g-3">' + defs.map((d) =>
        '<section class="card hover"><div class="row gap-10">' +
        '<div class="thumb lg">' + d.icon + '</div>' +
        '<div class="grow"><div class="b">' + U.esc(d.title) + '</div>' +
        '<div class="tiny dim">' + U.num(counts[d.id]) + ' سجل</div></div>' +
        '<button class="btn sm primary" data-act="excel-one" data-v="' + d.id + '">📥 xlsx</button>' +
        '<button class="btn sm" data-act="csv-one" data-v="' + d.id + '">CSV</button>' +
        '</div></section>').join('') + '</div>' +
      '<div class="section-title"><h2>📤 الاستيراد</h2><div class="line"></div></div>' +
      '<div class="grid g-2">' +
      UI.card('استيراد المنتجات', '<p class="small muted">ارفع ملف Excel أو CSV بأعمدة: <b>الاسم، الكود، الباركود، القسم، سعر الشراء، سعر البيع، الكمية، الحد الأدنى، الضمان</b></p>' +
        '<div class="row gap-8 mt-8"><button class="btn primary sm" data-act="import-products">📤 اختيار ملف</button>' +
        '<button class="btn sm" data-act="import-template" data-v="products">📄 نموذج فارغ</button></div>') +
      UI.card('استيراد الزبائن', '<p class="small muted">ارفع ملف Excel أو CSV بأعمدة: <b>الاسم، الهاتف، العنوان، التصنيف</b></p>' +
        '<div class="row gap-8 mt-8"><button class="btn primary sm" data-act="import-customers">📤 اختيار ملف</button>' +
        '<button class="btn sm" data-act="import-template" data-v="customers">📄 نموذج فارغ</button></div>') +
      '</div>'
  });
};

const Exporter = {
  name(id, from, to){
    const d = Reports.defs[id];
    return 'بيتي — ' + (d ? d.title : id) + ' — ' + from + '_إلى_' + to;
  },
  one(id, from, to, q){
    const data = Reports.build(id, from, to, q);
    if (!data.rows.length){ UI.toast('لا توجد بيانات للتصدير', 'warn', 'غيّر الفترة أو أضف بيانات أولاً'); return; }
    XLSX.download(Exporter.name(id, from, to), [{ name: data.def.title, columns: data.columns, rows: data.rows, summary: data.summary }]);
    UI.toast('تم إنشاء ملف Excel', 'ok', data.rows.length + ' سجل');
  },
  csv(id, from, to, q){
    const data = Reports.build(id, from, to, q);
    const rows = data.rows.map((r) => { const o = {}; data.columns.forEach((c) => { o[c.title] = r[c.key]; }); return o; });
    U.download(Exporter.name(id, from, to) + '.csv', U.blob(U.toCsv(rows), 'text/csv;charset=utf-8'));
    UI.toast('تم التصدير بصيغة CSV', 'ok');
  },
  all(from, to){
    const defs = Object.values(Reports.defs);
    const sheets = defs.map((d) => {
      const data = Reports.build(d.id, from, to);
      return { name: d.title.slice(0, 28), columns: data.columns, rows: data.rows };
    }).filter((s) => s.rows.length);
    if (!sheets.length){ UI.toast('لا توجد بيانات', 'warn'); return; }
    XLSX.download('بيتي — تقرير شامل — ' + from + '_إلى_' + to, sheets, { summary: false });
    UI.toast('تم تصدير كل التقارير', 'ok', sheets.length + ' ورقة عمل');
  }
};

/* ---------------------------------------------------------------- مركز الطباعة */
Views.print = function(){
  const route = 'print';
  const f = F.get(route);
  const invs = DB.c('invoices').filter((v) => Engine.inRange(v.date, f.from, f.to)).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 60);
  const pays = DB.c('payments').filter((p) => Engine.inRange(p.date, f.from, f.to)).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 60);
  const cMap = DB.byId('customers');
  const docs = [
    { id: 'daily', ic: '📅', t: 'تقرير يومي', d: 'ملخّص مبيعات وأرباح وصندوق يوم محدد' },
    { id: 'monthly', ic: '📆', t: 'تقرير شهري', d: 'ملخّص الفترة مع الأقسام وأفضل الأصناف' },
    { id: 'installments', ic: '💳', t: 'كشف أقساط', d: 'كل العقود مع المتبقي والمتأخر' },
    { id: 'statement', ic: '📑', t: 'كشف حساب زبون', d: 'حركات زبون مع الرصيد الجاري' },
    { id: 'cashbox', ic: '💰', t: 'تقرير الصندوق', d: 'وارد ومنصرف يوم محدد' },
    { id: 'labels', ic: '🔖', t: 'ملصقات باركود', d: 'طباعة ملصقات المنتجات' }
  ];
  return UI.page({
    icon: '🖨️', title: 'مركز الطباعة', sub: 'كل المستندات جاهزة للطبع بمقاسات A4 / A5 / حراري 80 / 58 مم',
    body: '<div class="grid g-3 mb-16">' + docs.map((d) =>
      '<section class="card hover"><div class="row gap-10"><div class="thumb lg">' + d.ic + '</div>' +
      '<div class="grow"><div class="b">' + d.t + '</div><div class="tiny dim">' + d.d + '</div></div>' +
      '<button class="btn sm primary" data-act="print-doc" data-v="' + d.id + '">🖨️</button></div></section>').join('') + '</div>' +
      '<div class="grid g-2">' +
      UI.card('🧾 فواتير الفترة', UI.table({
        compact: true, maxHeight: '320px',
        columns: [
          { title: 'الرقم', render: (v) => '<span class="mono b">' + U.esc(v.no) + '</span>' },
          { title: 'الزبون', render: (v) => U.esc((cMap[v.customerId] || {}).name || 'نقدي') },
          { title: 'التاريخ', render: (v) => U.dateAr(v.date, { short: true }) },
          { title: 'الإجمالي', cls: 'num', render: (v) => U.money(v.total) },
          { title: '', cls: 'acts', render: (v) => V.rowMenu([{ act: 'invoice-print', id: v.id, icon: '🖨️', title: 'طباعة' }, { act: 'doc-preview', id: v.id, k: 'invoice', icon: '🔎', title: 'معاينة' }]) }
        ], rows: invs, empty: UI.empty('🧾', 'لا فواتير')
      })) +
      UI.card('💰 وصولات الفترة', UI.table({
        compact: true, maxHeight: '320px',
        columns: [
          { title: 'الوصل', render: (p) => '<span class="mono b">' + U.esc(p.no) + '</span>' },
          { title: 'الزبون', render: (p) => U.esc((cMap[p.customerId] || {}).name || '—') },
          { title: 'التاريخ', render: (p) => U.dateAr(p.date, { short: true }) },
          { title: 'المبلغ', cls: 'num', render: (p) => U.money(p.amount) },
          { title: '', cls: 'acts', render: (p) => V.rowMenu([{ act: 'payment-print', id: p.id, icon: '🖨️', title: 'طباعة' }]) }
        ], rows: pays, empty: UI.empty('💰', 'لا وصولات')
      })) +
      '</div>'
  });
};

/* ---------------------------------------------------------------- الذكاء */
Views.insights = function(){
  const list = Engine.insights(DB.state, U.today());
  const top30 = Engine.topProducts(DB.state, U.addDays(U.today(), -29), U.today(), 10);
  const dead = Engine.deadStock(DB.state).slice(0, 10);
  const reorder = Engine.reorderList(DB.state).slice(0, 10);
  const topC = Engine.topCustomers(DB.state, U.addDays(U.today(), -89), U.today(), 10);
  return UI.page({
    icon: '🧠', title: 'Smart Insights — ذكاء النظام', sub: 'تحليل تلقائي بلغة بسيطة',
    actions: '<button class="btn sm" data-act="go" data-route="reports">📊 التقارير</button>',
    body: '<div class="grid g-2 mb-16">' + list.map((i) =>
      '<section class="card hover"><div class="row gap-12"><div class="thumb lg">' + i.icon + '</div>' +
      '<div class="grow"><div class="b">' + U.esc(i.title) + '</div><div class="small muted">' + U.esc(i.text) + '</div></div></div></section>').join('') + '</div>' +
      '<div class="grid g-2">' +
      UI.card('🏆 الأكثر مبيعاً (30 يوم)', UI.table({
        compact: true,
        columns: [
          { title: '#', render: (p, i) => i + 1 },
          { title: 'الصنف', render: (p) => '<a href="#" data-act="product-open" data-id="' + p.id + '">' + U.esc(p.name) + '</a>' },
          { title: 'الكمية', cls: 'num', render: (p) => U.num(p.qty) },
          { title: 'المبيعات', cls: 'num', render: (p) => U.money(p.sales) },
          ...(Auth.can('act.cost') ? [{ title: 'الربح', cls: 'num', render: (p) => '<span style="color:var(--ok)">' + U.money(p.profit) + '</span>' }] : [])
        ], rows: top30, empty: UI.empty('🏆', 'لا مبيعات')
      })) +
      UI.card('⭐ أفضل الزبائن (90 يوم)', UI.table({
        compact: true,
        columns: [
          { title: '#', render: (c, i) => i + 1 },
          { title: 'الزبون', render: (c) => '<a href="#" data-act="open-customer" data-id="' + c.id + '">' + U.esc(c.name) + '</a>' },
          { title: 'الفواتير', cls: 'num', render: (c) => U.num(c.count) },
          { title: 'المشتريات', cls: 'num', render: (c) => U.money(c.sales) }
        ], rows: topC, empty: UI.empty('⭐', 'لا زبائن')
      })) +
      UI.card('💤 المنتجات الراكدة', UI.table({
        compact: true,
        columns: [
          { title: 'الصنف', render: (x) => U.esc(x.product.name) },
          { title: 'الكمية', cls: 'num', render: (x) => U.num(x.product.qty) },
          { title: 'القيمة', cls: 'num', render: (x) => U.money(x.value) }
        ], rows: dead, empty: UI.empty('💤', 'لا راكد')
      })) +
      UI.card('🔁 تحتاج إعادة طلب', UI.table({
        compact: true,
        columns: [
          { title: 'الصنف', render: (r) => U.esc(r.product.name) },
          { title: 'المتوفر', cls: 'num', render: (r) => U.num(r.product.qty) },
          { title: 'المطلوب', cls: 'num', render: (r) => '<b>' + U.num(r.need) + '</b>' },
          { title: 'التكلفة', cls: 'num', render: (r) => U.money(r.cost) }
        ], rows: reorder, empty: UI.empty('🔁', 'المخزون كافٍ')
      })) +
      '</div>'
  });
};
