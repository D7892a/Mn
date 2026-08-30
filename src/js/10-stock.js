/* ============================================================================
   10) المخزون: المنتجات، الأقسام، المخزون، الباركود، الأسعار،
       المشتريات والموردين
   ========================================================================== */
const Stock = {
  adjust(productId, newQty, note){
    const p = DB.get('products', productId);
    if (!p) return;
    const diff = Number(newQty) - Number(p.qty || 0);
    p.qty = Number(newQty);
    DB.c('stockMoves').unshift({ id: U.id('mv'), at: U.now(), productId, type: 'adjust', qty: diff, ref: '', note: note || 'تسوية جرد', userId: (Auth.user() || {}).id });
    DB.save();
    DB.log('تسوية مخزون', p.name, (diff >= 0 ? '+' : '') + diff, 'warn');
  },
  setPrice(productId, field, value, note){
    const p = DB.get('products', productId);
    if (!p) return;
    const from = Number(p[field]) || 0, to = Number(value) || 0;
    if (from === to) return;
    p[field] = to;
    DB.c('priceHistory').unshift({ id: U.id('ph'), date: U.today(), at: U.now(), productId, field, from, to, note: note || '', userId: (Auth.user() || {}).id });
    DB.save();
    DB.log('تغيير ' + (field === 'cost' ? 'كلفة' : 'سعر'), p.name, U.money(from) + ' ← ' + U.money(to), 'warn');
  },
  nextCode(){
    const nums = DB.c('products').map((p) => parseInt(String(p.code || '').replace(/\D/g, ''), 10)).filter((n) => isFinite(n));
    return 'P-' + String((nums.length ? Math.max.apply(null, nums) : 0) + 1).padStart(4, '0');
  },
  nextBarcode(){
    const n = DB.c('products').length + 1;
    return U.eanDigits('22' + String(n).padStart(6, '0'));
  }
};

