import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminSession } from "@/lib/auth";
import { getAdminRole } from "@/lib/strategy-hub/context";
import { listWorkspaceMembers } from "@/lib/strategy-hub/team";
import { TeamDashboard } from "./team-dashboard";

export const metadata = { title: "Zespół" };

export default async function TeamSettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  const [members, role] = await Promise.all([
    listWorkspaceMembers(session.email),
    getAdminRole(session.email),
  ]);

  return (
    <div className="w-full min-w-0 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/strategy-hub/settings">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Zespół</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zaproś współpracowników do panelu agencji — współdzielą Twój workspace i projekty.
          </p>
        </div>
      </div>

      <TeamDashboard
        initialMembers={members}
        currentEmail={session.email}
        currentRole={role}
      />
    </div>
  );
}
