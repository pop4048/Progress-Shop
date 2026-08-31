import type { DocType } from "@prisma/client";

export const DOC_LABEL: Record<DocType, string> = {
  QT: "ใบเสนอราคา",
  INV: "ใบแจ้งหนี้",
  DN: "ใบส่งสินค้า",
  TI: "ใบกำกับภาษี",
  RC: "ใบเสร็จรับเงิน",
  CN: "ใบลดหนี้",
  PO: "ใบสั่งซื้อ",
  BILL: "บันทึกค่าใช้จ่าย",
};

export const DOC_PREFIX: Record<DocType, string> = {
  QT: "QT", INV: "INV", DN: "DN", TI: "TI", RC: "RC", CN: "CN", PO: "PO", BILL: "BL",
};

/** เอกสารปลายทางที่แปลงต่อได้ */
export const CONVERT_MAP: Partial<Record<DocType, DocType[]>> = {
  QT: ["INV", "DN", "TI"],
  INV: ["DN", "TI", "RC"],
  DN: ["TI"],
  TI: ["RC"],
  PO: ["BILL"],
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "ร่าง", APPROVED: "อนุมัติแล้ว", PAID: "ชำระแล้ว", VOID: "ยกเลิก",
};

export const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  VOID: "bg-red-100 text-red-700",
};

/** เอกสารที่ตัดสต็อก (ตัดครั้งเดียวต่อ chain) */
export const STOCK_OUT_TYPES: DocType[] = ["DN", "TI", "INV"];
export const STOCK_IN_TYPES: DocType[] = ["BILL"];
