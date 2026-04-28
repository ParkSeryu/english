import { redirect } from "next/navigation";

export default function LegacyLessonRedirectPage() {
  redirect("/expressions");
}
