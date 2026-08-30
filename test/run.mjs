/* ============================================================================
   اختبار بيتي POS — يشغّل index.html الحقيقي داخل jsdom ويمرّ على مسارات الكود
   التشغيل:  npm test      (يتطلب jsdom:  npm i -D jsdom)
   ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');
const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra){
  if (cond){ pass++; console.log('  ✅ ' + name); }
  else { fail++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
}
function eq(name, actual, expected){
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  ok(name + '  (' + a + ')', a === b, 'المتوقع ' + b);
}
function section(t){ console.log('\n▸ ' + t); }

const vc = new VirtualConsole();
const jsErrors = [];
vc.on('jsdomError', (e) => { jsErrors.push(e.message); });
vc.on('error', (...a) => { jsErrors.push(String(a[0])); });

const dom = new JSDOM(html, {
  url: 'http://localhost:8080/index.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w){
    w.TextEncoder = TextEncoder;
    w.TextDecoder = TextDecoder;
    w.matchMedia = () => ({ matches: false, media: '', onchange: null, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}, dispatchEvent(){ return false; } });
    w.scrollTo = () => {};
    w.print = () => { w.__printed = (w.__printed || 0) + 1; };
    w.__downloads = [];
    w.URL.createObjectURL = () => 'blob:mock';
    w.URL.revokeObjectURL = () => {};
  }
});
const win = dom.window;
await new Promise((res) => { if (win.document.readyState === 'complete') res(); else win.addEventListener('load', res); });

/* نشر الرموز الداخلية للاختبار */
win.eval('window.__T = { U, DB, Engine, XLSX, Sales, Auth, Views, CRUD, Print, Reports, App, UI, F, ACT, PERMS, ROLES, PERMS_LIST: Object.keys(PERMS), NAV, Importer, Exporter, Docs, Returns, Payments, POS, Stock, Admin };');
const T = win.__T;
const doc = win.document;
const $ = (s) => doc.querySelector(s);
const click = (sel) => { const el = $(sel); if (!el) throw new Error('العنصر غير موجود: ' + sel); el.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); };

console.log('\n════════ اختبار بيتي POS ════════');
if (jsErrors.length) console.log('⚠️ أخطاء أثناء التحميل:\n' + jsErrors.slice(0, 6).map((e) => '   ' + e.split('\n').slice(0, 6).join('\n   ')).join('\n'));

/* ---------------------------------------------------------------- 1) الإقلاع */
section('الإقلاع والدخول');
ok('التطبيق موجود في الصفحة', !!T && !!T.App && !!T.DB);
eq('شاشة الدخول ظاهرة قبل التسجيل', $('#login').hidden, false);
eq('عدد الأقسام الافتراضية', T.DB.state.categories.length, 6);
eq('مستخدم افتراضي واحد (admin)', T.DB.state.users.length, 1);
ok('النظام يبدأ بدون بيانات (نظام فاضي)', T.DB.state.products.length === 0 && T.DB.state.invoices.length === 0);

$('#loginUser').value = 'admin';
$('#loginPass').value = '1234';
$('#loginForm').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
eq('تم تسجيل الدخول', !!T.Auth.user(), true);
eq('المسار الحالي لوحة التحكم', T.App.route, 'dashboard');
eq('شاشة الدخول مخفية', $('#login').hidden, true);
eq('عدد بطاقات المؤشرات في اللوحة', $$('#view .kpi').length, 8);
ok('التحية معروضة في اللوحة', /صباح الخير|مساء الخير|نهارك سعيد|طابت ليلتك/.test($('#view').textContent));

function $$(s){ return Array.from(doc.querySelectorAll(s)); }

