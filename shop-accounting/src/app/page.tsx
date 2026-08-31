import { prisma } from "@/lib/db";
import { thb, n, round2 } from "@/lib/money";
import StatCard from "@/components/stat-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [salesAgg, arDocs, lowStock, recentDocs, cogsAgg] = await Promise.all([
    prisma.document.aggregate({
      where: { docType: { in: ["TI", "INV"] }, status: { in: ["APPROVED", "PAID"] }, issueDate: { gte: monthStart }, parentId: null },
      _sum: { subtotal: true, discount: true },
    }),
    prisma.document.findMany({
      where: { docType: { in: ["INV", "TI"] }, status: "APPROVED" },
      include: { contact: true }, orderBy: { dueDate: "asc" }, take: 5,
    }),
    prisma.$queryRaw<{ id: string; sku: string; name: string; stockQty: any; reorderPoint: any }[]>`
      SELECT id, sku, name, "stockQty", "reorderPoint" FROM "Product"
      WHERE "isActive" = true AND "isService" = false AND "stockQty" <= "reorderPoint"
      ORDER BY "stockQty" ASC LIMIT 5`,
    prisma.document.findMany({
      include: { contact: true }, orderBy: { createdAt: "desc" }, take: 8,
    }),
    prisma.document.aggregate({
      where: { docType: { in: ["TI", "INV"] }, status: { in: ["APPROVED", "PAID"] }, issueDate: { gte: monthStart }, parentId: null },
      _sum: { cogs: true },
    }),
  ]);

  const revenue = round2(n(salesAgg._sum.subtotal) - n(salesAgg._sum.discount));
  const cogs = n(cogsAgg._sum.cogs);
  const grossProfit = round2(revenue - cogs);
  const margin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : "0.0";
  const arTotal = arDocs.reduce((s, d) => s + n(d.grandTotal), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ภาพรวมบริษัท</h1>
        <p className="text-sm text-slate-500">
          ข้อมูลเดือน {now.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="ยอดขายเดือนนี้" value={`฿${thb(revenue)}`} />
        <StatCard label="ต้นทุนขาย" value={`฿${thb(cogs)}`} />
        <StatCard label="กำไรขั้นต้น" value={`฿${thb(grossProfit)}`} sub={`อัตรากำไร ${margin}%`} tone="up" />
        <StatCard label="ลูกหนี้ค้างชำระ" value={`฿${thb(arTotal)}`} sub={`${arDocs.length} รายการ`} tone="down" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold">เอกสารล่าสุด</h2>
            <Link href="/documents" className="text-xs text-brand hover:underline">ดูทั้งหมด →</Link>
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {recentDocs.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="td font-mono text-xs">
                    <Link href={`/documents/${d.id}`} className="text-brand hover:underline">{d.docNo}</Link>
                  </td>
                  <td className="td truncate">{d.contact.name}</td>
                  <td className="td text-right font-medium">฿{thb(d.grandTotal)}</td>
                </tr>
              ))}
              {recentDocs.length === 0 && (
                <tr><td className="td text-center text-slate-400" colSpan={3}>ยังไม่มีเอกสาร</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold">สินค้าใกล้หมด</h2>
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {lowStock.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="td font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="td">{p.name}</td>
                  <td className="td text-right">
                    <span className="badge bg-amber-100 text-amber-700">เหลือ {n(p.stockQty)}</span>
                  </td>
                </tr>
              ))}
              {lowStock.length === 0 && (
                <tr><td className="td text-center text-slate-400" colSpan={3}>สต็อกปกติทุกรายการ ✅</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
