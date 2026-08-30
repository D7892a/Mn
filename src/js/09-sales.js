/* ============================================================================
   09) المبيعات: نقطة البيع، الفواتير، العروض، الحجوزات، المرتجعات،
       الأقساط، التسديدات، كشوف الحساب، الزبائن
   ========================================================================== */

/* ---------------------------------------------------------------- محرر الأصناف */
const ItemsEditor = {
  paint(ctx, opt){
    opt = opt || {};
    ctx.data.opt = opt;
    const priceKey = opt.priceKey || 'price';
    const priceLabel = opt.priceLabel || 'السعر';
    const items = ctx.data.items || (ctx.data.items = []);
    const tot = Engine.invoiceTotals(items, { discount: 0, taxRate: 0 });
    const prods = DB.c('products').filter((p) => p.active !== false);
    const rows = items.map((it, i) => '<tr data-i="' + i + '">' +
      '<td><select class="select" data-act="ie-product" data-i="' + i + '">' +
      '<option value="">— اختر صنفاً —</option>' +
      prods.map((p) => '<option value="' + p.id + '" ' + (p.id === it.productId ? 'selected' : '') + '>' + U.esc(p.name) + (p.code ? ' (' + U.esc(p.code) + ')' : '') + '</option>').join('') +
      '</select></td>' +
      '<td style="width:90px"><input class="input" type="number" min="1" value="' + (it.qty || 1) + '" data-act="ie-qty" data-i="' + i + '"></td>' +
      '<td style="width:130px"><input class="input" type="number" min="0" step="250" value="' + (it[priceKey] || 0) + '" data-act="ie-price" data-i="' + i + '"></td>' +
      (opt.discount ? '<td style="width:110px"><input class="input" type="number" min="0" value="' + (it.discount || 0) + '" data-act="ie-disc" data-i="' + i + '"></td>' : '') +
      '<td class="num b nowrap">' + U.money((Number(it.qty) || 0) * (Number(it[priceKey]) || 0) - (Number(it.discount) || 0)) + '</td>' +
      '<td class="acts"><button class="btn xs ghost" data-act="ie-del" data-i="' + i + '">🗑️</button></td></tr>').join('');
    const box = ctx.slot.querySelector('#itemsEditor');
    if (!box) return;
    const grand = priceKey === 'price'
      ? tot.subtotal - U.sum(items, (i) => Number(i.discount) || 0)
      : U.sum(items, (i) => (Number(i.qty) || 0) * (Number(i[priceKey]) || 0) - (Number(i.discount) || 0));
    box.innerHTML = '<div class="table-wrap" style="max-height:280px"><table class="tbl compact"><thead><tr>' +
      '<th>الصنف</th><th style="width:90px">الكمية</th><th style="width:130px">' + U.esc(priceLabel) + '</th>' +
      (opt.discount ? '<th style="width:110px">الخصم</th>' : '') + '<th class="num">الإجمالي</th><th style="width:44px"></th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="mid dim" style="padding:18px">لا أصناف بعد</td></tr>') + '</tbody></table></div>' +
      '<div class="row gap-8 mt-8"><button class="btn sm soft" data-act="ie-add">＋ إضافة صنف</button>' +
      '<div class="spacer"></div><div class="b">الإجمالي: <span class="num" style="color:var(--accent)">' + U.money(grand) + '</span></div></div>';
  },
  add(ctx){ (ctx.data.items || (ctx.data.items = [])).push({ productId: '', name: '', qty: 1, price: 0, cost: 0, discount: 0 }); ItemsEditor.paint(ctx, ctx.data.opt); },
  sync(ctx, i, patch){
    const it = ctx.data.items[i];
    if (!it) return;
    Object.assign(it, patch);
    if (patch.productId != null){
      const p = DB.get('products', patch.productId);
      if (p){ it.name = p.name; it.code = p.code; it.cost = Number(p.cost) || 0; it.price = Number(p.price) || 0; it.warrantyMonths = p.warrantyMonths || 0; }
      else { it.name = ''; it.cost = 0; it.price = 0; }
    }
    ItemsEditor.paint(ctx, ctx.data.opt);
  }
};

/* ---------------------------------------------------------------- إنشاء فاتورة */
const Sales = {
  createInvoice(o){
    const items = (o.items || []).filter((i) => i.productId && Number(i.qty) > 0).map((i) => {
      const p = DB.get('products', i.productId) || {};
      return {
        productId: i.productId, code: p.code || i.code || '', name: p.name || i.name || 'صنف',
        qty: Number(i.qty) || 1, price: Number(i.price) || Number(p.price) || 0, cost: Number(i.cost) || Number(p.cost) || 0,
        discount: Number(i.discount) || 0, serial: i.serial || '', warrantyMonths: p.warrantyMonths || 0
      };
    });
    if (!items.length) return { ok: false, msg: 'لا توجد أصناف في السلة' };
    /* فحص الكمية */
    if (!o.allowNegativeStock){
      for (const it of items){
        const p = DB.get('products', it.productId);
        if (p && Number(p.qty) < it.qty) return { ok: false, msg: 'الكمية غير متوفرة من «' + p.name + '» — المتاح ' + (p.qty || 0) };
      }
    }
    const s = S();
    const maxD = s.sales.allowDiscount ? (s.sales.maxDiscount || 100) : 0;
    const tot = Engine.invoiceTotals(items, {
      discount: Number(o.discount) || 0, maxDiscountPct: maxD, taxRate: s.sales.taxRate || 0, roundTo: s.sales.roundTo || 0
    });
    const today = U.today();
    const method = o.method || 'cash';
    let plan = null;
    let paid = Number(o.paid != null ? o.paid : tot.total);
    if (method === 'installment'){
      const minDown = tot.total * ((s.installments.minDownPercent || 0) / 100);
      const down = Math.max(0, Number(o.plan && o.plan.down) || 0);
      if (s.installments.requireDown && down + 0.5 < minDown){
        return { ok: false, msg: 'الدفعة الأولى أقل من الحد الأدنى (' + U.money(minDown) + ')' };
      }
      plan = Engine.buildPlan({
        total: tot.total, down, months: (o.plan && o.plan.months) || 10,
        dueDay: (o.plan && o.plan.dueDay) || s.installments.dueDay, startDate: today,
        roundTo: s.sales.roundTo || 250, firstDueSameMonth: !!(o.plan && o.plan.firstDueSameMonth)
      });
      paid = down;
    }
    const inv = {
      no: DB.docNo('INV', 'invoice'), date: today, time: new Date().toTimeString().slice(0, 5),
      customerId: o.customerId || '', items,
      subtotal: tot.subtotal, lineDiscount: tot.lineDiscount, discount: tot.discount, tax: tot.tax,
      total: tot.total, paid: method === 'installment' ? paid : tot.total, method,
      status: 'active', note: o.note || '', userId: (Auth.user() || {}).id || '',
      verify: U.uid(), profit: tot.profit
    };
    const rec = DB.add('invoices', inv);
    /* خصم المخزون + حركة */
    items.forEach((it) => {
      const p = DB.get('products', it.productId);
      if (!p) return;
      p.qty = Number(p.qty || 0) - it.qty;
      if (!p.lastSold || p.lastSold < today) p.lastSold = today;
      p.soldCount = (Number(p.soldCount) || 0) + it.qty;
      DB.c('stockMoves').unshift({ id: U.id('mv'), at: U.now(), productId: p.id, type: 'out', qty: -it.qty, ref: rec.no, note: 'بيع', userId: (Auth.user() || {}).id });
    });
    /* خطة الأقساط */
    if (plan){
      const planRec = DB.add('plans', {
        no: DB.docNo('PLN', 'plan'), invoiceId: rec.id, customerId: o.customerId,
        total: plan.total, down: plan.down, financed: plan.financed, months: plan.months,
        dueDay: plan.dueDay, startDate: plan.startDate, step: plan.step, items: plan.items, status: 'active'
      });
      rec.planId = planRec.id; DB.update('invoices', rec.id, { planId: planRec.id });
    }
    /* تسجيل المقبوض */
    if (paid > 0){
      /* دفعة الفاتورة نفسها (نقدي/بطاقة/الدفعة الأولى) لا تُوزَّع على الأقساط حتى لا تُحتسب مرتين */
      Sales.recordPayment({
        customerId: o.customerId, amount: paid, method: method === 'installment' ? 'cash' : method,
        note: (method === 'installment' ? 'دفعة أولى — ' : '') + rec.no, invoiceId: rec.id, silent: true,
        planId: '', allocate: false
      });
    }
    /* الضمان */
    if (s.sales.autoWarranty){
      items.forEach((it) => {
        if (!it.warrantyMonths || Number(it.warrantyMonths) <= 0) return;
        DB.add('warranties', {
          no: DB.docNo('WAR', 'warranty'), productId: it.productId, customerId: o.customerId, invoiceId: rec.id,
          serial: it.serial || '', start: today, months: Number(it.warrantyMonths),
          end: U.addMonths(today, Number(it.warrantyMonths)), status: 'active'
        });
      });
    }
    DB.log('فاتورة بيع', rec.no, U.money(tot.total) + ' — ' + (method === 'installment' ? 'تقسيط' : 'نقدي'), 'ok');
    return { ok: true, invoice: rec, plan: rec.planId ? DB.get('plans', rec.planId) : null };
  },

  recordPayment(o){
    const amount = Math.max(0, Number(o.amount) || 0);
    if (amount <= 0) return { ok: false, msg: 'أدخل مبلغاً صحيحاً' };
    const canAllocate = o.allocate !== false;
    const plans = !canAllocate ? [] :
      o.planId ? DB.c('plans').filter((p) => p.id === o.planId) :
      DB.c('plans').filter((p) => p.customerId === o.customerId && p.status !== 'void' && p.status !== 'closed');
    let allocations = [];
    plans.sort((a, b) => String((a.items[0] || {}).due || '').localeCompare(String((b.items[0] || {}).due || '')));
    let left = amount;
    for (const pl of plans){
      if (left <= 0) break;
      const res = Engine.allocate(pl, left, U.today());
      if (res.allocations.length){
        DB.update('plans', pl.id, { items: res.plan.items, status: res.plan.status });
        res.allocations.forEach((a) => allocations.push({ ...a, planId: pl.id, planNo: pl.no }));
        left = res.leftover;
      }
    }
    const pay = DB.add('payments', {
      no: DB.docNo('PAY', 'payment'), date: U.today(), time: new Date().toTimeString().slice(0, 5),
      customerId: o.customerId, amount, method: o.method || 'cash', note: o.note || '',
      invoiceId: o.invoiceId || '', allocations, userId: (Auth.user() || {}).id, leftover: left
    });
    if (!o.silent) DB.log('تسديد', pay.no, U.money(amount), 'ok');
    return { ok: true, payment: pay, leftover: left };
  },

  voidInvoice(id){
    const inv = DB.get('invoices', id);
    if (!inv) return { ok: false, msg: 'الفاتورة غير موجودة' };
    if (inv.status === 'void') return { ok: false, msg: 'الفاتورة ملغاة مسبقاً' };
    const plan = inv.planId ? DB.get('plans', inv.planId) : null;
    if (plan){
      const paidAmt = U.sum(plan.items, (i) => Number(i.paid) || 0) + Number(plan.down || 0);
      if (paidAmt > 0) return { ok: false, msg: 'لا يمكن إلغاء فاتورة عليها دفعات — استخدم المرتجعات' };
      DB.update('plans', plan.id, { status: 'void' });
    }
    (inv.items || []).forEach((it) => {
      const p = DB.get('products', it.productId);
      if (p){
        p.qty = Number(p.qty || 0) + Number(it.qty || 0);
        DB.c('stockMoves').unshift({ id: U.id('mv'), at: U.now(), productId: p.id, type: 'return', qty: Number(it.qty) || 0, ref: inv.no, note: 'إلغاء فاتورة' });
      }
    });
    DB.update('invoices', id, { status: 'void', voidAt: U.now(), voidBy: (Auth.user() || {}).id });
    DB.c('warranties').forEach((w) => { if (w.invoiceId === id) w.status = 'void'; });
    DB.log('إلغاء فاتورة', inv.no, U.money(inv.total), 'warn');
    return { ok: true };
  }
};

