import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s — Strategy Hub | Syntance",
    default: "Strategy Hub | Syntance",
  },
  description: "Panel zarządzania strategią projektów Syntance.",
};

export default function StrategyHubRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
