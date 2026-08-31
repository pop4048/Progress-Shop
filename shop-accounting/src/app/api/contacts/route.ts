import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    where: { isActive: true }, orderBy: { code: "asc" },
  });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const count = await prisma.contact.count();
    const created = await prisma.contact.create({
      data: {
        code: b.code || `C${String(count + 1).padStart(3, "0")}`,
        name: b.name,
        type: b.type ?? "CUSTOMER",
        taxId: b.taxId || null,
        branch: b.branch || "สำนักงานใหญ่",
        address: b.address || null,
        phone: b.phone || null,
        email: b.email || null,
        creditDays: Number(b.creditDays ?? 30),
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
