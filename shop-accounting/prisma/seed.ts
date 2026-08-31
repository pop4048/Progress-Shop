import { PrismaClient, AccountType, VatType, ContactType } from "@prisma/client";

const prisma = new PrismaClient();

const CHART: [string, string, AccountType][] = [
  ["1101", "เงินสดและเงินฝากธนาคาร", "ASSET"],
  ["1102", "ลูกหนี้การค้า", "ASSET"],
  ["1103", "ภาษีซื้อ", "ASSET"],
  ["1104", "สินค้าคงเหลือ", "ASSET"],
  ["1150", "ภาษีถูกหัก ณ ที่จ่าย", "ASSET"],
  ["1201", "อุปกรณ์สำนักงาน", "ASSET"],
  ["2101", "เจ้าหนี้การค้า", "LIABILITY"],
  ["2103", "ภาษีขาย", "LIABILITY"],
  ["2104", "ภาษีขายรอเรียกเก็บ", "LIABILITY"],
  ["2105", "ภาษีหัก ณ ที่จ่ายค้างจ่าย", "LIABILITY"],
  ["3101", "ทุนจดทะเบียน", "EQUITY"],
  ["3102", "กำไรสะสม", "EQUITY"],
  ["4101", "รายได้จากการขาย", "REVENUE"],
  ["4102", "รับคืนและส่วนลดจ่าย", "REVENUE"],
  ["4201", "รายได้อื่น", "REVENUE"],
  ["5101", "ต้นทุนขาย", "EXPENSE"],
  ["5201", "ค่าใช้จ่ายในการขายและบริหาร", "EXPENSE"],
  ["5202", "เงินเดือนและค่าแรง", "EXPENSE"],
  ["5203", "ค่าเช่า", "EXPENSE"],
  ["5204", "ค่าสาธารณูปโภค", "EXPENSE"],
  ["5205", "ค่าขนส่ง", "EXPENSE"],
  ["5301", "ค่าใช้จ่ายอื่น", "EXPENSE"],
];

async function main() {
  console.log("🌱 Seeding...");

  await prisma.account.createMany({
    data: CHART.map(([code, name, type]) => ({ code, name, type })),
    skipDuplicates: true,
  });

  const company = await prisma.company.findFirst();
  if (!company) {
    await prisma.company.create({
      data: {
        name: "บริษัท ตัวอย่างการค้า จำกัด",
        taxId: "0105561000000",
        branch: "สำนักงานใหญ่",
        address: "123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110",
        phone: "02-000-0000",
        email: "info@example.co.th",
      },
    });
  }

  const catNames = ["เครื่องเขียน", "อุปกรณ์ไอที", "ของใช้สำนักงาน", "บริการ"];
  for (const name of catNames) {
    await prisma.category.upsert({ where: { name }, create: { name }, update: {} });
  }
  const cats = await prisma.category.findMany();
  const cat = (nm: string) => cats.find((c) => c.name === nm)?.id;

  const products = [
    { sku: "P001", name: "ปากกาลูกลื่น น้ำเงิน 0.5", unit: "ด้าม", costPrice: 5, sellPrice: 12, stockQty: 500, categoryId: cat("เครื่องเขียน") },
    { sku: "P002", name: "สมุดโน้ต A5 80 แผ่น", unit: "เล่ม", costPrice: 18, sellPrice: 35, stockQty: 300, categoryId: cat("เครื่องเขียน") },
    { sku: "P003", name: "กระดาษ A4 80 แกรม", unit: "รีม", costPrice: 95, sellPrice: 135, stockQty: 200, categoryId: cat("ของใช้สำนักงาน") },
    { sku: "P004", name: "เมาส์ไร้สาย USB", unit: "ชิ้น", costPrice: 220, sellPrice: 390, stockQty: 80, categoryId: cat("อุปกรณ์ไอที") },
    { sku: "P005", name: "คีย์บอร์ด Mechanical", unit: "ชิ้น", costPrice: 890, sellPrice: 1490, stockQty: 25, reorderPoint: 10, categoryId: cat("อุปกรณ์ไอที") },
    { sku: "P006", name: "แฟลชไดรฟ์ 64GB", unit: "ชิ้น", costPrice: 180, sellPrice: 320, stockQty: 8, reorderPoint: 20, categoryId: cat("อุปกรณ์ไอที") },
    { sku: "S001", name: "ค่าบริการติดตั้งระบบ", unit: "งาน", costPrice: 0, sellPrice: 3500, stockQty: 0, isService: true, categoryId: cat("บริการ") },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      create: { ...p, vatType: VatType.VAT },
      update: {},
    });
  }

  const contacts = [
    { code: "C001", name: "บริษัท เอบีซี เทรดดิ้ง จำกัด", type: ContactType.CUSTOMER, taxId: "0105551111111", address: "88 อาคารสีลม ถนนสีลม กรุงเทพฯ 10500", phone: "02-111-1111", creditDays: 30 },
    { code: "C002", name: "ห้างหุ้นส่วนจำกัด สมชายพาณิชย์", type: ContactType.CUSTOMER, taxId: "0103552222222", address: "45/2 ถนนพระราม 4 กรุงเทพฯ 10110", phone: "02-222-2222", creditDays: 15 },
    { code: "C003", name: "คุณสมหญิง ใจดี", type: ContactType.CUSTOMER, phone: "081-234-5678", creditDays: 0 },
    { code: "V001", name: "บริษัท ซัพพลายเออร์ไทย จำกัด", type: ContactType.VENDOR, taxId: "0105553333333", phone: "02-333-3333", creditDays: 30 },
  ];

  for (const c of contacts) {
    await prisma.contact.upsert({ where: { code: c.code }, create: c, update: {} });
  }

  console.log("✅ Seed เสร็จสิ้น");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
