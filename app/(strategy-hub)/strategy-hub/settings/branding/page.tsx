import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminSession } from "@/lib/auth";
import { getOrCreateWorkspaceForAdmin } from "@/lib/strategy-hub/context";
import { getWorkspaceBrandingForWorkspace } from "@/lib/client-portal/branding";
import { BrandingDashboard } from "./branding-dashboard";

export const metadata = { title: "Branding (white-label)" };

export default async function BrandingSettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  const ws = await getOrCreateWorkspaceForAdmin(session.email);
  const branding = await getWorkspaceBrandingForWorkspace(ws.id);

  return (
    <div className="w-full min-w-0 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/strategy-hub/settings">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Branding portalu klienta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            White-label — logo, kolory marki i domena widoczne w portalu Twoich klientów.
          </p>
        </div>
      </div>

      <BrandingDashboard initial={branding} />
    </div>
  );
}
