import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { DecisionsEditor } from "@/components/strategy-hub/decisions-editor";

export const metadata = { title: "Decyzje strategiczne" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DecisionsPage({ params }: Props) {
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
        <h2 className="text-lg font-semibold tracking-tight">Rejestr decyzji</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Uzasadnienia strategiczne z powiązaniami cause/effect — widoczne na mapie
          firmy jako overlay „dlaczego tak?”.
        </p>
      </div>
      <DecisionsEditor projectId={id} />
    </div>
  );
}
