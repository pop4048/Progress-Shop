import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postDocument } from "@/lib/posting";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const result = await prisma.$transaction((tx) => postDocument(tx, id));
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
