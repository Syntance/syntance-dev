import { redirect } from "next/navigation";
import { getStrategyHubAccess } from "@/lib/strategy-hub/context";

export default async function AdminPage() {
  const access = await getStrategyHubAccess();
  if (access) {
    redirect("/strategy-hub");
  }
  redirect("/login");
}
