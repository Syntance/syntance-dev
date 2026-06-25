import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { TimeTrackingApp } from "@/components/strategy-hub/apps/time-tracking-app";

export const metadata = {
  title: "Liczenie godzin · Custom Apps",
};

export default async function TimeTrackingPage() {
  await requireStrategyHubAccess();
  return <TimeTrackingApp />;
}
