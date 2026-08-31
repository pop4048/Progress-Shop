import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nextDocNo } from "@/lib/docno";
import { calcDocument } from "@/lib/money";
import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().nullish(),
  description: z.string().min(1),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number(),
  discount: z.coerce.number().default(0),
  unitCost: z.coerce.number().default(0),
  vatType: z.enum(["VAT", "NON_VAT", "ZERO"]).default("VAT"),
});

const schema = z.object({
  docType: z.enum(["QT", "INV", "DN", "TI", "RC", "CN", "PO", "BILL"]),
  contactId: z.string().min(1),
  issueDate: z.string(),
  dueDate: z.string().nullish(),
  parentId: z.string().nullish(),
  discount: z.coerce.number().default(0),
  whtRate: z.coerce.number().default(0),
  note: z.string().nullish(),
  items: z.array(itemSchema).min(1),
});

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const docType = sp.get("type") as any;
  const status = sp.get("status") as any;

  const docs = await prisma.document.findMany({
    where: { docType: docType || undefined, status: status || undefined },
    include: { contact: true, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const company = await prisma.company.findFirst();
    const vatRate = Number(company?.vatRate ?? 7);

    const calc = calcDocument(
      body.items.map((i) => ({
        qty: i.qty, unitPrice: i.unitPrice, discount: i.discount,
        vatType: i.vatType, unitCost: i.unitCost,
      })),
      { docDiscount: body.discount, vatRate, whtRate: body.whtRate }
    );

    const doc = await prisma.$transaction(async (tx) => {
      const issueDate = new Date(body.issueDate);
      const docNo = await nextDocNo(tx, body.docType, issueDate);

      return tx.document.create({
        data: {
          docType: body.docType,
          docNo,
          contactId: body.contactId,
          issueDate,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          parentId: body.parentId || null,
          subtotal: calc.subtotal,
          discount: calc.discount,
          vatAmount: calc.vatAmount,
          whtRate: body.whtRate,
          whtAmount: calc.whtAmount,
          grandTotal: calc.grandTotal,
          cogs: calc.cogs,
          note: body.note || null,
          items: {
            create: body.items.map((i, idx) => ({
              productId: i.productId || null,
              description: i.description,
              qty: i.qty,
              unitPrice: i.unitPrice,
              discount: i.discount,
              unitCost: i.unitCost,
              vatType: i.vatType,
              amount: calc.lines[idx].amount,
              lineNo: idx + 1,
            })),
          },
        },
        include: { items: true, contact: true },
      });
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
