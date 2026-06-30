import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { projects, strategyRuleSets } from "@/db/schema";
import { isNull, ne } from "drizzle-orm";
import { resolveRules } from "@/lib/strategy-hub/rules/resolve";
import { RulesConfigSchema } from "@/lib/strategy-hub/rules/types";
import { RulesEditor } from "./rules-editor";

export const metadata = { title: "Reguły strategii" };

export default async function RulesSettingsPage() {
  const globalConfig = await resolveRules();

  const [projectRows, overrideRows] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(isNull(projects.deletedAt))
      .limit(50),
    db
      .select()
      .from(strategyRuleSets)
      .where(ne(strategyRuleSets.scope, "global")),
  ]);

  const projectScopes = projectRows
    .map((p) => {
      const row = overrideRows.find((r) => r.scope === p.id);
      if (!row) return null;
      const parsed = RulesConfigSchema.safeParse(row.config);
      if (!parsed.success) return null;
      return { scope: p.id, label: p.name, config: parsed.data };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/strategy-hub/settings">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Reguły strategii</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Silnik reguł — moduły, połączenia mapy, korelacje grafu, alerty i paleta.
          </p>
        </div>
      </div>

      <RulesEditor initialGlobal={globalConfig} projectScopes={projectScopes} />
    </div>
  );
}
