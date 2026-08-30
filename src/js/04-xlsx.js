/* ============================================================================
   04) إكسل — توليد ملفات .xlsx حقيقية (ZIP + OOXML) بدون أي مكتبة خارجية
   ========================================================================== */
const XLSX = (() => {

  /* ---------------- CRC32 ---------------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++){
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes){
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const enc = new TextEncoder();
  function colName(i){
    let s = ''; i++;
    while (i > 0){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }
  function xml(s){
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;' }[c]));
  }
  function dosTime(d){
    d = d || new Date();
    return { t: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2)), d: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
  }

  /* ---------------- بناء حزمة ZIP (تخزين بدون ضغط) ---------------- */
  function zip(files){
    const chunks = [], central = [];
    let offset = 0;
    const dt = dosTime();
    files.forEach((f) => {
      const nameB = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameB.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);       /* UTF-8 */
      lv.setUint16(8, 0, true);            /* stored */
      lv.setUint16(10, dt.t, true);
      lv.setUint16(12, dt.d, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameB.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameB, 30);
      chunks.push(local, data);

      const cd = new Uint8Array(46 + nameB.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dt.t, true);
      cv.setUint16(14, dt.d, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameB.length, true);
      cv.setUint32(42, offset, true);
      cd.set(nameB, 46);
      central.push(cd);
      offset += local.length + data.length;
    });
    const cdSize = central.reduce((t, c) => t + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    return new Blob(chunks.concat(central, [end]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------------- أجزاء OOXML ---------------- */
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/></numFmts>' +
    '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="12"/><color rgb="FF172033"/><name val="Calibri"/></font></fonts>' +
    '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF172033"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEAF1FE"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><bottom style="thin"><color rgb="FFD0D7E2"/></bottom></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="6">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="164" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  function sheetXml(sheet, index){
    const cols = sheet.columns || [];
    const rows = sheet.rows || [];
    const colsXml = '<cols>' + cols.map((c, i) =>
      '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.width || 16) + '" customWidth="1"/>'
    ).join('') + '</cols>';

    let body = '<row r="1" ht="24" customHeight="1">';
    cols.forEach((c, i) => { body += '<c r="' + colName(i) + '1" s="1" t="inlineStr"><is><t>' + xml(c.title) + '</t></is></c>'; });
    body += '</row>';

    rows.forEach((r, ri) => {
      const n = ri + 2;
      body += '<row r="' + n + '">';
      cols.forEach((c, ci) => {
        const raw = r[c.key];
        const ref = colName(ci) + n;
        const isNum = (c.type === 'number' || c.type === 'money') && raw !== '' && raw != null && isFinite(Number(raw));
        if (isNum){
          body += '<c r="' + ref + '" s="' + (c.type === 'money' ? 2 : 0) + '"><v>' + Number(raw) + '</v></c>';
        } else {
          body += '<c r="' + ref + '" s="3" t="inlineStr"><is><t xml:space="preserve">' + xml(raw == null ? '' : raw) + '</t></is></c>';
        }
      });
      body += '</row>';
    });

    const lastCol = colName(Math.max(0, cols.length - 1));
    const filter = cols.length && rows.length ? '<autoFilter ref="A1:' + lastCol + (rows.length + 1) + '"/>' : '';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView' + (sheet.rtl === false ? '' : ' rightToLeft="1"') + ' workbookViewId="0" showGridLines="' + (sheet.grid ? '1' : '0') + '">' +
      (sheet.freeze === false ? '' : '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>') +
      '</sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="16"/>' + colsXml +
      '<sheetData>' + body + '</sheetData>' + filter +
      '</worksheet>';
  }

  function summarySheet(sheet){
    const info = sheet.summary || [];
    const cols = [{ key: 'k', title: 'البيان', width: 30, type: 'text' }, { key: 'v', title: 'القيمة', width: 24, type: 'money' }];
    const rows = info.map((x) => ({ k: x.k, v: x.v }));
    rows.push({ k: 'تاريخ التصدير', v: U.dateTimeAr(U.now()) });
    rows.push({ k: 'المحل', v: ST().name });
    return { name: 'ملخّص', columns: cols, rows, grid: true, freeze: false };
  }

  /* ---------------- الواجهة العامة ---------------- */
  function build(sheets, opts){
    opts = opts || {};
    const list = Array.isArray(sheets) ? sheets.slice() : [sheets];
    if (opts.summary !== false && list[0] && list[0].summary) list.unshift(summarySheet(list[0]));
    const files = [];
    const overrides = [];
    list.forEach((s, i) => {
      const n = i + 1;
      files.push({ name: 'xl/worksheets/sheet' + n + '.xml', data: sheetXml(s, i) });
      overrides.push('<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
    });
    const sheetTags = list.map((s, i) => '<sheet name="' + xml(s.name || ('ورقة' + (i + 1))) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('');
    const rels = list.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('');
    const stylesId = 'rId' + (list.length + 1);

    files.push({
      name: '[Content_Types].xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        overrides.join('') + '</Types>'
    });
    files.push({
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'
    });
    files.push({
      name: 'xl/workbook.xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<workbookPr/><sheets>' + sheetTags + '</sheets></workbook>'
    });
    files.push({
      name: 'xl/_rels/workbook.xml.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels +
        '<Relationship Id="' + stylesId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>'
    });
    files.push({ name: 'xl/styles.xml', data: STYLES });
    return zip(files);
  }

  function download(filename, sheets, opts){
    try{
      const blob = build(sheets, opts);
      U.download(filename.replace(/\.xlsx?$/i, '') + '.xlsx', blob);
      return true;
    }catch(e){
      console.error('فشل توليد xlsx، سيتم التصدير بصيغة CSV', e);
      const first = Array.isArray(sheets) ? sheets[0] : sheets;
      const rows = (first.rows || []).map((r) => {
        const o = {}; (first.columns || []).forEach((c) => { o[c.title] = r[c.key]; }); return o;
      });
      U.download(filename.replace(/\.xlsx?$/i, '') + '.csv', U.blob(U.toCsv(rows), 'text/csv;charset=utf-8'));
      UI.toast('تم التصدير بصيغة CSV بدلاً من Excel', 'warn', 'تعذّر إنشاء ملف xlsx على هذا المتصفح.');
      return false;
    }
  }

  /* ---------------- قراءة XLSX (للاستيراد) ---------------- */
  async function inflate(bytes){
    if (typeof DecompressionStream === 'function'){
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([bytes]).stream().pipeThrough(ds);
      const buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    }
    throw new Error('المتصفح لا يدعم فك ضغط ملفات Excel');
  }

  async function parse(arrayBuffer){
    const b = new Uint8Array(arrayBuffer);
    const dv = new DataView(arrayBuffer);
    /* البحث عن نهاية الدليل المركزي */
    let eocd = -1;
    for (let i = b.length - 22; i >= 0 && i > b.length - 66000; i--){
      if (dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
    }
    if (eocd < 0) throw new Error('ملف Excel غير صالح');
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const entries = {};
    for (let i = 0; i < count; i++){
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const method = dv.getUint16(off + 10, true);
      const csize = dv.getUint32(off + 20, true);
      const nameLen = dv.getUint16(off + 28, true);
      const extraLen = dv.getUint16(off + 30, true);
      const cmtLen = dv.getUint16(off + 32, true);
      const lho = dv.getUint32(off + 42, true);
      const name = new TextDecoder().decode(b.slice(off + 46, off + 46 + nameLen));
      const lNameLen = dv.getUint16(lho + 26, true);
      const lExtraLen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lNameLen + lExtraLen;
      const raw = b.slice(start, start + csize);
      entries[name] = { method, raw };
      off += 46 + nameLen + extraLen + cmtLen;
    }
    const shared = [];
    if (entries['xl/sharedStrings.xml']){
      const txt = new TextDecoder().decode(entries['xl/sharedStrings.xml'].raw);
      txt.replace(/<si>([\s\S]*?)<\/si>/g, (m, inner) => {
        let s = '';
        inner.replace(/<t[^>]*>([\s\S]*?)<\/t>/g, (mm, t) => { s += t; return ''; });
        shared.push(s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
        return '';
      });
    }
    const sheetKey = Object.keys(entries).find((k) => /^xl\/worksheets\/sheet1\.xml$/.test(k));
    if (!sheetKey) throw new Error('لا توجد ورقة عمل');
    const e = entries[sheetKey];
    const data = e.method === 8 ? await inflate(e.raw) : e.raw;
    const xmlText = new TextDecoder().decode(data);
    const rows = [];
    const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
    let rm;
    while ((rm = rowRe.exec(xmlText)) !== null){
      const cells = {};
      const cellRe = /<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>|<c r="([A-Z]+)\d+"([^>]*)\/>/g;
      let cm;
      while ((cm = cellRe.exec(rm[2])) !== null){
        const col = cm[1] || cm[4];
        const attrs = cm[2] || cm[5] || '';
        const inner = cm[3] || '';
        let val = '';
        const tMatch = /t="([^"]+)"/.exec(attrs);
        const type = tMatch ? tMatch[1] : 'n';
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
        const isMatch = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
        if (type === 'inlineStr' && isMatch) val = isMatch[1];
        else if (type === 's' && vMatch) val = shared[+vMatch[1]] || '';
        else if (vMatch) val = vMatch[1];
        cells[col] = val.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
      }
      rows.push(cells);
    }
    if (!rows.length) return [];
    const head = rows[0];
    const keys = Object.keys(head);
    return rows.slice(1).map((r) => {
      const o = {};
      keys.forEach((k) => { o[String(head[k]).trim()] = r[k] == null ? '' : String(r[k]).trim(); });
      return o;
    }).filter((o) => Object.values(o).some((v) => v !== ''));
  }

  return { build, download, parse, crc32, zip, colName, xml };
})();
