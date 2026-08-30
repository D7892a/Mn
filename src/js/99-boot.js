/* ============================================================================
   99) الإقلاع — التوجيه، القائمة، وربط الأحداث
   ========================================================================== */
const NAV = [
  { g: '🟦 الإدارة', items: [
    { id: 'dashboard', t: 'لوحة التحكم', ic: '📊', perm: 'dashboard' },
    { id: 'alerts', t: 'التنبيهات', ic: '🔔', perm: 'alerts', badge: 'alerts' },
    { id: 'tasks', t: 'مهام اليوم', ic: '✅', perm: 'tasks' },
    { id: 'calendar', t: 'التقويم المالي', ic: '📅', perm: 'calendar' }
  ]},
  { g: '🛒 المبيعات', items: [
    { id: 'pos', t: 'نقطة البيع', ic: '🛍️', perm: 'pos' },
    { id: 'sales', t: 'جميع المبيعات', ic: '🧾', perm: 'sales' },
    { id: 'invoices', t: 'الفواتير', ic: '📄', perm: 'sales' },
    { id: 'quotes', t: 'عروض الأسعار', ic: '📄', perm: 'quotes' },
    { id: 'reservations', t: 'الحجوزات', ic: '📌', perm: 'reservations' },
    { id: 'returns', t: 'المرتجعات', ic: '🔄', perm: 'returns' }
  ]},
  { g: '👥 العملاء', items: [
    { id: 'customers', t: 'الزبائن', ic: '👤', perm: 'customers' },
    { id: 'installments', t: 'الأقساط', ic: '💳', perm: 'installments', badge: 'overdue' },
    { id: 'payments', t: 'التسديدات', ic: '💰', perm: 'payments' },
    { id: 'statements', t: 'كشوف الحساب', ic: '📑', perm: 'statements' },
    { id: 'top-customers', t: 'أفضل الزبائن', ic: '⭐', perm: 'customers' }
  ]},
  { g: '📦 المخزون', items: [
    { id: 'products', t: 'المنتجات', ic: '📦', perm: 'products' },
    { id: 'categories', t: 'الأقسام', ic: '🏷️', perm: 'categories' },
    { id: 'stock', t: 'المخزون', ic: '📊', perm: 'stock', badge: 'low' },
    { id: 'barcode', t: 'الباركود', ic: '🔖', perm: 'barcode' },
    { id: 'price-changes', t: 'تغيرات الأسعار', ic: '📈', perm: 'products' },
    { id: 'dead-stock', t: 'المنتجات الراكدة', ic: '💤', perm: 'stock' },
    { id: 'stock-moves', t: 'حركة المنتج', ic: '🔄', perm: 'stock' }
  ]},
  { g: '🏢 المشتريات', items: [
    { id: 'purchases', t: 'المشتريات', ic: '📥', perm: 'purchases' },
    { id: 'suppliers', t: 'الموردين', ic: '🏭', perm: 'suppliers' },
    { id: 'supplier-accounts', t: 'حسابات الموردين', ic: '💰', perm: 'suppliers' }
  ]},
  { g: '🛡️ الخدمات', items: [
    { id: 'warranties', t: 'الضمان', ic: '🛡️', perm: 'warranties' },
    { id: 'maintenance', t: 'الصيانة', ic: '🔧', perm: 'maintenance' },
    { id: 'deliveries', t: 'التوصيل', ic: '🚚', perm: 'deliveries' },
    { id: 'exchanges', t: 'الاستبدال', ic: '🔄', perm: 'returns' }
  ]},
  { g: '💰 المالية', items: [
    { id: 'cashbox', t: 'الصندوق', ic: '💰', perm: 'cashbox' },
    { id: 'expenses', t: 'المصاريف', ic: '💸', perm: 'expenses' },
    { id: 'profits', t: 'الأرباح', ic: '📈', perm: 'profits' },
    { id: 'day-close', t: 'إغلاق اليوم', ic: '🔒', perm: 'dayclose' }
  ]},
  { g: '📊 التقارير', items: [
    { id: 'reports', t: 'مركز التقارير', ic: '📊', perm: 'reports' },
    { id: 'excel', t: 'مركز Excel', ic: '📥', perm: 'excel' },
    { id: 'print', t: 'مركز الطباعة', ic: '🖨️', perm: 'print' },
    { id: 'insights', t: 'Smart Insights', ic: '🧠', perm: 'insights' }
  ]},
  { g: '⚙️ النظام', items: [
    { id: 'admin', t: 'الإدارة', ic: '⚙️', perm: 'admin' },
    { id: 'techs', t: 'الفنيون', ic: '🔧', perm: 'maintenance' },
    { id: 'drivers', t: 'الموصّلون', ic: '🚚', perm: 'deliveries' }
  ]}
];

const MOBILE_NAV = [
  { id: 'dashboard', t: 'الرئيسية', ic: '🏠' },
  { id: 'pos', t: 'بيع', ic: '🛒' },
  { id: 'customers', t: 'زبائن', ic: '👥' },
  { id: 'payments', t: 'تسديد', ic: '💳' },
  { id: 'more', t: 'القائمة', ic: '☰' }
];

