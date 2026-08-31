"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calcDocument, thb } from "@/lib/money";
import { DOC_LABEL } from "@/lib/constants";
import type { DocType } from "@prisma/client";

type P = { id: string; sku: string; name: string; unit: string; sellPrice: any; costPrice: any; vatType: string };
type C = { id: string; code: string; name: string; creditDays: number };

interface Row {
  productId: string | null; description: string; qty: number;
  unitPrice: number; discount: number; unitCost: number; vatType: "VAT" | "NON_VAT" | "ZERO";
}

const emptyRow = (): Row => ({ productId: null, description: "", qty: 1, unitPrice: 0, discount: 0, unitCost: 0, vatType: "VAT" });

export default function DocEditor({ products, contacts }: { products: P[]; contacts: C[] }) {
  const router = useRouter();
  const [docType, setDocType] = useState<DocType>("QT");
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState(0);
  const [whtRate, setWhtRate] = useState(0);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);

  const calc = useMemo(
    () => calcDocument(rows.filter((r) => r.description), { docDiscount: discount, vatRate: 7, whtRate }),
    [rows, discount, whtRate]
  );

  function pickProduct(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    setRows((rs) => rs.map((r, i) => i !== idx ? r : p
      ? { ...r, productId: p.id, description: p.name, unitPrice: Number(p.sellPrice), unitCost: Number(p.costPrice), vatType: p.vatType as any }
      : { ...r, productId: null }
    ));
  }

  const update = (idx: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  async function save(approve: boolean) {
    const items = rows.filter((r) => r.description && r.qty > 0);
    if (!items.length) return alert("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ");
    setBusy(true);

    const res = await fetch("/api/documents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docType, contactId, issueDate, discount, whtRate, note, items }),
    });
    if (!res.ok) { setBusy(false); return alert((await res.json()).error); }

    const doc = await res.json();
    if (approve) {
      const r2 = await fetch(`/api/documents/${doc.id}/approve`, { method: "POST" });
      if (!r2.ok) alert((await r2.json()).error);
    }
    router.push(`/documents/${doc.id}`);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="card p-4">
          <div className="grid grid-cols-3 gap-3">
            <label className="text-sm">ประเภทเอกสาร
              <select className="input mt-1" value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
                {(["QT", "INV", "DN", "TI", "RC", "BILL", "PO"] as DocType[]).map((t) => (
                  <option key={t} value={t}>{DOC_LABEL[t]}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">ลูกค้า / ผู้ขาย
              <select className="input mt-1" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </label>
            <label className="text-sm">วันที่เอกสาร
              <input type="date" className="input mt-1" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th w-8">#</th>
                <th className="th">สินค้า / รายละเอียด</th>
                <th className="th w-24 text-right">จำนวน</th>
                <th className="th w-28 text-right">ราคา/หน่วย</th>
                <th className="th w-24 text-right">ส่วนลด</th>
                <th className="th w-28 text-right">รวม</th>
                <th className="th w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="td text-slate-400">{i + 1}</td>
                  <td className="td">
                    <select className="input mb-1 text-xs" value={r.productId ?? ""} onChange={(e) => pickProduct(i, e.target.value)}>
                      <option value="">— เลือกสินค้า —</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
                    </select>
                    <input className="input" placeholder="รายละเอียด" value={r.description}
                      onChange={(e) => update(i, { description: e.target.value })} />
                  </td>
                  <td className="td"><input type="number" step="0.001" className="input text-right" value={r.qty}
                    onChange={(e) => update(i, { qty: Number(e.target.value) })} /></td>
                  <td className="td"><input type="number" step="0.01" className="input text-right" value={r.unitPrice}
                    onChange={(e) => update(i, { unitPrice: Number(e.target.value) })} /></td>
                  <td className="td"><input type="number" step="0.01" className="input text-right" value={r.discount}
                    onChange={(e) => update(i, { discount: Number(e.target.value) })} /></td>
                  <td className="td text-right font-medium">{thb(r.qty * r.unitPrice - r.discount)}</td>
                  <td className="td">
                    <button className="text-red-500 hover:text-red-700"
                      onClick={() => setRows((rs) => rs.filter((_, x) => x !== i))}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-200 p-3">
            <button className="btn-ghost text-brand" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
              + เพิ่มรายการ
            </button>
          </div>
        </div>

        <div className="card p-4">
          <label className="text-sm">หมายเหตุ
            <textarea className="input mt-1" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <div className="card sticky top-6 p-4">
          <h3 className="mb-3 font-semibold">สรุปยอด</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">รวมเป็นเงิน</dt><dd className="font-medium">{thb(calc.subtotal)}</dd></div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">ส่วนลดท้ายบิล</dt>
              <dd><input type="number" step="0.01" className="input w-24 py-1 text-right" value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))} /></dd>
            </div>
            <div className="flex justify-between"><dt className="text-slate-500">ฐานภาษี</dt><dd>{thb(calc.vatBase)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">ภาษีมูลค่าเพิ่ม 7%</dt><dd className="font-medium">{thb(calc.vatAmount)}</dd></div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">หัก ณ ที่จ่าย</dt>
              <dd>
                <select className="input w-24 py-1 text-right" value={whtRate} onChange={(e) => setWhtRate(Number(e.target.value))}>
                  <option value={0}>ไม่หัก</option><option value={1}>1%</option>
                  <option value={2}>2%</option><option value={3}>3%</option><option value={5}>5%</option>
                </select>
              </dd>
            </div>
            <div className="mt-3 flex justify-between border-t border-slate-200 pt-3">
              <dt className="font-semibold">ยอดสุทธิ</dt>
              <dd className="text-xl font-bold text-brand">฿{thb(calc.grandTotal)}</dd>
            </div>
          </dl>

          <div className="mt-5 space-y-2">
            <button className="btn-primary w-full justify-center" disabled={busy} onClick={() => save(true)}>
              {busy ? "กำลังบันทึก..." : "✓ บันทึกและอนุมัติ"}
            </button>
            <button className="btn-ghost w-full justify-center" disabled={busy} onClick={() => save(false)}>
              บันทึกเป็นร่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
