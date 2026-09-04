/* ========== ที่เก็บข้อมูลทั้งหมด (localStorage) ========== */
const KEY = 'shop_acc_v1';

const DOC_TYPES = {
  QO: { name:'ใบเสนอราคา',    prefix:'QO' },
  DN: { name:'ใบส่งสินค้า',    prefix:'DN' },
  IV: { name:'ใบแจ้งหนี้',     prefix:'IV' },
  TX: { name:'ใบกำกับภาษี',    prefix:'TX' },
  RC: { name:'ใบเสร็จรับเงิน', prefix:'RC' }
};
const FLOW = { QO:['DN','IV'], DN:['IV','TX'], IV:['TX','RC'], TX:['RC'], RC:[] };

const BLANK = {
  settings:{ company:'บริษัท ตัวอย่าง จำกัด', taxId:'0000000000000', branch:'สำนักงานใหญ่',
             address:'123 ถนนตัวอย่าง แขวง/ตำบล เขต/อำเภอ จังหวัด 10000',
             phone:'02-000-0000', email:'', vatRate:7 },
  categories:[{id:'c1',name:'ทั่วไป'}],
  products:[], customers:[], suppliers:[], documents:[], purchases:[], expenses:[],
  counters:{}
};

const DB = {
  get(){
    try { return { ...structuredClone(BLANK), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return structuredClone(BLANK); }
  },
  set(db){ localStorage.setItem(KEY, JSON.stringify(db)); },
  update(fn){ const db = DB.get(); fn(db); DB.set(db); return db; },
  reset(){ localStorage.removeItem(KEY); }
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const beYear = d => new Date(d || Date.now()).getFullYear() + 543;

function nextDocNo(type){
  const db = DB.get(), y = beYear();
  const key = `${type}-${y}`;
  const n = (db.counters[key] || 0) + 1;
  DB.update(d => d.counters[key] = n);
  return `${DOC_TYPES[type].prefix}-${y}-${String(n).padStart(4,'0')}`;
}

/* ---------- คำนวณยอดเอกสาร ---------- */
function calcDoc(doc, vatRate){
  const sub = doc.items.reduce((s,i) => s + (+i.qty||0) * (+i.price||0), 0);
  const disc = +doc.discount || 0;
  const net = sub - disc;
  const vat = doc.hasVat ? net * (vatRate/100) : 0;
  const cogs = doc.items.reduce((s,i) => s + (+i.qty||0) * (+i.cost||0), 0);
  return { sub, disc, net, vat, total: net + vat, cogs, profit: net - cogs };
}

/* เอกสารที่นับเป็นรายได้ = IV/TX ที่ยังไม่ถูกแปลงต่อ (กันนับซ้ำ) */
function revenueDocs(db){
  const childRefs = new Set(db.documents.map(d => d.refId).filter(Boolean));
  return db.documents.filter(d =>
    ['IV','TX'].includes(d.type) && d.status !== 'void' && !childRefs.has(d.id));
}
