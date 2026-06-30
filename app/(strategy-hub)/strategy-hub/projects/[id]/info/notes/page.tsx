import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { EntityCrud, type FieldDef } from "@/components/strategy-hub/entity-crud";

export const metadata = { title: "Notatki" };

const FIELDS: FieldDef[] = [
  {
    key: "contentMd",
    label: "Treść notatki",
    type: "textarea",
    primary: true,
    placeholder: "Ustalenia, kontekst, decyzje robocze…",
  },
  {
    key: "authorType",
    label: "Autor",
    type: "select",
    badge: true,
    options: [
      { value: "team", label: "Zespół", tone: "info" },
      { value: "client", label: "Klient", tone: "warning" },
      { value: "ai", label: "AI", tone: "neutral" },
    ],
  },
];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NotesPage({ params }: Props) {
  const { id } = await params;

  const project = await getProjectById(id);
  if (!project) notFound();

  return (
    <div className="w-full min-w-0 space-y-6">
      <header>
        <p className="text-xs font-medium text-muted-foreground">{project.name}</p>
        <h1 className="text-xl font-semibold tracking-tight">Notatki</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Luźne ustalenia, kontekst i notatki robocze projektu.
        </p>
      </header>

      <EntityCrud
        projectId={id}
        entity="notes"
        fields={FIELDS}
        addLabel="Dodaj notatkę"
        emptyHint="Brak notatek. Dodaj pierwszą."
        defaults={{ authorType: "team" }}
      />
    </div>
  );
}