/* ---------------------------------------------------------------- 2) المنتجات */
section('المنتجات والمخزون');
const cat = T.DB.state.categories[0];
const p1 = T.DB.add('products', { name: 'ثلاجة اختبار', code: 'P-0001', barcode: T.U.eanDigits('22000001'), categoryId: cat.id, cost: 750000, price: 1000000, qty: 10, minQty: 2, warrantyMonths: 24, active: true });
const p2 = T.DB.add('products', { name: 'غسالة اختبار', code: 'P-0002', barcode: T.U.eanDigits('22000002'), categoryId: T.DB.state.categories[1].id, cost: 420000, price: 560000, qty: 1, minQty: 3, warrantyMonths: 12, active: true });
eq('أُضيف منتجان', T.DB.state.products.length, 2);
eq('هامش الربح 25%', Math.round(T.Engine.marginOf(p1)), 25);
eq('السعر المقترح من كلفة 750,000 بهامش 25%', T.Engine.suggestPrice(750000, 25), 1000000);
eq('منتج واحد تحت الحد الأدنى', T.Engine.lowStock(T.DB.state).length, 1);
eq('باركود EAN-13 صحيح (400638133393 → 4006381333931)', T.U.eanDigits('400638133393'), '4006381333931');
ok('رسم الباركود ينتج SVG بأعمدة', T.U.barcodeSvg('400638133393').includes('<rect'));

/* ---------------------------------------------------------------- 3) زبائن */
section('الزبائن');
const c1 = T.DB.add('customers', { name: 'أحمد علي', phone: '07701234567', tier: 'vip', code: 'C-0001' }, { branch: false });
const c2 = T.DB.add('customers', { name: 'كرار محمد', phone: '07811223344', tier: 'normal', code: 'C-0002' }, { branch: false });
eq('زبونان', T.DB.state.customers.length, 2);

/* ---------------------------------------------------------------- 4) بيع نقدي */
section('البيع النقدي');
const cash = T.Sales.createInvoice({ customerId: c1.id, items: [{ productId: p1.id, qty: 1 }], method: 'cash' });
ok('نجحت عملية البيع النقدي', cash.ok, cash.msg);
eq('إجمالي الفاتورة', cash.invoice.total, 1000000);
eq('خصم المخزون بعد البيع', T.DB.get('products', p1.id).qty, 9);
eq('سُجّلت حركة مخزون (بيع)', T.DB.state.stockMoves.filter((m) => m.type === 'out').length, 1);
eq('سُجّل المقبوض نقداً', T.DB.state.payments.filter((p) => p.amount === 1000000).length, 1);
eq('ربح الفاتورة', T.Engine.invoiceProfit(cash.invoice), 250000);
eq('أُنشئ ضمان تلقائي', T.DB.state.warranties.length, 1);
eq('رصيد الزبون بعد البيع النقدي = 0', T.Engine.customerBalance(T.DB.state, c1.id).remaining, 0);
const box1 = T.Engine.cashboxDay(T.DB.state, T.U.today());
eq('مبيعات نقدية في الصندوق', box1.cashSales, 1000000);
eq('الرصيد المتوقع للصندوق (لا احتساب مزدوج للمقبوض)', box1.expected, 1000000);
eq('تسديدات الصندوق = 0 لأن المقبوض محسوب ضمن المبيعات', box1.cashPayments, 0);
ok('بيع بكمية أكبر من المتاح مرفوض', T.Sales.createInvoice({ customerId: c1.id, items: [{ productId: p2.id, qty: 99 }], method: 'cash' }).ok === false);

/* ---------------------------------------------------------------- 5) التقسيط */
section('محرك الأقساط');
const plan = T.Engine.buildPlan({ total: 1200000, down: 200000, months: 10, dueDay: 15, startDate: '2026-08-30', roundTo: 250 });
eq('المبلغ المموَّل', plan.financed, 1000000);
eq('عدد الأقساط', plan.items.length, 10);
eq('قيمة القسط الشهري', plan.items[0].amount, 100000);
eq('مجموع الأقساط = المموَّل بالضبط', T.U.sum(plan.items, (i) => i.amount), 1000000);
eq('أول استحقاق = 15/09 (الشهر القادم)', plan.items[0].due, '2026-09-15');
eq('ثاني استحقاق = 15/10', plan.items[1].due, '2026-10-15');
eq('حالة القسط الأول قادم', T.Engine.installmentStatus(plan.items[0], '2026-08-30'), 'upcoming');

const r3 = T.Engine.buildPlan({ total: 1000000, down: 0, months: 3, dueDay: 1, startDate: '2026-08-30', roundTo: 250 });
eq('توزيع 1,000,000 على 3 أقساط (تقريب 250)', r3.items.map((i) => i.amount), [333500, 333250, 333250]);
eq('المجموع بعد التقريب', T.U.sum(r3.items, (i) => i.amount), 1000000);
const r4 = T.Engine.buildPlan({ total: 1000001, down: 0, months: 3, dueDay: 1, startDate: '2026-08-30', roundTo: 250 });
eq('الفرق المتبقي يُضاف للقسط الأخير', T.U.sum(r4.items, (i) => i.amount), 1000001);
const r5 = T.Engine.buildPlan({ total: 1000000, down: 0, months: 7, dueDay: 5, startDate: '2026-08-30', roundTo: 250 });
eq('مجموع 7 أقساط = المموَّل', T.U.sum(r5.items, (i) => i.amount), 1000000);

