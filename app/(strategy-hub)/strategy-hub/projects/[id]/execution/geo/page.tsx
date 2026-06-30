import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { EntityCrud, type FieldDef } from "@/components/strategy-hub/entity-crud";

export const metadata = { title: "GEO / AEO" };

const ASSET_FIELDS: FieldDef[] = [
  {
    key: "type",
    label: "Typ assetu",
    type: "select",
    primary: true,
    options: [
      { value: "llms_txt", label: "llms.txt" },
      { value: "schema_jsonld", label: "Schema JSON-LD" },
      { value: "answer_page", label: "Answer page" },
      { value: "faq", label: "FAQ" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    badge: true,
    options: [
      { value: "todo", label: "Do zrobienia" },
      { value: "in_progress", label: "W toku" },
      { value: "done", label: "Gotowe" },
    ],
  },
  { key: "notesMd", label: "Notatki", type: "textarea" },
];

const QUERY_FIELDS: FieldDef[] = [
  { key: "query", label: "Zapytanie", type: "text", primary: true },
  { key: "intent", label: "Intencja", type: "text" },
  {
    key: "stage",
    label: "Faza",
    type: "select",
    options: [
      { value: "TOFU", label: "TOFU" },
      { value: "MOFU", label: "MOFU" },
      { value: "BOFU", label: "BOFU" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "monitoring", label: "Monitoring" },
      { value: "cited", label: "Cytowany" },
      { value: "missing", label: "Brak cytowania" },
    ],
  },
];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GeoPage({ params }: Props) {
  const { id } = await params;
  let project;
  try {
    project = await getProjectById(id);
  } catch {
    project = null;
  }
  if (!project) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">GEO / AEO</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Assety i zapytania pod cytowalność w AI — powiązane z elementami lejka.
        </p>
      </div>
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Assety GEO</h3>
        <EntityCrud
          projectId={id}
          entity="geo-assets"
          fields={ASSET_FIELDS}
          addLabel="Dodaj asset"
          emptyHint="Brak assetów GEO."
        />
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Zapytania monitorowane</h3>
        <EntityCrud
          projectId={id}
          entity="geo-queries"
          fields={QUERY_FIELDS}
          addLabel="Dodaj zapytanie"
          emptyHint="Brak zapytań GEO."
        />
      </section>
    </div>
  );
}
