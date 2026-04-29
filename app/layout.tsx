import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { AppNav } from "@/components/AppNav";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { getCurrentUser } from "@/lib/auth";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "영어 표현 암기",
  description: "매일 배운 영어 문장을 한국어 프롬프트로 떠올리는 암기 앱.",
  applicationName: "영어 표현 암기",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "영어암기"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  openGraph: {
    title: "영어 표현 암기",
    description: "한국어만 보고 영어 문장을 떠올리는 개인 영어 표현 암기 앱.",
    url: "/",
    siteName: "영어 표현 암기",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "영어 표현 암기 앱 미리보기"
      }
    ],
    locale: "ko_KR",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "영어 표현 암기",
    description: "한국어만 보고 영어 문장을 떠올리는 개인 영어 표현 암기 앱.",
    images: ["/opengraph-image"]
  }
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
        <ServiceWorkerRegistration />
        <AppNav user={user} />
        <main className="mx-auto min-h-[calc(100vh-64px)] max-w-3xl px-4 pb-28 pt-6 sm:py-8">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}