const inst = T.Sales.createInvoice({ customerId: c2.id, items: [{ productId: p1.id, qty: 1 }], method: 'installment', plan: { down: 200000, months: 10, dueDay: 15 } });
ok('نجح البيع بالتقسيط', inst.ok, inst.msg);
eq('الدفعة الأولى مسجّلة على الفاتورة', inst.invoice.paid, 200000);
eq('خطة التقسيط مرتبطة بالفاتورة', !!inst.plan, true);
eq('عدد أقساط الخطة', inst.plan.items.length, 10);
eq('المبلغ المموَّل على العقد', inst.plan.financed, 800000);
eq('قيمة القسط الشهري على العقد', inst.plan.items[0].amount, 80000);
const downPay = T.DB.state.payments.find((p) => p.amount === 200000 && p.customerId === c2.id);
ok('وُجدت دفعة أولى', !!downPay);
eq('الدفعة الأولى لا تُوزَّع على الأقساط (حتى لا تُحتسب مرتين)', (downPay || {}).allocations.length, 0);
eq('الدفعة الأولى سُجّلت كتسديد', T.DB.state.payments.filter((p) => p.customerId === c2.id && p.amount === 200000).length, 1);
ok('الدفعة الأولى الأقل من الحد الأدنى مرفوضة', T.Sales.createInvoice({ customerId: c2.id, items: [{ productId: p1.id, qty: 1 }], method: 'installment', plan: { down: 1000, months: 10 } }).ok === false);

/* ---------------------------------------------------------------- 6) التسديد */
section('التسديد وتوزيع الأقساط');
const before = T.Engine.planSummary(inst.plan);
eq('المتبقي قبل التسديد', before.remaining, 800000);
const pay = T.Sales.recordPayment({ customerId: c2.id, amount: 150000, method: 'cash' });
ok('نجح التسديد', pay.ok, pay.msg);
const pl = T.DB.get('plans', inst.plan.id);
eq('القسط الأول مسدَّد بالكامل (80,000)', pl.items[0].paid, 80000);
eq('القسط الثاني مدفوع جزئياً (70,000)', pl.items[1].paid, 70000);
eq('عدد التوزيعات على الأقساط', pay.payment.allocations.length, 2);
eq('المتبقي بعد التسديد', T.Engine.planSummary(pl).remaining, 650000);
eq('رصيد الزبون = المتبقي', T.Engine.customerBalance(T.DB.state, c2.id).remaining, 650000);
const stmt = T.Engine.customerStatement(T.DB.state, c2.id);
eq('كشف الحساب: عدد الحركات', stmt.rows.length, 3);
eq('كشف الحساب: الرصيد النهائي', stmt.closing, 650000);
eq('القسط الأول حالته مسدّد', T.Engine.installmentStatus(pl.items[0], T.U.today()), 'paid');

/* التراجع عن التسديد عبر نفس الكود الذي يستدعيه زر «تراجع» في الواجهة */
const realConfirm = T.UI.confirm;
T.UI.confirm = async () => true;
await T.ACT['payment-undo']({ getAttribute: (k) => (k === 'data-id' ? pay.payment.id : '') });
T.UI.confirm = realConfirm;
const pl0 = T.DB.get('plans', inst.plan.id);
eq('التراجع أعاد الأقساط إلى صفر', [pl0.items[0].paid, pl0.items[1].paid], [0, 0]);
eq('التراجع حذف الوصل', T.DB.state.payments.some((p) => p.id === pay.payment.id), false);
eq('المتبقي بعد التراجع', T.Engine.planSummary(pl0).remaining, 800000);
eq('رصيد الزبون يطابق الخطة بعد التراجع', T.Engine.customerBalance(T.DB.state, c2.id).remaining, 800000);

