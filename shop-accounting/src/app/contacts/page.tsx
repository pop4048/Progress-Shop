import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { CUSTOMER: "ลูกค้า", VENDOR: "ผู้ขาย", BOTH: "ทั้งสอง" };

export default async function ContactsPage() {
  const contacts = await prisma.contact.findMany({
    where: { isActive: true }, orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">ลูกค้า / ผู้ขาย</h1>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">รหัส</th><th className="th">ชื่อ</th><th className="th">ประเภท</th>
              <th className="th">เลขผู้เสียภาษี</th><th className="th">โทรศัพท์</th><th className="th text-right">เครดิต</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="td font-mono text-xs">{c.code}</td>
                <td className="td font-medium">{c.name}</td>
                <td className="td text-slate-500">{TYPE_LABEL[c.type]}</td>
                <td className="td font-mono text-xs text-slate-500">{c.taxId ?? "-"}</td>
                <td className="td text-slate-500">{c.phone ?? "-"}</td>
                <td className="td text-right">{c.creditDays} วัน</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