/* ============================================================================
   نقطة البيع POS
   ========================================================================== */
Views.pos = function(){
  const pos = App.pos;
  const f = App.posFilter;
  const cats = DB.c('categories');
  const prods = DB.c('products').filter((p) => p.active !== false)
    .filter((p) => !f.cat || p.categoryId === f.cat)
    .filter((p) => !f.q || U.has(p.name, f.q) || U.has(p.code, f.q) || U.has(p.barcode, f.q) || U.has(p.model, f.q))
    .slice(0, 60);
  const tot = Engine.invoiceTotals(pos.items, { discount: pos.discount, taxRate: S().sales.taxRate || 0, roundTo: S().sales.roundTo || 0 });
  const cust = pos.customerId ? DB.get('customers', pos.customerId) : null;

  const cartLines = pos.items.length ? pos.items.map((it, i) => {
    const t = Engine.lineTotals(it);
    const p = DB.get('products', it.productId);
    return '<div class="cart-line">' +
      '<div><div class="cl-n">' + U.esc(it.name) + '</div>' +
      '<div class="cl-m">' + U.money(it.price) + ' × ' + it.qty + (p && Number(p.qty) < it.qty ? ' <span class="badge danger">المخزون ' + p.qty + '</span>' : '') + '</div>' +
      '<div class="cl-m">' + (it.serial ? 'سيريال: ' + U.esc(it.serial) : '') + '</div></div>' +
      '<div class="col gap-4" style="align-items:flex-end">' +
      '<div class="b num">' + U.money(t.net) + '</div>' +
      '<div class="row gap-4"><div class="qty"><button data-act="pos-qty" data-i="' + i + '" data-v="-1">−</button>' +
      '<input value="' + it.qty + '" data-act="pos-qty-set" data-i="' + i + '" inputmode="numeric">' +
      '<button data-act="pos-qty" data-i="' + i + '" data-v="1">+</button></div>' +
      '<button class="btn xs ghost" data-act="pos-del" data-i="' + i + '">🗑️</button></div>' +
      '<button class="btn xs ghost" data-act="pos-line" data-i="' + i + '">تعديل السعر/الخصم</button>' +
      '</div></div>';
  }).join('') : UI.empty('🛒', 'السلة فارغة', 'ابحث أو اضغط على أي منتج لإضافته.');

  return '<div class="view-in">' +
    '<div class="pos">' +
      '<div class="col gap-12">' +
        '<div class="card pad-0" style="padding:12px">' +
          '<div class="row gap-8 wrap">' +
            '<div class="search grow" style="max-width:none"><span class="s-ic">🔍</span>' +
            '<input id="posSearch" data-act="pos-search" value="' + U.attr(f.q) + '" placeholder="ابحث بالاسم أو الكود أو الباركود… (ماسح الباركود يعمل هنا)" autofocus></div>' +
            '<button class="btn" data-act="pos-customer">👤 ' + (cust ? U.esc(cust.name) : 'اختيار زبون') + '</button>' +
          '</div>' +
          '<div class="pos-cats mt-12"><button class="chip ' + (!f.cat ? 'on' : '') + '" data-act="pos-cat" data-v="">الكل</button>' +
            cats.map((c) => '<button class="chip ' + (f.cat === c.id ? 'on' : '') + '" data-act="pos-cat" data-v="' + c.id + '">' + (c.icon || '') + ' ' + U.esc(c.name) + '</button>').join('') +
          '</div>' +
        '</div>' +
        '<div class="prod-grid">' + (prods.length ? prods.map((p) => {
          const out = Number(p.qty) <= 0;
          return '<button class="prod-card ' + (out ? 'out' : '') + '" data-act="pos-add" data-id="' + p.id + '">' +
            '<div class="p-img">' + V.productIcon(p) + '</div>' +
            '<div class="p-n">' + U.esc(p.name) + '</div>' +
            '<div class="p-p num">' + U.money(p.price) + '</div>' +
            '<div class="p-q">المتوفر: <b class="' + (out ? '' : '') + '" style="color:' + (out ? 'var(--danger)' : 'var(--ink-2)') + '">' + (Number(p.qty) || 0) + '</b></div>' +
            (Number(p.qty) > 0 && Number(p.qty) <= Number(p.minQty || 0) ? '<span class="p-flag badge warn">منخفض</span>' : '') +
            (out ? '<span class="p-flag badge danger">نفد</span>' : '') +
          '</button>';
        }).join('') : UI.empty('📦', 'لا توجد منتجات', 'أضف منتجات من قسم المخزون أو استورد ملف Excel.', '<button class="btn primary sm mt-8" data-act="crud-new" data-k="products">＋ منتج جديد</button>')) + '</div>' +
      '</div>' +
      '<div class="card cart">' +
        '<div class="card-h"><h3>🧾 السلة</h3><span class="sub">' + pos.items.length + ' صنف</span>' +
        '<div class="acts"><button class="btn xs ghost" data-act="pos-clear">تفريغ</button></div></div>' +
        '<div class="cart-items">' + cartLines + '</div>' +
        '<div class="divider"></div>' +
        '<div class="tot-row"><span class="muted">المجموع</span><span class="num">' + U.money(tot.subtotal) + '</span></div>' +
        (tot.lineDiscount ? '<div class="tot-row"><span class="muted">خصم الأصناف</span><span class="num">-' + U.money(tot.lineDiscount) + '</span></div>' : '') +
        '<div class="tot-row"><span class="muted">الخصم العام</span>' +
          '<button class="btn xs soft" data-act="pos-discount">' + (tot.discount ? U.money(tot.discount) : '＋ إضافة') + '</button></div>' +
        (tot.tax ? '<div class="tot-row"><span class="muted">الضريبة</span><span class="num">' + U.money(tot.tax) + '</span></div>' : '') +
        '<div class="tot-row grand"><span>الإجمالي</span><span class="num" style="color:var(--accent)">' + U.money(tot.total) + '</span></div>' +
        (Auth.can('act.cost') ? '<div class="tot-row tiny"><span class="dim">الربح المتوقع</span><span class="num" style="color:var(--ok)">' + U.money(tot.profit) + '</span></div>' : '') +
        '<div class="divider"></div>' +
        '<div class="pay-grid">' +
          '<button class="pay-opt ' + (pos.method === 'cash' ? 'on' : '') + '" data-act="pos-method" data-v="cash"><span class="ic">💵</span>نقدي</button>' +
          '<button class="pay-opt ' + (pos.method === 'installment' ? 'on' : '') + '" data-act="pos-method" data-v="installment"><span class="ic">💳</span>تقسيط</button>' +
        '</div>' +
        '<div class="row gap-8 mt-12">' +
          '<button class="btn grow" data-act="pos-hold">' + (pos.held ? '📌 معلّقة (' + pos.held.length + ')' : '📌 تعليق') + '</button>' +
          '<button class="btn primary lg grow" data-act="pos-checkout" ' + (pos.items.length ? '' : 'disabled') + '>✅ إتمام البيع</button>' +
        '</div>' +
        '<div class="tiny dim mt-8 mid">البائع: ' + U.esc((Auth.user() || {}).name || '') + ' — ' + U.dateAr(U.today()) + '</div>' +
      '</div>' +
    '</div></div>';
};