/* دفعة جزئية على القسط الأول ثم تأخير استحقاقه */
const pay2 = T.Sales.recordPayment({ customerId: c2.id, amount: 70000, method: 'cash' });
ok('نجحت الدفعة الجزئية', pay2.ok, pay2.msg);
eq('القسط الأول مدفوع جزئياً (70,000)', T.DB.get('plans', inst.plan.id).items[0].paid, 70000);
pl0.items[0].due = T.U.addDays(T.U.today(), -5);
T.DB.update('plans', pl0.id, { items: pl0.items });
eq('القسط الماضي يُحتسب متأخراً', T.Engine.installmentStatus(pl0.items[0], T.U.today()), 'overdue');
eq('ملخّص الخطة يرصد التأخير (المتبقي من القسط)', T.Engine.planSummary(pl0).overdue, 10000);
eq('المتبقي بعد الدفعة الجزئية', T.Engine.planSummary(pl0).remaining, 730000);
eq('رصيد الزبون يطابق خطة الأقساط', T.Engine.customerBalance(T.DB.state, c2.id).remaining, 730000);

/* ---------------------------------------------------------------- 7) المالية */
section('المالية: الصندوق والمصاريف وإغلاق اليوم');
T.DB.add('expenses', { date: T.U.today(), category: 'إيجار', amount: 100000, note: 'إيجار المحل' });
const box2 = T.Engine.cashboxDay(T.DB.state, T.U.today());
eq('المصاريف في الصندوق', box2.expenses, 100000);
eq('المقبوض نقداً (مبيعات + تسديدات)', box2.cashSales + box2.cashPayments, 1270000);
eq('الرصيد المتوقع بعد المصروف', box2.expected, 1170000);
const prof = T.Engine.profitReport(T.DB.state, T.U.today(), T.U.today());
eq('إيراد اليوم (فاتورتان)', prof.revenue, 2000000);
eq('الربح الإجمالي لليوم', prof.gross, 500000);
eq('صافي الربح بعد المصاريف', prof.net, 400000);
const kpi = T.Engine.kpis(T.DB.state, T.U.today());
eq('مؤشر مبيعات اليوم', kpi.sales, 2000000);
eq('مؤشر المقبوض اليوم', kpi.collected, 1270000);
eq('مؤشر فواتير اليوم', kpi.invoices, 2);
eq('مؤشر مخزون منخفض', kpi.lowStock, 1);

/* إغلاق اليوم عبر الواجهة */
T.App.go('day-close');
if (!$('#view').textContent.includes('الرصيد المتوقع')) console.log('   محتوى شاشة إغلاق اليوم: ' + $('#view').textContent.slice(0, 300));
ok('شاشة إغلاق اليوم تعرض الرصيد المتوقع', $('#view').textContent.includes('الرصيد المتوقع'));
click('[data-act="day-close-do"]');
eq('أُنشئ إغلاق لليوم', T.DB.state.dayCloses.length, 1);
eq('الرصيد المعدود = المتوقع', T.DB.state.dayCloses[0].counted, T.DB.state.dayCloses[0].expected);

/* ---------------------------------------------------------------- 8) المشتريات */
section('المشتريات والموردون');
const sup = T.DB.add('suppliers', { name: 'شركة النور', phone: '0790111' }, { branch: false });
const pur = T.DB.add('purchases', { no: 'PUR-0001', date: T.U.today(), supplierId: sup.id, paid: 500000, items: [], total: 0 });
const qtyBefore = T.DB.get('products', p2.id).qty;
T.DB.state.session = { userId: 'u_admin' };
win.eval('Purchases.apply(DB.get("purchases","' + pur.id + '"), [{productId:"' + p2.id + '", name:"غسالة اختبار", qty:5, cost:440000}])');
const p2b = T.DB.get('products', p2.id);
eq('أُضيفت الكمية المشتراة للمخزون', p2b.qty, qtyBefore + 5);
eq('الكلفة المحدّثة = متوسط مرجّح (1×420000 + 5×440000)/6', p2b.cost, Math.round((1 * 420000 + 5 * 440000) / 6));
eq('إجمالي فاتورة الشراء', T.DB.get('purchases', pur.id).total, 5 * 440000);
eq('رصيد المورد', T.Engine.supplierBalance(T.DB.state, sup.id).remaining, 2200000 - 500000);

