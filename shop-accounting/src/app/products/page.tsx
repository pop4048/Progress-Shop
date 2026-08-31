import { prisma } from "@/lib/db";
import { thb, n } from "@/lib/money";
import ProductForm from "./product-form";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, include: { category: true }, orderBy: { sku: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const stockValue = products.reduce((s, p) => s + n(p.stockQty) * n(p.costPrice), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">รายการสินค้า</h1>
          <p className="text-sm text-slate-500">
            {products.length} รายการ · มูลค่าสต็อกรวม ฿{thb(stockValue)}
          </p>
        </div>
        <ProductForm categories={categories} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">SKU</th>
              <th className="th">ชื่อสินค้า</th>
              <th className="th">หมวด</th>
              <th className="th text-right">ทุน</th>
              <th className="th text-right">ขาย</th>
              <th className="th text-right">กำไร/หน่วย</th>
              <th className="th text-right">คงเหลือ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => {
              const profit = n(p.sellPrice) - n(p.costPrice);
              const low = !p.isService && n(p.stockQty) <= n(p.reorderPoint);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="td font-mono text-xs">{p.sku}</td>
                  <td className="td font-medium">{p.name}</td>
                  <td className="td text-slate-500">{p.category?.name ?? "-"}</td>
                  <td className="td text-right">{thb(p.costPrice)}</td>
                  <td className="td text-right font-medium">{thb(p.sellPrice)}</td>
                  <td className="td text-right text-emerald-600">{thb(profit)}</td>
                  <td className="td text-right">
                    {p.isService ? <span className="text-slate-400">บริการ</span>
                      : <span className={low ? "font-semibold text-red-600" : ""}>{n(p.stockQty)} {p.unit}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
