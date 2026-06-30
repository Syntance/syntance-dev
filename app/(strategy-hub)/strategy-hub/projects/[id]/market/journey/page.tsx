import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

/** Placeholder — edytor customer journey w Fazie 3+. */
export default async function MarketJourneyPage({ params }: Props) {
  const { id } = await params;
  redirect(`/strategy-hub/projects/${id}/market/segments`);
}
