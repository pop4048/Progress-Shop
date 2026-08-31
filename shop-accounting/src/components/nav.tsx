"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { href: "/", label: "ภาพรวม", icon: "📊" },
  { href: "/products", label: "สินค้า", icon: "📦" },
  { href: "/contacts", label: "ลูกค้า/ผู้ขาย", icon: "👥" },
  { href: "/documents", label: "เอกสาร", icon: "📄" },
  { href: "/reports/pl", label: "กำไรขาดทุน", icon: "📈" },
  { href: "/reports/trial-balance", label: "งบทดลอง", icon: "⚖️" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <aside className="no-print fixed inset-y-0 left-0 w-56 border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h1 className="text-base font-bold text-brand">ระบบบัญชีร้านค้า</h1>
        <p className="text-xs text-slate-400">Shop Accounting</p>
      </div>
      <nav className="space-y-1 p-3">
        {MENU.map((m) => {
          const active = m.href === "/" ? path === "/" : path.startsWith(m.href);
          return (
            <Link key={m.href} href={m.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-brand-light font-semibold text-brand-dark" : "text-slate-600 hover:bg-slate-100"
              }`}>
              <span>{m.icon}</span>{m.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
