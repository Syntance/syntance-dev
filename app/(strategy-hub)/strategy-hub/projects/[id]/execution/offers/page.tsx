import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Produkty i usługi</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Oferty przypisane do segmentów — fundament value proposition per grupa.
        </p>
      </div>
      <OffersClient projectId={id} />
    </div>
  );
}