const App = {
  route: 'dashboard',
  params: {},
  filters: {},
  pos: { items: [], customerId: '', discount: 0, method: 'cash', note: '', held: null },
  posFilter: { q: '', cat: '' },
  barcodeSel: {},
  labelSize: '48x22',
  labelCopies: 1,
  _lastFocus: null,

  payLabel(m){
    return { cash: '💵 نقدي', card: '💳 بطاقة', transfer: '🏦 حوالة', installment: '🗓️ تقسيط' }[m] || (m || '—');
  },

  /* ------------------------------------------------------------- الإقلاع */
  init(){
    DB.load();
    App.applySettings();
    App.wire();
    UI.on(window, 'storage', DB.syncFromStorage);
    UI.on(window, 'hashchange', () => {
      const r = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
      if (r && Views[r]) App.go(r, {}, true);
    });
    if (DB.state.session && Auth.user()) App.start();
    else App.showLogin();
    App.idleWatch();
  },

  applySettings(){
    const ui = S().ui;
    const html = document.documentElement;
    html.setAttribute('data-theme', ui.theme === 'dark' ? 'dark' : 'light');
    html.setAttribute('data-accent', ui.accent || 'blue');
    html.setAttribute('data-density', ui.density === 'compact' ? 'compact' : 'normal');
    html.setAttribute('data-fontsize', ui.fontSize || 'm');
    html.setAttribute('lang', S().locale.lang || 'ar');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', ui.theme === 'dark' ? '#0A1120' : '#172033');
    const tb = document.getElementById('themeBtn');
    if (tb) tb.textContent = ui.theme === 'dark' ? '🌞' : '🌙';
    const storeName = ST().name || 'بيتي';
    const sl = document.getElementById('sideStore'), ll = document.getElementById('loginStore');
    if (sl) sl.textContent = storeName;
    if (ll) ll.textContent = storeName;
    document.title = storeName + ' — نظام إدارة محلات المواد المنزلية';
    const logo = ST().logo;
    const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5.5h5V20"/></svg>';
    ['sideLogo', 'loginLogo'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = logo ? '<img src="' + U.esc(logo) + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">' : svg;
    });
  },

  showLogin(){
    document.getElementById('login').hidden = false;
    document.getElementById('app').hidden = true;
    App.applySettings();
    const hint = document.getElementById('loginHint');
    if (hint && DB.c('users').length && DB.c('users')[0].username !== 'admin') hint.classList.add('hide');
    setTimeout(() => { const i = document.getElementById('loginUser'); if (i) i.focus(); }, 100);
  },

  start(){
    document.getElementById('login').hidden = true;
    document.getElementById('app').hidden = false;
    const u = Auth.user();
    document.getElementById('sideUserName').textContent = u.name;
    document.getElementById('sideUserRole').textContent = Auth.roleLabel(u) + ' • @' + u.username;
    document.getElementById('sideAvatar').textContent = U.initials(u.name);
    const br = DB.state.currentBranch === 'all' ? 'كل الفروع' : DB.branchName(DB.state.currentBranch);
    document.getElementById('sideBranch').textContent = br;
    const hash = (location.hash || '').replace(/^#\/?/, '');
    const initial = (hash && Views[hash]) ? hash : (DB.state._lastRoute && Views[DB.state._lastRoute] ? DB.state._lastRoute : 'dashboard');
    App.buildNav();
    App.go(initial, {}, true);
    if (u.mustChange && u.pass === '1234'){
      setTimeout(() => UI.toast('غيّر كلمة المرور الافتراضية', 'warn', 'الإدارة ← الأمان ← تغيير كلمة المرور', 8000), 900);
    }
    App.registerSW();
  },

  buildNav(){
    const nav = document.getElementById('nav');
    const counts = App.badgeCounts();
    nav.innerHTML = NAV.map((grp) => {
      const items = grp.items.filter((i) => Auth.can(i.perm));
      if (!items.length) return '';
      return '<div class="nav-group"><div class="nav-title">' + grp.g + '</div>' +
        items.map((i) => {
          const c = counts[i.badge];
          return '<button class="nav-item ' + (App.route === i.id ? 'active' : '') + '" data-act="go" data-route="' + i.id + '">' +
            '<span class="ic">' + i.ic + '</span><span class="lbl">' + i.t + '</span>' +
            (c ? '<span class="cnt" style="' + (i.badge === 'overdue' ? 'background:#DC2626' : '') + '">' + c + '</span>' : '') + '</button>';
        }).join('') + '</div>';
    }).join('');
    document.getElementById('mobilenav').innerHTML = MOBILE_NAV.map((m) =>
      '<button class="mn-item ' + (m.id !== 'more' && App.route === m.id ? 'active' : '') + '" data-act="' + (m.id === 'more' ? 'menu' : 'go') + '" data-route="' + m.id + '">' +
      '<span class="ic">' + m.ic + '</span>' + m.t +
      (m.id === 'dashboard' && counts.alerts ? '<span class="badge-dot">' + counts.alerts + '</span>' : '') + '</button>').join('');
  },
  badgeCounts(){
    let overdue = 0, low = 0;
    DB.c('plans').forEach((p) => { if (p.status !== 'void') overdue += Engine.planSummary(p).overdueCount; });
    low = Engine.lowStock(DB.state).length;
    const alerts = Engine.alerts(DB.state, U.today()).length;
    return { overdue, low, alerts };
  },

  /* ----------------------------------------------------------- التوجيه */
  go(route, params, fromHash){
    if (!Views[route]) route = 'dashboard';
    const perm = (NAV.flatMap((g) => g.items).find((i) => i.id === route) || {}).perm;
    if (perm && !Auth.can(perm)){
      UI.toast('صلاحية غير كافية', 'err', 'ليس لديك صلاحية الوصول إلى هذه الصفحة');
      return;
    }
    App.route = route;
    App.params = params || {};
    DB.setPref('lastRoute', route);
    if (!fromHash && location.hash !== '#/' + route){ try { history.replaceState(null, '', '#/' + route); } catch(e){ location.hash = '#/' + route; } }
    App.render();
  },
  render(){
    const view = document.getElementById('view');
    if (!view) return;
    /* حفظ موضع التركيز */
    const ae = document.activeElement;
    let focusInfo = null;
    if (ae && ae.dataset && ae.dataset.act && ['search', 'pos-search'].includes(ae.dataset.act)){
      focusInfo = { act: ae.dataset.act, route: ae.dataset.route, pos: ae.selectionStart };
    }
    const fn = Views[App.route] || Views.dashboard;
    try{
      view.innerHTML = fn(App.params);
    }catch(e){
      console.error(e);
      view.innerHTML = UI.page({ icon: '⛔', title: 'خطأ في العرض', body: '<div class="hint-box danger">تعذّر عرض هذه الشاشة: ' + U.esc(e.message) + '</div>' });
    }
    App.buildNav();
    UI.animateNumbers(view);
    if (focusInfo){
      const el = view.querySelector('[data-act="' + focusInfo.act + '"]' + (focusInfo.route ? '[data-route="' + focusInfo.route + '"]' : ''));
      if (el){ el.focus(); try { el.setSelectionRange(focusInfo.pos, focusInfo.pos); } catch(e){} }
    }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  },
  refresh(){ App.render(); },

  /* ------------------------------------------------------ ربط الأحداث */
  wire(){
    /* الدخول */
    UI.on(document.getElementById('loginForm'), 'submit', (e) => {
      e.preventDefault();
      const u = document.getElementById('loginUser').value;
      const p = document.getElementById('loginPass').value;
      const res = Auth.login(u, p);
      const err = document.getElementById('loginErr');
      if (!res.ok){ err.textContent = res.msg; err.classList.remove('hide'); return; }
      err.classList.add('hide');
      document.getElementById('loginPass').value = '';
      App.start();
    });

    /* النقر العام */
    document.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-act]');
      const dd = document.getElementById('ddRoot');
      if (!el){
        if (dd.classList.contains('on') && !ev.target.closest('#ddRoot')) UI.closeDropdown();
        const gs = document.getElementById('gsResults');
        if (gs && !gs.hidden && !ev.target.closest('#gsWrap')) gs.hidden = true;
        return;
      }
      const act = el.getAttribute('data-act');
      if (act === 'dd-item' || act.startsWith('modal-act')) { /* تُعالج أدناه */ }
      else if (dd.classList.contains('on') && !ev.target.closest('#ddRoot')) UI.closeDropdown();
      const fn = ACT[act];
      if (!fn){ console.warn('إجراء غير معرّف:', act); return; }
      try{ fn(el, ev); }catch(e){ console.error(e); UI.toast('حدث خطأ', 'err', e.message); }
    });

    /* الإدخال */
    document.addEventListener('input', (ev) => {
      const el = ev.target.closest('[data-act]');
      if (!el) return;
      const act = el.getAttribute('data-act');
      if (IN[act]) IN[act](el, ev);
    });
    document.addEventListener('change', (ev) => {
      const el = ev.target.closest('[data-act]');
      if (!el) return;
      const act = el.getAttribute('data-act');
      if (CH[act]) CH[act](el, ev);
    });
    /* اختصارات */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape'){
        if (document.getElementById('modalRoot').classList.contains('on')) { UI.closeModal(); return; }
        UI.closeDropdown();
        const gs = document.getElementById('gsResults'); if (gs) gs.hidden = true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
        e.preventDefault(); const g = document.getElementById('gs'); if (g) g.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && App.route === 'pos'){ e.preventDefault(); POS.checkout(); }
    });
    UI.on(window, 'beforeunload', () => { if (DB.dirty) DB.flush(); });
  },

  idleWatch(){
    let t;
    const reset = () => {
      clearTimeout(t);
      if (!DB.state.session) return;
      t = setTimeout(() => {
        if (!App.isIdleSafe()) return;
        Auth.logout();
        App.showLogin();
        UI.toast('تم قفل النظام', 'warn', 'بسبب الخمول — سجّل الدخول مجدداً');
      }, 30 * 60 * 1000);
    };
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((ev) => document.addEventListener(ev, reset, { passive: true }));
    reset();
  },
  isIdleSafe(){
    const m = document.getElementById('modalRoot');
    return !(m && m.classList.contains('on')) && App.pos.items.length === 0;
  },

  registerSW(){
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').catch(() => {});
  },

  /* ---------------------------------------------------------- البحث العام */
  globalSearch(q){
    const box = document.getElementById('gsResults');
    q = String(q || '').trim();
    if (!q){ box.hidden = true; return; }
    const out = [];
    if (Auth.can('customers')) DB.c('customers').filter((c) => U.has(c.name, q) || U.has(c.phone, q)).slice(0, 4)
      .forEach((c) => out.push({ ic: '👤', t: c.name, s: (c.phone || '') + ' • زبون', act: 'open-customer', id: c.id }));
    if (Auth.can('products')) DB.c('products').filter((p) => U.has(p.name, q) || U.has(p.code, q) || U.has(p.barcode, q)).slice(0, 4)
      .forEach((p) => out.push({ ic: '📦', t: p.name, s: U.money(p.price) + ' • المتوفر ' + (p.qty || 0), act: 'product-open', id: p.id }));
    if (Auth.can('sales')) DB.c('invoices').filter((v) => U.has(v.no, q) || U.has(v.verify, q)).slice(0, 4)
      .forEach((v) => out.push({ ic: '🧾', t: v.no, s: U.money(v.total) + ' • ' + U.dateAr(v.date), act: 'invoice-view', id: v.id }));
    if (Auth.can('suppliers')) DB.c('suppliers').filter((s) => U.has(s.name, q)).slice(0, 2)
      .forEach((s) => out.push({ ic: '🏭', t: s.name, s: 'مورد', act: 'go', id: 'suppliers' }));
    box.innerHTML = out.length ? out.map((o) =>
      '<div class="sr-item" data-act="' + o.act + '" data-id="' + U.attr(o.id) + '"><div class="sr-ic">' + o.ic + '</div>' +
      '<div class="grow"><div class="sr-t">' + U.esc(o.t) + '</div><div class="sr-s">' + U.esc(o.s) + '</div></div></div>').join('')
      : '<div class="sr-item"><div class="grow"><div class="sr-s">لا نتائج مطابقة</div></div></div>';
    box.hidden = false;
  },

  /* ----------------------------------------------------------- مساعدات */
  closeSidebar(){
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('scrim').classList.remove('on');
  },
  openSidebar(){
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('scrim').classList.add('on');
  },
  quickRange(v){
    const t = U.today();
    if (v === 'today') return { from: t, to: t };
    if (v === 'week') return { from: U.startOfWeek(t), to: t };
    if (v === 'month') return { from: U.startOfMonth(t), to: t };
    if (v === 'prevmonth'){ const s = U.addMonths(U.startOfMonth(t), -1); return { from: s, to: U.addDays(U.startOfMonth(t), -1) }; }
    if (v === 'year') return { from: U.startOfYear(t), to: t };
    return { from: '2000-01-01', to: '2099-12-31' };
  }
};

