/* ============================================================================
   13) الإدارة — مركز التحكم الكامل بالنظام
   ========================================================================== */
const Admin = {
  tabs: [
    { id: 'store', t: '🏪 بيانات المحل', perm: 'admin' },
    { id: 'appearance', t: '🎨 تخصيص النظام', perm: 'admin' },
    { id: 'sales', t: '💰 إعدادات البيع', perm: 'admin' },
    { id: 'installments', t: '💳 إعدادات الأقساط', perm: 'admin' },
    { id: 'invoice', t: '🧾 إعدادات الفاتورة', perm: 'admin' },
    { id: 'print', t: '🖨️ إعدادات الطباعة', perm: 'admin' },
    { id: 'branches', t: '🏬 الفروع', perm: 'admin' },
    { id: 'offers', t: '🏷️ العروض', perm: 'admin' },
    { id: 'users', t: '👨‍💼 المستخدمون', perm: 'act.users' },
    { id: 'security', t: '🔐 الأمان والجلسات', perm: 'act.users' },
    { id: 'audit', t: '🕵️ سجل العمليات', perm: 'admin' },
    { id: 'backup', t: '💾 النسخ الاحتياطي', perm: 'act.backup' },
    { id: 'about', t: 'ℹ️ عن النظام', perm: 'admin' }
  ],
  get(path){
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), DB.state.settings);
  },
  set(path, value){
    const parts = path.split('.');
    let o = DB.state.settings;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  },
  field(path, label, opt){
    opt = opt || {};
    const v = Admin.get(path);
    const id = 'set_' + path.replace(/\./g, '_');
    let input = '';
    if (opt.type === 'select'){
      input = '<select class="select" data-set="' + path + '" data-type="string" id="' + id + '">' +
        opt.options.map((o) => '<option value="' + U.attr(o.value) + '" ' + (String(o.value) === String(v) ? 'selected' : '') + '>' + U.esc(o.label) + '</option>').join('') + '</select>';
    } else if (opt.type === 'textarea'){
      input = '<textarea class="textarea" data-set="' + path + '" data-type="string" id="' + id + '">' + U.esc(v || '') + '</textarea>';
    } else if (opt.type === 'switch'){
      input = '<label class="switch"><input type="checkbox" data-set="' + path + '" data-type="bool" id="' + id + '" ' + (v ? 'checked' : '') + '><i></i></label>';
    } else if (opt.type === 'logo'){
      input = '<div class="row gap-8"><div class="thumb lg" id="logoPrev">' + (v ? '<img src="' + U.esc(v) + '">' : '🏪') + '</div>' +
        '<input type="hidden" data-set="' + path + '" data-type="string" id="' + id + '" value="' + U.attr(v || '') + '">' +
        '<button class="btn sm" data-act="pick-logo">📷 اختيار شعار</button>' +
        (v ? '<button class="btn sm ghost" data-act="clear-logo">حذف</button>' : '') + '</div>';
    } else {
      const t = opt.type === 'number' || opt.type === 'money' ? 'number' : opt.type || 'text';
      input = '<input class="input" data-set="' + path + '" data-type="' + (t === 'number' ? 'number' : 'string') + '" id="' + id + '" type="' + t + '" value="' + U.attr(v == null ? '' : v) + '"' +
        (opt.step ? ' step="' + opt.step + '"' : '') + (opt.min != null ? ' min="' + opt.min + '"' : '') + (opt.max != null ? ' max="' + opt.max + '"' : '') + '>';
      if (opt.type === 'money') input = '<div class="input-group">' + input + '<span class="addon">' + U.esc(S().locale.currencySymbol) + '</span></div>';
    }
    if (opt.type === 'switch'){
      return '<div class="setting-row"><div><div class="sr-t">' + U.esc(label) + '</div>' + (opt.hint ? '<div class="sr-s">' + U.esc(opt.hint) + '</div>' : '') + '</div><div class="sr-c">' + input + '</div></div>';
    }
    return '<div class="field' + (opt.full ? ' full' : '') + '"><label for="' + id + '">' + U.esc(label) + '</label>' + input +
      (opt.hint ? '<span class="hint">' + U.esc(opt.hint) + '</span>' : '') + '</div>';
  },
  save(rootEl){
    const nodes = U.$$('[data-set]', rootEl);
    let n = 0;
    nodes.forEach((el) => {
      const path = el.getAttribute('data-set');
      const type = el.getAttribute('data-type');
      let val;
      if (type === 'bool') val = !!el.checked;
      else if (type === 'number') val = el.value === '' ? 0 : Number(el.value) || 0;
      else val = el.value;
      Admin.set(path, val); n++;
    });
    DB.save(true);
    DB.log('تعديل الإعدادات', n + ' بند', '', 'warn');
    App.applySettings();
    UI.toast('تم حفظ الإعدادات', 'ok', n + ' بند');
    App.render();
  }
};

