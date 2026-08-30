/* ============================================================================
   02) قاعدة البيانات — تخزين محلي في المتصفح (localStorage) مع مزامنة التبويبات
   ========================================================================== */
const DB = {
  KEY: 'bayti.pos.v1',
  PREF: 'bayti.prefs.v1',
  COLLECTIONS: ['users','sessions','audit','branches','categories','products','priceHistory','stockMoves',
    'customers','invoices','plans','payments','returns','quotes','reservations','suppliers','purchases',
    'supplierPayments','warranties','maintenance','deliveries','exchanges','expenses','cashbox','dayCloses',
    'offers','tasks','techs','drivers'],
  COUNTERS: ['invoice','payment','purchase','quote','reservation','return','maintenance','delivery',
    'exchange','customer','product','warranty','receipt','supplier'],
  state: null,
  dirty: false,

  defaults(){
    return {
      version: 1,
      createdAt: U.now(),
      settings: {
        store: {
          name: 'بيتي', subtitle: 'للمواد والأجهزة المنزلية', logo: '', address: '', phone: '',
          email: '', manager: '', taxNo: '', invoiceFooter: 'شكراً لتسوقكم معنا — البضاعة المباعة لا ترد ولا تستبدل إلا خلال 3 أيام وبحالتها الأصلية.',
          saleTerms: 'البيع بالتقسيط يتطلب هوية أحوال مدنية سارية وكفيلاً عند تجاوز المبلغ 1,000,000 د.ع.',
          returnTerms: 'يحق للزبون الإرجاع خلال 3 أيام من تاريخ الشراء بشرط سلامة الجهاز وملحقاته.'
        },
        ui: { theme: 'light', accent: 'blue', density: 'normal', fontSize: 'm', lang: 'ar', sidebar: 'expanded', sounds: false },
        locale: { currency: 'IQD', currencySymbol: 'د.ع', country: 'IQ' },
        sales: { defaultMargin: 25, allowDiscount: true, maxDiscount: 20, taxRate: 0, roundTo: 250, minPrice: 0, askSerial: true, autoWarranty: true },
        installments: {
          minDownPercent: 20, maxMonths: 24, months: [3, 6, 10, 12, 18, 24], dueDay: 15,
          lateFee: 0, lateGraceDays: 3, alertDays: 3, requireDown: true, suspendOnOverdue: true
        },
        stock: { lowStockAlert: true, deadStockDays: 90, reorderPolicy: 'min' },
        warranty: { alertDays: 30, defaultMonths: 12 },
        invoice: { size: 'A4', showLogo: true, showQR: false, showBarcode: true, showWords: true, showTerms: true, signature: '', copies: 1, accent: '#172033', title: 'فاتورة بيع' },
        print: { size: 'A4', margins: '10mm', orientation: 'portrait', copies: 1, printer: '', showLogo: true, showStamp: true, autoPrint: false },
        backup: { autoReminderDays: 7, lastBackup: '' }
      },
      branches: [{ id: 'br1', name: 'المقر الرئيسي', address: '', phone: '', active: true }],
      currentBranch: 'all',
      users: [{
        id: 'u_admin', name: 'المدير العام', username: 'admin', pass: '1234', role: 'admin',
        perms: {}, active: true, phone: '', createdAt: U.now(), mustChange: true
      }],
      sessions: [],
      audit: [],
      counters: {},
      categories: [
        { id: 'c1', name: 'ثلاجات', icon: '🧊', color: '#2563EB' },
        { id: 'c2', name: 'غسالات', icon: '🌀', color: '#0D9488' },
        { id: 'c3', name: 'طباخات وأفران', icon: '🔥', color: '#F59E0B' },
        { id: 'c4', name: 'مكيفات', icon: '❄️', color: '#0EA5E9' },
        { id: 'c5', name: 'تلفزيونات', icon: '📺', color: '#7C3AED' },
        { id: 'c6', name: 'أجهزة صغيرة', icon: '🔌', color: '#DC2626' }
      ],
      products: [], priceHistory: [], stockMoves: [],
      customers: [], invoices: [], plans: [], payments: [], returns: [], quotes: [], reservations: [],
      suppliers: [], purchases: [], supplierPayments: [],
      warranties: [], maintenance: [], deliveries: [], exchanges: [],
      expenses: [], cashbox: [], dayCloses: [], offers: [], tasks: [],
      techs: [{ id: 't1', name: 'الفني الأول', phone: '' }],
      drivers: [{ id: 'd1', name: 'السائق الأول', phone: '' }],
      session: null,
      seeded: false
    };
  },

  load(){
    let raw = null;
    try { raw = localStorage.getItem(DB.KEY); } catch(e){ raw = null; }
    if (raw){
      try{
        const parsed = JSON.parse(raw);
        DB.state = DB.migrate(parsed);
      }catch(e){
        console.warn('تعذّر قراءة البيانات المحفوظة، سيتم البدء من جديد', e);
        DB.state = DB.defaults();
      }
    } else {
      DB.state = DB.defaults();
    }
    DB.applyPrefs();
    return DB.state;
  },

  migrate(d){
    const base = DB.defaults();
    const st = Object.assign({}, base, d || {});
    st.settings = DB.deepMerge(base.settings, (d && d.settings) || {});
    st.settings.store = DB.deepMerge(base.settings.store, (d && d.settings && d.settings.store) || {});
    DB.COLLECTIONS.forEach((c) => { if (!Array.isArray(st[c])) st[c] = []; });
    if (!st.counters || typeof st.counters !== 'object') st.counters = {};
    if (!st.branches || !st.branches.length) st.branches = base.branches;
    if (!st.users || !st.users.length) st.users = base.users;
    if (!st.categories || !st.categories.length) st.categories = base.categories;
    st.version = base.version;
    return st;
  },
  deepMerge(a, b){
    const out = Object.assign({}, a);
    Object.keys(b || {}).forEach((k) => {
      const v = b[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) out[k] = DB.deepMerge(a[k], v);
      else if (v !== undefined && v !== null) out[k] = v;
    });
    return out;
  },

  save(immediate){
    DB.dirty = true;
    if (immediate) return DB.flush();
    clearTimeout(DB._t);
    DB._t = setTimeout(() => DB.flush(), 350);
  },
  flush(){
    clearTimeout(DB._t);
    try{
      const st = JSON.parse(JSON.stringify(DB.state));
      st.session = null; st._ts = Date.now();
      localStorage.setItem(DB.KEY, JSON.stringify(st));
      DB.dirty = false;
      return true;
    }catch(e){
      console.error(e);
      if (UI && UI.toast) UI.toast('تعذّر الحفظ — الذاكرة ممتلئة', 'err', 'جرّب تصغير حجم الصور أو أخذ نسخة احتياطية ثم تفريغ السجلات.');
      return false;
    }
  },
  storageSize(){
    try { return (localStorage.getItem(DB.KEY) || '').length; } catch(e){ return 0; }
  },

  /* ---- وصول المجموعات ---- */
  c(name){ return DB.state[name] || (DB.state[name] = []); },
  get(name, id){ return DB.c(name).find((x) => x.id === id) || null; },
  add(name, obj, opts){
    const rec = Object.assign({ id: obj.id || U.id(name.slice(0, 3)), createdAt: U.now() }, obj);
    if (!opts || opts.branch !== false) if (!rec.branchId) rec.branchId = DB.branchId();
    DB.c(name).push(rec);
    DB.save();
    return rec;
  },
  update(name, id, patch){
    const rec = DB.get(name, id);
    if (!rec) return null;
    Object.assign(rec, patch);
    DB.save();
    return rec;
  },
  remove(name, id){
    const arr = DB.c(name); const i = arr.findIndex((x) => x.id === id);
    if (i < 0) return false;
    arr.splice(i, 1); DB.save(); return true;
  },
  find(name, fn){ return DB.c(name).filter(fn); },
  byId(name){ const m = {}; DB.c(name).forEach((x) => { m[x.id] = x; }); return m; },

  /* ---- الترقيم التسلسلي ---- */
  nextNo(key){
    const n = (DB.state.counters[key] = (DB.state.counters[key] || 0) + 1);
    DB.save();
    return n;
  },
  setNo(key, n){ DB.state.counters[key] = Math.max(DB.state.counters[key] || 0, n); DB.save(); },
  docNo(prefix, key){ return prefix + '-' + String(DB.nextNo(key)).padStart(4, '0'); },

  /* ---- الفروع ---- */
  branchId(){
    const cur = DB.state.currentBranch;
    if (cur && cur !== 'all') return cur;
    return (DB.state.branches[0] || {}).id || 'br1';
  },
  branchName(id){ const b = DB.state.branches.find((x) => x.id === id); return b ? b.name : '—'; },
  inBranch(rec){
    const cur = DB.state.currentBranch;
    if (!cur || cur === 'all') return true;
    return !rec || !rec.branchId || rec.branchId === cur;
  },

  /* ---- سجل النشاط ---- */
  log(action, target, details, level){
    const u = Auth.user();
    DB.c('audit').unshift({
      id: U.id('a'), at: U.now(), userId: u ? u.id : 'system', userName: u ? u.name : 'النظام',
      action, target: target || '', details: details || '', level: level || 'info'
    });
    const arr = DB.c('audit');
    if (arr.length > 4000) arr.length = 4000;
    DB.save();
  },

  /* ---- نسخ احتياطي ---- */
  backupJSON(){
    const st = JSON.parse(JSON.stringify(DB.state));
    st.session = null;
    return JSON.stringify({ app: 'bayti-pos', version: st.version, exportedAt: U.now(), data: st }, null, 0);
  },
  restoreJSON(text){
    const obj = JSON.parse(text);
    const data = obj && obj.data ? obj.data : obj;
    if (!data || typeof data !== 'object' || !Array.isArray(data.products)) throw new Error('ملف غير صالح');
    /* النسخة الاحتياطية لا تحمل جلسة دخول (حتى لا تنتقل بين الأجهزة)،
       لذلك نُبقي جلسة المستخدم الحالي إن كان موجوداً في البيانات المستعادة */
    const keepId = DB.state.session ? DB.state.session.userId : '';
    const next = DB.migrate(data);
    const me = keepId ? (next.users || []).find((u) => u.id === keepId && u.active !== false) : null;
    next.session = me ? { userId: me.id, at: U.now(), sid: U.id('s') } : null;
    DB.state = next;
    DB.flush();
    return { ok: true, logged: !!next.session };
  },
  reset(hard){
    const keepSettings = !hard ? DB.state.settings : null;
    const keepStore = !hard ? DB.state.settings.store : null;
    DB.state = DB.defaults();
    if (keepSettings){ DB.state.settings = keepSettings; DB.state.settings.store = keepStore; }
    DB.flush();
  },

  /* ---- تفضيلات الواجهة (محفوظة منفصلة حتى لا تُفقد مع إعادة التعيين) ---- */
  prefs(){
    try { return JSON.parse(localStorage.getItem(DB.PREF) || '{}'); } catch(e){ return {}; }
  },
  setPref(k, v){
    const p = DB.prefs(); p[k] = v;
    try { localStorage.setItem(DB.PREF, JSON.stringify(p)); } catch(e){}
  },
  applyPrefs(){
    const p = DB.prefs();
    const ui = DB.state.settings.ui;
    if (p.theme) ui.theme = p.theme;
    if (p.accent) ui.accent = p.accent;
    if (p.density) ui.density = p.density;
    if (p.fontSize) ui.fontSize = p.fontSize;
    if (p.lastRoute) DB.state._lastRoute = p.lastRoute;
  },
  syncFromStorage(e){
    if (!e || e.key !== DB.KEY || !e.newValue) return;
    try{
      const st = JSON.parse(e.newValue);
      if (st._ts && st._ts !== DB.state._ts){
        const session = DB.state.session;
        DB.state = DB.migrate(st);
        DB.state.session = session;
        if (window.App && App.refresh) App.refresh();
      }
    }catch(err){}
  },

  /* ---- بيانات تجريبية (اختياري — من شاشة الإدارة) ---- */
  seed(){ return Seed.build(); }
};

function S(){ return DB.state.settings; }
function ST(){ return DB.state.settings.store; }