/* ============================================================================
   جدول الإجراءات
   ========================================================================== */
const ACT = {
  /* تنقّل */
  'go': (el) => { App.go(el.getAttribute('data-route')); App.closeSidebar(); },
  'go-admin': (el) => App.go('admin', { tab: el.getAttribute('data-tab') }),
  'menu': () => { document.getElementById('sidebar').classList.contains('open') ? App.closeSidebar() : App.openSidebar(); },
  'close-modal': () => UI.closeModal(),
  'modal-act': (el, ev) => UI.modalAct(el.getAttribute('data-h'), Number(el.getAttribute('data-i')), ev),
  'dd-item': (el) => {
    const items = (document.getElementById('ddRoot')._items) || [];
    const it = items[Number(el.getAttribute('data-i'))];
    UI.closeDropdown();
    if (it && it.fn) it.fn();
  },
  'chip': (el) => F.set(el.getAttribute('data-route'), { chip: el.getAttribute('data-v'), page: 1 }),
  'page': (el) => F.set(el.getAttribute('data-route'), { page: Number(el.getAttribute('data-v')) || 1 }),
  'quick-range': (el) => F.set(el.getAttribute('data-route'), Object.assign(App.quickRange(el.getAttribute('data-v')), { page: 1 })),
  'dash-range': (el) => App.go('dashboard', { range: el.getAttribute('data-v') }),

  /* CRUD */
  'crud-new': (el) => CRUD.openNew(el.getAttribute('data-k')),
  'crud-edit': (el) => CRUD.openEdit(el.getAttribute('data-k'), el.getAttribute('data-id')),
  'crud-del': (el) => CRUD.remove(el.getAttribute('data-k'), el.getAttribute('data-id')),
  'crud-export': (el) => {
    const d = CRUD.defs[el.getAttribute('data-k')];
    const map = { customers: 'customers', products: 'stock', suppliers: 'suppliers', expenses: 'expenses', warranties: 'warranties', maintenance: 'maintenance', deliveries: 'deliveries', quotes: 'sales', purchases: 'purchases' };
    const rid = map[d.coll];
    if (rid) Exporter.one(rid, '2000-01-01', U.today(), '');
    else UI.toast('لا يوجد قالب تصدير لهذا السجل', 'warn');
  },
  'crud-print': (el) => {
    const k = el.getAttribute('data-k');
    if (k === 'maintenance' || k === 'deliveries') App.go(k);
    else UI.toast('استخدم مركز الطباعة', 'info', 'من القائمة: التقارير ← مركز الطباعة');
  },

  /* محرر الأصناف */
  'ie-add': () => ItemsEditor.add(UI.modalCtx),
  'ie-del': (el) => { const c = UI.modalCtx; c.data.items.splice(Number(el.getAttribute('data-i')), 1); ItemsEditor.paint(c, c.data.opt); },
  'ie-product': (el) => ItemsEditor.sync(UI.modalCtx, Number(el.getAttribute('data-i')), { productId: el.value }),
  'ie-qty': (el) => ItemsEditor.sync(UI.modalCtx, Number(el.getAttribute('data-i')), { qty: Number(el.value) || 0 }),
  'ie-price': (el) => {
    const c = UI.modalCtx; const k = (c.data.opt && c.data.opt.priceKey) || 'price';
    const patch = {}; patch[k] = Number(el.value) || 0;
    ItemsEditor.sync(c, Number(el.getAttribute('data-i')), patch);
  },
  'ie-disc': (el) => ItemsEditor.sync(UI.modalCtx, Number(el.getAttribute('data-i')), { discount: Number(el.value) || 0 }),

  /* نقطة البيع */
  'pos-cat': (el) => { App.posFilter.cat = el.getAttribute('data-v'); App.render(); },
  'pos-add': (el) => POS.add(el.getAttribute('data-id'), 1),
  'pos-add-direct': (el) => { POS.add(el.getAttribute('data-id'), 1); App.go('pos'); },
  'pos-qty': (el) => {
    const i = Number(el.getAttribute('data-i'));
    const it = App.pos.items[i]; if (!it) return;
    it.qty = Math.max(1, Number(it.qty) + Number(el.getAttribute('data-v')));
    App.render();
  },
  'pos-del': (el) => { App.pos.items.splice(Number(el.getAttribute('data-i')), 1); App.render(); },
  'pos-clear': async () => {
    if (!App.pos.items.length) return;
    if (await UI.confirm('تفريغ السلة', 'سيتم حذف كل الأصناف من السلة.', { danger: true, okLabel: 'تفريغ' })){
      App.pos.items = []; App.pos.discount = 0; App.render();
    }
  },
  'pos-method': (el) => { App.pos.method = el.getAttribute('data-v'); App.render(); },
  'pos-checkout': () => POS.checkout(),
  'pos-hold': () => {
    if (App.pos.held && App.pos.held.length && !App.pos.items.length){
      const h = App.pos.held.pop();
      App.pos.items = h.items; App.pos.customerId = h.customerId; App.pos.discount = h.discount;
      UI.toast('تم استئناف السلة', 'ok'); App.render();
    } else POS.hold();
  },
  'pos-discount': () => {
    const tot = Engine.invoiceTotals(App.pos.items, { discount: 0 });
    UI.modal({
      title: 'خصم على الفاتورة', icon: '🏷️', narrow: true,
      body: '<div class="field"><label>مبلغ الخصم</label><input class="input" id="dcAmt" type="number" step="250" value="' + (App.pos.discount || 0) + '"></div>' +
        '<div class="field mt-8"><label>أو نسبة %</label><input class="input" id="dcPct" type="number" step="0.5" value="0"></div>' +
        '<div class="hint-box mt-12">الحد الأقصى المسموح: ' + (S().sales.maxDiscount || 0) + '% من الإجمالي (' + U.money(tot.subtotal * (S().sales.maxDiscount || 0) / 100) + ')</div>',
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 تطبيق', cls: 'primary', handler: (ctx) => {
          let amt = Number(ctx.slot.querySelector('#dcAmt').value) || 0;
          const pct = Number(ctx.slot.querySelector('#dcPct').value) || 0;
          if (pct) amt = U.round(tot.subtotal * pct / 100, S().sales.roundTo || 250);
          if (!Auth.can('act.discount')){ UI.toast('لا تملك صلاحية الخصم', 'err'); return; }
          App.pos.discount = Math.max(0, amt);
          UI.closeModal(); App.render();
        } }
      ]
    });
  },
  'pos-customer': () => {
    UI.modal({
      title: 'ربط الفاتورة بزبون', icon: '👤',
      body: '<div class="field"><label>الزبون</label><select class="select" id="pcSel"><option value="">— زبون نقدي —</option>' +
        DB.c('customers').sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((c) => '<option value="' + c.id + '" ' + (App.pos.customerId === c.id ? 'selected' : '') + '>' + U.esc(c.name) + (c.phone ? ' — ' + U.esc(c.phone) : '') + '</option>').join('') + '</select></div>' +
        '<div class="divider"></div><div class="row gap-8"><button class="btn soft" data-act="crud-new" data-k="customers">＋ زبون جديد</button>' +
        '<span class="tiny dim">يلزم ملف زبون للبيع بالتقسيط</span></div>',
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 حفظ', cls: 'primary', handler: (ctx) => { App.pos.customerId = ctx.slot.querySelector('#pcSel').value; UI.closeModal(); App.render(); } }
      ]
    });
  },
  'pos-line': (el) => {
    const i = Number(el.getAttribute('data-i'));
    const it = App.pos.items[i]; if (!it) return;
    UI.modal({
      title: 'تعديل صنف', icon: '✏️', narrow: true,
      body: UI.form([
        { key: 'price', label: 'سعر الوحدة', type: 'money', value: it.price },
        { key: 'qty', label: 'الكمية', type: 'number', value: it.qty },
        { key: 'discount', label: 'خصم على السطر', type: 'money', value: it.discount || 0 },
        { key: 'serial', label: 'الرقم التسلسلي', value: it.serial || '' }
      ], it),
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 حفظ', cls: 'primary', handler: (ctx) => {
          const f = [{ key: 'price', label: 'السعر', type: 'money' }, { key: 'qty', label: 'الكمية', type: 'number' }, { key: 'discount', label: 'الخصم', type: 'money' }, { key: 'serial', label: 'السيريال' }];
          const d = UI.readForm(ctx.slot, f);
          Object.assign(it, d);
          UI.closeModal(); App.render();
        } }
      ]
    });
  },
  'cash-method': (el) => { App.pos.method = el.getAttribute('data-v'); UI.closeModal(); POS.cashModal(); },

  /* الفواتير */
  'invoice-view': (el, ev) => { ev.preventDefault(); App.go('invoice-view', { id: el.getAttribute('data-id') }); },
  'invoice-print': (el) => {
    const inv = DB.get('invoices', el.getAttribute('data-id'));
    if (!inv) return;
    Print.run(Print.doc('invoice', { invoice: inv }), { size: S().invoice.size });
  },
  'invoice-dup': (el) => {
    const inv = DB.get('invoices', el.getAttribute('data-id'));
    if (!inv) return;
    App.pos.items = (inv.items || []).map((i) => ({ ...i }));
    App.pos.customerId = inv.customerId || '';
    App.go('pos');
    UI.toast('تم تحميل أصناف الفاتورة في السلة', 'ok');
  },
  'invoice-void': async (el) => {
    if (!Auth.ensure('act.void', 'إلغاء الفواتير يتطلب صلاحية')) return;
    const inv = DB.get('invoices', el.getAttribute('data-id'));
    if (!inv) return;
    const ok = await UI.confirm('إلغاء الفاتورة ' + inv.no, 'سيُعاد المخزون وتُلغى خطة التقسيط إن وُجدت.', { danger: true, okLabel: '⛔ إلغاء الفاتورة' });
    if (!ok) return;
    const res = Sales.voidInvoice(inv.id);
    if (!res.ok){ UI.toast('تعذّر الإلغاء', 'err', res.msg); return; }
    UI.toast('تم إلغاء الفاتورة', 'ok'); App.render();
  },
  'invoice-return': (el) => Returns.open(el.getAttribute('data-id')),
  'return-new': () => {
    const invs = DB.c('invoices').filter((v) => v.status !== 'void').sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30);
    UI.modal({
      title: 'مرتجع جديد', icon: '🔄',
      body: '<div class="field"><label>اختر الفاتورة</label><select class="select" id="retInv">' +
        invs.map((v) => '<option value="' + v.id + '">' + U.esc(v.no) + ' — ' + U.dateAr(v.date) + ' — ' + U.money(v.total) + '</option>').join('') + '</select></div>',
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: 'التالي', cls: 'primary', handler: (ctx) => { const id = ctx.slot.querySelector('#retInv').value; UI.closeModal(); Returns.open(id); } }
      ]
    });
  },
  'doc-preview': (el) => {
    const id = el.getAttribute('data-id'), kind = el.getAttribute('data-k');
    let html = '';
    if (kind === 'invoice') html = Print.doc('invoice', { invoice: DB.get('invoices', id) });
    else if (kind === 'warranty') html = Print.doc('warranty', { warranty: DB.get('warranties', id) });
    else if (kind === 'receipt_in'){ const m = DB.get('maintenance', id); if (m) html = Print.doc('receipt_in', { record: { no: m.no, date: m.date, customerName: (DB.get('customers', m.customerId) || {}).name, customerPhone: (DB.get('customers', m.customerId) || {}).phone, device: m.device, serial: m.serial, problem: m.problem, cost: m.cost }, title: 'وصل استلام جهاز' }); }
    Print.preview(html, { size: S().invoice.size });
  },

  /* معاينة الطباعة */
  'pv-size': (el) => {
    const size = el.getAttribute('data-size');
    const html = document.getElementById('print-host').innerHTML || (UI.modalCtx && UI.modalCtx.data.html);
    UI.modalCtx.data.size = size;
    UI.$$('[data-act="pv-size"]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-size') === size));
    const frame = document.getElementById('pvFrame');
    if (frame) frame.innerHTML = html.replace(/doc size-\w+( size-thermal)?( doc-thermal)?/g, 'doc ' + Print.sizeClass(size));
  },
  'pv-copies': () => {
    S().print.copies = Number(S().print.copies || 1) >= 3 ? 1 : Number(S().print.copies || 1) + 1;
    DB.save();
    const el = document.getElementById('pvCopies'); if (el) el.textContent = S().print.copies;
  },
  'pv-print': () => {
    const ctx = UI.modalCtx;
    const size = ctx.data.size || S().print.size;
    UI.closeModal();
    Print.run(ctx.data.html.replace(/doc size-\w+( size-thermal)?( doc-thermal)?/g, 'doc ' + Print.sizeClass(size)), { size, copies: S().print.copies });
  },

  /* الزبائن */
  'open-customer': (el, ev) => { ev.preventDefault(); App.go('customer-profile', { id: el.getAttribute('data-id') }); },
  'cust-tab': (el) => App.go('customer-profile', { id: el.getAttribute('data-id'), tab: el.getAttribute('data-tab') }),

  /* الأقساط والتسديد */
  'payment-new': (el) => Payments.open(el.getAttribute('data-customer') || el.getAttribute('data-id') || '', el.getAttribute('data-plan') || el.getAttribute('data-k') || ''),
  'payment-print': (el) => {
    const p = DB.get('payments', el.getAttribute('data-id'));
    if (p) Print.run(Print.doc('receipt', { payment: p }), { size: S().invoice.size });
  },
  'payment-undo': async (el) => {
    const p = DB.get('payments', el.getAttribute('data-id'));
    if (!p) return;
    const ok = await UI.confirm('تراجع عن التسديد', 'سيتم إلغاء الوصل ' + p.no + ' وإعادة الأقساط إلى وضعها السابق.', { danger: true, okLabel: '↩️ تراجع' });
    if (!ok) return;
    (p.allocations || []).forEach((a) => {
      const pl = DB.get('plans', a.planId);
      if (!pl) return;
      const it = pl.items.find((x) => x.no === a.installNo);
      if (it){ it.paid = Math.max(0, Number(it.paid) - Number(a.amount)); if (it.paid < it.amount){ it.paidAt = ''; it.status = 'upcoming'; } }
      DB.update('plans', pl.id, { items: pl.items, status: 'active' });
    });
    DB.remove('payments', p.id);
    DB.log('تراجع عن تسديد', p.no, U.money(p.amount), 'warn');
    UI.toast('تم التراجع', 'ok'); App.render();
  },
  'plan-view': (el) => App.go('plan-view', { id: el.getAttribute('data-id') }),
  'plan-print': (el) => {
    const plan = DB.get('plans', el.getAttribute('data-id'));
    if (!plan) return;
    Print.run(Print.doc('installment', { invoice: DB.get('invoices', plan.invoiceId), plan }), { size: S().invoice.size });
  },
  'plan-toggle': (el) => {
    const plan = DB.get('plans', el.getAttribute('data-id'));
    if (!plan) return;
    const next = plan.status === 'suspended' ? 'active' : 'suspended';
    DB.update('plans', plan.id, { status: next });
    DB.log(next === 'suspended' ? 'إيقاف خطة تقسيط' : 'استئناف خطة تقسيط', plan.no, '', 'warn');
    UI.toast(next === 'suspended' ? 'تم إيقاف الخطة' : 'تم استئناف الخطة', 'ok'); App.render();
  },
  'sort-installments': () => {},
  'statement-print': (el) => {
    const id = el.getAttribute('data-id');
    Print.run(Print.doc('statement', { customerId: id, from: '2000-01-01', to: U.today() }), { size: 'A4' });
  },

  /* المنتجات والمخزون */
  'product-open': (el, ev) => { ev.preventDefault(); App.go('product-open', { id: el.getAttribute('data-id') }); },
  'stock-adjust': (el) => {
    const p = DB.get('products', el.getAttribute('data-id'));
    if (!p) return;
    UI.modal({
      title: 'تسوية الكمية — ' + p.name, icon: '⚖️', narrow: true,
      body: '<div class="stat-line"><div class="sl-t">الكمية الحالية</div><div class="sl-v b">' + U.num(p.qty) + '</div></div>' +
        '<div class="field mt-12"><label>الكمية الفعلية بعد الجرد</label><input class="input" id="adjQty" type="number" value="' + (Number(p.qty) || 0) + '"></div>' +
        '<div class="field mt-8"><label>ملاحظة</label><input class="input" id="adjNote" value="تسوية جرد"></div>',
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 حفظ التسوية', cls: 'primary', handler: (ctx) => {
          Stock.adjust(p.id, Number(ctx.slot.querySelector('#adjQty').value) || 0, ctx.slot.querySelector('#adjNote').value);
          UI.closeModal(); UI.toast('تمت التسوية', 'ok'); App.render();
        } }
      ]
    });
  },
  'product-price': (el) => {
    const p = DB.get('products', el.getAttribute('data-id'));
    if (!p) return;
    if (!Auth.ensure('act.priceEdit', 'تعديل الأسعار يتطلب صلاحية')) return;
    UI.modal({
      title: 'تغيير السعر — ' + p.name, icon: '💲', narrow: true,
      body: '<div class="form-grid"><div class="field"><label>سعر الشراء الحالي</label><input class="input" value="' + U.num(p.cost) + '" disabled></div>' +
        '<div class="field"><label>سعر الشراء الجديد</label><input class="input" id="npCost" type="number" step="250" value="' + (Number(p.cost) || 0) + '"></div>' +
        '<div class="field"><label>سعر البيع الحالي</label><input class="input" value="' + U.num(p.price) + '" disabled></div>' +
        '<div class="field"><label>سعر البيع الجديد</label><input class="input" id="npPrice" type="number" step="250" value="' + (Number(p.price) || 0) + '"></div></div>' +
        '<div class="hint-box mt-12">سيُسجَّل التغيير في «تغيرات الأسعار» مع التاريخ والمستخدم.</div>',
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 حفظ', cls: 'primary', handler: (ctx) => {
          const c = Number(ctx.slot.querySelector('#npCost').value) || 0;
          const pr = Number(ctx.slot.querySelector('#npPrice').value) || 0;
          Stock.setPrice(p.id, 'cost', c); Stock.setPrice(p.id, 'price', pr);
          UI.closeModal(); UI.toast('تم تحديث السعر', 'ok'); App.render();
        } }
      ]
    });
  },
  'stock-count': () => {
    UI.modal({
      title: '⚖️ جرد سريع', icon: '⚖️', wide: true,
      body: '<div class="hint-box mb-12">اكتب الكميات الفعلية ثم احفظ — سيسجّل النظام الفروقات تلقائياً.</div>' +
        '<div class="table-wrap" style="max-height:52vh"><table class="tbl compact"><thead><tr><th>الصنف</th><th class="num">المسجل</th><th style="width:120px">الفعلي</th></tr></thead><tbody>' +
        DB.c('products').map((p) => '<tr><td>' + U.esc(p.name) + '</td><td class="num">' + U.num(p.qty) + '</td>' +
        '<td><input class="input" type="number" data-count-id="' + p.id + '" value="' + (Number(p.qty) || 0) + '"></td></tr>').join('') + '</tbody></table></div>',
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 حفظ الجرد', cls: 'primary', handler: (ctx) => {
          let n = 0;
          U.$$('[data-count-id]', ctx.slot).forEach((inp) => {
            const id = inp.getAttribute('data-count-id');
            const p = DB.get('products', id);
            if (p && Number(inp.value) !== Number(p.qty)){ Stock.adjust(id, Number(inp.value) || 0, 'جرد'); n++; }
          });
          UI.closeModal(); UI.toast('تم حفظ الجرد', 'ok', n + ' صنف تم تعديله'); App.render();
        } }
      ]
    });
  },
  'label-check': (el) => { App.barcodeSel[el.getAttribute('data-id')] = el.checked; },
  'labels-all': () => { DB.c('products').forEach((p) => { App.barcodeSel[p.id] = true; }); App.render(); },
  'labels-none': () => { App.barcodeSel = {}; App.render(); },
  'label-one': (el) => {
    const p = DB.get('products', el.getAttribute('data-id'));
    if (!p) return;
    Print.run(Print.doc('labels', { items: [p], size: App.labelSize, copies: 1 }), { size: 'A4', margins: '8mm' });
  },
  'labels-print': () => {
    const items = DB.c('products').filter((p) => App.barcodeSel[p.id]);
    if (!items.length){ UI.toast('لم تحدّد أي منتج', 'warn'); return; }
    App.labelSize = (document.getElementById('lblSize') || {}).value || App.labelSize;
    App.labelCopies = Number((document.getElementById('lblCopies') || {}).value) || 1;
    Print.run(Print.doc('labels', { items, size: App.labelSize, copies: App.labelCopies }), { size: 'A4', margins: '8mm' });
  },
  'stock-import': () => U.pickFile('.xlsx,.xls,.csv', (file) => Importer.run(file, 'products')),
  'import-products': () => U.pickFile('.xlsx,.xls,.csv', (file) => Importer.run(file, 'products')),
  'import-customers': () => U.pickFile('.xlsx,.xls,.csv', (file) => Importer.run(file, 'customers')),
  'import-template': (el) => Importer.template(el.getAttribute('data-v')),
  'pick-image': (el) => {
    const k = el.getAttribute('data-k');
    U.pickFile('image/*', (file) => {
      if (file.size > 400 * 1024) UI.toast('الصورة كبيرة', 'warn', 'استخدم صورة أصغر من 400KB');
      U.readDataUrl(file).then((url) => {
        const inp = document.querySelector('[data-k="' + k + '"][type="hidden"]');
        if (inp) inp.value = url;
        const prev = document.getElementById('imgPrev_' + k);
        if (prev) prev.innerHTML = '<img src="' + url + '">';
      });
    });
  },
  'clear-image': (el) => {
    const k = el.getAttribute('data-k');
    const inp = document.querySelector('[data-k="' + k + '"][type="hidden"]');
    if (inp) inp.value = '';
    const prev = document.getElementById('imgPrev_' + k);
    if (prev) prev.innerHTML = '🖼️';
  },

  /* الخدمات */
  'maint-next': (el) => {
    const m = DB.get('maintenance', el.getAttribute('data-id'));
    if (!m) return;
    const i = MAINT_FLOW.findIndex((x) => x[0] === m.status);
    const next = MAINT_FLOW[Math.min(MAINT_FLOW.length - 1, i + 1)];
    DB.update('maintenance', m.id, { status: next[0] });
    DB.log('تحديث حالة صيانة', m.no, next[1], 'info');
    UI.toast('الحالة: ' + next[1], 'ok'); App.render();
  },
  'del-next': (el) => {
    const d = DB.get('deliveries', el.getAttribute('data-id'));
    if (!d) return;
    const i = DEL_FLOW.findIndex((x) => x[0] === d.status);
    const next = DEL_FLOW[Math.min(DEL_FLOW.length - 2, i + 1)];
    DB.update('deliveries', d.id, { status: next[0] });
    DB.log('تحديث حالة توصيل', d.no, next[1], 'info');
    UI.toast('الحالة: ' + next[1], 'ok'); App.render();
  },
  'quote-convert': (el) => {
    const q = DB.get('quotes', el.getAttribute('data-id'));
    if (!q) return;
    App.pos.items = (q.items || []).map((i) => ({ ...i }));
    App.pos.customerId = q.customerId || '';
    DB.update('quotes', q.id, { status: 'accepted' });
    App.go('pos');
    UI.toast('تم تحويل العرض إلى سلة بيع', 'ok');
  },
  'quote-print': (el) => {
    const q = DB.get('quotes', el.getAttribute('data-id'));
    if (!q) return;
    const tot = Engine.invoiceTotals(q.items || [], {});
    const html = '<div class="doc ' + Print.sizeClass('A4') + '">' + Print.header({ docTitle: 'عرض سعر', no: q.no, date: q.date }) +
      '<div class="doc-meta"><div><b>الزبون:</b> ' + U.esc((DB.get('customers', q.customerId) || {}).name || '—') + '</div>' +
      '<div><b>صالح حتى:</b> ' + U.dateAr(q.validUntil) + '</div></div>' +
      Print.itemsTable(q.items || [], {}) + Print.totals({ ...tot, total: tot.subtotal }, { label: 'الإجمالي' }) +
      '<div class="doc-terms">هذا العرض صالح حتى ' + U.dateAr(q.validUntil) + ' والأسعار قابلة للتغيير بعده.</div>' + Print.footer({ terms: false }) + '</div>';
    Print.run(html, { size: 'A4' });
  },
  'res-sell': (el) => {
    const r = DB.get('reservations', el.getAttribute('data-id'));
    if (!r || !r.productId) { UI.toast('الحجز لا يحتوي منتجاً', 'warn'); return; }
    POS.add(r.productId, Number(r.qty) || 1);
    DB.update('reservations', r.id, { status: 'done' });
    App.go('pos');
  },
  'task-toggle': (el) => {
    const t = DB.get('tasks', el.getAttribute('data-id'));
    if (!t) return;
    DB.update('tasks', t.id, { done: !t.done });
    App.render();
  },

  /* الموردون */
  'supplier-pay': (el) => {
    const s = DB.get('suppliers', el.getAttribute('data-id'));
    if (!s) return;
    const b = Engine.supplierBalance(DB.state, s.id);
    UI.modal({
      title: 'دفعة للمورد — ' + s.name, icon: '💰', narrow: true,
      body: '<div class="stat-line"><div class="sl-t">المستحق</div><div class="sl-v b">' + U.money(b.remaining) + '</div></div>' +
        '<div class="field mt-12"><label>المبلغ</label><input class="input" id="spAmt" type="number" step="250" value="' + (b.remaining || 0) + '"></div>' +
        '<div class="field mt-8"><label>ملاحظة</label><input class="input" id="spNote" value="دفعة نقدية"></div>',
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 تسجيل الدفعة', cls: 'primary', handler: (ctx) => {
          const amt = Number(ctx.slot.querySelector('#spAmt').value) || 0;
          if (amt <= 0){ UI.toast('أدخل مبلغاً', 'err'); return; }
          DB.add('supplierPayments', { no: DB.docNo('SP', 'supplierPayment'), date: U.today(), supplierId: s.id, amount: amt, note: ctx.slot.querySelector('#spNote').value });
          DB.log('دفعة مورد', s.name, U.money(amt), 'info');
          UI.closeModal(); UI.toast('تم تسجيل الدفعة', 'ok'); App.render();
        } }
      ]
    });
  },
  'supplier-statement': (el) => {
    const s = DB.get('suppliers', el.getAttribute('data-id'));
    if (!s) return;
    const b = Engine.supplierBalance(DB.state, s.id);
    const purs = DB.c('purchases').filter((p) => p.supplierId === s.id).sort((a, x) => String(a.date).localeCompare(String(x.date)));
    const pays = DB.c('supplierPayments').filter((p) => p.supplierId === s.id).sort((a, x) => String(a.date).localeCompare(String(x.date)));
    UI.modal({
      title: 'كشف حساب — ' + s.name, icon: '📑', wide: true,
      body: '<div class="stat-line"><div class="sl-t">إجمالي المشتريات</div><div class="sl-v">' + U.money(b.bought) + '</div></div>' +
        '<div class="stat-line"><div class="sl-t">المدفوع</div><div class="sl-v">' + U.money(b.paid) + '</div></div>' +
        '<div class="stat-line"><div class="sl-t">المتبقي</div><div class="sl-v b" style="color:var(--danger)">' + U.money(b.remaining) + '</div></div>' +
        '<div class="divider"></div>' +
        UI.table({ compact: true, maxHeight: '40vh', columns: [
          { title: 'التاريخ', render: (r) => V.dateCell(r.date) },
          { title: 'البيان', render: (r) => r.no + ' — ' + (r.items ? 'فاتورة شراء' : 'دفعة') },
          { title: 'مدين', cls: 'num', render: (r) => r.total ? U.money(r.total) : '—' },
          { title: 'دائن', cls: 'num', render: (r) => r.amount ? U.money(r.amount) : '—' }
        ], rows: purs.concat(pays).sort((a, x) => String(a.date).localeCompare(String(x.date))) })
    });
  },
  'purchase-print': (el) => {
    const p = DB.get('purchases', el.getAttribute('data-id'));
    if (p) Print.run(Print.doc('purchase', { purchase: p }), { size: 'A4' });
  },

  /* المالية */
  'cashbox-in': () => Cashbox.entry('in'),
  'cashbox-out': () => Cashbox.entry('out'),
  'print-cashbox': () => Docs.print('cashbox'),
  'day-close-do': () => {
    const date = U.today();
    if (DB.c('dayCloses').some((d) => d.date === date)){ UI.toast('اليوم مغلق مسبقاً', 'warn'); return; }
    const countedEl = document.getElementById('closeCounted');
    const counted = Number(countedEl ? countedEl.value : 0);
    const note = (document.getElementById('closeNote') || {}).value || '';
    const box = Engine.cashboxDay(DB.state, date);
    const p = Engine.profitReport(DB.state, date, date);
    DB.add('dayCloses', {
      date, opening: box.opening, cashSales: box.cashSales, cashPayments: box.cashPayments,
      expenses: box.expenses + box.supplierPaid, returns: box.returns, sales: p.revenue,
      expected: box.expected, counted, diff: counted - box.expected, note,
      closedAt: U.now(), userId: (Auth.user() || {}).id, userName: (Auth.user() || {}).name
    }, { branch: false });
    DB.log('إغلاق اليوم', date, 'متوقع ' + U.money(box.expected) + ' / معدود ' + U.money(counted), 'warn');
    UI.toast('تم إغلاق اليوم', 'ok', counted === box.expected ? 'لا يوجد فرق في الصندوق' : 'الفرق: ' + U.money(counted - box.expected));
    App.render();
  },
  'print-daily': (el) => Docs.print('daily', el.getAttribute('data-id')),

  /* التقارير والطباعة */
  'report-set': (el) => App.go('reports', { id: el.getAttribute('data-v') }),
  'report-excel': () => { const f = F.get('reports'); Exporter.one(App.reportId, f.from, f.to, f.q); },
  'report-print': () => {
    const f = F.get('reports');
    const data = Reports.build(App.reportId, f.from, f.to, f.q);
    const html = '<div class="doc size-A4">' + Print.header({ docTitle: 'تقرير ' + data.def.title, date: U.today() }) +
      '<div class="doc-meta"><div><b>الفترة:</b> ' + U.dateAr(f.from) + ' → ' + U.dateAr(f.to) + '</div>' +
      (data.summary || []).map((s) => '<div><b>' + U.esc(s.k) + ':</b> ' + (typeof s.v === 'number' ? U.num(s.v) : U.esc(s.v)) + '</div>').join('') + '</div>' +
      '<table class="doc-tbl"><thead><tr>' + data.columns.map((c) => '<th class="' + (c.type ? 'n' : '') + '">' + U.esc(c.title) + '</th>').join('') + '</tr></thead><tbody>' +
      data.rows.slice(0, 300).map((r) => '<tr>' + data.columns.map((c) => '<td class="' + (c.type ? 'n' : '') + '">' + U.esc(c.type === 'money' ? U.num(r[c.key]) : r[c.key] == null ? '' : r[c.key]) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table>' + Print.footer({ terms: false }) + '</div>';
    Print.run(html, { size: 'A4' });
  },
  'report-pdf': () => { UI.toast('اختر «حفظ كـ PDF» من نافذة الطباعة', 'info'); ACT['report-print'](); },
  'excel-one': (el) => { const f = F.get('excel'); Exporter.one(el.getAttribute('data-v'), f.from, f.to, ''); },
  'csv-one': (el) => { const f = F.get('excel'); Exporter.csv(el.getAttribute('data-v'), f.from, f.to, ''); },
  'excel-all': () => { const f = F.get('excel'); Exporter.all(f.from, f.to); },
  'export-sales': () => Exporter.one('sales', F.get('sales').from, F.get('sales').to, F.get('sales').q),
  'export-installments': () => Exporter.one('installments', '2000-01-01', U.today(), ''),
  'export-payments': () => Exporter.one('payments', F.get('payments').from, F.get('payments').to, ''),
  'export-price-changes': () => {
    const pMap = DB.byId('products');
    const rows = DB.c('priceHistory').map((h) => ({ product: (pMap[h.productId] || {}).name || '', field: h.field === 'cost' ? 'سعر الشراء' : 'سعر البيع', date: h.date, from: h.from, to: h.to, diff: (Number(h.to) - Number(h.from)) }));
    XLSX.download('تغيرات الأسعار', [{ name: 'تغيرات الأسعار', columns: [{ key: 'date', title: 'التاريخ', width: 13 }, { key: 'product', title: 'المنتج', width: 28 }, { key: 'field', title: 'الحقل', width: 14 }, { key: 'from', title: 'من', type: 'money', width: 14 }, { key: 'to', title: 'إلى', type: 'money', width: 14 }, { key: 'diff', title: 'الفرق', type: 'money', width: 14 }], rows }]);
  },
  'export-profits': () => Exporter.one('profits', F.get('profits').from, F.get('profits').to, ''),
  'export-statements': () => Exporter.one('customers', '2000-01-01', U.today(), ''),
  'export-audit': () => {
    const rows = DB.c('audit').map((a) => ({ at: a.at, user: a.userName, action: a.action, target: a.target, details: a.details }));
    XLSX.download('سجل العمليات', [{ name: 'السجل', columns: [{ key: 'at', title: 'الوقت', width: 18 }, { key: 'user', title: 'المستخدم', width: 18 }, { key: 'action', title: 'العملية', width: 22 }, { key: 'target', title: 'الهدف', width: 22 }, { key: 'details', title: 'التفاصيل', width: 26 }], rows }]);
  },
  'print-installments': () => Docs.print('installments'),
  'print-deliveries': () => {
    const today = U.today();
    const list = DB.c('deliveries').filter((d) => d.scheduleAt === today || (!d.scheduleAt && d.date === today));
    const html = '<div class="doc size-A4">' + Print.header({ docTitle: 'جدول توصيلات اليوم', date: today }) +
      '<table class="doc-tbl"><thead><tr><th>#</th><th>الزبون</th><th>الهاتف</th><th>العنوان</th><th>الأجرة</th><th>الحالة</th></tr></thead><tbody>' +
      (list.map((d, i) => '<tr><td>' + (i + 1) + '</td><td>' + U.esc(d.customerName || '') + '</td><td>' + U.esc(d.phone || '') + '</td><td>' + U.esc(d.address || '') + '</td><td class="n">' + U.num(d.fee || 0) + '</td><td>' + U.esc((DEL_FLOW.find((x) => x[0] === d.status) || [])[1] || '') + '</td></tr>').join('') || '<tr><td colspan="6" class="doc-center">لا توصيلات اليوم</td></tr>') +
      '</tbody></table>' + Print.footer({ terms: false }) + '</div>';
    Print.run(html, { size: 'A4' });
  },
  'print-range': (el) => Docs.print(el.getAttribute('data-type')),
  'print-doc': (el) => Docs.print(el.getAttribute('data-v')),

  /* الإدارة */
  'admin-tab': (el) => App.go('admin', { tab: el.getAttribute('data-v') }),
  'admin-save': () => Admin.save(document),
  'admin-reset-form': () => App.render(),
  'theme-toggle': (el) => { S().ui.theme = el.checked ? 'dark' : 'light'; DB.setPref('theme', S().ui.theme); DB.save(); App.applySettings(); },
  'accent': (el) => { S().ui.accent = el.getAttribute('data-v'); DB.setPref('accent', S().ui.accent); DB.save(); App.applySettings(); App.render(); },
  'fontsize': (el) => { S().ui.fontSize = el.getAttribute('data-v'); DB.setPref('fontSize', S().ui.fontSize); DB.save(); App.applySettings(); App.render(); },
  'density': (el) => { S().ui.density = el.getAttribute('data-v'); DB.setPref('density', S().ui.density); DB.save(); App.applySettings(); App.render(); },
  'sounds-toggle': (el) => { S().ui.sounds = el.checked; DB.save(); },
  'pick-logo': () => U.pickFile('image/*', (file) => U.readDataUrl(file).then((url) => {
    ST().logo = url; DB.save(true); App.applySettings(); App.render(); UI.toast('تم تحديث الشعار', 'ok');
  })),
  'clear-logo': () => { ST().logo = ''; DB.save(true); App.applySettings(); App.render(); },
  'add-month': () => {
    const inp = document.getElementById('newMonth');
    const m = Number(inp ? inp.value : 0);
    if (!m || m < 1 || m > 60){ UI.toast('أدخل عدد أشهر صحيح', 'err'); return; }
    const arr = S().installments.months || [];
    if (!arr.includes(m)) arr.push(m);
    S().installments.months = arr.sort((a, b) => a - b);
    DB.save(true); UI.toast('تمت الإضافة', 'ok'); App.render();
  },
  'invoice-sample': () => {
    const sample = {
      no: 'INV-0001', date: U.today(), time: '10:30', verify: 'ABC123', customerId: (DB.c('customers')[0] || {}).id,
      subtotal: 1000000, lineDiscount: 0, discount: 0, tax: 0, total: 1000000, paid: 1000000, method: 'cash',
      items: [{ name: 'ثلاجة سامسونج 18 قدم', code: 'P-0001', qty: 1, price: 1000000, discount: 0, serial: 'SN-DEMO' }],
      branchId: DB.branchId(), userId: (Auth.user() || {}).id, status: 'active'
    };
    Print.preview(Print.doc('invoice', { invoice: sample }), { size: S().invoice.size });
  },
  'user-new': () => Users.open(null),
  'user-edit': (el) => Users.open(el.getAttribute('data-id')),
  'user-perms': (el) => Users.perms(el.getAttribute('data-id')),
  'user-del': async (el) => {
    if (!Auth.ensure('act.users')) return;
    const u = DB.get('users', el.getAttribute('data-id'));
    if (!u) return;
    if (u.role === 'admin' && DB.c('users').filter((x) => x.role === 'admin').length <= 1){ UI.toast('لا يمكن حذف آخر مدير', 'err'); return; }
    const ok = await UI.confirm('حذف مستخدم', 'سيتم حذف «' + u.name + '» ولن يستطيع الدخول.', { danger: true, okLabel: '🗑️ حذف' });
    if (!ok) return;
    DB.remove('users', u.id);
    DB.log('حذف مستخدم', u.name, '', 'warn');
    UI.toast('تم الحذف', 'ok'); App.render();
  },
  'change-pass': () => {
    const o = (document.getElementById('secOld') || {}).value;
    const n1 = (document.getElementById('secNew') || {}).value;
    const n2 = (document.getElementById('secNew2') || {}).value;
    if (n1 !== n2){ UI.toast('كلمتا المرور غير متطابقتين', 'err'); return; }
    const res = Auth.changePass((Auth.user() || {}).id, o, n1);
    UI.toast(res.ok ? 'تم تغيير كلمة المرور' : 'تعذّر التغيير', res.ok ? 'ok' : 'err', res.msg || '');
    if (res.ok) App.render();
  },
  'logout-all': async () => {
    const ok = await UI.confirm('إنهاء كل الجلسات', 'سيُطلب تسجيل الدخول من كل الأجهزة.', { danger: true });
    if (!ok) return;
    DB.state.sessions = []; DB.save(true); UI.toast('تم إنهاء الجلسات', 'ok'); App.render();
  },
  'audit-clear': async () => {
    const ok = await UI.confirm('تفريغ السجل', 'سيتم حذف كل سجل العمليات.', { danger: true });
    if (!ok) return;
    DB.state.audit = []; DB.save(true); UI.toast('تم تفريغ السجل', 'ok'); App.render();
  },
  'backup-now': () => {
    const json = DB.backupJSON();
    U.download('bayti-backup-' + U.today() + '.json', U.blob(json, 'application/json'));
    Admin.set('backup.lastBackup', U.now()); DB.save(true);
    DB.log('نسخة احتياطية', '', U.num(Math.round(json.length / 1024)) + ' KB', 'ok');
    UI.toast('تم إنشاء النسخة الاحتياطية', 'ok'); App.render();
  },
  'backup-restore': () => U.pickFile('.json', (file) => {
    U.readText(file).then(async (txt) => {
      const ok = await UI.confirm('استعادة البيانات', 'سيتم استبدال كل البيانات الحالية بمحتوى الملف.', { danger: true, okLabel: '📂 استعادة' });
      if (!ok) return;
      try{
        const res = DB.restoreJSON(txt);
        DB.log('استعادة نسخة احتياطية', '', '', 'warn');
        UI.toast('تمت الاستعادة', 'ok');
        App.applySettings();
        /* إن لم يعد المستخدم الحالي موجوداً في البيانات المستعادة نرجعه لشاشة الدخول */
        if (res && res.logged === false) App.showLogin(); else App.start();
      }catch(e){ UI.toast('ملف غير صالح', 'err', e.message); }
    });
  }),
  'load-demo': async () => {
    const ok = await UI.confirm('تحميل بيانات تجريبية', 'ستُضاف منتجات وزبائن وفواتير وأقساط للتجربة.', { okLabel: '🧪 تحميل' });
    if (ok) Seed.build();
  },
  'reset-data': async () => {
    const ok = await UI.confirm('تفريغ البيانات', 'سيتم حذف كل الفواتير والزبائن والمنتجات مع الإبقاء على الإعدادات.', { danger: true, okLabel: '🧹 تفريغ' });
    if (!ok) return;
    const session = DB.state.session;
    DB.reset(false);
    DB.state.session = session; DB.flush();
    UI.toast('تم تفريغ البيانات', 'ok'); App.start();
  },
  'reset-all': async () => {
    const ok = await UI.confirm('إعادة ضبط كاملة', 'سيُحذف كل شيء包括 الإعدادات ويعود النظام كأنه جديد.', { danger: true, okLabel: '⛔ إعادة ضبط' });
    if (!ok) return;
    DB.reset(true);
    UI.toast('تمت إعادة الضبط', 'ok');
    App.applySettings(); App.showLogin();
  },
  'branch-new': () => Branches.open(null),
  'branch-edit': (el) => Branches.open(el.getAttribute('data-id')),
  'branch-del': async (el) => {
    const id = el.getAttribute('data-id');
    if (DB.state.branches.length <= 1){ UI.toast('لا يمكن حذف الفرع الوحيد', 'err'); return; }
    const ok = await UI.confirm('حذف فرع', 'ستبقى العمليات المرتبطة به لكن لن يظهر في القائمة.', { danger: true });
    if (!ok) return;
    DB.state.branches = DB.state.branches.filter((b) => b.id !== id);
    if (DB.state.currentBranch === id) DB.state.currentBranch = 'all';
    DB.save(true); UI.toast('تم الحذف', 'ok'); App.start();
  },
  'transfer-do': () => {
    const pid = (document.getElementById('trProduct') || {}).value;
    const from = (document.getElementById('trFrom') || {}).value;
    const to = (document.getElementById('trTo') || {}).value;
    const qty = Number((document.getElementById('trQty') || {}).value) || 0;
    if (!pid || qty <= 0){ UI.toast('اختر منتجاً وكمية صحيحة', 'err'); return; }
    if (from === to){ UI.toast('الفرعان متطابقان', 'err'); return; }
    const p = DB.get('products', pid);
    DB.c('stockMoves').unshift({ id: U.id('mv'), at: U.now(), productId: pid, type: 'adjust', qty: -qty, ref: '', note: 'نقل إلى ' + DB.branchName(to), branchId: from });
    DB.c('stockMoves').unshift({ id: U.id('mv'), at: U.now(), productId: pid, type: 'adjust', qty: qty, ref: '', note: 'منقول من ' + DB.branchName(from), branchId: to });
    p.branchId = to;
    DB.save(true);
    DB.log('نقل مخزون', p.name, U.num(qty) + ' من ' + DB.branchName(from) + ' إلى ' + DB.branchName(to), 'info');
    UI.toast('تم النقل', 'ok'); App.render();
  },
  'invoice-print-size': () => {}
};

/* ------------------------------------------------- أحداث الإدخال والتغيير */
const IN = {
  'search': U.debounce((el) => F.set(el.getAttribute('data-route'), { q: el.value, page: 1 }), 260),
  'pos-search': U.debounce((el) => {
    App.posFilter.q = el.value;
    const p = POS.findByBarcode(el.value);
    if (p){ POS.add(p.id, 1); App.posFilter.q = ''; UI.toast('أُضيف: ' + p.name, 'ok'); }
    else App.render();
  }, 320)
};
const CH = {
  'from': (el) => F.set(el.getAttribute('data-route'), { from: el.value, page: 1 }),
  'to': (el) => F.set(el.getAttribute('data-route'), { to: el.value, page: 1 }),
  'sort-installments': (el) => F.set('installments', { sort: el.value, page: 1 }),
  'sort-stock': (el) => F.set('stock', { sort: el.value }),
  'cashbox-date': (el) => { F.get('cashbox').date = el.value; App.render(); },
  'label-check': (el) => { App.barcodeSel[el.getAttribute('data-id')] = el.checked; },
  'pos-qty-set': (el) => {
    const i = Number(el.getAttribute('data-i'));
    if (App.pos.items[i]){ App.pos.items[i].qty = Math.max(1, Number(el.value) || 1); App.render(); }
  },
  'ie-product': (el) => ItemsEditor.sync(UI.modalCtx, Number(el.getAttribute('data-i')), { productId: el.value }),
  'ie-qty': (el) => ItemsEditor.sync(UI.modalCtx, Number(el.getAttribute('data-i')), { qty: Number(el.value) || 0 }),
  'ie-price': (el) => {
    const c = UI.modalCtx; const k = (c.data.opt && c.data.opt.priceKey) || 'price';
    const patch = {}; patch[k] = Number(el.value) || 0;
    ItemsEditor.sync(c, Number(el.getAttribute('data-i')), patch);
  },
  'ie-disc': (el) => ItemsEditor.sync(UI.modalCtx, Number(el.getAttribute('data-i')), { discount: Number(el.value) || 0 })
};

/* ------------------------------------------------------- الصندوق والطباعة */
const Cashbox = {
  entry(type){
    UI.modal({
      title: type === 'in' ? '＋ إيداع في الصندوق' : '− سحب من الصندوق', icon: type === 'in' ? '💰' : '💸', narrow: true,
      body: UI.form([
        { key: 'category', label: 'البند', required: true, value: type === 'in' ? 'رصيد مُرحّل' : 'سحب نقدي' },
        { key: 'amount', label: 'المبلغ', type: 'money', required: true, value: 0 },
        { key: 'date', label: 'التاريخ', type: 'date', value: U.today() },
        { key: 'note', label: 'ملاحظة', full: true }
      ], { date: U.today() }),
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 حفظ', cls: 'primary', handler: (ctx) => {
          const f = [{ key: 'category', label: 'البند', required: true }, { key: 'amount', label: 'المبلغ', type: 'money', required: true }, { key: 'date', label: 'التاريخ', type: 'date' }, { key: 'note', label: 'ملاحظة' }];
          const d = UI.readForm(ctx.slot, f);
          if (!d.category || !(Number(d.amount) > 0)){ UI.toast('أكمل البند والمبلغ', 'err'); return; }
          DB.add('cashbox', { ...d, type, time: new Date().toTimeString().slice(0, 5), userId: (Auth.user() || {}).id });
          DB.log(type === 'in' ? 'إيداع صندوق' : 'سحب صندوق', d.category, U.money(d.amount), 'info');
          UI.closeModal(); UI.toast('تم الحفظ', 'ok'); App.render();
        } }
      ]
    });
  }
};