/* ---------------------------------------------------------------- المنتجات */
CRUD.def('products', {
  title: 'المنتجات', one: 'منتج', icon: '📦', coll: 'products', perm: 'products',
  addLabel: 'منتج جديد', wide: true, searchPlaceholder: 'بحث بالاسم أو الكود أو الباركود…',
  searchKeys: ['name', 'code', 'barcode', 'brand', 'model'],
  chips: [{ id: '', label: 'الكل' }, { id: 'low', label: '⚠️ منخفض' }, { id: 'out', label: '⛔ نفد' }, { id: 'active', label: 'نشط' }],
  chipFilter: (p, chip) => chip === 'low' ? Number(p.qty) <= Number(p.minQty || 0) : chip === 'out' ? Number(p.qty) <= 0 : chip === 'active' ? p.active !== false : true,
  defaults: () => ({ qty: 0, minQty: 1, cost: 0, price: 0, warrantyMonths: S().warranty.defaultMonths || 12, active: true, code: Stock.nextCode(), barcode: Stock.nextBarcode() }),
  fields: (rec) => [
    { key: 'image', label: 'صورة المنتج', type: 'image' },
    { key: 'name', label: 'اسم المنتج', required: true, full: false },
    { key: 'code', label: 'الكود', value: Stock.nextCode() },
    { key: 'barcode', label: 'الباركود', value: Stock.nextBarcode() },
    { key: 'categoryId', label: 'القسم', type: 'select', placeholder: '— اختر —', options: DB.c('categories').map((c) => ({ value: c.id, label: (c.icon || '') + ' ' + c.name })) },
    { key: 'brand', label: 'الشركة / الماركة' },
    { key: 'model', label: 'الموديل' },
    { key: 'color', label: 'اللون' },
    { key: 'size', label: 'الحجم / السعة', placeholder: 'مثال: 18 قدم' },
    { key: 'unit', label: 'الوحدة', value: 'قطعة' },
    { key: 'cost', label: 'سعر الشراء', type: 'money', value: 0 },
    { key: 'price', label: 'سعر البيع', type: 'money', value: 0, hint: 'الهامش المستهدف ' + (S().sales.defaultMargin || 25) + '%' },
    { key: 'qty', label: 'الكمية', type: 'number', value: 0 },
    { key: 'minQty', label: 'الحد الأدنى', type: 'number', value: 1 },
    { key: 'warrantyMonths', label: 'الضمان (شهر)', type: 'number', value: S().warranty.defaultMonths || 12 },
    { key: 'active', label: '', type: 'check', checkLabel: 'منتج نشط (يظهر في نقطة البيع)', value: true },
    { key: 'notes', label: 'ملاحظات', type: 'textarea', full: true }
  ],
  formExtra: (rec) => rec && rec.cost ?
    '<div class="hint-box mt-12" id="marginHint">💰 الربح المتوقع: <b>' + U.money(Number(rec.price) - Number(rec.cost)) + '</b> — الهامش <b>' + U.pct(Engine.marginOf(rec), 1) + '</b></div>' : '',
  beforeSave: (data, old) => {
    if (!data.name || !String(data.name).trim()) return { error: 'اسم المنتج مطلوب' };
    const dup = DB.c('products').find((p) => p.id !== (old && old.id) && (String(p.barcode) === String(data.barcode) && data.barcode));
    if (dup) return { error: 'الباركود مستخدم في المنتج «' + dup.name + '»' };
    if (!old) return null;
    if (Number(old.cost) !== Number(data.cost)) Stock.logPrice(old.id, 'cost', old.cost, data.cost);
    if (Number(old.price) !== Number(data.price)) Stock.logPrice(old.id, 'price', old.price, data.price);
    if (Number(old.qty) !== Number(data.qty)){
      DB.c('stockMoves').unshift({ id: U.id('mv'), at: U.now(), productId: old.id, type: 'adjust', qty: Number(data.qty) - Number(old.qty), ref: '', note: 'تعديل يدوي', userId: (Auth.user() || {}).id });
    }
    return null;
  },
  sort: (a, b) => String(a.name).localeCompare(String(b.name), 'ar'),
  columns: [
    { title: 'المنتج', render: (p) => '<div class="row gap-8">' + V.productThumb(p) +
      '<div><a href="#" data-act="product-open" data-id="' + p.id + '" class="b">' + U.esc(p.name) + '</a>' +
      '<div class="tiny dim">' + U.esc(p.code || '') + (p.brand ? ' • ' + U.esc(p.brand) : '') + (p.model ? ' ' + U.esc(p.model) : '') + '</div></div></div>' },
    { title: 'القسم', render: (p) => { const c = DB.get('categories', p.categoryId); return c ? '<span class="badge" style="background:' + (c.color || '#eee') + '22;color:' + (c.color || '#333') + '">' + (c.icon || '') + ' ' + U.esc(c.name) + '</span>' : '<span class="dim">—</span>'; } },
    { title: 'الباركود', render: (p) => '<span class="mono tiny">' + U.esc(p.barcode || '—') + '</span>' },
    { title: 'الكلفة', cls: 'num', render: (p) => Auth.can('act.cost') ? U.money(p.cost) : '<span class="dim">—</span>' },
    { title: 'السعر', cls: 'num', render: (p) => '<b class="num">' + U.money(p.price) + '</b>' },
    { title: 'الربح', cls: 'num', render: (p) => Auth.can('act.cost') ? '<span class="num" style="color:var(--ok)">' + U.pct(Engine.marginOf(p), 0) + '</span>' : '<span class="dim">—</span>' },
    { title: 'الكمية', cls: 'num', render: (p) => {
      const q = Number(p.qty) || 0;
      const cls = q <= 0 ? 'danger' : q <= Number(p.minQty || 0) ? 'warn' : 'ok';
      return '<span class="badge ' + cls + '">' + U.num(q) + '</span>';
    } },
    { title: 'الضمان', cls: 'num', render: (p) => (p.warrantyMonths ? p.warrantyMonths + ' شهر' : '—') },
    { title: '', cls: 'acts', render: (p) => V.rowMenu([
      { act: 'product-open', id: p.id, icon: '👁️', title: 'الملف' },
      { act: 'stock-adjust', id: p.id, icon: '📊', title: 'تسوية الكمية' },
      { act: 'product-price', id: p.id, icon: '💲', title: 'تغيير السعر' },
      { act: 'label-one', id: p.id, icon: '🔖', title: 'ملصق باركود' },
      { act: 'crud-edit', k: 'products', id: p.id, icon: '✏️', title: 'تعديل' },
      { act: 'crud-del', k: 'products', id: p.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ],
  emptyIcon: '📦', emptyTitle: 'لا توجد منتجات', emptyText: 'أضف منتجاً أو استورد مئات المنتجات من ملف Excel.',
  emptyAction: '<button class="btn primary sm mt-8" data-act="crud-new" data-k="products">＋ منتج جديد</button>',
  exportSheet: true
});
Stock.logPrice = function(productId, field, from, to){
  DB.c('priceHistory').unshift({ id: U.id('ph'), date: U.today(), at: U.now(), productId, field, from: Number(from) || 0, to: Number(to) || 0, note: '', userId: (Auth.user() || {}).id });
};
Views.products = () => CRUD.page('products');

/* ملف المنتج */
Views['product-open'] = function(params){
  const p = DB.get('products', params && params.id);
  if (!p) return UI.page({ title: 'منتج غير موجود', body: UI.empty('📦', 'المنتج غير موجود') });
  const sales = Engine.productSales(DB.state, p.id, U.addDays(U.today(), -89), U.today());
  const moves = Engine.productMovements(DB.state, p.id).slice(0, 20);
  const hist = Engine.priceHistory(DB.state, p.id);
  const c = DB.get('categories', p.categoryId);
  return UI.page({
    icon: '📦', title: U.esc(p.name), sub: (p.code || '') + (p.barcode ? ' • باركود ' + p.barcode : ''),
    actions: '<button class="btn sm" data-act="crud-edit" data-k="products" data-id="' + p.id + '">✏️ تعديل</button>' +
      '<button class="btn sm" data-act="label-one" data-id="' + p.id + '">🔖 ملصق</button>' +
      '<button class="btn sm" data-act="stock-adjust" data-id="' + p.id + '">📊 تسوية</button>' +
      '<button class="btn primary sm" data-act="pos-add-direct" data-id="' + p.id + '">🛒 بيع</button>',
    body: '<div class="card mb-16"><div class="row gap-16 wrap">' +
      '<div class="thumb lg" style="width:96px;height:96px;font-size:34px">' + V.productIcon(p) + '</div>' +
      '<div class="grow"><h2>' + U.esc(p.name) + '</h2>' +
      '<div class="small muted">' + U.esc((c && c.name) || 'بدون قسم') + (p.brand ? ' • ' + U.esc(p.brand) : '') + (p.model ? ' • ' + U.esc(p.model) : '') + (p.color ? ' • ' + U.esc(p.color) : '') + (p.size ? ' • ' + U.esc(p.size) : '') + '</div></div>' +
      '<div class="row gap-16 wrap">' +
      '<div class="mid"><div class="tiny dim">السعر</div><div class="b num" style="color:var(--accent)">' + U.money(p.price) + '</div></div>' +
      (Auth.can('act.cost') ? '<div class="mid"><div class="tiny dim">الكلفة</div><div class="b num">' + U.money(p.cost) + '</div></div>' +
      '<div class="mid"><div class="tiny dim">الربح</div><div class="b num" style="color:var(--ok)">' + U.money(Engine.profitOf(p)) + ' (' + U.pct(Engine.marginOf(p), 0) + ')</div></div>' : '') +
      '<div class="mid"><div class="tiny dim">الكمية</div><div class="b num" style="color:' + (Number(p.qty) <= Number(p.minQty || 0) ? 'var(--danger)' : 'var(--ink)') + '">' + U.num(p.qty) + '</div></div>' +
      '</div></div></div>' +
      '<div class="grid g-4 mb-16">' +
      V.kpi({ icon: '📈', label: 'المبيعات (90 يوم)', value: U.money(sales.revenue), raw: sales.revenue, color: 'var(--accent)', foot: '<span>' + U.num(sales.qty) + ' قطعة</span>' }) +
      (Auth.can('act.cost') ? V.kpi({ icon: '💰', label: 'الربح (90 يوم)', value: U.money(sales.profit), raw: sales.profit, color: 'var(--ok)' }) : '') +
      V.kpi({ icon: '📦', label: 'قيمة المخزون', value: U.money((Number(p.qty) || 0) * (Number(p.cost) || 0)), color: 'var(--info)' }) +
      V.kpi({ icon: '🛡️', label: 'الضمان', value: (p.warrantyMonths || 0) + ' شهر', color: 'var(--violet)' }) +
      '</div>' +
      '<div class="grid g-2">' +
      UI.card('📈 تاريخ السعر', UI.table({
        compact: true,
        columns: [
          { title: 'التاريخ', render: (h) => V.dateCell(h.date) },
          { title: 'الحقل', render: (h) => h.field === 'cost' ? 'سعر الشراء' : 'سعر البيع' },
          { title: 'من', cls: 'num', render: (h) => U.money(h.from) },
          { title: 'إلى', cls: 'num', render: (h) => '<b>' + U.money(h.to) + '</b>' },
          { title: 'الفرق', cls: 'num', render: (h) => '<span style="color:' + (h.to >= h.from ? 'var(--ok)' : 'var(--danger)') + '">' + (h.to >= h.from ? '+' : '') + U.money(h.to - h.from) + '</span>' }
        ], rows: hist, empty: UI.empty('📈', 'لا تغييرات سعر مسجّلة')
      })) +
      UI.card('🔄 حركة المنتج', moves.length ? '<div class="timeline">' + moves.map((m) =>
        '<div class="tl-i"><div class="tl-t">' + ({ in: '📥 إدخال', out: '📤 بيع', adjust: '⚖️ تسوية', return: '↩️ مرتجع', purchase: '🏭 شراء' }[m.type] || m.type) +
        ' <span class="num" style="color:' + (m.qty >= 0 ? 'var(--ok)' : 'var(--danger)') + '">' + (m.qty > 0 ? '+' : '') + U.num(m.qty) + '</span></div>' +
        '<div class="tl-s">' + U.stampAr(m.at) + (m.ref ? ' • ' + U.esc(m.ref) : '') + (m.note ? ' • ' + U.esc(m.note) : '') + '</div></div>').join('') + '</div>' : UI.empty('🔄', 'لا حركة')) +
      '</div>'
  });
};

/* ---------------------------------------------------------------- الأقسام */
CRUD.def('categories', {
  title: 'الأقسام', one: 'قسم', icon: '🏷️', coll: 'categories', perm: 'categories',
  addLabel: 'قسم جديد', searchKeys: ['name'], filterBranch: false, per: 50,
  defaults: () => ({ icon: '📦', color: '#2563EB' }),
  fields: () => [
    { key: 'name', label: 'اسم القسم', required: true },
    { key: 'icon', label: 'الأيقونة', value: '📦' },
    { key: 'color', label: 'اللون', type: 'color', value: '#2563EB' }
  ],
  sort: (a, b) => String(a.name).localeCompare(String(b.name), 'ar'),
  columns: [
    { title: 'القسم', render: (c) => '<div class="row gap-8"><div class="thumb" style="background:' + (c.color || '#eee') + '22">' + (c.icon || '📦') + '</div><b>' + U.esc(c.name) + '</b></div>' },
    { title: 'عدد المنتجات', cls: 'num', render: (c) => U.num(DB.c('products').filter((p) => p.categoryId === c.id).length) },
    { title: 'قيمة المخزون', cls: 'num', render: (c) => V.money(U.sum(DB.c('products').filter((p) => p.categoryId === c.id), (p) => (Number(p.qty) || 0) * (Number(p.cost) || 0))) },
    { title: 'المبيعات (30 يوم)', cls: 'num', render: (c) => V.money(U.sum(Engine.byCategory(DB.state, U.addDays(U.today(), -29), U.today()).filter((x) => x.id === c.id), (x) => x.sales)) },
    { title: '', cls: 'acts', render: (c) => V.rowMenu([
      { act: 'crud-edit', k: 'categories', id: c.id, icon: '✏️', title: 'تعديل' },
      { act: 'crud-del', k: 'categories', id: c.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ],
  beforeDelete: (c) => DB.c('products').some((p) => p.categoryId === c.id) ? 'لا يمكن حذف قسم يحتوي منتجات' : null
});
Views.categories = () => CRUD.page('categories');

/* ---------------------------------------------------------------- المخزون */
Views.stock = function(){
  const route = 'stock';
  const f = F.get(route);
  const val = Engine.stockValue(DB.state);
  const low = Engine.lowStock(DB.state);
  let rows = DB.c('products').filter((p) => DB.inBranch(p));
  rows = rows.filter((p) => !f.q.trim() || U.has(p.name, f.q) || U.has(p.code, f.q) || U.has(p.barcode, f.q));
  if (f.chip === 'low') rows = rows.filter((p) => Number(p.qty) <= Number(p.minQty || 0));
  else if (f.chip === 'out') rows = rows.filter((p) => Number(p.qty) <= 0);
  else if (f.chip === 'over') rows = rows.filter((p) => Number(p.qty) > Number(p.minQty || 0));
  if (f.sort === 'value') rows.sort((a, b) => ((b.qty || 0) * (b.cost || 0)) - ((a.qty || 0) * (a.cost || 0)));
  else if (f.sort === 'qty') rows.sort((a, b) => (a.qty || 0) - (b.qty || 0));
  else rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
  return UI.page({
    icon: '📦', title: 'المخزون', sub: U.num(val.units) + ' قطعة • ' + DB.c('products').length + ' صنف',
    actions: '<button class="btn sm" data-act="stock-import">📤 استيراد Excel</button>' +
      '<button class="btn sm" data-act="stock-count">⚖️ جرد</button>' +
      '<button class="btn primary sm" data-act="crud-new" data-k="products">＋ منتج</button>',
    body: '<div class="grid g-4 mb-16">' +
      V.kpi({ icon: '💰', label: 'قيمة المخزون (كلفة)', value: U.money(val.cost), raw: val.cost, color: 'var(--accent)' }) +
      (Auth.can('act.cost') ? V.kpi({ icon: '🏷️', label: 'قيمة البيع', value: U.money(val.retail), raw: val.retail, color: 'var(--info)', foot: '<span>ربح متوقع ' + U.money(val.retail - val.cost) + '</span>' }) : '') +
      V.kpi({ icon: '⚠️', label: 'مخزون منخفض', value: U.num(low.length), raw: low.length, color: 'var(--warn)', route: 'stock', foot: '<span>يحتاج إعادة طلب</span>' }) +
      V.kpi({ icon: '⛔', label: 'أصناف نافدة', value: U.num(Engine.outOfStock(DB.state).length), color: 'var(--danger)' }) +
      '</div>' +
      F.bar(route, {
        placeholder: 'بحث في المخزون…', dateRange: false,
        chips: [{ id: '', label: 'الكل' }, { id: 'low', label: '⚠️ منخفض', count: low.length }, { id: 'out', label: '⛔ نافد' }, { id: 'over', label: 'متوفر' }],
        extra: '<select class="select" style="max-width:160px" data-act="sort-stock">' +
          '<option value="">ترتيب: الاسم</option><option value="qty" ' + (f.sort === 'qty' ? 'selected' : '') + '>الأقل كمية</option>' +
          '<option value="value" ' + (f.sort === 'value' ? 'selected' : '') + '>الأعلى قيمة</option></select>'
      }) +
      '<div class="card pad-0">' + UI.table({
        columns: [
          { title: 'الصنف', render: (p) => '<div class="row gap-8">' + V.productThumb(p) + '<div><a href="#" data-act="product-open" data-id="' + p.id + '" class="b">' + U.esc(p.name) + '</a><div class="tiny dim">' + U.esc(p.code || '') + '</div></div></div>' },
          { title: 'الكلفة', cls: 'num', render: (p) => Auth.can('act.cost') ? U.money(p.cost) : '—' },
          { title: 'السعر', cls: 'num', render: (p) => U.money(p.price) },
          { title: 'الكمية', cls: 'num', render: (p) => '<b class="num" style="color:' + (Number(p.qty) <= 0 ? 'var(--danger)' : Number(p.qty) <= Number(p.minQty || 0) ? 'var(--warn)' : 'var(--ok)') + '">' + U.num(p.qty) + '</b><div class="tiny dim">الحد ' + U.num(p.minQty || 0) + '</div>' },
          { title: 'القيمة', cls: 'num', render: (p) => Auth.can('act.cost') ? U.money((Number(p.qty) || 0) * (Number(p.cost) || 0)) : '—' },
          { title: 'الحالة', render: (p) => Number(p.qty) <= 0 ? '<span class="badge danger">نفد</span>' : Number(p.qty) <= Number(p.minQty || 0) ? '<span class="badge warn">منخفض</span>' : '<span class="badge ok">متوفر</span>' },
          { title: '', cls: 'acts', render: (p) => V.rowMenu([
            { act: 'stock-adjust', id: p.id, icon: '⚖️', title: 'تسوية' },
            { act: 'product-open', id: p.id, icon: '👁️', title: 'الملف' }
          ]) }
        ], rows: F.slice(rows, route, 30), empty: UI.empty('📦', 'لا منتجات')
      }) + F.pager(rows.length, route, 30) + '</div>'
  });
};

/* ---------------------------------------------------------------- الباركود */
Views.barcode = function(){
  const sel = App.barcodeSel || (App.barcodeSel = {});
  const prods = DB.c('products').filter((p) => !F.get('barcode').q.trim() || U.has(p.name, F.get('barcode').q) || U.has(p.code, F.get('barcode').q));
  const count = Object.keys(sel).filter((k) => sel[k]).length;
  return UI.page({
    icon: '🔖', title: 'ملصقات الباركود', sub: count + ' منتج محدّد — اختر المقاس وعدد النسخ ثم اطبع',
    actions: '<select class="select" id="lblSize" style="max-width:150px">' +
      ['48x22', '70x30', '90x40'].map((s) => '<option value="' + s + '"' + ((App.labelSize || '48x22') === s ? ' selected' : '') + '>' + s + ' مم</option>').join('') + '</select>' +
      '<input class="input" id="lblCopies" type="number" min="1" value="' + (App.labelCopies || 1) + '" style="max-width:90px" title="عدد النسخ">' +
      '<button class="btn primary sm" data-act="labels-print">🖨️ طباعة الملصقات</button>',
    body: '<div class="toolbar"><button class="btn sm" data-act="labels-all">تحديد الكل</button><button class="btn sm ghost" data-act="labels-none">إلغاء التحديد</button></div>' +
      '<div class="card pad-0">' + UI.table({
        columns: [
          { title: '', width: '44px', render: (p) => '<label class="check"><input type="checkbox" data-act="label-check" data-id="' + p.id + '" ' + (sel[p.id] ? 'checked' : '') + '></label>' },
          { title: 'المنتج', render: (p) => U.esc(p.name) },
          { title: 'الكود', render: (p) => '<span class="mono tiny">' + U.esc(p.code || '') + '</span>' },
          { title: 'الباركود', render: (p) => U.barcodeSvg(p.barcode || p.code, { width: 150, height: 30, fontSize: 9 }) },
          { title: 'السعر', cls: 'num', render: (p) => U.money(p.price) },
          { title: '', cls: 'acts', render: (p) => V.rowMenu([{ act: 'label-one', id: p.id, icon: '🖨️', title: 'طباعة ملصق واحد' }]) }
        ], rows: F.slice(prods, 'barcode', 30), empty: UI.empty('🔖', 'لا منتجات')
      }) + F.pager(prods.length, 'barcode', 30) + '</div>'
  });
};

/* ---------------------------------------------------------------- تغيرات الأسعار */
Views['price-changes'] = function(){
  const route = 'price-changes';
  const pMap = DB.byId('products');
  let rows = DB.c('priceHistory').slice();
  if (F.get(route).from) rows = rows.filter((h) => F.inRange(h.date, route));
  rows = rows.filter((h) => !F.get(route).q.trim() || U.has((pMap[h.productId] || {}).name, F.get(route).q));
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return UI.page({
    icon: '📈', title: 'تغيرات الأسعار', sub: 'سجل كل تغيير في سعر الشراء أو البيع',
    actions: '<button class="btn sm" data-act="export-price-changes">📥 Excel</button>',
    body: F.bar(route, { placeholder: 'بحث بالمنتج…' }) + '<div class="card pad-0">' + UI.table({
      columns: [
        { title: 'التاريخ', render: (h) => V.dateCell(h.date) + '<div class="tiny dim">' + U.timeAr(h.at) + '</div>' },
        { title: 'المنتج', render: (h) => U.esc((pMap[h.productId] || {}).name || '—') },
        { title: 'الحقل', render: (h) => h.field === 'cost' ? '<span class="badge info">سعر الشراء</span>' : '<span class="badge accent">سعر البيع</span>' },
        { title: 'من', cls: 'num', render: (h) => U.money(h.from) },
        { title: 'إلى', cls: 'num', render: (h) => '<b>' + U.money(h.to) + '</b>' },
        { title: 'التغيّر', cls: 'num', render: (h) => {
          const d = (Number(h.to) || 0) - (Number(h.from) || 0);
          const pctv = h.from ? (d / h.from) * 100 : 0;
          return '<span style="color:' + (d >= 0 ? 'var(--ok)' : 'var(--danger)') + '">' + (d >= 0 ? '▲ +' : '▼ ') + U.money(d) + ' (' + U.pct(pctv, 0) + ')</span>';
        } },
        { title: 'بواسطة', render: (h) => '<span class="tiny dim">' + U.esc((DB.get('users', h.userId) || {}).name || '—') + '</span>' }
      ], rows: F.slice(rows, route, 30), empty: UI.empty('📈', 'لا تغييرات', 'عند تعديل سعر أي منتج سيُسجَّل هنا مع التاريخ.')
    }) + F.pager(rows.length, route, 30) + '</div>'
  });
};

/* ---------------------------------------------------------------- المنتجات الراكدة */
Views['dead-stock'] = function(){
  const days = S().stock.deadStockDays || 90;
  const list = Engine.deadStock(DB.state, days);
  return UI.page({
    icon: '💤', title: 'المنتجات الراكدة', sub: 'لم تُبع منذ ' + days + ' يوماً',
    actions: '<button class="btn sm" data-act="crud-new" data-k="offers">🏷️ إنشاء عرض</button>',
    body: '<div class="grid g-3 mb-16">' +
      V.kpi({ icon: '💤', label: 'أصناف راكدة', value: U.num(list.length), raw: list.length, color: 'var(--warn)' }) +
      V.kpi({ icon: '💰', label: 'قيمة راكدة', value: U.money(U.sum(list, (x) => x.value)), color: 'var(--danger)' }) +
      V.kpi({ icon: '📦', label: 'إجمالي الأصناف', value: U.num(DB.c('products').length), color: 'var(--accent)' }) +
      '</div>' +
      '<div class="card pad-0">' + UI.table({
        columns: [
          { title: 'المنتج', render: (x) => '<div class="row gap-8">' + V.productThumb(x.product) + '<a href="#" data-act="product-open" data-id="' + x.product.id + '" class="b">' + U.esc(x.product.name) + '</a></div>' },
          { title: 'الكمية', cls: 'num', render: (x) => U.num(x.product.qty) },
          { title: 'القيمة', cls: 'num', render: (x) => U.money(x.value) },
          { title: 'آخر حركة', render: (x) => V.dateCell(String(x.since || '').slice(0, 10)) + ' <span class="tiny dim">' + U.rel(String(x.since || '').slice(0, 10)) + '</span>' },
          { title: 'اقتراح', render: (x) => '<span class="tiny muted">خصم 10% ← ' + U.money(U.round(Number(x.product.price) * 0.9, S().sales.roundTo || 250)) + '</span>' },
          { title: '', cls: 'acts', render: (x) => V.rowMenu([
            { act: 'product-price', id: x.product.id, icon: '💲', title: 'تغيير السعر' },
            { act: 'crud-edit', k: 'products', id: x.product.id, icon: '✏️', title: 'تعديل' }
          ]) }
        ], rows: list, empty: UI.empty('💤', 'لا منتجات راكدة', 'كل الأصناف تحرّكت خلال الفترة المحددة — أداء ممتاز!')
      }) + '</div>'
  });
};

/* ---------------------------------------------------------------- حركة المخزون */
Views['stock-moves'] = function(){
  const route = 'stock-moves';
  const pMap = DB.byId('products');
  let rows = DB.c('stockMoves').slice();
  if (F.get(route).from) rows = rows.filter((m) => F.inRange(String(m.at).slice(0, 10), route));
  rows = rows.filter((m) => !F.get(route).q.trim() || U.has((pMap[m.productId] || {}).name, F.get(route).q) || U.has(m.ref, F.get(route).q));
  if (F.get(route).chip) rows = rows.filter((m) => m.type === F.get(route).chip);
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return UI.page({
    icon: '🔄', title: 'حركة المخزون', sub: 'كل إدخال وإخراج وتسوية',
    actions: '<button class="btn sm" data-act="stock-count">⚖️ جرد</button>',
    body: F.bar(route, {
      placeholder: 'بحث بالمنتج أو المرجع…',
      chips: [{ id: '', label: 'الكل' }, { id: 'out', label: '📤 مبيعات' }, { id: 'in', label: '📥 إدخال' }, { id: 'purchase', label: '🏭 مشتريات' }, { id: 'adjust', label: '⚖️ تسويات' }, { id: 'return', label: '↩️ مرتجعات' }]
    }) + '<div class="card pad-0">' + UI.table({
      columns: [
        { title: 'التاريخ', render: (m) => V.dateCell(String(m.at).slice(0, 10)) + '<div class="tiny dim">' + U.timeAr(m.at) + '</div>' },
        { title: 'المنتج', render: (m) => '<a href="#" data-act="product-open" data-id="' + m.productId + '" class="b">' + U.esc((pMap[m.productId] || {}).name || '—') + '</a>' },
        { title: 'النوع', render: (m) => '<span class="badge ' + ({ out: 'info', in: 'ok', purchase: 'accent', adjust: 'warn', return: 'danger' }[m.type] || '') + '">' + ({ in: 'إدخال', out: 'بيع', adjust: 'تسوية', return: 'مرتجع', purchase: 'شراء' }[m.type] || m.type) + '</span>' },
        { title: 'الكمية', cls: 'num', render: (m) => '<b style="color:' + (m.qty >= 0 ? 'var(--ok)' : 'var(--danger)') + '">' + (m.qty > 0 ? '+' : '') + U.num(m.qty) + '</b>' },
        { title: 'المرجع', render: (m) => '<span class="mono tiny">' + U.esc(m.ref || '—') + '</span>' },
        { title: 'ملاحظة', render: (m) => '<span class="tiny muted">' + U.esc(m.note || '') + '</span>' }
      ], rows: F.slice(rows, route, 40), empty: UI.empty('🔄', 'لا حركة مخزون')
    }) + F.pager(rows.length, route, 40) + '</div>'
  });
};

/* ============================================================================
   الموردين والمشتريات
   ========================================================================== */
CRUD.def('suppliers', {
  title: 'الموردين', one: 'مورد', icon: '🏭', coll: 'suppliers', perm: 'suppliers',
  addLabel: 'مورد جديد', searchKeys: ['name', 'phone', 'company'], filterBranch: false,
  fields: () => [
    { key: 'name', label: 'اسم المورد / الشركة', required: true },
    { key: 'phone', label: 'الهاتف' },
    { key: 'contact', label: 'الشخص المسؤول' },
    { key: 'company', label: 'الشركة المصنّعة' },
    { key: 'address', label: 'العنوان', full: true },
    { key: 'notes', label: 'ملاحظات', type: 'textarea', full: true }
  ],
  columns: [
    { title: 'المورد', render: (s) => '<b>' + U.esc(s.name) + '</b>' + (s.company ? '<div class="tiny dim">' + U.esc(s.company) + '</div>' : '') },
    { title: 'الهاتف', render: (s) => '<span class="mono">' + U.esc(s.phone || '—') + '</span>' },
    { title: 'المسؤول', render: (s) => U.esc(s.contact || '—') },
    { title: 'المشتريات', cls: 'num', render: (s) => V.money(Engine.supplierBalance(DB.state, s.id).bought) },
    { title: 'المدفوع', cls: 'num', render: (s) => '<span style="color:var(--ok)">' + U.money(Engine.supplierBalance(DB.state, s.id).paid) + '</span>' },
    { title: 'المتبقي', cls: 'num', render: (s) => { const b = Engine.supplierBalance(DB.state, s.id); return b.remaining > 0 ? '<b style="color:var(--danger)">' + U.money(b.remaining) + '</b>' : '<span class="badge ok">مسدّد</span>'; } },
    { title: '', cls: 'acts', render: (s) => V.rowMenu([
      { act: 'supplier-pay', id: s.id, icon: '💰', title: 'دفعة' },
      { act: 'supplier-statement', id: s.id, icon: '📑', title: 'كشف حساب' },
      { act: 'crud-edit', k: 'suppliers', id: s.id, icon: '✏️', title: 'تعديل' },
      { act: 'crud-del', k: 'suppliers', id: s.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ],
  exportSheet: true
});
Views.suppliers = () => CRUD.page('suppliers');

Views['supplier-accounts'] = function(){
  const list = DB.c('suppliers').map((s) => ({ s, b: Engine.supplierBalance(DB.state, s.id) })).sort((a, b) => b.b.remaining - a.b.remaining);
  const total = U.sum(list, (x) => x.b.remaining);
  return UI.page({
    icon: '💰', title: 'حسابات الموردين', sub: 'إجمالي المستحق ' + U.money(total),
    actions: '<button class="btn primary sm" data-act="crud-new" data-k="purchases">＋ فاتورة شراء</button>',
    body: '<div class="grid g-3 mb-16">' +
      V.kpi({ icon: '🏭', label: 'عدد الموردين', value: U.num(list.length), raw: list.length, color: 'var(--accent)' }) +
      V.kpi({ icon: '🛒', label: 'إجمالي المشتريات', value: U.money(U.sum(list, (x) => x.b.bought)), color: 'var(--info)' }) +
      V.kpi({ icon: '💳', label: 'المستحق للموردين', value: U.money(total), raw: total, color: 'var(--danger)' }) +
      '</div>' +
      '<div class="card pad-0">' + UI.table({
        columns: [
          { title: 'المورد', render: (x) => '<b>' + U.esc(x.s.name) + '</b>' },
          { title: 'المشتريات', cls: 'num', render: (x) => V.money(x.b.bought) },
          { title: 'المدفوع', cls: 'num', render: (x) => V.money(x.b.paid) },
          { title: 'المتبقي', cls: 'num', render: (x) => '<b style="color:var(--danger)">' + U.money(x.b.remaining) + '</b>' },
          { title: 'آخر فاتورة', render: (x) => { const p = DB.c('purchases').filter((pp) => pp.supplierId === x.s.id).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]; return p ? V.dateCell(p.date) : '<span class="dim">—</span>'; } },
          { title: '', cls: 'acts', render: (x) => V.rowMenu([
            { act: 'supplier-pay', id: x.s.id, icon: '💰', title: 'دفعة' },
            { act: 'supplier-statement', id: x.s.id, icon: '📑', title: 'كشف' }
          ]) }
        ], rows: list, empty: UI.empty('🏭', 'لا موردين')
      }) + '</div>'
  });
};

CRUD.def('purchases', {
  title: 'المشتريات', one: 'فاتورة شراء', icon: '📥', coll: 'purchases', perm: 'purchases',
  addLabel: 'فاتورة شراء', wide: true, searchKeys: ['no'], dateField: 'date',
  defaults: () => ({ date: U.today(), items: [], paid: 0, status: 'active' }),
  fields: () => [
    { key: 'no', label: 'رقم الفاتورة', value: 'PUR-' + String((DB.state.counters.purchase || 0) + 1).padStart(4, '0') },
    { key: 'date', label: 'التاريخ', type: 'date', value: U.today() },
    { key: 'supplierId', label: 'المورد', type: 'select', required: true, placeholder: '— اختر —', options: DB.c('suppliers').map((s) => ({ value: s.id, label: s.name })) },
    { key: 'paid', label: 'المدفوع', type: 'money', value: 0 },
    { key: 'note', label: 'ملاحظات', type: 'textarea', full: true }
  ],
  formExtra: () => '<div class="divider"></div><h3 class="mb-8">الأصناف المشتراة</h3><div class="hint-box mb-8">ℹ️ عند الحفظ تُضاف الكميات إلى المخزون وتُحدَّث كلفة المنتج (متوسط مرجّح) تلقائياً، وأي صنف غير موجود يُنشأ تلقائياً.</div><div id="itemsEditor"></div>',
  onOpen: (ctx) => ItemsEditor.paint(ctx, { priceKey: 'cost', priceLabel: 'كلفة الوحدة' }),
  beforeSave: () => null,
  afterSave: (rec, old, ctxData) => {
    if (old) return;
    const items = (ctxData && ctxData.items) || [];
    if (!items.length) return;
    Purchases.apply(rec, items);
  },
  columns: [
    { title: 'الرقم', render: (p) => '<span class="mono b">' + U.esc(p.no) + '</span>' },
    { title: 'التاريخ', render: (p) => V.dateCell(p.date) },
    { title: 'المورد', render: (p) => U.esc((DB.get('suppliers', p.supplierId) || {}).name || '—') },
    { title: 'الأصناف', cls: 'num', render: (p) => U.num(U.sum(p.items || [], (i) => i.qty)) },
    { title: 'الإجمالي', cls: 'num', render: (p) => V.money(p.total) },
    { title: 'المدفوع', cls: 'num', render: (p) => V.money(p.paid) },
    { title: 'المتبقي', cls: 'num', render: (p) => { const r = Math.max(0, (Number(p.total) || 0) - (Number(p.paid) || 0)); return r ? '<b style="color:var(--danger)">' + U.money(r) + '</b>' : '<span class="badge ok">مسدّد</span>'; } },
    { title: '', cls: 'acts', render: (p) => V.rowMenu([
      { act: 'purchase-print', id: p.id, icon: '🖨️', title: 'طباعة' },
      { act: 'supplier-pay', id: p.supplierId, icon: '💰', title: 'دفعة' },
      { act: 'crud-del', k: 'purchases', id: p.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ],
  onDelete: (rec) => {
    (rec.items || []).forEach((it) => {
      const p = DB.get('products', it.productId);
      if (p){ p.qty = Math.max(0, Number(p.qty || 0) - Number(it.qty || 0)); DB.c('stockMoves').unshift({ id: U.id('mv'), at: U.now(), productId: p.id, type: 'adjust', qty: -Number(it.qty || 0), ref: rec.no, note: 'حذف فاتورة شراء' }); }
    });
  }
});
Views.purchases = () => CRUD.page('purchases');
Views['purchase-invoices'] = () => CRUD.page('purchases');

const Purchases = {
  /* حفظ فاتورة شراء مع تحميل المخزون */
  apply(rec, items){
    const list = (items || []).filter((i) => Number(i.qty) > 0);
    const total = U.sum(list, (i) => (Number(i.qty) || 0) * (Number(i.cost) || 0));
    DB.update('purchases', rec.id, { items: list, total });
    /* الدفعة المسجّلة على فاتورة الشراء تُقيَّد كدفعة مورد حتى تتطابق الأرصدة والصندوق */
    const paidAmt = Number(rec.paid) || 0;
    if (paidAmt > 0 && !DB.c('supplierPayments').some((x) => x.purchaseId === rec.id)){
      DB.add('supplierPayments', {
        no: DB.docNo('SP', 'supplierPayment'), date: rec.date || U.today(), supplierId: rec.supplierId,
        amount: paidAmt, note: 'دفعة على فاتورة الشراء ' + (rec.no || ''), purchaseId: rec.id
      });
    }
    list.forEach((it) => {
      let p = it.productId ? DB.get('products', it.productId) : null;
      if (!p){
        p = DB.add('products', {
          name: it.name || 'صنف جديد', code: Stock.nextCode(), barcode: Stock.nextBarcode(),
          cost: Number(it.cost) || 0, price: Engine.suggestPrice(Number(it.cost) || 0, S().sales.defaultMargin || 25),
          qty: 0, minQty: 1, warrantyMonths: S().warranty.defaultMonths || 12, active: true
        });
        DB.update('purchases', rec.id, {});
      }
      const oldQty = Number(p.qty) || 0, oldCost = Number(p.cost) || 0;
      const newQty = oldQty + Number(it.qty);
      /* متوسط الكلفة المرجّح */
      const avg = newQty > 0 ? ((oldQty * oldCost) + (Number(it.qty) * Number(it.cost))) / newQty : Number(it.cost) || 0;
      p.qty = newQty;
      if (Math.abs(avg - oldCost) > 0.5){ Stock.logPrice(p.id, 'cost', oldCost, Math.round(avg)); p.cost = Math.round(avg); }
      DB.c('stockMoves').unshift({ id: U.id('mv'), at: U.now(), productId: p.id, type: 'purchase', qty: Number(it.qty), ref: rec.no, note: 'شراء' });
    });
    DB.save();
    DB.log('فاتورة شراء', rec.no, U.money(total), 'ok');
    return total;
  }
};
