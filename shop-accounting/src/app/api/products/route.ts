import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string().nullish(),
  unit: z.string().default("ชิ้น"),
  costPrice: z.coerce.number().min(0).default(0),
  sellPrice: z.coerce.number().min(0).default(0),
  vatType: z.enum(["VAT", "NON_VAT", "ZERO"]).default("VAT"),
  stockQty: z.coerce.number().default(0),
  reorderPoint: z.coerce.number().default(0),
  isService: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: q ? [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] : undefined,
    },
    include: { category: true },
    orderBy: { sku: "asc" },
    take: 200,
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json());
    const created = await prisma.product.create({ data: { ...data, categoryId: data.categoryId || null } });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
