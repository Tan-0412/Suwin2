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
    { id:'m_bk',  grp:'🗓️ สรุปรายงานประจำเดือน', label:'สรุปรายงานลูกค้าจอง (รถเล็ก + รถใหญ่ ส่งทั้งชุด)', special:'monthly', kind:'booking', depts:['เล็ก','ใหญ่'] },
    { id:'m_rel', grp:'🗓️ สรุปรายงานประจำเดือน', label:'สรุปรายงานปล่อยรถ (รถเล็ก + รถใหญ่ ส่งทั้งชุด)',   special:'monthly', kind:'release', depts:['เล็ก','ใหญ่'] },
    { id:'sum', grp:'📋 สรุปรวมยอดจอง-ปล่อย', label:'ฝ่ายขายรถเล็กและรถใหญ่ (ส่งทั้งชุด)', tab:'summary', body:['sumBodySmall','sumBodyBig'], fillDate:true,
      els:() => [
        { el: byId('sumCardSmall'), label:'สรุปรวมยอดจอง-ปล่อย · ฝ่ายขายรถเล็ก' },
        { el: byId('sumCardBig'),   label:'สรุปรวมยอดจอง-ปล่อย · ฝ่ายขายรถใหญ่' }
      ],
      intro: d => '📊 สรุปรวมยอดจอง-ปล่อย ฝ่ายขายรถเล็กและรถใหญ่ ณ วันที่ ' + d },
    { id:'cust', grp:'📋 รายชื่อลูกค้าจอง-ปล่อย', label:'ทุกทีม (แยกรูปตามทีม)', tab:'custlist', body:'clBody',
      readySel:'#clBody .cl-team-block',
      els:() => [...document.querySelectorAll('#clBody .cl-team-block')].map(b => ({
        el: b,
        label: 'รายชื่อลูกค้าจอง-ปล่อย · ' + ((b.querySelector('.cl-dept-bar') || {}).textContent || '').trim()
      })),
      intro: d => '📊 รายชื่อลูกค้าจอง-ปล่อย สาขาสุวินทวงศ์ ฝ่ายขายรถเล็กและรถใหญ่ ณ วันที่ ' + d },
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
        <div class="frow"><label>รหัสผ่านส่ง LINE (ตั้งใน Apps Script)</label><input type="text" id="lineSecret" name="line_share_code" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore style="-webkit-text-security:disc;text-security:disc;"></div>
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

  const TH_MONTH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  function buildMonthModal() {
    if (byId('lineMonthModal')) return;
    const m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'lineMonthModal';
    m.innerHTML = `<div class="modal-box" style="width:min(96vw,980px);">
      <div class="modal-hdr" style="background:linear-gradient(135deg,var(--green),var(--green2));">
        <h3>🗓️ เลือกเดือนของสรุปรายงานประจำเดือน</h3></div>
      <div class="modal-body">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
          <b style="font-size:13px;">เดือน</b><select id="lineMonthSel" style="padding:6px 10px;font-size:14px;"></select>
          <b style="font-size:13px;">ปี</b><select id="lineYearSel" style="padding:6px 10px;font-size:14px;"></select>
          <span style="font-size:12px;color:var(--gray);">ตรวจตัวอย่างด้านล่างให้ถูกต้อง แล้วกด “ยืนยันส่ง”</span>
        </div>
        <div id="lineMonthPrev" style="max-height:60vh;overflow:auto;"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" id="lineMonthCancel">ยกเลิก</button>
        <button class="btn btn-green" id="lineMonthOk">✅ ยืนยันส่ง</button>
      </div></div>`;
    document.body.appendChild(m);
  }

  // แสดงตัวอย่างรายงานตามเดือนที่เลือก → resolve {y, m} เมื่อกดยืนยัน หรือ null เมื่อยกเลิก
  function chooseMonth(monthlyUnits, rows) {
    buildMonthModal();
    return new Promise(resolve => {
      const mm = byId('lineMonthModal'), ms = byId('lineMonthSel'), ys = byId('lineYearSel'), box = byId('lineMonthPrev');
      const base = window._reportDate || new Date();
      ms.innerHTML = TH_MONTH_FULL.map((n, i) => `<option value="${i + 1}">${n}</option>`).join('');
      ys.innerHTML = [base.getFullYear(), base.getFullYear() - 1, base.getFullYear() - 2].map(y => `<option value="${y}">${y + 543}</option>`).join('');
      ms.value = base.getMonth() + 1; ys.value = base.getFullYear();
      const render = () => {
        box.innerHTML = '';
        const d = new Date(+ys.value, +ms.value - 1, 1);
        monthlyUnits.forEach(u => u.depts.forEach(dp => {
          const r = buildMonthly({ ...u, dept: dp }, rows, d, base);
          const wrap = document.createElement('div');
          wrap.style.cssText = 'overflow:hidden;border:1px solid #bbb;margin-bottom:10px;background:#fff;';
          box.appendChild(wrap); wrap.appendChild(r.el); r.holder.remove();
          const w = r.el.offsetWidth, h = r.el.offsetHeight, sc = Math.min(1, (box.clientWidth - 4) / w);
          r.el.style.transformOrigin = '0 0'; r.el.style.transform = 'scale(' + sc + ')';
          wrap.style.width = Math.round(w * sc) + 'px'; wrap.style.height = Math.round(h * sc) + 'px';
        }));
      };
      const done = v => { mm.classList.remove('open'); box.innerHTML = ''; resolve(v); };
      ms.onchange = ys.onchange = render;
      byId('lineMonthOk').onclick = () => done({ y: +ys.value, m: +ms.value });
      byId('lineMonthCancel').onclick = () => done(null);
      mm.classList.add('open'); render();
    });
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

  // ── กราฟแท่งเปรียบเทียบรายเดือน (ปีของวันที่รายงาน) — ใช้ div ล้วนเพื่อให้ html2canvas แคปได้ชัวร์ ──
  const TH_MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  // สถานะในระบบเป็นรหัส BK/EBK/RS/ERS/CL/PS (isCL, isPS มาจาก app.js)
  const isCancelSt = r => isCL(r['สถานะ']);      // ยกเลิกจอง
  const isProspectSt = r => isPS(r['สถานะ']);    // มุ่งหวัง

  // series = [{name, color, vals:[12 ค่า]}]
  function buildChart(width, title, series) {
    const H = 190;                                   // ความสูงพื้นที่แท่งสูงสุด (px)
    const max = Math.max(1, ...series.flatMap(s => s.vals));
    const colW = width / 12;
    const barW = Math.max(14, Math.min(34, Math.floor((colW - 14) / series.length)));
    const legend = series.map(s => `<span style="display:inline-block;margin:0 12px;font-size:15px;white-space:nowrap;"><span style="display:inline-block;width:14px;height:14px;background:${s.color};border:1px solid #000;vertical-align:middle;margin-right:6px;"></span>${s.name}</span>`).join('');
    const cols = TH_MON.map((m, i) => {
      const bars = series.map(s => {
        const v = s.vals[i];
        const h = v > 0 ? Math.max(3, Math.round(v / max * H)) : 0;
        return `<div style="width:${barW}px;margin:0 2px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:${H + 22}px;">
          <div style="font-size:14px;font-weight:700;line-height:20px;height:20px;color:${v ? '#000' : '#aaa'};">${v}</div>
          <div style="width:${barW}px;height:${h}px;background:${s.color};${h ? 'border:1px solid #000;border-bottom:0;box-sizing:border-box;' : ''}"></div>
        </div>`;
      }).join('');
      return `<div style="width:${colW}px;text-align:center;">
        <div style="display:flex;justify-content:center;align-items:flex-end;border-bottom:1.5px solid #000;">${bars}</div>
        <div style="font-size:15px;font-weight:700;line-height:26px;height:26px;color:#000;">${m}</div>
      </div>`;
    }).join('');
    return `<div style="width:${width}px;border:1.5px solid #000;box-sizing:border-box;padding:10px 0 6px;margin-bottom:16px;background:#fff;">
      <div style="text-align:center;font-size:18px;font-weight:800;line-height:1.5;">${title}</div>
      <div style="text-align:center;margin:4px 0 8px;">${legend}</div>
      <div style="display:flex;">${cols}</div>
    </div>`;
  }

  // ── รุ่นรถ (ค่า "รุ่น" ในระบบ) แยกตามฝ่าย — แก้/เพิ่มรุ่นได้ที่นี่ ──
  const MODEL_CATS = {
    'เล็ก': [['STD','#6fa8dc'],['SPC','#ffd966'],['CAB 4','#93c47e'],['CAB 4 HR','#e06666'],['MU-X','#b4a7d6']],
    'ใหญ่': [['2T','#6fa8dc'],['3T','#ffd966'],['6W','#93c47e'],['10W (6X2)','#f6b26b'],['10W (6X4)','#e06666'],['12W','#b4a7d6'],['T/H','#76a5af']]
  };
  const MODEL_OTHER = ['อื่นๆ/ไม่ระบุ', '#cccccc'];
  const modelKey = s => String(s == null ? '' : s).replace(/\s+/g, '').toUpperCase();

  // กราฟแท่งซ้อน: แต่ละเดือน 1 แท่ง แบ่งสีตามรุ่น (สัดส่วนรุ่น) · series = [{name,color,vals:[12]}]
  function buildStackedChart(width, title, series, opts) {
    opts = opts || {};
    const H = 190;
    const totals = TH_MON.map((_, i) => series.reduce((a, s) => a + s.vals[i], 0));
    const max = Math.max(1, ...totals);
    const grand = totals.reduce((a, b) => a + b, 0);
    const colW = width / 12;
    const barW = Math.max(30, Math.min(64, Math.floor(colW - 24)));
    const legend = series.map(s => {
      const sum = s.vals.reduce((a, b) => a + b, 0);
      const pct = grand ? Math.round(sum / grand * 100) : 0;
      return `<span style="display:inline-block;margin:0 10px;font-size:15px;white-space:nowrap;"><span style="display:inline-block;width:14px;height:14px;background:${s.color};border:1px solid #000;vertical-align:middle;margin-right:6px;"></span>${s.name} ${sum} คัน (${pct}%)</span>`;
    }).join('');
    const cols = TH_MON.map((m, i) => {
      const t = totals[i];
      const segs = series.slice().reverse().map(s => {      // reverse → รุ่นแรกอยู่ล่างสุด
        const v = s.vals[i];
        if (!v) return '';
        const h = Math.max(3, Math.round(v / max * H));
        return `<div style="width:${barW}px;height:${h}px;background:${s.color};border:1px solid #000;border-bottom:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;line-height:1;color:#000;">${h >= 16 ? v : ''}</div>`;
      }).join('');
      return `<div style="width:${colW}px;text-align:center;">
        <div style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:${H + 24}px;border-bottom:1.5px solid #000;">
          <div style="font-size:14px;font-weight:700;line-height:20px;height:20px;color:${t ? '#000' : '#aaa'};">${t}</div>
          ${segs}
        </div>
        <div style="font-size:15px;font-weight:700;line-height:26px;height:26px;color:#000;">${m}</div>
      </div>`;
    }).join('');
    // ── กล่องสรุปยอดรวมทั้งปี วางในพื้นที่ว่างของกราฟ (หาช่วง 3 เดือนที่แท่งเตี้ยที่สุด เน้นด้านซ้ายก่อน) ──
    const BOX_H = 112, PLOT_H = H + 24, SPAN = 3;
    const free = i => PLOT_H - (Math.round(Math.max(...totals.slice(i, i + SPAN)) / max * H) + 20);
    const starts = [0, 9, 1, 2, 3, 4, 5, 6, 7, 8];
    const pos = starts.find(i => free(i) >= BOX_H + 10);
    const peakI = totals.indexOf(Math.max(...totals));
    const monthsElapsed = Math.max(1, opts.curMonth || 12);
    const topS = series.slice().sort((a, b) => b.vals.reduce((x, y) => x + y, 0) - a.vals.reduce((x, y) => x + y, 0))[0];
    const topSum = topS ? topS.vals.reduce((x, y) => x + y, 0) : 0;
    const stat = (k, v) => `<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:14px;line-height:22px;"><span style="color:#444;">${k}</span><span style="font-weight:700;">${v}</span></div>`;
    const boxInner = `<div style="background:#93c47e;border-bottom:1.5px solid #000;text-align:center;font-size:15px;font-weight:800;line-height:26px;height:26px;">สรุปยอดปล่อยรถ ปี ${opts.yearTh || ''}</div>
      <div style="display:flex;align-items:center;padding:6px 12px 6px;gap:12px;">
        <div style="text-align:center;min-width:84px;border-right:1px solid #999;padding-right:12px;">
          <div style="font-size:40px;font-weight:800;line-height:1.05;">${grand}</div>
          <div style="font-size:14px;font-weight:700;">คัน (รวมทั้งปี)</div>
        </div>
        <div style="flex:1;">
          ${stat('เฉลี่ย/เดือน', (grand / monthsElapsed).toFixed(1) + ' คัน')}
          ${stat('เดือนสูงสุด', grand ? TH_MON[peakI] + ' · ' + totals[peakI] + ' คัน' : '-')}
          ${stat('รุ่นหลัก', topSum ? topS.name + ' · ' + Math.round(topSum / grand * 100) + '%' : '-')}
        </div>
      </div>`;
    const boxW = Math.round(colW * SPAN - 20);
    const box = pos !== undefined
      ? `<div style="position:absolute;left:${Math.round(pos * colW + 10)}px;top:4px;width:${boxW}px;height:${BOX_H}px;background:#fff;border:1.5px solid #000;box-sizing:border-box;overflow:hidden;">${boxInner}</div>`
      : '';
    // ไม่มีพื้นที่ว่างพอ → วางเป็นแถบเต็มความกว้างเหนือกราฟแทน (ไม่บังแท่ง)
    const stripBox = pos === undefined
      ? `<div style="width:${Math.min(420, width - 40)}px;height:${BOX_H}px;margin:0 auto 8px;background:#fff;border:1.5px solid #000;box-sizing:border-box;overflow:hidden;">${boxInner}</div>`
      : '';
    return `<div style="width:${width}px;border:1.5px solid #000;box-sizing:border-box;padding:10px 0 6px;margin-bottom:16px;background:#fff;">
      <div style="text-align:center;font-size:18px;font-weight:800;line-height:1.5;">${title}</div>
      <div style="text-align:center;margin:4px 8px 8px;line-height:1.7;">${legend}</div>
      ${stripBox}
      <div style="display:flex;position:relative;">${cols}${box}</div>
    </div>`;
  }

  function buildMonthly(u, allRows, rDate, asOf) {
    asOf = asOf || rDate;
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

    // ── ข้อมูลกราฟรายเดือนของปีปัจจุบัน (นับทั้งปี ไม่ผูกกับเดือนที่เลือก) ──
    const yr = rDate.getFullYear();
    const deptRows = allRows.filter(r => deptOf(r).includes(u.dept));
    const perMonth = fn => Array.from({ length: 12 }, (_, i) => {
      const ymi = yr + '-' + String(i + 1).padStart(2, '0');
      return fn(deptRows.filter(r => r[dateKey] && dateMatchMonth(r[dateKey], ymi)));
    });
    let series;
    if (isBook) {
      const booked = perMonth(ms => ms.filter(r => !isProspectSt(r)).length);   // ทุกสถานะ ยกเว้นมุ่งหวัง
      const cancel = perMonth(ms => ms.filter(r => !isProspectSt(r) && isCancelSt(r)).length);
      const remain = perMonth(ms => ms.filter(r => !isCancelSt(r)).length);      // คงเหลือ = นับแบบเดียวกับหน้าสรุปเดิม (ตัด CL ออก)
      series = [
        { name: 'ยอดจอง (คัน)',       color: '#6fa8dc', vals: booked },
        { name: 'ยอดยกเลิกจอง (คัน)', color: '#e06666', vals: cancel },
        { name: 'ยอดจองคงเหลือ (ไม่รวมยกเลิก)', color: '#f6b26b', vals: remain }
      ];
    } else {
      // ปล่อยรถ: แท่งซ้อนแยกตามรุ่น (รุ่นที่ไม่อยู่ในรายการ → "อื่นๆ/ไม่ระบุ")
      const cats = MODEL_CATS[u.dept] || [];
      const known = new Set(cats.map(c => modelKey(c[0])));
      const countModel = (ms, c) => ms.filter(r => modelKey(r['รุ่นรถ']) === modelKey(c)).length;
      series = cats.map(c => ({ name: c[0], color: c[1], vals: perMonth(ms => countModel(ms, c[0])) }));
      const other = perMonth(ms => ms.filter(r => !known.has(modelKey(r['รุ่นรถ']))).length);
      if (other.some(v => v > 0)) series.push({ name: MODEL_OTHER[0], color: MODEL_OTHER[1], vals: other });
    }
    const chartHtml = (isBook ? buildChart : buildStackedChart)(width, 'กราฟเปรียบเทียบรายเดือน ปี ' + (yr + 543) + ' · ' + title + (isBook ? '' : ' (แยกตามรุ่น)'), series, { yearTh: yr + 543, curMonth: rDate.getMonth() + 1 });

    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-99999px;top:0;z-index:-1;';
    const asOfBox = `<div style="position:absolute;top:14px;right:12px;border:1.5px solid #6fa8dc;border-radius:12px;padding:6px 18px;font-size:17px;font-weight:700;line-height:1.4;background:#dcecfa;color:#000;white-space:nowrap;">${esc(thDateFull(asOf))}</div>`;
    holder.innerHTML = `<div style="position:relative;width:${width + 24}px;background:#fff;padding:14px 12px 16px;font-family:'Sarabun','Tahoma',sans-serif;color:#000;">
      ${asOfBox}
      <div style="text-align:center;font-size:17px;line-height:1.5;">${COMPANY[u.dept]}</div>
      <div style="text-align:center;font-size:26px;font-weight:800;line-height:1.5;">${title}</div>
      <div style="text-align:center;font-size:21px;font-weight:800;line-height:1.5;margin-bottom:14px;">ประจำเดือน ${thMonthYear(ym)}</div>
      ${chartHtml}
      <table style="width:${width}px;border-collapse:collapse;table-layout:fixed;">
        <colgroup>${cols.map(c => `<col style="width:${c[1]}px">`).join('')}</colgroup>
        <thead><tr>${cols.map(c => `<th style="${B}background:${hdrBg};padding:0;font-size:17px;font-weight:700;height:40px;color:#000;text-align:center;vertical-align:middle;"><div style="display:flex;align-items:center;justify-content:center;text-align:center;min-height:40px;padding:4px;line-height:1.3;">${c[0]}</div></th>`).join('')}</tr></thead>
        <tbody>${body}</tbody>
      </table></div>`;
    document.body.appendChild(holder);
    return { holder, el: holder.firstElementChild, label: title + ' · ประจำเดือน ' + thMonthYear(ym) };
  }

  // ── รอจนรายงานโหลดเสร็จ ──
  async function waitReady(u) {
    const t0 = Date.now();
    const bodies = [].concat(u.body || []).map(byId);
    while (Date.now() - t0 < 40000) {
      if (bodies.some(b => b && b.textContent.includes('❌'))) throw new Error('โหลดรายงานไม่สำเร็จ');
      const ok = u.readySel ? document.querySelector(u.readySel) : (bodies.length && bodies.every(b => b && b.querySelector('table')));
      if (ok) { await sleep(300); return; }
      await sleep(250);
    }
    throw new Error('รอโหลดรายงานนานเกินไป');
  }

  // ── แคป element เป็นรูป ──
  // หากรอบ/ช่องว่างที่มุมขวาบนของการ์ด (เช่น ช่อง input วันที่ที่ html2canvas วาดค่าไม่ออก) แล้วใส่ข้อความวันที่แทนชั่วคราว
  function fillDateFrame(el, text) {
    const er = el.getBoundingClientRect();
    const cands = [...el.querySelectorAll('*')].filter(n => {
      const r = n.getBoundingClientRect();
      if (r.width < 60 || r.height < 14 || r.width > 420 || r.height > 70) return false;
      if (r.top - er.top > 90 || r.right < er.left + er.width * 0.6) return false;
      const field = /^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName);
      return field || (!n.children.length && !(n.textContent || '').trim());
    }).sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right || a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    let n = cands[0];
    const span = document.createElement('div');
    const PILL = 'display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;padding:5px 16px;background:#e4eefb;border:0;border-radius:999px;color:#2a4a7f;font-weight:600;font-size:14px;line-height:1.4;white-space:nowrap;';
    if (n) {
      // ขยายขึ้นไปหาตัวกรอบนอกสุด (ขนาดเล็ก อยู่มุมขวาบน) เพื่อซ่อนทั้งกรอบเดิม ไม่ให้เหลือกรอบซ้อนกัน
      while (n.parentElement && n.parentElement !== el) {
        const pr = n.parentElement.getBoundingClientRect();
        if (pr.width > 460 || pr.height > 80) break;
        n = n.parentElement;
      }
      const r = n.getBoundingClientRect();
      span.style.cssText = PILL + `position:absolute;left:${Math.round(r.left - er.left)}px;top:${Math.round(r.top - er.top + Math.max(0, (r.height - 30) / 2))}px;width:${Math.round(r.width)}px;z-index:5;`;
      span.textContent = text;
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      const old = n.style.visibility;
      n.style.visibility = 'hidden';
      el.appendChild(span);
      return () => { span.remove(); n.style.visibility = old; };
    }
    // ไม่พบกรอบเดิม → วาดกรอบเองที่มุมขวาบน
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    span.style.cssText = PILL + 'position:absolute;top:8px;right:12px;z-index:5;';
    span.textContent = text; el.appendChild(span);
    return () => span.remove();
  }

  async function capture(el, stamp, fillDate) {
    let bar = null, undoFill = null;
    if (stamp) {   // แถบกรอบวันที่มุมขวาบน (ใส่ชั่วคราวระหว่างแคป)
      bar = document.createElement('div');
      bar.style.cssText = 'text-align:right;padding:6px 10px 8px;background:#fff;';
      bar.innerHTML = '<span style="display:inline-block;border:1.5px solid #000;padding:4px 16px;font-size:16px;font-weight:700;color:#000;background:#fff;">' + esc(stamp) + '</span>';
      el.insertBefore(bar, el.firstChild);
    }
    if (fillDate) undoFill = fillDateFrame(el, fillDate);
    const nodes = [el, ...el.querySelectorAll('.tbl-wrap,.card')];
    const saved = nodes.map(n => [n, n.style.cssText]);
    nodes.forEach(n => { n.style.overflow = 'visible'; });
    try {
      const w = Math.ceil(Math.max(el.scrollWidth, el.offsetWidth));
      const h = Math.ceil(el.scrollHeight);
      const m = Math.max(24, Math.round(w * 0.025));          // ขอบว่างซ้าย-ขวาเท่ากัน (px ของหน้าเว็บ)
      const scale = Math.min(2, 3900 / Math.max(w + 2 * m, h)); // LINE จำกัดขนาดภาพราว 4096px
      const inner = await html2canvas(el, { scale, backgroundColor: '#ffffff', useCORS: true, width: w, height: h, windowWidth: Math.max(w, 1000), logging: false });
      const mp = Math.round(m * scale), vp = Math.round(12 * scale);
      const canvas = document.createElement('canvas');
      canvas.width = inner.width + 2 * mp; canvas.height = inner.height + 2 * vp;
      const cx = canvas.getContext('2d');
      cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, canvas.width, canvas.height);
      cx.drawImage(inner, mp, vp);
      const full = canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
      const ts = Math.min(1, 600 / Math.max(canvas.width, canvas.height));
      const c2 = document.createElement('canvas');
      c2.width = Math.max(1, Math.round(canvas.width * ts)); c2.height = Math.max(1, Math.round(canvas.height * ts));
      c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
      const prev = c2.toDataURL('image/jpeg', 0.7).split(',')[1];
      return { full, prev };
    } finally {
      saved.forEach(([n, css]) => { n.style.cssText = css; });
      if (bar) bar.remove();
      if (undoFill) undoFill();
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

    const units = UNITS.filter(u => sel.includes(u.id));
    const monthlyUnits = units.filter(u => u.special === 'monthly');
    let rowsCache = null, monthPick = null;
    if (monthlyUnits.length) {   // รายงานประจำเดือน: เลือกเดือน → ดูตัวอย่าง → ยืนยันส่ง
      try { const d = await callGS({ action: 'getBookings' }); rowsCache = d.data || []; }
      catch (e) { toast('❌ โหลดข้อมูลไม่สำเร็จ: ' + e.message, 'err'); return; }
      monthPick = await chooseMonth(monthlyUnits, rowsCache);
      if (!monthPick) return;
    }

    window._lineBusy = true;
    const btn = byId('lineSendBtn'); btn.disabled = true; btn.textContent = '⏳ กำลังส่ง...';
    byId('lineProgress').innerHTML = '';
    const startTab = (document.querySelector('.tab.active') || {}).id?.replace('tab-', '') || 'booking';
    const dateStr = thDateFull(window._reportDate || new Date());
    let curTab = null, sent = 0, fail = 0, prepared = 0;
    const queue = [];   // ข้อความนำ/ภาพของทุกชุด เรียงตามลำดับที่จะส่ง
    const asOfDate = window._reportDate || new Date();
    const rDateM = monthPick ? new Date(monthPick.y, monthPick.m - 1, 1) : asOfDate;

    for (const u of units) {
      try {
        log('⏳ ' + u.grp + ' · ' + u.label);
        let targets;
        if (u.special === 'monthly') {
          const isBk = u.kind === 'booking';
          const ymM = rDateM.getFullYear() + '-' + String(rDateM.getMonth() + 1).padStart(2, '0');
          targets = u.depts.map(d => {
            const m = buildMonthly({ ...u, dept: d }, rowsCache, rDateM, asOfDate);
            return { el: m.el, label: m.label, tmp: m.holder };
          });
          // กล่องข้อความนำ: ส่งไปพร้อมภาพแรกของชุด ภาพถัดไปไม่มีข้อความซ้ำ
          targets.forEach((t, k) => { t.caption = k === 0
            ? '📊 ' + (isBk ? 'สรุปรายงานลูกค้าจอง' : 'สรุปรายงานปล่อยรถ') + ' ประจำเดือน ' + thMonthYear(ymM) + '\nฝ่ายขายรถเล็ก + รถใหญ่ (' + targets.length + ' ภาพ)'
            : ''; });
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
          if (u.intro) targets.forEach((t, k) => { t.caption = k === 0 ? u.intro(dateStr) : ''; });   // ข้อความนำ ส่งพร้อมภาพแรก
          if (u.stamp) targets.forEach(t => { t.stamp = 'ณ วันที่ ' + dateStr; });
          if (u.fillDate) targets.forEach(t => { t.fillDate = 'ณ วันที่ ' + dateStr; });
        }
        // ถ่ายภาพของชุดนี้ แล้วต่อเข้าคิว: ข้อความนำ → ภาพตามหลัง (ยังไม่ส่ง ส่งรวมทุกชุดทีเดียวตอนท้าย)
        const imgs = [];
        try {
          for (const t of targets) { if (t.el) imgs.push(await capture(t.el, t.stamp, t.fillDate)); }
        } finally { targets.forEach(t => { if (t.tmp) t.tmp.remove(); }); }
        if (!imgs.length) throw new Error('ไม่พบภาพที่จะส่ง');
        const lead = targets[0].caption !== undefined ? targets[0].caption : '📊 ' + targets[0].label + '\nณ วันที่ ' + dateStr;
        if (lead) queue.push({ text: lead });
        imgs.forEach(i => queue.push({ image: i.full, preview: i.prev }));
        prepared += imgs.length;
        log('🖼️ เตรียมภาพแล้ว ' + imgs.length + ' ภาพ: ' + u.label);
      } catch (e) {
        document.querySelectorAll('body > div[style*="-99999px"]').forEach(n => n.remove());
        fail++; log('❌ ' + u.label + ': ' + e.message, '#c0392b');
      }
    }
    // ส่งทุกชุด (ข้อความนำ + ภาพตามหลัง) ในคำขอเดียว
    if (queue.length) {
      try {
        log('⏳ กำลังส่งเข้า LINE ' + prepared + ' ภาพ ...');
        await postGS({ action: 'lineSendBatch', secret, messages: queue });
        sent = prepared; log('✅ ส่งเข้า LINE แล้ว ' + prepared + ' ภาพ (รวมทุกชุดในครั้งเดียว)', '#1a7a4a');
      } catch (e) { fail++; log('❌ ส่งเข้า LINE ไม่สำเร็จ: ' + e.message, '#c0392b'); }
    }
    switchTab(startTab);
    window._lineBusy = false;
    btn.disabled = false; btn.textContent = '📤 ส่ง';
    log('เสร็จสิ้น: ส่งสำเร็จ ' + sent + ' รูป' + (fail ? ', ผิดพลาด ' + fail + ' รายการ' : ''));
    toast(fail ? '⚠️ ส่งเสร็จ มีบางรายการผิดพลาด' : '✅ ส่งเข้า LINE แล้ว', fail ? 'warn' : 'ok');
  };

  // กันเบราว์เซอร์เติมค่าอัตโนมัติลงช่องค้นหา (ถ้ามีค่าเป็น URL ที่เบราว์เซอร์ใส่มา ให้ล้างทิ้ง)
  function guardSearch() {
    ['fSearch', 'r1Search'].forEach(id => {
      const el = byId(id); if (!el) return;
      el.setAttribute('autocomplete', 'off');
      const clr = () => { if (/^https?:\/\//i.test(el.value) && !el._userTyped) { el.value = ''; if (typeof filterBooking === 'function' && id === 'fSearch') filterBooking(); } };
      el.addEventListener('keydown', () => { el._userTyped = true; }, { once: true });
      [0, 300, 1000, 2500].forEach(t => setTimeout(clr, t));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guardSearch); else guardSearch();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
