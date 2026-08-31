import { prisma } from "@/lib/db";
import { thb, fmtDate } from "@/lib/money";
import { DOC_LABEL, STATUS_LABEL, STATUS_COLOR } from "@/lib/constants";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;

  const docs = await prisma.document.findMany({
    where: { docType: (type as any) || undefined },
    include: { contact: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const types = ["QT", "INV", "DN", "TI", "RC", "BILL"] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">เอกสารทั้งหมด</h1>
        <Link href="/documents/new" className="btn-primary">+ สร้างเอกสาร</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/documents" className={`badge border px-3 py-1.5 ${!type ? "border-brand bg-brand-light text-brand-dark" : "border-slate-300 bg-white"}`}>
          ทั้งหมด
        </Link>
        {types.map((t) => (
          <Link key={t} href={`/documents?type=${t}`}
            className={`badge border px-3 py-1.5 ${type === t ? "border-brand bg-brand-light text-brand-dark" : "border-slate-300 bg-white"}`}>
            {DOC_LABEL[t]}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">เลขที่</th><th className="th">ประเภท</th><th className="th">คู่ค้า</th>
              <th className="th">วันที่</th><th className="th text-right">ยอดสุทธิ</th><th className="th">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {docs.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="td">
                  <Link href={`/documents/${d.id}`} className="font-mono text-xs font-medium text-brand hover:underline">
                    {d.docNo}
                  </Link>
                </td>
                <td className="td">{DOC_LABEL[d.docType]}</td>
                <td className="td">{d.contact.name}</td>
                <td className="td text-slate-500">{fmtDate(d.issueDate)}</td>
                <td className="td text-right font-medium">฿{thb(d.grandTotal)}</td>
                <td className="td">
                  <span className={`badge ${STATUS_COLOR[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr><td className="td py-10 text-center text-slate-400" colSpan={6}>ยังไม่มีเอกสาร</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
