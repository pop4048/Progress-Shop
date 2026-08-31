import type { Prisma, DocType } from "@prisma/client";
import { DOC_PREFIX } from "./constants";

/** สร้างเลขที่เอกสารแบบ atomic — ต้องเรียกภายใน transaction */
export async function nextDocNo(tx: Prisma.TransactionClient, docType: DocType, date = new Date()) {
  const year = date.getFullYear();
  const key = `${DOC_PREFIX[docType]}-${year}`;

  const seq = await tx.docSequence.upsert({
    where: { key },
    create: { key, current: 1 },
    update: { current: { increment: 1 } },
  });

  return `${DOC_PREFIX[docType]}-${year}-${String(seq.current).padStart(4, "0")}`;
}

export async function nextEntryNo(tx: Prisma.TransactionClient, date = new Date()) {
  const key = `JV-${date.getFullYear()}`;
  const seq = await tx.docSequence.upsert({
    where: { key }, create: { key, current: 1 }, update: { current: { increment: 1 } },
  });
  return `JV-${date.getFullYear()}-${String(seq.current).padStart(5, "0")}`;
}
