import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/strategy-hub/context";
import { WeeklyReviewClient } from "@/components/strategy-hub/weekly-review-client";

export const metadata = { title: "Weekly review" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReviewPage({ params }: Props) {
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
        <h2 className="text-lg font-semibold">Weekly review</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Co zmieniono w 7 dni, alerty KPI i lista zadań. Skrót: ⌘⇧R.
        </p>
      </div>
      <WeeklyReviewClient projectId={id} projectName={project.name} />
    </div>
  );
}
