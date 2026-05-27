import { StrategyHubShell } from "@/components/strategy-hub/strategy-hub-shell";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";

export default async function StrategyHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStrategyHubAccess();

  return <StrategyHubShell>{children}</StrategyHubShell>;
}
