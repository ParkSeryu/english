import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AppNav } from "@/components/AppNav";
import { getCurrentUser } from "@/lib/auth";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "영어 표현 암기",
  description: "매일 배운 영어 문장을 한국어 프롬프트로 떠올리는 암기 앱."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="ko">
      <body className={inter.className}>
        <AppNav user={user} />
        <main className="mx-auto min-h-[calc(100vh-64px)] max-w-3xl px-4 pb-28 pt-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