/* ---------------------------------------------------------------- 9) التقارير */
section('التقارير ومركز Excel');
const rep = T.Reports.build('sales', '2000-01-01', '2099-12-31', '');
eq('تقرير المبيعات: عدد الصفوف', rep.rows.length, 2);
eq('تقرير المبيعات: إجمالي الملخّص', rep.summary.find((s) => s.k === 'إجمالي المبيعات').v, 2000000);
const repStock = T.Reports.build('stock', '2000-01-01', '2099-12-31', '');
eq('تقرير المخزون: عدد الأصناف', repStock.rows.length, 2);
const repInst = T.Reports.build('installments', '2000-01-01', '2099-12-31', '');
eq('تقرير الأقساط: إجمالي الديون', repInst.summary.find((s) => s.k === 'إجمالي الديون').v, 730000);

/* ملف xlsx حقيقي */
const blob = T.XLSX.build([{ name: 'المبيعات', columns: rep.columns, rows: rep.rows, summary: rep.summary }]);
const ab = await new Promise((res, rej) => {
  const fr = new win.FileReader();
  fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('FileReader فشل'));
  fr.readAsArrayBuffer(blob);
});
const buf = Buffer.from(ab);
const outPath = join(here, '..', '.tmp-test.xlsx');
writeFileSync(outPath, buf);
ok('ملف xlsx يبدأ بتوقيع ZIP (PK)', buf[0] === 0x50 && buf[1] === 0x4b, 'أول بايتات: ' + buf.slice(0, 4).toString('hex'));
ok('حجم ملف xlsx معقول', buf.length > 1500, buf.length + ' بايت');

/* تصدير من الواجهة */
win.__downloads = [];
const origCreate = win.URL.createObjectURL;
win.URL.createObjectURL = (b) => { win.__downloads.push({ size: b.size, type: b.type }); return 'blob:mock'; };
T.Exporter.one('sales', '2000-01-01', '2099-12-31', '');
eq('التصدير من الواجهة أنتج ملفاً', win.__downloads.length, 1);
ok('نوع الملف xlsx', /spreadsheetml/.test(win.__downloads[0].type), win.__downloads[0].type);
win.URL.createObjectURL = origCreate;

/* ---------------------------------------------------------------- 10) الطباعة */
section('مستندات الطباعة');
const inv = cash.invoice;
const war = T.DB.state.warranties[0];
const payRec = T.DB.state.payments.find((p) => p.customerId === c2.id);
const maint = T.DB.add('maintenance', { no: 'M-0001', date: T.U.today(), customerId: c1.id, device: 'ثلاجة', serial: 'SN1', problem: 'لا تبرد', cost: 25000, status: 'received' });
const docs = {
  invoice: T.Print.doc('invoice', { invoice: inv }),
  installment: T.Print.doc('installment', { invoice: inst.invoice, plan: T.DB.get('plans', inst.plan.id) }),
  receipt: T.Print.doc('receipt', { payment: payRec }),
  statement: T.Print.doc('statement', { customerId: c1.id }),
  installments: T.Print.doc('installments', { rows: T.DB.state.plans.map((p) => ({ plan: p })) }),
  daily: T.Print.doc('daily', { from: T.U.today(), to: T.U.today(), cashbox: T.Engine.cashboxDay(T.DB.state, T.U.today()) }),
  monthly: T.Print.doc('monthly', { from: T.U.startOfMonth(T.U.today()), to: T.U.today() }),
  purchase: T.Print.doc('purchase', { purchase: T.DB.get('purchases', pur.id) }),
  receipt_in: T.Print.doc('receipt_in', { record: { no: maint.no, date: maint.date, customerName: 'أحمد', device: 'ثلاجة', serial: 'SN1', cost: 25000, problem: 'لا تبرد' } }),
  warranty: T.Print.doc('warranty', { warranty: war }),
  labels: T.Print.doc('labels', { items: T.DB.state.products, size: '48x22', copies: 1 })
};
Object.entries(docs).forEach(([k, v]) => ok('مستند: ' + k, typeof v === 'string' && v.includes('class="doc') && v.length > 300, (v || '').length + ' حرف'));
ok('الفاتورة تحتوي تفقيط المبلغ', docs.invoice.includes('المبلغ كتابةً'));
ok('عقد التقسيط يحتوي جدول الأقساط', docs.installment.includes('جدول الأقساط'));
ok('الوصل يعرض المتبقي', docs.receipt.includes('إجمالي المتبقي'));
win.__printed = 0;
T.Print.run(docs.invoice, { size: 'A4' });
await new Promise((r) => setTimeout(r, 400));
eq('الطباعة استُدعيت', win.__printed, 1);

