import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        unit: body.unit,
        costPrice: body.costPrice,
        sellPrice: body.sellPrice,
        vatType: body.vatType,
        reorderPoint: body.reorderPoint,
        categoryId: body.categoryId || null,
      },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await prisma.product.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