const POS = {
  add(productId, qty){
    const p = DB.get('products', productId);
    if (!p) return;
    const items = App.pos.items;
    const ex = items.find((i) => i.productId === productId && !i.serial);
    if (ex) ex.qty = Number(ex.qty) + (qty || 1);
    else items.push({ productId: p.id, code: p.code, name: p.name, qty: qty || 1, price: Number(p.price) || 0, cost: Number(p.cost) || 0, discount: 0, warrantyMonths: p.warrantyMonths || 0, serial: '' });
    App.render();
    if (S().ui.sounds) POS.beep();
  },
  beep(){ try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = .04; o.start(); setTimeout(() => { o.stop(); c.close(); }, 90); } catch(e){} },
  findByBarcode(code){
    const c = String(code || '').trim();
    if (!c) return null;
    return DB.c('products').find((p) => String(p.barcode) === c) || DB.c('products').find((p) => String(p.code) === c) || null;
  },
  checkout(){
    const pos = App.pos;
    if (!pos.items.length){ UI.toast('السلة فارغة', 'warn'); return; }
    if (pos.method === 'installment') return POS.installmentModal();
    POS.cashModal();
  },
  cashModal(){
    const pos = App.pos;
    const tot = Engine.invoiceTotals(pos.items, { discount: pos.discount, taxRate: S().sales.taxRate || 0, roundTo: S().sales.roundTo || 0 });
    UI.modal({
      title: '💵 إتمام البيع النقدي', icon: '🧾',
      body: '<div class="form-grid">' +
        '<div class="field full"><label>طريقة الدفع</label><div class="btn-group" style="width:100%">' +
        ['cash', 'card', 'transfer'].map((m) => '<button data-act="cash-method" data-v="' + m + '" class="' + (pos.method === m ? 'on' : '') + '" style="flex:1">' + App.payLabel(m) + '</button>').join('') +
        '</div></div>' +
        '<div class="field"><label>الإجمالي</label><input class="input" value="' + U.num(tot.total) + '" disabled></div>' +
        '<div class="field"><label>المبلغ المستلم</label><input class="input" id="recvAmt" type="number" value="' + tot.total + '" inputmode="numeric"></div>' +
        '<div class="field"><label>الباقي للزبون</label><input class="input" id="chgAmt" value="0" disabled></div>' +
        '<div class="field full"><label>ملاحظة</label><input class="input" id="invNote" value="' + U.attr(pos.note) + '"></div>' +
        '</div>' +
        (Auth.can('act.cost') ? '<div class="hint-box ok mt-12">💰 ربح هذه الفاتورة: <b>' + U.money(tot.profit) + '</b> (' + U.pct(tot.margin, 1) + ')</div>' : ''),
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 حفظ وطباعة', cls: 'primary', handler: (ctx) => {
          const note = ctx.slot.querySelector('#invNote').value;
          const res = Sales.createInvoice({ customerId: App.pos.customerId, items: App.pos.items, discount: App.pos.discount, method: App.pos.method, note });
          if (!res.ok){ UI.toast('تعذّر إتمام البيع', 'err', res.msg); return; }
          UI.closeModal();
          App.pos = { items: [], customerId: '', discount: 0, method: 'cash', note: '', held: App.pos.held };
          UI.toast('تم البيع بنجاح', 'ok', res.invoice.no + ' — ' + U.money(res.invoice.total));
          App.render();
          Print.run(Print.doc('invoice', { invoice: res.invoice }), { size: S().invoice.size });
        } }
      ]
    });
    const upd = () => {
      const r = Number(UI.$('#recvAmt').value) || 0;
      UI.$('#chgAmt').value = U.num(Math.max(0, r - tot.total));
    };
    UI.on(UI.$('#recvAmt'), 'input', upd); upd();
  },
  installmentModal(){
    const pos = App.pos;
    const tot = Engine.invoiceTotals(pos.items, { discount: pos.discount, taxRate: S().sales.taxRate || 0, roundTo: S().sales.roundTo || 0 });
    const cfg = S().installments;
    const cust = pos.customerId ? DB.get('customers', pos.customerId) : null;
    const minDown = U.round(tot.total * (cfg.minDownPercent || 0) / 100, S().sales.roundTo || 250);
    UI.modal({
      title: '💳 بيع بالتقسيط', icon: '💳', wide: true,
      data: { preview: null },
      body: '<div class="form-grid">' +
        '<div class="field"><label>الزبون <span class="req">*</span></label>' +
        '<div class="row gap-6"><select class="select" id="ipCust"><option value="">— اختر زبوناً —</option>' +
        DB.c('customers').sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((c) => '<option value="' + c.id + '" ' + (pos.customerId === c.id ? 'selected' : '') + '>' + U.esc(c.name) + (c.phone ? ' — ' + U.esc(c.phone) : '') + '</option>').join('') +
        '</select><button class="btn sm soft nowrap" data-act="crud-new" data-k="customers">＋ جديد</button></div>' +
        '<span class="hint" id="ipCustInfo">' + (cust ? 'المتبقي عليه: ' + U.money(Engine.customerBalance(DB.state, cust.id).remaining) : 'البيع بالتقسيط يتطلب تسجيل الزبون') + '</span></div>' +
        '<div class="field"><label>قيمة السلعة</label><input class="input" value="' + U.num(tot.total) + '" disabled></div>' +
        '<div class="field"><label>الدفعة الأولى</label><input class="input" id="ipDown" type="number" step="250" value="' + minDown + '" inputmode="numeric">' +
        '<span class="hint">الحد الأدنى ' + U.money(minDown) + ' (' + (cfg.minDownPercent || 0) + '%)</span></div>' +
        '<div class="field"><label>المتبقي (المموَّل)</label><input class="input" id="ipFin" value="' + U.num(tot.total - minDown) + '" disabled></div>' +
        '<div class="field"><label>عدد الأشهر</label><select class="select" id="ipMonths">' +
        (cfg.months || [3, 6, 10, 12, 18, 24]).map((m) => '<option value="' + m + '" ' + (m === 10 ? 'selected' : '') + '>' + m + ' شهر</option>').join('') + '</select></div>' +
        '<div class="field"><label>يوم الاستحقاق</label><input class="input" id="ipDay" type="number" min="1" max="28" value="' + (cfg.dueDay || 15) + '"></div>' +
        '<div class="field"><label>زيادة التقسيط (اختياري)</label><input class="input" id="ipMarkup" type="number" step="250" value="0" inputmode="numeric">' +
        '<span class="hint">تُضاف على المبلغ المموَّل وتُحتسب ربحاً</span></div>' +
        '<div class="field"><label>الكفيل</label><input class="input" id="ipGuar" value="' + U.attr((cust && cust.guarantor) || '') + '"></div>' +
        '</div>' +
        '<div class="divider"></div><h3 class="mb-8">📅 جدول الأقساط المتوقع</h3><div id="ipPreview">' + UI.skeleton(3) + '</div>',
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 اعتماد البيع بالتقسيط', cls: 'primary', handler: (ctx) => {
          const customerId = ctx.slot.querySelector('#ipCust').value;
          if (!customerId){ UI.toast('اختر الزبون', 'err', 'البيع بالتقسيط يتطلب ملف زبون'); return; }
          const guar = ctx.slot.querySelector('#ipGuar').value;
          if (guar) DB.update('customers', customerId, { guarantor: guar });
          const res = Sales.createInvoice({
            customerId, items: App.pos.items, discount: App.pos.discount, method: 'installment',
            plan: { down: Number(ctx.slot.querySelector('#ipDown').value) || 0, months: Number(ctx.slot.querySelector('#ipMonths').value), dueDay: Number(ctx.slot.querySelector('#ipDay').value) }
          });
          if (!res.ok){ UI.toast('تعذّر إنشاء العقد', 'err', res.msg); return; }
          UI.closeModal();
          App.pos = { items: [], customerId: '', discount: 0, method: 'cash', note: '', held: App.pos.held };
          UI.toast('تم إنشاء عقد التقسيط', 'ok', res.invoice.no + ' — ' + (res.plan ? res.plan.items.length + ' قسطاً' : ''));
          App.render();
          Print.run(Print.doc('installment', { invoice: res.invoice, plan: res.plan }), { size: S().invoice.size });
        } }
      ],
      onOpen: (ctx) => {
        const paint = () => {
          const down = Number(ctx.slot.querySelector('#ipDown').value) || 0;
          const months = Number(ctx.slot.querySelector('#ipMonths').value) || 1;
          const day = Number(ctx.slot.querySelector('#ipDay').value) || 15;
          const markup = Number(ctx.slot.querySelector('#ipMarkup').value) || 0;
          const total = tot.total + markup;
          const plan = Engine.buildPlan({ total, down, months, dueDay: day, startDate: U.today(), roundTo: S().sales.roundTo || 250 });
          ctx.data.preview = plan;
          ctx.slot.querySelector('#ipFin').value = U.num(plan.financed);
          const sum = Engine.planSummary(plan);
          ctx.slot.querySelector('#ipPreview').innerHTML =
            '<div class="row gap-16 wrap mb-8"><span class="tiny muted">المموَّل: <b class="num">' + U.money(plan.financed) + '</b></span>' +
            '<span class="tiny muted">القسط الشهري: <b class="num">' + U.money(plan.per) + '</b></span>' +
            '<span class="tiny muted">مجموع الأقساط: <b class="num">' + U.money(sum.financed) + '</b></span></div>' +
            UI.table({
              compact: true, maxHeight: '220px',
              columns: [
                { title: 'القسط', render: (i) => '<b>' + i.no + '</b>' },
                { title: 'التاريخ', render: (i) => U.dateAr(i.due, { short: true }) + ' <span class="tiny dim">' + U.dateAr(i.due) + '</span>' },
                { title: 'المبلغ', cls: 'num', render: (i) => U.money(i.amount) },
                { title: 'الحالة', render: (i) => UI.statusBadge(Engine.installmentStatus(i, U.today())) }
              ],
              rows: plan.items
            });
        };
        ['#ipDown', '#ipMonths', '#ipDay', '#ipMarkup'].forEach((sel) => UI.on(ctx.slot.querySelector(sel), 'input', U.debounce(paint, 150)));
        UI.on(ctx.slot.querySelector('#ipCust'), 'change', () => {
          const c = DB.get('customers', ctx.slot.querySelector('#ipCust').value);
          ctx.slot.querySelector('#ipCustInfo').textContent = c ? 'المتبقي عليه: ' + U.money(Engine.customerBalance(DB.state, c.id).remaining) : 'البيع بالتقسيط يتطلب تسجيل الزبون';
        });
        paint();
      }
    });
  },
  hold(){
    if (!App.pos.items.length){ UI.toast('السلة فارغة', 'warn'); return; }
    App.pos.held = App.pos.held || [];
    App.pos.held.push({ at: U.now(), items: App.pos.items, customerId: App.pos.customerId, discount: App.pos.discount, note: App.pos.note });
    App.pos.items = []; App.pos.discount = 0;
    UI.toast('تم تعليق السلة', 'ok', 'يمكنك استئنافها من الزر 📌');
    App.render();
  }
};

/* ============================================================================
   جميع المبيعات / الفواتير
   ========================================================================== */
Views.sales = function(){
  const route = 'sales';
  const f = F.get(route);
  const cMap = DB.byId('customers');
  const uMap = DB.byId('users');
  let rows = DB.c('invoices').filter((v) => DB.inBranch(v));
  if (f.from) rows = rows.filter((v) => F.inRange(v.date, route));
  if (f.chip) rows = rows.filter((v) => f.chip === 'void' ? v.status === 'void' : f.chip === 'active' ? v.status !== 'void' : v.method === f.chip);
  rows = rows.filter((v) => !f.q.trim() || U.has(v.no, f.q) || U.has(v.verify, f.q) || U.has((cMap[v.customerId] || {}).name, f.q) || U.has((cMap[v.customerId] || {}).phone, f.q) || (v.items || []).some((i) => U.has(i.name, f.q)));
  rows.sort((a, b) => String(b.date + (b.time || '')).localeCompare(String(a.date + (a.time || ''))));
  const valid = rows.filter((v) => v.status !== 'void');
  const totals = {
    total: U.sum(valid, (v) => v.total), profit: U.sum(valid, (v) => Engine.invoiceProfit(v)),
    cash: U.sum(valid.filter((v) => v.method === 'cash'), (v) => v.total),
    inst: U.sum(valid.filter((v) => v.method === 'installment'), (v) => v.total)
  };
  const chips = [
    { id: '', label: 'الكل', count: DB.c('invoices').length },
    { id: 'cash', label: 'نقدي' }, { id: 'card', label: 'بطاقة' }, { id: 'installment', label: 'تقسيط' },
    { id: 'void', label: 'ملغاة' }
  ];
  const shown = F.slice(rows, route, 30);
  const body = UI.table({
    columns: [
      { title: 'الفاتورة', render: (v) => '<a href="#" data-act="invoice-view" data-id="' + v.id + '" class="mono b">' + U.esc(v.no) + '</a>' + (v.status === 'void' ? ' <span class="badge danger">ملغاة</span>' : '') },
      { title: 'التاريخ', render: (v) => V.dateCell(v.date) + '<div class="tiny dim">' + U.timeAr(v.date + ' ' + (v.time || '00:00')) + '</div>' },
      { title: 'الزبون', render: (v) => V.customerLink(v.customerId, (cMap[v.customerId] || {}).name || 'زبون نقدي') },
      { title: 'الأصناف', cls: 'num', render: (v) => U.num(U.sum(v.items, (i) => i.qty)) },
      { title: 'الدفع', render: (v) => '<span class="badge ' + (v.method === 'installment' ? 'warn' : v.method === 'cash' ? 'ok' : 'info') + '">' + App.payLabel(v.method) + '</span>' },
      { title: 'الإجمالي', cls: 'num', render: (v) => V.money(v.total) },
      ...(Auth.can('act.cost') ? [{ title: 'الربح', cls: 'num', render: (v) => '<span class="num" style="color:var(--ok)">' + U.money(Engine.invoiceProfit(v)) + '</span>' }] : []),
      { title: 'البائع', render: (v) => '<span class="tiny muted">' + U.esc((uMap[v.userId] || {}).name || '—') + '</span>' },
      { title: '', cls: 'acts', render: (v) => V.rowMenu([
        { act: 'invoice-view', id: v.id, icon: '👁️', title: 'عرض' },
        { act: 'invoice-print', id: v.id, icon: '🖨️', title: 'طباعة' },
        { act: 'invoice-dup', id: v.id, icon: '⧉', title: 'تكرار في السلة' },
        v.status !== 'void' ? { act: 'invoice-void', id: v.id, icon: '⛔', title: 'إلغاء', cls: 'btn xs ghost' } : null,
        { act: 'invoice-return', id: v.id, icon: '↩️', title: 'مرتجع' }
      ]) }
    ],
    rows: shown,
    empty: UI.empty('🧾', 'لا مبيعات في هذه الفترة', 'غيّر الفترة أو ابدأ عملية بيع جديدة.', '<button class="btn primary sm mt-8" data-act="go" data-route="pos">🛒 نقطة البيع</button>')
  });
  return UI.page({
    icon: '🧾', title: 'جميع المبيعات', sub: V.rangeLabel(f.from, f.to),
    actions: '<button class="btn sm" data-act="export-sales">📥 Excel</button>' +
      '<button class="btn sm" data-act="print-range" data-type="daily">🖨️ تقرير الفترة</button>' +
      '<button class="btn primary sm" data-act="go" data-route="pos">＋ بيع جديد</button>',
    body: '<div class="grid g-4 mb-16">' +
      V.kpi({ icon: '💰', label: 'إجمالي المبيعات', value: U.money(totals.total), raw: totals.total, color: 'var(--accent)' }) +
      V.kpi({ icon: '💵', label: 'مبيعات نقدية', value: U.money(totals.cash), raw: totals.cash, color: 'var(--ok)' }) +
      V.kpi({ icon: '💳', label: 'مبيعات تقسيط', value: U.money(totals.inst), raw: totals.inst, color: 'var(--warn)' }) +
      (Auth.can('act.cost') ? V.kpi({ icon: '📈', label: 'الربح الإجمالي', value: U.money(totals.profit), raw: totals.profit, color: 'var(--violet)' }) : V.kpi({ icon: '🧾', label: 'عدد الفواتير', value: U.num(valid.length), raw: valid.length, color: 'var(--info)' })) +
      '</div>' +
      F.bar(route, { placeholder: 'بحث برقم الفاتورة أو الزبون أو الصنف…', chips, extra: '<button class="btn sm" data-act="quick-range" data-route="sales" data-v="all">كل الفترات</button>' }) +
      '<div class="card pad-0">' + body + F.pager(rows.length, route, 30) + '</div>'
  });
};

