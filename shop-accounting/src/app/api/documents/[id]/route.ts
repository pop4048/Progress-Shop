import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      contact: true,
      items: { include: { product: true }, orderBy: { lineNo: "asc" } },
      parent: true,
      children: true,
      journals: { include: { lines: { include: { account: true } } } },
    },
  });
  if (!doc) return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 });
  if (doc.status !== "DRAFT") {
    return NextResponse.json({ error: "ลบได้เฉพาะเอกสารสถานะร่าง" }, { status: 400 });
  }
  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
