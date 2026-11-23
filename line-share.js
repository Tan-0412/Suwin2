// ════════════════════════════════════════
//  LINE SHARE — ส่งภาพรายงานเข้ากลุ่มไลน์
//  ใช้คู่กับ html2canvas + Apps Script (line-apps-script.gs)
//  ต้องโหลดหลัง app.js (ใช้ scriptUrl, switchTab, toast, thDateFull ฯลฯ)
// ════════════════════════════════════════
(function () {
  const PREF_KEY = 'line_share_pref';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const byId = id => document.getElementById(id);

  // ── รายการรายงานที่เลือกส่งได้ (แก้/เพิ่มได้ที่นี่) ──
  // els() คืน [{el, label}] = ส่วนของหน้าที่จะแคปเป็นรูป 1 รูปต่อ 1 รายการ
  const UNITS = [
    // ── กลุ่มใหม่: สรุปรายงานประจำเดือน (สร้างตารางตามแบบฟอร์ม ไม่ต้องเปิดแท็บ) ──
    { id:'m_bk_s',  grp:'🗓️ สรุปรายงานประจำเดือน', label:'สรุปรายงานลูกค้าจอง (รถเล็ก)',  special:'monthly', kind:'booking', dept:'เล็ก' },
    { id:'m_bk_b',  grp:'🗓️ สรุปรายงานประจำเดือน', label:'สรุปรายงานลูกค้าจอง (รถใหญ่)',  special:'monthly', kind:'booking', dept:'ใหญ่' },
    { id:'m_rel_s', grp:'🗓️ สรุปรายงานประจำเดือน', label:'สรุปรายงานปล่อยรถ (รถเล็ก)',   special:'monthly', kind:'release', dept:'เล็ก' },
    { id:'m_rel_b', grp:'🗓️ สรุปรายงานประจำเดือน', label:'สรุปรายงานปล่อยรถ (รถใหญ่)',   special:'monthly', kind:'release', dept:'ใหญ่' },
    { id:'sums', grp:'📋 สรุปรวมยอดจอง-ปล่อย', label:'ฝ่ายขายรถเล็ก', tab:'summary', body:'sumBodySmall',
      els:() => [{ el: byId('sumCardSmall'), label:'สรุปรวมยอดจอง-ปล่อย · ฝ่ายขายรถเล็ก' }] },
    { id:'sumb', grp:'📋 สรุปรวมยอดจอง-ปล่อย', label:'ฝ่ายขายรถใหญ่', tab:'summary', body:'sumBodyBig',
      els:() => [{ el: byId('sumCardBig'), label:'สรุปรวมยอดจอง-ปล่อย · ฝ่ายขายรถใหญ่' }] },
    { id:'cust', grp:'📋 รายชื่อลูกค้าจอง-ปล่อย', label:'ทุกทีม (แยกรูปตามทีม)', tab:'custlist', body:'clBody',
      readySel:'#clBody .cl-team-block',
      els:() => [...document.querySelectorAll('#clBody .cl-team-block')].map(b => ({
        el: b,
        label: 'รายชื่อลูกค้าจอง-ปล่อย · ' + ((b.querySelector('.cl-dept-bar') || {}).textContent || '').trim()
      })) },
    { id:'rel', grp:'🚗 รายงานปล่อยรถ', label:'ปล่อยรถประจำวันนี้', tab:'release', special:'release' },
  ];

  // ── ตั้งค่าที่จำไว้ในเครื่อง ──
  function loadPref() { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch (e) { return {}; } }
  function savePref(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {} }

  // ── สร้างปุ่ม + modal (ฉีดเข้าหน้าเว็บอัตโนมัติ ไม่ต้องแก้ HTML) ──
  function build() {
    const badge = document.querySelector('.topbar .conn-badge');
    if (badge && !byId('lineShareBtn')) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:14px;';
      badge.parentNode.insertBefore(wrap, badge);
      wrap.appendChild(badge);
      const b = document.createElement('button');
      b.id = 'lineShareBtn';
      b.className = 'btn btn-green btn-sm';
      b.textContent = '📤 ส่งเข้า LINE';
      b.onclick = openLineModal;
      wrap.insertBefore(b, badge);
    }
    if (byId('lineModal')) return;
    const m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'lineModal';
    const groups = {};
    UNITS.forEach(u => { (groups[u.grp] = groups[u.grp] || []).push(u); });
    const list = Object.entries(groups).map(([g, us]) =>
      `<div style="margin-bottom:10px;"><div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:4px;">${g}</div>` +
      us.map(u => `<label style="display:flex;align-items:center;gap:8px;padding:3px 0 3px 8px;font-size:13px;cursor:pointer;">
        <input type="checkbox" class="line-chk" value="${u.id}"> ${u.label}</label>`).join('') + '</div>').join('');
    m.innerHTML = `<div class="modal-box" style="width:min(96vw,460px);">
      <div class="modal-hdr" style="background:linear-gradient(135deg,var(--green),var(--green2));">
        <h3>📤 ส่งภาพรายงานเข้ากลุ่ม LINE</h3><button class="modal-close" onclick="closeLineModal()">✕</button></div>
      <div class="modal-body">
        <div style="font-size:12px;color:var(--gray);margin-bottom:10px;">เลือกรายงานที่จะส่ง (ระบบจะแคปเป็นรูปแล้วส่งตามลำดับ)</div>
        ${list}
        <div class="dvd"></div>
        <div class="frow"><label>รหัสผ่านส่ง LINE (ตั้งใน Apps Script)</label><input type="password" id="lineSecret" autocomplete="off"></div>
        <div id="lineProgress" style="margin-top:10px;font-size:12px;line-height:1.7;max-height:150px;overflow-y:auto;"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline btn-sm" onclick="lineSelectAll(true)">เลือกทั้งหมด</button>
        <button class="btn btn-outline btn-sm" onclick="lineSelectAll(false)">ล้าง</button>
        <button class="btn btn-outline" onclick="closeLineModal()">ปิด</button>
        <button class="btn btn-green" id="lineSendBtn" onclick="runLineShare()">📤 ส่ง</button>
      </div></div>`;
    document.body.appendChild(m);
  }

  window.openLineModal = function () {
    const p = loadPref();
    const sel = p.sel || [];
    document.querySelectorAll('.line-chk').forEach(c => { c.checked = sel.includes(c.value); });
    byId('lineSecret').value = p.secret || '';
    byId('lineProgress').innerHTML = '';
    byId('lineModal').classList.add('open');
  };
  window.closeLineModal = function () { if (!window._lineBusy) byId('lineModal').classList.remove('open'); };
  window.lineSelectAll = function (v) { document.querySelectorAll('.line-chk').forEach(c => { c.checked = v; }); };

  function log(msg, color) {
    const d = document.createElement('div');
    if (color) d.style.color = color;
    d.textContent = msg;
    const box = byId('lineProgress');
    box.appendChild(d); box.scrollTop = box.scrollHeight;
  }

  // ── สร้างตารางรายงานประจำเดือน (ตามแบบฟอร์ม) แล้วคืน element ที่ซ่อนไว้นอกจอ ──
  const COMPANY = { 'เล็ก': 'บริษัท อีซูซุคิงส์ยนต์กรุงเทพ จำกัด สาขาสุวินทวงศ์', 'ใหญ่': 'บริษัท อีซูซุคิงส์ยนต์ จำกัด สาขาสุวินทวงศ์' };
  const esc = v => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const deptOf = r => {
    const sc = ((window.meta || meta || {}).sc || []).find(x => x['ที่ปรึกษาการขาย'] === (r['ที่ปรึกษาการขาย'] || ''));
    return sc ? String(sc['ฝ่าย'] || '') : '';
  };
  const dShow = v => v ? fmtDate(String(v).trim()) : '';

  function buildMonthly(u, allRows, rDate) {
    const ym = rDate.getFullYear() + '-' + String(rDate.getMonth() + 1).padStart(2, '0');
    const isBook = u.kind === 'booking';
    const sizeTxt = u.dept === 'เล็ก' ? 'รถเล็ก' : 'รถใหญ่';
    const title = (isBook ? 'สรุปรายงานลูกค้าจอง' : 'สรุปรายงานปล่อยรถ') + ' (' + sizeTxt + ')';
    const dateKey = isBook ? 'วันที่จอง' : 'วันที่ปล่อย';

    let rows = allRows.filter(r => r[dateKey] && dateMatchMonth(r[dateKey], ym) && deptOf(r).includes(u.dept));
    if (isBook) rows = rows.filter(r => { const st = r['สถานะ']; return isBK(st) || isEBK(st) || isRS(st) || isERS(st); }); // ไม่รวมยกเลิก/มุ่งหวัง
    rows.sort((a, b) => parseThDate(a[dateKey]) - parseThDate(b[dateKey]));

    const cols = isBook
      ? [['#',44],['วันที่จอง',100],['ชื่อลูกค้า',185],['เบอร์โทร',115],['รุ่นรถ',230],['ประเภทรถ',95],['สถานะ',90],['วันที่ปล่อย',100],['ที่ปรึกษาการขาย',165],['ที่มา',110]]
      : [['#',44],['วันที่ปล่อย',100],['ชื่อลูกค้า',175],['รุ่นรถ',225],['เลขเครื่อง',110],['เลขแชสซีส์',180],['ไฟแนนซ์',85],['ป้ายแดง',105],['ที่ปรึกษาการขาย',160],['ที่มา',110]];
    const hdrBg = isBook ? '#6fa8dc' : '#93c47e';
    const width = cols.reduce((a, c) => a + c[1], 0);
    const B = 'border:1.5px solid #000;';
    const tdS = B + 'padding:6px 6px;text-align:center;font-size:15px;height:38px;color:#000;word-break:break-word;';

    const cells = (r, i) => (isBook ? [
      i + 1, dShow(r['วันที่จอง']), r['ชื่อลูกค้า'], r['เบอร์'],
      r['ชื่อรุ่นรถ'] || r['รายละเอียดรถ'], r['รุ่นรถ'],      // ประเภทรถ = ค่า "รุ่น" ในระบบ
      statusLabel(r['สถานะ']), dShow(r['วันที่ปล่อย']), r['ที่ปรึกษาการขาย'], r['ที่มาลูกค้า']
    ] : [
      i + 1, dShow(r['วันที่ปล่อย']), r['ลูกค้ารับรถ'] || r['ชื่อลูกค้า'],
      r['ชื่อรุ่นรถ'] || r['รายละเอียดรถ'], r['เลขเครื่อง'], r['เลขแชสซีส์'],
      r['ไฟแนนซ์'], r['เลขทะเบียน'], r['ที่ปรึกษาการขาย'], r['ที่มาลูกค้า']
    ]);

    // ไม่มีข้อมูล → ตารางว่าง 3 แถว (เหมือนแบบฟอร์ม)
    const body = rows.length
      ? rows.map((r, i) => '<tr>' + cells(r, i).map(v => `<td style="${tdS}">${esc(v)}</td>`).join('') + '</tr>').join('')
      : Array.from({ length: 3 }, () => '<tr>' + cols.map(() => `<td style="${tdS}"></td>`).join('') + '</tr>').join('');

    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-99999px;top:0;z-index:-1;';
    holder.innerHTML = `<div style="width:${width + 24}px;background:#fff;padding:14px 12px 16px;font-family:'Sarabun','Tahoma',sans-serif;color:#000;">
      <div style="text-align:center;font-size:17px;line-height:1.5;">${COMPANY[u.dept]}</div>
      <div style="text-align:center;font-size:26px;font-weight:800;line-height:1.5;">${title}</div>
      <div style="text-align:center;font-size:21px;font-weight:800;line-height:1.5;margin-bottom:14px;">ประจำเดือน ${thMonthYear(ym)}</div>
      <table style="width:${width}px;border-collapse:collapse;table-layout:fixed;">
        <colgroup>${cols.map(c => `<col style="width:${c[1]}px">`).join('')}</colgroup>
        <thead><tr>${cols.map(c => `<th style="${B}background:${hdrBg};padding:6px 4px;font-size:17px;font-weight:700;height:40px;color:#000;">${c[0]}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody>
      </table></div>`;
    document.body.appendChild(holder);
    return { holder, el: holder.firstElementChild, label: title + ' · ประจำเดือน ' + thMonthYear(ym) };
  }

  // ── รอจนรายงานโหลดเสร็จ ──
  async function waitReady(u) {
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      const body = byId(u.body);
      if (body && body.textContent.includes('❌')) throw new Error('โหลดรายงานไม่สำเร็จ');
      const ok = u.readySel ? document.querySelector(u.readySel) : (body && body.querySelector('table'));
      if (ok) { await sleep(300); return; }
      await sleep(250);
    }
    throw new Error('รอโหลดรายงานนานเกินไป');
  }

  // ── แคป element เป็นรูป ──
  async function capture(el) {
    const nodes = [el, ...el.querySelectorAll('.tbl-wrap,.card')];
    const saved = nodes.map(n => [n, n.style.cssText]);
    nodes.forEach(n => { n.style.overflow = 'visible'; });
    try {
      const w = Math.ceil(Math.max(el.scrollWidth, el.offsetWidth));
      const h = Math.ceil(el.scrollHeight);
      const scale = Math.min(2, 3900 / Math.max(w, h)); // LINE จำกัดขนาดภาพราว 4096px
      const canvas = await html2canvas(el, { scale, backgroundColor: '#ffffff', useCORS: true, width: w, height: h, windowWidth: Math.max(w, 1000), logging: false });
      const full = canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
      const ts = Math.min(1, 600 / Math.max(canvas.width, canvas.height));
      const c2 = document.createElement('canvas');
      c2.width = Math.max(1, Math.round(canvas.width * ts)); c2.height = Math.max(1, Math.round(canvas.height * ts));
      c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
      const prev = c2.toDataURL('image/jpeg', 0.7).split(',')[1];
      return { full, prev };
    } finally {
      saved.forEach(([n, css]) => { n.style.cssText = css; });
    }
  }

  // ── ส่งไป Apps Script (POST แบบ text/plain เพื่อเลี่ยง CORS preflight) ──
  async function postGS(payload) {
    const res = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    const text = await res.text();
    let d; try { d = JSON.parse(text); } catch (e) { throw new Error('Apps Script ตอบกลับไม่ใช่ JSON — ตรวจว่า Deploy เวอร์ชันใหม่แล้ว'); }
    if (!d.ok) throw new Error(d.error || 'ส่งไม่สำเร็จ');
    return d;
  }

  // โหลด html2canvas เองตอนกดส่งครั้งแรก (ไม่ต้องใส่ใน index.html)
  function loadH2C() {
    return new Promise((resolve, reject) => {
      if (typeof html2canvas !== 'undefined') return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('โหลด html2canvas ไม่สำเร็จ'));
      document.head.appendChild(s);
    });
  }

  window.runLineShare = async function () {
    if (window._lineBusy) return;
    if (!scriptUrl) { toast('ยังไม่ได้ตั้ง URL Apps Script', 'err'); return; }
    try { await loadH2C(); } catch (e) { toast('❌ ' + e.message, 'err'); return; }
    const sel = [...document.querySelectorAll('.line-chk:checked')].map(c => c.value);
    if (!sel.length) { toast('กรุณาเลือกรายงานอย่างน้อย 1 รายการ', 'err'); return; }
    const secret = byId('lineSecret').value.trim();
    savePref({ sel, secret });

    window._lineBusy = true;
    const btn = byId('lineSendBtn'); btn.disabled = true; btn.textContent = '⏳ กำลังส่ง...';
    byId('lineProgress').innerHTML = '';
    const startTab = (document.querySelector('.tab.active') || {}).id?.replace('tab-', '') || 'booking';
    const dateStr = thDateFull(window._reportDate || new Date());
    let curTab = null, sent = 0, fail = 0, rowsCache = null;
    const rDateM = window._reportDate || new Date();

    // เรียงตามแท็บเพื่อไม่ต้องโหลดซ้ำ
    const units = UNITS.filter(u => sel.includes(u.id));
    for (const u of units) {
      try {
        log('⏳ ' + u.grp + ' · ' + u.label);
        let targets;
        if (u.special === 'monthly') {
          if (!rowsCache) { const d = await callGS({ action: 'getBookings' }); rowsCache = d.data || []; }
          const m = buildMonthly(u, rowsCache, rDateM);
          targets = [{ el: m.el, label: m.label, tmp: m.holder }];
        } else if (u.special === 'release') {
          switchTab('release'); curTab = 'release';
          byId('releaseReportDate').value = formatDateInput(new Date());
          byId('releaseReportMonth').value = '';
          runReleaseReportPage();
          await sleep(300);
          if (!(window._releaseReportList || []).length) { log('— ไม่มีรถปล่อยวันนี้ ข้าม', '#999'); continue; }
          targets = [{ el: byId('releaseReportPreviewCard'), label: 'รายงานปล่อยรถ · ' + dateStr }];
        } else {
          if (curTab !== u.tab) { switchTab(u.tab); curTab = u.tab; }
          await waitReady(u);
          targets = u.els();
        }
        for (const t of targets) {
          if (!t.el) continue;
          try {
            const img = await capture(t.el);
            await postGS({ action: 'lineSendImage', secret, caption: '📊 ' + t.label + '\nณ วันที่ ' + dateStr, image: img.full, preview: img.prev });
            sent++; log('✅ ส่งแล้ว: ' + t.label, '#1a7a4a');
          } finally { if (t.tmp) t.tmp.remove(); }
          await sleep(700);
        }
      } catch (e) {
        fail++; log('❌ ' + u.label + ': ' + e.message, '#c0392b');
      }
    }
    switchTab(startTab);
    window._lineBusy = false;
    btn.disabled = false; btn.textContent = '📤 ส่ง';
    log('เสร็จสิ้น: ส่งสำเร็จ ' + sent + ' รูป' + (fail ? ', ผิดพลาด ' + fail + ' รายการ' : ''));
    toast(fail ? '⚠️ ส่งเสร็จ มีบางรายการผิดพลาด' : '✅ ส่งเข้า LINE แล้ว', fail ? 'warn' : 'ok');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
