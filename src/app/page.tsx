import { redirect } from "next/navigation";

// spec-009-v1: authenticated landing goes to Overview.
export default function Home() {
  redirect("/overview");
}
