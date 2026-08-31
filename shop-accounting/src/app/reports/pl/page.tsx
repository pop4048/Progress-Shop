import { prisma } from "@/lib/db";
import { thb, round2 } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PLReport({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const from = sp.from ? new Date(sp.from) : new Date(now.getFullYear(), 0, 1);
  const to = sp.to ? new Date(sp.to) : new Date(now.getFullYear(), 11, 31, 23, 59, 59);

  const rows = await prisma.$queryRaw<
    { code: string; name: string; type: string; debit: number; credit: number }[]
  >`
    SELECT a.code, a.name, a.type::text,
           COALESCE(SUM(l.debit), 0)::float AS debit,
           COALESCE(SUM(l.credit), 0)::float AS credit
    FROM "Account" a
    LEFT JOIN "JournalLine" l ON l."accountCode" = a.code
    LEFT JOIN "JournalEntry" e ON e.id = l."entryId"
      AND e."entryDate" BETWEEN ${from} AND ${to}
    WHERE a.type IN ('REVENUE', 'EXPENSE')
    GROUP BY a.code, a.name, a.type
    ORDER BY a.code`;

  const revenue = rows.filter((r) => r.type === "REVENUE").map((r) => ({ ...r, amount: round2(r.credit - r.debit) }));
  const cogs = rows.filter((r) => r.code.startsWith("51")).map((r) => ({ ...r, amount: round2(r.debit - r.credit) }));
  const opex = rows.filter((r) => r.type === "EXPENSE" && !r.code.startsWith("51")).map((r) => ({ ...r, amount: round2(r.debit - r.credit) }));

  const totalRev = round2(revenue.reduce((s, r) => s + r.amount, 0));
  const totalCogs = round2(cogs.reduce((s, r) => s + r.amount, 0));
  const grossProfit = round2(totalRev - totalCogs);
  const totalOpex = round2(opex.reduce((s, r) => s + r.amount, 0));
  const netProfit = round2(grossProfit - totalOpex);
  const margin = totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) : "0.0";

  const Section = ({ title, items }: { title: string; items: any[] }) => (
    <>
      <tr className="bg-slate-50"><td className="td font-semibold" colSpan={2}>{title}</td></tr>
      {items.filter((i) => i.amount !== 0).map((i) => (
        <tr key={i.code}>
          <td className="td pl-8 text-slate-600">{i.code} — {i.name}</td>
          <td className="td text-right">{thb(i.amount)}</td>
        </tr>
      ))}
    </>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">งบกำไรขาดทุน</h1>
        <p className="text-sm text-slate-500">
          สำหรับงวด {from.toLocaleDateString("th-TH")} ถึง {to.toLocaleDateString("th-TH")}
        </p>
      </div>

      <form className="no-print card flex items-end gap-3 p-4">
        <label className="text-sm">ตั้งแต่<input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} className="input mt-1" /></label>
        <label className="text-sm">ถึง<input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} className="input mt-1" /></label>
        <button className="btn-primary">ดูรายงาน</button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full">
          <tbody className="divide-y divide-slate-100">
            <Section title="รายได้" items={revenue} />
            <tr className="border-t-2 border-slate-200 font-semibold">
              <td className="td">รวมรายได้</td><td className="td text-right">{thb(totalRev)}</td>
            </tr>

            <Section title="ต้นทุนขาย" items={cogs} />
            <tr className="font-semibold"><td className="td">รวมต้นทุนขาย</td><td className="td text-right">{thb(totalCogs)}</td></tr>

            <tr className="bg-brand-light font-bold">
              <td className="td">กำไรขั้นต้น</td><td className="td text-right">{thb(grossProfit)}</td>
            </tr>

            <Section title="ค่าใช้จ่ายในการดำเนินงาน" items={opex} />
            <tr className="font-semibold"><td className="td">รวมค่าใช้จ่าย</td><td className="td text-right">{thb(totalOpex)}</td></tr>

            <tr className={`text-lg font-bold ${netProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              <td className="td">{netProfit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"}</td>
              <td className="td text-right">฿{thb(Math.abs(netProfit))}</td>
            </tr>
            <tr><td className="td text-slate-500">อัตรากำไรสุทธิ</td><td className="td text-right text-slate-500">{margin}%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
