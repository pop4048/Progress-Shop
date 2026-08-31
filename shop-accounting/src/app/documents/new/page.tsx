import { prisma } from "@/lib/db";
import DocEditor from "../doc-editor";

export const dynamic = "force-dynamic";

export default async function NewDocPage() {
  const [products, contacts] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, orderBy: { sku: "asc" } }),
    prisma.contact.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">สร้างเอกสารใหม่</h1>
      <DocEditor
        products={JSON.parse(JSON.stringify(products))}
        contacts={JSON.parse(JSON.stringify(contacts))}
      />
    </div>
  );
}