const Docs = {
  print(kind, arg){
    const t = U.today();
    if (kind === 'daily'){
      const date = arg || t;
      Print.run(Print.doc('daily', { title: 'التقرير اليومي', from: date, to: date, cashbox: Engine.cashboxDay(DB.state, date), date }), { size: 'A4' });
    } else if (kind === 'monthly'){
      const from = U.startOfMonth(t);
      Print.run(Print.doc('monthly', { title: 'التقرير الشهري', from, to: t, date: t }), { size: 'A4' });
    } else if (kind === 'installments'){
      const rows = DB.c('plans').filter((p) => p.status !== 'void').map((plan) => ({ plan }));
      Print.run(Print.doc('installments', { rows }), { size: 'A4' });
    } else if (kind === 'statement'){
      const list = DB.c('customers');
      if (!list.length){ UI.toast('لا زبائن', 'warn'); return; }
      UI.modal({
        title: 'اختر الزبون', icon: '📑', narrow: true,
        body: '<div class="field"><label>الزبون</label><select class="select" id="stSel">' +
          list.map((c) => '<option value="' + c.id + '">' + U.esc(c.name) + '</option>').join('') + '</select></div>',
        actions: [
          { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
          { label: '🖨️ طباعة', cls: 'primary', handler: (ctx) => {
            const id = ctx.slot.querySelector('#stSel').value;
            UI.closeModal();
            Print.run(Print.doc('statement', { customerId: id, from: '2000-01-01', to: U.today() }), { size: 'A4' });
          } }
        ]
      });
    } else if (kind === 'cashbox'){
      const date = F.get('cashbox').date || t;
      Print.run(Print.doc('daily', { title: 'تقرير الصندوق', from: date, to: date, cashbox: Engine.cashboxDay(DB.state, date), date }), { size: 'A4' });
    } else if (kind === 'labels'){
      App.go('barcode');
    }
  }
};

const Branches = {
  open(id){
    const b = id ? DB.state.branches.find((x) => x.id === id) : null;
    UI.modal({
      title: b ? 'تعديل فرع' : 'فرع جديد', icon: '🏬', narrow: true,
      body: UI.form([
        { key: 'name', label: 'اسم الفرع', required: true },
        { key: 'phone', label: 'الهاتف' },
        { key: 'address', label: 'العنوان', full: true }
      ], b || {}),
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 حفظ', cls: 'primary', handler: (ctx) => {
          const f = [{ key: 'name', label: 'الاسم', required: true }, { key: 'phone', label: 'الهاتف' }, { key: 'address', label: 'العنوان' }];
          const d = UI.readForm(ctx.slot, f);
          if (!d.name){ UI.toast('اسم الفرع مطلوب', 'err'); return; }
          if (b) Object.assign(b, d);
          else DB.state.branches.push({ id: U.id('br'), ...d, active: true });
          DB.save(true); DB.log(b ? 'تعديل فرع' : 'إضافة فرع', d.name, '', 'info');
          UI.closeModal(); UI.toast('تم الحفظ', 'ok'); App.start();
        } }
      ]
    });
  }
};

