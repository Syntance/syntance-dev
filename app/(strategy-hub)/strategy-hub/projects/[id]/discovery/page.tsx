import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DiscoveryRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/strategy-hub/projects/${id}/foundation/discovery`);
}
