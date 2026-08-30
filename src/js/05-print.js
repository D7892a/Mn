/* ============================================================================
   05) الطباعة — مستندات جاهزة للطبع
   ========================================================================== */
const Print = {

  sizeClass(size){ return size === 'A5' ? 'size-A5' : size === 'T80' ? 'size-T80 size-thermal doc-thermal' : size === 'T58' ? 'size-T58 size-thermal doc-thermal' : 'size-A4'; },
  isThermal(size){ return size === 'T80' || size === 'T58'; },

  header(opt){
    const st = ST();
    const showLogo = S().invoice.showLogo && st.logo;
    return '<div class="doc-h">' +
      (showLogo ? '<div class="dh-logo"><img src="' + U.esc(st.logo) + '" alt=""></div>' : '') +
      '<div>' +
        '<h2>' + U.esc(st.name) + '</h2>' +
        (st.subtitle ? '<div class="dh-m">' + U.esc(st.subtitle) + '</div>' : '') +
        (st.address ? '<div class="dh-m">📍 ' + U.esc(st.address) + '</div>' : '') +
        (st.phone ? '<div class="dh-m">☎ ' + U.esc(st.phone) + '</div>' : '') +
        (st.taxNo ? '<div class="dh-m">الرقم الضريبي: ' + U.esc(st.taxNo) + '</div>' : '') +
      '</div>' +
      '<div class="dh-side">' +
        '<div style="font-weight:800;font-size:1.05em">' + U.esc(opt.docTitle || '') + '</div>' +
        (opt.no ? '<div>الرقم: <b>' + U.esc(opt.no) + '</b></div>' : '') +
        '<div>التاريخ: <b>' + U.dateAr(opt.date || U.today()) + '</b></div>' +
        (opt.time ? '<div>الوقت: ' + U.timeAr(opt.date + ' ' + opt.time) + '</div>' : '') +
        (opt.verify ? '<div>رمز التحقق: <b>' + U.esc(opt.verify) + '</b></div>' : '') +
      '</div>' +
    '</div>';
  },

  itemsTable(items, opt){
    opt = opt || {};
    let html = '<table class="doc-tbl"><thead><tr>' +
      '<th style="width:6%">#</th><th>الصنف</th>' +
      (opt.serial ? '<th>السيريال</th>' : '') +
      '<th class="n">الكمية</th><th class="n">السعر</th>' +
      (opt.discount ? '<th class="n">الخصم</th>' : '') +
      '<th class="n">الإجمالي</th></tr></thead><tbody>';
    (items || []).forEach((it, i) => {
      const t = Engine.lineTotals(it);
      html += '<tr><td>' + (i + 1) + '</td><td>' + U.esc(it.name) + (it.code ? '<br><span style="color:#777;font-size:.86em">' + U.esc(it.code) + '</span>' : '') + '</td>' +
        (opt.serial ? '<td>' + U.esc(it.serial || '—') + '</td>' : '') +
        '<td class="n">' + U.num(t.qty) + '</td>' +
        '<td class="n">' + U.num(Number(it.price) || 0) + '</td>' +
        (opt.discount ? '<td class="n">' + (t.discount ? U.num(t.discount) : '—') + '</td>' : '') +
        '<td class="n">' + U.num(t.net) + '</td></tr>';
    });
    return html + '</tbody></table>';
  },

  totals(tot, opt){
    opt = opt || {};
    const cur = S().locale.currencySymbol || 'د.ع';
    let h = '<div class="doc-tot">';
    h += '<div><span>المجموع</span><b>' + U.num(tot.subtotal) + ' ' + cur + '</b></div>';
    if (tot.lineDiscount) h += '<div><span>خصم الأصناف</span><b>-' + U.num(tot.lineDiscount) + '</b></div>';
    if (tot.discount) h += '<div><span>الخصم</span><b>-' + U.num(tot.discount) + '</b></div>';
    if (tot.tax) h += '<div><span>الضريبة</span><b>' + U.num(tot.tax) + '</b></div>';
    h += '<div class="grand"><span>' + (opt.label || 'الإجمالي النهائي') + '</span><span>' + U.num(tot.total) + ' ' + cur + '</span></div>';
    if (opt.paid != null) h += '<div><span>المدفوع</span><b>' + U.num(opt.paid) + '</b></div>';
    if (opt.due != null) h += '<div><span>المتبقي</span><b>' + U.num(opt.due) + '</b></div>';
    return h + '</div>';
  },

  words(amount){
    if (!S().invoice.showWords) return '';
    return '<div class="doc-words">المبلغ كتابةً: <b>' + U.words(amount) + '</b> ' + U.esc(S().locale.currency === 'IQD' ? 'دينار عراقي' : S().locale.currency) + ' فقط لا غير</div>';
  },

  footer(opt){
    const st = ST();
    let h = '';
    if (opt && opt.terms !== false && S().invoice.showTerms && st.invoiceFooter){
      h += '<div class="doc-terms">' + U.esc(st.invoiceFooter) + '</div>';
    }
    h += '<div class="doc-f">' +
      (S().print.showStamp !== false ? '<div class="doc-stamp">' + U.esc(st.name) + '<br><span style="font-size:.8em">معتمد</span></div>' : '') +
      '<div class="sign">توقيع المستلم</div>' +
      '<div class="sign">' + (S().invoice.signature ? U.esc(S().invoice.signature) : 'توقيع البائع / الختم') + '</div>' +
      '</div>';
    if (opt && opt.extra) h += '<div class="doc-note">' + opt.extra + '</div>';
    return h;
  },

  barcodeBlock(code){
    if (!S().invoice.showBarcode) return '';
    return '<div class="doc-barcode doc-center">' + U.barcodeSvg(code, { width: 200, height: 44, fontSize: 10 }) + '</div>';
  },
  qrBlock(text){
    if (!S().invoice.showQR) return '';
    const src = 'https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=' + encodeURIComponent(text);
    return '<div class="doc-qr"><img src="' + src + '" width="96" height="96" alt="QR" onerror="this.style.display=\'none\'"><div class="small">امسح الرمز للتحقق من صحة المستند</div></div>';
  },

  /* ------------------------------------------------------ أنواع المستندات */
  doc(type, data){
    const fn = Print['t_' + type];
    if (!fn) return '<div class="doc">مستند غير معروف</div>';
    return fn(data || {});
  },

  /* فاتورة بيع نقدية */
  t_invoice(d){
    const inv = d.invoice; if (!inv) return '';
    const size = d.size || S().invoice.size || 'A4';
    const tot = { subtotal: inv.subtotal, lineDiscount: inv.lineDiscount, discount: inv.discount, tax: inv.tax, total: inv.total };
    const cust = DB.get('customers', inv.customerId);
    const u = DB.get('users', inv.userId);
    if (Print.isThermal(size)){
      return '<div class="doc ' + Print.sizeClass(size) + '">' +
        Print.header({ docTitle: S().invoice.title || 'فاتورة بيع', no: inv.no, date: inv.date, time: inv.time, verify: inv.verify }) +
        (cust ? '<div class="doc-meta"><div><b>الزبون:</b> ' + U.esc(cust.name) + '</div>' + (cust.phone ? '<div><b>الهاتف:</b> ' + U.esc(cust.phone) + '</div>' : '') + '</div>' : '') +
        Print.itemsTable(inv.items, { serial: false }) +
        Print.totals(tot, { paid: inv.paid, due: Math.max(0, inv.total - (Number(inv.paid) || 0)) }) +
        Print.barcodeBlock(inv.verify || inv.no) +
        Print.footer({ terms: true }) +
      '</div>';
    }
    return '<div class="doc ' + Print.sizeClass(size) + '">' +
      Print.header({ docTitle: S().invoice.title || 'فاتورة بيع', no: inv.no, date: inv.date, time: inv.time, verify: inv.verify }) +
      '<div class="doc-meta">' +
        '<div><b>الزبون:</b> <span>' + U.esc(cust ? cust.name : 'زبون نقدي') + '</span></div>' +
        '<div><b>الهاتف:</b> <span>' + U.esc((cust && cust.phone) || '—') + '</span></div>' +
        '<div><b>العنوان:</b> <span>' + U.esc((cust && cust.address) || '—') + '</span></div>' +
        '<div><b>طريقة الدفع:</b> <span>' + U.esc(App.payLabel(inv.method)) + '</span></div>' +
        '<div><b>البائع:</b> <span>' + U.esc(u ? u.name : '—') + '</span></div>' +
        '<div><b>الفرع:</b> <span>' + U.esc(DB.branchName(inv.branchId)) + '</span></div>' +
      '</div>' +
      (inv.note ? '<div class="doc-terms">ملاحظة: ' + U.esc(inv.note) + '</div>' : '') +
      Print.itemsTable(inv.items, { serial: true, discount: !!inv.discount || (inv.items || []).some((i) => i.discount) }) +
      Print.totals(tot, { paid: inv.paid, due: Math.max(0, inv.total - (Number(inv.paid) || 0)) }) +
      Print.words(inv.total) +
      Print.qrBlock((location.origin || 'bayti') + '/invoice/' + (inv.verify || inv.no)) +
      Print.barcodeBlock(inv.verify || inv.no) +
      Print.footer({ terms: true }) +
    '</div>';
  },

  /* عقد بيع بالتقسيط */
  t_installment(d){
    const inv = d.invoice, plan = d.plan || DB.get('plans', inv.planId);
    if (!inv || !plan) return '';
    const size = d.size || S().invoice.size || 'A4';
    const cust = DB.get('customers', inv.customerId) || {};
    const st = ST();
    let rows = '';
    (plan.items || []).forEach((it) => {
      rows += '<tr><td>' + it.no + '</td><td>' + U.dateAr(it.due) + '</td><td class="n">' + U.num(it.amount) + '</td>' +
        '<td class="n">' + (it.paid ? U.num(it.paid) : '—') + '</td><td>' + (it.paid >= it.amount ? 'مسدّد' : 'غير مسدّد') + '</td></tr>';
    });
    return '<div class="doc ' + Print.sizeClass(size) + '">' +
      Print.header({ docTitle: 'عقد بيع بالتقسيط', no: plan.no || inv.no, date: inv.date, time: inv.time, verify: inv.verify }) +
      '<div class="doc-title">عقد بيع بالتقسيط — ' + U.esc(st.name) + '</div>' +
      '<div class="doc-meta">' +
        '<div><b>الطرف الأول:</b> <span>' + U.esc(st.name) + ' (البائع)</span></div>' +
        '<div><b>الطرف الثاني:</b> <span>' + U.esc(cust.name || '') + ' (المشتري)</span></div>' +
        '<div><b>الهاتف:</b> <span>' + U.esc(cust.phone || '—') + '</span></div>' +
        '<div><b>العنوان:</b> <span>' + U.esc(cust.address || '—') + '</span></div>' +
        '<div><b>رقم الهوية:</b> <span>' + U.esc(cust.nationalId || '—') + '</span></div>' +
        '<div><b>الكفيل:</b> <span>' + U.esc(cust.guarantor || '—') + '</span></div>' +
      '</div>' +
      '<p><b>أولاً:</b> باع الطرف الأول إلى الطرف الثاني الأصناف المدرجة أدناه بيعاً بالتقسيط وفق الشروط المذكورة.</p>' +
      Print.itemsTable(inv.items, { serial: true }) +
      '<div class="doc-tot" style="width:100%">' +
        '<div><span>القيمة الكلية</span><b>' + U.num(inv.total) + '</b></div>' +
        '<div><span>الدفعة الأولى</span><b>' + U.num(plan.down) + '</b></div>' +
        '<div><span>المبلغ المموَّل</span><b>' + U.num(plan.financed) + '</b></div>' +
        '<div class="grand"><span>عدد الأقساط</span><span>' + plan.items.length + ' قسطاً شهرياً</span></div>' +
        '<div><span>يوم الاستحقاق</span><b>اليوم ' + plan.dueDay + ' من كل شهر</b></div>' +
        '<div><span>أول استحقاق</span><b>' + U.dateAr((plan.items[0] || {}).due) + '</b></div>' +
      '</div>' +
      '<h3 style="margin-top:12px">جدول الأقساط</h3>' +
      '<table class="doc-tbl"><thead><tr><th>القسط</th><th>تاريخ الاستحقاق</th><th class="n">المبلغ</th><th class="n">المدفوع</th><th>الحالة</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="doc-terms"><b>ثانياً — الشروط:</b><br>' + U.esc(st.saleTerms || '') + '<br>' +
      '1- يلتزم المشتري بتسديد كل قسط في تاريخ استحقاقه، والتأخير أكثر من ' + (S().installments.lateGraceDays || 3) + ' أيام يترتب عليه إيقاف البيع واستحقاق كامل المبلغ المتبقي.<br>' +
      '2- تبقى ملكية الأصناف للبائع حتى سداد كامل الثمن.<br>' +
      '3- الكفيل ضامن متضامن مع المشتري في جميع الالتزامات.</div>' +
      Print.words(inv.total) +
      Print.footer({}) +
    '</div>';
  },

  /* وصل تسديد */
  t_receipt(d){
    const pay = d.payment; if (!pay) return '';
    const size = d.size || S().invoice.size || 'A4';
    const cust = DB.get('customers', pay.customerId) || {};
    const u = DB.get('users', pay.userId);
    let alloc = '';
    if ((pay.allocations || []).length){
      alloc = '<table class="doc-tbl"><thead><tr><th>القسط</th><th>تاريخ الاستحقاق</th><th class="n">المبلغ المسدَّد</th></tr></thead><tbody>' +
        pay.allocations.map((a) => '<tr><td>القسط ' + a.installNo + '</td><td>' + U.dateAr(a.due) + '</td><td class="n">' + U.num(a.amount) + '</td></tr>').join('') +
        '</tbody></table>';
    }
    const bal = Engine.customerBalance(DB.state, pay.customerId);
    return '<div class="doc ' + Print.sizeClass(size) + '">' +
      Print.header({ docTitle: 'وصل تسديد', no: pay.no, date: pay.date, time: pay.time }) +
      '<div class="doc-title">وصل استلام مبلغ</div>' +
      '<div class="doc-meta">' +
        '<div><b>استلمنا من:</b> <span>' + U.esc(cust.name || '—') + '</span></div>' +
        '<div><b>رقم الزبون:</b> <span>' + U.esc(cust.code || '—') + '</span></div>' +
        '<div><b>الهاتف:</b> <span>' + U.esc(cust.phone || '—') + '</span></div>' +
        '<div><b>طريقة الدفع:</b> <span>' + U.esc(App.payLabel(pay.method)) + '</span></div>' +
        '<div><b>المستلم:</b> <span>' + U.esc(u ? u.name : '—') + '</span></div>' +
        '<div><b>الفرع:</b> <span>' + U.esc(DB.branchName(pay.branchId)) + '</span></div>' +
      '</div>' +
      '<div class="doc-tot" style="width:100%"><div class="grand"><span>المبلغ المستلم</span><span>' + U.num(pay.amount) + ' ' + U.esc(S().locale.currencySymbol) + '</span></div></div>' +
      Print.words(pay.amount) +
      alloc +
      '<div class="doc-tot" style="width:100%">' +
        '<div><span>إجمالي المتبقي على الزبون</span><b>' + U.num(bal.remaining) + '</b></div>' +
        (bal.overdue ? '<div><span>منه متأخر</span><b style="color:#DC2626">' + U.num(bal.overdue) + '</b></div>' : '') +
      '</div>' +
      (pay.note ? '<div class="doc-terms">ملاحظة: ' + U.esc(pay.note) + '</div>' : '') +
      Print.footer({ terms: false }) +
    '</div>';
  },

  /* كشف حساب */
  t_statement(d){
    const cust = DB.get('customers', d.customerId); if (!cust) return '';
    const size = d.size || 'A4';
    const s = Engine.customerStatement(DB.state, cust.id);
    const from = d.from, to = d.to;
    const rows = s.rows.filter((r) => (!from || String(r.date).slice(0, 10) >= from) && (!to || String(r.date).slice(0, 10) <= to));
    const bal0 = rows.length ? (rows[0].balance - (rows[0].debit - rows[0].credit)) : 0;
    let body = rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + U.dateAr(String(r.date).slice(0, 10)) + '</td><td>' + U.esc(r.type) + '</td><td>' + U.esc(r.ref) + '</td>' +
      '<td class="n">' + (r.debit ? U.num(r.debit) : '—') + '</td><td class="n">' + (r.credit ? U.num(r.credit) : '—') + '</td><td class="n">' + U.num(r.balance) + '</td></tr>').join('');
    return '<div class="doc ' + Print.sizeClass(size) + '">' +
      Print.header({ docTitle: 'كشف حساب', date: U.today() }) +
      '<div class="doc-meta">' +
        '<div><b>الزبون:</b> <span>' + U.esc(cust.name) + '</span></div>' +
        '<div><b>الهاتف:</b> <span>' + U.esc(cust.phone || '—') + '</span></div>' +
        '<div><b>العنوان:</b> <span>' + U.esc(cust.address || '—') + '</span></div>' +
        '<div><b>الفترة:</b> <span>' + (from ? U.dateAr(from) : 'البداية') + ' → ' + (to ? U.dateAr(to) : U.dateAr(U.today())) + '</span></div>' +
      '</div>' +
      '<div class="doc-tot" style="width:100%">' +
        '<div><span>رصيد أول المدة</span><b>' + U.num(bal0) + '</b></div>' +
        '<div><span>إجمالي المبيعات (مدين)</span><b>' + U.num(U.sum(rows, (r) => r.debit)) + '</b></div>' +
        '<div><span>إجمالي المدفوعات (دائن)</span><b>' + U.num(U.sum(rows, (r) => r.credit)) + '</b></div>' +
        '<div class="grand"><span>الرصيد النهائي</span><span>' + U.num(s.closing) + ' ' + U.esc(S().locale.currencySymbol) + '</span></div>' +
      '</div>' +
      '<table class="doc-tbl"><thead><tr><th>#</th><th>التاريخ</th><th>البيان</th><th>المرجع</th><th class="n">مدين</th><th class="n">دائن</th><th class="n">الرصيد</th></tr></thead><tbody>' +
      (body || '<tr><td colspan="7" class="doc-center">لا توجد حركات</td></tr>') +
      '</tbody></table>' +
      Print.words(s.closing) +
      Print.footer({ terms: false }) +
    '</div>';
  },

  /* كشف أقساط */
  t_installments(d){
    const size = d.size || 'A4';
    const list = d.rows || [];
    const cMap = DB.byId('customers');
    const body = list.map((r, i) => {
      const s = Engine.planSummary(r.plan);
      return '<tr><td>' + (i + 1) + '</td><td>' + U.esc((cMap[r.plan.customerId] || {}).name || '—') + '</td>' +
        '<td>' + U.esc((cMap[r.plan.customerId] || {}).phone || '—') + '</td>' +
        '<td class="n">' + U.num(s.total) + '</td><td class="n">' + U.num(s.paidAll) + '</td>' +
        '<td class="n">' + U.num(s.remaining) + '</td><td class="n">' + (s.overdue ? U.num(s.overdue) : '—') + '</td>' +
        '<td>' + (s.next ? U.dateAr(s.next.due) : '—') + '</td></tr>';
    }).join('');
    return '<div class="doc ' + Print.sizeClass(size) + '">' +
      Print.header({ docTitle: 'كشف الأقساط', date: U.today() }) +
      '<div class="doc-tot" style="width:100%">' +
        '<div><span>عدد الخطط</span><b>' + list.length + '</b></div>' +
        '<div><span>إجمالي الديون</span><b>' + U.num(U.sum(list, (r) => Engine.planSummary(r.plan).remaining)) + '</b></div>' +
        '<div class="grand"><span>المتأخر</span><span>' + U.num(U.sum(list, (r) => Engine.planSummary(r.plan).overdue)) + '</span></div>' +
      '</div>' +
      '<table class="doc-tbl"><thead><tr><th>#</th><th>الزبون</th><th>الهاتف</th><th class="n">الإجمالي</th><th class="n">المدفوع</th><th class="n">المتبقي</th><th class="n">المتأخر</th><th>أقرب استحقاق</th></tr></thead><tbody>' +
      (body || '<tr><td colspan="8" class="doc-center">لا توجد خطط</td></tr>') + '</tbody></table>' +
      Print.footer({ terms: false }) +
    '</div>';
  },

  /* تقرير يومي / شهري */
  t_daily(d){ return Print.t_period(d, 'تقرير اليوم'); },
  t_monthly(d){ return Print.t_period(d, 'التقرير الشهري'); },
  t_period(d){
    const size = d.size || 'A4';
    const from = d.from, to = d.to;
    const p = Engine.profitReport(DB.state, from, to);
    const box = d.cashbox;
    const invs = Engine.activeInvoices(DB.state, from, to);
    const top = Engine.topProducts(DB.state, from, to, 8);
    const cats = Engine.byCategory(DB.state, from, to);
    const exp = Engine.expensesSummary(DB.state, from, to);
    return '<div class="doc ' + Print.sizeClass(size) + '">' +
      Print.header({ docTitle: d.title || 'تقرير', date: U.today() }) +
      '<div class="doc-meta"><div><b>الفترة:</b> <span>' + U.dateAr(from) + ' → ' + U.dateAr(to) + '</span></div>' +
      '<div><b>عدد الفواتير:</b> <span>' + invs.length + '</span></div></div>' +
      '<div class="doc-tot" style="width:100%">' +
        '<div><span>إجمالي المبيعات</span><b>' + U.num(p.revenue) + '</b></div>' +
        '<div><span>كلفة البضاعة</span><b>' + U.num(p.cost) + '</b></div>' +
        '<div><span>الربح الإجمالي</span><b>' + U.num(p.gross) + '</b></div>' +
        '<div><span>المصاريف</span><b>' + U.num(p.expenses) + '</b></div>' +
        '<div><span>المرتجعات</span><b>' + U.num(p.returned) + '</b></div>' +
        '<div class="grand"><span>صافي الربح</span><span>' + U.num(p.net) + ' ' + U.esc(S().locale.currencySymbol) + '</span></div>' +
      '</div>' +
      (box ? '<h3 style="margin-top:12px">الصندوق</h3><div class="doc-tot" style="width:100%">' +
        '<div><span>رصيد بداية المدة</span><b>' + U.num(box.opening) + '</b></div>' +
        '<div><span>مبيعات نقدية</span><b>' + U.num(box.cashSales) + '</b></div>' +
        '<div><span>تسديدات</span><b>' + U.num(box.cashPayments) + '</b></div>' +
        '<div><span>مصاريف</span><b>' + U.num(box.expenses) + '</b></div>' +
        '<div><span>مرتجعات</span><b>' + U.num(box.returns) + '</b></div>' +
        '<div class="grand"><span>الرصيد المتوقع</span><span>' + U.num(box.expected) + '</span></div></div>' : '') +
      (cats.length ? '<h3 style="margin-top:12px">المبيعات حسب الأقسام</h3><table class="doc-tbl"><thead><tr><th>القسم</th><th class="n">الكمية</th><th class="n">المبيعات</th><th class="n">الربح</th></tr></thead><tbody>' +
        cats.map((c) => '<tr><td>' + U.esc(c.name) + '</td><td class="n">' + U.num(c.qty) + '</td><td class="n">' + U.num(c.sales) + '</td><td class="n">' + U.num(c.profit) + '</td></tr>').join('') + '</tbody></table>' : '') +
      (top.length ? '<h3 style="margin-top:12px">أفضل الأصناف مبيعاً</h3><table class="doc-tbl"><thead><tr><th>#</th><th>الصنف</th><th class="n">الكمية</th><th class="n">المبيعات</th><th class="n">الربح</th></tr></thead><tbody>' +
        top.map((t, i) => '<tr><td>' + (i + 1) + '</td><td>' + U.esc(t.name) + '</td><td class="n">' + U.num(t.qty) + '</td><td class="n">' + U.num(t.sales) + '</td><td class="n">' + U.num(t.profit) + '</td></tr>').join('') + '</tbody></table>' : '') +
      (exp.list.length ? '<h3 style="margin-top:12px">المصاريف</h3><table class="doc-tbl"><thead><tr><th>البند</th><th class="n">المبلغ</th></tr></thead><tbody>' +
        exp.cats.map((c) => '<tr><td>' + U.esc(c.name) + '</td><td class="n">' + U.num(c.amount) + '</td></tr>').join('') + '</tbody></table>' : '') +
      Print.footer({ terms: false }) +
    '</div>';
  },

  /* فاتورة شراء */
  t_purchase(d){
    const pur = d.purchase; if (!pur) return '';
    const size = d.size || 'A4';
    const sup = DB.get('suppliers', pur.supplierId) || {};
    return '<div class="doc ' + Print.sizeClass(size) + '">' +
      Print.header({ docTitle: 'فاتورة شراء', no: pur.no, date: pur.date }) +
      '<div class="doc-meta"><div><b>المورد:</b> <span>' + U.esc(sup.name || '—') + '</span></div>' +
      '<div><b>الهاتف:</b> <span>' + U.esc(sup.phone || '—') + '</span></div>' +
      '<div><b>الفرع:</b> <span>' + U.esc(DB.branchName(pur.branchId)) + '</span></div></div>' +
      '<table class="doc-tbl"><thead><tr><th>#</th><th>الصنف</th><th class="n">الكمية</th><th class="n">كلفة الوحدة</th><th class="n">الإجمالي</th></tr></thead><tbody>' +
      (pur.items || []).map((it, i) => '<tr><td>' + (i + 1) + '</td><td>' + U.esc(it.name) + '</td><td class="n">' + U.num(it.qty) + '</td><td class="n">' + U.num(it.cost) + '</td><td class="n">' + U.num((Number(it.qty) || 0) * (Number(it.cost) || 0)) + '</td></tr>').join('') +
      '</tbody></table>' +
      '<div class="doc-tot"><div><span>الإجمالي</span><b>' + U.num(pur.total) + '</b></div>' +
      '<div><span>المدفوع</span><b>' + U.num(pur.paid || 0) + '</b></div>' +
      '<div class="grand"><span>المتبقي</span><span>' + U.num(Math.max(0, (Number(pur.total) || 0) - (Number(pur.paid) || 0))) + '</span></div></div>' +
      Print.footer({ terms: false }) +
    '</div>';
  },

  /* وصل استلام (صيانة / بضاعة) */
  t_receipt_in(d){
    const rec = d.record; if (!rec) return '';
    const size = d.size || 'A4';
    return '<div class="doc ' + Print.sizeClass(size) + '">' +
      Print.header({ docTitle: d.title || 'وصل استلام', no: rec.no, date: rec.date }) +
      '<div class="doc-meta"><div><b>الزبون:</b> <span>' + U.esc(rec.customerName || '—') + '</span></div>' +
      '<div><b>الهاتف:</b> <span>' + U.esc(rec.customerPhone || '—') + '</span></div></div>' +
      '<div class="doc-tot" style="width:100%"><div><span>الصنف / الجهاز</span><b>' + U.esc(rec.device || '—') + '</b></div>' +
      '<div><span>السيريال</span><b>' + U.esc(rec.serial || '—') + '</b></div>' +
      (rec.cost ? '<div class="grand"><span>التكلفة</span><span>' + U.num(rec.cost) + '</span></div>' : '') + '</div>' +
      (rec.problem ? '<div class="doc-terms">الوصف: ' + U.esc(rec.problem) + '</div>' : '') +
      Print.footer({ terms: false }) +
    '</div>';
  },

  /* شهادة ضمان */
  t_warranty(d){
    const w = d.warranty; if (!w) return '';
    const size = d.size || 'A4';
    const p = DB.get('products', w.productId) || {};
    const cust = DB.get('customers', w.customerId) || {};
    const st = ST();
    return '<div class="doc ' + Print.sizeClass(size) + '">' +
      Print.header({ docTitle: 'شهادة ضمان', no: w.no, date: w.start }) +
      '<div class="doc-title">شهادة ضمان — ' + U.esc(p.name || '') + '</div>' +
      '<div class="doc-meta">' +
        '<div><b>الزبون:</b> <span>' + U.esc(cust.name || '—') + '</span></div>' +
        '<div><b>الهاتف:</b> <span>' + U.esc(cust.phone || '—') + '</span></div>' +
        '<div><b>الجهاز:</b> <span>' + U.esc(p.name || '—') + '</span></div>' +
        '<div><b>الموديل:</b> <span>' + U.esc(p.model || '—') + '</span></div>' +
        '<div><b>الرقم التسلسلي:</b> <span>' + U.esc(w.serial || '—') + '</span></div>' +
        '<div><b>مدة الضمان:</b> <span>' + (w.months || 0) + ' شهراً</span></div>' +
        '<div><b>بداية الضمان:</b> <span>' + U.dateAr(w.start) + '</span></div>' +
        '<div><b>نهاية الضمان:</b> <span>' + U.dateAr(w.end) + '</span></div>' +
      '</div>' +
      '<div class="doc-terms"><b>شروط الضمان:</b><br>' +
      '1- يشمل الضمان عيوب الصناعة فقط ولا يشمل سوء الاستخدام أو الكسر أو أضرار الكهرباء.<br>' +
      '2- يُلغى الضمان عند فتح الجهاز من قبل جهة غير مخوّلة أو عدم إبراز هذه الشهادة.<br>' +
      '3- أجور النقل والصيانة الدورية على حساب الزبون ما لم يُنص على خلاف ذلك.<br>' +
      '4- القطع المستهلكة (فلاتر، بطاريات، لمبات) غير مشمولة بالضمان.</div>' +
      Print.footer({}) +
    '</div>';
  },

  /* ملصقات باركود */
  t_labels(d){
    const size = d.size || '48x22';
    const dims = { '48x22': [48, 22], '70x30': [70, 30], '90x40': [90, 40] }[size] || [48, 22];
    const copies = Number(d.copies) || 1;
    let out = '<div class="doc" style="width:auto;padding:0"><style>' +
      '.lbl-item{display:inline-block;width:' + dims[0] + 'mm;height:' + dims[1] + 'mm;border:1px dashed #ccc;overflow:hidden;padding:1mm;text-align:center;font-size:8px;vertical-align:top;page-break-inside:avoid;box-sizing:border-box}' +
      '.lbl-item .n{font-weight:800;font-size:8px;line-height:1.2;height:2.4em;overflow:hidden}' +
      '.lbl-item .p{font-weight:800;color:#172033;font-size:9px}' +
      '</style>';
    (d.items || []).forEach((p) => {
      for (let i = 0; i < copies; i++){
        out += '<div class="lbl-item"><div class="n">' + U.esc(p.name) + '</div>' +
          U.barcodeSvg(p.barcode || p.code, { width: dims[0] - 4, height: 8, fontSize: 6, showText: true }) +
          '<div class="p">' + U.num(p.price) + '</div></div>';
      }
    });
    return out + '</div>';
  },

  /* ------------------------------------------------------ التشغيل والمعاينة */
  setPageStyle(size, opt){
    opt = opt || {};
    const el = document.getElementById('page-style');
    if (!el) return;
    const orient = opt.orientation || S().print.orientation || 'portrait';
    const margins = opt.margins || S().print.margins || '10mm';
    const sz = size === 'A5' ? 'A5' : size === 'T80' ? '80mm auto' : size === 'T58' ? '58mm auto' : 'A4';
    const m = Print.isThermal(size) ? '2mm' : margins;
    el.textContent = '@page{ size:' + sz + ' ' + (Print.isThermal(size) ? '' : orient) + '; margin:' + m + '; }';
  },

  render(html, size, opt){
    const host = document.getElementById('print-host');
    if (!host) return;
    Print.setPageStyle(size, opt);
    host.innerHTML = html;
  },

  run(html, opt){
    opt = opt || {};
    Print.render(html, opt.size || S().print.size, opt);
    const copies = Math.max(1, Number(opt.copies || S().print.copies || 1));
    const go = () => { try { window.print(); } catch(e){ UI.toast('تعذّرت الطباعة', 'err'); } };
    setTimeout(go, 220);
    setTimeout(() => { const host = document.getElementById('print-host'); if (host) host.innerHTML = ''; }, 1600);
    void copies;
  },

  preview(html, opt){
    opt = opt || {};
    const size = opt.size || S().print.size || 'A4';
    UI.modal({
      title: '🖨️ معاينة قبل الطباعة',
      wide: true,
      body: '<div class="toolbar no-print">' +
        '<div class="btn-group" data-preview-sizes>' +
        ['A4','A5','T80','T58'].map((s) => '<button data-act="pv-size" data-size="' + s + '" class="' + (s === size ? 'on' : '') + '">' + s + '</button>').join('') +
        '</div><div class="spacer"></div>' +
        '<button class="btn sm" data-act="pv-copies">النسخ: <b id="pvCopies">' + (S().print.copies || 1) + '</b></button>' +
        '</div>' +
        '<div class="preview-frame" id="pvFrame">' + html + '</div>',
      actions: [
        { label: 'إغلاق', cls: 'ghost', act: 'close-modal' },
        { label: '🖨️ طباعة', cls: 'primary', act: 'pv-print' }
      ],
      data: { html, size }
    });
  }
};
