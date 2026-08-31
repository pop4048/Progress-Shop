import { Prisma } from "@prisma/client";

export type Num = number | string | Prisma.Decimal | null | undefined;

/** แปลง Decimal/string → number อย่างปลอดภัย */
export const n = (v: Num): number => (v == null ? 0 : Number(v.toString()));

/** ปัดทศนิยม 2 ตำแหน่งแบบ half-up (กันปัญหา floating point) */
export const round2 = (v: number): number =>
  Math.round((v + Number.EPSILON) * 100) / 100;

/** ฟอร์แมตเงินบาท */
export const thb = (v: Num): string =>
  n(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d: Date | string): string =>
  new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });

export interface CalcLine {
  qty: number;
  unitPrice: number;
  discount?: number;
  vatType?: "VAT" | "NON_VAT" | "ZERO";
  unitCost?: number;
}

export interface CalcResult {
  subtotal: number;
  discount: number;
  vatBase: number;
  vatAmount: number;
  whtAmount: number;
  grandTotal: number;
  cogs: number;
  lines: (CalcLine & { amount: number })[];
}

/** เครื่องคิดเลขกลางของระบบ — ใช้ทั้ง client และ server เพื่อให้ตัวเลขตรงกัน 100% */
export function calcDocument(
  lines: CalcLine[],
  opts: { docDiscount?: number; vatRate?: number; whtRate?: number } = {}
): CalcResult {
  const vatRate = opts.vatRate ?? 7;
  const docDiscount = opts.docDiscount ?? 0;

  const withAmount = lines.map((l) => ({
    ...l,
    amount: round2(l.qty * l.unitPrice - (l.discount ?? 0)),
  }));

  const subtotal = round2(withAmount.reduce((s, l) => s + l.amount, 0));
  const netAfterDisc = round2(subtotal - docDiscount);
  const ratio = subtotal > 0 ? netAfterDisc / subtotal : 0;

  const vatBase = round2(
    withAmount
      .filter((l) => (l.vatType ?? "VAT") === "VAT")
      .reduce((s, l) => s + l.amount * ratio, 0)
  );

  const vatAmount = round2((vatBase * vatRate) / 100);
  const whtAmount = round2((netAfterDisc * (opts.whtRate ?? 0)) / 100);
  const grandTotal = round2(netAfterDisc + vatAmount - whtAmount);
  const cogs = round2(withAmount.reduce((s, l) => s + l.qty * (l.unitCost ?? 0), 0));

  return { subtotal, discount: docDiscount, vatBase, vatAmount, whtAmount, grandTotal, cogs, lines: withAmount };
}
