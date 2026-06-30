import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MarketPage({ params }: Props) {
  const { id } = await params;
  redirect(`/strategy-hub/projects/${id}/market/segments`);
}
