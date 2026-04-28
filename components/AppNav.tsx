import Link from "next/link";

import { signOutAction } from "@/app/actions";
import { BottomNav } from "@/components/BottomNav";
import type { UserIdentity } from "@/lib/types";

export function AppNav({ user }: { user: UserIdentity | null }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-base font-black text-ink">영어 암기</Link>
          <nav className="flex items-center gap-2 text-sm font-bold">
            {user ? <form action={signOutAction}><button className="nav-link" type="submit">로그아웃</button></form> : <Link href="/login" className="nav-link">로그인</Link>}
          </nav>
        </div>
      </header>
      {user ? <BottomNav /> : null}
    </>
  );
}
