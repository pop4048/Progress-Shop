"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProductForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      sku: String(fd.get("sku")),
      name: String(fd.get("name")),
      categoryId: String(fd.get("categoryId") || ""),
      unit: String(fd.get("unit") || "ชิ้น"),
      costPrice: Number(fd.get("costPrice") || 0),
      sellPrice: Number(fd.get("sellPrice") || 0),
      stockQty: Number(fd.get("stockQty") || 0),
      reorderPoint: Number(fd.get("reorderPoint") || 0),
      isService: fd.get("isService") === "on",
    };
    const res = await fetch("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) { setOpen(false); router.refresh(); }
    else alert((await res.json()).error);
  }

  if (!open) return <button className="btn-primary" onClick={() => setOpen(true)}>+ เพิ่มสินค้า</button>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">เพิ่มสินค้าใหม่</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">SKU *<input name="sku" required className="input mt-1" placeholder="P007" /></label>
          <label className="text-sm">หน่วยนับ<input name="unit" defaultValue="ชิ้น" className="input mt-1" /></label>
          <label className="col-span-2 text-sm">ชื่อสินค้า *<input name="name" required className="input mt-1" /></label>
          <label className="col-span-2 text-sm">หมวดหมู่
            <select name="categoryId" className="input mt-1">
              <option value="">— ไม่ระบุ —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm">ราคาทุน<input name="costPrice" type="number" step="0.01" defaultValue={0} className="input mt-1" /></label>
          <label className="text-sm">ราคาขาย<input name="sellPrice" type="number" step="0.01" defaultValue={0} className="input mt-1" /></label>
          <label className="text-sm">สต็อกเริ่มต้น<input name="stockQty" type="number" step="0.001" defaultValue={0} className="input mt-1" /></label>
          <label className="text-sm">จุดสั่งซื้อ<input name="reorderPoint" type="number" step="0.001" defaultValue={0} className="input mt-1" /></label>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input name="isService" type="checkbox" className="rounded" /> เป็นสินค้าประเภทบริการ (ไม่ตัดสต็อก)
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>ยกเลิก</button>
          <button className="btn-primary" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
        </div>
      </form>
    </div>
  );
}
