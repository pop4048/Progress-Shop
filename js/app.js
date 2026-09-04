/* ================= Helper ================= */
const $  = s => document.querySelector(s);
const money = n => (+n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const today = () => new Date().toISOString().slice(0,10);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const thDate = d => d ? new Date(d).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'numeric'}) : '-';
const ym = d => (d||'').slice(0,7);

/* ================= เมนู ================= */
const MENU = [
  { group:'ภาพรวม', items:[ ['dashboard','📊 แดชบอร์ด'] ] },
  { group:'งานขาย', items:[
      ['doc/QO','📝 ใบเสนอราคา'], ['doc/DN','🚚 ใบส่งสินค้า'], ['doc/IV','📨 ใบแจ้งหนี้'],
      ['doc/TX','🧾 ใบกำกับภาษี'], ['doc/RC','💵 ใบเสร็จรับเงิน'] ] },
  { group:'สินค้า & สต็อก', items:[
      ['products','📦 รายการสินค้า'], ['categories','🏷️ หมวดหมู่'], ['stock','📥 สต็อกคงเหลือ'] ] },
  { group:'ผู้ติดต่อ', items:[ ['customers','👥 ลูกค้า'], ['suppliers','🏭 ผู้ขาย/ซัพพลายเออร์'] ] },
  { group:'รายจ่าย', items:[ ['purchases','🛒 ซื้อสินค้าเข้าร้าน'], ['expenses','💸 ค่าใช้จ่ายอื่น'] ] },
  { group:'รายงาน', items:[
      ['report-pl','📈 งบกำไรขาดทุน'], ['report-vat','🧮 รายงานภาษี'],
      ['report-ar','⏰ ลูกหนี้คงค้าง'], ['report-top','🏆 สินค้าขายดี'] ] },
  { group:'ตั้งค่า', items:[ ['settings','⚙️ ข้อมูลกิจการ'], ['backup','💾 สำรอง/กู้คืนข้อมูล'] ] }
];

function buildMenu(){
  $('#menu').innerHTML = MENU.map(g =>
    `<div class="nav-group">${g.group}</div>` +
    g.items.map(([r,l]) => `<a class="nav-item" href="#/${r}" data-r="${r}">${l}</a>`).join('')
  ).join('');
}

/* ================= Modal ================= */
function openModal(title, html){
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
const closeModal = () => $('#modal').classList.add('hidden');

/* ================= Router ================= */
function render(){
  const path = (location.hash.slice(2) || 'dashboard');
  document.querySelectorAll('.nav-item').forEach(a =>
    a.classList.toggle('active', a.dataset.r === path || path.startsWith(a.dataset.r + '/')));
  $('#pageActions').innerHTML = '';
  const [page, a1, a2] = path.split('/');
  const db = DB.get();
  $('#brandName').textContent = db.settings.company;

  const pages = {
    dashboard, products, categories, stock, customers, suppliers,
    purchases, expenses, settings, backup,
    'report-pl':reportPL, 'report-vat':reportVat, 'report-ar':reportAR, 'report-top':reportTop
  };
  if (page === 'doc')     return a2 ? docForm(a1, a2 === 'new' ? null : a2) : docList(a1);
  (pages[page] || dashboard)(db);
}
window.addEventListener('hashchange', render);

const setPage = (title, actions='') => { $('#pageTitle').textContent = title; $('#pageActions').innerHTML = actions; };

/* ================= 1. Dashboard ================= */
function dashboard(db){
  setPage('ภาพรวมกิจการ');
  const m = ym(today());
  const revs = revenueDocs(db);
  const inMonth = revs.filter(d => ym(d.date) === m);
  const sum = arr => arr.reduce((s,d) => s + calcDoc(d, db.settings.vatRate).net, 0);
  const cogs = arr => arr.reduce((s,d) => s + calcDoc(d, db.settings.vatRate).cogs, 0);

  const sale = sum(inMonth), cost = cogs(inMonth);
  const exp = db.expenses.filter(e => ym(e.date) === m).reduce((s,e) => s + (+e.amount||0), 0);
  const ar = revs.filter(d => d.status !== 'paid')
                 .reduce((s,d) => s + calcDoc(d, db.settings.vatRate).total, 0);
  const lowStock = db.products.filter(p => (+p.stock||0) <= (+p.minStock||0));

  $('#view').innerHTML = `
  <div class="grid g4">
    ${kpi('ยอดขายเดือนนี้','฿'+money(sale),'c-green')}
    ${kpi('ต้นทุนขาย','฿'+money(cost),'c-orange')}
    ${kpi('กำไรขั้นต้น','฿'+money(sale-cost),'c-blue')}
    ${kpi('ลูกหนี้ค้างชำระ','฿'+money(ar),'c-red')}
  </div>
  <div class="grid g4" style="margin-top:14px">
    ${kpi('ค่าใช้จ่ายเดือนนี้','฿'+money(exp),'c-orange')}
    ${kpi('กำไรสุทธิเดือนนี้','฿'+money(sale-cost-exp), sale-cost-exp>=0?'c-green':'c-red')}
    ${kpi('จำนวนสินค้า', db.products.length + ' รายการ','c-muted')}
    ${kpi('ลูกค้าทั้งหมด', db.customers.length + ' ราย','c-muted')}
  </div>

  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>ยอดขาย 6 เดือนล่าสุด</h3>${barChart(db)}</div>
    <div class="card"><h3>⚠️ สินค้าใกล้หมด</h3>
      ${lowStock.length ? `<table><tr><th>สินค้า</th><th class="tr">คงเหลือ</th><th class="tr">ขั้นต่ำ</th></tr>
        ${lowStock.slice(0,8).map(p=>`<tr><td>${esc(p.name)}</td>
          <td class="tr c-red">${p.stock||0}</td><td class="tr c-muted">${p.minStock||0}</td></tr>`).join('')}</table>`
        : '<div class="empty">สต็อกปกติดีทุกรายการ 👍</div>'}
    </div>
  </div>

  <div class="card"><h3>เอกสารล่าสุด</h3>
    ${db.documents.length ? `<table>
      <tr><th>เลขที่</th><th>ประเภท</th><th>วันที่</th><th>ลูกค้า</th><th class="tr">ยอดรวม</th><th class="tc">สถานะ</th></tr>
      ${db.documents.slice().reverse().slice(0,8).map(d => {
        const c = db.customers.find(x => x.id === d.customerId);
        return `<tr onclick="location.hash='#/doc/${d.type}/${d.id}'" style="cursor:pointer">
          <td><b>${d.no}</b></td><td>${DOC_TYPES[d.type].name}</td><td>${thDate(d.date)}</td>
          <td>${esc(c?.name || '-')}</td>
          <td class="tr">${money(calcDoc(d, db.settings.vatRate).total)}</td>
          <td class="tc">${statusTag(d.status)}</td></tr>`;
      }).join('')}</table>` : '<div class="empty">ยังไม่มีเอกสาร — เริ่มที่ "ใบเสนอราคา" ได้เลย</div>'}
  </div>`;
}
const kpi = (l,v,c='') => `<div class="kpi"><div class="lbl">${l}</div><div class="val ${c}">${v}</div></div>`;
const statusTag = s => ({draft:'<span class="tag t-draft">ร่าง</span>',
  issued:'<span class="tag t-issued">ออกแล้ว</span>', paid:'<span class="tag t-paid">ชำระแล้ว</span>',
  void:'<span class="tag t-void">ยกเลิก</span>'}[s] || '');

function barChart(db){
  const months = [...Array(6)].map((_,i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5-i));
    return d.toISOString().slice(0,7);
  });
  const data = months.map(m => revenueDocs(db).filter(d => ym(d.date) === m)
    .reduce((s,d) => s + calcDoc(d, db.settings.vatRate).net, 0));
  const max = Math.max(...data, 1);
  return `<div style="display:flex;gap:10px;align-items:flex-end;height:150px">
    ${data.map((v,i)=>`<div style="flex:1;text-align:center">
      <div style="font-size:10px;color:#64748b">${v?money(v):''}</div>
      <div style="background:#2563eb;border-radius:6px 6px 0 0;height:${Math.max(v/max*100,2)}px"></div>
      <div style="font-size:11px;color:#64748b;margin-top:4px">${months[i].slice(5)}/${months[i].slice(2,4)}</div>
    </div>`).join('')}</div>`;
}

