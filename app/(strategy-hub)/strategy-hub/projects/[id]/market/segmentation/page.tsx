import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

/** Placeholder — kryteria segmentacji w Fazie 3+. */
export default async function MarketSegmentationPage({ params }: Props) {
  const { id } = await params;
  redirect(`/strategy-hub/projects/${id}/market/segments`);
}
