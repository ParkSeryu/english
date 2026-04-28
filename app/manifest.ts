import type { MetadataRoute } from "next";

const siteName = "영어 표현 암기";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "영어암기",
    description: "매일 배운 영어 표현을 한국어 프롬프트로 떠올리는 암기 앱.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0f766e",
    categories: ["education", "productivity"],
    lang: "ko-KR",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "/icons/maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
