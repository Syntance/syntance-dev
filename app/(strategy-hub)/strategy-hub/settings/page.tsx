import type { Metadata } from "next";
import { SettingsDashboard } from "./settings-dashboard";

export const metadata: Metadata = {
  title: "Ustawienia",
};

export default function SettingsPage() {
  return <SettingsDashboard />;
}
