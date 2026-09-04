/* ================= Firebase Bootstrap ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  doc, getDoc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ---------- 🔧 วางค่าจาก Firebase Console ตรงนี้ ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyBBnOxO9-jCpjnPbZ7aBvCS8RHS3f5CiKQ",
  authDomain: "business-model-aa097.firebaseapp.com",
  databaseURL: "https://business-model-aa097-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "business-model-aa097",
  storageBucket: "business-model-aa097.firebasestorage.app",
  messagingSenderId: "872137791523",
  appId: "1:872137791523:web:bf1e5e691ad0b6c8f83996",
  measurementId: "G-QPB0D944LQ"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
// เปิด offline cache — เน็ตหลุดยังใช้งานได้ กลับมาแล้ว sync เอง
const fs = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
});

/* ================= ข้อมูลตั้งต้น ================= */
const BLANK = {
  settings:{ company:'บริษัท ตัวอย่าง จำกัด', taxId:'0000000000000', branch:'สำนักงานใหญ่',
             address:'123 ถนนตัวอย่าง แขวง/ตำบล เขต/อำเภอ จังหวัด 10000',
             phone:'02-000-0000', email:'', vatRate:7 },
  categories:[{id:'c1',name:'ทั่วไป'}],
  products:[], customers:[], suppliers:[], documents:[], purchases:[], expenses:[],
  counters:{}
};

let cache   = null;   // ข้อมูลทั้งก้อนที่อยู่ในหน่วยความจำ
let shopRef = null;   // doc reference ของร้านนี้
let timer   = null;   // debounce timer
let muteSnap = false; // กันไม่ให้ snapshot ของตัวเองมา render ทับตอนกำลังพิมพ์

/* ---------- บันทึกขึ้นคลาวด์ (หน่วง 600ms รวบยอด) ---------- */
function queueSave(){
  setSyncBadge('saving');
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      muteSnap = true;
      await setDoc(shopRef, { ...cache, _updatedAt: Date.now() });
      setSyncBadge('saved');
    } catch (e) {
      console.error(e); setSyncBadge('error');
    } finally { setTimeout(() => muteSnap = false, 800); }
  }, 600);
}

/* ================= DB API (หน้าตาเหมือนเดิมทุกอย่าง) ================= */
window.DB = {
  get(){ return cache || structuredClone(BLANK); },
  set(db){ cache = db; queueSave(); },
  update(fn){ fn(cache); queueSave(); return cache; },
  async reset(){ cache = structuredClone(BLANK); await setDoc(shopRef, cache); }
};

/* ================= Auth Flow ================= */
onAuthStateChanged(auth, async user => {
  if (!user) { showLogin(); return; }

  shopRef = doc(fs, 'shops', user.uid);
  const snap = await getDoc(shopRef);

  if (snap.exists()) cache = { ...structuredClone(BLANK), ...snap.data() };
  else { cache = structuredClone(BLANK); await setDoc(shopRef, cache); }

  // realtime: เปิดหลายเครื่อง/หลายแท็บ อัปเดตตามกันทันที
  onSnapshot(shopRef, s => {
    if (!s.exists() || muteSnap || s.metadata.hasPendingWrites) return;
    cache = { ...structuredClone(BLANK), ...s.data() };
    if (!document.querySelector('#modal:not(.hidden)')) render();
  });

  document.getElementById('authGate').classList.add('hidden');
  document.getElementById('app').style.display = 'flex';
  document.getElementById('userEmail').textContent = user.email || user.displayName;
  startApp();
});

function showLogin(){
  document.getElementById('authGate').classList.remove('hidden');
  document.getElementById('app').style.display = 'none';
}

/* ---------- ปุ่มต่างๆ (ผูกเข้า window เพื่อให้ onclick เรียกได้) ---------- */
const authErr = m => document.getElementById('authMsg').textContent = m;

window.doLogin = async () => {
  try { await signInWithEmailAndPassword(auth, authEmail.value.trim(), authPass.value); }
  catch(e){ authErr(mapErr(e.code)); }
};
window.doRegister = async () => {
  try { await createUserWithEmailAndPassword(auth, authEmail.value.trim(), authPass.value); }
  catch(e){ authErr(mapErr(e.code)); }
};
window.doGoogle = async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch(e){ authErr(mapErr(e.code)); }
};
window.doLogout = () => signOut(auth).then(() => location.reload());

function mapErr(code){
  return ({
    'auth/invalid-email':'รูปแบบอีเมลไม่ถูกต้อง',
    'auth/missing-password':'กรุณากรอกรหัสผ่าน',
    'auth/weak-password':'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร',
    'auth/email-already-in-use':'อีเมลนี้ถูกใช้แล้ว — กด "เข้าสู่ระบบ" แทน',
    'auth/invalid-credential':'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    'auth/unauthorized-domain':'โดเมนนี้ยังไม่ได้อนุญาตใน Firebase Console'
  })[code] || ('เกิดข้อผิดพลาด: ' + code);
}

/* ---------- ป้ายสถานะการบันทึก ---------- */
function setSyncBadge(state){
  const el = document.getElementById('syncBadge'); if(!el) return;
  el.textContent = { saving:'⏳ กำลังบันทึก…', saved:'☁️ บันทึกแล้ว', error:'⚠️ บันทึกไม่สำเร็จ' }[state];
  el.style.color = state === 'error' ? '#dc2626' : '#16a34a';
}