Views.admin = function(params){
  if (!Auth.canAny(['admin', 'act.users', 'act.backup'])){
    return UI.page({ icon: '⚙️', title: 'الإدارة', body: UI.empty('🔐', 'صلاحية غير كافية', 'هذه الصفحة متاحة للمدير فقط.') });
  }
  const tab = (params && params.tab) || App.adminTab || 'store';
  App.adminTab = tab;
  const tabs = '<div class="tabs">' + Admin.tabs.filter((t) => Auth.can(t.perm)).map((t) =>
    '<button class="tab ' + (tab === t.id ? 'on' : '') + '" data-act="admin-tab" data-v="' + t.id + '">' + t.t + '</button>').join('') + '</div>';
  const save = '<div class="row gap-8 mt-16"><button class="btn primary" data-act="admin-save">💾 حفظ الإعدادات</button>' +
    '<button class="btn ghost" data-act="admin-reset-form">تراجع</button></div>';
  let panel = '';

  if (tab === 'store'){
    panel = '<div class="card"><div class="card-h"><h3>🏪 بيانات المحل</h3><span class="sub">تظهر في الفواتير والمستندات</span></div>' +
      '<div class="form-grid">' +
      Admin.field('store.name', 'اسم المحل', { required: true }) +
      Admin.field('store.subtitle', 'الوصف المختصر') +
      Admin.field('store.manager', 'اسم المسؤول') +
      Admin.field('store.phone', 'الهاتف') +
      Admin.field('store.email', 'البريد الإلكتروني') +
      Admin.field('store.taxNo', 'الرقم الضريبي') +
      Admin.field('store.address', 'العنوان', { full: true }) +
      Admin.field('store.logo', 'الشعار', { type: 'logo', full: true }) +
      Admin.field('store.invoiceFooter', 'العبارة السفلية في الفاتورة', { type: 'textarea', full: true }) +
      Admin.field('store.saleTerms', 'شروط البيع بالتقسيط', { type: 'textarea', full: true }) +
      Admin.field('store.returnTerms', 'شروط الإرجاع', { type: 'textarea', full: true }) +
      '</div>' + save + '</div>';
  } else if (tab === 'appearance'){
    const accents = [['blue', '#2563EB'], ['emerald', '#059669'], ['violet', '#7C3AED'], ['rose', '#E11D48'], ['amber', '#D97706'], ['slate', '#334155']];
    panel = '<div class="grid g-2">' +
      '<div class="card"><div class="card-h"><h3>🎨 المظهر</h3></div>' +
      '<div class="setting-row"><div><div class="sr-t">الوضع الليلي</div><div class="sr-s">يُحفظ اختيارك على هذا الجهاز</div></div>' +
      '<div class="sr-c"><label class="switch"><input type="checkbox" data-act="theme-toggle" ' + (S().ui.theme === 'dark' ? 'checked' : '') + '><i></i></label></div></div>' +
      '<div class="setting-row"><div><div class="sr-t">اللون الرئيسي</div><div class="sr-s">يؤثر على الأزرار والمؤشرات</div></div>' +
      '<div class="sr-c"><div class="color-dots">' + accents.map((a) =>
        '<div class="color-dot ' + (S().ui.accent === a[0] ? 'on' : '') + '" style="background:' + a[1] + '" data-act="accent" data-v="' + a[0] + '" title="' + a[0] + '"></div>').join('') + '</div></div></div>' +
      '<div class="setting-row"><div><div class="sr-t">حجم الخط</div></div><div class="sr-c"><div class="btn-group">' +
      [['s', 'صغير'], ['m', 'متوسط'], ['l', 'كبير'], ['xl', 'أكبر']].map((o) => '<button data-act="fontsize" data-v="' + o[0] + '" class="' + (S().ui.fontSize === o[0] ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</div></div></div>' +
      '<div class="setting-row"><div><div class="sr-t">كثافة العرض</div><div class="sr-s">تقليل المسافات لعرض بيانات أكثر</div></div><div class="sr-c"><div class="btn-group">' +
      [['normal', 'مريح'], ['compact', 'مضغوط']].map((o) => '<button data-act="density" data-v="' + o[0] + '" class="' + ((S().ui.density || 'normal') === o[0] ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</div></div></div>' +
      '<div class="setting-row"><div><div class="sr-t">أصوات نقطة البيع</div><div class="sr-s">صوت عند إضافة صنف</div></div>' +
      '<div class="sr-c"><label class="switch"><input type="checkbox" data-act="sounds-toggle" ' + (S().ui.sounds ? 'checked' : '') + '><i></i></label></div></div>' +
      '</div>' +
      '<div class="card"><div class="card-h"><h3>🌐 اللغة والعملة</h3></div><div class="form-grid">' +
      Admin.field('locale.currency', 'العملة', { type: 'select', options: [{ value: 'IQD', label: 'دينار عراقي (IQD)' }, { value: 'USD', label: 'دولار (USD)' }, { value: 'SYP', label: 'ليرة سورية' }, { value: 'EGP', label: 'جنيه مصري' }] }) +
      Admin.field('locale.currencySymbol', 'رمز العملة', { hint: 'مثال: د.ع' }) +
      Admin.field('locale.country', 'الدولة') +
      '</div>' + save + '</div></div>';
  } else if (tab === 'sales'){
    panel = '<div class="card"><div class="card-h"><h3>💰 إعدادات البيع</h3><span class="sub">تُطبَّق على نقطة البيع والفواتير</span></div>' +
      '<div class="form-grid">' +
      Admin.field('sales.defaultMargin', 'نسبة الربح الافتراضية %', { type: 'number', hint: 'محسوبة على سعر البيع — كل 100,000 بيع = 25,000 ربح' }) +
      Admin.field('sales.roundTo', 'تقريب الأسعار إلى', { type: 'number', step: 50, hint: 'مثال: 250' }) +
      Admin.field('sales.taxRate', 'نسبة الضريبة %', { type: 'number', step: 0.5 }) +
      Admin.field('sales.maxDiscount', 'الحد الأقصى للخصم %', { type: 'number' }) +
      Admin.field('sales.allowDiscount', 'السماح بالخصم', { type: 'switch' }) +
      Admin.field('sales.askSerial', 'طلب الرقم التسلسلي', { type: 'switch' }) +
      Admin.field('sales.autoWarranty', 'إنشاء ضمان تلقائي عند البيع', { type: 'switch' }) +
      Admin.field('warranty.defaultMonths', 'مدة الضمان الافتراضية (شهر)', { type: 'number' }) +
      Admin.field('stock.deadStockDays', 'اعتبار المنتج راكداً بعد (يوم)', { type: 'number' }) +
      Admin.field('stock.lowStockAlert', 'تنبيه المخزون المنخفض', { type: 'switch' }) +
      '</div>' +
      '<div class="hint-box mt-12">💡 مثال: كلفة 750,000 ونسبة ربح 25% ← سعر البيع المقترح <b>' + U.money(Engine.suggestPrice(750000, 25)) + '</b> وربح <b>' + U.money(Engine.suggestPrice(750000, 25) - 750000) + '</b> لكل 1,000,000 بيع.</div>' +
      save + '</div>';
  } else if (tab === 'installments'){
    panel = '<div class="card"><div class="card-h"><h3>💳 إعدادات الأقساط</h3></div>' +
      '<div class="form-grid">' +
      Admin.field('installments.minDownPercent', 'الحد الأدنى للدفعة الأولى %', { type: 'number' }) +
      Admin.field('installments.requireDown', 'إلزام الدفعة الأولى', { type: 'switch' }) +
      Admin.field('installments.dueDay', 'يوم الاستحقاق الافتراضي', { type: 'number', min: 1, max: 28 }) +
      Admin.field('installments.maxMonths', 'أقصى عدد أشهر', { type: 'number' }) +
      Admin.field('installments.firstDueSameMonth', 'القسط الأول في نفس الشهر إن أمكن', { type: 'switch', hint: 'إذا أُطفئ: أول قسط يبدأ الشهر القادم' }) +
      Admin.field('installments.lateGraceDays', 'أيام السماح قبل اعتبار القسط متأخراً', { type: 'number' }) +
      Admin.field('installments.alertDays', 'تنبيه قبل الاستحقاق بـ (يوم)', { type: 'number' }) +
      Admin.field('installments.suspendOnOverdue', 'إيقاف البيع بالتقسيط عند التأخر', { type: 'switch' }) +
      Admin.field('warranty.alertDays', 'تنبيه انتهاء الضمان قبل (يوم)', { type: 'number' }) +
      '</div>' +
      '<div class="divider"></div><h3 class="mb-8">الأشهر المتاحة في نقطة البيع</h3>' +
      '<div class="chips" id="monthChips">' + (S().installments.months || []).map((m) => '<span class="chip on">' + m + ' ✕</span>').join('') + '</div>' +
      '<div class="row gap-8 mt-8"><input class="input" id="newMonth" type="number" min="1" max="60" placeholder="عدد أشهر" style="max-width:140px">' +
      '<button class="btn sm" data-act="add-month">＋ إضافة</button></div>' +
      save + '</div>';
  } else if (tab === 'invoice'){
    panel = '<div class="card"><div class="card-h"><h3>🧾 إعدادات الفاتورة</h3>' +
      '<div class="acts"><button class="btn sm" data-act="invoice-sample">🔎 معاينة نموذج</button></div></div>' +
      '<div class="form-grid">' +
      Admin.field('invoice.size', 'مقاس الفاتورة', { type: 'select', options: [{ value: 'A4', label: 'A4' }, { value: 'A5', label: 'A5' }, { value: 'T80', label: 'حراري 80 مم' }, { value: 'T58', label: 'حراري 58 مم' }] }) +
      Admin.field('invoice.title', 'عنوان الفاتورة') +
      Admin.field('invoice.accent', 'لون المستند', { type: 'color' }) +
      Admin.field('invoice.copies', 'عدد النسخ', { type: 'number', min: 1 }) +
      Admin.field('invoice.signature', 'اسم الموقّع') +
      Admin.field('invoice.showLogo', 'إظهار الشعار', { type: 'switch' }) +
      Admin.field('invoice.showBarcode', 'إظهار الباركود', { type: 'switch' }) +
      Admin.field('invoice.showQR', 'إظهار رمز QR', { type: 'switch', hint: 'يتطلب إنترنت لتوليد الرمز' }) +
      Admin.field('invoice.showWords', 'تفقيط المبلغ كتابةً', { type: 'switch' }) +
      Admin.field('invoice.showTerms', 'إظهار الشروط', { type: 'switch' }) +
      '</div>' + save + '</div>';
  } else if (tab === 'print'){
    panel = '<div class="card"><div class="card-h"><h3>🖨️ إعدادات الطباعة</h3></div>' +
      '<div class="form-grid">' +
      Admin.field('print.size', 'حجم الورق الافتراضي', { type: 'select', options: [{ value: 'A4', label: 'A4' }, { value: 'A5', label: 'A5' }, { value: 'T80', label: 'حراري 80 مم' }, { value: 'T58', label: 'حراري 58 مم' }] }) +
      Admin.field('print.margins', 'الهوامش', { type: 'select', options: [{ value: '5mm', label: '5 مم' }, { value: '10mm', label: '10 مم' }, { value: '15mm', label: '15 مم' }, { value: '0', label: 'بدون' }] }) +
      Admin.field('print.orientation', 'اتجاه الورق', { type: 'select', options: [{ value: 'portrait', label: 'طولي' }, { value: 'landscape', label: 'عرضي' }] }) +
      Admin.field('print.copies', 'عدد النسخ الافتراضي', { type: 'number', min: 1 }) +
      Admin.field('print.printer', 'الطابعة الافتراضية', { hint: 'اسم الطابعة للتوثيق فقط' }) +
      Admin.field('print.showStamp', 'إظهار الختم', { type: 'switch' }) +
      Admin.field('print.autoPrint', 'طباعة تلقائية بعد البيع', { type: 'switch' }) +
      '</div>' +
      '<div class="hint-box mt-12">🖨️ الطباعة تعمل عبر نافذة الطباعة في المتصفح؛ اختر الطابعة والمقاس من هناك مرة واحدة وسيحفظها المتصفح.</div>' +
      save + '</div>';
  } else if (tab === 'branches'){
    panel = '<div class="card pad-0"><div class="card-h" style="padding:16px 16px 0"><h3>🏬 الفروع والمخازن</h3>' +
      '<span class="sub">كل عملية تُسجَّل باسم الفرع — جاهز للتوسع</span>' +
      '<div class="acts"><button class="btn sm primary" data-act="branch-new">＋ فرع جديد</button></div></div>' +
      '<div style="padding:12px">' + UI.table({
        columns: [
          { title: 'الفرع', render: (b) => '<b>' + U.esc(b.name) + '</b>' + (DB.state.currentBranch === b.id ? ' <span class="badge accent">الفرع الحالي</span>' : '') },
          { title: 'العنوان', render: (b) => U.esc(b.address || '—') },
          { title: 'الهاتف', render: (b) => U.esc(b.phone || '—') },
          { title: 'الفواتير', cls: 'num', render: (b) => U.num(DB.c('invoices').filter((v) => v.branchId === b.id).length) },
          { title: 'المنتجات', cls: 'num', render: (b) => U.num(DB.c('products').filter((p) => p.branchId === b.id).length) },
          { title: '', cls: 'acts', render: (b) => V.rowMenu([
            { act: 'branch-edit', id: b.id, icon: '✏️', title: 'تعديل' },
            DB.state.branches.length > 1 ? { act: 'branch-del', id: b.id, icon: '🗑️', title: 'حذف' } : null
          ]) }
        ], rows: DB.state.branches
      }) + '</div></div>' +
      '<div class="card mt-16"><div class="card-h"><h3>🔀 نقل مخزون بين الفروع</h3></div>' +
      '<div class="form-grid">' +
      '<div class="field"><label>المنتج</label><select class="select" id="trProduct">' + DB.c('products').map((p) => '<option value="' + p.id + '">' + U.esc(p.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>من فرع</label><select class="select" id="trFrom">' + DB.state.branches.map((b) => '<option value="' + b.id + '">' + U.esc(b.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>إلى فرع</label><select class="select" id="trTo">' + DB.state.branches.map((b) => '<option value="' + b.id + '">' + U.esc(b.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>الكمية</label><input class="input" id="trQty" type="number" min="1" value="1"></div>' +
      '</div><button class="btn primary mt-12" data-act="transfer-do">🔀 تنفيذ النقل</button></div>';
  } else if (tab === 'offers'){
    panel = '<div class="card pad-0"><div class="card-h" style="padding:16px 16px 0"><h3>🏷️ العروض والتخفيضات</h3>' +
      '<div class="acts"><button class="btn sm primary" data-act="crud-new" data-k="offers">＋ عرض جديد</button></div></div>' +
      '<div style="padding:12px">' + UI.table({
        columns: [
          { title: 'العرض', render: (o) => '<b>' + U.esc(o.name) + '</b>' },
          { title: 'النوع', render: (o) => o.type === 'category' ? 'على قسم' : 'على منتج' },
          { title: 'الخصم', cls: 'num', render: (o) => '<span class="badge danger">' + (o.percent || 0) + '%</span>' },
          { title: 'الفترة', render: (o) => U.dateAr(o.from, { short: true }) + ' → ' + U.dateAr(o.to, { short: true }) },
          { title: 'الحالة', render: (o) => o.active && o.from <= U.today() && o.to >= U.today() ? '<span class="badge ok">ساري</span>' : '<span class="badge">متوقف</span>' },
          { title: '', cls: 'acts', render: (o) => V.rowMenu([
            { act: 'crud-edit', k: 'offers', id: o.id, icon: '✏️', title: 'تعديل' },
            { act: 'crud-del', k: 'offers', id: o.id, icon: '🗑️', title: 'حذف' }
          ]) }
        ], rows: DB.c('offers'), empty: UI.empty('🏷️', 'لا عروض', 'أنشئ عرضاً على منتج أو قسم لفترة محددة.')
      }) + '</div></div>';
  } else if (tab === 'users'){
    panel = '<div class="card pad-0"><div class="card-h" style="padding:16px 16px 0"><h3>👨‍💼 المستخدمون والصلاحيات</h3>' +
      '<div class="acts"><button class="btn sm primary" data-act="user-new">＋ مستخدم جديد</button></div></div>' +
      '<div style="padding:12px">' + UI.table({
        columns: [
          { title: 'المستخدم', render: (u) => '<div class="row gap-8"><div class="avatar">' + U.esc(U.initials(u.name)) + '</div><div><b>' + U.esc(u.name) + '</b><div class="tiny dim mono">@' + U.esc(u.username) + '</div></div></div>' },
          { title: 'الدور', render: (u) => '<span class="badge ' + (u.role === 'admin' ? 'dark' : 'accent') + '">' + U.esc(Auth.roleLabel(u)) + '</span>' },
          { title: 'الوصف', render: (u) => '<span class="tiny muted">' + U.esc((ROLES[u.role] || {}).desc || 'صلاحيات مخصصة') + '</span>' },
          { title: 'آخر دخول', render: (u) => { const s = DB.c('sessions').find((x) => x.userId === u.id); return s ? '<span class="tiny dim">' + U.stampAr(s.at) + '</span>' : '<span class="dim">—</span>'; } },
          { title: 'الحالة', render: (u) => u.active === false ? '<span class="badge danger">موقوف</span>' : '<span class="badge ok">نشط</span>' },
          { title: '', cls: 'acts', render: (u) => V.rowMenu([
            { act: 'user-edit', id: u.id, icon: '✏️', title: 'تعديل' },
            { act: 'user-perms', id: u.id, icon: '🔑', title: 'الصلاحيات' },
            u.id !== (Auth.user() || {}).id ? { act: 'user-del', id: u.id, icon: '🗑️', title: 'حذف' } : null
          ]) }
        ], rows: DB.c('users')
      }) + '</div></div>' +
      '<div class="card mt-16"><div class="card-h"><h3>🧩 الصلاحيات المتاحة</h3></div>' +
      U.uniq(Object.values(PERMS).map((p) => p.g)).map((g) =>
        '<div class="mb-12"><div class="b small mb-4">' + U.esc(g) + '</div><div class="chips">' +
        Object.keys(PERMS).filter((k) => PERMS[k].g === g).map((k) => '<span class="chip">' + U.esc(PERMS[k].t) + '</span>').join('') + '</div></div>').join('') +
      '</div>';
  } else if (tab === 'security'){
    const sessions = DB.c('sessions').slice(0, 30);
    panel = '<div class="grid g-2">' +
      '<div class="card"><div class="card-h"><h3>🔑 كلمة المرور</h3></div>' +
      '<div class="form-grid"><div class="field full"><label>كلمة المرور الحالية</label><input class="input" id="secOld" type="password"></div>' +
      '<div class="field"><label>كلمة المرور الجديدة</label><input class="input" id="secNew" type="password"></div>' +
      '<div class="field"><label>تأكيد الجديدة</label><input class="input" id="secNew2" type="password"></div></div>' +
      '<button class="btn primary mt-12" data-act="change-pass">💾 تغيير كلمة المرور</button></div>' +
      '<div class="card"><div class="card-h"><h3>🔐 الأمان</h3></div>' +
      '<div class="setting-row"><div><div class="sr-t">قفل تلقائي بعد خمول</div><div class="sr-s">يطلب الدخول مجدداً بعد 30 دقيقة</div></div><div class="sr-c"><span class="badge ok">مفعّل</span></div></div>' +
      '<div class="setting-row"><div><div class="sr-t">تسجيل كل عملية حساسة</div><div class="sr-s">من؟ ماذا؟ متى؟</div></div><div class="sr-c"><span class="badge ok">مفعّل</span></div></div>' +
      '<div class="setting-row"><div><div class="sr-t">حجم البيانات المحفوظة</div></div><div class="sr-c"><span class="b">' + U.num(Math.round(DB.storageSize() / 1024)) + ' KB</span></div></div>' +
      '<div class="row gap-8 mt-12"><button class="btn" data-act="logout-all">🚪 إنهاء كل الجلسات</button>' +
      '<button class="btn ghost" data-act="go-admin" data-tab="backup">💾 نسخة احتياطية</button></div></div>' +
      '</div>' +
      '<div class="card mt-16 pad-0"><div class="card-h" style="padding:16px 16px 0"><h3>🖥️ جلسات الدخول</h3></div><div style="padding:12px">' +
      UI.table({
        columns: [
          { title: 'المستخدم', render: (s) => U.esc(s.userName || '—') },
          { title: 'الدخول', render: (s) => U.stampAr(s.at) },
          { title: 'الخروج', render: (s) => s.out ? U.stampAr(s.out) : '<span class="badge ok">جلسة حالية</span>' },
          { title: 'الجهاز', render: (s) => '<span class="tiny dim ellip" style="max-width:280px;display:inline-block">' + U.esc(s.device || '') + '</span>' }
        ], rows: sessions, empty: UI.empty('🖥️', 'لا جلسات')
      }) + '</div></div>';
  } else if (tab === 'audit'){
    const route = 'audit';
    let rows = DB.c('audit').slice();
    const q = F.get(route).q;
    if (q) rows = rows.filter((a) => U.has(a.action, q) || U.has(a.userName, q) || U.has(a.target, q));
    rows = F.slice(rows, route, 60);
    panel = '<div class="card pad-0"><div class="card-h" style="padding:16px 16px 0"><h3>🕵️ سجل العمليات</h3>' +
      '<span class="sub">' + DB.c('audit').length + ' عملية</span>' +
      '<div class="acts"><button class="btn sm" data-act="export-audit">📥 Excel</button>' +
      '<button class="btn sm ghost" data-act="audit-clear">تفريغ السجل</button></div></div>' +
      '<div style="padding:12px">' + F.bar(route, { placeholder: 'بحث في السجل…', dateRange: false }) +
      UI.table({
        columns: [
          { title: 'الوقت', render: (a) => '<span class="tiny">' + U.stampAr(a.at) + '</span>' },
          { title: 'المستخدم', render: (a) => U.esc(a.userName) },
          { title: 'العملية', render: (a) => '<span class="badge ' + ({ ok: 'ok', warn: 'warn', danger: 'danger' }[a.level] || '') + '">' + U.esc(a.action) + '</span>' },
          { title: 'الهدف', render: (a) => '<b>' + U.esc(a.target || '—') + '</b>' },
          { title: 'التفاصيل', render: (a) => '<span class="tiny muted">' + U.esc(a.details || '') + '</span>' }
        ], rows, empty: UI.empty('🕵️', 'لا عمليات مسجّلة')
      }) + F.pager(DB.c('audit').length, route, 60) + '</div></div>';
  } else if (tab === 'backup'){
    const size = DB.storageSize();
    panel = '<div class="grid g-2">' +
      '<div class="card"><div class="card-h"><h3>💾 نسخة احتياطية</h3></div>' +
      '<p class="small muted">النسخة تشمل كل البيانات: الزبائن، المنتجات، الفواتير، الأقساط، التسديدات، الإعدادات، والسجلات.</p>' +
      '<div class="stat-line"><div class="sl-t">حجم البيانات</div><div class="sl-v">' + U.num(Math.round(size / 1024)) + ' KB</div></div>' +
      '<div class="stat-line"><div class="sl-t">آخر نسخة</div><div class="sl-v">' + (S().backup.lastBackup ? U.stampAr(S().backup.lastBackup) : 'لم تؤخذ بعد') + '</div></div>' +
      '<div class="row gap-8 mt-12"><button class="btn primary" data-act="backup-now">💾 إنشاء نسخة احتياطية الآن</button>' +
      '<button class="btn" data-act="backup-restore">📂 استعادة من ملف</button></div></div>' +
      '<div class="card"><div class="card-h"><h3>📤 استيراد / تصدير البيانات</h3></div>' +
      '<div class="row gap-8 wrap"><button class="btn" data-act="import-products">📦 استيراد منتجات (Excel/CSV)</button>' +
      '<button class="btn" data-act="import-customers">👥 استيراد زبائن (Excel/CSV)</button>' +
      '<button class="btn" data-act="go" data-route="excel">📥 مركز التصدير</button></div>' +
      '<div class="divider"></div><h3 class="mb-8">⚠️ منطقة الخطر</h3>' +
      '<div class="hint-box danger mb-12">هذه العمليات لا يمكن التراجع عنها. خذ نسخة احتياطية أولاً.</div>' +
      '<div class="row gap-8 wrap"><button class="btn warn" data-act="load-demo">🧪 تحميل بيانات تجريبية</button>' +
      '<button class="btn ghost" data-act="reset-data">🧹 تفريغ البيانات (إبقاء الإعدادات)</button>' +
      '<button class="btn danger" data-act="reset-all">⛔ إعادة ضبط كاملة</button></div>' +
      '</div></div>';
  } else {
    panel = '<div class="card"><div class="card-h"><h3>ℹ️ بيتي POS</h3><span class="sub">نظام إدارة محلات المواد المنزلية</span></div>' +
      '<div class="stat-line"><div class="sl-t">الإصدار</div><div class="sl-v">1.0.0</div></div>' +
      '<div class="stat-line"><div class="sl-t">طريقة التخزين</div><div class="sl-v">متصفح الجهاز (localStorage)</div></div>' +
      '<div class="stat-line"><div class="sl-t">الاتصال بالإنترنت</div><div class="sl-v"><span class="badge ok">غير مطلوب</span></div></div>' +
      '<div class="stat-line"><div class="sl-t">عدد السجلات</div><div class="sl-v">' + U.num(DB.COLLECTIONS.reduce((t, c) => t + DB.c(c).length, 0)) + '</div></div>' +
      '<div class="divider"></div>' +
      '<p class="small muted">النظام مبني ليعمل بدون سيرفر وبدون اشتراك. عند الحاجة لعدة أجهزة أو فروع متزامنة، يمكن نقل نفس قاعدة البيانات إلى سيرفر بدون تغيير واجهة الاستخدام.</p>' +
      '<div class="row gap-8 mt-12"><button class="btn" data-act="go" data-route="insights">🧠 التحليلات</button>' +
      '<button class="btn" data-act="print-doc" data-v="daily">🖨️ تقرير اليوم</button></div></div>';
  }

  return UI.page({ icon: '⚙️', title: 'الإدارة', sub: 'مركز التحكم الكامل بالنظام', body: tabs + panel });
};

/* ---------------------------------------------------------------- العروض والفروع */
CRUD.def('offers', {
  title: 'العروض', one: 'عرض', icon: '🏷️', coll: 'offers', perm: 'admin',
  addLabel: 'عرض جديد', searchKeys: ['name'], filterBranch: false,
  defaults: () => ({ type: 'product', percent: 10, from: U.today(), to: U.addDays(U.today(), 14), active: true }),
  fields: () => [
    { key: 'name', label: 'اسم العرض', required: true },
    { key: 'type', label: 'النوع', type: 'select', value: 'product', options: [{ value: 'product', label: 'على منتجات محددة' }, { value: 'category', label: 'على قسم كامل' }] },
    { key: 'targets', label: 'الهدف (أكواد أو أسماء مفصولة بفاصلة)', full: true },
    { key: 'percent', label: 'نسبة الخصم %', type: 'number', value: 10 },
    { key: 'from', label: 'من تاريخ', type: 'date', value: U.today() },
    { key: 'to', label: 'إلى تاريخ', type: 'date', value: U.addDays(U.today(), 14) },
    { key: 'active', label: '', type: 'check', checkLabel: 'عرض نشط', value: true }
  ],
  columns: [
    { title: 'العرض', render: (o) => '<b>' + U.esc(o.name) + '</b>' },
    { title: 'الخصم', cls: 'num', render: (o) => '<span class="badge danger">' + (o.percent || 0) + '%</span>' },
    { title: 'الفترة', render: (o) => U.dateAr(o.from, { short: true }) + ' → ' + U.dateAr(o.to, { short: true }) },
    { title: '', cls: 'acts', render: (o) => V.rowMenu([
      { act: 'crud-edit', k: 'offers', id: o.id, icon: '✏️', title: 'تعديل' },
      { act: 'crud-del', k: 'offers', id: o.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ]
});

CRUD.def('techs', {
  title: 'الفنيون', one: 'فني', icon: '🔧', coll: 'techs', perm: 'maintenance', route: 'techs',
  addLabel: 'فني', searchKeys: ['name', 'phone'], filterBranch: false,
  fields: () => [{ key: 'name', label: 'الاسم', required: true }, { key: 'phone', label: 'الهاتف' }],
  columns: [
    { title: 'الاسم', render: (t) => '<b>' + U.esc(t.name) + '</b>' },
    { title: 'الهاتف', render: (t) => '<span class="mono">' + U.esc(t.phone || '—') + '</span>' },
    { title: 'الطلبات', cls: 'num', render: (t) => U.num(DB.c('maintenance').filter((m) => m.techId === t.id).length) },
    { title: '', cls: 'acts', render: (t) => V.rowMenu([{ act: 'crud-edit', k: 'techs', id: t.id, icon: '✏️', title: 'تعديل' }, { act: 'crud-del', k: 'techs', id: t.id, icon: '🗑️', title: 'حذف' }]) }
  ]
});
Views.techs = () => CRUD.page('techs');

CRUD.def('drivers', {
  title: 'الموصّلون', one: 'موصّل', icon: '🚚', coll: 'drivers', perm: 'deliveries', route: 'drivers',
  addLabel: 'موصّل', searchKeys: ['name', 'phone'], filterBranch: false,
  fields: () => [{ key: 'name', label: 'الاسم', required: true }, { key: 'phone', label: 'الهاتف' }],
  columns: [
    { title: 'الاسم', render: (d) => '<b>' + U.esc(d.name) + '</b>' },
    { title: 'الهاتف', render: (d) => '<span class="mono">' + U.esc(d.phone || '—') + '</span>' },
    { title: 'التوصيلات', cls: 'num', render: (d) => U.num(DB.c('deliveries').filter((x) => x.driverId === d.id).length) },
    { title: '', cls: 'acts', render: (d) => V.rowMenu([{ act: 'crud-edit', k: 'drivers', id: d.id, icon: '✏️', title: 'تعديل' }, { act: 'crud-del', k: 'drivers', id: d.id, icon: '🗑️', title: 'حذف' }]) }
  ]
});
Views.drivers = () => CRUD.page('drivers');

/* ---------------------------------------------------------------- مستخدمون */
const Users = {
  open(id){
    const u = id ? DB.get('users', id) : null;
    UI.modal({
      title: u ? 'تعديل مستخدم' : 'مستخدم جديد', icon: '👨‍💼',
      body: UI.form([
        { key: 'name', label: 'الاسم الكامل', required: true },
        { key: 'username', label: 'اسم المستخدم', required: true },
        { key: 'pass', label: 'كلمة المرور', required: !u, value: u ? '' : '', hint: u ? 'اتركها فارغة للإبقاء على الحالية' : '' },
        { key: 'phone', label: 'الهاتف' },
        { key: 'role', label: 'الدور', type: 'select', value: 'sales', options: Object.keys(ROLES).map((k) => ({ value: k, label: ROLES[k].t + ' — ' + ROLES[k].desc })) },
        { key: 'active', label: '', type: 'check', checkLabel: 'حساب نشط', value: true }
      ], u || { active: true, role: 'sales' }),
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 حفظ', cls: 'primary', handler: (ctx) => {
          const f = [
            { key: 'name', label: 'الاسم', required: true }, { key: 'username', label: 'اسم المستخدم', required: true },
            { key: 'pass', label: 'كلمة المرور', required: !u }, { key: 'phone', label: 'الهاتف' },
            { key: 'role', label: 'الدور' }, { key: 'active', label: '', type: 'check' }
          ];
          const data = UI.readForm(ctx.slot, f);
          if (!data.name || !data.username){ UI.toast('الاسم واسم المستخدم مطلوبان', 'err'); return; }
          if (!u && !data.pass){ UI.toast('كلمة المرور مطلوبة', 'err'); return; }
          const dup = DB.c('users').find((x) => x.username === data.username && (!u || x.id !== u.id));
          if (dup){ UI.toast('اسم المستخدم مستخدم مسبقاً', 'err'); return; }
          if (u){
            const patch = { name: data.name, username: data.username, phone: data.phone, role: data.role, active: data.active };
            if (data.pass) patch.pass = data.pass;
            DB.update('users', u.id, patch);
            DB.log('تعديل مستخدم', data.name, '', 'warn');
          } else {
            DB.add('users', { ...data, perms: {}, createdAt: U.now() }, { branch: false });
            DB.log('إضافة مستخدم', data.name, ROLES[data.role].t, 'warn');
          }
          UI.closeModal(); UI.toast('تم الحفظ', 'ok'); App.render();
        } }
      ]
    });
  },
  perms(id){
    const u = DB.get('users', id);
    if (!u) return;
    if (u.role === 'admin'){ UI.toast('المدير يملك كل الصلاحيات', 'info'); return; }
    const groups = U.uniq(Object.values(PERMS).map((p) => p.g));
    const base = ROLE_PERMS[u.role] || [];
    const body = groups.map((g) => '<div class="mb-12"><div class="b small mb-4">' + U.esc(g) + '</div><div class="form-grid">' +
      Object.keys(PERMS).filter((k) => PERMS[k].g === g).map((k) => {
        const val = Object.prototype.hasOwnProperty.call(u.perms || {}, k) ? !!u.perms[k] : base.includes(k);
        return '<label class="check" style="padding:4px 0"><input type="checkbox" data-perm="' + k + '" ' + (val ? 'checked' : '') + '><span class="small">' + U.esc(PERMS[k].t) + '</span></label>';
      }).join('') + '</div></div>').join('');
    UI.modal({
      title: 'صلاحيات: ' + u.name, icon: '🔑', wide: true,
      body: '<div class="hint-box mb-12">الدور الأساسي: <b>' + U.esc(Auth.roleLabel(u)) + '</b> — يمكنك تجاوز أي صلاحية يدوياً.</div>' + body,
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 حفظ الصلاحيات', cls: 'primary', handler: (ctx) => {
          const perms = {};
          U.$$('[data-perm]', ctx.slot).forEach((el) => { perms[el.getAttribute('data-perm')] = el.checked; });
          DB.update('users', u.id, { perms });
          DB.log('تعديل صلاحيات', u.name, '', 'warn');
          UI.closeModal(); UI.toast('تم حفظ الصلاحيات', 'ok'); App.render();
        } }
      ]
    });
  }
};

/* ---------------------------------------------------------------- استيراد */
const Importer = {
  async run(file, kind){
    try{
      let rows = [];
      if (/\.csv$/i.test(file.name)) rows = U.parseCsv(await U.readText(file));
      else rows = await XLSX.parse(await file.arrayBuffer());
      if (!rows.length){ UI.toast('الملف فارغ', 'warn'); return; }
      if (kind === 'products') Importer.products(rows);
      else Importer.customers(rows);
    }catch(e){
      console.error(e);
      UI.toast('تعذّرت قراءة الملف', 'err', e.message || 'تأكد أن الملف بصيغة xlsx أو csv');
    }
  },
  pick(key){
    const map = { الاسم: 'name', name: 'name', المنتج: 'name', الكود: 'code', code: 'code', الباركود: 'barcode', barcode: 'barcode', القسم: 'category', category: 'category', 'سعر الشراء': 'cost', cost: 'cost', 'سعر البيع': 'price', price: 'price', الكمية: 'qty', qty: 'qty', 'الحد الأدنى': 'minQty', minQty: 'minQty', الضمان: 'warrantyMonths', warranty: 'warrantyMonths', الماركة: 'brand', brand: 'brand', الموديل: 'model', model: 'model', الهاتف: 'phone', phone: 'phone', العنوان: 'address', address: 'address', التصنيف: 'tier', tier: 'tier' };
    return (rows) => rows.map((r) => {
      const o = {};
      Object.keys(r).forEach((k) => { const nk = map[String(k).trim()]; if (nk) o[nk] = String(r[k]).trim(); });
      return o;
    });
  },
  products(rows){
    const norm = Importer.pick()(rows);
    let added = 0, updated = 0;
    norm.forEach((r) => {
      if (!r.name) return;
      const ex = DB.c('products').find((p) => (r.code && p.code === r.code) || (r.barcode && p.barcode === r.barcode) || p.name === r.name);
      const cat = r.category ? DB.c('categories').find((c) => U.has(c.name, r.category)) : null;
      const data = {
        name: r.name, code: r.code || (ex ? ex.code : Stock.nextCode()), barcode: r.barcode || (ex ? ex.barcode : Stock.nextBarcode()),
        categoryId: cat ? cat.id : (ex ? ex.categoryId : ''), brand: r.brand || (ex && ex.brand) || '', model: r.model || (ex && ex.model) || '',
        cost: Number(r.cost) || (ex ? Number(ex.cost) : 0), price: Number(r.price) || 0,
        qty: r.qty != null && r.qty !== '' ? Number(r.qty) || 0 : (ex ? Number(ex.qty) : 0),
        minQty: r.minQty != null && r.minQty !== '' ? Number(r.minQty) || 0 : (ex ? Number(ex.minQty) : 1),
        warrantyMonths: Number(r.warrantyMonths) || (ex ? Number(ex.warrantyMonths) : (S().warranty.defaultMonths || 12)),
        active: true
      };
      if (!data.price) data.price = Engine.suggestPrice(data.cost, S().sales.defaultMargin || 25);
      if (ex){
        if (Number(ex.cost) !== data.cost) Stock.logPrice(ex.id, 'cost', ex.cost, data.cost);
        if (Number(ex.price) !== data.price) Stock.logPrice(ex.id, 'price', ex.price, data.price);
        DB.update('products', ex.id, data); updated++;
      } else { DB.add('products', data); added++; }
    });
    DB.save(true);
    DB.log('استيراد منتجات', added + ' جديد، ' + updated + ' محدّث', '', 'ok');
    UI.toast('تم الاستيراد', 'ok', 'أُضيف ' + added + ' منتج وتم تحديث ' + updated);
    App.render();
  },
  customers(rows){
    const norm = Importer.pick()(rows);
    let added = 0;
    norm.forEach((r) => {
      if (!r.name) return;
      const ex = DB.c('customers').find((c) => (r.phone && c.phone === r.phone) || c.name === r.name);
      if (ex){ DB.update('customers', ex.id, { phone: r.phone || ex.phone, address: r.address || ex.address, tier: r.tier || ex.tier }); return; }
      DB.add('customers', { name: r.name, phone: r.phone || '', address: r.address || '', tier: r.tier === 'vip' ? 'vip' : 'normal', code: 'C-' + String((DB.state.counters.customer || 0) + (++added)).padStart(4, '0') });
    });
    DB.save(true);
    DB.log('استيراد زبائن', added + ' زبون', '', 'ok');
    UI.toast('تم الاستيراد', 'ok', 'أُضيف ' + added + ' زبون');
    App.render();
  },
  template(kind){
    if (kind === 'products'){
      XLSX.download('نموذج استيراد المنتجات', [{
        name: 'المنتجات',
        columns: [
          { key: 'name', title: 'الاسم', width: 28 }, { key: 'code', title: 'الكود', width: 12 }, { key: 'barcode', title: 'الباركود', width: 16 },
          { key: 'category', title: 'القسم', width: 16 }, { key: 'brand', title: 'الماركة', width: 14 }, { key: 'model', title: 'الموديل', width: 14 },
          { key: 'cost', title: 'سعر الشراء', type: 'money', width: 14 }, { key: 'price', title: 'سعر البيع', type: 'money', width: 14 },
          { key: 'qty', title: 'الكمية', type: 'number', width: 10 }, { key: 'minQty', title: 'الحد الأدنى', type: 'number', width: 12 },
          { key: 'warrantyMonths', title: 'الضمان', type: 'number', width: 10 }
        ],
        rows: [{ name: 'ثلاجة سامسونج 18 قدم', code: 'P-0001', barcode: '2200000000017', category: 'ثلاجات', brand: 'Samsung', model: 'RT5000', cost: 750000, price: 1000000, qty: 5, minQty: 2, warrantyMonths: 24 }]
      }]);
    } else {
      XLSX.download('نموذج استيراد الزبائن', [{
        name: 'الزبائن',
        columns: [{ key: 'name', title: 'الاسم', width: 26 }, { key: 'phone', title: 'الهاتف', width: 16 }, { key: 'address', title: 'العنوان', width: 30 }, { key: 'tier', title: 'التصنيف', width: 12 }],
        rows: [{ name: 'أحمد علي', phone: '07700000000', address: 'الناصرية — شارع الحبوبي', tier: 'عادي' }]
      }]);
    }
    UI.toast('تم تنزيل النموذج', 'ok');
  }
};
