/* ============================================================================
   07) المستخدمون والصلاحيات والجلسات
   ========================================================================== */
const PERMS = {
  dashboard: { t: 'لوحة التحكم', g: 'الإدارة' },
  alerts: { t: 'التنبيهات', g: 'الإدارة' },
  tasks: { t: 'مهام اليوم', g: 'الإدارة' },
  calendar: { t: 'التقويم المالي', g: 'الإدارة' },
  pos: { t: 'نقطة البيع', g: 'المبيعات' },
  sales: { t: 'جميع المبيعات', g: 'المبيعات' },
  quotes: { t: 'عروض الأسعار', g: 'المبيعات' },
  reservations: { t: 'الحجوزات', g: 'المبيعات' },
  returns: { t: 'المرتجعات', g: 'المبيعات' },
  customers: { t: 'الزبائن', g: 'العملاء' },
  installments: { t: 'الأقساط', g: 'العملاء' },
  payments: { t: 'التسديدات', g: 'العملاء' },
  statements: { t: 'كشوف الحساب', g: 'العملاء' },
  products: { t: 'المنتجات', g: 'المخزون' },
  categories: { t: 'الأقسام', g: 'المخزون' },
  stock: { t: 'المخزون', g: 'المخزون' },
  barcode: { t: 'الباركود', g: 'المخزون' },
  purchases: { t: 'المشتريات', g: 'المشتريات' },
  suppliers: { t: 'الموردين', g: 'المشتريات' },
  warranties: { t: 'الضمان', g: 'الخدمات' },
  maintenance: { t: 'الصيانة', g: 'الخدمات' },
  deliveries: { t: 'التوصيل', g: 'الخدمات' },
  cashbox: { t: 'الصندوق', g: 'المالية' },
  expenses: { t: 'المصاريف', g: 'المالية' },
  profits: { t: 'الأرباح', g: 'المالية' },
  dayclose: { t: 'إغلاق اليوم', g: 'المالية' },
  reports: { t: 'التقارير', g: 'التقارير' },
  excel: { t: 'مركز Excel', g: 'التقارير' },
  print: { t: 'مركز الطباعة', g: 'التقارير' },
  insights: { t: 'الذكاء والتحليل', g: 'التقارير' },
  admin: { t: 'الإدارة والإعدادات', g: 'النظام' },
  /* صلاحيات عمليات (ليست صفحات) */
  'act.discount': { t: 'منح خصم', g: 'عمليات' },
  'act.void': { t: 'إلغاء فاتورة', g: 'عمليات' },
  'act.delete': { t: 'حذف السجلات', g: 'عمليات' },
  'act.cost': { t: 'رؤية الكلفة والربح', g: 'عمليات' },
  'act.priceEdit': { t: 'تعديل الأسعار', g: 'عمليات' },
  'act.editClosed': { t: 'تعديل عمليات يوم مغلق', g: 'عمليات' },
  'act.users': { t: 'إدارة المستخدمين', g: 'عمليات' },
  'act.backup': { t: 'النسخ الاحتياطي والاستعادة', g: 'عمليات' }
};

const ROLES = {
  admin: { t: 'مدير', desc: 'كل الصلاحيات' },
  sales: { t: 'مبيعات', desc: 'البيع والفواتير والزبائن' },
  accountant: { t: 'محاسب', desc: 'التسديدات والحسابات والتقارير' },
  store: { t: 'مخزن', desc: 'المنتجات والمخزون والمشتريات' }
};

const ROLE_PERMS = {
  admin: null, /* كل شيء */
  sales: ['dashboard','alerts','tasks','calendar','pos','sales','quotes','reservations','returns','customers','installments','payments','deliveries','print','act.discount','act.delete'],
  accountant: ['dashboard','alerts','tasks','calendar','customers','installments','payments','statements','cashbox','expenses','profits','dayclose','reports','excel','print','insights','act.cost'],
  store: ['dashboard','alerts','tasks','products','categories','stock','barcode','purchases','suppliers','warranties','maintenance','print','act.cost','act.priceEdit']
};

const Auth = {
  user(){ return DB.state.session ? DB.get('users', DB.state.session.userId) : null; },
  isLogged(){ return !!DB.state.session; },
  login(username, pass){
    const u = DB.c('users').find((x) => x.username === String(username).trim() && x.pass === String(pass));
    if (!u) return { ok: false, msg: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    if (u.active === false) return { ok: false, msg: 'هذا الحساب موقوف — راجع المدير' };
    DB.state.session = { userId: u.id, at: U.now(), sid: U.id('s') };
    DB.c('sessions').unshift({ id: DB.state.session.sid, userId: u.id, userName: u.name, at: U.now(), device: navigator.userAgent.slice(0, 90) });
    if (DB.c('sessions').length > 60) DB.c('sessions').length = 60;
    DB.flush();
    DB.log('تسجيل دخول', u.name, '', 'info');
    return { ok: true, user: u };
  },
  logout(silent){
    const u = Auth.user();
    if (u && !silent) DB.log('تسجيل خروج', u.name, '', 'info');
    const sid = DB.state.session && DB.state.session.sid;
    DB.c('sessions').forEach((s) => { if (s.id === sid) s.out = U.now(); });
    DB.state.session = null;
    DB.flush();
  },
  can(perm){
    const u = Auth.user();
    if (!u) return false;
    if (u.role === 'admin') return true;
    if (u.perms && Object.prototype.hasOwnProperty.call(u.perms, perm)) return !!u.perms[perm];
    const list = ROLE_PERMS[u.role] || [];
    return list.includes(perm);
  },
  canAny(perms){ return (perms || []).some((p) => Auth.can(p)); },
  roleLabel(u){ return u ? (ROLES[u.role] ? ROLES[u.role].t : u.role) : ''; },
  ensure(perm, msg){
    if (Auth.can(perm)) return true;
    UI.toast('صلاحية غير كافية', 'err', msg || 'هذه العملية تتطلب صلاحية: ' + (PERMS[perm] ? PERMS[perm].t : perm));
    return false;
  },
  hash(pass){ /* تخزين بسيط — يُنصح باستخدام نظام مستخدمين حقيقي عند الانتقال إلى سيرفر */ return String(pass); },
  changePass(userId, oldPass, newPass){
    const u = DB.get('users', userId);
    if (!u) return { ok: false, msg: 'المستخدم غير موجود' };
    if (u.pass !== String(oldPass)) return { ok: false, msg: 'كلمة المرور الحالية غير صحيحة' };
    if (String(newPass).length < 4) return { ok: false, msg: 'كلمة المرور الجديدة قصيرة (4 أحرف على الأقل)' };
    u.pass = String(newPass); u.mustChange = false;
    DB.save(); DB.log('تغيير كلمة المرور', u.name, '', 'warn');
    return { ok: true };
  }
};