/* ---------------------------------------------------------------- 11) الشاشات */
section('عرض كل الشاشات');
const routes = Object.keys(T.Views);
eq('عدد الشاشات', routes.length >= 40, true);
let broken = [];
for (const r of routes){
  try{
    T.App.route = r;
    T.App.params = r === 'customer-profile' ? { id: c1.id } : r === 'invoice-view' ? { id: inv.id } : r === 'plan-view' ? { id: inst.plan.id } : r === 'product-open' ? { id: p1.id } : {};
    T.App.render();
    const txt = $('#view').textContent || '';
    if (txt.trim().length < 20) broken.push(r + ' (فارغة)');
  }catch(e){ broken.push(r + ' → ' + e.message); }
}
eq('كل الشاشات تُعرض بدون خطأ', broken, []);

/* القائمة الجانبية */
const navItems = $$('#nav .nav-item');
ok('القائمة الجانبية تحتوي مجموعات وأقسام', navItems.length > 25, navItems.length + ' عنصر');
ok('القائمة مقسّمة إلى مجموعات', $$('#nav .nav-group').length >= 8, $$('#nav .nav-group').length + ' مجموعة');
ok('شريط الجوال السفلي مبني', $$('#mobilenav .mn-item').length === 5, $$('#mobilenav .mn-item').length + ' أزرار');

/* ---------------------------------------------------------------- 12) نقطة البيع */
section('نقطة البيع');
T.App.go('pos');
ok('شبكة المنتجات معروضة', $$('#view .prod-card').length === 2, $$('#view .prod-card').length + ' منتج');
click('[data-act="pos-add"][data-id="' + p1.id + '"]');
eq('أُضيف الصنف إلى السلة', T.App.pos.items.length, 1);
click('[data-act="pos-qty"][data-v="1"]');
eq('زادت الكمية', T.App.pos.items[0].qty, 2);
click('[data-act="pos-del"][data-i="0"]');
eq('حُذف الصنف من السلة', T.App.pos.items.length, 0);
click('[data-act="pos-add"][data-id="' + p1.id + '"]');
click('[data-act="pos-checkout"]');
ok('نافذة إتمام البيع فتحت', $('#modalRoot').classList.contains('on'));
ok('نافذة البيع تعرض الإجمالي', $('#modalSlot').textContent.includes('الإجمالي'));
T.UI.closeModal();
click('[data-act="pos-method"][data-v="installment"]');
click('[data-act="pos-checkout"]');
ok('نافذة التقسيط تعرض جدول الأقساط', $('#modalSlot').textContent.includes('جدول الأقساط المتوقع'));
T.UI.closeModal();
T.App.pos.items = [];

/* ---------------------------------------------------------------- 13) الصلاحيات */
section('المستخدمون والصلاحيات');
T.DB.add('users', { name: 'موظف مبيعات', username: 'sales1', pass: '1111', role: 'sales', active: true, perms: {} }, { branch: false });
T.Auth.logout(true);
const lg = T.Auth.login('sales1', '1111');
ok('دخول موظف المبيعات', lg.ok, lg.msg);
eq('موظف المبيعات يملك نقطة البيع', T.Auth.can('pos'), true);
eq('موظف المبيعات لا يملك الإدارة', T.Auth.can('admin'), false);
eq('موظف المبيعات يملك الحذف بحسب دوره', T.Auth.can('act.delete'), true);
T.DB.update('users', T.DB.state.users.find((u) => u.username === 'sales1').id, { perms: { 'act.delete': false } });
eq('تجاوز الصلاحية المخصصة يعمل', T.Auth.can('act.delete'), false);
const wrong = T.Auth.login('sales1', '0000');
eq('كلمة مرور خاطئة مرفوضة', wrong.ok, false);
T.Auth.logout(true);
T.Auth.login('admin', '1234');
eq('عدد الصلاحيات المعرّفة', T.PERMS_LIST.length >= 35, true);

