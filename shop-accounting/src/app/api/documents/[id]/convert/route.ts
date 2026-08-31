import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nextDocNo } from "@/lib/docno";
import { canConvert } from "@/lib/posting";
import type { DocType } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const { to } = (await req.json()) as { to: DocType };

    const src = await prisma.document.findUnique({
      where: { id }, include: { items: true, contact: true },
    });
    if (!src) return NextResponse.json({ error: "ไม่พบเอกสารต้นทาง" }, { status: 404 });
    if (!canConvert(src.docType, to)) {
      return NextResponse.json({ error: `แปลง ${src.docType} → ${to} ไม่ได้` }, { status: 400 });
    }

    const existing = await prisma.document.findFirst({ where: { parentId: id, docType: to, status: { not: "VOID" } } });
    if (existing) {
      return NextResponse.json({ error: `แปลงเป็น ${to} ไปแล้ว (${existing.docNo})` }, { status: 400 });
    }

    const newDoc = await prisma.$transaction(async (tx) => {
      const issueDate = new Date();
      const docNo = await nextDocNo(tx, to, issueDate);
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + (src.contact.creditDays || 0));

      return tx.document.create({
        data: {
          docType: to,
          docNo,
          contactId: src.contactId,
          issueDate,
          dueDate: ["INV", "TI"].includes(to) ? dueDate : null,
          parentId: src.id,
          subtotal: src.subtotal,
          discount: src.discount,
          vatAmount: src.vatAmount,
          whtRate: src.whtRate,
          whtAmount: src.whtAmount,
          grandTotal: src.grandTotal,
          cogs: src.cogs,
          note: `อ้างอิง ${src.docNo}`,
          items: {
            create: src.items.map((i) => ({
              productId: i.productId,
              description: i.description,
              qty: i.qty,
              unitPrice: i.unitPrice,
              discount: i.discount,
              unitCost: i.unitCost,
              vatType: i.vatType,
              amount: i.amount,
              lineNo: i.lineNo,
            })),
          },
        },
      });
    });

    return NextResponse.json(newDoc, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
