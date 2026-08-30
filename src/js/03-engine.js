/* ============================================================================
   03) محرّك الحسابات — منطق العمل الصافي (بدون DOM) قابل للاختبار
   ========================================================================== */
const Engine = {

  /* ------------------------------------------------------------------ السلع */
  marginOf(p){
    const price = Number(p.price) || 0, cost = Number(p.cost) || 0;
    if (!price) return 0;
    return ((price - cost) / price) * 100;
  },
  profitOf(p){ return (Number(p.price) || 0) - (Number(p.cost) || 0); },
  /* السعر المقترح: الهامش محسوب على سعر البيع (كل 100,000 بيع = 25,000 ربح) */
  suggestPrice(cost, marginPct){
    const m = U.clamp(Number(marginPct) || 0, 0, 95);
    const raw = (Number(cost) || 0) / (1 - m / 100);
    return U.round(raw, S().sales.roundTo || 250) || Math.round(raw);
  },
  suggestPriceMarkup(cost, markupPct){
    const raw = (Number(cost) || 0) * (1 + (Number(markupPct) || 0) / 100);
    return U.round(raw, S().sales.roundTo || 250) || Math.round(raw);
  },

  /* --------------------------------------------------------------- الفواتير */
  lineTotals(it){
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    const cost = Number(it.cost) || 0;
    const gross = qty * price;
    const discount = Number(it.discount) || 0;
    const net = gross - discount;
    return { qty, gross, discount, net, cost: cost * qty, profit: net - cost * qty };
  },
  invoiceTotals(items, opt){
    opt = opt || {};
    const lines = (items || []).map(Engine.lineTotals);
    const subtotal = U.sum(lines, (l) => l.gross);
    const lineDiscount = U.sum(lines, (l) => l.discount);
    const afterLine = subtotal - lineDiscount;
    let discount = Number(opt.discount) || 0;
    const maxDiscountPct = Number(opt.maxDiscountPct);
    if (isFinite(maxDiscountPct) && afterLine > 0){
      const cap = afterLine * maxDiscountPct / 100;
      if (discount > cap) discount = cap;
    }
    const net = afterLine - discount;
    const taxRate = Number(opt.taxRate) || 0;
    const tax = taxRate ? U.round(net * taxRate / 100, 1) : 0;
    let total = net + tax;
    const roundTo = Number(opt.roundTo) || 0;
    if (roundTo) total = U.round(total, roundTo);
    const cost = U.sum(lines, (l) => l.cost);
    return {
      subtotal, lineDiscount, discount, tax, total: Math.max(0, total), cost,
      profit: total - tax - cost,
      margin: total > 0 ? ((total - tax - cost) / total) * 100 : 0
    };
  },
  invoiceProfit(inv){
    const cost = U.sum(inv.items || [], (it) => (Number(it.cost) || 0) * (Number(it.qty) || 0));
    const net = (Number(inv.total) || 0) - (Number(inv.tax) || 0);
    return net - cost;
  },
  activeInvoices(state, from, to){
    state = state || DB.state;
    return DB.c('invoices').filter((v) => v.status !== 'void' && Engine.inRange(v.date, from, to));
  },
  inRange(date, from, to){
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  },

  /* هل هذه الدفعة هي ثمن فاتورة نقدية/بطاقة (فتُحسب ضمن المبيعات لا ضمن التسديدات)؟ */
  isInvoiceCash(state, p){
    if (!p || !p.invoiceId) return false;
    const v = (state.invoices || []).find((x) => x.id === p.invoiceId);
    return !!v && v.method !== 'installment';
  },

  /* ----------------------------------------------------------- خطط التقسيط */
  /* يبني جدول الأقساط: توزيع عادل على مضاعفات التقريب ومجموعها = المموَّل بالضبط */
  buildPlan(opt){
    const st = S().installments;
    const total = Math.max(0, Number(opt.total) || 0);
    let down = Math.max(0, Number(opt.down) || 0);
    if (down > total) down = total;
    const financed = total - down;
    let months = Math.max(1, Math.min(360, Math.round(Number(opt.months) || 1)));
    const step = Math.max(1, Number(opt.roundTo != null ? opt.roundTo : st.roundTo) || 1);
    const dueDay = Math.min(28, Math.max(1, Number(opt.dueDay != null ? opt.dueDay : st.dueDay) || 15));
    const start = opt.startDate || U.today();

    let per = Math.floor(financed / months / step) * step;
    let unit = step;
    if (per <= 0){ per = Math.floor(financed / months); unit = 1; }
    let rem = financed - per * months;
    const bump = unit === step ? Math.floor(rem / step) : rem;   /* عدد الأقساط التي تأخذ زيادة */
    const tail = unit === step ? rem - bump * step : 0;          /* الفرق المتبقي يوضع على القسط الأخير */

    const items = [];
    for (let i = 0; i < months; i++){
      let amount = per + (i < bump ? unit : 0);
      if (i === months - 1) amount += tail;
      items.push({ no: i + 1, due: Engine.dueDate(start, i, dueDay, opt), amount, paid: 0, paidAt: '', status: 'upcoming' });
    }
    return {
      down, financed, months, dueDay, startDate: start, per, step,
      items, sum: U.sum(items, (i) => i.amount), total,
      markup: Number(opt.markup) || 0
    };
  },
  /* تاريخ استحقاق القسط رقم (index+1) */
  dueDate(startDate, index, dueDay, opt){
    const sameMonth = !!(opt && opt.firstDueSameMonth != null ? opt.firstDueSameMonth : S().installments.firstDueSameMonth);
    const d = U.parse(startDate) || new Date();
    const firstOffset = (sameMonth && d.getDate() <= dueDay) ? 0 : 1;
    return U.addMonths(U.iso(new Date(d.getFullYear(), d.getMonth(), 1)), index + firstOffset, dueDay);
  },

  installmentStatus(item, today){
    today = today || U.today();
    const paid = Number(item.paid) || 0, amount = Number(item.amount) || 0;
    if (paid >= amount && amount > 0) return 'paid';
    if (item.due < today) return 'overdue';
    if (item.due === today) return 'due';
    return 'upcoming';
  },
  planSummary(plan, today){
    today = today || U.today();
    const items = plan.items || [];
    let paid = 0, overdue = 0, overdueCount = 0, dueToday = 0, dueTodayAmt = 0, upcoming = 0, upcomingAmt = 0, paidCount = 0;
    let next = null;
    items.forEach((it) => {
      const s = Engine.installmentStatus(it, today);
      const left = Math.max(0, (Number(it.amount) || 0) - (Number(it.paid) || 0));
      it._status = s;
      paid += Number(it.paid) || 0;
      if (s === 'paid'){ paidCount++; }
      else if (s === 'overdue'){ overdue += left; overdueCount++; }
      else if (s === 'due'){ dueToday++; dueTodayAmt += left; }
      else { upcoming++; upcomingAmt += left; }
      if (s !== 'paid' && (!next || it.due < next.due)) next = it;
    });
    const total = Number(plan.total) || 0;
    const down = Number(plan.down) || 0;
    const paidAll = paid + down;
    const remaining = Math.max(0, total - paidAll);
    return {
      total, down, financed: Number(plan.financed) || (total - down),
      paid, paidAll, remaining, overdue, overdueCount, dueToday, dueTodayAmt,
      upcoming, upcomingAmt, paidCount, count: items.length, next,
      progress: total > 0 ? U.clamp((paidAll / total) * 100, 0, 100) : 0,
      closed: remaining <= 0.5
    };
  },
  /* توزيع دفعة على الأقساط (الأقدم أولاً) — يعيد خطة جديدة ولا يعدّل الأصل */
  allocate(plan, amount, today){
    today = today || U.today();
    const p = JSON.parse(JSON.stringify(plan));
    let left = Math.max(0, Number(amount) || 0);
    const allocations = [];
    p.items.forEach((it) => {
      if (left <= 0) return;
      const rem = Math.max(0, (Number(it.amount) || 0) - (Number(it.paid) || 0));
      if (rem <= 0) return;
      const take = Math.min(rem, left);
      it.paid = U.round((Number(it.paid) || 0) + take, 0.01);
      left = U.round(left - take, 0.01);
      if (it.paid >= it.amount - 0.005){ it.paidAt = today; it.status = 'paid'; }
      else it.status = 'partial';
      allocations.push({ installNo: it.no, due: it.due, amount: take });
    });
    const sum = Engine.planSummary(p, today);
    if (sum.closed) p.status = 'closed';
    return { plan: p, allocations, applied: (Number(amount) || 0) - left, leftover: left, summary: sum };
  },
  /* إعادة بناء خطة بعد تعديل فاتورة: يثبّت ما سُدّد ويعيد توزيع الباقي */
  rebuildPlan(plan, newTotal, today){
    today = today || U.today();
    const paidTotal = U.sum(plan.items || [], (i) => Number(i.paid) || 0);
    const paidDown = Number(plan.down) || 0;
    const remaining = Math.max(0, newTotal - paidDown - paidTotal);
    const paidItems = (plan.items || []).filter((i) => (Number(i.paid) || 0) > 0).map((i) => ({ ...i }));
    const rest = Engine.buildPlan({
      total: paidDown + paidTotal + remaining, down: paidDown, months: Math.max(1, (plan.items || []).length),
      dueDay: plan.dueDay, startDate: today, roundTo: plan.step
    });
    const items = paidItems.concat(rest.items.map((i, k) => ({ ...i, no: paidItems.length + k + 1 })));
    return { ...plan, total: newTotal, items, financed: newTotal - paidDown };
  },

  /* --------------------------------------------------------------- الزبائن */
  customerBalance(state, id){
    state = state || DB.state;
    const invoices = state.invoices.filter((v) => v.customerId === id && v.status !== 'void');
    const purchased = U.sum(invoices, (v) => Number(v.total) || 0);
    const paid = U.sum(state.payments.filter((p) => p.customerId === id), (p) => Number(p.amount) || 0);
    const returned = U.sum(state.returns.filter((r) => r.customerId === id), (r) => Number(r.amount) || 0);
    const plans = state.plans.filter((p) => p.customerId === id);
    let overdue = 0, dueToday = 0, remaining = 0, nextDue = null;
    plans.forEach((pl) => {
      if (pl.status === 'void') return;
      const s = Engine.planSummary(pl);
      remaining += s.remaining; overdue += s.overdue; dueToday += s.dueTodayAmt;
      if (s.next && (!nextDue || s.next.due < nextDue)) nextDue = s.next.due;
    });
    return {
      purchased, paid, returned,
      remaining: Math.max(0, purchased - paid - returned),
      debt: Math.max(0, remaining),
      overdue, overdueCount: 0, dueToday, nextDue,
      invoices: invoices.length, credit: purchased > 0 ? (paid / purchased) * 100 : 100
    };
  },
  customerStatement(state, id){
    state = state || DB.state;
    const rows = [];
    state.invoices.filter((v) => v.customerId === id && v.status !== 'void').forEach((v) => {
      rows.push({ date: v.date + ' ' + (v.time || '00:00'), type: 'فاتورة بيع', ref: v.no, debit: Number(v.total) || 0, credit: 0, note: (v.items || []).length + ' صنف' });
    });
    state.payments.filter((p) => p.customerId === id).forEach((p) => {
      rows.push({ date: p.date + ' ' + (p.time || '00:00'), type: 'تسديد', ref: p.no, debit: 0, credit: Number(p.amount) || 0, note: p.method === 'cash' ? 'نقداً' : (p.note || '') });
    });
    state.returns.filter((r) => r.customerId === id).forEach((r) => {
      rows.push({ date: r.date, type: 'مرتجع', ref: r.no, debit: 0, credit: Number(r.amount) || 0, note: r.reason || '' });
    });
    rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let bal = 0;
    rows.forEach((r) => { bal += (r.debit || 0) - (r.credit || 0); r.balance = bal; });
    return { rows, opening: 0, closing: bal };
  },
  customerAggregates(state){
    state = state || DB.state;
    const map = {};
    state.customers.forEach((c) => { map[c.id] = { purchased: 0, paid: 0, remaining: 0, invoices: 0, last: '' }; });
    state.invoices.filter((v) => v.status !== 'void').forEach((v) => {
      const m = map[v.customerId]; if (!m) return;
      m.purchased += Number(v.total) || 0; m.invoices++;
      if (!m.last || v.date > m.last) m.last = v.date;
    });
    state.payments.forEach((p) => { const m = map[p.customerId]; if (m) m.paid += Number(p.amount) || 0; });
    state.returns.forEach((r) => { const m = map[r.customerId]; if (m) m.paid += Number(r.amount) || 0; });
    Object.keys(map).forEach((k) => { map[k].remaining = Math.max(0, map[k].purchased - map[k].paid); });
    return map;
  },

  /* ------------------------------------------------------------- المخزون */
  stockValue(state){
    state = state || DB.state;
    return {
      cost: U.sum(state.products, (p) => (Number(p.qty) || 0) * (Number(p.cost) || 0)),
      retail: U.sum(state.products, (p) => (Number(p.qty) || 0) * (Number(p.price) || 0)),
      units: U.sum(state.products, (p) => Number(p.qty) || 0)
    };
  },
  lowStock(state){
    state = state || DB.state;
    return state.products.filter((p) => (Number(p.qty) || 0) <= (Number(p.minQty) || 0));
  },
  outOfStock(state){ return Engine.lowStock(state).filter((p) => (Number(p.qty) || 0) <= 0); },
  reorderList(state){
    return Engine.lowStock(state).map((p) => {
      const need = Math.max(1, (Number(p.minQty) || 0) * 2 - (Number(p.qty) || 0));
      return { product: p, need, cost: need * (Number(p.cost) || 0) };
    }).sort((a, b) => b.cost - a.cost);
  },
  productSales(state, productId, from, to){
    state = state || DB.state;
    let qty = 0, revenue = 0, profit = 0, last = '';
    Engine.activeInvoices(state, from, to).forEach((v) => {
      (v.items || []).forEach((it) => {
        if (it.productId !== productId) return;
        const t = Engine.lineTotals(it);
        qty += t.qty; revenue += t.net; profit += t.profit;
        if (!last || v.date > last) last = v.date;
      });
    });
    return { qty, revenue, profit, last };
  },
  deadStock(state, days){
    state = state || DB.state;
    days = days || S().stock.deadStockDays || 90;
    const cut = U.addDays(U.today(), -days);
    return state.products.filter((p) => {
      const s = Engine.productSales(state, p.id, cut, U.today());
      return s.qty === 0 && (Number(p.qty) || 0) > 0;
    }).map((p) => {
      const lastMove = (state.stockMoves || []).filter((m) => m.productId === p.id).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
      return { product: p, since: lastMove ? lastMove.at : p.createdAt, value: (Number(p.qty) || 0) * (Number(p.cost) || 0) };
    }).sort((a, b) => b.value - a.value);
  },
  productMovements(state, productId){
    state = state || DB.state;
    return (state.stockMoves || []).filter((m) => m.productId === productId).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  },
  priceHistory(state, productId){
    state = state || DB.state;
    return (state.priceHistory || []).filter((h) => h.productId === productId).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  },

  /* ------------------------------------------------------------ المالية */
  cashboxDay(state, date){
    state = state || DB.state;
    date = date || U.today();
    const invs = state.invoices.filter((v) => v.status !== 'void' && v.date === date);
    const cashSales = U.sum(invs.filter((v) => v.method === 'cash'), (v) => Number(v.paid) || 0);
    const cardSales = U.sum(invs.filter((v) => v.method === 'card'), (v) => Number(v.paid) || 0);
    /* الدفعات المرتبطة بفاتورة نقدية/بطاقة محسوبة ضمن المبيعات — لا تُحتسب مرتين */
    const pays = state.payments.filter((p) => p.date === date).filter((p) => !Engine.isInvoiceCash(state, p));
    const cashPayments = U.sum(pays.filter((p) => Number(p.amount) >= 0 && p.method === 'cash'), (p) => Number(p.amount) || 0);
    const otherPayments = U.sum(pays.filter((p) => p.method !== 'cash'), (p) => Number(p.amount) || 0);
    const expenses = U.sum(state.expenses.filter((e) => e.date === date), (e) => Number(e.amount) || 0);
    const supplierPaid = U.sum(state.supplierPayments.filter((e) => e.date === date), (e) => Number(e.amount) || 0);
    const returns = U.sum(state.returns.filter((r) => r.date === date), (r) => Number(r.amount) || 0);
    const manualIn = U.sum((state.cashbox || []).filter((c) => c.date === date && c.type === 'in'), (c) => Number(c.amount) || 0);
    const manualOut = U.sum((state.cashbox || []).filter((c) => c.date === date && c.type === 'out'), (c) => Number(c.amount) || 0);
    const prevCloses = state.dayCloses.filter((d) => d.date < date).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const opening = prevCloses.length ? (Number(prevCloses[0].counted) || Number(prevCloses[0].expected) || 0) : 0;
    const expected = opening + cashSales + cashPayments + manualIn - expenses - supplierPaid - returns - manualOut;
    const close = state.dayCloses.find((d) => d.date === date) || null;
    return {
      date, opening, cashSales, cardSales, cashPayments, otherPayments, expenses, supplierPaid, returns,
      manualIn, manualOut, expected, close,
      counted: close ? (Number(close.counted) || 0) : null,
      diff: close ? (Number(close.counted) || 0) - expected : null,
      closed: !!close,
      invoices: invs.length, payments: pays.length
    };
  },
  profitReport(state, from, to){
    state = state || DB.state;
    const invs = Engine.activeInvoices(state, from, to);
    const revenue = U.sum(invs, (v) => Number(v.total) || 0);
    const tax = U.sum(invs, (v) => Number(v.tax) || 0);
    const cost = U.sum(invs, (v) => U.sum(v.items || [], (it) => (Number(it.cost) || 0) * (Number(it.qty) || 0)));
    const gross = revenue - tax - cost;
    const expenses = U.sum(state.expenses.filter((e) => Engine.inRange(e.date, from, to)), (e) => Number(e.amount) || 0);
    const returned = U.sum(state.returns.filter((r) => Engine.inRange(r.date, from, to)), (r) => Number(r.amount) || 0);
    return {
      from, to, revenue, tax, cost, gross, expenses, returned,
      net: gross - expenses, margin: revenue > 0 ? ((revenue - tax - cost) / revenue) * 100 : 0,
      invoices: invs.length
    };
  },
  expensesSummary(state, from, to){
    state = state || DB.state;
    const list = state.expenses.filter((e) => Engine.inRange(e.date, from, to));
    const byCat = {};
    list.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + (Number(e.amount) || 0); });
    const cats = Object.keys(byCat).map((k) => ({ name: k, amount: byCat[k] })).sort((a, b) => b.amount - a.amount);
    return { list, byCat, cats, total: U.sum(list, (e) => Number(e.amount) || 0) };
  },
  supplierBalance(state, supplierId){
    state = state || DB.state;
    const bought = U.sum(state.purchases.filter((p) => p.supplierId === supplierId && p.status !== 'void'), (p) => Number(p.total) || 0);
    const paid = U.sum(state.supplierPayments.filter((p) => p.supplierId === supplierId), (p) => Number(p.amount) || 0);
    return { bought, paid, remaining: Math.max(0, bought - paid) };
  },

  /* ----------------------------------------------------------- السلاسل */
  salesSeries(state, from, to, by){
    state = state || DB.state;
    by = by || 'day';
    const buckets = new Map();
    const keyOf = (d) => by === 'month' ? U.monthKey(d) : by === 'year' ? String(d).slice(0, 4) : by === 'week' ? U.startOfWeek(d) : d;
    const cur = U.parse(from), end = U.parse(to);
    if (!cur || !end) return [];
    const step = by === 'month' ? 'm' : by === 'year' ? 'y' : 'd';
    const d = new Date(cur);
    let guard = 0;
    while (d <= end && guard++ < 2000){
      const iso = U.iso(d); const k = keyOf(iso);
      if (!buckets.has(k)) buckets.set(k, { key: k, sales: 0, profit: 0, count: 0, cost: 0 });
      if (step === 'd') d.setDate(d.getDate() + 1);
      else if (step === 'm') d.setMonth(d.getMonth() + 1);
      else d.setFullYear(d.getFullYear() + 1);
    }
    Engine.activeInvoices(state, from, to).forEach((v) => {
      const k = keyOf(v.date);
      const b = buckets.get(k) || { key: k, sales: 0, profit: 0, count: 0, cost: 0 };
      b.sales += Number(v.total) || 0;
      b.profit += Engine.invoiceProfit(v);
      b.count++;
      buckets.set(k, b);
    });
    return Array.from(buckets.values()).map((b) => ({
      ...b,
      label: by === 'month' ? U.monthAr(b.key) : by === 'year' ? b.key : by === 'week' ? U.dateAr(b.key, { short: true }) : U.dateAr(b.key, { short: true, year: false })
    }));
  },
  byCategory(state, from, to){
    state = state || DB.state;
    const cats = {}; state.categories.forEach((c) => { cats[c.id] = { id: c.id, name: c.name, icon: c.icon || '📦', color: c.color || '#2563EB', sales: 0, qty: 0, profit: 0 }; });
    const pMap = DB.byId('products');
    Engine.activeInvoices(state, from, to).forEach((v) => {
      (v.items || []).forEach((it) => {
        const p = pMap[it.productId];
        const cid = (p && p.categoryId) || it.categoryId || '_';
        const t = Engine.lineTotals(it);
        if (!cats[cid]) cats[cid] = { id: cid, name: 'غير مصنّف', icon: '📦', color: '#8A94A9', sales: 0, qty: 0, profit: 0 };
        cats[cid].sales += t.net; cats[cid].qty += t.qty; cats[cid].profit += t.profit;
      });
    });
    return Object.values(cats).filter((c) => c.sales > 0).sort((a, b) => b.sales - a.sales);
  },
  topProducts(state, from, to, limit){
    state = state || DB.state;
    const map = {};
    Engine.activeInvoices(state, from, to).forEach((v) => {
      (v.items || []).forEach((it) => {
        const t = Engine.lineTotals(it);
        const k = it.productId || it.name;
        if (!map[k]) map[k] = { id: it.productId, name: it.name, code: it.code, qty: 0, sales: 0, profit: 0 };
        map[k].qty += t.qty; map[k].sales += t.net; map[k].profit += t.profit;
      });
    });
    return Object.values(map).sort((a, b) => b.sales - a.sales).slice(0, limit || 10);
  },
  topCustomers(state, from, to, limit){
    state = state || DB.state;
    const map = {};
    Engine.activeInvoices(state, from, to).forEach((v) => {
      if (!map[v.customerId]) map[v.customerId] = { id: v.customerId, sales: 0, count: 0, profit: 0 };
      map[v.customerId].sales += Number(v.total) || 0;
      map[v.customerId].count++;
      map[v.customerId].profit += Engine.invoiceProfit(v);
    });
    const cMap = DB.byId('customers');
    return Object.values(map).map((m) => ({ ...m, name: (cMap[m.id] || {}).name || 'زبون نقدي', phone: (cMap[m.id] || {}).phone || '' }))
      .sort((a, b) => b.sales - a.sales).slice(0, limit || 10);
  },
  bestDayOfWeek(state, from, to){
    const days = {};
    Engine.activeInvoices(state, from, to).forEach((v) => {
      const d = U.parse(v.date); if (!d) return;
      const k = d.getDay();
      days[k] = (days[k] || 0) + (Number(v.total) || 0);
    });
    const arr = Object.keys(days).map((k) => ({ day: U.WD[k], sales: days[k] })).sort((a, b) => b.sales - a.sales);
    return arr[0] || null;
  },

  /* ------------------------------------------------------------ المؤشرات */
  kpis(state, today){
    state = state || DB.state; today = today || U.today();
    const todayInvs = state.invoices.filter((v) => v.status !== 'void' && v.date === today);
    const sales = U.sum(todayInvs, (v) => Number(v.total) || 0);
    const gross = U.sum(todayInvs, (v) => Engine.invoiceProfit(v));
    const expenses = U.sum(state.expenses.filter((e) => e.date === today), (e) => Number(e.amount) || 0);
    const box = Engine.cashboxDay(state, today);
    const collected = box.cashSales + box.cardSales + box.cashPayments + box.otherPayments;
    let dueToday = 0, dueTodayAmt = 0, overdue = 0, overdueCount = 0, totalDebt = 0;
    state.plans.filter((p) => p.status !== 'void').forEach((pl) => {
      const s = Engine.planSummary(pl, today);
      dueToday += s.dueToday; dueTodayAmt += s.dueTodayAmt;
      overdue += s.overdue; overdueCount += s.overdueCount;
      totalDebt += s.remaining;
    });
    const low = Engine.lowStock(state).length;
    const newToday = state.customers.filter((c) => String(c.createdAt || '').slice(0, 10) === today).length;
    return {
      sales, collected, netProfit: gross - expenses, grossProfit: gross, expenses,
      dueToday, dueTodayAmt, overdue, overdueCount, totalDebt, lowStock: low,
      customers: state.customers.length, newCustomers: newToday,
      invoices: todayInvs.length, cash: box.expected, opening: box.opening
    };
  },

  /* ------------------------------------------------------------ الضمان */
  warrantyStatus(w, today){
    today = today || U.today();
    const days = U.diffDays(w.end, today);
    const alertDays = S().warranty.alertDays || 30;
    if (days < 0) return { key: 'expired', label: 'منتهي', cls: 'danger', days };
    if (days <= alertDays) return { key: 'soon', label: 'قريب الانتهاء', cls: 'warn', days };
    return { key: 'active', label: 'ساري', cls: 'ok', days };
  },
  expiringWarranties(state, days){
    state = state || DB.state; days = days || S().warranty.alertDays || 30;
    return state.warranties.filter((w) => {
      const d = U.diffDays(w.end, U.today());
      return d >= 0 && d <= days;
    }).sort((a, b) => String(a.end).localeCompare(String(b.end)));
  },

  /* --------------------------------------------------------- التنبيهات */
  alerts(state, today){
    state = state || DB.state; today = today || U.today();
    const out = [];
    const cMap = DB.byId('customers'), pMap = DB.byId('products');
    let overdue = [], dueToday = [], upcoming = [];
    state.plans.filter((p) => p.status !== 'void').forEach((pl) => {
      const s = Engine.planSummary(pl, today);
      const who = (cMap[pl.customerId] || {}).name || 'زبون';
      if (s.overdueCount) overdue.push({ plan: pl, who, count: s.overdueCount, amount: s.overdue });
      if (s.dueToday) dueToday.push({ plan: pl, who, count: s.dueToday, amount: s.dueTodayAmt });
      else if (s.next && U.diffDays(s.next.due, today) >= 0 && U.diffDays(s.next.due, today) <= 7) upcoming.push({ plan: pl, who, next: s.next, amount: Math.max(0, s.next.amount - (s.next.paid || 0)) });
    });
    overdue.sort((a, b) => b.amount - a.amount);
    if (overdue.length) out.push({ level: 'danger', icon: '🔴', title: U.plural(overdue.length, 'زبون واحد عليه قسط متأخر', 'أقساط متأخرة', 'قسطاً متأخراً'), msg: 'إجمالي المتأخر ' + U.money(U.sum(overdue, (o) => o.amount)) + ' على ' + overdue.length + ' خطة', route: 'installments', filter: 'overdue', count: U.sum(overdue, (o) => o.count) });
    if (dueToday.length) out.push({ level: 'warn', icon: '🟠', title: U.plural(dueToday.length, 'قسط مستحق اليوم', 'أقساط مستحقة اليوم', 'أقساط مستحقة اليوم'), msg: U.money(U.sum(dueToday, (d) => d.amount)) + ' — استحصال اليوم', route: 'installments', filter: 'today', count: U.sum(dueToday, (d) => d.count) });
    if (upcoming.length) out.push({ level: 'info', icon: '💳', title: U.plural(upcoming.length, 'زبون لديه دفعة قريبة', 'زبائن لديهم دفعات قريبة', 'زبوناً لديهم دفعات قريبة'), msg: 'خلال 7 أيام — ' + U.money(U.sum(upcoming, (u) => u.amount)), route: 'calendar', count: upcoming.length });

    const low = Engine.lowStock(state);
    if (low.length) out.push({ level: 'warn', icon: '📦', title: U.plural(low.length, 'منتج وصل للحد الأدنى', 'منتجات وصلت للحد الأدنى', 'منتجاً وصل للحد الأدنى'), msg: low.slice(0, 4).map((p) => p.name).join('، ') + (low.length > 4 ? '…' : ''), route: 'stock', filter: 'low', count: low.length });

    const war = Engine.expiringWarranties(state);
    if (war.length) out.push({ level: 'info', icon: '🛡️', title: U.plural(war.length, 'ضمان ينتهي خلال ' + (S().warranty.alertDays || 30) + ' يوماً', 'ضمانات تنتهي قريباً', 'ضماناً ينتهي قريباً'), msg: war.slice(0, 3).map((w) => (pMap[w.productId] || {}).name || w.serial).join('، '), route: 'warranties', filter: 'soon', count: war.length });

    const pendingMaint = state.maintenance.filter((m) => !['delivered', 'cancelled'].includes(m.status));
    if (pendingMaint.length) out.push({ level: 'info', icon: '🔧', title: U.plural(pendingMaint.length, 'طلب صيانة قيد التنفيذ', 'طلبات صيانة قيد التنفيذ', 'طلب صيانة قيد التنفيذ'), msg: 'راجع الورشة لإنهاء الطلبات المفتوحة', route: 'maintenance', count: pendingMaint.length });

    const pendingDel = state.deliveries.filter((d) => !['done', 'cancelled'].includes(d.status));
    if (pendingDel.length) out.push({ level: 'info', icon: '🚚', title: U.plural(pendingDel.length, 'توصيل معلّق', 'توصيلات معلّقة', 'توصيلاً معلّقاً'), msg: 'يحتاج جدولة أو تنفيذ', route: 'deliveries', count: pendingDel.length });

    const supDue = state.suppliers.map((s) => ({ s, b: Engine.supplierBalance(state, s.id) })).filter((x) => x.b.remaining > 0);
    if (supDue.length) out.push({ level: 'info', icon: '🏭', title: 'أرصدة موردين مستحقة', msg: U.money(U.sum(supDue, (x) => x.b.remaining)) + ' على ' + supDue.length + ' مورد', route: 'supplier-accounts', count: supDue.length });

    const todayBox = Engine.cashboxDay(state, today);
    if (!todayBox.closed) out.push({ level: 'info', icon: '🔒', title: 'اليوم لم يُغلق بعد', msg: 'الرصيد المتوقع ' + U.money(todayBox.expected), route: 'day-close', count: 0 });
    return out;
  },

  /* --------------------------------------------------- الذكاء (Insights) */
  insights(state, today){
    state = state || DB.state; today = today || U.today();
    const out = [];
    const mStart = U.startOfMonth(today), prevStart = U.addMonths(mStart, -1), prevEnd = U.addDays(mStart, -1);
    const cur = Engine.profitReport(state, mStart, today);
    const prev = Engine.profitReport(state, prevStart, prevEnd);
    const growth = prev.revenue > 0 ? ((cur.revenue - prev.revenue) / prev.revenue) * 100 : (cur.revenue > 0 ? 100 : 0);
    out.push({
      icon: growth >= 0 ? '📈' : '📉', tone: growth >= 0 ? 'ok' : 'danger',
      title: (growth >= 0 ? 'ارتفاع' : 'انخفاض') + ' المبيعات ' + U.pct(Math.abs(growth), 0) + ' عن الشهر السابق',
      text: 'مبيعات هذا الشهر ' + U.money(cur.revenue) + ' مقابل ' + U.money(prev.revenue) + ' في الشهر السابق.'
    });
    const top = Engine.topProducts(state, U.addDays(today, -30), today, 1);
    if (top.length && top[0].qty > 0) out.push({ icon: '🏆', tone: 'accent', title: 'الأكثر مبيعاً: ' + top[0].name, text: 'بيع منه ' + top[0].qty + ' قطعة خلال 30 يوماً بإيراد ' + U.money(top[0].sales) + '.' });
    const dead = Engine.deadStock(state);
    if (dead.length) out.push({ icon: '💤', tone: 'warn', title: U.plural(dead.length, 'منتج راكد', 'منتجات راكدة', 'منتجاً راكداً'), text: 'قيمة راكدة ' + U.money(U.sum(dead, (d) => d.value)) + ' — لم تُبع منذ ' + (S().stock.deadStockDays || 90) + ' يوماً. فكّر بعرض أو تخفيض.' });
    const low = Engine.lowStock(state);
    if (low.length) out.push({ icon: '🔁', tone: 'warn', title: U.plural(low.length, 'منتج يحتاج إعادة طلب', 'منتجات تحتاج إعادة طلب', 'منتجاً يحتاج إعادة طلب'), text: 'تكلفة الطلب المقترحة ' + U.money(U.sum(Engine.reorderList(state), (r) => r.cost)) + '.' });
    const tc = Engine.topCustomers(state, U.addDays(today, -90), today, 1);
    if (tc.length) out.push({ icon: '⭐', tone: 'violet', title: 'أفضل زبون: ' + tc[0].name, text: 'اشترى بـ' + U.money(tc[0].sales) + ' في ' + tc[0].count + ' فاتورة خلال 90 يوماً.' });
    const best = Engine.bestDayOfWeek(state, U.addDays(today, -60), today);
    if (best) out.push({ icon: '📅', tone: 'info', title: 'أنشط يوم: ' + best.day, text: 'أعلى مبيعات خلال 60 يوماً كانت يوم ' + best.day + ' بإجمالي ' + U.money(best.sales) + '.' });
    const exp = Engine.expensesSummary(state, mStart, today);
    if (exp.total > 0){
      const ratio = cur.revenue > 0 ? (exp.total / cur.revenue) * 100 : 100;
      const topCat = exp.cats[0];
      out.push({
        icon: '💸', tone: ratio > 25 ? 'danger' : 'info',
        title: 'المصاريف ' + U.pct(ratio, 0) + ' من المبيعات',
        text: 'إجمالي ' + U.money(exp.total) + (topCat ? ' — أكبر بند: ' + topCat.name + ' (' + U.money(topCat.amount) + ')' : '') + '. صافي الربح ' + U.money(cur.net) + '.'
      });
    }
    let overdueAmt = 0, overdueCnt = 0;
    state.plans.filter((p) => p.status !== 'void').forEach((pl) => { const s = Engine.planSummary(pl, today); overdueAmt += s.overdue; overdueCnt += s.overdueCount; });
    if (overdueCnt) out.push({ icon: '🔴', tone: 'danger', title: U.plural(overdueCnt, 'قسط متأخر', 'أقساط متأخرة', 'قسطاً متأخراً'), text: 'بمبلغ ' + U.money(overdueAmt) + ' — يُنصح بالتواصل مع الزبائن أو إيقاف البيع بالتقسيط لهم.' });
    const margin = cur.revenue > 0 ? ((cur.revenue - cur.tax - cur.cost) / cur.revenue) * 100 : 0;
    if (cur.revenue > 0) out.push({ icon: '💰', tone: margin >= (S().sales.defaultMargin || 25) - 2 ? 'ok' : 'warn', title: 'هامش الربح الفعلي ' + U.pct(margin, 1), text: 'المستهدف ' + U.pct(S().sales.defaultMargin || 25, 0) + ' — ' + (margin >= (S().sales.defaultMargin || 25) - 2 ? 'أداؤك ضمن الهدف.' : 'تحقّق من الخصومات والكلف.') });
    return out;
  }
};
