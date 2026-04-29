"use client";

import { useEffect, useRef, useState } from "react";

import { signOutAction } from "@/app/actions";
import type { UserIdentity } from "@/lib/types";

export function AccountMenu({ user }: { user: UserIdentity }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-white hover:text-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-100"
        aria-label="계정 설정"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-1 .6V20a2 2 0 0 1-4 0v-.09a1.8 1.8 0 0 0-1-.6 1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-.6-1H4a2 2 0 0 1 0-4h.09a1.8 1.8 0 0 0 .6-1 1.8 1.8 0 0 0-.36-1.98l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.8 1.8 0 0 0 9 4.6a1.8 1.8 0 0 0 1-.6V4a2 2 0 0 1 4 0v.09a1.8 1.8 0 0 0 1 .6 1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.8 1.8 0 0 0 19.4 9c.2.35.4.65.6 1H20a2 2 0 0 1 0 4h-.09c-.2.35-.4.65-.51 1Z" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-3xl border border-slate-200 bg-white p-3 text-sm shadow-card" role="menu">
          <div className="border-b border-slate-100 px-3 pb-3">
            <p className="text-xs font-black text-slate-400">계정</p>
            <p className="mt-1 truncate font-bold text-ink">{user.email ?? "로그인됨"}</p>
          </div>
          <form action={signOutAction} className="pt-2">
            <button type="submit" className="w-full rounded-2xl px-3 py-3 text-left font-black text-red-600 transition hover:bg-red-50" role="menuitem">
              로그아웃
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