Views.invoices = function(){
  const route = 'invoices';
  const f = F.get(route);
  const cMap = DB.byId('customers');
  let rows = DB.c('invoices').filter((v) => DB.inBranch(v) && v.status !== 'void');
  if (f.from) rows = rows.filter((v) => F.inRange(v.date, route));
  rows = rows.filter((v) => !f.q.trim() || U.has(v.no, f.q) || U.has(v.verify, f.q) || U.has((cMap[v.customerId] || {}).name, f.q));
  rows.sort((a, b) => String(b.no).localeCompare(String(a.no)));
  return UI.page({
    icon: '🧾', title: 'الفواتير', sub: 'أرشيف الفواتير مع الطباعة وإعادة الإصدار',
    body: F.bar(route, { placeholder: 'ابحث برقم الفاتورة أو رمز التحقق…' }) +
      '<div class="card pad-0">' + UI.table({
        columns: [
          { title: 'الرقم', render: (v) => '<span class="mono b">' + U.esc(v.no) + '</span>' },
          { title: 'رمز التحقق', render: (v) => '<span class="mono tiny">' + U.esc(v.verify || '') + '</span>' },
          { title: 'الزبون', render: (v) => U.esc((cMap[v.customerId] || {}).name || 'زبون نقدي') },
          { title: 'التاريخ', render: (v) => V.dateCell(v.date) },
          { title: 'الإجمالي', cls: 'num', render: (v) => V.money(v.total) },
          { title: '', cls: 'acts', render: (v) => V.rowMenu([
            { act: 'invoice-view', id: v.id, icon: '👁️', title: 'عرض' },
            { act: 'invoice-print', id: v.id, icon: '🖨️', title: 'طباعة' },
            { act: 'doc-preview', id: v.id, k: 'invoice', icon: '🔎', title: 'معاينة' }
          ]) }
        ], rows: F.slice(rows, route, 30), empty: UI.empty('🧾', 'لا فواتير')
      }) + F.pager(rows.length, route, 30) + '</div>'
  });
};

/* عرض فاتورة */
Views['invoice-view'] = function(params){
  const inv = DB.get('invoices', params && params.id);
  if (!inv) return UI.page({ title: 'فاتورة غير موجودة', body: UI.empty('🧾', 'الفاتورة غير موجودة') });
  const cust = DB.get('customers', inv.customerId);
  const plan = inv.planId ? DB.get('plans', inv.planId) : null;
  const cMap = DB.byId('customers');
  const rows = (inv.items || []).map((it, i) => {
    const t = Engine.lineTotals(it);
    return '<tr><td>' + (i + 1) + '</td><td><b>' + U.esc(it.name) + '</b><div class="tiny dim">' + U.esc(it.code || '') + (it.serial ? ' • سيريال ' + U.esc(it.serial) : '') + '</div></td>' +
      '<td class="num">' + U.num(t.qty) + '</td><td class="num">' + U.money(it.price) + '</td>' +
      '<td class="num">' + (t.discount ? U.money(t.discount) : '—') + '</td><td class="num b">' + U.money(t.net) + '</td></tr>';
  }).join('');
  return UI.page({
    icon: '🧾', title: 'الفاتورة ' + inv.no, sub: U.dateAr(inv.date, { wd: true }) + ' — ' + U.timeAr(inv.date + ' ' + (inv.time || '00:00')),
    actions: '<button class="btn sm" data-act="invoice-print" data-id="' + inv.id + '">🖨️ طباعة</button>' +
      '<button class="btn sm" data-act="doc-preview" data-id="' + inv.id + '" data-k="invoice">🔎 معاينة</button>' +
      (inv.method === 'installment' ? '<button class="btn sm" data-act="payment-new" data-customer="' + inv.customerId + '">💳 تسديد</button>' : '') +
      (inv.status !== 'void' ? '<button class="btn sm danger" data-act="invoice-void" data-id="' + inv.id + '">⛔ إلغاء</button>' : ''),
    body: '<div class="grid g-3" style="grid-template-columns:2fr 1fr">' +
      '<section class="card pad-0"><div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>الصنف</th><th class="num">الكمية</th><th class="num">السعر</th><th class="num">الخصم</th><th class="num">الإجمالي</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div style="padding:16px"><div class="tot-row"><span class="muted">المجموع</span><span class="num">' + U.money(inv.subtotal) + '</span></div>' +
      (inv.discount ? '<div class="tot-row"><span class="muted">الخصم</span><span class="num">-' + U.money(inv.discount) + '</span></div>' : '') +
      (inv.tax ? '<div class="tot-row"><span class="muted">الضريبة</span><span class="num">' + U.money(inv.tax) + '</span></div>' : '') +
      '<div class="tot-row grand"><span>الإجمالي</span><span class="num">' + U.money(inv.total) + '</span></div>' +
      '<div class="tot-row"><span class="muted">المدفوع</span><span class="num" style="color:var(--ok)">' + U.money(inv.paid) + '</span></div>' +
      (inv.method === 'installment' && plan ? '<div class="tot-row"><span class="muted">المتبقي</span><span class="num" style="color:var(--danger)">' + U.money(Engine.planSummary(plan).remaining) + '</span></div>' : '') +
      (Auth.can('act.cost') ? '<div class="tot-row"><span class="dim">الربح</span><span class="num" style="color:var(--violet)">' + U.money(Engine.invoiceProfit(inv)) + '</span></div>' : '') +
      '</div></section>' +
      '<div class="col gap-12">' +
        '<section class="card"><div class="card-h"><h3>👤 الزبون</h3></div>' +
        (cust ? '<div class="row gap-10"><div class="avatar lg">' + U.esc(U.initials(cust.name)) + '</div><div><div class="b">' + U.esc(cust.name) + '</div>' +
        '<div class="tiny dim">' + U.esc(cust.phone || '') + '</div>' +
        '<button class="btn xs soft mt-4" data-act="open-customer" data-id="' + cust.id + '">فتح الملف</button></div></div>' : '<div class="dim">زبون نقدي</div>') + '</section>' +
        (plan ? '<section class="card"><div class="card-h"><h3>💳 خطة التقسيط</h3><span class="sub">' + plan.items.length + ' قسط</span></div>' +
          '<div class="stat-line"><div class="sl-ic">💰</div><div><div class="sl-t">المتبقي</div></div><div class="sl-v">' + U.money(Engine.planSummary(plan).remaining) + '</div></div>' +
          '<div class="stat-line"><div class="sl-ic">🔴</div><div><div class="sl-t">المتأخر</div></div><div class="sl-v">' + U.money(Engine.planSummary(plan).overdue) + '</div></div>' +
          '<button class="btn block soft mt-8" data-act="go" data-route="installments">عرض الأقساط</button></section>' : '') +
        '<section class="card"><div class="card-h"><h3>ℹ️ تفاصيل</h3></div>' +
        '<div class="stat-line"><div class="sl-t">طريقة الدفع</div><div class="sl-v">' + App.payLabel(inv.method) + '</div></div>' +
        '<div class="stat-line"><div class="sl-t">الفرع</div><div class="sl-v">' + U.esc(DB.branchName(inv.branchId)) + '</div></div>' +
        '<div class="stat-line"><div class="sl-t">رمز التحقق</div><div class="sl-v mono">' + U.esc(inv.verify || '') + '</div></div>' +
        (inv.note ? '<div class="note-box mt-8">' + U.esc(inv.note) + '</div>' : '') + '</section>' +
      '</div></div>'
  });
};

/* ============================================================================
   عروض الأسعار
   ========================================================================== */
