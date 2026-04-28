import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AppNav } from "@/components/AppNav";
import { getCurrentUser } from "@/lib/auth";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "영어 복습 앱",
  description: "학원 영어 내용을 모바일에서 복습하는 리빌 리뷰 앱."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className={inter.className}>
        <AppNav user={user} />
        <main className="mx-auto min-h-[calc(100vh-64px)] max-w-3xl px-4 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
