import { prisma } from "@/lib/db";
import { thb, round2 } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function TrialBalance() {
  const rows = await prisma.$queryRaw<
    { code: string; name: string; type: string; debit: number; credit: number }[]
  >`
    SELECT a.code, a.name, a.type::text,
           COALESCE(SUM(l.debit), 0)::float AS debit,
           COALESCE(SUM(l.credit), 0)::float AS credit
    FROM "Account" a
    LEFT JOIN "JournalLine" l ON l."accountCode" = a.code
    GROUP BY a.code, a.name, a.type
    HAVING COALESCE(SUM(l.debit), 0) <> 0 OR COALESCE(SUM(l.credit), 0) <> 0
    ORDER BY a.code`;

  const totalDr = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCr = round2(rows.reduce((s, r) => s + r.credit, 0));
  const balanced = Math.abs(totalDr - totalCr) < 0.01;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">งบทดลอง</h1>
        <span className={`badge ${balanced ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
          {balanced ? "✓ สมดุล" : "✕ ไม่สมดุล"}
        </span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">รหัส</th><th className="th">ชื่อบัญชี</th>
              <th className="th text-right">เดบิต</th><th className="th text-right">เครดิต</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.code} className="hover:bg-slate-50">
                <td className="td font-mono text-xs">{r.code}</td>
                <td className="td">{r.name}</td>
                <td className="td text-right">{r.debit ? thb(r.debit) : ""}</td>
                <td className="td text-right">{r.credit ? thb(r.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold">
            <tr>
              <td className="td" colSpan={2}>รวม</td>
              <td className="td text-right">{thb(totalDr)}</td>
              <td className="td text-right">{thb(totalCr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