/* ---------------------------------------------------------------- 14) الذكاء والتنبيهات */
section('التنبيهات والذكاء');
T.DB.update('products', p2.id, { qty: 0 }); /* لإثارة تنبيه المخزون */
const alerts = T.Engine.alerts(T.DB.state, T.U.today());
ok('يوجد تنبيهان على الأقل', alerts.length >= 2, alerts.length + ' تنبيه');
ok('تنبيه الأقساط المتأخرة موجود', alerts.some((a) => a.route === 'installments'));
ok('تنبيه المخزون المنخفض موجود', alerts.some((a) => a.route === 'stock'));
ok('تنبيه إغلاق اليوم موجود قبل الإغلاق أو يختفي بعده', alerts.every((a) => a.route !== 'day-close') || T.DB.state.dayCloses.length === 0);
const ins = T.Engine.insights(T.DB.state, T.U.today());
ok('تحليلات ذكية مُنتَجة', ins.length >= 3, ins.length + ' تحليل');
ok('كل تحليل له عنوان ونص', ins.every((i) => i.title && i.text));

/* ---------------------------------------------------------------- 15) أدوات عامة */
section('أدوات عامة');
eq('تنسيق الأرقام بفواصل', T.U.num(1250000), '1,250,000');
eq('تنسيق المبلغ بالعملة', T.U.money(1250000), '1,250,000 د.ع');
eq('تفقيط 1,250,000', T.U.words(1250000), 'مليون ومئتان وخمسون ألف');
eq('تفقيط 0', T.U.words(0), 'صفر');
eq('تاريخ عربي', T.U.dateAr('2026-08-30', { wd: true }), 'الأحد 30 أغسطس 2026');
eq('إضافة شهر مع تثبيت اليوم', T.U.addMonths('2026-01-31', 1, 31), '2026-02-28');
eq('CSV يُصدَّر برأس', T.U.toCsv([{ a: 1, b: 'x' }]).includes('a,b'), true);
const parsedCsv = T.U.parseCsv('الاسم,الهاتف\nأحمد,0770');
eq('قراءة CSV', parsedCsv[0].الاسم, 'أحمد');

/* ---------------------------------------------------------------- 16) النسخ الاحتياطي */
section('النسخ الاحتياطي والاستعادة');
const backup = T.DB.backupJSON();
ok('النسخة الاحتياطية JSON صالح', JSON.parse(backup).app === 'bayti-pos');
const prodCount = T.DB.state.products.length;
T.DB.state.products = [];
T.DB.restoreJSON(backup);
eq('الاستعادة أرجعت المنتجات', T.DB.state.products.length, prodCount);
eq('الاستعادة تُبقي جلسة المستخدم الحالي', (T.Auth.user() || {}).username, 'admin');
const noMe = JSON.parse(T.DB.backupJSON()).data;
noMe.users = noMe.users.filter((u) => u.username !== 'admin');
T.DB.restoreJSON(JSON.stringify({ app: 'bayti-pos', data: noMe }));
eq('ملف لا يحتوي هذا المستخدم ← خروج آمن', T.Auth.isLogged(), false);
T.DB.restoreJSON(backup);
eq('استعادة الملف الكامل تُرجع المدير', T.DB.state.users.some((u) => u.username === 'admin'), true);
eq('دخول جديد بعد الاستعادة', T.Auth.login('admin', '1234').ok, true);

/* ---------------------------------------------------------------- 17) سجل النشاط */
section('سجل النشاط');
ok('سُجّلت عمليات في سجل النشاط', T.DB.state.audit.length >= 5, T.DB.state.audit.length + ' عملية');
ok('كل سجل يحتوي مستخدماً ووقتاً', T.DB.state.audit.every((a) => a.userName && a.at));

/* ---------------------------------------------------------------- 18) تخزين */
section('التخزين المحلي');
ok('البيانات محفوظة في localStorage', (win.localStorage.getItem('bayti.pos.v1') || '').length > 500);
const saved = JSON.parse(win.localStorage.getItem('bayti.pos.v1'));
eq('المجموعات محفوظة', saved.products.length, prodCount);

