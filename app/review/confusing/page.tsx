import { redirect } from "next/navigation";

export default function LegacyConfusingRedirectPage() {
  redirect("/memorize");
}