/* ================= 2. สินค้า ================= */
function products(db){
  setPage('รายการสินค้า', `<button class="btn" onclick="productForm()">+ เพิ่มสินค้า</button>`);
  $('#view').innerHTML = `<div class="card">
    <input id="q" placeholder="🔍 ค้นหาชื่อ/รหัสสินค้า" oninput="filterTable('pTbl',this.value)" style="max-width:320px;margin-bottom:12px">
    <table id="pTbl"><thead><tr>
      <th>รหัส</th><th>ชื่อสินค้า</th><th>หมวด</th><th class="tr">ต้นทุน</th><th class="tr">ราคาขาย</th>
      <th class="tr">กำไร/ชิ้น</th><th class="tr">คงเหลือ</th><th class="tc">จัดการ</th></tr></thead><tbody>
      ${db.products.map(p => {
        const cat = db.categories.find(c => c.id === p.catId);
        return `<tr><td>${esc(p.code||'-')}</td><td><b>${esc(p.name)}</b></td>
        <td class="c-muted">${esc(cat?.name||'-')}</td>
        <td class="tr">${money(p.cost)}</td><td class="tr">${money(p.price)}</td>
        <td class="tr c-green">${money(p.price - p.cost)}</td>
        <td class="tr ${(+p.stock<=+p.minStock)?'c-red':''}">${p.stock||0} ${esc(p.unit||'')}</td>
        <td class="tc"><button class="btn-icon" onclick="productForm('${p.id}')">✏️</button>
        <button class="btn-icon" onclick="delRow('products','${p.id}')">🗑️</button></td></tr>`;
      }).join('')}</tbody></table>
    ${!db.products.length ? '<div class="empty">ยังไม่มีสินค้า กด "+ เพิ่มสินค้า" เพื่อเริ่มต้น</div>' : ''}
  </div>`;
}

