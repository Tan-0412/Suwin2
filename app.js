// ════════════════════════════════════════
//  STATE
// ════════════════════════════════════════
let scriptUrl = '';
let meta = { sc:[], isuzu:[], model:[], status:[], source:[] };
let allBookings = [];
let filteredBookings = [];
let allTargets = [];
let editingRow = null;
let confirmCallback = null;

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════
function init() {
  const FIXED_URL = 'https://script.google.com/macros/s/AKfycbxr3b1bYEMUlruD3UQNOXXNUtE89iHkwzmJ3V9EFRVDziQq29sOsMSAi3JCpEcXz_tt/exec';
  const saved = localStorage.getItem('booking_app');
  if (saved) {
    try { const s = JSON.parse(saved); scriptUrl = s.url || FIXED_URL; } catch(e) { scriptUrl = FIXED_URL; }
  } else { scriptUrl = FIXED_URL; }
  const params = new URLSearchParams(window.location.search);
  if (params.get('url')) scriptUrl = decodeURIComponent(params.get('url'));
  document.getElementById('gsUrl').value = scriptUrl;
  // ซ่อนแท็บที่ไม่ใช้
  ['tab-report2','tab-report3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  saveSetting();
  setConn(true);
  loadAll();
  updateShareUrl();
  const modalBox = document.querySelector('#bookingModal .modal-box');
  if (modalBox) {
    modalBox.addEventListener('scroll', () => {
      const dd = document.getElementById('mModelCodeDropdown');
      if (dd && dd.style.display !== 'none') _positionModelDropdown();
    });
  }
  window.addEventListener('resize', () => {
    const dd = document.getElementById('mModelCodeDropdown');
    if (dd && dd.style.display !== 'none') _positionModelDropdown();
  });
}

async function loadAll() {
  setConn(null);
  try { await callGS({ action: 'ping' }); setConn(true); } catch(e) { setConn(false); }
  try { await loadMeta(); } catch(e) { console.error('loadMeta:', e); }
  try { await loadBookings(); } catch(e) {
    console.error('loadBookings:', e);
    document.getElementById('bookingBody').innerHTML =
      '<tr><td colspan="11"><div class="empty">❌ โหลดไม่สำเร็จ: ' + e.message + '</div></td></tr>';
  }
  try { await loadTargets(); } catch(e) { console.error('loadTargets:', e); }
  ['r2BodySmall','r2BodyBig','r3BodySmall','r3BodyBig'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div class="empty">กดแท็บนี้เพื่อโหลดรายงาน</div>';
  });
}

// ════════════════════════════════════════
//  TABS
// ════════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + tab).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'report2' && scriptUrl) runReport2();
  if (tab === 'report3' && scriptUrl) runReport3();
  if (tab === 'custlist' && scriptUrl) runCustListReport();
  if (tab === 'summary' && scriptUrl) runSummaryReport();
  if (tab === 'release') initReleaseReportPage();
}

// ════════════════════════════════════════
//  SETUP
// ════════════════════════════════════════
function connectSheet() {
  const url = document.getElementById('gsUrl').value.trim();
  if (!url) { toast('กรุณาใส่ URL', 'err'); return; }
  scriptUrl = url; saveSetting(); setConn(true); loadAll(); updateShareUrl();
  document.getElementById('setupStatus').textContent = '✅ บันทึกแล้ว';
  toast('✅ เชื่อมต่อแล้ว!', 'ok');
}
async function testConn() {
  const url = document.getElementById('gsUrl').value.trim();
  if (!url) { toast('กรุณาใส่ URL', 'err'); return; }
  document.getElementById('setupStatus').textContent = '🔄 กำลังทดสอบ...';
  try {
    const d = await callGS({ action: 'ping' }, url);
    if (d.pong) { document.getElementById('setupStatus').textContent = '✅ เชื่อมต่อได้!'; toast('✅ ผ่าน!', 'ok'); }
    else throw new Error('ไม่ตอบสนอง');
  } catch(e) { document.getElementById('setupStatus').textContent = '❌ ' + e.message; toast('❌ ไม่ได้', 'err'); }
}
function saveSetting() { localStorage.setItem('booking_app', JSON.stringify({ url: scriptUrl })); }
function setConn(ok) {
  const dot = document.getElementById('connDot');
  const lbl = document.getElementById('connLbl');
  if (ok === null) {
    dot.className = 'conn-dot'; dot.style.background = '#f5c842';
    dot.style.animation = 'connPulse .8s infinite alternate'; lbl.textContent = 'กำลังเชื่อมต่อ...';
  } else {
    dot.style.animation = ''; dot.style.background = '';
    dot.className = 'conn-dot ' + (ok ? 'ok' : 'err');
    lbl.textContent = ok ? 'เชื่อมต่อแล้ว' : 'เชื่อมต่อไม่ได้';
  }
}
function resetCache() {
  if (!confirm('ล้างข้อมูล cache ทั้งหมด แล้วรีโหลด?')) return;
  localStorage.removeItem('booking_app'); location.reload();
}

// ════════════════════════════════════════
//  META
// ════════════════════════════════════════
async function loadMeta() {
  if (!scriptUrl) return;
  try {
    const d = await callGS({ action: 'getMeta' });
    meta = d;
    populateDeptFilter();
    populateSel('fSC', meta.sc, 'ที่ปรึกษาการขาย', '', 'ทั้งหมด');
    populateSel('fStatus', meta.status, 'STATUS', 'สถานะ', 'ทั้งหมด');
    populateSel('fModel', meta.isuzu, 'รุ่นรถ', '', 'ทั้งหมด');
    populateSel('mSC', meta.sc, 'ที่ปรึกษาการขาย');
    populateSel('mStatus', meta.status, 'STATUS', 'สถานะ');
    populateSel('mSource', meta.source, 'ที่มาลูกค้า');
    populateBookingFinance();
    ['r1SC','r2SC'].forEach(id => populateSel(id, meta.sc, 'ที่ปรึกษาการขาย', '', 'ทั้งหมด'));
    populateSel('r1Status', meta.status, 'STATUS', 'สถานะ', 'ทั้งหมด');
  } catch(e) { console.error('loadMeta:', e); }
}

function populateSel(id, data, valField, labelField, allLabel) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '';
  if (allLabel) { const o=document.createElement('option');o.value='';o.textContent=allLabel;sel.appendChild(o); }
  data.forEach(item => {
    const val = item[valField] || '';
    const lbl = labelField ? (item[labelField] || val) : val;
    if (!val) return;
    const o=document.createElement('option');o.value=val;o.textContent=lbl||val;sel.appendChild(o);
  });
  if (prev) {
    sel.value = prev;
    if (sel.value !== prev) {
      const opt = [...sel.options].find(o => o.value.trim() === prev.trim());
      if (opt) sel.value = opt.value;
    }
  }
}

function populateDeptFilter() {
  const depts = [...new Set(meta.sc.map(s => s['ฝ่าย']).filter(Boolean))].sort();
  ['fDept','r1Dept'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">ทั้งหมด</option>';
    depts.forEach(d => {
      const o = document.createElement('option');
      o.value = d; o.textContent = d; sel.appendChild(o);
    });
    if (prev) sel.value = prev;
  });
}

function onDeptChange(deptId, scId) {
  const dept = document.getElementById(deptId)?.value || '';
  const scSel = document.getElementById(scId);
  if (!scSel) return;
  const prev = scSel.value;
  scSel.innerHTML = '<option value="">ทั้งหมด</option>';
  const filtered = dept ? meta.sc.filter(s => s['ฝ่าย'] === dept) : meta.sc;
  filtered.forEach(s => {
    const name = s['ที่ปรึกษาการขาย'];
    if (!name) return;
    const o = document.createElement('option');
    o.value = name; o.textContent = name; scSel.appendChild(o);
  });
  if (prev && [...scSel.options].some(o => o.value === prev)) scSel.value = prev;
}

// ════════════════════════════════════════
//  BOOKINGS
// ════════════════════════════════════════
async function loadBookings() {
  if (!scriptUrl) return;
  document.getElementById('bookingBody').innerHTML =
    '<tr><td colspan="11"><div class="loader"><div class="loader-spin"></div><br>กำลังโหลด...</div></td></tr>';
  try {
    const d = await callGS({ action: 'getBookings' });
    allBookings = (d.data || []).map(r => {
      ['วันที่จอง','วันที่ปล่อย'].forEach(col => {
        if (r[col]) {
          const t = parseThDate(String(r[col]));
          if (t) {
            const dt = new Date(t);
            r[col] = String(dt.getDate()).padStart(2,'0')+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+dt.getFullYear();
          }
        }
      });
      return r;
    }).sort((a,b) => parseThDate(b['วันที่จอง']) - parseThDate(a['วันที่จอง']));
    populateMonthFilter();
    filterBooking();
  } catch(e) {
    document.getElementById('bookingBody').innerHTML =
      `<tr><td colspan="11"><div class="empty">❌ ${e.message}</div></td></tr>`;
  }
}

function populateMonthFilter() {
  const months = new Set();
  allBookings.forEach(r => {
    const d = r['วันที่จอง'];
    if (!d) return;
    const p = String(d).split('/');
    if (p.length >= 3) {
      const y = p[2].length === 4 ? p[2] : '20'+p[2];
      months.add(y + '-' + p[1].padStart(2,'0'));
    }
  });
  const TH = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  ['fMonth','r1Month'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">ทั้งหมด</option>';
    [...months].sort().reverse().forEach(ym => {
      const [y, m] = ym.split('-');
      const o = document.createElement('option');
      o.value = ym; o.textContent = TH[parseInt(m)] + ' ' + y; sel.appendChild(o);
    });
    if (prev) sel.value = prev;
  });
}

function filterBooking() {
  const q      = document.getElementById('fSearch').value.toLowerCase();
  const dept   = document.getElementById('fDept').value;
  const sc     = document.getElementById('fSC').value;
  const model  = document.getElementById('fModel').value;
  const status = document.getElementById('fStatus').value;
  const month  = document.getElementById('fMonth').value;
  filteredBookings = allBookings.filter(r => {
    if (dept   && (meta.sc.find(s=>s['ที่ปรึกษาการขาย']===r['ที่ปรึกษาการขาย'])||{})['ฝ่าย'] !== dept) return false;
    if (sc     && r['ที่ปรึกษาการขาย'] !== sc) return false;
    if (model  && r['รุ่นรถ'] !== model) return false;
    if (status && r['สถานะ'] !== status && !(meta.status.find(s=>s['STATUS']===status && s['สถานะ']===r['สถานะ']))) return false;
    if (month  && !dateMatchMonth(r['วันที่จอง'], month)) return false;
    if (q && !Object.values(r).some(v => String(v).toLowerCase().includes(q))) return false;
    return true;
  }).sort((a,b) => parseThDate(b['วันที่จอง']) - parseThDate(a['วันที่จอง']));
  renderBookings();
  updateSummary();
}

function resetFilter() {
  document.getElementById('fSearch').value = '';
  document.getElementById('fDept').value = '';
  onDeptChange('fDept','fSC');
  document.getElementById('fSC').value = '';
  document.getElementById('fModel').value = '';
  document.getElementById('fStatus').value = '';
  document.getElementById('fMonth').value = '';
  filterBooking();
}

