import { prisma } from "@/lib/db";
import { thb, fmtDate, n } from "@/lib/money";
import { DOC_LABEL, STATUS_LABEL, STATUS_COLOR, CONVERT_MAP } from "@/lib/constants";
import Link from "next/link";
import { notFound } from "next/navigation";
import DocActions from "./actions";

export const dynamic = "force-dynamic";

export default async function DocDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [doc, company] = await Promise.all([
    prisma.document.findUnique({
      where: { id },
      include: {
        contact: true,
        items: { orderBy: { lineNo: "asc" } },
        parent: true,
        children: true,
        journals: { include: { lines: { include: { account: true } } } },
      },
    }),
    prisma.company.findFirst(),
  ]);
  if (!doc) notFound();

  const targets = CONVERT_MAP[doc.docType] ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="no-print flex items-center justify-between">
        <Link href="/documents" className="text-sm text-slate-500 hover:text-brand">← กลับ</Link>
        <DocActions doc={JSON.parse(JSON.stringify(doc))} targets={targets} />
      </div>

      {/* ---------- ตัวเอกสารสำหรับพิมพ์ ---------- */}
      <div className="card p-8">
        <div className="flex justify-between border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-lg font-bold">{company?.name}</h2>
            <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{company?.address}</p>
            <p className="text-xs text-slate-500">เลขประจำตัวผู้เสียภาษี: {company?.taxId} ({company?.branch})</p>
            <p className="text-xs text-slate-500">โทร. {company?.phone}</p>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold text-brand">{DOC_LABEL[doc.docType]}</h1>
            <p className="mt-1 font-mono text-sm">{doc.docNo}</p>
            <span className={`badge mt-2 ${STATUS_COLOR[doc.status]}`}>{STATUS_LABEL[doc.status]}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-5 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-400">ลูกค้า / ผู้ขาย</p>
            <p className="font-semibold">{doc.contact.name}</p>
            <p className="text-xs text-slate-500">{doc.contact.address}</p>
            {doc.contact.taxId && (
              <p className="text-xs text-slate-500">เลขผู้เสียภาษี: {doc.contact.taxId} ({doc.contact.branch})</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">วันที่: <span className="text-slate-800">{fmtDate(doc.issueDate)}</span></p>
            {doc.dueDate && <p className="text-xs text-slate-500">ครบกำหนด: <span className="text-slate-800">{fmtDate(doc.dueDate)}</span></p>}
            {doc.parent && (
              <p className="text-xs text-slate-500">
                อ้างอิง: <Link href={`/documents/${doc.parent.id}`} className="text-brand hover:underline">{doc.parent.docNo}</Link>
              </p>
            )}
          </div>
        </div>

        <table className="w-full">
          <thead className="border-y border-slate-200 bg-slate-50">
            <tr>
              <th className="th w-10">#</th><th className="th">รายการ</th>
              <th className="th w-20 text-right">จำนวน</th><th className="th w-28 text-right">ราคา/หน่วย</th>
              <th className="th w-24 text-right">ส่วนลด</th><th className="th w-28 text-right">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {doc.items.map((it) => (
              <tr key={it.id}>
                <td className="td text-slate-400">{it.lineNo}</td>
                <td className="td">{it.description}</td>
                <td className="td text-right">{n(it.qty)}</td>
                <td className="td text-right">{thb(it.unitPrice)}</td>
                <td className="td text-right">{thb(it.discount)}</td>
                <td className="td text-right font-medium">{thb(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex justify-end">
          <dl className="w-72 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">รวมเป็นเงิน</dt><dd>{thb(doc.subtotal)}</dd></div>
            {n(doc.discount) > 0 && (
              <div className="flex justify-between"><dt className="text-slate-500">ส่วนลด</dt><dd>-{thb(doc.discount)}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-slate-500">ภาษีมูลค่าเพิ่ม 7%</dt><dd>{thb(doc.vatAmount)}</dd></div>
            {n(doc.whtAmount) > 0 && (
              <div className="flex justify-between"><dt className="text-slate-500">หัก ณ ที่จ่าย {n(doc.whtRate)}%</dt><dd>-{thb(doc.whtAmount)}</dd></div>
            )}
            <div className="flex justify-between border-t border-slate-300 pt-2">
              <dt className="font-bold">ยอดสุทธิ</dt>
              <dd className="text-lg font-bold text-brand">฿{thb(doc.grandTotal)}</dd>
            </div>
          </dl>
        </div>

        {doc.note && <p className="mt-5 border-t border-slate-200 pt-4 text-xs text-slate-500">หมายเหตุ: {doc.note}</p>}

        <div className="mt-12 grid grid-cols-2 gap-10 text-center text-xs text-slate-500">
          <div><div className="mb-1 border-t border-slate-400 pt-1">ผู้รับสินค้า / วันที่</div></div>
          <div><div className="mb-1 border-t border-slate-400 pt-1">ผู้มีอำนาจลงนาม / วันที่</div></div>
        </div>
      </div>

      {/* ---------- รายการบัญชีที่ระบบลงให้ ---------- */}
      {doc.journals.length > 0 && (
        <div className="no-print card">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="font-semibold">รายการบัญชีอัตโนมัติ</h3>
          </div>
          {doc.journals.map((j) => (
            <div key={j.id} className="border-b border-slate-100 p-4 last:border-0">
              <p className="mb-2 text-xs text-slate-500">{j.entryNo} · {fmtDate(j.entryDate)}</p>
              <table className="w-full text-sm">
                <thead><tr>
                  <th className="th">รหัส</th><th className="th">ชื่อบัญชี</th>
                  <th className="th text-right">เดบิต</th><th className="th text-right">เครดิต</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {j.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="td font-mono text-xs">{l.accountCode}</td>
                      <td className="td">{l.account.name}</td>
                      <td className="td text-right">{n(l.debit) ? thb(l.debit) : ""}</td>
                      <td className="td text-right">{n(l.credit) ? thb(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {doc.children.length > 0 && (
        <div className="no-print card p-4">
          <h3 className="mb-2 font-semibold">เอกสารที่แปลงต่อ</h3>
          <div className="flex flex-wrap gap-2">
            {doc.children.map((c) => (
              <Link key={c.id} href={`/documents/${c.id}`}
                className="badge border border-slate-300 bg-white px-3 py-1.5 hover:border-brand">
                {DOC_LABEL[c.docType]} · {c.docNo}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