function productForm(id){
  const db = DB.get(), p = db.products.find(x => x.id === id) || {};
  openModal(id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่', `
    <div class="grid g2">
      ${fld('รหัสสินค้า','f_code',p.code)}${fld('ชื่อสินค้า','f_name',p.name)}
    </div>
    <div class="field"><label>หมวดหมู่</label><select id="f_cat">
      ${db.categories.map(c=>`<option value="${c.id}" ${p.catId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
    </select></div>
    <div class="grid g3">
      ${fld('หน่วยนับ','f_unit',p.unit||'ชิ้น')}
      ${fld('ต้นทุน (บาท)','f_cost',p.cost,'number')}
      ${fld('ราคาขาย (บาท)','f_price',p.price,'number')}
    </div>
    <div class="grid g2">
      ${fld('สต็อกคงเหลือ','f_stock',p.stock,'number')}
      ${fld('แจ้งเตือนเมื่อต่ำกว่า','f_min',p.minStock,'number')}
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:10px">
      <button class="btn ghost" onclick="closeModal()">ยกเลิก</button>
      <button class="btn" onclick="saveProduct('${id||''}')">บันทึก</button>
    </div>`);
}
const fld = (label,id,val='',type='text') =>
  `<div class="field"><label>${label}</label><input id="${id}" type="${type}" value="${esc(val??'')}"></div>`;

function saveProduct(id){
  const o = { code:f_code.value.trim(), name:f_name.value.trim(), catId:f_cat.value,
    unit:f_unit.value.trim(), cost:+f_cost.value||0, price:+f_price.value||0,
    stock:+f_stock.value||0, minStock:+f_min.value||0 };
  if (!o.name) return alert('กรุณากรอกชื่อสินค้า');
  DB.update(db => {
    if (id) Object.assign(db.products.find(x => x.id === id), o);
    else db.products.push({ id:uid(), ...o });
  });
  closeModal(); render();
}

/* ================= 3. หมวดหมู่ ================= */
function categories(db){
  setPage('หมวดหมู่สินค้า');
  $('#view').innerHTML = `<div class="card">
    <div class="row" style="margin-bottom:12px">
      <input id="catName" placeholder="ชื่อหมวดหมู่ใหม่" style="max-width:280px">
      <button class="btn" onclick="addCat()">+ เพิ่ม</button>
    </div>
    <table><tr><th>ชื่อหมวดหมู่</th><th class="tr">จำนวนสินค้า</th><th class="tc">จัดการ</th></tr>
      ${db.categories.map(c => `<tr><td>${esc(c.name)}</td>
        <td class="tr">${db.products.filter(p=>p.catId===c.id).length}</td>
        <td class="tc"><button class="btn-icon" onclick="delRow('categories','${c.id}')">🗑️</button></td></tr>`).join('')}
    </table></div>`;
}
function addCat(){
  const n = catName.value.trim(); if(!n) return;
  DB.update(db => db.categories.push({ id:uid(), name:n })); render();
}

/* ================= 4. สต็อก ================= */
function stock(db){
  setPage('สต็อกคงเหลือ');
  const totalValue = db.products.reduce((s,p) => s + (+p.stock||0)*(+p.cost||0), 0);
  $('#view').innerHTML = `
    <div class="grid g3">${kpi('มูลค่าสต็อกรวม (ต้นทุน)','฿'+money(totalValue),'c-blue')}
      ${kpi('จำนวน SKU', db.products.length,'c-muted')}
      ${kpi('ใกล้หมด', db.products.filter(p=>+p.stock<=+p.minStock).length + ' รายการ','c-red')}</div>
    <div class="card"><h3>ปรับปรุงสต็อก</h3>
      <table><tr><th>สินค้า</th><th class="tr">คงเหลือ</th><th class="tr">มูลค่า</th><th class="tc">ปรับ (+/-)</th></tr>
      ${db.products.map(p=>`<tr><td>${esc(p.name)}</td>
        <td class="tr"><b>${p.stock||0}</b> ${esc(p.unit||'')}</td>
        <td class="tr">${money((+p.stock||0)*(+p.cost||0))}</td>
        <td class="tc"><input type="number" style="width:90px;display:inline-block"
             id="adj_${p.id}" placeholder="เช่น -2">
          <button class="btn ghost" onclick="adjStock('${p.id}')">ปรับ</button></td></tr>`).join('')}
      </table></div>`;
}
function adjStock(id){
  const v = +$('#adj_'+id).value; if(!v) return;
  DB.update(db => { const p = db.products.find(x=>x.id===id); p.stock = (+p.stock||0) + v; });
  render();
}

/* ================= 5. ลูกค้า / ซัพพลายเออร์ ================= */
const contactPage = (key, title) => db => {
  setPage(title, `<button class="btn" onclick="contactForm('${key}')">+ เพิ่มใหม่</button>`);
  $('#view').innerHTML = `<div class="card"><table>
    <tr><th>ชื่อ</th><th>เลขผู้เสียภาษี</th><th>สาขา</th><th>โทร</th><th>ที่อยู่</th><th class="tc">จัดการ</th></tr>
    ${db[key].map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.taxId||'-')}</td>
      <td>${esc(c.branch||'-')}</td><td>${esc(c.phone||'-')}</td>
      <td class="c-muted">${esc((c.address||'').slice(0,40))}</td>
      <td class="tc"><button class="btn-icon" onclick="contactForm('${key}','${c.id}')">✏️</button>
      <button class="btn-icon" onclick="delRow('${key}','${c.id}')">🗑️</button></td></tr>`).join('')}
    </table>${!db[key].length?'<div class="empty">ยังไม่มีข้อมูล</div>':''}</div>`;
};
const customers = contactPage('customers','ลูกค้า');
const suppliers = contactPage('suppliers','ผู้ขาย / ซัพพลายเออร์');

function contactForm(key, id){
  const db = DB.get(), c = db[key].find(x=>x.id===id) || {};
  openModal(id?'แก้ไขข้อมูล':'เพิ่มข้อมูลใหม่', `
    ${fld('ชื่อ (บุคคล/นิติบุคคล)','c_name',c.name)}
    <div class="grid g2">${fld('เลขประจำตัวผู้เสียภาษี','c_tax',c.taxId)}
      ${fld('สาขา','c_branch',c.branch||'สำนักงานใหญ่')}</div>
    <div class="grid g2">${fld('โทรศัพท์','c_phone',c.phone)}${fld('อีเมล','c_email',c.email)}</div>
    <div class="field"><label>ที่อยู่</label><textarea id="c_addr" rows="3">${esc(c.address||'')}</textarea></div>
    <div class="row" style="justify-content:flex-end">
      <button class="btn ghost" onclick="closeModal()">ยกเลิก</button>
      <button class="btn" onclick="saveContact('${key}','${id||''}')">บันทึก</button></div>`);
}
function saveContact(key,id){
  const o = { name:c_name.value.trim(), taxId:c_tax.value.trim(), branch:c_branch.value.trim(),
              phone:c_phone.value.trim(), email:c_email.value.trim(), address:c_addr.value.trim() };
  if(!o.name) return alert('กรุณากรอกชื่อ');
  DB.update(db => { id ? Object.assign(db[key].find(x=>x.id===id), o) : db[key].push({id:uid(),...o}); });
  closeModal(); render();
}

/* ================= 6. เอกสารขาย ================= */
function docList(type){
  const db = DB.get();
  setPage(DOC_TYPES[type].name, `<button class="btn" onclick="location.hash='#/doc/${type}/new'">+ สร้าง${DOC_TYPES[type].name}</button>`);
  const list = db.documents.filter(d => d.type === type).reverse();
  $('#view').innerHTML = `<div class="card"><table>
    <tr><th>เลขที่</th><th>วันที่</th><th>ลูกค้า</th><th class="tr">ก่อน VAT</th>
        <th class="tr">VAT</th><th class="tr">ยอดสุทธิ</th><th class="tc">สถานะ</th><th class="tc">จัดการ</th></tr>
    ${list.map(d => { const t = calcDoc(d, db.settings.vatRate);
      const c = db.customers.find(x => x.id === d.customerId);
      return `<tr><td><b>${d.no}</b></td><td>${thDate(d.date)}</td><td>${esc(c?.name||'-')}</td>
        <td class="tr">${money(t.net)}</td><td class="tr">${money(t.vat)}</td>
        <td class="tr"><b>${money(t.total)}</b></td><td class="tc">${statusTag(d.status)}</td>
        <td class="tc"><button class="btn-icon" onclick="location.hash='#/doc/${type}/${d.id}'">✏️</button>
          <button class="btn-icon" onclick="printDoc('${d.id}')">🖨️</button>
          <button class="btn-icon" onclick="delRow('documents','${d.id}')">🗑️</button></td></tr>`;
    }).join('')}</table>
    ${!list.length ? `<div class="empty">ยังไม่มี${DOC_TYPES[type].name}</div>` : ''}</div>`;
}

let draft = null;

function docForm(type, id){
  const db = DB.get();
  draft = id ? structuredClone(db.documents.find(d => d.id === id))
             : { id:uid(), type, no:'(บันทึกแล้วออกเลขอัตโนมัติ)', date:today(), dueDate:'',
                 customerId: db.customers[0]?.id || '', items:[], discount:0,
                 hasVat:true, status:'draft', note:'', refId:null };

  setPage(`${DOC_TYPES[type].name} ${id ? draft.no : '(ใหม่)'}`, `
    <button class="btn green" onclick="saveDoc()">💾 บันทึก</button>
    <button class="btn gray" onclick="printDoc('${draft.id}')">🖨️ พิมพ์</button>
    ${id && FLOW[type].length ? FLOW[type].map(t =>
      `<button class="btn ghost" onclick="convertDoc('${t}')">➡️ แปลงเป็น${DOC_TYPES[t].name}</button>`).join('') : ''}
    <button class="btn ghost" onclick="location.hash='#/doc/${type}'">← กลับ</button>`);

  $('#view').innerHTML = `
  <div class="card"><div class="grid g4">
    <div class="field"><label>ลูกค้า</label><select id="d_cus" onchange="draft.customerId=this.value">
      <option value="">— เลือกลูกค้า —</option>
      ${db.customers.map(c=>`<option value="${c.id}" ${draft.customerId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
    </select></div>
    <div class="field"><label>วันที่เอกสาร</label><input type="date" id="d_date" value="${draft.date}" onchange="draft.date=this.value"></div>
    <div class="field"><label>ครบกำหนดชำระ</label><input type="date" id="d_due" value="${draft.dueDate||''}" onchange="draft.dueDate=this.value"></div>
    <div class="field"><label>สถานะ</label><select id="d_st" onchange="draft.status=this.value">
      ${['draft','issued','paid','void'].map(s=>`<option value="${s}" ${draft.status===s?'selected':''}>
        ${({draft:'ร่าง',issued:'ออกเอกสารแล้ว',paid:'ชำระแล้ว',void:'ยกเลิก'})[s]}</option>`).join('')}
    </select></div>
  </div></div>

  <div class="card"><h3>รายการสินค้า</h3>
    <div class="row" style="margin-bottom:12px">
      <select id="pickP" style="max-width:300px">
        ${db.products.map(p=>`<option value="${p.id}">${esc(p.name)} — ${money(p.price)}฿</option>`).join('')}
      </select>
      <input type="number" id="pickQ" value="1" style="width:90px">
      <button class="btn" onclick="addLine()">+ เพิ่มรายการ</button>
      <button class="btn ghost" onclick="addLine(true)">+ รายการอิสระ</button>
    </div>
    <table><thead><tr><th style="width:38%">รายละเอียด</th><th class="tr">จำนวน</th>
      <th class="tr">ราคา/หน่วย</th><th class="tr">ต้นทุน</th><th class="tr">รวมเงิน</th><th></th></tr></thead>
      <tbody id="lineBody"></tbody></table>
  </div>

  <div class="grid g2">
    <div class="card"><label>หมายเหตุ</label>
      <textarea id="d_note" rows="4" onchange="draft.note=this.value">${esc(draft.note||'')}</textarea></div>
    <div class="card">
      <div class="row" style="justify-content:space-between"><span>รวมเป็นเงิน</span><b id="tSub">0.00</b></div>
      <div class="row" style="justify-content:space-between;margin:8px 0"><span>ส่วนลด</span>
        <input type="number" id="d_disc" value="${draft.discount||0}" style="width:120px;text-align:right" oninput="draft.discount=+this.value||0;recalc()"></div>
      <div class="row" style="justify-content:space-between"><span>
        <input type="checkbox" id="d_vat" ${draft.hasVat?'checked':''} onchange="draft.hasVat=this.checked;recalc()" style="width:auto"> VAT ${db.settings.vatRate}%</span>
        <b id="tVat">0.00</b></div>
      <hr style="margin:10px 0;border:0;border-top:1px solid #e2e8f0">
      <div class="row" style="justify-content:space-between;font-size:18px"><b>ยอดสุทธิ</b><b class="c-blue" id="tTotal">0.00</b></div>
      <div class="row" style="justify-content:space-between;margin-top:8px;font-size:12px" class="c-muted">
        <span>กำไรขั้นต้นโดยประมาณ</span><b class="c-green" id="tProfit">0.00</b></div>
    </div>
  </div>`;
  renderLines();
}

function addLine(free){
  const db = DB.get();
  if (free) draft.items.push({ name:'', qty:1, price:0, cost:0 });
  else {
    const p = db.products.find(x => x.id === $('#pickP').value);
    if (!p) return alert('ยังไม่มีสินค้า — ไปเพิ่มที่เมนู "รายการสินค้า" ก่อนนะครับ');
    draft.items.push({ productId:p.id, name:p.name, unit:p.unit, qty:+$('#pickQ').value||1, price:+p.price, cost:+p.cost });
  }
  renderLines();
}
function delLine(i){ draft.items.splice(i,1); renderLines(); }
function editLine(i, f, v){ draft.items[i][f] = f==='name' ? v : (+v||0); recalc(); }

function renderLines(){
  $('#lineBody').innerHTML = draft.items.map((it,i)=>`<tr>
    <td><input value="${esc(it.name)}" onchange="editLine(${i},'name',this.value)"></td>
    <td class="tr"><input type="number" value="${it.qty}" style="width:80px;text-align:right" oninput="editLine(${i},'qty',this.value)"></td>
    <td class="tr"><input type="number" value="${it.price}" style="width:100px;text-align:right" oninput="editLine(${i},'price',this.value)"></td>
    <td class="tr"><input type="number" value="${it.cost}" style="width:100px;text-align:right" oninput="editLine(${i},'cost',this.value)"></td>
    <td class="tr" id="amt${i}">${money(it.qty*it.price)}</td>
    <td class="tc"><button class="btn-icon" onclick="delLine(${i})">🗑️</button></td></tr>`).join('')
    || `<tr><td colspan="6" class="empty">ยังไม่มีรายการ</td></tr>`;
  recalc();
}
function recalc(){
  const t = calcDoc(draft, DB.get().settings.vatRate);
  draft.items.forEach((it,i)=>{ const el=$('#amt'+i); if(el) el.textContent = money(it.qty*it.price); });
  tSub.textContent=money(t.sub); tVat.textContent=money(t.vat);
  tTotal.textContent=money(t.total); tProfit.textContent=money(t.profit);
}

function saveDoc(){
  if (!draft.customerId) return alert('กรุณาเลือกลูกค้า');
  if (!draft.items.length) return alert('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
  DB.update(db => {
    const i = db.documents.findIndex(d => d.id === draft.id);
    if (i > -1) db.documents[i] = draft;
    else {
      draft.no = nextDocNo(draft.type);
      db.documents.push(draft);
      // ใบส่งสินค้า = ตัดสต็อกอัตโนมัติ
      if (draft.type === 'DN') draft.items.forEach(it => {
        const p = db.products.find(x => x.id === it.productId);
        if (p) p.stock = (+p.stock||0) - (+it.qty||0);
      });
    }
  });
  alert('บันทึกเรียบร้อย ✅');
  location.hash = `#/doc/${draft.type}/${draft.id}`; render();
}

function convertDoc(newType){
  const n = structuredClone(draft);
  n.id = uid(); n.type = newType; n.refId = draft.id; n.date = today(); n.status = 'draft';
  DB.update(db => { n.no = null; db.documents.push(n); });
  DB.update(db => { const d = db.documents.find(x=>x.id===n.id); d.no = nextDocNo(newType); });
  location.hash = `#/doc/${newType}/${n.id}`;
}

/* ================= 7. ซื้อสินค้า / ค่าใช้จ่าย ================= */
function purchases(db){
  setPage('ซื้อสินค้าเข้าร้าน', `<button class="btn" onclick="purchaseForm()">+ บันทึกการซื้อ</button>`);
  $('#view').innerHTML = `<div class="card"><table>
    <tr><th>วันที่</th><th>ผู้ขาย</th><th>สินค้า</th><th class="tr">จำนวน</th>
        <th class="tr">ราคา/หน่วย</th><th class="tr">รวม</th><th class="tc"></th></tr>
    ${db.purchases.slice().reverse().map(p=>{
      const s = db.suppliers.find(x=>x.id===p.supplierId);
      const pr = db.products.find(x=>x.id===p.productId);
      return `<tr><td>${thDate(p.date)}</td><td>${esc(s?.name||'-')}</td><td>${esc(pr?.name||'-')}</td>
        <td class="tr">${p.qty}</td><td class="tr">${money(p.cost)}</td>
        <td class="tr"><b>${money(p.qty*p.cost)}</b></td>
        <td class="tc"><button class="btn-icon" onclick="delRow('purchases','${p.id}')">🗑️</button></td></tr>`;
    }).join('')}</table>${!db.purchases.length?'<div class="empty">ยังไม่มีรายการซื้อ</div>':''}</div>`;
}
function purchaseForm(){
  const db = DB.get();
  openModal('บันทึกการซื้อสินค้า', `
    <div class="field"><label>ผู้ขาย</label><select id="pu_sup">
      ${db.suppliers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
    <div class="field"><label>สินค้า</label><select id="pu_prod">
      ${db.products.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
    <div class="grid g3">${fld('วันที่','pu_date',today(),'date')}
      ${fld('จำนวน','pu_qty',1,'number')}${fld('ราคาทุน/หน่วย','pu_cost',0,'number')}</div>
    <p class="c-muted" style="font-size:12px">* บันทึกแล้วระบบจะเพิ่มสต็อกและอัปเดตต้นทุนสินค้าให้อัตโนมัติ</p>
    <div class="row" style="justify-content:flex-end;margin-top:10px">
      <button class="btn ghost" onclick="closeModal()">ยกเลิก</button>
      <button class="btn" onclick="savePurchase()">บันทึก</button></div>`);
}
function savePurchase(){
  const o = { id:uid(), supplierId:pu_sup.value, productId:pu_prod.value,
              date:pu_date.value, qty:+pu_qty.value||0, cost:+pu_cost.value||0 };
  if(!o.productId) return alert('กรุณาเพิ่มสินค้าก่อน');
  DB.update(db => {
    db.purchases.push(o);
    const p = db.products.find(x=>x.id===o.productId);
    if (p){ p.stock = (+p.stock||0) + o.qty; if(o.cost) p.cost = o.cost; }
  });
  closeModal(); render();
}

function expenses(db){
  setPage('ค่าใช้จ่ายอื่น', `<button class="btn" onclick="expenseForm()">+ บันทึกค่าใช้จ่าย</button>`);
  const total = db.expenses.reduce((s,e)=>s+(+e.amount||0),0);
  $('#view').innerHTML = `${kpi('ค่าใช้จ่ายสะสมทั้งหมด','฿'+money(total),'c-orange')}
    <div class="card" style="margin-top:14px"><table>
    <tr><th>วันที่</th><th>หมวด</th><th>รายละเอียด</th><th class="tr">จำนวนเงิน</th><th class="tc"></th></tr>
    ${db.expenses.slice().reverse().map(e=>`<tr><td>${thDate(e.date)}</td><td>${esc(e.cat)}</td>
      <td>${esc(e.note||'-')}</td><td class="tr c-red">${money(e.amount)}</td>
      <td class="tc"><button class="btn-icon" onclick="delRow('expenses','${e.id}')">🗑️</button></td></tr>`).join('')}
    </table>${!db.expenses.length?'<div class="empty">ยังไม่มีรายการ</div>':''}</div>`;
}
function expenseForm(){
  const cats = ['ค่าเช่า','เงินเดือน','ค่าน้ำ/ไฟ','ค่าขนส่ง','ค่าการตลาด','อุปกรณ์สำนักงาน','อื่นๆ'];
  openModal('บันทึกค่าใช้จ่าย', `
    <div class="grid g2">${fld('วันที่','ex_date',today(),'date')}
      <div class="field"><label>หมวดค่าใช้จ่าย</label><select id="ex_cat">
        ${cats.map(c=>`<option>${c}</option>`).join('')}</select></div></div>
    ${fld('จำนวนเงิน','ex_amt',0,'number')}${fld('รายละเอียด','ex_note','')}
    <div class="row" style="justify-content:flex-end">
      <button class="btn ghost" onclick="closeModal()">ยกเลิก</button>
      <button class="btn" onclick="saveExpense()">บันทึก</button></div>`);
}
function saveExpense(){
  DB.update(db => db.expenses.push({ id:uid(), date:ex_date.value, cat:ex_cat.value,
    amount:+ex_amt.value||0, note:ex_note.value }));
  closeModal(); render();
}

/* ================= 8. รายงาน ================= */
function reportPL(db){
  setPage('งบกำไรขาดทุน');
  const months = [...new Set([...db.documents.map(d=>ym(d.date)), ...db.expenses.map(e=>ym(e.date))])]
    .filter(Boolean).sort().reverse();
  const sel = window._plMonth || months[0] || ym(today());
  const revs = revenueDocs(db).filter(d => ym(d.date) === sel);
  const rev  = revs.reduce((s,d)=>s+calcDoc(d,db.settings.vatRate).net,0);
  const cogs = revs.reduce((s,d)=>s+calcDoc(d,db.settings.vatRate).cogs,0);
  const exps = db.expenses.filter(e=>ym(e.date)===sel);
  const expTotal = exps.reduce((s,e)=>s+(+e.amount||0),0);
  const gross = rev - cogs, net = gross - expTotal;
  const byCat = {}; exps.forEach(e => byCat[e.cat] = (byCat[e.cat]||0) + (+e.amount||0));

  $('#view').innerHTML = `
    <div class="card"><label>เลือกงวดเดือน</label>
      <select style="max-width:220px" onchange="window._plMonth=this.value;render()">
        ${months.map(m=>`<option ${m===sel?'selected':''}>${m}</option>`).join('') || `<option>${sel}</option>`}
      </select></div>
    <div class="card"><h3>งบกำไรขาดทุน — งวด ${sel}</h3><table>
      <tr><td><b>รายได้จากการขาย</b></td><td class="tr c-green"><b>${money(rev)}</b></td></tr>
      <tr><td style="padding-left:24px">หัก ต้นทุนขาย (COGS)</td><td class="tr c-orange">(${money(cogs)})</td></tr>
      <tr style="background:#f8fafc"><td><b>กำไรขั้นต้น</b></td><td class="tr"><b>${money(gross)}</b></td></tr>
      ${Object.entries(byCat).map(([c,v])=>`<tr><td style="padding-left:24px">หัก ${esc(c)}</td><td class="tr c-red">(${money(v)})</td></tr>`).join('')}
      <tr style="background:#f1f5f9"><td><b>กำไร (ขาดทุน) สุทธิ</b></td>
        <td class="tr"><b class="${net>=0?'c-green':'c-red'}" style="font-size:18px">${money(net)}</b></td></tr>
    </table>
    <p class="c-muted" style="margin-top:10px;font-size:12px">
      อัตรากำไรขั้นต้น ${rev?((gross/rev)*100).toFixed(1):0}% · อัตรากำไรสุทธิ ${rev?((net/rev)*100).toFixed(1):0}%</p>
    </div>`;
}

function reportVat(db){
  setPage('รายงานภาษี');
  const outs = revenueDocs(db).filter(d => d.hasVat);
  const outVat = outs.reduce((s,d)=>s+calcDoc(d,db.settings.vatRate).vat,0);
  $('#view').innerHTML = `
    <div class="grid g3">${kpi('ภาษีขาย (Output VAT)','฿'+money(outVat),'c-red')}
      ${kpi('ยอดขายก่อน VAT','฿'+money(outs.reduce((s,d)=>s+calcDoc(d,db.settings.vatRate).net,0)),'c-blue')}
      ${kpi('จำนวนใบกำกับภาษี', outs.length,'c-muted')}</div>
    <div class="card"><h3>รายงานภาษีขาย</h3><table>
      <tr><th>วันที่</th><th>เลขที่</th><th>ชื่อผู้ซื้อ</th><th>เลขผู้เสียภาษี</th>
          <th class="tr">มูลค่าสินค้า</th><th class="tr">ภาษีมูลค่าเพิ่ม</th></tr>
      ${outs.map(d=>{ const c=db.customers.find(x=>x.id===d.customerId), t=calcDoc(d,db.settings.vatRate);
        return `<tr><td>${thDate(d.date)}</td><td>${d.no}</td><td>${esc(c?.name||'-')}</td>
        <td>${esc(c?.taxId||'-')}</td><td class="tr">${money(t.net)}</td><td class="tr">${money(t.vat)}</td></tr>`;
      }).join('')}</table>${!outs.length?'<div class="empty">ยังไม่มีข้อมูล</div>':''}</div>`;
}

function reportAR(db){
  setPage('ลูกหนี้คงค้าง');
  const ar = revenueDocs(db).filter(d => d.status !== 'paid');
  $('#view').innerHTML = `<div class="card"><table>
    <tr><th>เลขที่</th><th>ลูกค้า</th><th>วันที่</th><th>ครบกำหนด</th><th class="tr">ยอดค้าง</th><th class="tc">อายุหนี้</th></tr>
    ${ar.map(d=>{ const c=db.customers.find(x=>x.id===d.customerId);
      const days = d.dueDate ? Math.floor((Date.now()-new Date(d.dueDate))/864e5) : 0;
      return `<tr><td><b>${d.no}</b></td><td>${esc(c?.name||'-')}</td><td>${thDate(d.date)}</td>
      <td>${thDate(d.dueDate)}</td><td class="tr c-red"><b>${money(calcDoc(d,db.settings.vatRate).total)}</b></td>
      <td class="tc">${days>0?`<span class="tag t-void">เกิน ${days} วัน</span>`:'<span class="tag t-issued">ยังไม่ครบกำหนด</span>'}</td></tr>`;
    }).join('')}</table>${!ar.length?'<div class="empty">ไม่มีลูกหนี้ค้างชำระ 🎉</div>':''}</div>`;
}

function reportTop(db){
  setPage('สินค้าขายดี');
  const agg = {};
  revenueDocs(db).forEach(d => d.items.forEach(it => {
    const k = it.name;
    agg[k] = agg[k] || { qty:0, sale:0, profit:0 };
    agg[k].qty += +it.qty||0;
    agg[k].sale += (+it.qty||0)*(+it.price||0);
    agg[k].profit += (+it.qty||0)*((+it.price||0)-(+it.cost||0));
  }));
  const rows = Object.entries(agg).sort((a,b)=>b[1].sale-a[1].sale);
  $('#view').innerHTML = `<div class="card"><table>
    <tr><th>#</th><th>สินค้า</th><th class="tr">จำนวนที่ขาย</th><th class="tr">ยอดขาย</th><th class="tr">กำไร</th></tr>
    ${rows.map(([n,v],i)=>`<tr><td>${i+1}</td><td><b>${esc(n)}</b></td><td class="tr">${v.qty}</td>
      <td class="tr">${money(v.sale)}</td><td class="tr c-green">${money(v.profit)}</td></tr>`).join('')}
    </table>${!rows.length?'<div class="empty">ยังไม่มียอดขาย</div>':''}</div>`;
}

/* ================= 9. ตั้งค่า & สำรองข้อมูล ================= */
function settings(db){
  setPage('ข้อมูลกิจการ');
  const s = db.settings;
  $('#view').innerHTML = `<div class="card" style="max-width:640px">
    ${fld('ชื่อกิจการ','s_com',s.company)}
    <div class="grid g2">${fld('เลขประจำตัวผู้เสียภาษี','s_tax',s.taxId)}${fld('สาขา','s_branch',s.branch)}</div>
    <div class="field"><label>ที่อยู่</label><textarea id="s_addr" rows="3">${esc(s.address)}</textarea></div>
    <div class="grid g3">${fld('โทรศัพท์','s_phone',s.phone)}${fld('อีเมล','s_email',s.email)}
      ${fld('อัตรา VAT (%)','s_vat',s.vatRate,'number')}</div>
    <button class="btn" onclick="saveSettings()">บันทึกการตั้งค่า</button></div>`;
}
function saveSettings(){
  DB.update(db => Object.assign(db.settings, { company:s_com.value, taxId:s_tax.value,
    branch:s_branch.value, address:s_addr.value, phone:s_phone.value, email:s_email.value,
    vatRate:+s_vat.value||0 }));
  alert('บันทึกแล้ว ✅'); render();
}

function backup(db){
  setPage('สำรอง / กู้คืนข้อมูล');
  $('#view').innerHTML = `<div class="card" style="max-width:640px">
    <h3>💾 สำรองข้อมูล</h3>
    <p class="c-muted" style="margin-bottom:10px">ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ .json เก็บไว้</p>
    <button class="btn" onclick="exportData()">ดาวน์โหลดไฟล์สำรอง</button>
    <hr style="margin:20px 0;border:0;border-top:1px solid #e2e8f0">
    <h3>📤 กู้คืนข้อมูล</h3>
    <input type="file" accept=".json" onchange="importData(this)" style="margin:10px 0">
    <hr style="margin:20px 0;border:0;border-top:1px solid #e2e8f0">
    <h3 class="c-red">⚠️ ล้างข้อมูลทั้งหมด</h3>
    <button class="btn red" onclick="if(confirm('ลบข้อมูลทั้งหมดถาวร แน่ใจหรือไม่?')){DB.reset().then(()=>location.reload())}">ล้างข้อมูล</button>
  </div>`;
}
function exportData(){
  const blob = new Blob([JSON.stringify(DB.get(),null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup-${today()}.json`; a.click();
}
function importData(input){
  const f = input.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = e => { try { DB.set(JSON.parse(e.target.result)); alert('กู้คืนสำเร็จ ✅'); render(); }
                  catch { alert('ไฟล์ไม่ถูกต้อง'); } };
  r.readAsText(f);
}

/* ================= 10. พิมพ์เอกสาร ================= */
function printDoc(id){
  const db = DB.get();
  const d = db.documents.find(x => x.id === id) || draft;
  if (!d || !d.items?.length) return alert('บันทึกเอกสารและเพิ่มรายการก่อนพิมพ์นะครับ');
  const c = db.customers.find(x => x.id === d.customerId) || {};
  const s = db.settings, t = calcDoc(d, s.vatRate);

  $('#printArea').innerHTML = `<div class="paper">
    <div class="ph">
      <div><h3 style="font-size:16px">${esc(s.company)}</h3>
        <div>${esc(s.address)}</div>
        <div>โทร. ${esc(s.phone)} · เลขประจำตัวผู้เสียภาษี ${esc(s.taxId)} (${esc(s.branch)})</div></div>
      <div style="text-align:right"><h2>${DOC_TYPES[d.type].name}</h2>
        <div>เลขที่: <b>${d.no}</b></div><div>วันที่: ${thDate(d.date)}</div>
        ${d.dueDate?`<div>ครบกำหนด: ${thDate(d.dueDate)}</div>`:''}</div>
    </div>
    <div style="margin:14px 0;padding:10px;border:1px solid #cbd5e1;border-radius:6px">
      <b>ลูกค้า:</b> ${esc(c.name||'-')}<br>
      ${esc(c.address||'')}<br>
      เลขประจำตัวผู้เสียภาษี ${esc(c.taxId||'-')} ${c.branch?`(${esc(c.branch)})`:''} · โทร. ${esc(c.phone||'-')}
    </div>
    <table><thead><tr><th style="width:6%">#</th><th>รายการ</th><th style="width:12%">จำนวน</th>
      <th style="width:16%">ราคา/หน่วย</th><th style="width:18%">จำนวนเงิน</th></tr></thead><tbody>
      ${d.items.map((it,i)=>`<tr><td style="text-align:center">${i+1}</td><td>${esc(it.name)}</td>
        <td style="text-align:right">${it.qty} ${esc(it.unit||'')}</td>
        <td style="text-align:right">${money(it.price)}</td>
        <td style="text-align:right">${money(it.qty*it.price)}</td></tr>`).join('')}
      ${[...Array(Math.max(0,8-d.items.length))].map(()=>`<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`).join('')}
    </tbody></table>
    <div style="display:flex;justify-content:space-between;margin-top:12px">
      <div style="flex:1;font-size:11px">หมายเหตุ: ${esc(d.note||'-')}</div>
      <table style="width:280px">
        <tr><td>รวมเป็นเงิน</td><td style="text-align:right">${money(t.sub)}</td></tr>
        ${t.disc?`<tr><td>ส่วนลด</td><td style="text-align:right">${money(t.disc)}</td></tr>`:''}
        <tr><td>ราคาก่อนภาษี</td><td style="text-align:right">${money(t.net)}</td></tr>
        <tr><td>ภาษีมูลค่าเพิ่ม ${d.hasVat?s.vatRate:0}%</td><td style="text-align:right">${money(t.vat)}</td></tr>
        <tr style="background:#e2e8f0"><td><b>จำนวนเงินรวมทั้งสิ้น</b></td>
            <td style="text-align:right"><b>${money(t.total)}</b></td></tr>
      </table>
    </div>
    <div class="sign"><div>ผู้รับสินค้า / วันที่</div><div>ผู้ส่งสินค้า / วันที่</div><div>ผู้มีอำนาจลงนาม</div></div>
  </div>`;
  document.body.classList.add('printing');
  window.print();
  setTimeout(() => document.body.classList.remove('printing'), 400);
}

/* ================= Utility ================= */
function delRow(key, id){
  if (!confirm('ยืนยันการลบ?')) return;
  DB.update(db => db[key] = db[key].filter(x => x.id !== id));
  render();
}
function filterTable(tid, q){
  q = q.toLowerCase();
  document.querySelectorAll(`#${tid} tbody tr`).forEach(tr =>
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none');
}

/* ================= Start ================= */
function startApp(){ buildMenu(); render(); }
