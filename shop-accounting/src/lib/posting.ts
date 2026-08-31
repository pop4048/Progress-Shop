import type { Prisma, Document, DocumentItem, DocType } from "@prisma/client";
import { n, round2 } from "./money";
import { nextEntryNo } from "./docno";
import { STOCK_OUT_TYPES, STOCK_IN_TYPES } from "./constants";

export const ACC = {
  CASH: "1101",
  AR: "1102",
  INVENTORY: "1104",
  WHT_ASSET: "1150",
  AP: "2101",
  OUTPUT_VAT: "2103",
  OUTPUT_VAT_SUSPENSE: "2104",
  INPUT_VAT: "1103",
  SALES: "4101",
  SALES_RETURN: "4102",
  COGS: "5101",
  EXPENSE: "5201",
} as const;

type Line = { accountCode: string; debit?: number; credit?: number };
type DocFull = Document & { items: DocumentItem[] };

/** กฎการลงบัญชีของแต่ละประเภทเอกสาร */
function buildLines(doc: DocFull, isChild: boolean): Line[] {
  const total = n(doc.grandTotal);
  const net = round2(n(doc.subtotal) - n(doc.discount));
  const vat = n(doc.vatAmount);
  const wht = n(doc.whtAmount);
  const cogs = n(doc.cogs);

  switch (doc.docType) {
    case "INV": {
      const L: Line[] = [
        { accountCode: ACC.AR, debit: round2(net + vat) },
        { accountCode: ACC.SALES, credit: net },
      ];
      if (vat > 0) L.push({ accountCode: ACC.OUTPUT_VAT_SUSPENSE, credit: vat });
      if (cogs > 0) {
        L.push({ accountCode: ACC.COGS, debit: cogs });
        L.push({ accountCode: ACC.INVENTORY, credit: cogs });
      }
      return L;
    }

    case "TI": {
      // ถ้าออกต่อจาก INV → แค่ย้ายภาษีขายรอเรียกเก็บเป็นภาษีขาย
      if (isChild) {
        return vat > 0
          ? [
              { accountCode: ACC.OUTPUT_VAT_SUSPENSE, debit: vat },
              { accountCode: ACC.OUTPUT_VAT, credit: vat },
            ]
          : [];
      }
      const L: Line[] = [
        { accountCode: ACC.AR, debit: round2(net + vat) },
        { accountCode: ACC.SALES, credit: net },
      ];
      if (vat > 0) L.push({ accountCode: ACC.OUTPUT_VAT, credit: vat });
      if (cogs > 0) {
        L.push({ accountCode: ACC.COGS, debit: cogs });
        L.push({ accountCode: ACC.INVENTORY, credit: cogs });
      }
      return L;
    }

    case "RC": {
      const L: Line[] = [{ accountCode: ACC.CASH, debit: total }];
      if (wht > 0) L.push({ accountCode: ACC.WHT_ASSET, debit: wht });
      L.push({ accountCode: ACC.AR, credit: round2(total + wht) });
      return L;
    }

    case "CN": {
      const L: Line[] = [{ accountCode: ACC.SALES_RETURN, debit: net }];
      if (vat > 0) L.push({ accountCode: ACC.OUTPUT_VAT, debit: vat });
      L.push({ accountCode: ACC.AR, credit: round2(net + vat) });
      if (cogs > 0) {
        L.push({ accountCode: ACC.INVENTORY, debit: cogs });
        L.push({ accountCode: ACC.COGS, credit: cogs });
      }
      return L;
    }

    case "BILL": {
      const hasStock = doc.items.some((i) => i.productId);
      const L: Line[] = [
        { accountCode: hasStock ? ACC.INVENTORY : ACC.EXPENSE, debit: net },
      ];
      if (vat > 0) L.push({ accountCode: ACC.INPUT_VAT, debit: vat });
      L.push({ accountCode: ACC.AP, credit: round2(net + vat) });
      return L;
    }

    // QT, DN, PO ไม่ลงบัญชี
    default:
      return [];
  }
}

/** ไล่หา root ของ chain เอกสาร เพื่อกันตัดสต็อกซ้ำ */
async function chainRootId(tx: Prisma.TransactionClient, doc: Document): Promise<string> {
  let cur = doc;
  let guard = 0;
  while (cur.parentId && guard++ < 20) {
    const p = await tx.document.findUnique({ where: { id: cur.parentId } });
    if (!p) break;
    cur = p;
  }
  return cur.id;
}

