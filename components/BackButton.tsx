"use client";

import { usePathname, useRouter } from "next/navigation";

function fallbackHref(pathname: string) {
  if (pathname.startsWith("/expressions/") || pathname.startsWith("/items/")) return "/expressions";
  if (pathname.startsWith("/questions/")) return "/questions";
  if (pathname.startsWith("/cards/") || pathname.startsWith("/lessons/")) return "/expressions";
  return "/";
}

function shouldShowBackButton(pathname: string, enabled: boolean) {
  if (!enabled) return false;
  return pathname !== "/" && pathname !== "/login";
}

export function BackButton({ enabled = true }: { enabled?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  if (!shouldShowBackButton(pathname, enabled)) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref(pathname));
      }}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-2xl font-black leading-none text-slate-600 transition hover:bg-white hover:text-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-100"
      aria-label="뒤로 가기"
      title="뒤로 가기"
    >
      <span aria-hidden="true">‹</span>
    </button>
  );
}
