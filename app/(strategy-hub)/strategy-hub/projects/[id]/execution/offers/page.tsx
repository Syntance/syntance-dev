import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { resolveFoundationSource } from "@/lib/strategy-hub/scope";
import { OffersClient } from "@/components/strategy-hub/offers-client";

export const metadata = { title: "Oferty" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OffersPage({ params }: Props) {
  const { id } = await params;
  let project;
  try {
    project = await getProjectById(id);
  } catch {
    project = null;
  }
  if (!project) notFound();

  // Oferty należą do fundamentu (W0), a segmenty są lokalne dla projektu —
  // przy dziedziczeniu nie ma poprawnego miejsca na zapis przypisania
  // oferta↔segment, więc edytor musi to powiedzieć wprost zamiast pokazywać
  // pusty picker, który i tak odbije się o 409.
  const fundament = await resolveFoundationSource(id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Produkty i usługi</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Oferty przypisane do segmentów — fundament value proposition per grupa.
        </p>
      </div>
      <OffersClient
        projectId={id}
        foundationInherited={fundament.inherited}
        foundationSourceName={fundament.sourceName}
      />
    </div>
  );
}
