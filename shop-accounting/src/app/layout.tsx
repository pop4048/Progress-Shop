import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/nav";

export const metadata: Metadata = {
  title: "ระบบบัญชีร้านค้า",
  description: "ระบบบัญชีธุรกิจร้านค้าครบวงจร",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <Nav />
        <main className="ml-56 min-h-screen p-6 print:ml-0">{children}</main>
      </body>
    </html>
  );
}