async function chainDocIds(tx: Prisma.TransactionClient, rootId: string): Promise<string[]> {
  const ids: string[] = [];
  const queue = [rootId];
  let guard = 0;
  while (queue.length && guard++ < 100) {
    const id = queue.shift()!;
    ids.push(id);
    const kids = await tx.document.findMany({ where: { parentId: id }, select: { id: true } });
    queue.push(...kids.map((k) => k.id));
  }
  return ids;
}

/**
 * อนุมัติเอกสาร: ลงบัญชีคู่ + ตัด/รับสต็อก (idempotent — เรียกซ้ำไม่พัง)
 */
export async function postDocument(tx: Prisma.TransactionClient, documentId: string) {
  const doc = await tx.document.findUnique({
    where: { id: documentId },
    include: { items: true, contact: true },
  });
  if (!doc) throw new Error("ไม่พบเอกสาร");
  if (doc.status !== "DRAFT") throw new Error("เอกสารนี้ถูกอนุมัติหรือยกเลิกไปแล้ว");

  const isChild = Boolean(doc.parentId);

  // ---------- 1) Journal Entry ----------
  const lines = buildLines(doc as DocFull, isChild);
  if (lines.length > 0) {
    const totalDr = round2(lines.reduce((s, l) => s + (l.debit ?? 0), 0));
    const totalCr = round2(lines.reduce((s, l) => s + (l.credit ?? 0), 0));
    if (Math.abs(totalDr - totalCr) > 0.01) {
      throw new Error(`รายการบัญชีไม่สมดุล: Dr ${totalDr} / Cr ${totalCr}`);
    }

    await tx.journalEntry.create({
      data: {
        entryNo: await nextEntryNo(tx, doc.issueDate),
        entryDate: doc.issueDate,
        refDocId: doc.id,
        description: `${doc.docNo} - ${doc.contact.name}`,
        lines: {
          create: lines.map((l) => ({
            accountCode: l.accountCode,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
          })),
        },
      },
    });
  }

  // ---------- 2) Stock ----------
  const isOut = STOCK_OUT_TYPES.includes(doc.docType);
  const isIn = STOCK_IN_TYPES.includes(doc.docType);

  if (isOut || isIn) {
    const rootId = await chainRootId(tx, doc);
    const allIds = await chainDocIds(tx, rootId);
    const already = await tx.stockMove.count({ where: { documentId: { in: allIds } } });

    if (already === 0) {
      for (const it of doc.items) {
        if (!it.productId) continue;
        const p = await tx.product.findUnique({ where: { id: it.productId } });
        if (!p || p.isService) continue;

        const qty = isOut ? -n(it.qty) : n(it.qty);
        await tx.stockMove.create({
          data: {
            productId: it.productId,
            documentId: doc.id,
            qty,
            unitCost: it.unitCost,
            reason: `${doc.docType} ${doc.docNo}`,
          },
        });
        await tx.product.update({
          where: { id: it.productId },
          data: { stockQty: { increment: qty } },
        });
      }
    }
  }

  // ---------- 3) Update status ----------
  const newStatus = doc.docType === "RC" ? "PAID" : "APPROVED";
  await tx.document.update({ where: { id: doc.id }, data: { status: newStatus } });

  // ใบเสร็จ → ปิดยอดเอกสารต้นทาง
  if (doc.docType === "RC" && doc.parentId) {
    const ids = await chainDocIds(tx, await chainRootId(tx, doc));
    await tx.document.updateMany({
      where: { id: { in: ids }, docType: { in: ["INV", "TI"] }, status: "APPROVED" },
      data: { status: "PAID" },
    });
  }

  return { ok: true, journalLines: lines.length };
}

export function canConvert(from: DocType, to: DocType): boolean {
  const map: Partial<Record<DocType, DocType[]>> = {
    QT: ["INV", "DN", "TI"], INV: ["DN", "TI", "RC"], DN: ["TI"], TI: ["RC"], PO: ["BILL"],
  };
  return map[from]?.includes(to) ?? false;
}
