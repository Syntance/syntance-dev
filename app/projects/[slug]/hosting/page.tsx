import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/sanity/queries";
import { db } from "@/db";
import {
  projects as dbProjects,
  hostingServices,
  domains,
  clientResources,
} from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import {
  Server,
  Globe,
  Link2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trackVisit } from "@/lib/strategy-hub/tracking";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getHostingData(slug: string) {
  try {
    const rows = await db
      .select({ id: dbProjects.id })
      .from(dbProjects)
      .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
      .limit(1);

    if (!rows[0]) return null;

    const projectId = rows[0].id;
    trackVisit(projectId, "hosting");
    const [services, domainList, resources] = await Promise.all([
      db.select().from(hostingServices).where(eq(hostingServices.projectId, projectId)),
      db.select().from(domains).where(eq(domains.projectId, projectId)),
      db.select().from(clientResources).where(eq(clientResources.projectId, projectId)),
    ]);

    return { services, domainList, resources };
  } catch {
    return null;
  }
}

export default async function HostingPage({ params }: Props) {
  const session = await getClientSession();
  if (!session) redirect("/login");

  const { slug } = await params;

  let project;
  try {
    project = await getProjectBySlugForUser(slug, session.email);
  } catch {
    project = null;
  }

  if (!project) notFound();

  const data = await getHostingData(slug);

  const hasData =
    data &&
    (data.services.length > 0 ||
      data.domainList.length > 0 ||
      data.resources.length > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Server className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">
            Serwisy i hosting
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Infrastruktura projektu — hosting, domeny, panele zarządzania.
        </p>
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <Server className="mx-auto size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Dane hostingowe są jeszcze uzupełniane.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.domainList.length > 0 && (
            <Section icon={Globe} title="Domeny">
              {data.domainList.map((domain) => (
                <div
                  key={domain.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div>
                    <div className="font-medium text-sm">{domain.name}</div>
                    {domain.registrar && (
                      <div className="text-xs text-muted-foreground">
                        {domain.registrar}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {domain.sslStatus === "active" ? (
                      <Badge variant="outline" className="text-success border-success/30 text-[10px]">
                        <CheckCircle2 className="size-2.5 mr-1" /> SSL OK
                      </Badge>
                    ) : domain.sslStatus ? (
                      <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">
                        <AlertCircle className="size-2.5 mr-1" /> SSL
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {data.services.length > 0 && (
            <Section icon={Server} title="Serwisy">
              {data.services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div>
                    <div className="font-medium text-sm">{service.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {service.provider} · {service.type}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={service.status === "active" ? "outline" : "secondary"}
                      className={`text-[10px] ${service.status === "active" ? "text-success border-success/30" : ""}`}
                    >
                      {service.status}
                    </Badge>
                    {service.url && (
                      <a
                        href={service.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {data.resources.length > 0 && (
            <Section icon={Link2} title="Linki i zasoby">
              {data.resources.map((resource) => (
                <a
                  key={resource.id}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 py-3 border-b border-border last:border-0 hover:text-brand transition-colors group"
                >
                  <span className="size-7 rounded-lg bg-muted flex items-center justify-center text-sm shrink-0">
                    {resource.icon ?? "🔗"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{resource.label}</div>
                    {resource.category && (
                      <div className="text-xs text-muted-foreground">
                        {resource.category}
                      </div>
                    )}
                  </div>
                  <ExternalLink className="size-3.5 text-muted-foreground/0 group-hover:text-brand transition-colors" />
                </a>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/20">
        <Icon className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">{title}</span>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}