/* ---------------------------------------------------------------- 19) مسار نقرات حقيقي عبر الواجهة */
section('مسار نقرات حقيقي (زبون ← أقساط ← تسديد ← وصل)');
T.App.go('customers');
if (!$('#view [data-act="open-customer"]')) console.log('   DBG route=' + T.App.route + ' user=' + ((T.Auth.user() || {}).name || 'لا أحد') + ' | ' + $('#view').textContent.replace(/\s+/g, ' ').slice(0, 220));
ok('قائمة الزبائن تعرض صفوفاً', $$('#view [data-act="open-customer"]').length >= 2);
click('#view [data-act="open-customer"][data-id="' + c2.id + '"]');
eq('فتح ملف الزبون', T.App.route, 'customer-profile');
eq('عدد تبويبات ملف الزبون', $$('#view .tabs .tab').length, 8);
ok('رأس الملف يعرض اسم الزبون', $('#view').textContent.includes(c2.name));
click('#view [data-act="cust-tab"][data-tab="installments"]');
eq('التنقل بين التبويبات', T.App.params.tab, 'installments');
ok('تبويب الأقساط يعرض رقم العقد', $('#view').textContent.includes(T.DB.state.plans[0].no));
click('#view [data-act="cust-tab"][data-tab="statement"]');
ok('تبويب كشف الحساب يعرض الرصيد', $('#view').textContent.includes('الرصيد'));

T.App.go('installments');
const payBtn = $('#view [data-act="payment-new"]');
ok('شاشة الأقساط فيها زر تسديد', !!payBtn);
const payCount = T.DB.state.payments.length;
win.__printed = 0;
payBtn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
ok('نافذة التسديد فتحت', $('#modalRoot').classList.contains('on') && !!$('#payCust'));
$('#payCust').value = c2.id;
$('#payCust').dispatchEvent(new win.Event('change', { bubbles: true }));
ok('عرض رصيد الزبون داخل النافذة', $('#payInfo').textContent.includes('المتبقي'));
ok('أقرب الاستحقاقات معروضة', $('#payPlans').textContent.includes('أقرب الاستحقاقات'));
eq('المبلغ تُعبّئ تلقائياً بقيمة القسط المستحق', Number($('#payAmt').value), 10000);
click('#modalSlot [data-act="modal-act"][data-i="1"]');
eq('سُجّل تسديد من النافذة', T.DB.state.payments.length, payCount + 1);
eq('النافذة أُغلقت', $('#modalRoot').classList.contains('on'), false);
eq('القسط المتأخر أصبح مسدَّداً بالكامل', T.DB.state.plans[0].items[0].paid, 80000);
eq('متبقي العقد بعد التسديد', T.Engine.planSummary(T.DB.state.plans[0]).remaining, 720000);
eq('رصيد الزبون بعد التسديد', T.Engine.customerBalance(T.DB.state, c2.id).remaining, 720000);
await new Promise((r) => setTimeout(r, 320));
eq('طُبع وصل التسديد', win.__printed, 1);

/* البحث الموحّد يجد الزبون والمنتج والفاتورة والباركود */
const invForSearch = T.DB.state.invoices[0];
const hits = (q) => { T.App.globalSearch(q); return $('#gsResults').textContent; };
ok('البحث يجد الزبون بالاسم', hits(c2.name).includes(c2.name));
ok('البحث يجد الزبون بالهاتف', hits(c2.phone).includes(c2.name));
ok('البحث يجد المنتج بالاسم', hits(p1.name).includes(p1.name));
ok('البحث يجد المنتج بالباركود', hits(p1.barcode).includes(p1.name));
ok('البحث يجد الفاتورة برقمها', hits(invForSearch.no).includes(invForSearch.no));
ok('البحث بلا نتائج يقول ذلك', hits('لايوجدشيء').includes('لا نتائج مطابقة'));

/* ---------------------------------------------------------------- النتيجة */
console.log('\n════════════════════════════════');
console.log('النتيجة: ' + pass + ' نجح، ' + fail + ' فشل');
if (jsErrors.length){
  const real = jsErrors.filter((m) => !/Not implemented|Could not parse CSS|Error: Could not load/.test(m));
  console.log('أخطاء jsdom (غير محسوبة): ' + jsErrors.length + (real.length ? ' — منها مهمة: ' + real.slice(0, 5).join(' | ') : ''));
  jsErrors.slice(0, 4).forEach((m) => console.log('   · ' + m.split('\n')[0].slice(0, 200)));
}
if (fail){ console.log('\nالفشل:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('✅ كل الاختبارات نجحت');
process.exit(0);
