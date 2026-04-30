import Link from "next/link";

import { UpdatePasswordForm } from "@/components/UpdatePasswordForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <section className="mx-auto max-w-sm rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-card sm:px-6" aria-label="비밀번호 재설정 링크 오류">
        <p className="text-sm font-bold text-red-700">비밀번호 재설정</p>
        <h1 className="mt-1 text-2xl font-black text-ink">링크 확인이 필요합니다</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">재설정 링크가 만료되었거나 세션을 확인할 수 없습니다. 메일의 비밀번호 재설정 링크를 다시 열어 주세요.</p>
        <Link href="/login" className="btn-primary mt-5 w-full">
          로그인 화면으로 돌아가기
        </Link>
      </section>
    );
  }

  return <UpdatePasswordForm />;
}