CRUD.def('quotes', {
  title: 'عروض الأسعار', one: 'عرض سعر', icon: '📄', coll: 'quotes', perm: 'quotes',
  addLabel: 'عرض جديد', wide: true, searchKeys: ['no', 'note'],
  defaults: () => ({ date: U.today(), validUntil: U.addDays(U.today(), 7), status: 'draft', items: [] }),
  fields: (rec) => [
    { key: 'no', label: 'رقم العرض', value: 'Q-' + String((DB.state.counters.quote || 0) + 1).padStart(4, '0') },
    { key: 'customerId', label: 'الزبون', type: 'select', placeholder: '— بدون —', options: DB.c('customers').map((c) => ({ value: c.id, label: c.name })) },
    { key: 'date', label: 'التاريخ', type: 'date', value: U.today() },
    { key: 'validUntil', label: 'صالح حتى', type: 'date', value: U.addDays(U.today(), 7) },
    { key: 'status', label: 'الحالة', type: 'select', value: 'draft', options: [{ value: 'draft', label: 'مسودة' }, { value: 'sent', label: 'مُرسل' }, { value: 'accepted', label: 'مقبول' }, { value: 'rejected', label: 'مرفوض' }] },
    { key: 'note', label: 'ملاحظات', type: 'textarea', full: true }
  ],
  formExtra: () => '<div class="divider"></div><h3 class="mb-8">الأصناف</h3><div id="itemsEditor"></div>',
  onOpen: (ctx) => ItemsEditor.paint(ctx, { discount: true }),
  columns: [
    { title: 'الرقم', render: (q) => '<span class="mono b">' + U.esc(q.no) + '</span>' },
    { title: 'الزبون', render: (q) => U.esc((DB.get('customers', q.customerId) || {}).name || '—') },
    { title: 'التاريخ', render: (q) => V.dateCell(q.date) },
    { title: 'صالح حتى', render: (q) => V.dateCell(q.validUntil) + (q.validUntil < U.today() ? ' <span class="badge danger">منتهي</span>' : '') },
    { title: 'الإجمالي', cls: 'num', render: (q) => V.money(U.sum(q.items || [], (i) => (i.qty || 0) * (i.price || 0))) },
    { title: 'الحالة', render: (q) => UI.statusBadge(q.status) },
    { title: '', cls: 'acts', render: (q) => V.rowMenu([
      { act: 'quote-convert', id: q.id, icon: '🛒', title: 'تحويل إلى فاتورة' },
      { act: 'quote-print', id: q.id, icon: '🖨️', title: 'طباعة' },
      { act: 'crud-edit', k: 'quotes', id: q.id, icon: '✏️', title: 'تعديل' },
      { act: 'crud-del', k: 'quotes', id: q.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ],
  afterSave: (rec) => { if (!rec.no || /^Q-\d+$/.test(rec.no)) DB.setNo('quote', Number(String(rec.no).split('-')[1]) || 0); }
});
Views.quotes = () => CRUD.page('quotes');

/* ============================================================================
   الحجوزات
   ========================================================================== */
CRUD.def('reservations', {
  title: 'الحجوزات', one: 'حجز', icon: '📌', coll: 'reservations', perm: 'reservations',
  addLabel: 'حجز جديد', searchKeys: ['customerName', 'productName', 'phone'],
  defaults: () => ({ date: U.today(), status: 'new', qty: 1 }),
  fields: () => [
    { key: 'no', label: 'رقم الحجز', value: 'R-' + String((DB.state.counters.reservation || 0) + 1).padStart(4, '0') },
    { key: 'customerName', label: 'اسم الزبون', required: true },
    { key: 'phone', label: 'الهاتف' },
    { key: 'productId', label: 'المنتج', type: 'select', placeholder: '— اختر —', options: DB.c('products').map((p) => ({ value: p.id, label: p.name + ' — ' + U.num(p.price) })) },
    { key: 'qty', label: 'الكمية', type: 'number', value: 1 },
    { key: 'deposit', label: 'العربون', type: 'money', value: 0 },
    { key: 'date', label: 'تاريخ الحجز', type: 'date', value: U.today() },
    { key: 'deliverAt', label: 'موعد التسليم', type: 'date' },
    { key: 'status', label: 'الحالة', type: 'select', value: 'new', options: [{ value: 'new', label: 'جديد' }, { value: 'confirmed', label: 'مؤكد' }, { value: 'done', label: 'تم البيع' }, { value: 'cancelled', label: 'ملغى' }] },
    { key: 'note', label: 'ملاحظات', type: 'textarea', full: true }
  ],
  columns: [
    { title: 'الرقم', render: (r) => '<span class="mono b">' + U.esc(r.no) + '</span>' },
    { title: 'الزبون', render: (r) => '<b>' + U.esc(r.customerName) + '</b><div class="tiny dim">' + U.esc(r.phone || '') + '</div>' },
    { title: 'المنتج', render: (r) => U.esc((DB.get('products', r.productId) || {}).name || '—') },
    { title: 'الكمية', cls: 'num', render: (r) => U.num(r.qty) },
    { title: 'العربون', cls: 'num', render: (r) => V.money(r.deposit) },
    { title: 'التسليم', render: (r) => r.deliverAt ? V.dateCell(r.deliverAt) : '<span class="dim">—</span>' },
    { title: 'الحالة', render: (r) => UI.statusBadge(r.status) },
    { title: '', cls: 'acts', render: (r) => V.rowMenu([
      { act: 'res-sell', id: r.id, icon: '🛒', title: 'تحويل إلى بيع' },
      { act: 'crud-edit', k: 'reservations', id: r.id, icon: '✏️', title: 'تعديل' },
      { act: 'crud-del', k: 'reservations', id: r.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ]
});
Views.reservations = () => CRUD.page('reservations');

/* ============================================================================
   المرتجعات
   ========================================================================== */
Views.returns = function(){
  const route = 'returns';
  const f = F.get(route);
  const cMap = DB.byId('customers');
  let rows = DB.c('returns').filter((r) => DB.inBranch(r));
  if (f.from) rows = rows.filter((r) => F.inRange(r.date, route));
  rows = rows.filter((r) => !f.q.trim() || U.has(r.no, f.q) || U.has((cMap[r.customerId] || {}).name, f.q));
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return UI.page({
    icon: '🔄', title: 'المرتجعات', sub: U.num(rows.length) + ' عملية إرجاع',
    actions: '<button class="btn primary sm" data-act="return-new">＋ مرتجع جديد</button>',
    body: F.bar(route, { placeholder: 'بحث…' }) + '<div class="card pad-0">' + UI.table({
      columns: [
        { title: 'الرقم', render: (r) => '<span class="mono b">' + U.esc(r.no) + '</span>' },
        { title: 'التاريخ', render: (r) => V.dateCell(r.date) },
        { title: 'الزبون', render: (r) => V.customerLink(r.customerId, (cMap[r.customerId] || {}).name) },
        { title: 'الفاتورة', render: (r) => '<span class="mono tiny">' + U.esc((DB.get('invoices', r.invoiceId) || {}).no || '—') + '</span>' },
        { title: 'الأصناف', cls: 'num', render: (r) => U.num(U.sum(r.items || [], (i) => i.qty)) },
        { title: 'المبلغ', cls: 'num', render: (r) => V.money(r.amount) },
        { title: 'السبب', render: (r) => '<span class="tiny muted">' + U.esc(r.reason || '—') + '</span>' },
        { title: '', cls: 'acts', render: (r) => V.rowMenu([{ act: 'crud-del', k: 'returns', id: r.id, icon: '🗑️', title: 'حذف' }]) }
      ], rows: F.slice(rows, route), empty: UI.empty('🔄', 'لا مرتجعات', 'لم تُسجَّل أي عملية إرجاع في هذه الفترة.')
    }) + F.pager(rows.length, route) + '</div>'
  });
};

const Returns = {
  open(invoiceId){
    const inv = DB.get('invoices', invoiceId);
    if (!inv) { UI.toast('الفاتورة غير موجودة', 'err'); return; }
    if (inv.status === 'void'){ UI.toast('الفاتورة ملغاة', 'err'); return; }
    UI.modal({
      title: '↩️ إرجاع من الفاتورة ' + inv.no, icon: '🔄', wide: true,
      data: { items: (inv.items || []).map((i) => ({ ...i, qty: 0 })), invoiceId: inv.id },
      body: '<div class="hint-box warn mb-12">اختر الكميات المرتجعة. سيتم إرجاع الكمية إلى المخزون وخصم المبلغ من حساب الزبون.</div>' +
        '<div id="itemsEditor"></div>' +
        '<div class="form-grid mt-12"><div class="field full"><label>سبب الإرجاع</label><input class="input" id="retReason" placeholder="مثال: عطل مصنعي"></div></div>',
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 اعتماد المرتجع', cls: 'primary', handler: (ctx) => {
          const items = ctx.data.items.filter((i) => Number(i.qty) > 0);
          if (!items.length){ UI.toast('اختر كمية واحدة على الأقل', 'warn'); return; }
          const amount = U.sum(items, (i) => (Number(i.qty) || 0) * (Number(i.price) || 0) - (Number(i.discount) || 0));
          const rec = DB.add('returns', {
            no: DB.docNo('RET', 'return'), date: U.today(), invoiceId: inv.id, customerId: inv.customerId,
            items, amount, reason: ctx.slot.querySelector('#retReason').value, userId: (Auth.user() || {}).id
          });
          items.forEach((i) => {
            const p = DB.get('products', i.productId);
            if (p){ p.qty = Number(p.qty || 0) + Number(i.qty); DB.c('stockMoves').unshift({ id: U.id('mv'), at: U.now(), productId: p.id, type: 'return', qty: Number(i.qty), ref: rec.no, note: 'مرتجع' }); }
          });
          if (inv.customerId){
            DB.add('payments', { no: DB.docNo('PAY', 'payment'), date: U.today(), customerId: inv.customerId, amount: -amount, method: 'cash', note: 'مرتجع ' + rec.no, invoiceId: inv.id, allocations: [], userId: (Auth.user() || {}).id });
          }
          DB.log('مرتجع', rec.no, U.money(amount), 'warn');
          UI.closeModal(); UI.toast('تم تسجيل المرتجع', 'ok', rec.no);
          App.render();
        } }
      ],
      onOpen: (ctx) => { ctx.data.opt = {}; ItemsEditor.paint(ctx, {}); }
    });
  }
};

/* ============================================================================
   الأقساط
   ========================================================================== */
Views.installments = function(){
  const route = 'installments';
  const f = F.get(route);
  const cMap = DB.byId('customers');
  let rows = DB.c('plans').filter((p) => p.status !== 'void' && DB.inBranch(p)).map((p) => ({ plan: p, s: Engine.planSummary(p) }));
  const counts = {
    all: rows.length,
    overdue: rows.filter((r) => r.s.overdueCount > 0).length,
    today: rows.filter((r) => r.s.dueToday > 0).length,
    active: rows.filter((r) => r.plan.status === 'active' && r.s.remaining > 0).length,
    closed: rows.filter((r) => r.s.remaining <= 0).length,
    suspended: rows.filter((r) => r.plan.status === 'suspended').length
  };
  if (f.chip === 'overdue') rows = rows.filter((r) => r.s.overdueCount > 0);
  else if (f.chip === 'today') rows = rows.filter((r) => r.s.dueToday > 0);
  else if (f.chip === 'active') rows = rows.filter((r) => r.plan.status === 'active' && r.s.remaining > 0);
  else if (f.chip === 'closed') rows = rows.filter((r) => r.s.remaining <= 0);
  else if (f.chip === 'suspended') rows = rows.filter((r) => r.plan.status === 'suspended');
  rows = rows.filter((r) => !f.q.trim() || U.has((cMap[r.plan.customerId] || {}).name, f.q) || U.has((cMap[r.plan.customerId] || {}).phone, f.q) || U.has(r.plan.no, f.q));
  const sortMode = f.sort || 'debt';
  const cmp = {
    debt: (a, b) => (b.s.overdue - a.s.overdue) || (b.s.overdueCount - a.s.overdueCount) || (b.s.remaining - a.s.remaining) || String((a.s.next || {}).due || '9').localeCompare(String((b.s.next || {}).due || '9')),
    remaining: (a, b) => b.s.remaining - a.s.remaining,
    due: (a, b) => String((a.s.next || {}).due || '9').localeCompare(String((b.s.next || {}).due || '9')),
    recent: (a, b) => String(b.plan.createdAt || '').localeCompare(String(a.plan.createdAt || '')),
    name: (a, b) => String((cMap[a.plan.customerId] || {}).name || '').localeCompare(String((cMap[b.plan.customerId] || {}).name || ''), 'ar')
  }[sortMode] || undefined;
  if (cmp) rows.sort(cmp);
  const totals = {
    debt: U.sum(rows, (r) => r.s.remaining), overdue: U.sum(rows, (r) => r.s.overdue), dueToday: U.sum(rows, (r) => r.s.dueTodayAmt)
  };
  const chips = [
    { id: '', label: 'الكل', count: counts.all }, { id: 'overdue', label: '🔴 متأخرة', count: counts.overdue },
    { id: 'today', label: '🟠 اليوم', count: counts.today }, { id: 'active', label: 'نشطة', count: counts.active },
    { id: 'suspended', label: 'موقوفة', count: counts.suspended }, { id: 'closed', label: 'مسددة', count: counts.closed }
  ];
  const shown = F.slice(rows, route, 25);
  const body = UI.table({
    columns: [
      { title: 'الزبون', render: (r) => {
        const c = cMap[r.plan.customerId] || {};
        return '<div class="row gap-8">' + (sortMode === 'debt' && r.s.overdue > 0 ? '<span class="badge danger">⭐ الأقوى ديناً</span>' : '') +
          '<div><a href="#" data-act="open-customer" data-id="' + r.plan.customerId + '" class="b">' + U.esc(c.name || '—') + '</a>' +
          '<div class="tiny dim">' + U.esc(c.phone || '') + '</div></div></div>';
      } },
      { title: 'العقد', render: (r) => '<span class="mono tiny">' + U.esc(r.plan.no || '') + '</span><div class="tiny dim">' + r.plan.items.length + ' قسط</div>' },
      { title: 'الإجمالي', cls: 'num', render: (r) => V.money(r.s.total) },
      { title: 'المدفوع', cls: 'num', render: (r) => '<span class="num" style="color:var(--ok)">' + U.money(r.s.paidAll) + '</span>' },
      { title: 'المتبقي', cls: 'num', render: (r) => '<span class="num b" style="color:var(--danger)">' + U.money(r.s.remaining) + '</span>' },
      { title: 'التقدّم', render: (r) => UI.progress(r.s.progress, r.s.progress >= 100 ? 'ok' : r.s.overdue ? 'danger' : '') + '<div class="tiny dim">' + U.pct(r.s.progress, 0) + '</div>' },
      { title: 'المتأخر', cls: 'num', render: (r) => r.s.overdue ? '<span class="badge danger">' + U.money(r.s.overdue) + '</span>' : '<span class="dim">—</span>' },
      { title: 'أقرب استحقاق', render: (r) => r.s.next ? V.dateCell(r.s.next.due) + '<div class="tiny dim">' + U.rel(r.s.next.due) + '</div>' : '<span class="dim">—</span>' },
      { title: 'الحالة', render: (r) => r.plan.status === 'suspended' ? UI.statusBadge('suspended') : r.s.remaining <= 0 ? UI.statusBadge('closed') : r.s.overdue ? UI.statusBadge('overdue') : UI.statusBadge('active') },
      { title: '', cls: 'acts', render: (r) => V.rowMenu([
        { act: 'payment-new', id: r.plan.customerId, k: r.plan.id, icon: '💳', title: 'استلام دفعة' },
        { act: 'plan-view', id: r.plan.id, icon: '👁️', title: 'عرض الخطة' },
        { act: 'plan-print', id: r.plan.id, icon: '🖨️', title: 'طباعة العقد' },
        { act: 'plan-toggle', id: r.plan.id, icon: r.plan.status === 'suspended' ? '▶️' : '⏸️', title: r.plan.status === 'suspended' ? 'استئناف' : 'إيقاف' }
      ]) }
    ],
    rows: shown,
    empty: UI.empty('💳', 'لا توجد خطط تقسيط', 'عند البيع بالتقسيط ستظهر العقود هنا مع جدول الاستحقاق.')
  });
  return UI.page({
    icon: '💳', title: 'الأقساط والديون', sub: 'إجمالي الديون ' + U.money(totals.debt),
    actions: '<button class="btn sm" data-act="export-installments">📥 Excel</button>' +
      '<button class="btn sm" data-act="print-installments">🖨️ كشف</button>' +
      '<button class="btn primary sm" data-act="payment-new">＋ تسديد</button>',
    body: '<div class="grid g-4 mb-16">' +
      V.kpi({ icon: '💳', label: 'إجمالي الديون', value: U.money(totals.debt), raw: totals.debt, color: 'var(--accent)' }) +
      V.kpi({ icon: '🔴', label: 'المتأخر', value: U.money(totals.overdue), raw: totals.overdue, color: 'var(--danger)', route: 'installments', foot: '<span>' + counts.overdue + ' خطة متأخرة</span>' }) +
      V.kpi({ icon: '🟠', label: 'مستحق اليوم', value: U.money(totals.dueToday), raw: totals.dueToday, color: 'var(--warn)' }) +
      V.kpi({ icon: '📄', label: 'العقود النشطة', value: U.num(counts.active), raw: counts.active, color: 'var(--info)' }) +
      '</div>' +
      F.bar(route, { placeholder: 'بحث بالاسم أو الهاتف أو رقم العقد…', chips, dateRange: false, extra:
        '<select class="select" style="max-width:170px" data-act="sort-installments">' +
        [['debt', 'الأقوى ديناً'], ['remaining', 'الأعلى متبقياً'], ['due', 'الأقرب استحقاقاً'], ['recent', 'الأحدث'], ['name', 'الاسم']]
          .map((o) => '<option value="' + o[0] + '" ' + (f.sort === o[0] || (!f.sort && o[0] === 'debt') ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' }) +
      '<div class="card pad-0">' + body + F.pager(rows.length, route, 25) + '</div>'
  });
};

/* تفاصيل خطة */
Views['plan-view'] = function(params){
  const plan = DB.get('plans', params && params.id);
  if (!plan) return UI.page({ title: 'خطة غير موجودة', body: UI.empty('💳', 'الخطة غير موجودة') });
  const cust = DB.get('customers', plan.customerId) || {};
  const inv = DB.get('invoices', plan.invoiceId);
  const s = Engine.planSummary(plan);
  return UI.page({
    icon: '💳', title: 'عقد التقسيط ' + (plan.no || ''), sub: U.esc(cust.name || '') + ' — ' + U.esc(cust.phone || ''),
    actions: '<button class="btn sm" data-act="plan-print" data-id="' + plan.id + '">🖨️ طباعة العقد</button>' +
      '<button class="btn primary sm" data-act="payment-new" data-customer="' + plan.customerId + '" data-plan="' + plan.id + '">💳 استلام دفعة</button>',
    body: '<div class="grid g-4 mb-16">' +
      V.kpi({ icon: '💰', label: 'قيمة العقد', value: U.money(s.total), raw: s.total, color: 'var(--accent)' }) +
      V.kpi({ icon: '✅', label: 'المدفوع', value: U.money(s.paidAll), raw: s.paidAll, color: 'var(--ok)', bar: s.progress }) +
      V.kpi({ icon: '⏳', label: 'المتبقي', value: U.money(s.remaining), raw: s.remaining, color: 'var(--danger)' }) +
      V.kpi({ icon: '🔴', label: 'المتأخر', value: U.money(s.overdue), raw: s.overdue, color: 'var(--warn)', foot: '<span>' + s.overdueCount + ' قسط</span>' }) +
      '</div>' +
      '<div class="card pad-0">' + UI.table({
        columns: [
          { title: 'القسط', render: (i) => '<b>' + i.no + '</b>' },
          { title: 'الاستحقاق', render: (i) => V.dateCell(i.due) + ' <span class="tiny dim">' + U.rel(i.due) + '</span>' },
          { title: 'المبلغ', cls: 'num', render: (i) => V.money(i.amount) },
          { title: 'المدفوع', cls: 'num', render: (i) => i.paid ? '<span style="color:var(--ok)">' + U.money(i.paid) + '</span>' : '<span class="dim">—</span>' },
          { title: 'المتبقي', cls: 'num', render: (i) => V.money(Math.max(0, i.amount - (i.paid || 0))) },
          { title: 'تاريخ الدفع', render: (i) => i.paidAt ? V.dateCell(i.paidAt) : '<span class="dim">—</span>' },
          { title: 'الحالة', render: (i) => UI.statusBadge(Engine.installmentStatus(i, U.today())) }
        ],
        rows: plan.items,
        footer: ['الإجمالي', '', U.money(U.sum(plan.items, (i) => i.amount)), U.money(U.sum(plan.items, (i) => i.paid || 0)), U.money(s.financed - U.sum(plan.items, (i) => i.paid || 0)), '', '']
      }) + '</div>'
  });
};

/* ============================================================================
   التسديدات
   ========================================================================== */
Views.payments = function(){
  const route = 'payments';
  const f = F.get(route);
  const cMap = DB.byId('customers');
  let rows = DB.c('payments').filter((p) => DB.inBranch(p));
  if (f.from) rows = rows.filter((p) => F.inRange(p.date, route));
  rows = rows.filter((p) => !f.q.trim() || U.has(p.no, f.q) || U.has((cMap[p.customerId] || {}).name, f.q) || U.has(p.note, f.q));
  rows.sort((a, b) => String(b.date + (b.time || '')).localeCompare(String(a.date + (a.time || ''))));
  const total = U.sum(rows.filter((p) => Number(p.amount) > 0), (p) => p.amount);
  return UI.page({
    icon: '💰', title: 'التسديدات', sub: 'مجموع الفترة ' + U.money(total),
    actions: '<button class="btn sm" data-act="export-payments">📥 Excel</button>' +
      '<button class="btn primary sm" data-act="payment-new">＋ تسجيل تسديد</button>',
    body: '<div class="grid g-3 mb-16">' +
      V.kpi({ icon: '💰', label: 'إجمالي المقبوض', value: U.money(total), raw: total, color: 'var(--ok)' }) +
      V.kpi({ icon: '💵', label: 'نقداً', value: U.money(U.sum(rows.filter((p) => p.method === 'cash'), (p) => p.amount)), color: 'var(--accent)' }) +
      V.kpi({ icon: '🧾', label: 'عدد الوصولات', value: U.num(rows.length), raw: rows.length, color: 'var(--info)' }) +
      '</div>' +
      F.bar(route, { placeholder: 'بحث برقم الوصل أو الزبون…' }) +
      '<div class="card pad-0">' + UI.table({
        columns: [
          { title: 'الوصل', render: (p) => '<span class="mono b">' + U.esc(p.no) + '</span>' },
          { title: 'التاريخ', render: (p) => V.dateCell(p.date) + '<div class="tiny dim">' + U.timeAr(p.date + ' ' + (p.time || '00:00')) + '</div>' },
          { title: 'الزبون', render: (p) => V.customerLink(p.customerId, (cMap[p.customerId] || {}).name) },
          { title: 'المبلغ', cls: 'num', render: (p) => '<span class="num b" style="color:' + (Number(p.amount) < 0 ? 'var(--danger)' : 'var(--ok)') + '">' + U.money(p.amount) + '</span>' },
          { title: 'الطريقة', render: (p) => '<span class="badge info">' + App.payLabel(p.method) + '</span>' },
          { title: 'التوزيع', render: (p) => (p.allocations || []).length ? '<span class="tiny muted">' + (p.allocations || []).map((a) => 'ق' + a.installNo).join('، ') + '</span>' : '<span class="dim">—</span>' },
          { title: '', cls: 'acts', render: (p) => V.rowMenu([
            { act: 'payment-print', id: p.id, icon: '🖨️', title: 'طباعة الوصل' },
            { act: 'payment-undo', id: p.id, icon: '↩️', title: 'تراجع' }
          ]) }
        ], rows: F.slice(rows, route), empty: UI.empty('💰', 'لا تسديدات', 'سجّل أول دفعة تستلمها من زبون.')
      }) + F.pager(rows.length, route) + '</div>'
  });
};

const Payments = {
  open(customerId, planId){
    const customers = DB.c('customers').sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    if (!customers.length){ UI.toast('لا يوجد زبائن', 'warn', 'أضف زبوناً أولاً أو سجّل بيعاً نقدياً'); return; }
    UI.modal({
      title: '💳 تسجيل تسديد', icon: '💳',
      data: { },
      body: '<div class="form-grid">' +
        '<div class="field full"><label>الزبون <span class="req">*</span></label>' +
        '<select class="select" id="payCust"><option value="">— اختر —</option>' +
        customers.map((c) => '<option value="' + c.id + '" ' + (customerId === c.id ? 'selected' : '') + '>' + U.esc(c.name) + (c.phone ? ' — ' + U.esc(c.phone) : '') + '</option>').join('') +
        '</select><span class="hint" id="payInfo">اختر زبوناً لعرض رصيده</span></div>' +
        '<div class="field"><label>المبلغ <span class="req">*</span></label><input class="input" id="payAmt" type="number" step="250" inputmode="numeric" value=""></div>' +
        '<div class="field"><label>طريقة الدفع</label><select class="select" id="payMethod">' +
        [['cash', 'نقداً'], ['card', 'بطاقة'], ['transfer', 'حوالة']].map((m) => '<option value="' + m[0] + '">' + m[1] + '</option>').join('') + '</select></div>' +
        '<div class="field full"><label>ملاحظة</label><input class="input" id="payNote"></div>' +
        '</div><div class="divider"></div><div id="payPlans"></div>',
      actions: [
        { label: 'إلغاء', cls: 'ghost', handler: () => UI.closeModal() },
        { label: '💾 حفظ وطباعة الوصل', cls: 'primary', handler: (ctx) => {
          const cid = ctx.slot.querySelector('#payCust').value;
          const amt = Number(ctx.slot.querySelector('#payAmt').value) || 0;
          if (!cid){ UI.toast('اختر الزبون', 'err'); return; }
          if (amt <= 0){ UI.toast('أدخل مبلغاً صحيحاً', 'err'); return; }
          const res = Sales.recordPayment({ customerId: cid, amount: amt, method: ctx.slot.querySelector('#payMethod').value, note: ctx.slot.querySelector('#payNote').value });
          if (!res.ok){ UI.toast('تعذّر الحفظ', 'err', res.msg); return; }
          UI.closeModal();
          UI.toast('تم تسجيل التسديد', 'ok', res.payment.no + ' — ' + U.money(amt));
          App.render();
          Print.run(Print.doc('receipt', { payment: res.payment }), { size: S().invoice.size });
        } }
      ],
      onOpen: (ctx) => {
        const paint = () => {
          const cid = ctx.slot.querySelector('#payCust').value;
          const box = ctx.slot.querySelector('#payPlans');
          if (!cid){ box.innerHTML = ''; ctx.slot.querySelector('#payInfo').textContent = 'اختر زبوناً لعرض رصيده'; return; }
          const bal = Engine.customerBalance(DB.state, cid);
          ctx.slot.querySelector('#payInfo').innerHTML = 'إجمالي المشتريات <b>' + U.money(bal.purchased) + '</b> • المتبقي <b style="color:var(--danger)">' + U.money(bal.remaining) + '</b>' + (bal.overdue ? ' • متأخر <b style="color:var(--warn)">' + U.money(bal.overdue) + '</b>' : '');
          const plans = DB.c('plans').filter((p) => p.customerId === cid && p.status !== 'void' && p.status !== 'closed');
          const due = [];
          plans.forEach((p) => Engine.planSummary(p).next && due.push({ plan: p, item: Engine.planSummary(p).next }));
          due.sort((a, b) => String(a.item.due).localeCompare(String(b.item.due)));
          box.innerHTML = due.length ? '<h3 class="mb-8">أقرب الاستحقاقات</h3>' + UI.table({
            compact: true,
            columns: [
              { title: 'العقد', render: (d) => '<span class="mono tiny">' + U.esc(d.plan.no) + '</span>' },
              { title: 'القسط', render: (d) => 'رقم ' + d.item.no },
              { title: 'الاستحقاق', render: (d) => V.dateCell(d.item.due) },
              { title: 'المبلغ', cls: 'num', render: (d) => V.money(Math.max(0, d.item.amount - (d.item.paid || 0))) },
              { title: 'الحالة', render: (d) => UI.statusBadge(Engine.installmentStatus(d.item, U.today())) }
            ],
            rows: due.slice(0, 6)
          }) : '<div class="hint-box ok">✅ لا توجد أقساط مفتوحة على هذا الزبون</div>';
          if (due.length && !ctx.slot.querySelector('#payAmt').value){
            ctx.slot.querySelector('#payAmt').value = Math.max(0, due[0].item.amount - (due[0].item.paid || 0));
          }
        };
        UI.on(ctx.slot.querySelector('#payCust'), 'change', paint);
        paint();
      }
    });
  }
};

/* ============================================================================
   كشوف الحساب
   ========================================================================== */
Views.statements = function(){
  const route = 'statements';
  const f = F.get(route);
  const cMap = DB.byId('customers');
  const list = DB.c('customers').map((c) => ({ c, b: Engine.customerBalance(DB.state, c.id) }))
    .filter((x) => !f.q.trim() || U.has(x.c.name, f.q) || U.has(x.c.phone, f.q))
    .filter((x) => f.chip === 'debt' ? x.b.remaining > 0 : f.chip === 'overdue' ? x.b.overdue > 0 : f.chip === 'clear' ? x.b.remaining <= 0 : true)
    .sort((a, b) => b.b.remaining - a.b.remaining);
  const shown = F.slice(list, route);
  return UI.page({
    icon: '📑', title: 'كشوف الحساب', sub: 'أرصدة الزبائن مع كشف مفصّل قابل للطباعة',
    actions: '<button class="btn sm" data-act="export-statements">📥 Excel</button>',
    body: F.bar(route, {
      placeholder: 'بحث بالاسم أو الهاتف…', dateRange: false,
      chips: [{ id: '', label: 'الكل' }, { id: 'debt', label: 'عليهم ديون' }, { id: 'overdue', label: '🔴 متأخرون' }, { id: 'clear', label: 'مسدّدون' }]
    }) + '<div class="card pad-0">' + UI.table({
      columns: [
        { title: 'الزبون', render: (x) => '<a href="#" data-act="open-customer" data-id="' + x.c.id + '" class="b">' + U.esc(x.c.name) + '</a><div class="tiny dim">' + U.esc(x.c.phone || '') + '</div>' },
        { title: 'الفواتير', cls: 'num', render: (x) => U.num(x.b.invoices) },
        { title: 'المشتريات', cls: 'num', render: (x) => V.money(x.b.purchased) },
        { title: 'المدفوع', cls: 'num', render: (x) => '<span style="color:var(--ok)">' + U.money(x.b.paid) + '</span>' },
        { title: 'المتبقي', cls: 'num', render: (x) => '<span class="b" style="color:' + (x.b.remaining > 0 ? 'var(--danger)' : 'var(--ok)') + '">' + U.money(x.b.remaining) + '</span>' },
        { title: 'المتأخر', cls: 'num', render: (x) => x.b.overdue ? '<span class="badge danger">' + U.money(x.b.overdue) + '</span>' : '<span class="dim">—</span>' },
        { title: '', cls: 'acts', render: (x) => V.rowMenu([
          { act: 'statement-print', id: x.c.id, icon: '🖨️', title: 'طباعة الكشف' },
          { act: 'payment-new', id: x.c.id, icon: '💳', title: 'تسديد' }
        ]) }
      ], rows: shown, empty: UI.empty('📑', 'لا زبائن', 'أضف زبائن لعرض كشوف الحساب.')
    }) + F.pager(list.length, route) + '</div>'
  });
};

/* ============================================================================
   الزبائن
   ========================================================================== */
CRUD.def('customers', {
  title: 'الزبائن', one: 'زبون', icon: '👤', coll: 'customers', perm: 'customers',
  addLabel: 'زبون جديد', searchPlaceholder: 'بحث بالاسم أو الهاتف…', searchKeys: ['name', 'phone', 'code', 'address'],
  filterBranch: false,
  defaults: () => ({ tier: 'normal', code: 'C-' + String((DB.state.counters.customer || 0) + 1).padStart(4, '0'), createdAt: U.now() }),
  fields: (rec) => [
    { key: 'name', label: 'الاسم الكامل', required: true },
    { key: 'phone', label: 'الهاتف', placeholder: '07XXXXXXXXX' },
    { key: 'code', label: 'رقم الزبون', value: 'C-' + String((DB.state.counters.customer || 0) + 1).padStart(4, '0') },
    { key: 'phone2', label: 'هاتف آخر' },
    { key: 'tier', label: 'التصنيف', type: 'select', value: 'normal', options: [{ value: 'vip', label: '⭐ VIP' }, { value: 'normal', label: 'عادي' }, { value: 'new', label: 'جديد' }] },
    { key: 'nationalId', label: 'رقم الهوية' },
    { key: 'guarantor', label: 'الكفيل' },
    { key: 'creditLimit', label: 'سقف الدين', type: 'money', value: 0, hint: '0 = بدون سقف' },
    { key: 'address', label: 'العنوان', full: true },
    { key: 'notes', label: 'ملاحظات', type: 'textarea', full: true }
  ],
  chips: [{ id: '', label: 'الكل' }, { id: 'vip', label: '⭐ VIP' }, { id: 'debt', label: 'عليهم ديون' }],
  chipFilter: (c, chip) => {
    if (chip === 'vip') return c.tier === 'vip';
    if (chip === 'debt') return Engine.customerBalance(DB.state, c.id).remaining > 0;
    return true;
  },
  sort: (a, b) => String(a.name).localeCompare(String(b.name), 'ar'),
  columns: [
    { title: 'الزبون', render: (c) => '<div class="row gap-8">' + V.productThumb({ icon: c.image ? '' : '👤', image: c.image }) +
      '<div><a href="#" data-act="open-customer" data-id="' + c.id + '" class="b">' + U.esc(c.name) + '</a>' +
      '<div class="tiny dim">' + U.esc(c.code || '') + '</div></div></div>' },
    { title: 'الهاتف', render: (c) => '<span class="mono">' + U.esc(c.phone || '—') + '</span>' },
    { title: 'التصنيف', render: (c) => c.tier === 'vip' ? '<span class="badge violet">⭐ VIP</span>' : c.tier === 'new' ? '<span class="badge info">جديد</span>' : '<span class="badge">عادي</span>' },
    { title: 'المشتريات', cls: 'num', render: (c) => V.money(Engine.customerBalance(DB.state, c.id).purchased) },
    { title: 'المتبقي', cls: 'num', render: (c) => {
      const b = Engine.customerBalance(DB.state, c.id);
      return b.remaining > 0 ? '<span class="b" style="color:var(--danger)">' + U.money(b.remaining) + '</span>' : '<span class="badge ok">مسدّد</span>';
    } },
    { title: 'آخر شراء', render: (c) => {
      const invs = DB.c('invoices').filter((v) => v.customerId === c.id && v.status !== 'void').sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return invs.length ? V.dateCell(invs[0].date) : '<span class="dim">—</span>';
    } },
    { title: '', cls: 'acts', render: (c) => V.rowMenu([
      { act: 'open-customer', id: c.id, icon: '👁️', title: 'الملف' },
      { act: 'payment-new', id: c.id, icon: '💳', title: 'تسديد' },
      { act: 'statement-print', id: c.id, icon: '🖨️', title: 'كشف حساب' },
      { act: 'crud-edit', k: 'customers', id: c.id, icon: '✏️', title: 'تعديل' },
      { act: 'crud-del', k: 'customers', id: c.id, icon: '🗑️', title: 'حذف' }
    ]) }
  ],
  emptyIcon: '👥', emptyTitle: 'لا يوجد زبائن بعد', emptyText: 'أضف أول زبون أو استورد قائمة من ملف Excel.',
  emptyAction: '<button class="btn primary sm mt-8" data-act="crud-new" data-k="customers">＋ زبون جديد</button>',
  exportSheet: true
});
Views.customers = () => CRUD.page('customers');

/* أفضل الزبائن */
Views['top-customers'] = function(){
  const from = U.addDays(U.today(), -89);
  const list = Engine.topCustomers(DB.state, from, U.today(), 20);
  const agg = Engine.customerAggregates(DB.state);
  return UI.page({
    icon: '⭐', title: 'أفضل الزبائن', sub: 'آخر 90 يوماً',
    body: '<div class="card pad-0">' + UI.table({
      columns: [
        { title: '#', render: (c, i) => '<b>' + (i + 1) + '</b>' },
        { title: 'الزبون', render: (c) => '<a href="#" data-act="open-customer" data-id="' + c.id + '" class="b">' + U.esc(c.name) + '</a>' + (c.phone ? '<div class="tiny dim">' + U.esc(c.phone) + '</div>' : '') },
        { title: 'الفواتير', cls: 'num', render: (c) => U.num(c.count) },
        { title: 'المشتريات', cls: 'num', render: (c) => V.money(c.sales) },
        ...(Auth.can('act.cost') ? [{ title: 'الربح', cls: 'num', render: (c) => '<span style="color:var(--ok)">' + U.money(c.profit) + '</span>' }] : []),
        { title: 'المتبقي', cls: 'num', render: (c) => V.money((agg[c.id] || {}).remaining || 0) },
        { title: '', cls: 'acts', render: (c) => V.rowMenu([{ act: 'open-customer', id: c.id, icon: '👁️', title: 'الملف' }]) }
      ], rows: list, empty: UI.empty('⭐', 'لا مبيعات بعد')
    }) + '</div>'
  });
};

/* ملف الزبون */
Views['customer-profile'] = function(params){
  const id = params && params.id;
  const c = DB.get('customers', id);
  if (!c) return UI.page({ title: 'زبون غير موجود', body: UI.empty('👤', 'الزبون غير موجود') });
  const tab = (params && params.tab) || 'info';
  const bal = Engine.customerBalance(DB.state, id);
  const invs = DB.c('invoices').filter((v) => v.customerId === id && v.status !== 'void').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const plans = DB.c('plans').filter((p) => p.customerId === id && p.status !== 'void');
  const pays = DB.c('payments').filter((p) => p.customerId === id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const wars = DB.c('warranties').filter((w) => w.customerId === id);
  const maints = DB.c('maintenance').filter((m) => m.customerId === id);
  const dels = DB.c('deliveries').filter((d) => d.customerId === id);
  const stmt = Engine.customerStatement(DB.state, id);
  const pMap = DB.byId('products');

  const tabs = [
    { id: 'info', t: 'المعلومات', n: 0 }, { id: 'purchases', t: 'المشتريات', n: invs.length },
    { id: 'installments', t: 'الأقساط', n: plans.length }, { id: 'payments', t: 'التسديدات', n: pays.length },
    { id: 'warranty', t: 'الضمان', n: wars.length }, { id: 'maintenance', t: 'الصيانة', n: maints.length },
    { id: 'delivery', t: 'التوصيل', n: dels.length }, { id: 'statement', t: 'كشف الحساب', n: stmt.rows.length }
  ];
  const tabsHtml = '<div class="tabs">' + tabs.map((t) =>
    '<button class="tab ' + (tab === t.id ? 'on' : '') + '" data-act="cust-tab" data-id="' + id + '" data-tab="' + t.id + '">' +
    U.esc(t.t) + (t.n ? '<span class="n">' + t.n + '</span>' : '') + '</button>').join('') + '</div>';

  let panel = '';
  if (tab === 'info'){
    panel = '<div class="grid g-2">' + UI.card('معلومات الاتصال', '<div class="stat-line"><div class="sl-t">الهاتف</div><div class="sl-v mono">' + U.esc(c.phone || '—') + '</div></div>' +
      '<div class="stat-line"><div class="sl-t">هاتف آخر</div><div class="sl-v mono">' + U.esc(c.phone2 || '—') + '</div></div>' +
      '<div class="stat-line"><div class="sl-t">العنوان</div><div class="sl-v">' + U.esc(c.address || '—') + '</div></div>' +
      '<div class="stat-line"><div class="sl-t">رقم الهوية</div><div class="sl-v mono">' + U.esc(c.nationalId || '—') + '</div></div>' +
      '<div class="stat-line"><div class="sl-t">الكفيل</div><div class="sl-v">' + U.esc(c.guarantor || '—') + '</div></div>' +
      '<div class="stat-line"><div class="sl-t">تاريخ التسجيل</div><div class="sl-v">' + U.dateAr(String(c.createdAt || '').slice(0, 10)) + '</div></div>' +
      (c.notes ? '<div class="note-box mt-8">' + U.esc(c.notes) + '</div>' : '')) +
      UI.card('التقييم المالي', '<div class="stat-line"><div class="sl-t">سقف الدين</div><div class="sl-v">' + (c.creditLimit ? U.money(c.creditLimit) : 'بدون سقف') + '</div></div>' +
      '<div class="stat-line"><div class="sl-t">نسبة السداد</div><div class="sl-v">' + U.pct(bal.credit, 0) + '</div></div>' +
      UI.progress(bal.credit, bal.credit > 70 ? 'ok' : bal.credit > 40 ? 'warn' : 'danger') +
      '<div class="stat-line mt-8"><div class="sl-t">حساب الحالة</div><div class="sl-v">' + (bal.overdue > 0 ? '<span class="badge danger">متأخر</span>' : bal.remaining > 0 ? '<span class="badge warn">مدين</span>' : '<span class="badge ok">ملتزم</span>') + '</div></div>') + '</div>';
  } else if (tab === 'purchases'){
    panel = UI.table({
      columns: [
        { title: 'الفاتورة', render: (v) => '<a href="#" data-act="invoice-view" data-id="' + v.id + '" class="mono b">' + U.esc(v.no) + '</a>' },
        { title: 'التاريخ', render: (v) => V.dateCell(v.date) },
        { title: 'الأصناف', render: (v) => '<span class="tiny">' + (v.items || []).map((i) => U.esc(i.name) + ' ×' + i.qty).join('، ') + '</span>' },
        { title: 'الدفع', render: (v) => App.payLabel(v.method) },
        { title: 'الإجمالي', cls: 'num', render: (v) => V.money(v.total) },
        { title: '', cls: 'acts', render: (v) => V.rowMenu([{ act: 'invoice-print', id: v.id, icon: '🖨️', title: 'طباعة' }]) }
      ], rows: invs, empty: UI.empty('🧾', 'لا مشتريات')
    });
  } else if (tab === 'installments'){
    panel = plans.length ? plans.map((pl) => {
      const s = Engine.planSummary(pl);
      return '<section class="card mb-12"><div class="card-h"><h3>' + U.esc(pl.no) + '</h3>' +
        '<span class="sub">' + pl.items.length + ' قسط • يوم ' + pl.dueDay + '</span>' +
        '<div class="acts"><button class="btn sm soft" data-act="payment-new" data-customer="' + id + '" data-plan="' + pl.id + '">💳 تسديد</button>' +
        '<button class="btn sm ghost" data-act="plan-view" data-id="' + pl.id + '">التفاصيل</button></div></div>' +
        '<div class="row gap-16 wrap mb-8"><span class="tiny muted">الإجمالي <b class="num">' + U.money(s.total) + '</b></span>' +
        '<span class="tiny muted">المدفوع <b class="num" style="color:var(--ok)">' + U.money(s.paidAll) + '</b></span>' +
        '<span class="tiny muted">المتبقي <b class="num" style="color:var(--danger)">' + U.money(s.remaining) + '</b></span></div>' +
        UI.progress(s.progress, s.overdue ? 'danger' : 'ok') +
        UI.table({
          compact: true, maxHeight: '240px',
          columns: [
            { title: 'القسط', render: (i) => i.no },
            { title: 'الاستحقاق', render: (i) => U.dateAr(i.due, { short: true }) },
            { title: 'المبلغ', cls: 'num', render: (i) => U.money(i.amount) },
            { title: 'المدفوع', cls: 'num', render: (i) => i.paid ? U.money(i.paid) : '—' },
            { title: 'الحالة', render: (i) => UI.statusBadge(Engine.installmentStatus(i, U.today())) }
          ], rows: pl.items
        }) + '</section>';
    }).join('') : UI.empty('💳', 'لا أقساط');
  } else if (tab === 'payments'){
    panel = UI.table({
      columns: [
        { title: 'الوصل', render: (p) => '<span class="mono b">' + U.esc(p.no) + '</span>' },
        { title: 'التاريخ', render: (p) => V.dateCell(p.date) },
        { title: 'المبلغ', cls: 'num', render: (p) => V.money(p.amount) },
        { title: 'الطريقة', render: (p) => App.payLabel(p.method) },
        { title: '', cls: 'acts', render: (p) => V.rowMenu([{ act: 'payment-print', id: p.id, icon: '🖨️', title: 'وصل' }]) }
      ], rows: pays, empty: UI.empty('💰', 'لا تسديدات')
    });
  } else if (tab === 'warranty'){
    panel = UI.table({
      columns: [
        { title: 'الجهاز', render: (w) => U.esc((pMap[w.productId] || {}).name || '—') },
        { title: 'السيريال', render: (w) => '<span class="mono tiny">' + U.esc(w.serial || '—') + '</span>' },
        { title: 'البداية', render: (w) => V.dateCell(w.start) },
        { title: 'النهاية', render: (w) => V.dateCell(w.end) },
        { title: 'الحالة', render: (w) => { const s = Engine.warrantyStatus(w); return '<span class="badge ' + s.cls + '">' + s.label + '</span>' + (s.days >= 0 ? ' <span class="tiny dim">' + s.days + ' يوم</span>' : ''); } },
        { title: '', cls: 'acts', render: (w) => V.rowMenu([{ act: 'doc-preview', id: w.id, k: 'warranty', icon: '🖨️', title: 'شهادة الضمان' }]) }
      ], rows: wars, empty: UI.empty('🛡️', 'لا ضمانات')
    });
  } else if (tab === 'maintenance'){
    panel = UI.table({
      columns: [
        { title: 'الرقم', render: (m) => '<span class="mono b">' + U.esc(m.no) + '</span>' },
        { title: 'التاريخ', render: (m) => V.dateCell(m.date) },
        { title: 'الجهاز', render: (m) => U.esc(m.device || '—') },
        { title: 'المشكلة', render: (m) => '<span class="tiny">' + U.esc(m.problem || '') + '</span>' },
        { title: 'التكلفة', cls: 'num', render: (m) => V.money(m.cost) },
        { title: 'الحالة', render: (m) => UI.statusBadge(m.status) }
      ], rows: maints, empty: UI.empty('🔧', 'لا طلبات صيانة')
    });
  } else if (tab === 'delivery'){
    panel = UI.table({
      columns: [
        { title: 'الرقم', render: (d) => '<span class="mono b">' + U.esc(d.no) + '</span>' },
        { title: 'الموعد', render: (d) => V.dateCell(d.scheduleAt || d.date) },
        { title: 'العنوان', render: (d) => '<span class="tiny">' + U.esc(d.address || '—') + '</span>' },
        { title: 'الأجرة', cls: 'num', render: (d) => V.money(d.fee) },
        { title: 'الحالة', render: (d) => UI.statusBadge(d.status) }
      ], rows: dels, empty: UI.empty('🚚', 'لا توصيلات')
    });
  } else {
    panel = UI.table({
      columns: [
        { title: 'التاريخ', render: (r) => V.dateCell(String(r.date).slice(0, 10)) },
        { title: 'البيان', render: (r) => U.esc(r.type) + ' <span class="mono tiny dim">' + U.esc(r.ref) + '</span>' },
        { title: 'مدين', cls: 'num', render: (r) => r.debit ? U.money(r.debit) : '—' },
        { title: 'دائن', cls: 'num', render: (r) => r.credit ? U.money(r.credit) : '—' },
        { title: 'الرصيد', cls: 'num', render: (r) => '<b>' + U.money(r.balance) + '</b>' }
      ], rows: stmt.rows, empty: UI.empty('📑', 'لا حركات'),
      footer: ['الإجمالي', '', U.money(U.sum(stmt.rows, (r) => r.debit)), U.money(U.sum(stmt.rows, (r) => r.credit)), U.money(stmt.closing)]
    });
  }

  return UI.page({
    icon: '👤', title: U.esc(c.name), sub: (c.code || '') + (c.phone ? ' • ' + c.phone : '') + (c.tier === 'vip' ? ' • ⭐ VIP' : ''),
    actions: '<button class="btn sm" data-act="payment-new" data-customer="' + id + '">💳 تسديد</button>' +
      '<button class="btn sm" data-act="statement-print" data-id="' + id + '">🖨️ كشف حساب</button>' +
      '<button class="btn sm" data-act="crud-edit" data-k="customers" data-id="' + id + '">✏️ تعديل</button>' +
      '<button class="btn sm" data-act="go" data-route="pos">🛒 بيع</button>',
    body: '<div class="card mb-16"><div class="row gap-16 wrap">' +
      '<div class="avatar lg">' + (c.image ? '<img src="' + U.esc(c.image) + '">' : U.esc(U.initials(c.name))) + '</div>' +
      '<div class="grow"><div class="row gap-8 wrap"><h2>' + U.esc(c.name) + '</h2>' +
      (c.tier === 'vip' ? '<span class="badge violet">⭐ VIP</span>' : c.tier === 'new' ? '<span class="badge info">جديد</span>' : '<span class="badge">عادي</span>') +
      (bal.overdue > 0 ? '<span class="badge danger">عليه متأخرات</span>' : '') + '</div>' +
      '<div class="small muted mono">' + U.esc(c.phone || '') + ' • ' + U.esc(c.code || '') + '</div></div>' +
      '<div class="row gap-16 wrap">' +
      '<div class="mid"><div class="tiny dim">إجمالي المشتريات</div><div class="b num">' + U.money(bal.purchased) + '</div></div>' +
      '<div class="mid"><div class="tiny dim">المدفوع</div><div class="b num" style="color:var(--ok)">' + U.money(bal.paid) + '</div></div>' +
      '<div class="mid"><div class="tiny dim">المتبقي</div><div class="b num" style="color:var(--danger)">' + U.money(bal.remaining) + '</div></div>' +
      '</div></div></div>' + tabsHtml + panel
  });
};
