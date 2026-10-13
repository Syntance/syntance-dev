import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { WektoryzatorApp } from "@/components/strategy-hub/apps/wektoryzator/wektoryzator-app";

export const metadata = {
  title: "Wektoryzator · Custom Apps",
};

export default async function WektoryzatorPage() {
  await requireStrategyHubAccess();
  return <WektoryzatorApp />;
}
