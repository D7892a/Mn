/* ============================================================================
   14) بيانات تجريبية اختيارية (من الإدارة ← النسخ الاحتياطي ← تحميل بيانات تجريبية)
   ========================================================================== */
const Seed = {
  build(){
    if (DB.c('products').length || DB.c('customers').length){
      UI.toast('يوجد بيانات مسبقاً', 'warn', 'فرّغ البيانات أولاً إن أردت تجربة البيانات التجريبية');
      return;
    }
    const cats = DB.c('categories');
    const prods = [
      ['ثلاجة سامسونج 18 قدم', cats[0], 750000, 1000000, 6, 2, 'Samsung', 'RT5000', 24],
      ['ثلاجة ال جي 20 قدم', cats[0], 900000, 1200000, 4, 2, 'LG', 'GT-B20', 24],
      ['غسالة أوتوماتيك 8 كغم', cats[1], 420000, 560000, 8, 2, 'Beko', 'WTV8', 24],
      ['غسالة عادية 10 كغم', cats[1], 260000, 340000, 5, 2, 'Super General', 'SG-10', 12],
      ['طباخ غاز 5 عيون', cats[2], 300000, 400000, 7, 2, 'Glem', 'G5', 12],
      ['فرن كهربائي مدمج', cats[2], 380000, 500000, 3, 1, 'Bosch', 'HBF11', 24],
      ['مكيف سبلت 1.5 طن', cats[3], 520000, 690000, 9, 3, 'Gree', 'Pular', 36],
      ['مكيف عمودي 2 طن', cats[3], 880000, 1150000, 2, 1, 'Midea', 'MV-24', 36],
      ['تلفزيون 55 بوصة سمارت', cats[4], 430000, 570000, 6, 2, 'TCL', 'C645', 24],
      ['تلفزيون 43 بوصة', cats[4], 270000, 355000, 4, 2, 'Samsung', 'DU7000', 24],
      ['مبردة هواء', cats[5], 120000, 160000, 10, 3, 'Geepas', 'GAC', 12],
      ['مايكروويف 25 لتر', cats[5], 95000, 125000, 12, 3, 'Sharp', 'R-25', 12]
    ];
    const created = prods.map((p, i) => DB.add('products', {
      name: p[0], categoryId: p[1] ? p[1].id : '', cost: p[2], price: p[3], qty: p[4], minQty: p[5],
      brand: p[6], model: p[7], warrantyMonths: p[8], code: 'P-' + String(i + 1).padStart(4, '0'),
      barcode: U.eanDigits('22' + String(i + 1).padStart(6, '0')), unit: 'قطعة', active: true, color: '', size: ''
    }));

    const names = [
      ['أحمد علي حسين', '07701234567', 'الناصرية — شارع الحبوبي', 'vip'],
      ['كرار محمد جاسم', '07811223344', 'الناصرية — حي الثورة', 'normal'],
      ['زينب كاظم', '07712345678', 'سوق الشيوخ', 'normal'],
      ['حيدر صباح', '07801112233', 'الناصرية — حي الشهداء', 'new'],
      ['مصطفى جبار', '07719998877', 'الرفاعي', 'normal'],
      ['سارة ناصر', '07802223344', 'الناصرية — شارع الجمهورية', 'vip']
    ];
    const custs = names.map((n, i) => DB.add('customers', {
      name: n[0], phone: n[1], address: n[2], tier: n[3], code: 'C-' + String(i + 1).padStart(4, '0'),
      creditLimit: 0, notes: '', createdAt: U.addDays(U.now(), -(i + 3) * 5)
    }, { branch: false }));

    const sup = DB.add('suppliers', { name: 'شركة النور للأجهزة', phone: '07901112233', contact: 'أبو مصطفى', company: 'Samsung / LG', address: 'بغداد — الكرادة' }, { branch: false });
    DB.add('purchases', { no: 'PUR-0001', date: U.addDays(U.today(), -40), supplierId: sup.id, paid: 3000000, total: 5000000, items: created.slice(0, 4).map((p) => ({ productId: p.id, name: p.name, qty: 5, cost: p.cost })), note: 'دفعة أولى' });
    DB.add('supplierPayments', { no: 'SP-0001', date: U.addDays(U.today(), -20), supplierId: sup.id, amount: 3000000, note: 'دفعة نقدية' });

    /* مبيعات نقدية خلال الشهر */
    const cashSales = [[0, 1], [2, 2], [6, 1], [8, 1], [11, 2], [4, 1], [9, 1], [3, 1]];
    cashSales.forEach((s, i) => {
      const p = created[s[0]];
      Sales.createInvoice({ customerId: custs[i % custs.length].id, items: [{ productId: p.id, qty: s[1] }], method: 'cash', note: '' });
      const inv = DB.c('invoices')[DB.c('invoices').length - 1];
      DB.update('invoices', inv.id, { date: U.addDays(U.today(), -(i + 1)) });
      DB.c('payments').forEach((pay) => { if (pay.invoiceId === inv.id) pay.date = U.addDays(U.today(), -(i + 1)); });
    });

    /* مبيعات بالتقسيط */
    const instSales = [[0, 1, 200000, 10], [6, 1, 150000, 12], [8, 1, 100000, 6], [2, 1, 100000, 10], [9, 2, 150000, 12]];
    instSales.forEach((s, i) => {
      const p = created[s[0]];
      const res = Sales.createInvoice({
        customerId: custs[i % custs.length].id, items: [{ productId: p.id, qty: s[1] }],
        method: 'installment', plan: { down: s[2], months: s[3], dueDay: 15 }
      });
      if (res.ok){
        const inv = res.invoice;
        const back = 30 + i * 20;
        DB.update('invoices', inv.id, { date: U.addDays(U.today(), -back) });
        const plan = DB.get('plans', inv.planId);
        if (plan){
          DB.update('plans', plan.id, {
            startDate: U.addDays(U.today(), -back),
            items: plan.items.map((it, k) => ({ ...it, due: Engine.dueDate(U.addDays(U.today(), -back), k, 15) }))
          });
          /* تسديد بعض الأقساط */
          const pl = DB.get('plans', plan.id);
          const paidCount = Math.min(pl.items.length, i + 1);
          for (let k = 0; k < paidCount; k++){
            const it = pl.items[k];
            if (it.due > U.today()) break;
            Sales.recordPayment({ customerId: inv.customerId, amount: it.amount, method: 'cash', note: 'قسط ' + it.no, planId: pl.id, silent: true });
          }
        }
      }
    });

    /* مصاريف */
    EXPENSE_CATS.slice(0, 5).forEach((c, i) => {
      DB.add('expenses', { date: U.addDays(U.today(), -(i * 3 + 1)), category: c, amount: [350000, 120000, 75000, 60000, 500000][i], note: '' });
    });

    /* خدمات */
    DB.add('maintenance', { no: 'M-0001', date: U.addDays(U.today(), -4), customerId: custs[0].id, device: 'ثلاجة سامسونج 18 قدم', serial: 'SN-112233', problem: 'لا تبرد بشكل كافٍ', techId: (DB.c('techs')[0] || {}).id, status: 'repair', cost: 35000, underWarranty: false });
    DB.add('maintenance', { no: 'M-0002', date: U.addDays(U.today(), -1), customerId: custs[2].id, device: 'غسالة أوتوماتيك', serial: 'SN-445566', problem: 'تسريب ماء', techId: (DB.c('techs')[0] || {}).id, status: 'inspect', cost: 0, underWarranty: true });
    DB.add('deliveries', { no: 'D-0001', date: U.today(), customerId: custs[1].id, customerName: custs[1].name, phone: custs[1].phone, address: custs[1].address, driverId: (DB.c('drivers')[0] || {}).id, fee: 15000, scheduleAt: U.addDays(U.today(), 1), status: 'scheduled', items: 'مكيف سبلت 1.5 طن' });
    DB.add('deliveries', { no: 'D-0002', date: U.addDays(U.today(), -2), customerId: custs[4].id, customerName: custs[4].name, phone: custs[4].phone, address: custs[4].address, fee: 10000, scheduleAt: U.addDays(U.today(), -2), status: 'done', items: 'تلفزيون 55 بوصة' });
    DB.add('tasks', { title: 'متابعة الزبون كرار عن القسط المتأخر', due: U.today(), priority: 'high', done: false });
    DB.add('tasks', { title: 'طلب 3 ثلاجات من مورد النور', due: U.addDays(U.today(), 2), priority: 'normal', done: false });

    DB.state.seeded = true;
    DB.save(true);
    DB.log('تحميل بيانات تجريبية', '', '', 'warn');
    UI.toast('تم تحميل البيانات التجريبية', 'ok', DB.c('products').length + ' منتج و' + DB.c('customers').length + ' زبون');
    App.render();
  }
};
