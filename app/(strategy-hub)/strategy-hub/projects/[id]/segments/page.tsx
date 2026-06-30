import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SegmentsRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/strategy-hub/projects/${id}/market/segments`);
}
