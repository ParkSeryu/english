"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const bottomNavItems = [
  { href: "/expressions", label: "표현" },
  { href: "/memorize", label: "암기" },
  { href: "/questions", label: "질문거리" }
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden" aria-label="하단 주요 메뉴">
      <div className="mx-auto grid max-w-3xl grid-cols-3 px-2 py-2 text-center text-xs font-black text-slate-700">
        {bottomNavItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={`rounded-2xl px-2 py-3 transition ${active ? "bg-teal-50 text-teal-700" : "hover:bg-teal-50 hover:text-teal-700"}`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