/* --------------------------------------------------------- أزرار الشريط */
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  UI.on(document.getElementById('menuBtn'), 'click', () => App.openSidebar());
  UI.on(document.getElementById('sideClose'), 'click', () => App.closeSidebar());
  UI.on(document.getElementById('scrim'), 'click', () => App.closeSidebar());
  UI.on(document.getElementById('alertsBtn'), 'click', () => App.go('alerts'));
  UI.on(document.getElementById('posBtn'), 'click', () => App.go('pos'));
  UI.on(document.getElementById('themeBtn'), 'click', () => {
    S().ui.theme = S().ui.theme === 'dark' ? 'light' : 'dark';
    DB.setPref('theme', S().ui.theme); DB.save(); App.applySettings(); App.render();
  });
  UI.on(document.getElementById('branchBtn'), 'click', (e) => {
    const items = [{ title: 'عرض حسب الفرع' }].concat(
      [{ label: 'كل الفروع', icon: '🌐', fn: () => { DB.state.currentBranch = 'all'; DB.save(true); App.start(); } }],
      DB.state.branches.map((b) => ({ label: b.name, icon: '🏬', fn: () => { DB.state.currentBranch = b.id; DB.save(true); App.start(); } }))
    );
    UI.dropdown(e.currentTarget, items);
  });
  UI.on(document.getElementById('sideUser'), 'click', (e) => {
    UI.dropdown(e.currentTarget, [
      { title: (Auth.user() || {}).name },
      { label: 'تغيير كلمة المرور', icon: '🔑', fn: () => App.go('admin', { tab: 'security' }) },
      { label: 'الإعدادات', icon: '⚙️', fn: () => App.go('admin', { tab: 'store' }) },
      { label: 'نسخة احتياطية', icon: '💾', fn: () => ACT['backup-now']() },
      { sep: true },
      { label: 'تسجيل الخروج', icon: '🚪', danger: true, fn: () => { Auth.logout(); App.showLogin(); } }
    ]);
  });
  UI.on(document.getElementById('gs'), 'input', U.debounce((e) => App.globalSearch(e.target.value), 200));
  UI.on(document.getElementById('gs'), 'keydown', (e) => {
    if (e.key === 'Enter'){
      const first = document.querySelector('#gsResults .sr-item');
      if (first) first.click();
    }
  });
  if (window.matchMedia('(max-width:960px)').matches){
    const sc = document.getElementById('sideClose');
    if (sc) sc.style.display = 'grid';
  }
});
