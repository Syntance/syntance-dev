import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminSession } from "@/lib/auth";
import { getCurrentOrganizationForAdmin } from "@/lib/strategy-hub/context";
import { getOrganizationBranding } from "@/lib/client-portal/branding";
import { BrandingDashboard } from "./branding-dashboard";

export const metadata = { title: "Branding (white-label)" };

export default async function BrandingSettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  // Branding jest per organizacja — edytujemy tę, w której admin aktualnie pracuje.
  const organization = await getCurrentOrganizationForAdmin(session.email);
  const branding = await getOrganizationBranding(organization.id);

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