function renderBookings() {
  document.getElementById('recCount').textContent = filteredBookings.length + ' รายการ';
  if (filteredBookings.length === 0) {
    document.getElementById('bookingBody').innerHTML = '<tr><td colspan="11"><div class="empty">📭 ไม่พบข้อมูล</div></td></tr>';
    return;
  }
  document.getElementById('bookingBody').innerHTML = filteredBookings.map((r,i) => {
    const sc_code = statusCode(r['สถานะ']);
    const statusBadge = `<span class="badge badge-${sc_code||'BK'}">${statusLabel(r['สถานะ'])}</span>`;
    const alt = i%2===1?'alt':'';
    return `<tr class="${alt}">
      <td style="color:var(--gray);font-size:10px;">${i+1}</td>
      <td class="mono" style="font-size:11px;">${fmtDate(r['วันที่จอง'])}</td>
      <td style="font-weight:600;">${r['ชื่อลูกค้า']||'—'}</td>
      <td class="mono" style="font-size:11px;">${r['เบอร์']||'—'}</td>
      <td style="font-size:11px;max-width:160px;">${r['ชื่อรุ่นรถ']||r['รายละเอียดรถ']||'—'}</td>
      <td><span style="font-weight:700;color:var(--primary2);">${r['รุ่นรถ']||'—'}</span></td>
      <td>${statusBadge}</td>
      <td class="mono" style="font-size:11px;">${r['วันที่ปล่อย']||'—'}</td>
      <td style="font-size:11px;">${r['ที่ปรึกษาการขาย']||'—'}</td>
      <td style="font-size:11px;">${r['ที่มาลูกค้า']||'—'}</td>
      <td class="c">
        <div class="action-btns">
          <button class="btn btn-outline btn-sm" onclick="openEditModal(${i})" title="แก้ไข">✏️</button>
          <button class="btn btn-outline btn-sm"
            style="color:${(r['วันที่ปล่อย']||r['สถานะ']==='ปล่อย'||r['สถานะ']==='RS')?'var(--orange)':'var(--gray)'};border-color:${(r['วันที่ปล่อย']||r['สถานะ']==='ปล่อย'||r['สถานะ']==='RS')?'var(--orange)':'var(--gray2)'};cursor:${(r['วันที่ปล่อย']||r['สถานะ']==='ปล่อย'||r['สถานะ']==='RS')?'pointer':'not-allowed'};opacity:${(r['วันที่ปล่อย']||r['สถานะ']==='ปล่อย'||r['สถานะ']==='RS')?'1':'0.35'};"
            onclick="${(r['วันที่ปล่อย']||r['สถานะ']==='ปล่อย'||r['สถานะ']==='RS')?'openReleaseReport('+i+')':''}"
            title="${(r['วันที่ปล่อย']||r['สถานะ']==='ปล่อย'||r['สถานะ']==='RS')?'บันทึกรายละเอียดการปล่อยรถ':'ต้องบันทึกวันที่ปล่อยหรือสถานะปล่อยก่อน'}">🚗</button>
          <button class="btn btn-red btn-sm" onclick="confirmDelete(${i})" title="ลบ">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function isBK(s)  { return s==='BK'  || s==='จอง'; }
function isEBK(s) { return s==='EBK' || s==='คาดจอง'; }
function isRS(s)  { return s==='RS'  || s==='ปล่อย'; }
function isERS(s) { return s==='ERS' || s==='คาดปล่อย'; }
function isCL(s)  { return s==='CL'  || s==='ยกเลิกจอง'; }
function isPS(s)  { return s==='PS'  || s==='มุ่งหวัง'; }

function updateSummary() {
  const all = filteredBookings.length;
  const bk  = filteredBookings.filter(r => isBK(r['สถานะ'])).length;
  const ebk = filteredBookings.filter(r => isEBK(r['สถานะ'])).length;
  const rs  = filteredBookings.filter(r => isRS(r['สถานะ'])).length;
  const ers = filteredBookings.filter(r => isERS(r['สถานะ'])).length;
  const cl  = filteredBookings.filter(r => isCL(r['สถานะ'])).length;
  document.getElementById('sAll').textContent = all;
  document.getElementById('sBK').textContent  = bk;
  document.getElementById('sEBK').textContent = ebk;
  document.getElementById('sRS').textContent  = rs;
  document.getElementById('sERS').textContent = ers;
  document.getElementById('sCL').textContent  = cl;
  renderSCChart();
}

// ════════════════════════════════════════
//  CHART
// ════════════════════════════════════════
let chartTooltip = null;
let _activeBarSC = null;

function filterByBar(scName) {
  hideChartTooltip();
  if (_activeBarSC === scName) {
    _activeBarSC = null;
    document.getElementById('fSC').value = '';
    document.querySelectorAll('[id^="bar_"]').forEach(el => { el.style.background = ''; el.style.opacity = '1'; });
    filterBooking(); return;
  }
  _activeBarSC = scName;
  const sel = document.getElementById('fSC');
  if (sel) sel.value = scName;
  document.querySelectorAll('[id^="bar_"]').forEach(el => {
    const isSelected = el.id === `bar_${scName.replace(/"/g,'&quot;')}`;
    el.style.background = isSelected ? 'rgba(232,160,32,0.2)' : '';
    el.style.opacity    = isSelected ? '1' : '0.4';
  });
  filterBooking();
  setTimeout(() => {
    document.querySelector('.card:has(#bookingBody)')?.scrollIntoView({behavior:'smooth', block:'start'});
  }, 100);
}

function positionTooltip(e, tip) {
  const margin = 12;
  let x = e.clientX + margin, y = e.clientY + margin;
  const tw = tip.offsetWidth || 200, th = tip.offsetHeight || 100;
  if (x + tw > window.innerWidth - margin) x = e.clientX - tw - margin;
  if (y + th > window.innerHeight - margin) y = e.clientY - th - margin;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}

function hideChartTooltip() {
  if (chartTooltip) { chartTooltip.remove(); chartTooltip = null; }
}

document.addEventListener('mousemove', e => { if (chartTooltip) positionTooltip(e, chartTooltip); });
document.addEventListener('mouseleave', () => hideChartTooltip());

function showBarTip(e, scName) {
  const d = window._chartData && window._chartData[scName];
  if (!d) return;
  showChartTooltipWithHint(e, scName, d.bkModels||[], d.rsModels||[], d.ersModels||[]);
}

function showChartTooltipWithHint(e, sc, bkModels, rsModels, ersModels) {
  hideChartTooltip();
  const tip = document.createElement('div');
  tip.id = 'chartTip';
  tip.style.cssText = `position:fixed;z-index:9999;background:var(--primary);color:#fff;border-radius:12px;padding:12px 14px;font-size:12px;font-family:'Sarabun',sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.25);pointer-events:none;max-width:260px;min-width:180px;line-height:1.6;`;
  let html = `<div style="font-weight:700;font-size:13px;color:var(--accent2);margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:6px;">🧑‍💼 ${sc}</div>`;
  const addSection = (models, label, color) => {
    if (!models.length) return;
    const counts = {};
    models.forEach(m => counts[m]=(counts[m]||0)+1);
    html += `<div style="margin-bottom:6px;"><div style="font-size:10px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">${label} (${models.length})</div>`;
    Object.entries(counts).sort((a,b)=>b[1]-a[1]).forEach(([m,c])=>{
      html+=`<div style="display:flex;justify-content:space-between;gap:12px;"><span>${m}</span><span style="font-weight:700;color:${color};">${c} คัน</span></div>`;
    });
    html += '</div>';
  };
  addSection(bkModels, '📋 จอง', '#7fc5c0');
  addSection(rsModels, '🚗 ปล่อย', '#7fc5c0');
  addSection(ersModels||[], '🟡 คาดปล่อย', '#fde68a');
  if (!bkModels.length && !rsModels.length && !(ersModels&&ersModels.length)) html += `<div style="color:rgba(255,255,255,0.5);">ไม่มีรายการ</div>`;
  html += `<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.15);font-size:10px;color:rgba(245,200,66,0.8);">👆 คลิกเพื่อกรองรายการจอง</div>`;
  tip.innerHTML = html;
  document.body.appendChild(tip);
  chartTooltip = tip;
  positionTooltip(e, tip);
}

function renderSCChart() {
  const chartEl = document.getElementById('scChart');
  if (!chartEl || !meta.sc.length) return;
  window._chartData = {};
  const scData = {};
  meta.sc.forEach(s => {
    const name = s['ที่ปรึกษาการขาย'];
    scData[name] = { bk:0, rs:0, ers:0, bkModels:[], rsModels:[], ersModels:[], ฝ่าย:s['ฝ่าย']||'', ทีม:s['ทีม']||'', ลำดับ:parseInt(s['ลำดับ']||99), ชื่อเล่น:s['ชื่อเล่น']||name, 'ที่ปรึกษาการขาย':name };
  });
  filteredBookings.forEach(r => {
    const sc = r['ที่ปรึกษาการขาย'];
    if (!scData[sc]) scData[sc] = {bk:0,rs:0,ers:0,bkModels:[],rsModels:[],ersModels:[],ฝ่าย:'',ทีม:'',ลำดับ:99,ชื่อเล่น:sc,'ที่ปรึกษาการขาย':sc};
    if (isBK(r['สถานะ'])||isEBK(r['สถานะ'])) { scData[sc].bk++; scData[sc].bkModels.push(r['รุ่นรถ']||'—'); }
    if (isRS(r['สถานะ']))  { scData[sc].rs++;  scData[sc].rsModels.push(r['รุ่นรถ']||'—'); }
    if (isERS(r['สถานะ'])) { scData[sc].ers++; scData[sc].ersModels.push(r['รุ่นรถ']||'—'); }
  });
  window._chartData = scData;
  const sorted = Object.entries(scData).sort((a,b) => a[1].ลำดับ - b[1].ลำดับ);
  if (!sorted.length) { chartEl.innerHTML = '<div class="empty">ไม่มีข้อมูล</div>'; return; }
  const maxVal = Math.max(...sorted.map(([,d]) => Math.max(d.bk, d.rs, d.ers||0)), 1);
  const deptGroups = {};
  sorted.forEach(([sc, d]) => {
    const dept = d.ฝ่าย || 'ไม่ระบุฝ่าย';
    if (!deptGroups[dept]) deptGroups[dept] = [];
    deptGroups[dept].push([sc, d]);
  });
  let html = '<div style="display:flex;gap:0;align-items:flex-end;min-height:160px;position:relative;width:100%;">';
  html += '<div style="position:absolute;inset:0;pointer-events:none;">';
  [0.25,0.5,0.75,1].forEach(pct => {
    const val = Math.round(maxVal * pct);
    const bottom = pct * 85;
    html += `<div style="position:absolute;bottom:${bottom}%;left:0;right:0;border-top:1px dashed rgba(26,58,107,0.1);"></div>`;
    html += `<div style="position:absolute;bottom:${bottom}%;left:0;font-size:9px;color:var(--gray);transform:translateY(50%);width:16px;text-align:right;">${val}</div>`;
  });
  html += '</div>';
  html += '<div style="margin-left:20px;display:flex;gap:0;align-items:flex-end;min-height:140px;flex:1;border-bottom:2px solid var(--gray2);border-left:1px solid var(--gray2);padding:0 8px;">';
  Object.entries(deptGroups).forEach(([dept, members], di) => {
    if (di > 0) html += `<div style="width:2px;background:var(--gray2);align-self:stretch;margin:0 6px;flex-shrink:0;"></div>`;
    html += `<div style="display:flex;flex-direction:column;align-items:stretch;flex:1;">`;
    html += `<div style="font-size:9px;font-weight:700;color:var(--primary);text-align:center;background:rgba(26,58,107,0.06);border-radius:4px 4px 0 0;padding:2px 6px;white-space:nowrap;">${dept}</div>`;
    html += `<div style="display:flex;align-items:flex-end;gap:4px;flex:1;justify-content:space-around;padding:4px 2px 0;">`;
    members.forEach(([sc, d], mi) => {
      if (mi > 0 && d.ทีม !== members[mi-1][1].ทีม) html += `<div style="width:1px;background:var(--gray2);align-self:stretch;margin:0 2px;"></div>`;
      const bkH  = d.bk  > 0 ? Math.max(8, Math.round((d.bk  / maxVal) * 100)) : 0;
      const ersH = (d.ers||0) > 0 ? Math.max(8, Math.round((d.ers / maxVal) * 100)) : 0;
      const rsH  = d.rs  > 0 ? Math.max(8, Math.round((d.rs  / maxVal) * 100)) : 0;
      const safeKey = sc.replace(/"/g,'&quot;');
      html += `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;border-radius:6px;padding:2px;transition:background .15s;" id="bar_${safeKey}" onmouseenter="showBarTip(event,'${safeKey}')" onmouseleave="hideChartTooltip()" onclick="filterByBar('${safeKey}')">
        <div style="display:flex;align-items:flex-end;gap:2px;height:100px;">
          <div style="width:14px;height:${bkH}px;background:#ea6c0a;border-radius:3px 3px 0 0;transition:all .3s;position:relative;">${d.bk>0?`<span style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:700;color:#ea6c0a;white-space:nowrap;">${d.bk}</span>`:''}</div>
          <div style="width:14px;height:${ersH}px;background:#db2777;border-radius:3px 3px 0 0;transition:all .3s;position:relative;">${(d.ers||0)>0?`<span style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:700;color:#db2777;white-space:nowrap;">${d.ers}</span>`:''}</div>
          <div style="width:14px;height:${rsH}px;background:#16a34a;border-radius:3px 3px 0 0;transition:all .3s;position:relative;">${d.rs>0?`<span style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:700;color:#16a34a;white-space:nowrap;">${d.rs}</span>`:''}</div>
        </div>
        <div style="font-size:9px;font-weight:600;color:var(--tx);text-align:center;white-space:nowrap;margin-top:3px;">${d.ชื่อเล่น}</div>
        ${d.ทีม?`<div style="font-size:8px;color:var(--gray);background:${d.ทีม==='A'?'#e8f0ff':'#f0e8ff'};padding:0 4px;border-radius:3px;">ทีม ${d.ทีม}</div>`:''}
      </div>`;
    });
    html += '</div></div>';
  });
  html += '</div></div>';
  chartEl.innerHTML = html;
}

// ════════════════════════════════════════
//  DSC / MODEL TOOLTIPS
// ════════════════════════════════════════
let _dscTip = null;

function showDscTip(e, name, field) {
  const data = window._dscData && window._dscData[name];
  if (!data) return;
  const rows = data[field] || [];
  const labels = { carry:'📋 จองยกมา', ebk:'🔸 คาดว่าจะจอง', bk:'🆕 จองเดือนนี้', rs:'🚗 จองปล่อยเดือนนี้', total:'📊 รวมจองปัจจุบัน', ers:'⏳ คาดว่าจะปล่อย', rsTotal:'✅ ยอดปล่อย', cl:'❌ ถอนจอง' };
  const colors = { carry:'#7b5ea7', ebk:'#e06010', bk:'#2451a0', rs:'#1a7a4a', total:'#1565C0', ers:'#e06010', rsTotal:'#1a7a4a', cl:'#c0392b' };
  if (field.startsWith('src_')) { _showTipRows(e, `🌐 Online · ${field.replace('src_','')} · ${name}`, '#c2185b', rows); return; }
  _showTipRows(e, `${labels[field]||field} · ${name}`, colors[field]||'#1a3a6b', rows);
}

function showModelTipByModel(e, name, field, model) {
  hideDscTip();
  const data = window._modelData && window._modelData[name];
  if (!data) return;
  const rows = field==='bk' ? (data.bkRows && data.bkRows[model])||[] : (data.rsRows && data.rsRows[model])||[];
  const label = field==='bk' ? `📋 จอง · ${model} · ${name}` : `🚗 ปล่อย · ${model} · ${name}`;
  _showTipRows(e, label, field==='bk'?'#3b6fd4':'#2e9e6a', rows);
}

function showModelTip(e, name, field) {
  hideDscTip();
  const data = window._modelData && window._modelData[name];
  if (!data) return;
  const rows = field==='bk' ? (data.bkRows && data.bkRows['_all'])||[] : (data.rsRows && data.rsRows['_all'])||[];
  _showTipRows(e, field==='bk'?`📋 ยอดจอง · ${name}`:`🚗 ยอดปล่อย · ${name}`, field==='bk'?'#3b6fd4':'#2e9e6a', rows);
}

function _showTipRows(e, label, color, rows) {
  hideDscTip();
  const tip = document.createElement('div');
  tip.style.cssText = `position:fixed;z-index:9999;background:var(--primary);color:#fff;border-radius:12px;padding:12px 14px;font-size:12px;font-family:'Sarabun',sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.25);pointer-events:none;max-width:340px;min-width:200px;max-height:320px;overflow-y:auto;`;
  let html = `<div style="font-weight:700;color:${color};margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:6px;position:sticky;top:0;background:var(--primary);">${label} (${rows.length})</div>`;
  if (!rows.length) { html += '<div style="color:rgba(255,255,255,0.5);">ไม่มีรายการ</div>'; }
  else {
    rows.forEach(r => {
      if (typeof r === 'object' && r !== null) {
        html += `<div style="display:flex;align-items:baseline;gap:8px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
          <span style="font-size:10px;color:rgba(255,255,255,0.45);white-space:nowrap;flex-shrink:0;">${r.date||'—'}</span>
          <span style="flex:1;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.name||'—'}</span>
          <span style="font-size:11px;background:rgba(255,255,255,0.12);padding:1px 7px;border-radius:8px;flex-shrink:0;color:#f5c842;">${r.model||'—'}</span>
        </div>`;
      } else { html += `<div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.08);line-height:1.5;">${r}</div>`; }
    });
  }
  tip.innerHTML = html;
  document.body.appendChild(tip);
  _dscTip = tip;
  setTimeout(() => {
    if (!tip.parentNode) return;
    const margin=12;
    let x=e.clientX+margin, y=e.clientY+margin;
    if (x+tip.offsetWidth>window.innerWidth-margin) x=e.clientX-tip.offsetWidth-margin;
    if (y+tip.offsetHeight>window.innerHeight-margin) y=e.clientY-tip.offsetHeight-margin;
    tip.style.left=x+'px'; tip.style.top=y+'px';
  }, 0);
}

function hideDscTip() { if (_dscTip) { _dscTip.remove(); _dscTip = null; } }

// ════════════════════════════════════════
//  MODEL CODE DROPDOWN
// ════════════════════════════════════════
let _modelCodeBlurTimer = null;

function _getModelField(r, ...keys) {
  for (const k of keys) { if (r[k] !== undefined && r[k] !== '') return String(r[k]); }
  return '';
}

function _positionModelDropdown() {
  const inp = document.getElementById('mModelCode');
  const dd  = document.getElementById('mModelCodeDropdown');
  if (!inp || !dd) return;
  const rect = inp.getBoundingClientRect();
  dd.style.left = rect.left + 'px';
  dd.style.top  = (rect.bottom + 2) + 'px';
  dd.style.width = rect.width + 'px';
}

function onModelCodeInput() { renderModelCodeDropdown(document.getElementById('mModelCode').value.trim().toLowerCase()); }
function onModelCodeFocus() { renderModelCodeDropdown(document.getElementById('mModelCode').value.trim().toLowerCase()); }
function onModelCodeBlur()  { _modelCodeBlurTimer = setTimeout(() => { document.getElementById('mModelCodeDropdown').style.display = 'none'; }, 200); }

function renderModelCodeDropdown(q) {
  const dd = document.getElementById('mModelCodeDropdown');
  if (!meta.model || meta.model.length === 0) { dd.style.display = 'none'; return; }
  const rows = q
    ? meta.model.filter(r => {
        const code = _getModelField(r,'รหัสรุ่นรถ').toLowerCase();
        const name = _getModelField(r,'ชื่อรุ่นรถ').toLowerCase();
        const desc = _getModelField(r,'รายละเอียดรถ','รายละเอียด').toLowerCase();
        const grp  = _getModelField(r,'รุ่นรถ').toLowerCase();
        return code.includes(q) || name.includes(q) || desc.includes(q) || grp.includes(q);
      })
    : meta.model.slice(0, 80);
  if (rows.length === 0) {
    dd.innerHTML = '<div style="padding:10px 14px;color:var(--gray);font-size:12px;">ไม่พบรายการที่ตรงกัน</div>';
    _positionModelDropdown(); dd.style.display = ''; return;
  }
  dd.innerHTML = rows.map(r => {
    const code = _getModelField(r,'รหัสรุ่นรถ');
    const name = _getModelField(r,'ชื่อรุ่นรถ');
    const desc = _getModelField(r,'รายละเอียดรถ','รายละเอียด');
    const grp  = _getModelField(r,'รุ่นรถ');
    return `<div onclick="selectModelCode('${escHtml(code)}','${escHtml(name)}','${escHtml(desc)}','${escHtml(grp)}')"
      style="padding:9px 14px;cursor:pointer;border-bottom:1px solid #edf0f7;line-height:1.5;"
      onmouseenter="this.style.background='#f0f5ff'" onmouseleave="this.style.background=''">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-weight:700;color:var(--primary);font-family:'IBM Plex Mono',monospace;font-size:11px;flex-shrink:0;">${code}</span>
        ${name?`<span style="color:var(--tx2);font-size:11px;flex-shrink:0;">${name}</span>`:''}
        ${desc?`<span style="color:var(--tx);font-size:12px;">${desc}</span>`:''}
        ${grp?`<span style="font-size:10px;background:#e8f0ff;color:#2451a0;padding:1px 7px;border-radius:8px;flex-shrink:0;">${grp}</span>`:''}
      </div>
    </div>`;
  }).join('');
  _positionModelDropdown(); dd.style.display = '';
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/'/g,'&#39;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function selectModelCode(code, name, desc, grp) {
  clearTimeout(_modelCodeBlurTimer);
  document.getElementById('mModelCode').value = code;
  document.getElementById('mModelName').value = name;
  document.getElementById('mDetail').value    = desc;
  document.getElementById('mModel').value     = grp;
  document.getElementById('mModelCodeDropdown').style.display = 'none';
}

function onModelChange() {}
function onDetailModelChange() {}

// ════════════════════════════════════════
//  ADD / EDIT MODAL
// ════════════════════════════════════════
let _prevStatusBeforeEdit = '';

function openAddModal() {
  editingRow = null;
  document.getElementById('modalTitle').textContent = '➕ เพิ่มรายการจอง';
  document.getElementById('mDate').value      = formatDateInput(new Date());
  document.getElementById('mName').value      = '';
  document.getElementById('mFinance').value   = '';
  document.getElementById('mPhone').value     = '';
  document.getElementById('mModel').value     = '';
  document.getElementById('mDetail').value    = '';
  document.getElementById('mModelCode').value = '';
  document.getElementById('mModelName').value = '';
  document.getElementById('mRelDate').value   = '';
  document.getElementById('mModelCodeDropdown').style.display = 'none';
  if (meta.status.length) document.getElementById('mStatus').value = 'BK';
  document.getElementById('bookingModal').classList.add('open');
  _prevStatusBeforeEdit = '';
}

function openEditModal(i) {
  const r = filteredBookings[i];
  if (!r) { toast('ไม่พบข้อมูลแถวนี้', 'err'); return; }
  editingRow = r._row || null;
  if (!editingRow) { toast('❌ ไม่พบเลขแถว (_row)', 'err'); return; }
  document.getElementById('modalTitle').textContent = '✏️ แก้ไขรายการจอง';
  document.getElementById('mDate').value    = thToInputDate(r['วันที่จอง']);
  document.getElementById('mName').value    = r['ชื่อลูกค้า'] || '';
  setSelectValue('mFinance', r['ไฟแนนซ์'] || '');
  document.getElementById('mPhone').value   = r['เบอร์'] || '';
  document.getElementById('mDetail').value  = r['รายละเอียดรถ'] || '';
  document.getElementById('mRelDate').value = thToInputDate(r['วันที่ปล่อย'] || '');
  document.getElementById('mModel').value   = r['รุ่นรถ'] || '';
  const savedCode = r['รหัสรุ่นรถ'] || '';
  document.getElementById('mModelCode').value = savedCode;
  const savedName = r['ชื่อรุ่นรถ'] || '';
  if (savedName) { document.getElementById('mModelName').value = savedName; }
  else if (savedCode && meta.model) {
    const found = meta.model.find(m => m['รหัสรุ่นรถ'] === savedCode);
    document.getElementById('mModelName').value = found ? (found['ชื่อรุ่นรถ'] || '') : '';
  } else { document.getElementById('mModelName').value = ''; }
  document.getElementById('mModelCodeDropdown').style.display = 'none';
  setSelectValue('mSC', r['ที่ปรึกษาการขาย'] || '');
  const rawStatus = r['สถานะ'] || '';
  const statusMatch = meta.status.find(s => s['STATUS'] === rawStatus || s['สถานะ'] === rawStatus);
  const statusVal = statusMatch ? statusMatch['STATUS'] : rawStatus;
  setSelectValue('mStatus', statusVal);
  setSelectValue('mSource', r['ที่มาลูกค้า'] || '');
  document.getElementById('bookingModal').classList.add('open');
  _prevStatusBeforeEdit = statusVal;
}

function setSelectValue(id, val) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.value = val;
  if (sel.value !== val) {
    const opt = [...sel.options].find(o => o.value.trim() === val.trim());
    if (opt) sel.value = opt.value;
  }
}

function closeModal() {
  document.getElementById('bookingModal').classList.remove('open');
  document.getElementById('mModelCodeDropdown').style.display = 'none';
  _isSaving = false;
  const saveBtn = document.querySelector('#bookingModal .modal-footer .btn-primary');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 บันทึก'; }
}

let _isSaving = false;

function onRelDateChange() {
  const relDate = document.getElementById('mRelDate').value;
  if (!relDate) return;
  const statusSel = document.getElementById('mStatus');
  const cur = statusSel.value;
  if (cur === 'BK' || cur === 'จอง' || cur === 'ERS' || cur === 'คาดปล่อย') {
    for (let i = 0; i < statusSel.options.length; i++) {
      const v = statusSel.options[i].value, t = statusSel.options[i].text;
      if (v === 'RS' || t === 'ปล่อย') { statusSel.value = statusSel.options[i].value; break; }
    }
  }
}

async function saveBooking() {
  if (_isSaving) { toast('⏳ กำลังบันทึกข้อมูลอยู่', 'warn'); return; }
  const date = document.getElementById('mDate').value;
  const name = document.getElementById('mName').value.trim();
  const sc   = document.getElementById('mSC').value;
  const modelCode = document.getElementById('mModelCode').value.trim();
  const status = document.getElementById('mStatus').value;
  if (!date || !name || !sc || !modelCode || !status) { toast('กรุณากรอกข้อมูลที่จำเป็น (*)', 'err'); return; }
  const isCancelStatus = (status === 'CL' || status === 'ยกเลิกจอง');
  const wasCancel      = (_prevStatusBeforeEdit === 'CL' || _prevStatusBeforeEdit === 'ยกเลิกจอง');
  if (isCancelStatus && !wasCancel && editingRow) { openCancelDateModal(); return; }
  const isReleaseStatus = (status === 'RS' || status === 'ปล่อย');
  const wasRelease      = (_prevStatusBeforeEdit === 'RS' || _prevStatusBeforeEdit === 'ปล่อย');
  const hasRelDate      = document.getElementById('mRelDate').value.trim() !== '';
  if (isReleaseStatus && !wasRelease && !hasRelDate && editingRow) { openReleaseDateModal(); return; }
  await _doSaveBooking('', '');
}

function openReleaseDateModal() {
  document.getElementById('releaseDateInput').value = formatDateInput(new Date());
  document.getElementById('releaseDateError').style.display = 'none';
  document.getElementById('releaseDateModal').classList.add('open');
}
function closeReleaseDateModal() {
  document.getElementById('releaseDateModal').classList.remove('open');
  const statusSel = document.getElementById('mStatus');
  if (statusSel) {
    const opt = [...statusSel.options].find(o => o.value === _prevStatusBeforeEdit);
    statusSel.value = opt ? _prevStatusBeforeEdit : (statusSel.options[0]?.value || '');
  }
}
async function confirmReleaseDate() {
  const releaseDate = document.getElementById('releaseDateInput').value;
  if (!releaseDate) { document.getElementById('releaseDateError').style.display = 'block'; return; }
  document.getElementById('releaseDateError').style.display = 'none';
  document.getElementById('releaseDateModal').classList.remove('open');
  document.getElementById('mRelDate').value = releaseDate;
  await _doSaveBooking('', '');
}
function openCancelDateModal() {
  document.getElementById('cancelDateInput').value = formatDateInput(new Date());
  document.getElementById('cancelDateError').style.display = 'none';
  document.getElementById('cancelDateModal').classList.add('open');
}
function closeCancelDateModal() {
  document.getElementById('cancelDateModal').classList.remove('open');
  const statusSel = document.getElementById('mStatus');
  if (statusSel) {
    const opt = [...statusSel.options].find(o => o.value === _prevStatusBeforeEdit);
    statusSel.value = opt ? _prevStatusBeforeEdit : (statusSel.options[0]?.value || '');
  }
}
async function confirmCancelDate() {
  const cancelDate = document.getElementById('cancelDateInput').value;
  if (!cancelDate) { document.getElementById('cancelDateError').style.display = 'block'; return; }
  document.getElementById('cancelDateError').style.display = 'none';
  document.getElementById('cancelDateModal').classList.remove('open');
  await _doSaveBooking(formatThDate(cancelDate), '');
}

async function _doSaveBooking(cancelDateThai, relDateOverride) {
  const date = document.getElementById('mDate').value;
  const name = document.getElementById('mName').value.trim();
  const sc   = document.getElementById('mSC').value;
  const modelCode = document.getElementById('mModelCode').value.trim();
  const status = document.getElementById('mStatus').value;
  _isSaving = true;
  const saveBtn = document.querySelector('#bookingModal .modal-footer .btn-primary');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ กำลังบันทึก...'; }
  const statusFound = (meta.status || []).find(s => s['STATUS'] === status);
  const statusThai  = (statusFound && statusFound['สถานะ']) ? statusFound['สถานะ'] : status;
  const relDateVal  = relDateOverride !== '' ? relDateOverride : formatThDate(document.getElementById('mRelDate').value);
  const params = {
    'วันที่จอง': formatThDate(date), 'ชื่อลูกค้า': name,
    'เบอร์': document.getElementById('mPhone').value.trim(),
    'รหัสรุ่นรถ': modelCode,
    'ชื่อรุ่นรถ': document.getElementById('mModelName').value.trim(),
    'รายละเอียดรถ': document.getElementById('mDetail').value.trim(),
    'รุ่นรถ': document.getElementById('mModel').value.trim(),
    'สถานะ': statusThai, 'วันที่ปล่อย': relDateVal,
    'ที่ปรึกษาการขาย': sc,
    'ที่มาลูกค้า': document.getElementById('mSource').value,
    'ไฟแนนซ์': document.getElementById('mFinance').value,
    'วันที่ยกเลิกจอง': cancelDateThai,
  };
  try {
    let r;
    if (editingRow) {
      const rowNum = parseInt(editingRow);
      if (!rowNum || rowNum < 2) { toast('❌ เลขแถวไม่ถูกต้อง', 'err'); _isSaving = false; if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 บันทึก'; } return; }
      r = await callGS({ action: 'updateBooking', _row: rowNum, ...params });
    } else { r = await callGS({ action: 'addBooking', ...params }); }
    if (r && r.ok) {
      toast(editingRow ? '✅ แก้ไขสำเร็จ!' : '✅ เพิ่มรายการสำเร็จ!', 'ok');
      closeModal(); await loadBookings();
    } else { throw new Error((r && r.error) || 'ไม่สำเร็จ'); }
  } catch(e) { toast('❌ ' + e.message, 'err'); }
  finally { _isSaving = false; if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 บันทึก'; } }
}

function confirmDelete(i) {
  const r = filteredBookings[i];
  showConfirm('🗑️','ยืนยันการลบ',`ลบรายการจองของ "${r['ชื่อลูกค้า']}" ใช่ไหม?`,
    async () => {
      try {
        const d = await callGS({ action:'deleteBooking', _row: r._row });
        if (d.ok) { toast('✅ ลบแล้ว', 'ok'); await loadBookings(); }
        else throw new Error(d.error||'ไม่สำเร็จ');
      } catch(e) { toast('❌ '+e.message, 'err'); }
    }
  );
}

// ════════════════════════════════════════
//  TARGETS
// ════════════════════════════════════════
async function loadTargets() {
  if (!scriptUrl) return;
  try { const d = await callGS({ action: 'getTargets' }); allTargets = d.data || []; renderTargets(); } catch(e) {}
}
function renderTargets() {
  if (allTargets.length === 0) { document.getElementById('targetBody').innerHTML = '<tr><td colspan="4"><div class="empty">📭 ยังไม่มีข้อมูลเป้า</div></td></tr>'; return; }
  document.getElementById('targetBody').innerHTML = allTargets.map((r,i) => `
    <tr class="${i%2===1?'alt':''}">
      <td style="color:var(--gray);font-size:10px;">${i+1}</td>
      <td style="font-weight:600;">${r['เดือน']||'—'}</td>
      <td class="r" style="font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--primary);">${parseInt(r['เป้าการจำหน่าย']||0).toLocaleString()}</td>
      <td class="c"><div class="action-btns"><button class="btn btn-red btn-sm" onclick="confirmDeleteTarget(${i})">🗑️</button></div></td>
    </tr>`).join('');
}
function openTargetModal() {
  const now = new Date();
  document.getElementById('tMonth').value = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('tTarget').value = '';
  document.getElementById('targetModal').classList.add('open');
}
function closeTargetModal() { document.getElementById('targetModal').classList.remove('open'); }
async function saveTarget() {
  const month = document.getElementById('tMonth').value;
  const target = document.getElementById('tTarget').value;
  if (!month || !target) { toast('กรุณากรอกข้อมูลให้ครบ', 'err'); return; }
  const [y, m] = month.split('-');
  const TH_MONTHS = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const label = `${TH_MONTHS[parseInt(m)]} ${parseInt(y)}`;
  try {
    const r = await callGS({ action:'saveTarget', 'เดือน': label, 'เป้าการจำหน่าย': target });
    if (r.ok) { toast('✅ บันทึกเป้าแล้ว', 'ok'); closeTargetModal(); await loadTargets(); }
    else throw new Error(r.error||'ไม่สำเร็จ');
  } catch(e) { toast('❌ '+e.message, 'err'); }
}
function confirmDeleteTarget(i) {
  const r = allTargets[i];
  showConfirm('🗑️','ยืนยันการลบ',`ลบเป้าเดือน "${r['เดือน']}" ใช่ไหม?`, async () => {
    try {
      const d = await callGS({ action:'deleteTarget', _row: r._row || (i+2) });
      if (d.ok) { toast('✅ ลบแล้ว','ok'); await loadTargets(); }
      else throw new Error(d.error||'ไม่สำเร็จ');
    } catch(e) { toast('❌ '+e.message,'err'); }
  });
}

// ════════════════════════════════════════
//  REPORT 1
// ════════════════════════════════════════
function clearReport1() {
  document.getElementById('r1Dept').value = '';
  onDeptChange('r1Dept','r1SC');
  document.getElementById('r1SC').value = '';
  document.getElementById('r1Month').value = '';
  document.getElementById('r1DateFrom').value = '';
  document.getElementById('r1DateTo').value = '';
  document.getElementById('r1Status').value = '';
  const s = document.getElementById('r1Search'); if(s) s.value = '';
  document.getElementById('r1Body').innerHTML = '<tr><td colspan="10"><div class="empty">เลือกเงื่อนไขแล้วกด ค้นหา</div></td></tr>';
  document.getElementById('r1Count').textContent = '0 รายการ';
  document.getElementById('r1Title').textContent = 'รายงานรายละเอียดการจอง';
  window._r1FilterState = null;
}

async function runReport1() {
  const dept1    = document.getElementById('r1Dept').value;
  const sc       = document.getElementById('r1SC').value;
  const month    = document.getElementById('r1Month').value;
  const dateFrom = document.getElementById('r1DateFrom').value;
  const dateTo   = document.getElementById('r1DateTo').value;
  const status   = document.getElementById('r1Status').value;
  const search   = (document.getElementById('r1Search')?.value||'').trim().toLowerCase();
  document.getElementById('r1Body').innerHTML = '<tr><td colspan="10"><div class="loader"><div class="loader-spin"></div><br>กำลังโหลด...</div></td></tr>';
  let rows = [...(allBookings || [])];
  if (rows.length === 0) {
    try {
      const d = await callGS({ action: 'getBookings' });
      rows = (d.data || []).map(r => {
        ['วันที่จอง','วันที่ปล่อย'].forEach(col => {
          if (r[col]) { const t = parseThDate(String(r[col])); if (t) { const dt = new Date(t); r[col] = String(dt.getDate()).padStart(2,'0')+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+dt.getFullYear(); } }
        });
        return r;
      });
    } catch(e) { document.getElementById('r1Body').innerHTML = `<tr><td colspan="10"><div class="empty">❌ ${e.message}</div></td></tr>`; return; }
  }
  if (dept1) rows = rows.filter(r => { const scObj = meta.sc.find(s => s['ที่ปรึกษาการขาย'] === r['ที่ปรึกษาการขาย']); return scObj && scObj['ฝ่าย'] === dept1; });
  if (sc) rows = rows.filter(r => r['ที่ปรึกษาการขาย'] === sc);
  if (status) rows = rows.filter(r => { const code = statusCode(r['สถานะ']); return code === status || r['สถานะ'] === status; });
  if (month) {
    const [ym_y, ym_m] = month.split('-');
    rows = rows.filter(r => { const parts = String(r['วันที่จอง']||'').split('/'); if (parts.length >= 3) return parts[2].substring(0,4) === ym_y && parts[1].padStart(2,'0') === ym_m; return false; });
  }
  if (dateFrom) { const [fy,fm,fd] = dateFrom.split('-').map(Number); const fromTs = new Date(fy,fm-1,fd,0,0,0).getTime(); rows = rows.filter(r => { const t = parseThDate(String(r['วันที่จอง']||'')); return t && t >= fromTs; }); }
  if (dateTo)   { const [ty,tm,td2] = dateTo.split('-').map(Number); const toTs = new Date(ty,tm-1,td2,23,59,59).getTime(); rows = rows.filter(r => { const t = parseThDate(String(r['วันที่จอง']||'')); return t && t <= toTs; }); }
  if (search) rows = rows.filter(r => [r['ชื่อลูกค้า'],r['ที่ปรึกษาการขาย'],r['รุ่นรถ'],r['รายละเอียดรถ'],r['วันที่ปล่อย'],r['ที่มาลูกค้า'],r['เบอร์']].join(' ').toLowerCase().includes(search));
  rows = rows.sort((a,b) => parseThDate(b['วันที่จอง']) - parseThDate(a['วันที่จอง']));
  const TH_M = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const parts2 = [];
  if (dept1) parts2.push(dept1); if (sc) parts2.push(sc);
  if (month) { const [y,m] = month.split('-'); parts2.push(TH_M[parseInt(m)]+' '+y); }
  document.getElementById('r1Title').textContent = 'รายงานรายละเอียดการจอง' + (parts2.length ? ' · '+parts2.join(' · ') : '');
  document.getElementById('r1Count').textContent = rows.length + ' รายการ';
  window._r1FilterState = { dept: dept1, sc, month, dateFrom, dateTo, status, search };
  if (rows.length === 0) { document.getElementById('r1Body').innerHTML = '<tr><td colspan="10"><div class="empty">📭 ไม่พบข้อมูล</div></td></tr>'; return; }
  document.getElementById('r1Body').innerHTML = rows.map((r,i) => `
    <tr class="${i%2===1?'alt':''}">
      <td style="color:var(--gray);font-size:10px;">${i+1}</td>
      <td class="mono" style="font-size:11px;">${fmtDate(r['วันที่จอง'])}</td>
      <td style="font-weight:600;">${r['ชื่อลูกค้า']||'—'}</td>
      <td class="mono" style="font-size:11px;">${r['เบอร์']||'—'}</td>
      <td style="font-size:11px;">${r['รายละเอียดรถ']||'—'}</td>
      <td style="font-weight:700;color:var(--primary2);">${r['รุ่นรถ']||'—'}</td>
      <td><span class="badge badge-${statusCode(r['สถานะ'])}">${statusLabel(r['สถานะ'])}</span></td>
      <td class="mono" style="font-size:11px;">${fmtDate(r['วันที่ปล่อย'])||'—'}</td>
      <td style="font-size:11px;">${r['ที่ปรึกษาการขาย']||'—'}</td>
      <td style="font-size:11px;">${r['ที่มาลูกค้า']||'—'}</td>
    </tr>`).join('');
}

// ════════════════════════════════════════
//  REPORT 2
// ════════════════════════════════════════
async function runReport2() {
  ['r2BodySmall','r2BodyBig'].forEach(id => { document.getElementById(id).innerHTML = '<div class="loader"><div class="loader-spin"></div><br>กำลังโหลด...</div>'; });
  try {
    const d = await callGS({ action:'getBookings' });
    const rows = d.data || [];
    const now = new Date();
    const curYM = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const today = now.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
    const monthLabel = thMonth(curYM);
    const scSmall = meta.sc.filter(s => (s['ฝ่าย']||'').includes('เล็ก'));
    const scBig   = meta.sc.filter(s => (s['ฝ่าย']||'').includes('ใหญ่'));
    renderModelReport('small', scSmall, rows, monthLabel, today, curYM);
    renderModelReport('big',   scBig,   rows, monthLabel, today, curYM);
  } catch(e) {
    ['r2BodySmall','r2BodyBig'].forEach(id => { document.getElementById(id).innerHTML = `<div class="empty">❌ ${e.message}</div>`; });
  }
}

function renderModelReport(type, scList, rows, monthLabel, today, curYM) {
  const suffix = type === 'small' ? 'Small' : 'Big';
  const bodyEl  = document.getElementById('r2Body' + suffix);
  const titleEl = document.getElementById('r2Title' + suffix);
  const subEl   = document.getElementById('r2Sub' + suffix);
  const deptName = type === 'small' ? 'ฝ่ายขายรถเล็ก' : 'ฝ่ายขายรถใหญ่';
  const reportDate = window._reportDate || new Date();
  const titleDate  = thDateFull(reportDate);
  const titleMonth = thMonthYear(curYM);
  titleEl.innerHTML = `<span style="font-size:16px;font-weight:800;">รายงานยอดจองและปล่อยรถ ประจำเดือน ${titleMonth}</span> &nbsp;<span style="font-size:13px;font-weight:700;color:#2a5cb8;">📊 ${deptName}</span>`;
  subEl.textContent = `แยกประเภทตามกลุ่มรถ`;
  const badgeEl = document.getElementById('r2DateBadge' + suffix);
  if(badgeEl) badgeEl.innerHTML = `<span class="date-badge-r2"><span class="lbl">ณ วันที่</span><span class="val">${titleDate}</span></span>`;
  if (!scList.length) { bodyEl.innerHTML = '<div class="empty">ไม่มี SC ในฝ่ายนี้</div>'; return; }
  const groupFilter = type === 'small' ? 'รถเล็ก' : 'รถใหญ่';
  const models = meta.isuzu.filter(m => m['กลุ่มรถ'] === groupFilter).sort((a,b) => parseInt(a['ลำดับ']||99) - parseInt(b['ลำดับ']||99)).map(m => m['รุ่นรถ']).filter(Boolean);
  const sorted = [...scList].sort((a,b) => { const ta=a['ทีม']||'',tb=b['ทีม']||''; if(ta!==tb) return ta.localeCompare(tb); return parseInt(a['ลำดับ']||99)-parseInt(b['ลำดับ']||99); });
  window._modelData = window._modelData || {};
  const pivot = {};
  sorted.forEach(s => {
    const name = s['ที่ปรึกษาการขาย'];
    pivot[name] = { bkTotal:0, rsTotal:0, bkRows:{}, rsRows:{} };
    models.forEach(m => { pivot[name][m] = {bk:0,rs:0}; pivot[name].bkRows[m] = []; pivot[name].rsRows[m] = []; });
    pivot[name].bkRows['_all'] = []; pivot[name].rsRows['_all'] = [];
  });
  rows.forEach(r => {
    const sc = r['ที่ปรึกษาการขาย'], model = r['รุ่นรถ'];
    if (!pivot[sc] || isCL(r['สถานะ'])) return;
    if (!pivot[sc][model]) pivot[sc][model] = {bk:0,rs:0};
    if (!pivot[sc].bkRows[model]) pivot[sc].bkRows[model] = [];
    if (!pivot[sc].rsRows[model]) pivot[sc].rsRows[model] = [];
    const relDate = r['วันที่ปล่อย'] ? String(r['วันที่ปล่อย']).trim() : '';
    const bookDate = r['วันที่จอง'] ? String(r['วันที่จอง']).trim() : '';
    const bookInCur = dateMatchMonth(bookDate, curYM);
    const relInCur  = relDate && dateMatchMonth(relDate, curYM);
    const line   = { date: fmtDate(bookDate), name: r['ชื่อลูกค้า']||'', model: r['ชื่อรุ่นรถ']||r['รายละเอียดรถ']||model||'' };
    const lineRs = { date: fmtDate(relDate),  name: r['ชื่อลูกค้า']||'', model: r['ชื่อรุ่นรถ']||r['รายละเอียดรถ']||model||'' };
    if (bookInCur && !relInCur) { pivot[sc][model].bk++; pivot[sc].bkTotal++; pivot[sc].bkRows[model].push(line); pivot[sc].bkRows['_all'].push(line); }
    if (relInCur)  { pivot[sc][model].rs++; pivot[sc].rsTotal++; pivot[sc].rsRows[model].push(lineRs); pivot[sc].rsRows['_all'].push(lineRs); }
  });
  sorted.forEach(s => { window._modelData[s['ที่ปรึกษาการขาย']] = pivot[s['ที่ปรึกษาการขาย']]; });
  const modelBkHeaders = models.map(m => `<th style="background:#5b8dd9;color:#fff;font-size:12px;white-space:nowrap;padding:7px 6px;text-align:center;">${m}</th>`).join('');
  const modelRsHeaders = models.map(m => `<th style="background:#3aaa74;color:#fff;font-size:12px;white-space:nowrap;padding:7px 6px;text-align:center;">${m}</th>`).join('');
  const teams = {};
  sorted.forEach(sc => { const t = sc['ทีม']||'(ไม่ระบุทีม)'; if (!teams[t]) teams[t] = []; teams[t].push(sc); });
  let tbody = '';
  let gBkCols={}, gRsCols={}, gBkTotal=0, gRsTotal=0;
  models.forEach(m => { gBkCols[m]=0; gRsCols[m]=0; });
  Object.entries(teams).forEach(([team, members]) => {
    let tBkCols={}, tRsCols={}, tBkTotal=0, tRsTotal=0;
    models.forEach(m => { tBkCols[m]=0; tRsCols[m]=0; });
    tbody += `<tr style="background:rgba(26,58,107,0.06);"><td colspan="${2+models.length*2+2}" style="font-size:10px;font-weight:700;color:var(--primary);padding:5px 10px;border-top:2px solid var(--primary3);">ทีม ${team}</td></tr>`;
    members.forEach((sc, idx) => {
      const name = sc['ที่ปรึกษาการขาย'];
      const p = pivot[name] || { bkTotal:0, rsTotal:0 };
      const safeN2 = name.replace(/"/g,'&quot;');
      const bkCells = models.map(m => { const v=p[m]?.bk||0; tBkCols[m]+=v; gBkCols[m]+=v; const safeM=m.replace(/"/g,'&quot;'); return `<td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:17px;color:${v?'var(--primary2)':'#ccc'};${v?'cursor:pointer;':''}" ${v?`onmouseenter="showModelTipByModel(event,'${safeN2}','bk','${safeM}')" onmouseleave="hideDscTip()"`:''} >${v||0}</td>`; }).join('');
      const rsCells = models.map(m => { const v=p[m]?.rs||0; tRsCols[m]+=v; gRsCols[m]+=v; const safeM=m.replace(/"/g,'&quot;'); return `<td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:17px;color:${v?'var(--green)':'#ccc'};${v?'cursor:pointer;':''}" ${v?`onmouseenter="showModelTipByModel(event,'${safeN2}','rs','${safeM}')" onmouseleave="hideDscTip()"`:''} >${v||0}</td>`; }).join('');
      tBkTotal += p.bkTotal||0; tRsTotal += p.rsTotal||0;
      tbody += `<tr style="${idx%2===1?'background:#f5f8ff;':'background:#fff;'}">
        <td style="text-align:left;font-weight:600;padding:8px 10px;color:#1a3060;font-size:15px;">${name}</td>
        ${bkCells}
        <td style="text-align:center;font-weight:700;color:#3b6fd4;background:#e8f0ff;cursor:pointer;font-size:18px;font-family:'IBM Plex Mono',monospace;" onmouseenter="showModelTip(event,'${name}','bk')" onmouseleave="hideDscTip()">${p.bkTotal||0}</td>
        ${rsCells}
        <td style="text-align:center;font-weight:700;color:#1a8a55;background:#e6f5ee;cursor:pointer;font-size:18px;font-family:'IBM Plex Mono',monospace;" onmouseenter="showModelTip(event,'${name}','rs')" onmouseleave="hideDscTip()">${p.rsTotal||0}</td>
      </tr>`;
    });
    const tBkColCells = models.map(m => `<td style="text-align:center;font-weight:700;font-size:18px;font-family:'IBM Plex Mono',monospace;border-top:2px solid #a0b4e0;">${tBkCols[m]||0}</td>`).join('');
    const tRsColCells = models.map(m => `<td style="text-align:center;font-weight:700;font-size:18px;font-family:'IBM Plex Mono',monospace;border-top:2px solid #a0b4e0;">${tRsCols[m]||0}</td>`).join('');
    tbody += `<tr style="background:#eef3ff;"><td style="text-align:left;font-weight:700;padding:8px 10px;color:#2a4080;font-size:15px;border-top:2px solid #a0b4e0;">รวม ทีม ${team}</td>${tBkColCells}<td style="text-align:center;font-weight:700;color:var(--primary2);font-size:18px;font-family:'IBM Plex Mono',monospace;background:#daeaff;border-top:2px solid #a0b4e0;">${tBkTotal}</td>${tRsColCells}<td style="text-align:center;font-weight:700;color:var(--green);font-size:18px;font-family:'IBM Plex Mono',monospace;background:#d4f2e4;border-top:2px solid #a0b4e0;">${tRsTotal}</td></tr>`;
    gBkTotal += tBkTotal; gRsTotal += tRsTotal;
  });
  const gBkColCells = models.map(m => `<td style="text-align:center;font-weight:700;font-size:18px;font-family:'IBM Plex Mono',monospace;border-top:2px solid #f0c060;">${gBkCols[m]||0}</td>`).join('');
  const gRsColCells = models.map(m => `<td style="text-align:center;font-weight:700;font-size:18px;font-family:'IBM Plex Mono',monospace;border-top:2px solid #f0c060;">${gRsCols[m]||0}</td>`).join('');
  bodyEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:15px;min-width:600px;">
    <thead>
      <tr>
        <th rowspan="2" style="background:var(--primary);color:#fff;text-align:left;padding:8px 10px;min-width:100px;font-size:14px;">ที่ปรึกษาการขาย SC</th>
        <th colspan="${models.length+1}" style="background:#4a7fd4;color:#fff;padding:8px;text-align:center;font-size:14px;">ยอดจอง</th>
        <th colspan="${models.length+1}" style="background:#2e9e6a;color:#fff;padding:8px;text-align:center;font-size:14px;">ยอดปล่อย</th>
      </tr>
      <tr>${modelBkHeaders}<th style="background:#1565C0;color:#fff;font-size:12px;white-space:nowrap;font-weight:700;text-align:center;">รวม</th>${modelRsHeaders}<th style="background:#1a7a4a;color:#fff;font-size:12px;white-space:nowrap;font-weight:700;text-align:center;">รวม</th></tr>
    </thead>
    <tbody>${tbody}</tbody>
    <tfoot><tr style="background:#fef6e4;">
      <td style="text-align:left;font-weight:700;padding:8px 10px;border-top:2px solid #f0c060;color:#5a3e00;font-size:15px;">รวมทั้งหมด</td>
      ${gBkColCells}<td style="text-align:center;font-weight:700;color:#3b6fd4;border-top:2px solid #f0c060;font-size:18px;font-family:'IBM Plex Mono',monospace;background:#daeaff;">${gBkTotal}</td>
      ${gRsColCells}<td style="text-align:center;font-weight:700;color:#1a8a55;border-top:2px solid #f0c060;font-size:18px;font-family:'IBM Plex Mono',monospace;background:#d4f2e4;">${gRsTotal}</td>
    </tr></tfoot>
  </table>`;
}

// ════════════════════════════════════════
//  REPORT 3
// ════════════════════════════════════════
async function runReport3() {
  ['r3BodySmall','r3BodyBig'].forEach(id => { document.getElementById(id).innerHTML = '<div class="loader"><div class="loader-spin"></div><br>กำลังโหลด...</div>'; });
  try {
    const dAll = await callGS({ action:'getBookings' });
    const allRows = dAll.data || [];
    const now2 = new Date();
    const curYM = now2.getFullYear() + '-' + String(now2.getMonth()+1).padStart(2,'0');
    const curRows  = allRows.filter(r => dateMatchMonth(r['วันที่จอง'], curYM));
    const prevRows = allRows.filter(r => !dateMatchMonth(r['วันที่จอง'], curYM));
    let targetVal = 0;
    const TH2 = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const curLabel = TH2[now2.getMonth()+1] + ' ' + now2.getFullYear();
    const tgt2 = allTargets.find(t => t['เดือน'] === curLabel);
    if (tgt2) targetVal = parseInt(tgt2['เป้าการจำหน่าย'])||0;
    const today = new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
    const monthLabel = thMonth(curYM);
    const scSmall = meta.sc.filter(s => (s['ฝ่าย']||'').includes('เล็ก'));
    const scBig   = meta.sc.filter(s => (s['ฝ่าย']||'').includes('ใหญ่'));
    const onlineSources = ['เพจบริษัท', 'เพจส่วนตัว', 'Lead TIS', 'อื่นๆ'];
    renderDSC('small', scSmall, curRows, prevRows, allRows, onlineSources, monthLabel, today, targetVal, curYM, false);
    renderDSC('big',   scBig,   curRows, prevRows, allRows, onlineSources, monthLabel, today, 0, curYM, false);
  } catch(e) {
    ['r3BodySmall','r3BodyBig'].forEach(id => { document.getElementById(id).innerHTML = `<div class="empty">❌ ${e.message}</div>`; });
  }
}

function renderDSC(type, scList, curRows, prevRows, allRows, sources, monthLabel, today, targetVal, curYM, isBigDept=false) {
  const suffix = type === 'small' ? 'Small' : 'Big';
  const bodyEl = document.getElementById('r3Body' + suffix);
  const titleEl = document.getElementById('r3Title' + suffix);
  const deptName = type === 'small' ? 'ฝ่ายขายรถเล็ก' : 'ฝ่ายขายรถใหญ่';
  const reportDate3 = window._reportDate || new Date();
  const titleDate3  = thDateFull(reportDate3);
  const titleMonth3 = thMonthYear(curYM);
  titleEl.innerHTML = `<span style="font-size:16px;font-weight:800;">รายงานสรุปยอดจองและยอดปล่อยรถ ประจำเดือน ${titleMonth3}</span> &nbsp;<span style="font-size:13px;font-weight:700;color:#2a5cb8;">📊 ${deptName}</span>`;
  const badgeEl3 = document.getElementById('r3DateBadge' + suffix);
  if(badgeEl3) badgeEl3.innerHTML = `<span class="date-badge-r3"><span class="lbl">ณ วันที่</span><span class="val">${titleDate3}</span></span>`;
  if (!scList.length) { bodyEl.innerHTML = '<div class="empty">ไม่มี SC ในฝ่ายนี้</div>'; return; }
  const sorted = [...scList].sort((a,b) => { const ta=a['ทีม']||'',tb=b['ทีม']||''; if(ta!==tb) return ta.localeCompare(tb); return parseInt(a['ลำดับ']||99)-parseInt(b['ลำดับ']||99); });
  window._dscData = window._dscData || {};
  const calc = (sc) => {
    const name = sc['ที่ปรึกษาการขาย'];
    const carryRows = prevRows.filter(r => r['ที่ปรึกษาการขาย']===name && (isBK(r['สถานะ'])||isERS(r['สถานะ'])) && !isCL(r['สถานะ']));
    const carry = carryRows.length;
    const ebkRows2 = allRows.filter(r => r['ที่ปรึกษาการขาย']===name && isEBK(r['สถานะ']));
    const ebk = ebkRows2.length;
    const bkThisRows = curRows.filter(r => r['ที่ปรึกษาการขาย']===name && isBK(r['สถานะ']));
    const bk = bkThisRows.length;
    const fixedSources = ['เพจบริษัท', 'เพจส่วนตัว', 'Lead TIS'];
    const onlineBySource = {};
    const srcRows = curRows.filter(r => r['ที่ปรึกษาการขาย']===name && !isCL(r['สถานะ']));
    fixedSources.forEach(src => { onlineBySource[src] = srcRows.filter(r => r['ที่มาลูกค้า']===src).length; });
    onlineBySource['อื่นๆ'] = srcRows.filter(r => !fixedSources.includes(r['ที่มาลูกค้า']) && r['ที่มาลูกค้า']).length;
    const bkInMonthRows = curRows.filter(r => r['ที่ปรึกษาการขาย']===name);
    const rsInMonthRows = allRows.filter(r => r['ที่ปรึกษาการขาย']===name && r['วันที่ปล่อย'] && dateMatchMonth(r['วันที่ปล่อย'], curYM));
    const rsMonthMap = new Map();
    [...bkInMonthRows, ...rsInMonthRows].forEach(r => rsMonthMap.set(r._row, r));
    const rsMonthRows = [...rsMonthMap.values()];
    const carryNotReleased = carryRows.filter(r => !r['วันที่ปล่อย']).length;
    const bkNotReleased = bkThisRows.filter(r => !r['วันที่ปล่อย']).length;
    const total = carryNotReleased + bkNotReleased;
    const ersRows = allRows.filter(r => r['ที่ปรึกษาการขาย']===name && isERS(r['สถานะ']));
    const ers = ersRows.length;
    const rsTotalRows = allRows.filter(r => r['ที่ปรึกษาการขาย']===name && r['วันที่ปล่อย'] && dateMatchMonth(r['วันที่ปล่อย'], curYM));
    const rsTotal = rsTotalRows.length;
    const clRows2 = allRows.filter(r => r['ที่ปรึกษาการขาย']===name && isCL(r['สถานะ']) && r['วันที่ยกเลิกจอง'] && dateMatchMonth(r['วันที่ยกเลิกจอง'], curYM));
    const cl = clRows2.length;
    const fmt    = r => ({ date: fmtDate(r['วันที่จอง']), name: r['ชื่อลูกค้า']||'', model: r['รายละเอียดรถ']||r['รุ่นรถ']||'' });
    const fmtRel = r => ({ date: fmtDate(r['วันที่ปล่อย']), name: r['ชื่อลูกค้า']||'', model: r['รายละเอียดรถ']||r['รุ่นรถ']||'' });
    const fmtCL  = r => ({ date: fmtDate(r['วันที่ยกเลิกจอง']), name: r['ชื่อลูกค้า']||'', model: r['รายละเอียดรถ']||r['รุ่นรถ']||'' });
    const srcRowsMap = {};
    sources.forEach(src => { srcRowsMap[src] = src==='อื่นๆ' ? srcRows.filter(r=>!fixedSources.includes(r['ที่มาลูกค้า'])&&r['ที่มาลูกค้า']) : srcRows.filter(r=>r['ที่มาลูกค้า']===src); });
    window._dscData[name] = { carry:carryRows.map(fmt), ebk:ebkRows2.map(fmt), bk:bkThisRows.map(fmt), rs:rsMonthRows.map(fmt), total:[...carryRows,...bkThisRows].map(fmt), ers:ersRows.map(fmt), rsTotal:rsTotalRows.map(fmtRel), cl:clRows2.map(fmtCL), ...Object.fromEntries(sources.map(s=>[`src_${s}`,srcRowsMap[s].map(fmt)])) };
    return { name, carry, ebk, bk, onlineBySource, rsMonth:rsMonthRows.length, total, ers, rsTotal, cl, ทีม:sc['ทีม']||'', ชื่อเล่น:name, 'ที่ปรึกษาการขาย':name };
  };
  const teams = {};
  sorted.forEach(sc => { const t=sc['ทีม']||'(ไม่ระบุทีม)'; if(!teams[t]) teams[t]=[]; teams[t].push(calc(sc)); });
  const srcHeaders = sources.map(s => `<th class="online-hdr" style="font-size:11px;">${s}</th>`).join('');
  let html = `<table class="dsc-table"><thead><tr>
    <th class="left" rowspan="2">ที่ปรึกษาการขาย SC</th>
    <th class="carry" rowspan="2" style="font-size:13px;">ยอดจอง<br>ยกมา</th>
    <th class="ebk-hdr" rowspan="2" style="font-size:13px;">คาดว่า<br>จะจอง</th>
    <th class="bk-hdr" rowspan="2" style="font-size:13px;">ยอดจอง<br>เดือนนี้</th>
    <th class="online-hdr" colspan="${sources.length}" style="font-size:13px;">แหล่งที่มาลูกค้า (จองเดือนนี้)</th>
    <th class="bk-hdr" rowspan="2" style="font-size:13px;">รวมยอดจอง<br>ปัจจุบัน</th>
    <th class="ebk-hdr" rowspan="2" style="font-size:13px;">คาดว่า<br>จะปล่อย</th>
    <th class="rs-hdr" rowspan="2" style="font-size:13px;">ยอดปล่อย<br>เดือนนี้</th>
    <th class="cl-hdr" rowspan="2" style="font-size:13px;">ถอน<br>จอง</th>
  </tr><tr>${srcHeaders}</tr></thead><tbody>`;
  let gCarry=0,gEbk=0,gBk=0,gTotal=0,gErs=0,gRsT=0,gCl=0;
  const gSrc={}; sources.forEach(s=>gSrc[s]=0);
  Object.entries(teams).forEach(([team, members]) => {
    html += `<tr class="team-sep"><td colspan="${8+sources.length}">ทีม ${team}</td></tr>`;
    let tCarry=0,tEbk=0,tBk=0,tTotal=0,tErs=0,tRsT=0,tCl=0;
    const tSrc={}; sources.forEach(s=>tSrc[s]=0);
    members.forEach((d, idx) => {
      const rowBg = idx%2===0?'':' style="background:#f4f7fb;"';
      const srcCells = sources.map(s => { const v=d.onlineBySource[s]||0; tSrc[s]+=v; gSrc[s]+=v; const safeS=s.replace(/'/g,"'"); return `<td class="num online-col ${v?'bk':'zero'}" ${v?`style="cursor:pointer;" onmouseenter="showDscTip(event,'${d.name.replace(/"/g,'&quot;')}','src_${safeS}')" onmouseleave="hideDscTip()"`:''} >${v||0}</td>`; }).join('');
      tCarry+=d.carry; tEbk+=d.ebk; tBk+=d.bk; tTotal+=d.total; tErs+=d.ers; tRsT+=d.rsTotal; tCl+=d.cl;
      const safeN=d.name.replace(/"/g,'&quot;');
      const tip=(field)=>`style="cursor:pointer;" onmouseenter="showDscTip(event,'${safeN}','${field}')" onmouseleave="hideDscTip()"`;
      html += `<tr${rowBg}>
        <td class="name">${d['ที่ปรึกษาการขาย']}</td>
        <td class="num carry" ${tip('carry')}>${d.carry||0}</td>
        <td class="num ebk ${d.ebk?'':'zero'}" ${d.ebk?tip('ebk'):''}>${d.ebk||0}</td>
        <td class="num bk ${d.bk?'':'zero'}" style="background:#e8f0ff;" ${d.bk?tip('bk'):''}>${d.bk||0}</td>
        ${srcCells}
        <td class="num bk" style="background:#EEF4FF;cursor:pointer;" onmouseenter="showDscTip(event,'${safeN}','total')" onmouseleave="hideDscTip()">${d.total||0}</td>
        <td class="num ebk ${d.ers?'':'zero'}" ${d.ers?tip('ers'):''}>${d.ers||0}</td>
        <td class="num rs ${d.rsTotal?'':'zero'}" style="background:#e8f7f0;" ${d.rsTotal?tip('rsTotal'):''}>${d.rsTotal||0}</td>
        <td class="num cl ${d.cl?'':'zero'}" ${d.cl?tip('cl'):''}>${d.cl||0}</td>
      </tr>`;
    });
    const tSrcCells=sources.map(s=>`<td class="num online-col" style="border-top:2px solid #a0b4e0;">${tSrc[s]||0}</td>`).join('');
    html += `<tr class="team-total"><td class="name">รวม ทีม ${team}</td><td class="num">${tCarry}</td><td class="num">${tEbk}</td><td class="num" style="background:#e8f0ff;border-top:2px solid #a0b4e0;">${tBk}</td>${tSrcCells}<td class="num" style="background:#e8f0ff;border-top:2px solid #a0b4e0;">${tTotal}</td><td class="num">${tErs}</td><td class="num" style="background:#e8f7f0;border-top:2px solid #a0b4e0;">${tRsT}</td><td class="num">${tCl}</td></tr>`;
    gCarry+=tCarry; gEbk+=tEbk; gBk+=tBk; gTotal+=tTotal; gErs+=tErs; gRsT+=tRsT; gCl+=tCl;
  });
  const gSrcCells=sources.map(s=>`<td class="num online-col" style="border-top:2px solid #f0c060;">${gSrc[s]||0}</td>`).join('');
  html += `</tbody><tfoot><tr class="grand-total"><td class="name">รวมทั้งหมด</td><td class="num">${gCarry}</td><td class="num">${gEbk}</td><td class="num" style="background:#daeaff;">${gBk}</td>${gSrcCells}<td class="num" style="background:#daeaff;">${gTotal}</td><td class="num">${gErs}</td><td class="num" style="background:#d4f2e4;">${gRsT}</td><td class="num">${gCl}</td></tr></tfoot></table>`;
  bodyEl.innerHTML = html;
}

// ════════════════════════════════════════
//  PRINT FUNCTIONS
// ════════════════════════════════════════
function printReport1() {
  const title = document.getElementById('r1Title').textContent;
  const tbody = document.getElementById('r1Body').innerHTML;
  const today = new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
  const countEl = document.getElementById('r1Count');
  const countBar = `<div style="text-align:right;font-size:8pt;color:#666;margin-bottom:6px;">${countEl?.textContent||''}</div>`;
  openPrint(title, today, countBar + `<table style="width:100%;border-collapse:collapse;font-size:9pt;"><thead><tr>
    <th style="padding:6px 8px;text-align:center;">#</th><th style="padding:6px 8px;">วันที่จอง</th><th style="padding:6px 8px;text-align:left;">ชื่อลูกค้า</th><th style="padding:6px 8px;">เบอร์</th><th style="padding:6px 8px;text-align:left;">รายละเอียดรถ</th><th style="padding:6px 8px;">รุ่น</th><th style="padding:6px 8px;">สถานะ</th><th style="padding:6px 8px;">วันที่ปล่อย</th><th style="padding:6px 8px;text-align:left;">SC</th><th style="padding:6px 8px;text-align:left;">ที่มา</th>
  </tr></thead><tbody>${tbody}</tbody></table>`);
}

function doPrintReport2() {
  const rDate = window._reportDate || new Date();
  const today = thDateFull(rDate);
  const curYM = rDate.getFullYear() + '-' + String(rDate.getMonth()+1).padStart(2,'0');
  const title = `รายงานยอดจองและปล่อยรถ ประจำเดือน ${thMonthYear(curYM)}`;
  const bodySmall = document.getElementById('r2BodySmall')?.innerHTML || '';
  const bodyBig   = document.getElementById('r2BodyBig')?.innerHTML || '';
  openPrint(title, today, `<h3 style="margin:0 0 8px;color:#1a3a6b;">📊 ฝ่ายขายรถเล็ก</h3>${bodySmall}<div style="margin-top:20px;"></div><h3 style="margin:0 0 8px;color:#1a3a6b;">📊 ฝ่ายขายรถใหญ่</h3>${bodyBig}`);
}

function doPrintReport3() {
  const rDate = window._reportDate || new Date();
  const today = thDateFull(rDate);
  const curYM = rDate.getFullYear() + '-' + String(rDate.getMonth()+1).padStart(2,'0');
  const title = `รายงานยอดจองสะสมและยอดปล่อยรถ ประจำเดือน ${thMonthYear(curYM)}`;
  const bodySmall = document.getElementById('r3BodySmall')?.innerHTML || '';
  const bodyBig   = document.getElementById('r3BodyBig')?.innerHTML || '';
  openPrint(title, today, `<h3 style="margin:0 0 8px;color:#1a3a6b;">📊 ฝ่ายขายรถเล็ก</h3>${bodySmall}<div style="margin-top:16px;"></div><h3 style="margin:0 0 8px;color:#1a3a6b;">📊 ฝ่ายขายรถใหญ่</h3>${bodyBig}`);
}

function openPrint(title, today, bodyHtml) {
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Sarabun',sans-serif;font-size:10pt;background:#fff;color:#111;padding:10mm;}
    .ctrl{background:#1a3a6b;padding:8px 16px;display:flex;gap:10px;margin:-10mm -10mm 10mm;position:sticky;top:0;z-index:50;}
    .pbtn{padding:6px 18px;font-size:12px;font-family:'Sarabun',sans-serif;border:none;border-radius:6px;cursor:pointer;font-weight:700;}
    .pbtn-p{background:#e8a020;color:#1a3a6b;}.pbtn-c{background:#546E7A;color:#fff;}
    .hdr{text-align:center;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #1a3a6b;}
    .hdr h1{font-size:14pt;font-weight:800;color:#1a3a6b;}.hdr p{font-size:9pt;color:#555;margin-top:3px;}
    table{width:100%;border-collapse:collapse;}
    th{background:#1a3a6b!important;color:#fff!important;padding:6px 8px;font-size:8pt;font-weight:700;text-align:center!important;border:1px solid rgba(255,255,255,0.2);}
    td{padding:5px 8px;border:1px solid #dde;font-size:8.5pt;text-align:center;}
    td.name{text-align:left!important;font-weight:600;}
    tr:nth-child(even) td{background:#f5f8ff;}
    tr.team-total td,tr[style*="eef3ff"] td{background:#eef3ff!important;font-weight:700;border-top:2px solid #a0b4e0;color:#2a4080;}
    tr.grand-total td,tfoot tr td{background:#fef6e4!important;font-weight:700;font-size:9pt;border-top:2px solid #f0c060;color:#5a3e00;}
    .carry{background:#8b6bb1!important;}.ebk-hdr{background:#e07820!important;}.bk-hdr{background:#4a7fd4!important;}.online-hdr{background:#c44d8a!important;}.rs-hdr{background:#2e9e6a!important;}.cl-hdr{background:#d45050!important;}
    .dsc-table{width:100%;border-collapse:collapse;font-size:8.5pt;}
    .dsc-table th{padding:5px 6px;text-align:center;font-weight:700;border:1px solid rgba(255,255,255,0.2);white-space:nowrap;color:#fff;}
    .dsc-table th.left{text-align:left;background:#6b7fa8;}
    .dsc-table td{padding:5px 7px;border:1px solid #e8edf5;text-align:center;}
    .dsc-table td.name{text-align:left;font-weight:600;background:#f8faff;}
    .dsc-table td.num{font-weight:700;}.dsc-table td.bk{color:#3b6fd4;}.dsc-table td.rs{color:#1a8a55;}.dsc-table td.ebk{color:#d4720a;}.dsc-table td.cl{color:#c0392b;}.dsc-table td.zero{color:#bbb;}
    .dsc-table tr.team-total td{background:#eef3ff!important;font-weight:700;border-top:2px solid #a0b4e0;color:#2a4080;}
    .dsc-table tr.grand-total td{background:#fef6e4!important;font-weight:700;font-size:9pt;border-top:2px solid #f0c060;color:#5a3e00;}
    .dsc-table tr.team-sep td{background:#e8edf8;font-size:7.5pt;font-weight:700;color:#3b5080;padding:4px 8px;border-top:2px solid #a0b4e0;}
    .badge{display:inline-block;padding:1px 7px;border-radius:8px;font-size:7.5pt;font-weight:700;}
    @media print{.ctrl{display:none!important;}body{padding:8mm;}@page{size:A4 landscape;margin:8mm 10mm;}}
  </style></head><body>
  <div class="ctrl">
    <button class="pbtn pbtn-p" onclick="window.print()">🖨️ พิมพ์ / PDF</button>
    <button class="pbtn pbtn-c" onclick="window.close()">✕ ปิด</button>
  </div>
  <div class="hdr">
    <div style="font-size:8pt;color:#666;margin-bottom:2px;">บริษัท อีซูซุคิงส์ยนต์กรุงเทพ จำกัด · สาขาสุวินทวงศ์</div>
    <h1>${title}</h1><p>ณ วันที่ ${today}</p>
  </div>
  ${bodyHtml}</body></html>`);
  w.document.close();
}

// ════════════════════════════════════════
//  CONFIRM DIALOG
// ════════════════════════════════════════
function showConfirm(icon, title, msg, cb) {
  document.getElementById('confirmIcon').textContent  = icon;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent   = msg;
  confirmCallback = cb;
  document.getElementById('confirmOverlay').classList.add('open');
}
function closeConfirm() { document.getElementById('confirmOverlay').classList.remove('open'); confirmCallback = null; }
function confirmOk() { const cb = confirmCallback; closeConfirm(); if (cb) cb(); }

// ════════════════════════════════════════
//  SHARE / COPY
// ════════════════════════════════════════
function updateShareUrl() {
  if (!scriptUrl) return;
  document.getElementById('shareUrl').value = window.location.href.split('?')[0] + '?url=' + encodeURIComponent(scriptUrl);
}
function copyShareUrl() { copyText(document.getElementById('shareUrl').value, 'shareOk'); }
function copyScript()   { copyText(document.getElementById('scriptCode').textContent, 'copyOk'); }
function copyText(txt, feedbackId) {
  const show = () => { const el=document.getElementById(feedbackId); if(el){el.style.display='';setTimeout(()=>el.style.display='none',2500);} };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(show).catch(()=>fallbackCopy(txt,show));
  else fallbackCopy(txt,show);
}
function fallbackCopy(txt,cb) {
  const ta=document.createElement('textarea');ta.value=txt;ta.style.cssText='position:fixed;top:0;left:0;opacity:0;';
  document.body.appendChild(ta);ta.focus();ta.select();
  try{document.execCommand('copy');if(cb)cb();}catch(e){}document.body.removeChild(ta);
}

// ════════════════════════════════════════
//  GS API
// ════════════════════════════════════════
async function callGS(params, url) {
  const base = url || scriptUrl;
  if (!base) throw new Error('ไม่มี URL');
  const qs = new URLSearchParams(params).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(base + '?' + qs, { signal: controller.signal });
    clearTimeout(timer);
    return await res.json();
  } catch(e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('หมดเวลาเชื่อมต่อ (timeout)');
    throw e;
  }
}

// ════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════
function fmtDate(s) {
  if (!s) return '—';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
  return s;
}
function statusCode(val) {
  if (!val) return '';
  const codes = ['PS','EBK','BK','ERS','RS','CL'];
  if (codes.includes(val)) return val;
  if (isPS(val))  return 'PS';
  if (isEBK(val)) return 'EBK';
  if (isBK(val))  return 'BK';
  if (isERS(val)) return 'ERS';
  if (isRS(val))  return 'RS';
  if (isCL(val))  return 'CL';
  const found = meta.status.find(s => s['สถานะ'] === val || s['STATUS'] === val);
  return found ? found['STATUS'] : val;
}
function statusLabel(val) {
  if (!val) return '—';
  const code = statusCode(val);
  const found = meta.status.find(s => s['STATUS'] === code);
  if (found) return found['สถานะ'] || found['STATUS'];
  return val;
}
function thMonthYear(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const TH = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return `${TH[parseInt(m)]} ${parseInt(y)+543}`;
}
function thDateFull(date) {
  const TH = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return `${date.getDate()} ${TH[date.getMonth()+1]} ${date.getFullYear()+543}`;
}
function thMonth(ym) {
  if (!ym) return '';
  const [y,m] = ym.split('-');
  const MONTHS = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return `${MONTHS[parseInt(m)]} ${parseInt(y)}`;
}
function dateMatchMonth(dateStr, ym) {
  if (!dateStr || !ym) return true;
  const t = parseThDate(String(dateStr).trim());
  if (!t) return false;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === ym;
}
function parseThDate(s) {
  if (!s) return 0;
  const str = String(s).trim();
  const slashParts = str.split('/');
  if (slashParts.length >= 3) {
    let y = parseInt(slashParts[2].substring(0,4));
    if (y > 2400) y -= 543;
    return new Date(`${y}-${slashParts[1].padStart(2,'0')}-${slashParts[0].padStart(2,'0')}T00:00:00`).getTime() || 0;
  }
  if (str.includes('-') && str.length >= 8 && str.indexOf('-') === 4) return new Date(str).getTime() || 0;
  const t = new Date(str).getTime();
  return isNaN(t) ? 0 : t;
}
function formatDateInput(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function formatThDate(s) { if (!s) return ''; const [y,m,d] = s.split('-'); if (!y||!m||!d) return ''; return `${parseInt(d)}/${parseInt(m)}/${y}`; }
function thToInputDate(s) { if (!s) return ''; const p = String(s).split('/'); if (p.length < 3) return ''; return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`; }
function toast(msg, type) { const el=document.getElementById('toast'); el.textContent=msg; el.className='toast '+(type||''); el.style.display='block'; setTimeout(()=>el.style.display='none',2800); }

// ════ DATE PICKER ════
let _datepickTarget = null;
function openDatePick(target, titleText) {
  _datepickTarget = target;
  const now = new Date();
  document.getElementById('datepickInput').value = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  document.getElementById('datepickTitle').textContent = `📅 วันที่รายงาน — ${titleText}`;
  document.getElementById('datepickOverlay').classList.add('open');
}
function closeDatePick() { document.getElementById('datepickOverlay').classList.remove('open'); _datepickTarget = null; }
function confirmDatePick() {
  const val = document.getElementById('datepickInput').value;
  if (!val) { toast('กรุณาเลือกวันที่', 'err'); return; }
  const [y,m,d] = val.split('-');
  window._reportDate = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
  const target = _datepickTarget;
  closeDatePick();
  if (target === 'report2') runReport2();
  else if (target === 'report3') runReport3();
  else if (target === 'summary') runSummaryReport();
  toast('✅ เปลี่ยนวันที่แล้ว', 'ok');
}
function changeReportDate(target) { openDatePick(target, target==='report2'?'รายงานยอดจองและปล่อยรถ':'Daily SC Performance'); }

// ════════════════════════════════════════
//  RELEASE REPORT
// ════════════════════════════════════════
let _releaseRowIdx = null;

function populateRlModelDropdown() {
  const sel = document.getElementById('rl-model-full');
  const prev = sel.value;
  sel.innerHTML = '<option value="">-- เลือกรุ่น --</option>';
  if (meta.model && meta.model.length) {
    meta.model.forEach(m => {
      const ppv = (m['ชื่อรุ่นการจำหน่าย']||m['PPV']||'').trim();
      const desc = (m['รายละเอียด']||'').trim();
      const code = (m['รหัสรุ่นรถ']||'').trim();
      if (!ppv) return;
      const o = document.createElement('option');
      o.value = ppv; o.textContent = ppv+(desc?'  — '+desc:'')+(code?'  ['+code+']':''); sel.appendChild(o);
    });
  }
  const oCustom = document.createElement('option'); oCustom.value='__custom__'; oCustom.textContent='✏️ พิมพ์เอง'; sel.appendChild(oCustom);
  if (prev) sel.value = prev;
}
function onRlModelFullChange() {
  const sel = document.getElementById('rl-model-full');
  const wrap = document.getElementById('rl-model-full-custom-wrap');
  wrap.style.display = sel.value==='__custom__'?'':'none';
  if (sel.value !== '__custom__') document.getElementById('rl-model-full-custom').value = '';
}
function getRlModelFullValue() {
  const sel = document.getElementById('rl-model-full');
  return sel.value==='__custom__' ? document.getElementById('rl-model-full-custom').value.trim() : sel.value.trim();
}
function lookupModelPPV(r) {
  if (!meta.model || !meta.model.length) return '';
  const detail = (r['รายละเอียดรถ']||'').trim().toLowerCase();
  const code   = (r['รุ่นรถ']||'').trim().toLowerCase();
  let found = meta.model.find(m => (m['รายละเอียด']||'').trim().toLowerCase() === detail);
  if (!found && code) found = meta.model.find(m => (m['รหัสรุ่นรถ']||'').trim().toLowerCase() === code);
  if (found) return (found['ชื่อรุ่นการจำหน่าย']||found['PPV']||'').trim();
  return '';
}
function openReleaseReport(i) {
  const r = filteredBookings[i];
  if (!r) return;
  _releaseRowIdx = i;
  document.getElementById('rl-customer').value     = r['ชื่อลูกค้า']||'';
  document.getElementById('rl-rcv-customer').value = r['ลูกค้ารับรถ']||r['ชื่อลูกค้า']||'';
  document.getElementById('rl-plate').value        = r['เลขทะเบียน']||'';
  document.getElementById('rl-sc').value           = r['ที่ปรึกษาการขาย']||'';
  document.getElementById('rl-release-date').value = r['วันที่ปล่อย']||'';
  document.getElementById('rl-engine').value       = r['เลขเครื่อง']||'';
  document.getElementById('rl-chassis').value      = r['เลขแชสซีส์']||'';
  document.getElementById('rl-delivery').value     = r['เลขส่งมอบ']||'';
  document.getElementById('rl-po').value           = r['เลข PO']||'';
  document.getElementById('rl-model').value        = r['รุ่นรถ']||'';
  populateFinanceSelect(r['ไฟแนนซ์']||'');
  populateRlModelDropdown();
  const saved = (r['ชื่อรุ่นรถ']||'').trim();
  const looked = lookupModelPPV(r);
  const targetVal = saved || looked;
  const sel = document.getElementById('rl-model-full');
  const wrap = document.getElementById('rl-model-full-custom-wrap');
  const customInput = document.getElementById('rl-model-full-custom');
  if (targetVal) {
    sel.value = targetVal;
    if (sel.value !== targetVal) { sel.value='__custom__'; customInput.value=targetVal; wrap.style.display=''; }
    else { wrap.style.display='none'; customInput.value=''; }
  } else { sel.value=''; wrap.style.display='none'; customInput.value=''; }
  document.getElementById('releaseModal').classList.add('open');
}
function closeReleaseModal() { document.getElementById('releaseModal').classList.remove('open'); _releaseRowIdx = null; }
async function saveAndPrintRelease() {
  const r = filteredBookings[_releaseRowIdx];
  if (!r) return;
  const extra = { 'สถานะ':'RS', 'เลขเครื่อง':document.getElementById('rl-engine').value.trim(), 'เลขแชสซีส์':document.getElementById('rl-chassis').value.trim(), 'ไฟแนนซ์':getFinanceValue(), 'เลขทะเบียน':document.getElementById('rl-plate').value.trim(), 'เลขส่งมอบ':document.getElementById('rl-delivery').value.trim(), 'เลข PO':document.getElementById('rl-po').value.trim(), 'ลูกค้ารับรถ':document.getElementById('rl-rcv-customer').value.trim(), 'ชื่อรุ่นรถ':getRlModelFullValue() };
  const saveBtn = document.querySelector('#releaseModal .btn-primary');
  if (saveBtn) { saveBtn.disabled=true; saveBtn.textContent='⏳ กำลังบันทึก...'; }
  try {
    if (r._row) { await callGS({ action:'updateBooking', _row:r._row, ...extra }); Object.assign(r, extra); }
  } catch(e) { toast('⚠️ บันทึกไม่สำเร็จ', 'warn'); }
  if (saveBtn) { saveBtn.disabled=false; saveBtn.textContent='💾 บันทึก & พิมพ์รายงาน'; }
  closeReleaseModal();
  toast('✅ บันทึกสำเร็จ', 'ok');
  setTimeout(() => printReleaseReport(r), 600);
}

function printReleaseReport(r) {
  let rDate;
  if (r && r['วันที่ปล่อย']) { const t=parseThDate(String(r['วันที่ปล่อย']).trim()); rDate=t?new Date(t):(window._reportDate||new Date()); }
  else { rDate = window._reportDate || new Date(); }
  const dateStr = thDateFull(rDate);
  const curYM = rDate.getFullYear()+'-'+String(rDate.getMonth()+1).padStart(2,'0');
  const monthLabel = thMonthYear(curYM);
  const relDateKey = r['วันที่ปล่อย'] ? fmtDate(String(r['วันที่ปล่อย']).trim()) : fmtDate(rDate.toISOString());
  const sameDay = (allBookings||[]).filter(b => b['วันที่ปล่อย'] && fmtDate(String(b['วันที่ปล่อย']).trim())===relDateKey);
  const releaseList = sameDay.length > 0 ? sameDay : [r];
  printReleaseReportFromList(releaseList, rDate);
}

function printReleaseReportFromList(releaseList, rDate) {
  const dateStr = thDateFull(rDate);
  const curYM = rDate.getFullYear()+'-'+String(rDate.getMonth()+1).padStart(2,'0');
  const monthLabel = thMonthYear(curYM);
  const tdBase = "text-align:center;font-weight:800;font-size:10pt;white-space:nowrap;vertical-align:middle;";
  const dataRows = releaseList.map(b => `<tr>
    <td style="${tdBase}font-size:11pt;">${b['ไฟแนนซ์']||''}</td>
    <td style="${tdBase}">${b['ชื่อรุ่นรถ']||b['รายละเอียดรถ']||''}</td>
    <td style="${tdBase}">${b['เลขเครื่อง']||''}</td>
    <td style="${tdBase}">${b['เลขแชสซีส์']||''}</td>
    <td style="${tdBase}font-size:10.5pt;">${b['ลูกค้ารับรถ']||b['ชื่อลูกค้า']||''}</td>
    <td class="plate-col" style="${tdBase}font-size:11pt;">${b['เลขทะเบียน']||''}</td>
    <td style="${tdBase}font-size:10.5pt;">${b['เลขส่งมอบ']||''}</td>
    <td style="${tdBase}font-size:10.5pt;">${b['เลข PO']||''}</td>
    <td style="${tdBase}">${b['ที่ปรึกษาการขาย']||''}</td>
  </tr>`).join('');
  const emptyCount = Math.max(0, 10 - releaseList.length);
  const emptyRows = Array.from({length:emptyCount},()=>`<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('');
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>รายงานการปล่อยรถ ประจำเดือน ${monthLabel}</title>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Sarabun',sans-serif;font-size:8.5pt;background:#fff;color:#1a2d45;padding:5mm 7mm;}
    .ctrl{background:#1a3a6b;padding:6px 14px;display:flex;gap:8px;align-items:center;margin:-5mm -7mm 5mm;position:sticky;top:0;z-index:50;}
    .ctrl-title{color:rgba(255,255,255,0.8);font-size:10px;font-weight:600;flex:1;}
    .pbtn{padding:5px 14px;font-size:11px;font-family:'Sarabun',sans-serif;border:none;border-radius:6px;cursor:pointer;font-weight:700;}
    .pbtn-p{background:#e8a020;color:#1a3a6b;}.pbtn-c{background:#546E7A;color:#fff;}
    .doc-header{display:flex;align-items:center;justify-content:center;gap:8px;text-align:center;margin-bottom:3mm;padding-bottom:3mm;border-bottom:2px solid #e8a020;}
    .doc-title{font-size:16pt;font-weight:800;color:#1a3a6b;line-height:1.2;}
    .doc-company{font-size:13pt;font-weight:600;color:#333;margin-top:1mm;}
    .doc-to{font-size:9pt;margin-bottom:0.8mm;line-height:1.75;}
    table{width:100%;border-collapse:collapse;margin-top:2mm;table-layout:fixed;}
    thead tr{background:#b94a00;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    th{padding:0 5px;height:11mm;font-size:10pt;font-weight:700;border:1.5px solid #b94a00;text-align:center;white-space:nowrap;vertical-align:middle;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    th.plate-hdr{color:#ffe082;}
    td{padding:0 5px;height:9mm;font-size:8.5pt;border:1.5px solid #c8903a;vertical-align:middle;color:#111;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    tbody tr:nth-child(odd) td{background:#fff8f0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    tbody tr:nth-child(even) td{background:#fff3e0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    td.plate-col{color:#c0392b!important;font-weight:800;}
    .sig-row{display:flex;justify-content:space-between;padding:0 40mm;margin-top:18mm;}
    .sig-box{text-align:center;min-width:150px;}
    .sig-line{font-size:9.5pt;margin-bottom:2.5mm;color:#555;}
    .sig-name{font-size:11pt;font-weight:800;color:#1a2d45;}
    .sig-role{font-size:8.5pt;color:#666;margin-top:1mm;}
    @media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}.ctrl{display:none!important;}body{padding:5mm 7mm;}@page{size:A4 landscape;margin:5mm;}}
  </style></head><body>
  <div class="ctrl">
    <span class="ctrl-title">🚗 รายงานการปล่อยรถ · บริษัท อีซูซุคิงส์ยนต์กรุงเทพ จำกัด</span>
    <button class="pbtn pbtn-p" onclick="window.print()">🖨️ พิมพ์ / PDF</button>
    <button class="pbtn pbtn-c" onclick="window.close()">✕ ปิด</button>
  </div>
  <div class="doc-header">
    <div style="font-size:22px;">🚗</div>
    <div><div class="doc-title">รายงานการปล่อยรถ ประจำเดือน ${monthLabel}</div><div class="doc-company">บริษัท อีซูซุคิงส์ยนต์กรุงเทพ จำกัด</div></div>
  </div>
  <div class="doc-to" style="font-size:12pt;"><b>ถึง &nbsp;&nbsp;&nbsp; กรรมการผู้จัดการ</b></div>
  <div class="doc-to" style="font-size:12pt;"><b>ถึง &nbsp;&nbsp;&nbsp; ฝ่ายสต๊อก &nbsp; รายงานตัวจริง &nbsp; ส่ง ฝ่ายบัญชี คุณอารีรัตน นวลทอง &nbsp;/&nbsp; ประจำวันที่ &nbsp;${dateStr}</b></div>
  <table>
    <thead><tr>
      <th style="width:48px;">F/N</th><th style="width:130px;">รุ่นรถ</th><th style="width:88px;">เลขเครื่อง</th><th style="width:145px;">เลขแชสซีส์</th><th style="width:175px;">ชื่อลูกค้า</th><th class="plate-hdr" style="width:68px;">ป้ายแดง</th><th style="width:95px;">ใบส่งมอบ</th><th style="width:92px;">ใบ PO</th><th style="width:115px;">SC</th>
    </tr></thead>
    <tbody>${dataRows+emptyRows}</tbody>
  </table>
  <div class="sig-row">
    <div class="sig-box"><div class="sig-line">ลงชื่อ.................................................</div><div class="sig-name">คุณรวิวรรณ พันสนิท</div><div class="sig-role">( ผู้จัดทำรายงาน )</div></div>
    <div class="sig-box"><div class="sig-line">ลงชื่อ.................................................</div><div class="sig-name">คุณสุรพล จึงวิวัฒนาภรณ์</div><div class="sig-role">( กรรมการผู้จัดการ )</div></div>
  </div>
  </body></html>`);
  w.document.close();
}

// ════════════════════════════════════════
//  RELEASE REPORT PAGE
// ════════════════════════════════════════
function initReleaseReportPage() {
  const inp = document.getElementById('releaseReportDate');
  if (inp && !inp.value) inp.value = formatDateInput(new Date());
}
function runReleaseReportPage() {
  const dateVal = document.getElementById('releaseReportDate').value;
  if (!dateVal) { toast('กรุณาเลือกวันที่ปล่อยรถ', 'err'); return; }
  const [y, m, d] = dateVal.split('-');
  const list = (allBookings||[]).filter(b => b['วันที่ปล่อย'] && fmtDate(String(b['วันที่ปล่อย']).trim())===fmtDate(dateVal));
  const rDate = new Date(`${y}-${m}-${d}T00:00:00`);
  const dateStr = thDateFull(rDate);
  const curYM = rDate.getFullYear()+'-'+String(rDate.getMonth()+1).padStart(2,'0');
  const monthLabel = thMonthYear(curYM);
  document.getElementById('releaseReportPreviewTitle').textContent = `รายงานการปล่อยรถ ประจำเดือน ${monthLabel}`;
  document.getElementById('releaseReportPreviewSub').textContent   = `ประจำวันที่ ${dateStr}`;
  document.getElementById('releaseReportCount').textContent = list.length + ' คัน';
  const tbody = document.getElementById('releaseReportBody');
  if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="9"><div class="empty">ไม่พบรถที่ปล่อยในวันที่เลือก</div></td></tr>'; }
  else { tbody.innerHTML = list.map(b => `<tr>
    <td class="c" style="font-weight:800;font-size:13px;color:#c0392b;">${b['ไฟแนนซ์']||'—'}</td>
    <td style="font-weight:600;">${b['ชื่อรุ่นรถ']||b['รายละเอียดรถ']||'—'}</td>
    <td class="mono" style="font-size:11px;">${b['เลขเครื่อง']||'—'}</td>
    <td class="mono" style="font-size:11px;">${b['เลขแชสซีส์']||'—'}</td>
    <td style="font-weight:600;">${b['ลูกค้ารับรถ']||b['ชื่อลูกค้า']||'—'}</td>
    <td class="c" style="font-weight:800;color:#c0392b;">${b['เลขทะเบียน']||'—'}</td>
    <td class="c">${b['เลขส่งมอบ']||'—'}</td>
    <td class="c">${b['เลข PO']||'—'}</td>
    <td>${b['ที่ปรึกษาการขาย']||'—'}</td>
  </tr>`).join(''); }
  document.getElementById('releaseReportPreviewCard').style.display = '';
  document.getElementById('releaseReportPrintBtn').style.display    = '';
  window._releaseReportList = list;
  window._releaseReportDate = rDate;
}
function doReleaseReportPage() {
  const list = window._releaseReportList, rDate = window._releaseReportDate;
  if (!list || !rDate) { toast('กรุณาแสดงรายงานก่อน', 'err'); return; }
  printReleaseReportFromList(list, rDate);
}

// ════════════════════════════════════════
//  FINANCE
// ════════════════════════════════════════
const FINANCE_FALLBACK = ['TIL','TMT','TISCO','KBANK','SCB','BBL','KTB','BAY','AYCAL','MTL','ICBC','เงินสด'];
function getFinanceOptions() { return (meta.finance && meta.finance.length) ? meta.finance : FINANCE_FALLBACK; }
function populateFinanceSelect(currentVal) {
  const sel = document.getElementById('rl-finance');
  sel.innerHTML = '<option value="">-- เลือก --</option>';
  getFinanceOptions().forEach(f => { const o=document.createElement('option'); o.value=f; o.textContent=f; sel.appendChild(o); });
  const oCustom=document.createElement('option'); oCustom.value='__custom__'; oCustom.textContent='✏️ พิมพ์เอง'; sel.appendChild(oCustom);
  if (currentVal) {
    sel.value = currentVal;
    if (sel.value !== currentVal) { sel.value='__custom__'; document.getElementById('rl-finance-custom').value=currentVal; document.getElementById('rl-finance-custom-wrap').style.display=''; }
    else { document.getElementById('rl-finance-custom-wrap').style.display='none'; document.getElementById('rl-finance-custom').value=''; }
  } else { document.getElementById('rl-finance-custom-wrap').style.display='none'; document.getElementById('rl-finance-custom').value=''; }
}
function onFinanceSelectChange() {
  const sel = document.getElementById('rl-finance');
  document.getElementById('rl-finance-custom-wrap').style.display = sel.value==='__custom__'?'':'none';
  if (sel.value !== '__custom__') document.getElementById('rl-finance-custom').value = '';
}
function getFinanceValue() {
  const sel = document.getElementById('rl-finance');
  return sel.value==='__custom__' ? document.getElementById('rl-finance-custom').value.trim() : sel.value;
}

// ════════════════════════════════════════
//  SUMMARY TOOLTIP
// ════════════════════════════════════════
let _sumTipEl = null;
function showSumTip(e, labelEnc, dataKey) {
  hideSumTip();
  const label = decodeURIComponent(labelEnc);
  const rows  = window[dataKey] || [];
  const isCL2    = label.startsWith('ถอนจอง');
  const isRS2    = label.startsWith('ยอดปล่อย');
  const isCarry = label.startsWith('จองยกมา');
  const isTotal = label.startsWith('รวมจองปัจจุบัน');
  const color   = isCL2?'#e74c3c':isRS2?'#27ae60':isCarry?'#7b5ea7':isTotal?'#2471a0':'#e8a020';
  const icon    = isCL2?'❌':isRS2?'🚗':isCarry?'📋':isTotal?'📊':'🧡';
  const tip = document.createElement('div'); tip.id='sumTip';
  const parts = label.split(' · ');
  let html = `<div style="font-weight:700;font-size:13px;color:${color};margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:7px;display:flex;align-items:center;gap:6px;">
    <span>${icon}</span><div><div>${parts[0]}</div>${parts.slice(1).join(' · ')?`<div style="font-size:10px;color:rgba(255,255,255,0.6);font-weight:500;">${parts.slice(1).join(' · ')}</div>`:''}</div></div>`;
  if (!rows.length) { html += `<div style="color:rgba(255,255,255,0.45);font-size:12px;">ไม่มีรายการ</div>`; }
  else {
    rows.forEach(r => { html += `<div style="display:flex;align-items:baseline;gap:8px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
      <span style="font-size:10px;color:rgba(255,255,255,0.45);white-space:nowrap;flex-shrink:0;">${r.date||'—'}</span>
      <span style="flex:1;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.name||'—'}</span>
      <span style="font-size:11px;background:rgba(255,255,255,0.12);padding:1px 7px;border-radius:8px;flex-shrink:0;color:#f5c842;">${r.model||'—'}</span>
    </div>`; });
    html += `<div style="margin-top:8px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.12);font-size:10px;color:rgba(245,200,66,0.7);text-align:right;">${rows.length} รายการ</div>`;
  }
  tip.innerHTML = html;
  document.body.appendChild(tip); _sumTipEl = tip;
  const margin=14, tw=tip.offsetWidth||240, th2=tip.offsetHeight||120;
  let x=e.clientX+margin, y=e.clientY+margin;
  if (x+tw>window.innerWidth-margin) x=e.clientX-tw-margin;
  if (y+th2>window.innerHeight-margin) y=e.clientY-th2-margin;
  tip.style.left=x+'px'; tip.style.top=y+'px';
}
function hideSumTip() { if (_sumTipEl) { _sumTipEl.remove(); _sumTipEl=null; } }
document.addEventListener('click', e => { if (_sumTipEl && !e.target.classList.contains('sum-clickable')) hideSumTip(); });
document.addEventListener('keydown', e => { if (e.key==='Escape') hideSumTip(); });

// ════════════════════════════════════════
//  SUMMARY REPORT
// ════════════════════════════════════════
async function runSummaryReport() {
  ['sumBodySmall','sumBodyBig'].forEach(id => { document.getElementById(id).innerHTML = '<div class="loader"><div class="loader-spin"></div><br>กำลังโหลด...</div>'; });
  try {
    const dAll = await callGS({ action: 'getBookings' });
    const allRows = dAll.data || [];
    const rDate = window._reportDate || new Date();
    const curYM = rDate.getFullYear()+'-'+String(rDate.getMonth()+1).padStart(2,'0');
    const curRows  = allRows.filter(r => dateMatchMonth(r['วันที่จอง'], curYM));
    const prevRows = allRows.filter(r => !dateMatchMonth(r['วันที่จอง'], curYM));
    const today = rDate.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
    const monthLabel = thMonthYear(curYM);
    const fixedSrc = ['เพจบริษัท','เพจส่วนตัว','Lead TIS'];
    const srcCols  = [...fixedSrc, 'อื่นๆ'];
    const smallModels = ['STD','SPC','CAB 4','CAB 4 HR','MU-X'];
    const bigModels   = ['2T','3T','6W','10W,12W','T/H'];
    const allModel1 = (meta.model||[]).map(m => ({ m1:(m['รุ่นรถ1']||'').trim(), dept:(m['ฝ่าย']||m['dept']||'').toString() })).filter(x=>x.m1);
    const smallModelCols = allModel1.length ? [...new Set(allModel1.filter(x=>x.dept.includes('เล็ก')||(!x.dept&&smallModels.includes(x.m1))).map(x=>x.m1))] : smallModels;
    const bigModelCols   = allModel1.length ? [...new Set(allModel1.filter(x=>x.dept.includes('ใหญ่')||(!x.dept&&bigModels.includes(x.m1))).map(x=>x.m1))]  : bigModels;
    const finalSmall = smallModelCols.length ? smallModelCols : smallModels;
    const finalBig   = bigModelCols.length   ? bigModelCols   : bigModels;
    const scSmall = meta.sc.filter(s => (s['ฝ่าย']||'').includes('เล็ก'));
    const scBig   = meta.sc.filter(s => (s['ฝ่าย']||'').includes('ใหญ่'));
    document.getElementById('sumSubLabel').textContent = `ข้อมูล ณ วันที่ ${today} — ประจำเดือน ${monthLabel}`;
    renderSummary('small', scSmall, curRows, prevRows, allRows, srcCols, fixedSrc, finalSmall, monthLabel, today, curYM);
    renderSummary('big',   scBig,   curRows, prevRows, allRows, srcCols, fixedSrc, finalBig,   monthLabel, today, curYM);
  } catch(e) {
    ['sumBodySmall','sumBodyBig'].forEach(id => { document.getElementById(id).innerHTML = `<div class="empty">❌ ${e.message}</div>`; });
  }
}

function renderSummary(type, scList, curRows, prevRows, allRows, srcCols, fixedSrc, modelCols, monthLabel, today, curYM) {
  const suffix  = type==='small'?'Small':'Big';
  const bodyEl  = document.getElementById('sumBody'+suffix);
  const titleEl = document.getElementById('sumTitle'+suffix);
  const dateEl  = document.getElementById('sumDate'+suffix);
  const deptName= type==='small'?'ฝ่ายขายรถเล็ก':'ฝ่ายขายรถใหญ่';
  titleEl.textContent = `รายงานสรุปยอดจองและยอดปล่อยรถ ประจำเดือน ${monthLabel}  —  ${deptName}`;
  titleEl.style.fontSize='16px'; titleEl.style.fontWeight='800';
  dateEl.innerHTML = `<span class="date-badge-r3"><span class="lbl">ณ วันที่</span><span class="val">${today}</span></span>`;
  if (!scList.length) { bodyEl.innerHTML='<div class="empty">ไม่มี SC ในฝ่ายนี้</div>'; return; }
  const sorted = [...scList].sort((a,b) => { const ta=a['ทีม']||'',tb=b['ทีม']||''; if(ta!==tb) return ta.localeCompare(tb,'th'); return parseInt(a['ลำดับ']||99)-parseInt(b['ลำดับ']||99); });
  const calcSC = (sc) => {
    const name = sc['ที่ปรึกษาการขาย'];
    const carryRows = prevRows.filter(r => r['ที่ปรึกษาการขาย']===name && (isBK(r['สถานะ'])||isERS(r['สถานะ'])) && !isCL(r['สถานะ']));
    const bkThisRows = curRows.filter(r => r['ที่ปรึกษาการขาย']===name && isBK(r['สถานะ']));
    const normM = s=>(s||'').trim();
    const getM1fromRow = r => { const found=(meta.model||[]).find(m=>normM(m['รุ่นรถ'])===normM(r['รุ่นรถ'])); return found?normM(found['รุ่นรถ1']):normM(r['รุ่นรถ']); };
    const srcThisRows = curRows.filter(r => r['ที่ปรึกษาการขาย']===name && !isCL(r['สถานะ']));
    const srcCount = {};
    fixedSrc.forEach(s => { srcCount[s]=srcThisRows.filter(r=>r['ที่มาลูกค้า']===s).length; });
    srcCount['อื่นๆ'] = srcThisRows.filter(r=>!fixedSrc.includes(r['ที่มาลูกค้า'])&&r['ที่มาลูกค้า']).length;
    const carryNotRel = carryRows.filter(r=>!r['วันที่ปล่อย']).length;
    const bkNotRel    = bkThisRows.filter(r=>!r['วันที่ปล่อย']).length;
    const totalCurrent = carryNotRel + bkNotRel;
    const rsThisRows = allRows.filter(r => r['ที่ปรึกษาการขาย']===name && r['วันที่ปล่อย'] && dateMatchMonth(r['วันที่ปล่อย'],curYM));
    const clRows = allRows.filter(r => r['ที่ปรึกษาการขาย']===name && isCL(r['สถานะ']) && r['วันที่ยกเลิกจอง'] && dateMatchMonth(r['วันที่ยกเลิกจอง'],curYM));
    return { name, carry:carryRows.length, bkTotal:bkThisRows.length, srcCount, totalCurrent, rsTotal:rsThisRows.length, cl:clRows.length, ทีม:sc['ทีม']||'',
      _carryRows:carryRows, _bkThisRows:bkThisRows, _rsThisRows:rsThisRows, _clRows:clRows,
      _totalRows:[...carryRows.filter(r=>!r['วันที่ปล่อย']),...bkThisRows.filter(r=>!r['วันที่ปล่อย'])],
      _getM1:getM1fromRow, _normM:normM };
  };
  const teams={};
  sorted.forEach(sc => { const t=sc['ทีม']||'(ไม่ระบุ)'; if(!teams[t]) teams[t]=[]; teams[t].push(calcSC(sc)); });
  const mLen=modelCols.length||1, sLen=srcCols.length;
  const modelBkHdr=modelCols.length?modelCols.map(m=>`<th class="th-bk" style="font-weight:600;font-size:9px;">${m}</th>`).join(''):'<th class="th-bk">—</th>';
  const modelRsHdr=modelCols.length?modelCols.map(m=>`<th class="th-rs" style="font-weight:600;font-size:9px;">${m}</th>`).join(''):'<th class="th-rs">—</th>';
  const srcHdr=srcCols.map(s=>`<th class="th-src" style="font-weight:600;font-size:10px;">${s}</th>`).join('');
      const colgroupCols=[`<col style="width:100px;">`,`<col style="width:48px;">`,...modelCols.map(()=>`<col style="width:46px;">`),...[`<col style="width:48px;">`],...srcCols.map(()=>`<col style="width:50px;">`),`<col style="width:60px;">`,...modelCols.map(()=>`<col style="width:46px;">`),...[`<col style="width:48px;">`],`<col style="width:48px;">`].join('');
  let html=`<table class="sum-table" style="font-size:11px;"><colgroup>${colgroupCols}</colgroup><thead><tr>
    <th rowspan="2" class="th-carry" style="text-align:left;">SC</th>
    <th rowspan="2" class="th-carry">ยกมา</th>
    <th colspan="${mLen+1}" class="th-bk">จองเดือนนี้</th>
    <th colspan="${sLen}" class="th-src">แหล่งที่มา (จองเดือนนี้)</th>
    <th rowspan="2" class="th-total">รวมจอง<br>ปัจจุบัน</th>
    <th colspan="${mLen+1}" class="th-rs">ปล่อยเดือนนี้</th>
    <th rowspan="2" class="th-cl">ถอนจอง</th>
  </tr><tr>${modelBkHdr}<th class="th-bk bk-total-col" style="color:#7a4000;font-weight:800;">รวมจอง</th>${srcHdr}${modelRsHdr}<th class="th-rs rs-total-col" style="color:#0a5c2a;font-weight:800;">รวมปล่อย</th></tr></thead><tbody>`;
  let gCarry=0,gBkT=0,gSrc={},gTotal=0,gRsT=0,gCl=0;
  const gBkMdl={},gRsMdl={};
  modelCols.forEach(m=>{gBkMdl[m]=0;gRsMdl[m]=0;}); srcCols.forEach(s=>gSrc[s]=0);
  if (!window._sumData) window._sumData={};
  Object.entries(teams).forEach(([team, members]) => {
    html+=`<tr class="row-team"><td colspan="${3+mLen+sLen+mLen+2}" style="text-align:left;padding-left:14px;">ทีม ${team}</td></tr>`;
    let tCarry=0,tBkT=0,tSrc={},tTotal=0,tRsT=0,tCl=0;
    const tBkMdl={},tRsMdl={};
    modelCols.forEach(m=>{tBkMdl[m]=0;tRsMdl[m]=0;}); srcCols.forEach(s=>tSrc[s]=0);
    members.forEach((d,idx) => {
      const rowCls=idx%2===0?'row-odd':'row-even';
      const clickTd=(val,rows,label,cssClass,dateField='วันที่จอง',extraStyle='')=>{
        if (!val) return `<td class="${cssClass} td-num td-zero" style="${extraStyle}">0</td>`;
        const dataKey='_sr_'+(Math.random().toString(36).slice(2));
        window[dataKey]=rows.map(r=>({date:fmtDate(r[dateField]||r['วันที่จอง']||''),name:r['ชื่อลูกค้า']||'',model:r['ชื่อรุ่นรถ']||r['รายละเอียดรถ']||r['รุ่นรถ']||''}));
        return `<td class="${cssClass} td-num sum-clickable" style="cursor:pointer;${extraStyle}" onclick="showSumTip(event,'${encodeURIComponent(label)}','${dataKey}')" title="คลิกดูรายละเอียด">${val}</td>`;
      };
      const bkMdlCells=modelCols.map(m=>{const rows=(d._bkThisRows||[]).filter(r=>(r['รุ่นรถ']||'').trim()===m.trim());const v=rows.length;tBkMdl[m]+=v;gBkMdl[m]+=v;return clickTd(v,rows,`จองเดือนนี้ · ${m} · ${d.name}`,'td-bk','วันที่จอง');}).join('');
      const srcCells=srcCols.map(s=>{const rows=s==='อื่นๆ'?(d._bkThisRows||[]).filter(r=>!fixedSrc.includes(r['ที่มาลูกค้า'])&&r['ที่มาลูกค้า']):(d._bkThisRows||[]).filter(r=>r['ที่มาลูกค้า']===s);const v=rows.length;tSrc[s]+=v;gSrc[s]+=v;return clickTd(v,rows,`แหล่งที่มา · ${s} · ${d.name}`,'td-src','วันที่จอง');}).join('');
      const rsMdlCells=modelCols.map(m=>{const rows=(d._rsThisRows||[]).filter(r=>(r['รุ่นรถ']||'').trim()===m.trim());const v=rows.length;tRsMdl[m]+=v;gRsMdl[m]+=v;return clickTd(v,rows,`ปล่อยเดือนนี้ · ${m} · ${d.name}`,'td-rs','วันที่ปล่อย');}).join('');
      tCarry+=d.carry;tBkT+=d.bkTotal;tTotal+=d.totalCurrent;tRsT+=d.rsTotal;tCl+=d.cl;
      html+=`<tr class="${rowCls}"><td class="name-cell" style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.name}</td>
        ${clickTd(d.carry,d._carryRows||[],`จองยกมา · ${d.name}`,'td-carry','วันที่จอง')}
        ${bkMdlCells}
        ${clickTd(d.bkTotal,d._bkThisRows||[],`รวมจองเดือนนี้ · ${d.name}`,'bk-total-col','วันที่จอง')}
        ${srcCells}
        ${clickTd(d.totalCurrent,d._totalRows||[],`รวมจองปัจจุบัน · ${d.name}`,'td-total','วันที่จอง')}
        ${rsMdlCells}
        ${clickTd(d.rsTotal,d._rsThisRows||[],`ยอดปล่อย · ${d.name}`,'rs-total-col','วันที่ปล่อย')}
        ${clickTd(d.cl,d._clRows||[],`ถอนจอง · ${d.name}`,'td-cl','วันที่ยกเลิกจอง')}
      </tr>`;
    });
    const tBkMdlC=modelCols.map(m=>`<td class="td-bk td-num" style="border-top:2px solid #e8a020;font-weight:700;">${tBkMdl[m]||0}</td>`).join('');
    const tSrcC=srcCols.map(s=>`<td class="td-src td-num" style="border-top:2px solid #c0392b;font-weight:700;">${tSrc[s]||0}</td>`).join('');
    const tRsMdlC=modelCols.map(m=>`<td class="td-rs td-num" style="border-top:2px solid #1a7a4a;font-weight:700;">${tRsMdl[m]||0}</td>`).join('');
    gCarry+=tCarry;gBkT+=tBkT;gTotal+=tTotal;gRsT+=tRsT;gCl+=tCl;
    html+=`<tr class="row-team-total"><td class="name-cell">รวม ทีม ${team}</td><td class="td-carry td-num" style="border-top:2px solid #3498db;font-weight:700;">${tCarry}</td>${tBkMdlC}<td class="bk-total-col td-num" style="border-top:2px solid #e8a020;font-weight:700;">${tBkT}</td>${tSrcC}<td class="td-total td-num" style="border-top:2px solid #1a5276;font-weight:700;">${tTotal}</td>${tRsMdlC}<td class="rs-total-col td-num" style="border-top:2px solid #1a7a4a;font-weight:700;">${tRsT}</td><td class="td-cl td-num" style="border-top:2px solid #c0392b;font-weight:700;">${tCl}</td></tr>`;
  });
  const gBkMdlC=modelCols.map(m=>`<td class="td-bk td-num" style="font-weight:700;">${gBkMdl[m]||0}</td>`).join('');
  const gSrcC=srcCols.map(s=>`<td class="td-src td-num" style="font-weight:700;">${gSrc[s]||0}</td>`).join('');
  const gRsMdlC=modelCols.map(m=>`<td class="td-rs td-num" style="font-weight:700;">${gRsMdl[m]||0}</td>`).join('');
  html+=`</tbody><tfoot><tr class="row-grand"><td class="name-cell">รวมทั้งหมด</td><td class="td-carry td-num">${gCarry}</td>${gBkMdlC}<td class="bk-total-col td-num">${gBkT}</td>${gSrcC}<td class="td-total td-num">${gTotal}</td>${gRsMdlC}<td class="rs-total-col td-num">${gRsT}</td><td class="td-cl td-num">${gCl}</td></tr></tfoot></table>`;
  bodyEl.innerHTML=html;
}

function printSummaryReport() { window.print(); }

// ════════════════════════════════════════
//  CUSTLIST REPORT
// ════════════════════════════════════════
function populateBookingFinance() {
  const sel = document.getElementById('mFinance');
  if (!sel) return;
  const list = (meta.finance&&meta.finance.length)?meta.finance:['TIL','IBCB','KBANK','TISCO','BAY','SCB','KTC','TTB','อื่นๆ'];
  sel.innerHTML = '<option value="">-- ไม่ระบุ --</option>';
  list.forEach(f => { const o=document.createElement('option'); o.value=o.textContent=f; sel.appendChild(o); });
}

async function runCustListReport() {
  document.getElementById('clBody').innerHTML = '<div class="loader"><div class="loader-spin"></div><br>กำลังโหลด...</div>';
  try {
    const dAll = await callGS({ action: 'getBookings' });
    const allRows = dAll.data || [];
    const now = new Date();
    const curYM = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    const today = now.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
    const monthLabel = thMonthYear(curYM);
    document.getElementById('clSubLabel').textContent = `ข้อมูล ณ วันที่ ${today} — ประจำเดือน ${monthLabel}`;
    const scSmall = meta.sc.filter(s=>(s['ฝ่าย']||'').includes('เล็ก'));
    const scBig   = meta.sc.filter(s=>(s['ฝ่าย']||'').includes('ใหญ่'));
    let html = '';
    html += renderCustListDept('ฝ่ายขายรถเล็ก', scSmall, allRows, curYM, monthLabel, today);
    html += renderCustListDept('ฝ่ายขายรถใหญ่', scBig,   allRows, curYM, monthLabel, today);
    document.getElementById('clBody').innerHTML = html;
  } catch(e) { document.getElementById('clBody').innerHTML = `<div class="empty">❌ ${e.message}</div>`; }
}

function renderCustListDept(deptName, scList, allRows, curYM, monthLabel, today) {
  if (!scList.length) return '';
  const sorted = [...scList].sort((a,b) => { const ta=a['ทีม']||'',tb=b['ทีม']||''; if(ta!==tb) return ta.localeCompare(tb,'th'); return parseInt(a['ลำดับ']||99)-parseInt(b['ลำดับ']||99); });
  const teams = {};
  sorted.forEach(sc => { const t=sc['ทีม']||'(ไม่ระบุ)'; if(!teams[t]) teams[t]=[]; teams[t].push(sc); });
  const isSmall = deptName.includes('เล็ก');
  const smallModels=['STD','SPC','CAB 4','CAB 4 HR','MU-X'];
  const bigModels=['2T','3T','6W','10W,12W','T/H'];
  const allModel1=(meta.model||[]).map(m=>({m1:(m['รุ่นรถ1']||'').trim(),dept:(m['ฝ่าย']||'').toString()})).filter(x=>x.m1);
  let modelCols;
  if (allModel1.length) {
    const key=isSmall?'เล็ก':'ใหญ่';
    const cols=[...new Set(allModel1.filter(x=>x.dept.includes(key)).map(x=>x.m1))];
    modelCols=cols.length?cols:(isSmall?smallModels:bigModels);
  } else { modelCols=isSmall?smallModels:bigModels; }
  const modelColors=['#3568c8','#2e9e6a','#e8a020','#9b59b6','#c0392b','#16a085','#d35400'];

  // ── แก้บัค: norm ไม่ตัด comma ──
  const makeChipRow = (rows, isRS) => {
    const norm  = s => (s||'').trim().toLowerCase();
    const getM1 = r => {
      const rv    = norm(r['รุ่นรถ']);
      const found = (meta.model||[]).find(m => norm(m['รุ่นรถ']) === rv);
      return found ? norm(found['รุ่นรถ1']) : '';
    };
    const counts={};
    modelCols.forEach(m=>{counts[norm(m)]=0;});
    rows.forEach(r=>{const m1=getM1(r);if(m1&&counts[m1]!==undefined)counts[m1]++;});
    const total=rows.length;
    if (!total) return `<div class="cl-chip-row"><span style="font-size:9px;color:${isRS?'#0a5c2a':'#7d4e00'};opacity:0.5;">ไม่มีรายการ</span></div>`;
    const chipClass=isRS?'cl-chip-rs':'cl-chip-bk';
    const dotClass=isRS?'cl-chip-rs-dot':'cl-chip-bk-dot';
    const badgeClass=isRS?'cl-chip-rs-badge':'cl-chip-bk-badge';
    const totalClass=isRS?'cl-chip-total-rs':'cl-chip-total-bk';
    let chips='';
    modelCols.forEach((m,i)=>{const key=norm(m);if(!counts[key])return;chips+=`<div class="${chipClass}"><span class="${dotClass}" style="background:${modelColors[i%modelColors.length]};"></span>${m}<span class="${badgeClass}">${counts[key]}</span></div>`;});
    return `<div class="cl-chip-row">${chips}<div class="${totalClass}">รวม ${total}</div></div>`;
  };

  let html='';
  Object.entries(teams).forEach(([team, members]) => {
    const teamScNames=members.map(s=>s['ที่ปรึกษาการขาย']);
    const teamBkRows=allRows.filter(r=>teamScNames.includes(r['ที่ปรึกษาการขาย'])&&(isBK(r['สถานะ'])||isERS(r['สถานะ']))&&!isCL(r['สถานะ']));
    const teamRsRows=allRows.filter(r=>teamScNames.includes(r['ที่ปรึกษาการขาย'])&&r['วันที่ปล่อย']&&dateMatchMonth(r['วันที่ปล่อย'],curYM));
    const bkChipHtml=makeChipRow(teamBkRows,false);
    const rsChipHtml=makeChipRow(teamRsRows,true);
    html+=`<div class="cl-report-block cl-team-block">
      <div class="cl-report-title">รายชื่อลูกค้าจองและปล่อย ประจำเดือน ${monthLabel}<span class="cl-report-date">ณ วันที่ ${today}</span></div>
      <div class="cl-dept-bar">สาขาสุวินทวงศ์ ${deptName} ( ทีม ${team} )</div>
      <table class="cl-table">
        <colgroup><col class="cl-col-sc"><col class="cl-col-total"><col class="cl-col-date"><col class="cl-col-name"><col class="cl-col-model"><col class="cl-col-fn"><col class="cl-col-rs"><col class="cl-col-date"><col class="cl-col-name"><col class="cl-col-model"><col class="cl-col-fn"></colgroup>
        <thead>
          <tr>
            <th class="cl-th-sc" rowspan="3">ที่ปรึกษา<br>การขาย SC</th>
            <th class="cl-th-total" rowspan="3">รวมยอดจอง<br>ปัจจุบัน</th>
            <th class="cl-th-bk" colspan="4">ยอดจอง (ทั้งหมด)</th>
            <th class="cl-th-rs" rowspan="3">ยอด<br>ปล่อย</th>
            <th class="cl-th-rsdet" colspan="4">รายละเอียดการปล่อย (เดือนนี้)</th>
          </tr>
          <tr>
            <td class="cl-th-bk" colspan="4" style="padding:0;">${bkChipHtml}</td>
            <td class="cl-th-rsdet" colspan="4" style="padding:0;">${rsChipHtml}</td>
          </tr>
          <tr>
            <th class="cl-th-bk">วันที่จอง</th><th class="cl-th-bk">ชื่อลูกค้า (รุ่นรถ)</th><th class="cl-th-bk">กลุ่มรถ</th><th class="cl-th-bk">F/N</th>
            <th class="cl-th-rsdet">วันที่ปล่อย</th><th class="cl-th-rsdet">ชื่อลูกค้า (รุ่นรถ)</th><th class="cl-th-rsdet">กลุ่มรถ</th><th class="cl-th-rsdet">F/N</th>
          </tr>
        </thead>
        <tbody>`;
    members.forEach(sc => {
      const name=sc['ที่ปรึกษาการขาย'];
      const bkRows=allRows.filter(r=>r['ที่ปรึกษาการขาย']===name&&(isBK(r['สถานะ'])||isERS(r['สถานะ']))&&!isCL(r['สถานะ'])).sort((a,b)=>(parseThDate(b['วันที่จอง'])||0)-(parseThDate(a['วันที่จอง'])||0));
      const rsRows=allRows.filter(r=>r['ที่ปรึกษาการขาย']===name&&r['วันที่ปล่อย']&&dateMatchMonth(r['วันที่ปล่อย'],curYM)).sort((a,b)=>(parseThDate(b['วันที่ปล่อย'])||0)-(parseThDate(a['วันที่ปล่อย'])||0));
      const bkCount=bkRows.length,rsCount=rsRows.length,maxRows=Math.max(bkCount,rsCount,1);
      for (let i=0;i<maxRows;i++) {
        const bk=bkRows[i],rs=rsRows[i];
        const rowBg=i%2===1?'background:#eeeeee;':'background:#ffffff;';
        const bkDate=bk?fmtThDate(bk['วันที่จอง']):'';
        const bkNameHtml=bk?(bk['ชื่อลูกค้า']?`<span style="white-space:nowrap;">${bk['ชื่อลูกค้า']}</span>${(bk['ชื่อรุ่นรถ']||bk['รายละเอียดรถ'])?`<span class="cl-model-sub">${bk['ชื่อรุ่นรถ']||bk['รายละเอียดรถ']}</span>`:''}`:'' ):'';
        const rsDate=rs?fmtThDate(rs['วันที่ปล่อย']):'';
        const rsNameHtml=rs?(rs['ชื่อลูกค้า']?`<span style="white-space:nowrap;">${rs['ชื่อลูกค้า']}</span>${(rs['ชื่อรุ่นรถ']||rs['รายละเอียดรถ'])?`<span class="cl-model-sub">${rs['ชื่อรุ่นรถ']||rs['รายละเอียดรถ']}</span>`:''}`:'' ):'';
        if (i===0) {
          html+=`<tr>
            <td class="cl-td-sc" rowspan="${maxRows}">${name}</td>
            <td class="cl-td-total" rowspan="${maxRows}">${bkCount||0}</td>
            <td style="${rowBg}">${bkDate}</td>
            <td class="cl-td-name" style="${rowBg}">${bkNameHtml}</td>
            <td class="model-cell" style="${rowBg}">${bk?bk['รุ่นรถ']||'':''}</td>
            <td style="${rowBg}">${bk?bk['ไฟแนนซ์']||'':''}</td>
            <td class="cl-td-rs" rowspan="${maxRows}">${rsCount||0}</td>
            <td style="${rowBg}">${rsDate}</td>
            <td class="cl-td-name" style="${rowBg}">${rsNameHtml}</td>
            <td class="model-cell" style="${rowBg}">${rs?rs['รุ่นรถ']||'':''}</td>
            <td style="${rowBg}">${rs?rs['ไฟแนนซ์']||'':''}</td>
          </tr>`;
        } else {
          html+=`<tr>
            <td style="${rowBg}">${bkDate}</td>
            <td class="cl-td-name" style="${rowBg}">${bkNameHtml}</td>
            <td class="model-cell" style="${rowBg}">${bk?bk['รุ่นรถ']||'':''}</td>
            <td style="${rowBg}">${bk?bk['ไฟแนนซ์']||'':''}</td>
            <td style="${rowBg}">${rsDate}</td>
            <td class="cl-td-name" style="${rowBg}">${rsNameHtml}</td>
            <td class="model-cell" style="${rowBg}">${rs?rs['รุ่นรถ']||'':''}</td>
            <td style="${rowBg}">${rs?rs['ไฟแนนซ์']||'':''}</td>
          </tr>`;
        }
      }
    });
    html+=`</tbody></table></div>`;
  });
  return html;
}

function fmtThDate(s) {
  if (!s) return '';
  const isoMatch = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${parseInt(isoMatch[1])+543}`;
  const p=String(s).split('/');
  if (p.length>=3) { const y=parseInt(p[2]); return `${p[0].padStart(2,'0')}/${p[1].padStart(2,'0')}/${y<2500?y+543:y}`; }
  const d=new Date(s);
  if (!isNaN(d)) return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()+543}`;
  return s;
}

function printCustList() { window.print(); }

// ════ PWA ════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(r => console.log('SW registered:', r.scope))
      .catch(e => console.warn('SW error:', e));
  });
}

// ════ inject chip CSS ════
(function(){
  const s = document.createElement('style');
  s.textContent = `
.cl-chip-bk{display:inline-flex;align-items:center;gap:3px;background:rgba(255,255,255,0.45);border:0.5px solid rgba(125,78,0,0.3);border-radius:20px;padding:2px 4px 2px 8px;font-size:11px;font-weight:600;color:#7d4e00;white-space:nowrap;flex-shrink:0;}
.cl-chip-bk-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.cl-chip-bk-badge{background:#7d4e00;color:#fde8b8;border-radius:20px;padding:0 7px;font-size:12px;font-weight:700;min-width:20px;text-align:center;}
.cl-chip-rs{display:inline-flex;align-items:center;gap:3px;background:rgba(255,255,255,0.45);border:0.5px solid rgba(10,92,42,0.3);border-radius:20px;padding:2px 4px 2px 8px;font-size:11px;font-weight:600;color:#0a5c2a;white-space:nowrap;flex-shrink:0;}
.cl-chip-rs-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.cl-chip-rs-badge{background:#0a5c2a;color:#c8f0d8;border-radius:20px;padding:0 7px;font-size:12px;font-weight:700;min-width:20px;text-align:center;}
.cl-chip-total-bk{display:inline-flex;align-items:center;background:#7d4e00;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;color:#fde8b8;white-space:nowrap;flex-shrink:0;margin-left:2px;}
.cl-chip-total-rs{display:inline-flex;align-items:center;background:#0a5c2a;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;color:#c8f0d8;white-space:nowrap;flex-shrink:0;margin-left:2px;}
  `;
  document.head.appendChild(s);
})();

init();
